// Canvas Assistant operation pipeline: zod schema for generateObject, the
// server-side sanitizer that converts raw model rows into a SanitizedProposal
// (the client never applies raw model output), the prompt guide, and the
// client-side routing heuristic.

import { z } from "zod";
import type { HypercubeFaceTag } from "@/types/canvas-elements";
import { HYPERCUBE_FACE_TAGS } from "@/types/canvas-elements";
import type { CanvasInventory, SanitizedProposal, SemanticOp, ProposalRow, UpdatePatch } from "@/types/ai-operations";
import {
  generatedToCanvas,
  buildConnectorEdge,
  TINT_COLORS,
  SHAPE_TYPES,
  type GeneratedElement,
  type GeneratedEdge,
} from "./element-generation";

const HYPERCUBE_TAG_VALUES = HYPERCUBE_FACE_TAGS as [HypercubeFaceTag, ...HypercubeFaceTag[]];

const MAX_OPS = 40;
const MAX_SUMMARY = 160;
const MAX_TEXT = 2000;
const COORD_LIMIT = 50000;

// Flat row + op enum + OPTIONAL fields. Two hard provider constraints shape this:
//   1. Anthropic rejects minItems/maxItems on arrays outright.
//   2. Anthropic caps union-typed parameters at 16, and every `.nullable()`
//      compiles to an anyOf union — 30 nullable fields failed the whole request
//      with "Schemas contains too many parameters with union types".
// `.optional()` drops a field from `required` without creating a union, so it
// satisfies both, and the model emits only the fields an op actually uses
// instead of ~30 explicit nulls per row. Bounds live in the sanitizer below.
// EVERY FIELD IS REQUIRED — deliberately. Anthropic's grammar compiler rejects
// this schema outright ("Schema is too complex") when the array element carries
// ~13 optional properties, because each optional doubles the grammar branches;
// the identical field set with everything required compiles fine. Verified by
// probe against the live API. So the model always emits all fields and uses a
// sentinel when one doesn't apply: "" for strings, [] for targetIds, "none" for
// kind, "{}" for props. The sanitizer treats sentinels as absent.
//
// Geometry for UPDATES lives in `props`, not in x/y/width/height: with required
// numbers there is no way to distinguish "leave x alone" from "set x to 0",
// whereas an absent JSON key is unambiguous. Creates use the typed numbers,
// where an explicit position is always wanted anyway.
export const canvasOpRowSchema = z.object({
  op: z.enum(["create", "update", "delete", "tag", "group", "connect", "task", "note", "comment"]),
  summary: z.string().describe('Short human-readable description of this change, e.g. "Delete 2 empty cards"'),
  kind: z.enum([
    "container", "text", "shape", "freeform", "image", "line",
    "table", "link", "board", "experienceBlock", "none",
  ])
    .describe("Element type for op=create ('none' for every other op). Prefer 'freeform' for editable cards."),
  ref: z.string().describe('op=create: unique short ref, e.g. "c1", "n2". "" otherwise.'),
  parentRef: z.string().describe('op=create: ref of the container this element sits inside. "" otherwise.'),
  targetIds: z.array(z.string()).describe("Existing element ids from the inventory ONLY. [] when unused."),
  label: z.string().describe('Container label / note title / group name / edge label / task title, per op. "" when unused.'),
  content: z.string().describe('Text body, note body, or task description, per op. "" when unused.'),
  x: z.number().describe("op=create only (0 otherwise)."),
  y: z.number().describe("op=create only (0 otherwise)."),
  width: z.number().describe("op=create only (0 otherwise)."),
  height: z.number().describe("op=create only (0 otherwise)."),
  fromRef: z.string().describe('op=connect: source element id or ref. "" otherwise.'),
  toRef: z.string().describe('op=connect: target element id or ref. "" otherwise.'),
  props: z.string()
    .describe('JSON object string of extras — "{}" when none. e.g. {"emoji":"💡","tint":"violet","addTags":["Sensory Domains"],"priority":"high","x":100}'),
});

// NOTE: no .min()/.max() on any array in a generateObject schema. Anthropic's
// structured output rejects minItems/maxItems outright ("For 'array' type,
// property 'maxItems' is not supported"), which fails the whole request for
// Claude users. Bounds are enforced in sanitizeCanvasOperations instead.
export const canvasOperationsSchema = z.object({
  reply: z.string().describe("1-3 sentence explanation of the proposed changes, shown to the user"),
  operations: z.array(canvasOpRowSchema).describe(`At most ${MAX_OPS} operations.`),
});

export type CanvasOpRow = z.infer<typeof canvasOpRowSchema>;
export type CanvasOperationsRaw = z.infer<typeof canvasOperationsSchema>;

const clampNum = (v: number | null | undefined, min: number, max: number, fallback: number) =>
  v == null || !Number.isFinite(v) ? fallback : Math.min(Math.max(v, min), max);

/** Parse the model's `props` JSON bag; malformed input yields an empty bag so a
 *  bad extras blob never costs us the operation itself. */
function parseProps(raw: string | null | undefined): Record<string, unknown> {
  if (!raw || typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

const propStr = (v: unknown, max: number): string | undefined =>
  typeof v === "string" && v.trim() ? v.slice(0, max) : undefined;

const propOneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;

function validTags(tags: (HypercubeFaceTag | string)[] | null | undefined): HypercubeFaceTag[] {
  if (!tags) return [];
  return Array.from(new Set(tags.filter((t): t is HypercubeFaceTag => (HYPERCUBE_FACE_TAGS as readonly string[]).includes(t))));
}

/**
 * Server-side conversion of raw model rows into a SanitizedProposal:
 * - create rows collapse into ONE converted batch via generatedToCanvas
 *   (fresh UUIDs, clamped coords, tag hygiene) + ref-to-ref connects ride along
 * - targeting rows keep only ids present in the inventory
 * - malformed rows are dropped, never fail the whole proposal
 */
export function sanitizeCanvasOperations(
  raw: CanvasOperationsRaw,
  inventory: CanvasInventory,
): SanitizedProposal {
  const knownIds = new Set(inventory.elements.map((e) => e.id));
  const rows: ProposalRow[] = [];
  const ops: SemanticOp[] = [];

  const createRows: CanvasOpRow[] = [];
  const refConnects: GeneratedEdge[] = [];
  const mixedConnects: { ref: string; existingId: string; refIsSource: boolean; label: string | null }[] = [];
  // Connect rows that produce no row of their own because their edge rides
  // along with the creates batch — kept, not dropped.
  let absorbedConnects = 0;
  let rowSeq = 0;
  const nextRowId = () => `row-${++rowSeq}`;

  // Telemetry: attempted vs. kept at raw-row granularity (see droppedCount below).
  const attemptedRows = (raw.operations || []).slice(0, MAX_OPS);
  let keptNonCreate = 0;
  const DUE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  for (const r of attemptedRows) {
    const summary = (r.summary || "").trim().slice(0, MAX_SUMMARY);
    const p = parseProps(r.props);
    switch (r.op) {
      case "create": {
        if (!r.kind || r.kind === "none" || !r.ref?.trim()) break;
        // A ref colliding with a real inventory id could silently redirect a
        // ref-connect onto an unrelated existing element — drop the row.
        if (knownIds.has(r.ref)) break;
        createRows.push(r);
        break;
      }
      case "update": {
        const ids = Array.from(new Set((r.targetIds || []).filter((t) => knownIds.has(t))));
        if (ids.length === 0) break;
        const patch: UpdatePatch = {};
        if (typeof r.content === "string" && r.content.trim()) patch.content = r.content.slice(0, MAX_TEXT);
        if (typeof r.label === "string" && r.label.trim()) patch.label = r.label.slice(0, 120);
        // Geometry comes from props for updates — see the schema note: a
        // required number cannot express "leave this alone", a missing JSON key can.
        if (typeof p.x === "number") patch.x = clampNum(p.x, -COORD_LIMIT, COORD_LIMIT, 0);
        if (typeof p.y === "number") patch.y = clampNum(p.y, -COORD_LIMIT, COORD_LIMIT, 0);
        if (typeof p.width === "number") patch.width = clampNum(p.width, 20, 4000, 300);
        if (typeof p.height === "number") patch.height = clampNum(p.height, 20, 4000, 100);
        // Editable presentation properties, whitelisted from the props bag.
        const emoji = propStr(p.emoji, 8);
        if (emoji) patch.emoji = emoji;
        const noteTitle = propStr(p.noteTitle, 120);
        if (noteTitle) patch.noteTitle = noteTitle;
        const noteBody = propStr(p.noteBody, MAX_TEXT);
        if (noteBody) patch.noteBody = noteBody;
        const tint = propOneOf(p.tint, TINT_COLORS);
        if (tint) patch.tintColor = tint;
        const shapeType = propOneOf(p.shapeType, SHAPE_TYPES);
        if (shapeType) patch.shapeType = shapeType;
        if (Object.keys(patch).length === 0) break;
        // One row covers ALL surviving target ids — the approval checkbox
        // must not silently narrow to just the first id.
        const rowId = nextRowId();
        for (const id of ids) {
          ops.push({ rowId, kind: "update", id, patch });
        }
        const base = summary || "Update element";
        rows.push({
          rowId,
          kind: "update",
          summary: ids.length > 1 ? `${base} (${ids.length} elements)` : base,
          destructive: false,
        });
        keptNonCreate++;
        break;
      }
      case "delete": {
        const ids = Array.from(new Set((r.targetIds || []).filter((t) => knownIds.has(t))));
        if (ids.length === 0) break;
        const rowId = nextRowId();
        ops.push({ rowId, kind: "delete", ids });
        rows.push({ rowId, kind: "delete", summary: summary || `Delete ${ids.length} element(s)`, destructive: true });
        keptNonCreate++;
        break;
      }
      case "tag": {
        const ids = Array.from(new Set((r.targetIds || []).filter((t) => knownIds.has(t))));
        const add = validTags(Array.isArray(p.addTags) ? (p.addTags as string[]) : null);
        const remove = validTags(Array.isArray(p.removeTags) ? (p.removeTags as string[]) : null);
        if (ids.length === 0 || (add.length === 0 && remove.length === 0)) break;
        const rowId = nextRowId();
        ops.push({ rowId, kind: "tag", ids, add, remove });
        rows.push({ rowId, kind: "tag", summary: summary || `Retag ${ids.length} element(s)`, destructive: false });
        keptNonCreate++;
        break;
      }
      case "group": {
        const ids = Array.from(new Set((r.targetIds || []).filter((t) => knownIds.has(t))));
        if (ids.length < 2) break;
        const rowId = nextRowId();
        ops.push({ rowId, kind: "group", ids, title: (r.label || "Group").slice(0, 120) });
        rows.push({ rowId, kind: "group", summary: summary || `Group ${ids.length} elements`, destructive: false });
        keptNonCreate++;
        break;
      }
      case "connect": {
        if (!r.fromRef?.trim() || !r.toRef?.trim() || r.fromRef === r.toRef) break;
        const fromExisting = knownIds.has(r.fromRef);
        const toExisting = knownIds.has(r.toRef);
        if (fromExisting && toExisting) {
          const rowId = nextRowId();
          const label = (r.label || "").trim().slice(0, 40);
          ops.push({ rowId, kind: "connect", fromId: r.fromRef, toId: r.toRef, ...(label ? { label } : {}) });
          rows.push({ rowId, kind: "connect", summary: summary || "Connect two elements", destructive: false });
          keptNonCreate++;
        } else if (!fromExisting && !toExisting) {
          // both are refs of created elements — resolved by generatedToCanvas below
          refConnects.push({ from: r.fromRef, to: r.toRef, label: r.label ?? null, props: r.props ?? null });
          absorbedConnects++;
        } else {
          // Mixed: one side is a brand-new element, the other already exists
          // ("add a zone and connect it to Onboarding"). The new element's real
          // id only exists after conversion, so defer to the creates pass.
          mixedConnects.push({
            ref: fromExisting ? r.toRef : r.fromRef,
            existingId: fromExisting ? r.fromRef : r.toRef,
            refIsSource: !fromExisting,
            label: (r.label || "").trim().slice(0, 40) || null,
          });
          absorbedConnects++;
        }
        break;
      }
      case "task": {
        const title = (r.label || "").trim();
        if (!title) break;
        const dueDate = propStr(p.dueDate, 10);
        const dueDateValid = !!dueDate && DUE_DATE_RE.test(dueDate);
        const priority = propOneOf(p.priority, ["low", "medium", "high"] as const);
        const rowId = nextRowId();
        ops.push({
          rowId,
          kind: "task",
          task: {
            title: title.slice(0, 160),
            description: (r.content || "").slice(0, MAX_TEXT),
            suggestedFaces: [],
            isSubtask: false,
            ...(priority || dueDateValid
              ? {
                  metadata: {
                    ...(priority ? { priority } : {}),
                    ...(dueDateValid ? { dueDate: dueDate as string } : {}),
                  },
                }
              : {}),
          },
        });
        rows.push({ rowId, kind: "task", summary: summary || `Add task: ${title.slice(0, 60)}`, destructive: false });
        keptNonCreate++;
        break;
      }
      case "note": {
        const content = (r.content || "").trim();
        if (!content) break;
        const rowId = nextRowId();
        ops.push({ rowId, kind: "note", content: content.slice(0, MAX_TEXT) });
        rows.push({ rowId, kind: "note", summary: summary || "Add note to Inbox", destructive: false });
        keptNonCreate++;
        break;
      }
      case "comment": {
        const content = (r.content || "").trim();
        if (!content) break;
        const anchorId = (r.targetIds || []).find((t) => knownIds.has(t));
        const rowId = nextRowId();
        ops.push({ rowId, kind: "comment", content: content.slice(0, MAX_TEXT), ...(anchorId ? { anchorId } : {}) });
        rows.push({ rowId, kind: "comment", summary: summary || "Leave a review comment", destructive: false });
        keptNonCreate++;
        break;
      }
    }
  }

  // Convert create rows (+ ref<->ref connects) through the proven generator path
  let creates: SanitizedProposal["creates"] = null;
  if (createRows.length > 0) {
    const generated: GeneratedElement[] = createRows.map((r) => ({
      kind: r.kind as Exclude<typeof r.kind, "none">,
      ref: r.ref as string,
      // Schema fields are optional (see the union-count note above), but
      // GeneratedElement models "absent" as null — normalize at the boundary.
      // Type-specific extras ride along in `props`, which generatedToCanvas
      // parses and whitelists per kind.
      parentRef: r.parentRef ?? null,
      label: r.label ?? null,
      content: r.content ?? null,
      tint: propOneOf(parseProps(r.props).tint, TINT_COLORS) ?? null,
      shapeType: propOneOf(parseProps(r.props).shapeType, SHAPE_TYPES) ?? null,
      hypercubeTags: validTags(
        Array.isArray(parseProps(r.props).hypercubeTags)
          ? (parseProps(r.props).hypercubeTags as string[])
          : null,
      ),
      props: r.props ?? null,
      x: clampNum(r.x, -COORD_LIMIT, COORD_LIMIT, 0),
      y: clampNum(r.y, -COORD_LIMIT, COORD_LIMIT, 0),
      width: clampNum(r.width, 20, 4000, 320),
      height: clampNum(r.height, 20, 4000, 120),
    }));
    const converted = generatedToCanvas(generated, refConnects);
    if (converted.elements.length > 0) {
      // Resolve new-element <-> existing-element connectors now that refs have
      // real ids. They ride with the creates row: the edge is meaningless
      // unless those elements are actually created.
      for (const mc of mixedConnects) {
        const newId = converted.idByRef.get(mc.ref);
        if (!newId) continue;
        const [fromId, toId] = mc.refIsSource ? [newId, mc.existingId] : [mc.existingId, newId];
        converted.edges.push(buildConnectorEdge(fromId, toId, mc.label ?? undefined));
      }
      const rowId = nextRowId();
      creates = { rowId, elements: converted.elements, edges: converted.edges };
      rows.push({
        rowId,
        kind: "create",
        summary: `Create ${converted.elements.length} element(s)${converted.edges.length ? ` + ${converted.edges.length} connector(s)` : ""}`,
        destructive: false,
      });
    }
  }

  // A create row counts as "kept" only when the batch it fed actually produced
  // elements — createRows entries lost inside generatedToCanvas (e.g. all
  // malformed) are not individually reconciled; this stays row-level and exact.
  const keptCreateRows = creates !== null ? createRows.length + absorbedConnects : 0;
  const droppedCount = Math.max(0, attemptedRows.length - (keptNonCreate + keptCreateRows));

  return { reply: (raw.reply || "").slice(0, 1200), rows, creates, ops, droppedCount };
}

// Re-export for executor convenience
export { buildConnectorEdge };

// â”€â”€â”€ Client-side routing heuristic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const QUESTION_PREFIX_RE = /^(what|why|how|should|do you|can you explain|explain|tell me|help me think)/i;
// "Could/would/can you ..." reads as a polite imperative when an action verb
// follows — it should not be disqualified the way "What should I..." is.
const POLITE_REQUEST_RE = /^(could|would|can)\s+you\b/i;
const ACTION_RE = /\b(add|create|make|build|place|put|insert|delete|remove|clear|move|arrange|align|organi[sz]e|group|ungroup|tag|untag|label|connect|link|rename|resize|duplicate|split|merge|reorder|clean\s?up|lay\s?out|change|set|write|sort|distribute|swap|tidy)\b/i;

/** True when a message reads as a canvas instruction rather than a question. */
export function isActionableMessage(text: string): boolean {
  const trimmed = (text || "").trim();
  if (!trimmed) return false;
  const isActionVerbPresent = ACTION_RE.test(trimmed);
  if (QUESTION_PREFIX_RE.test(trimmed) && !(POLITE_REQUEST_RE.test(trimmed) && isActionVerbPresent)) return false;
  return isActionVerbPresent;
}

// â”€â”€â”€ Prompt guide appended to the ops-route system prompt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const CANVAS_OPERATIONS_GUIDE = `
You translate a designer's instruction into a small batch of canvas operations.
Rules:
- Emit only operations the instruction asks for. Fewer, precise ops beat many speculative ones. Never exceed ${MAX_OPS}.
- 'targetIds', and 'fromRef'/'toRef' when referring to existing elements, must be ids copied EXACTLY from the provided inventory. Never invent ids.

EVERY field must be present on every row. When a field does not apply to the op, send the empty value: "" for strings, [] for targetIds, 0 for x/y/width/height, "none" for kind, "{}" for props.

FIELD MAPPING (the same few fields mean different things per op):
- op=create: 'kind' + unique 'ref' (c1, t1, n1...), 'x'/'y'/'width'/'height', optional 'parentRef', 'label', 'content', plus 'props'.
- op=update: 'targetIds' + 'label'/'content' when those should change. Cannot move an element into or out of a container — use op=group for that. Everything else that should change goes in 'props': {"x":100,"y":200,"width":300,"height":140,"emoji":"🔥","noteTitle":"...","noteBody":"...","tint":"ocean","shapeType":"circle"}. Include ONLY the keys you want changed — omitted keys are left alone. Leave the top-level x/y/width/height at 0 for updates.
- op=group: 'targetIds' + 'label' (the new container's title). This is the ONLY way to put EXISTING elements inside a container — it creates the container, sizes it around them, and reparents them in one step. Do NOT instead emit op=create for a container plus op=update rows: update cannot change an element's parent, so that leaves the elements sitting loose on top of an empty box.
- op=connect: 'fromRef'/'toRef' + optional 'label' (edge label). Either side may be an existing inventory id OR a ref you create in this same proposal — mixing the two is fine (e.g. connect a zone you just created to an existing card).
- op=task: 'label' is the task title, 'content' the description, props {"priority":"high","dueDate":"2026-09-30"}.
- op=note: 'content' is the note body.
- op=comment: 'content' is the review note, 'targetIds' the single element it is about (omit to pin in open space). Use this ONLY when the user asks you to review, critique or leave notes on their canvas — never volunteer comments on a normal change request, and keep them to the few points that genuinely matter.
- op=tag: 'targetIds' + props {"addTags":[...],"removeTags":[...]}.
- op=delete: 'targetIds' only.

ELEMENT KINDS for op=create (props is a JSON OBJECT STRING):
- 'freeform' — the primary editable card. PREFER THIS for any idea, note, or item the designer will work on. ~300x300. props: {"emoji":"💡","noteTitle":"Names the move","noteBody":"Concrete starter content","cardType":"note"}.
- 'container' — a tinted zone that groups things. 340-480px wide, short 'label'. props: {"tint":"violet"}. Children reference it via parentRef and must sit fully inside with >=24px padding; the top 56px is the header.
- 'text' — a caption or guidance line, not a card. props: {} .
- 'shape' — small accent/waypoint, 40-80px. props: {"shapeType":"circle"} (rectangle, circle, diamond, triangle, hexagon, star).
- 'image' — storyboard frame seed (empty upload slot + caption), ~320x260. props: {"storyboard":true,"description":"caption"}.
- 'line' — a DIVIDER only, spanning (x,y) to (x+width,y). props: {"gradientName":"violet","widthPx":2}. Never use a line to connect elements — use op=connect.
- 'table' — a real editable data grid. USE THIS whenever the user asks for a table, matrix, comparison or grid. props: {"cells":[["Header A","Header B"],["row 1a","row 1b"]],"headerRow":true}. Size roughly 160px per column and 48px per row. Never fake a table out of containers and cards.
- 'link' — a URL bookmark card. props: {"url":"https://...","linkMode":"bookmark"}; 'label' is the title. ~320x120.
- 'board' — a hexagon portal opening into a nested canvas, for anything deep (research, moodboards, personas). 'label' is its title. props: {"icon":"grid","hexColor":"#4B1B6B"}. Needs ~170x230.
- 'experienceBlock' — anchors the layout to live framing data. props: {"componentKey":"intentionCore"} — one of intentionCore, desiredChange, humanContext, contextAndMeaning, realityPlanes, sensoryDomains, presenceTypes, stateMapping, traitMapping. Place one at the origin of a flow when the content maps to a framing section.

FLOW DIAGRAMS AND MIND MAPS:
- Nodes are 'freeform' cards (or small 'shape' waypoints: rectangle, circle, diamond, triangle, hexagon, star). Connect them with op=connect, never with 'line'.
- Style each connector through props: {"gradientName":"ocean","lineStyle":"dashed","thickness":3,"arrowStyle":"end","bend":40}. Rotate gradientName per branch so parallel paths read apart, and give edges a gentle bend rather than leaving every line straight.
- Mind map: one central hub node with branches radiating out. Flow: left-to-right lanes with a diamond shape at each decision point.

HOUSE STYLE (this canvas has a design system):
- Tints rotate violet -> ocean -> emerald -> sunset -> rose -> glacier; adjacent zones never share a tint.
- Never leave a new container empty — seed it with at least one freeform note card the designer can edit.
- Keep new layouts within x 0..2400, y 0..1600, on a 20px grid, and clear of the existing elements in the inventory.
- Hypercube tags must come from this exact list: ${HYPERCUBE_FACE_TAGS.join(", ")}, set via props {"hypercubeTags":[...]} on containers and top-level elements only, never on children inside a container.
- op=delete is destructive: only propose it when the instruction clearly asks for removal, and target exactly what was asked.
- op=task adds a task to the Plan tab; op=note adds a note card to the canvas Inbox.
- Every row needs a concise human-readable 'summary' (it becomes a review checkbox the designer approves).
- 'reply' is your short conversational explanation of what you propose and why.
- The user's current selection is marked in the inventory ("selected": true). Instructions like "these" or "the selected cards" refer to it.
- If the instruction is NOT a change request, return an empty operations array and answer briefly in 'reply'.`;
