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
import { CANVAS_COMPOSITION_SKILL } from "./canvas-skill";
import { connectorsThroughNodes } from "./draft-layout";

const HYPERCUBE_TAG_VALUES = HYPERCUBE_FACE_TAGS as [HypercubeFaceTag, ...HypercubeFaceTag[]];

const MAX_OPS = 40;
const MAX_NODES = 70;
const MAX_LINKS = 90;
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
  // "create" and "connect" stay valid so recorded proposals still parse, but
  // the guide sends new elements and connectors to the compact lists instead.
  op: z.enum(["create", "update", "delete", "tag", "group", "connect", "task", "note", "comment"]),
  summary: z.string().describe('Short human-readable description of this change, e.g. "Delete 2 empty cards"'),
  kind: z.enum([
    "container", "text", "shape", "freeform", "image", "line",
    "table", "link", "board", "experienceBlock", "none",
  ])
    .describe('Always "none": new elements are written in the nodes list, not here.'),
  ref: z.string().describe('Always "".'),
  parentRef: z.string().describe('Always "".'),
  targetIds: z.array(z.string()).describe("Existing element ids from the inventory ONLY. [] when unused."),
  label: z.string().describe('Frame name / note title / group name / edge label / task title, per op. "" when unused.'),
  content: z.string().describe('Node text, floating text, note body, or task description, per op. "" when unused.'),
  x: z.number().describe("Always 0 (move an element through props)."),
  y: z.number().describe("Always 0."),
  width: z.number().describe("Always 0."),
  height: z.number().describe("Always 0."),
  fromRef: z.string().describe('Always "": connectors are written in the links list.'),
  toRef: z.string().describe('Always "".'),
  props: z.string()
    .describe('JSON object string of extras — "{}" when none. e.g. {"shapeType":"pill","tint":"emerald","look":"outline"} or {"role":"heading","align":"center"} or {"addTags":["Sensory Domains"],"priority":"high","x":100}'),
});

// New elements and connectors get their own COMPACT rows. Written as
// op=create / op=connect rows they carried every one of the 15 fields above,
// about 80 output tokens each, nearly all of it empty sentinels: a 16-stage
// flow came to ~5,200 output tokens, 50 seconds on Claude, and on Gemini it
// overran the output limit and failed outright. Output length is what a build's
// latency is made of, so these rows hold only what a node or a connector
// needs (about 45 and 18 tokens). The sanitizer expands them back into the
// same create/connect rows, so everything downstream is unchanged.
export const canvasNodeRowSchema = z.object({
  ref: z.string().describe('Unique short ref for this new element, e.g. "n1", "t2", "f1".'),
  kind: z.enum(["shape", "text", "container", "freeform", "table", "image", "link", "board", "experienceBlock", "line"]),
  shape: z.enum([...SHAPE_TYPES, "none"]).describe('Shape type when kind is "shape"; "none" otherwise.'),
  tint: z.enum([...TINT_COLORS, "none"]).describe('Colour family; "none" to inherit the default.'),
  parent: z.string().describe('ref of the frame this element sits inside; "" for top level.'),
  text: z.string().describe("The element's visible text: node label, floating text, frame name, note title, link or portal title."),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  props: z.string().describe('JSON object string of extras; "{}" when none.'),
});

export const canvasLinkRowSchema = z.object({
  from: z.string().describe("Source: a node ref from this answer, or an existing element id from the inventory."),
  to: z.string().describe("Target: a node ref from this answer, or an existing element id from the inventory."),
  label: z.string().describe('1-3 words, only when the relationship is not obvious; "" otherwise.'),
  props: z.string().describe('JSON object string of styling; "{}" for the default.'),
});

// NOTE: no .min()/.max() on any array in a generateObject schema. Anthropic's
// structured output rejects minItems/maxItems outright ("For 'array' type,
// property 'maxItems' is not supported"), which fails the whole request for
// Claude users. Bounds are enforced in sanitizeCanvasOperations instead.
export const canvasOperationsSchema = z.object({
  reply: z.string().describe("1-3 sentence explanation of the proposed changes, shown to the user"),
  nodes: z.array(canvasNodeRowSchema).describe(`Every NEW element. At most ${MAX_NODES}. [] when none.`),
  links: z.array(canvasLinkRowSchema).describe(`Every NEW connector. At most ${MAX_LINKS}. [] when none.`),
  operations: z.array(canvasOpRowSchema).describe(`Changes to EXISTING elements, tasks, notes, comments. At most ${MAX_OPS}. [] when none.`),
});

export type CanvasOpRow = z.infer<typeof canvasOpRowSchema>;
export type CanvasNodeRow = z.infer<typeof canvasNodeRowSchema>;
export type CanvasLinkRow = z.infer<typeof canvasLinkRowSchema>;
type CanvasOperationsFull = z.infer<typeof canvasOperationsSchema>;
/** `nodes` and `links` are optional on input so proposals recorded before the
 *  compact rows existed (and hand-written fixtures) still sanitize. */
export type CanvasOperationsRaw = Pick<CanvasOperationsFull, "reply" | "operations"> & Partial<Pick<CanvasOperationsFull, "nodes" | "links">>;

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
  const mixedConnects: { ref: string; existingId: string; refIsSource: boolean; label: string | null; props: string | null }[] = [];
  // Connect rows that produce no row of their own because their edge rides
  // along with the creates batch — kept, not dropped.
  let absorbedConnects = 0;
  let rowSeq = 0;
  const nextRowId = () => `row-${++rowSeq}`;

  // Telemetry: attempted vs. kept at raw-row granularity (see droppedCount below).
  // Compact node and link rows expand into the create/connect rows the rest of
  // this function already understands.
  const blankRow = { summary: "", targetIds: [], label: "", content: "", x: 0, y: 0, width: 0, height: 0, fromRef: "", toRef: "", ref: "", parentRef: "", props: "{}" };
  const nodeRows = (raw.nodes || []).slice(0, MAX_NODES);
  const tintByRef = new Map<string, string>();
  const expandedNodes: CanvasOpRow[] = nodeRows.map((n) => {
    const extras = parseProps(n.props);
    if (n.shape && n.shape !== "none" && extras.shapeType === undefined) extras.shapeType = n.shape;
    if (n.tint && n.tint !== "none" && extras.tint === undefined) extras.tint = n.tint;
    if (typeof extras.tint === "string") tintByRef.set(n.ref, extras.tint);
    const text = n.text || "";
    return {
      ...blankRow,
      op: "create" as const,
      kind: n.kind,
      ref: n.ref,
      parentRef: n.parent || "",
      label: text,
      // A note's text is its title; its body, if any, arrives in props.noteBody.
      content: n.kind === "freeform" ? "" : text,
      x: n.x, y: n.y, width: n.w, height: n.h,
      props: JSON.stringify(extras),
    };
  });
  const expandedLinks: CanvasOpRow[] = (raw.links || []).slice(0, MAX_LINKS).map((l) => {
    const extras = parseProps(l.props);
    // A connector belongs to the chain it leaves: it takes its source's family.
    if (extras.gradientName === undefined && tintByRef.has(l.from)) extras.gradientName = tintByRef.get(l.from);
    return { ...blankRow, op: "connect" as const, kind: "none" as const, fromRef: l.from, toRef: l.to, label: l.label || "", props: JSON.stringify(extras) };
  });
  const attemptedRows = [...expandedNodes, ...expandedLinks, ...(raw.operations || []).slice(0, MAX_OPS)];
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
        if (typeof p.titled === "boolean") patch.hideLabel = !p.titled;
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
            props: r.props ?? null,
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
        converted.edges.push(buildConnectorEdge(fromId, toId, mc.label ?? undefined, mc.props));
      }
      /* The model is told not to draw connectors across the diagram; when it
         does anyway, a line scored through every node is worse than none. */
      const unroutable = connectorsThroughNodes(converted.elements, converted.edges);
      if (unroutable.size > 0) converted.edges = converted.edges.filter((e) => !unroutable.has(e.id));
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
- Do what the instruction asks and nothing it does not: no speculative edits to existing elements. A diagram takes one 'nodes' row per element and one 'links' row per connector (at most ${MAX_NODES} and ${MAX_LINKS}); 'operations' holds at most ${MAX_OPS} rows.
- 'targetIds', and 'fromRef'/'toRef' when referring to existing elements, must be ids copied EXACTLY from the provided inventory. Never invent ids.

YOUR ANSWER HAS THREE LISTS, each [] when unused:
- 'nodes': every NEW element. 'ref' (unique, like n1, t1, f1), 'kind', 'shape', 'tint', 'parent', 'text' (what it says), 'x', 'y', 'w', 'h', 'props'.
- 'links': every NEW connector. 'from' and 'to' are node refs from this answer or existing inventory ids (mixing the two is fine), plus 'label' and 'props'.
- 'operations': changes to EXISTING elements, and tasks, notes and comments.
EVERY field must be present on every row. When a field does not apply, send the empty value: "" for strings, [] for targetIds, 0 for numbers, "none" for kind/shape/tint, "{}" for props.

FIELD MAPPING (the same few fields mean different things per op):
- op=update, delete, tag, group, task, note, comment are the only ops you write in 'operations'. New elements and connectors NEVER go there: they go in 'nodes' and 'links' (below), which are far shorter to write.
- op=update: 'targetIds' + 'label'/'content' when those should change. Cannot move an element into or out of a container — use op=group for that. Everything else that should change goes in 'props': {"x":100,"y":200,"width":300,"height":140,"emoji":"🔥","noteTitle":"...","noteBody":"...","tint":"ocean","shapeType":"pill","titled":false}. 'tint' recolours a frame, a node's ring or a note's fill; 'titled' shows or hides a container's title bar. Include ONLY the keys you want changed — omitted keys are left alone. Leave the top-level x/y/width/height at 0 for updates.
- op=group: 'targetIds' + 'label' (the new container's title). This is the ONLY way to put EXISTING elements inside a container — it creates the container, sizes it around them, and reparents them in one step. Do NOT instead emit op=create for a container plus op=update rows: update cannot change an element's parent, so that leaves the elements sitting loose on top of an empty box.
- For every operations row leave 'kind' as "none", 'ref', 'parentRef', 'fromRef', 'toRef' as "" and x/y/width/height as 0.
- op=task: 'label' is the task title, 'content' the description, props {"priority":"high","dueDate":"2026-09-30"}.
- op=note: 'content' is the note body.
- op=comment: 'content' is the review note, 'targetIds' the single element it is about (omit to pin in open space). Use this ONLY when the user asks you to review, critique or leave notes on their canvas — never volunteer comments on a normal change request, and keep them to the few points that genuinely matter.
- op=tag: 'targetIds' + props {"addTags":[...],"removeTags":[...]}.
- op=delete: 'targetIds' only.

WHAT TO BUILD AND HOW IT LOOKS (applies to everything in 'nodes' and 'links'):
${CANVAS_COMPOSITION_SKILL}

HOW TO EXPRESS IT IN THIS SCHEMA
- «tint» is the node's 'tint' field and the shape type its 'shape' field (send "none" when not applicable). Everything else type-specific goes in the node's 'props': {"look":"filled"} or {"role":"heading","align":"center"} or {"titled":false}. Send "{}" when there is nothing to add; the outline look is the default and needs no props.
- A connector is one 'links' row. It takes the colour family of the node it starts from, as a solid arrow, so send props "{}" unless it must differ: {"lineStyle":"dashed"}, {"arrowStyle":"none"}, {"gradientName":"rose"}.
- A frame's children name it in 'parent'.

GEOMETRY (you place every element; px on a 20px grid, measured from an origin you choose in clear space: right of or below everything in the inventory, at least 140px away from it)
- Sizes are real. A node occupies exactly its width x height. A note card always paints at least 300px tall. Text height follows its content at about 1.3 x fontSize per line.
- Gaps: at least 120px between connected nodes along the direction of flow (the connector needs room), 60px between stacked nodes, 140px between frames. Nothing may overlap.
- LOOP of four: pills 260x100 at (0,0) (400,0) (400,240) (0,240), connected 1->2->3->4->1. The loop's name is a heading text at (130,130) width 400 with align center, its caption at (130,166) width 400 with align center.
- FLOW: pills 260x100 at x = 0, 380, 760 ... on one y, at most 6 per row. For a snake, row 2 is 300px lower (more if row 1 has branches below it) and runs right to left from the same x as the last node of row 1; row 3 runs left to right again. A decision diamond 160x160 sits 30px higher than the pills so the centres line up; its outcomes go to the next column, 160px above and below.
- SPINE: stage rectangles 160x80 at (0,0) (0,180) (0,360) ...; detail rectangles 320x120 at (280,-20) (280,160) (280,340) ...; connect each stage to the next stage and to its own detail.
- MIND MAP: hub 240x110 in the centre; branches 220x90 placed 420px to the left/right and 240px above/below; sub-branches a further 320px out.
- FRAME: children sit fully inside with 32px padding. Put the heading text first at (frame.x+32, frame.y+28); other content starts at frame.y+84. Size the frame to its content plus padding, and never leave one empty.
- QUADRANTS: four frames 520x360 at (0,0) (560,0) (0,400) (560,400).
- TITLE BLOCK: title text at the top-left of the layout, its caption 44px below, and the structure starting 120px below the title.

HOUSE RULES
- Hypercube tags must come from this exact list: ${HYPERCUBE_FACE_TAGS.join(", ")}, set via props {"hypercubeTags":[...]} on frames and top-level elements only, never on children inside a frame.
- Each inventory item has a 'title' (what it visibly says) and sometimes 'text' (the rest of its content); existing connectors are listed separately. When asked to redraw, rearrange, improve or restyle EXISTING elements, the result must carry their exact titles, their content and their relationships. Never replace them with invented or generic content, and never guess what an element says: if the inventory does not tell you, say so in 'reply' and change nothing.
- op=delete is destructive: only propose it when the instruction clearly asks for removal, and target exactly what was asked.
- op=task adds a task to the Plan tab; op=note adds a note card to the canvas Inbox.
- Every row needs a concise human-readable 'summary' (it becomes a review checkbox the designer approves).
- 'reply' is your short conversational explanation of what you propose and why.
- The user's current selection is marked in the inventory ("selected": true). Instructions like "these" or "the selected cards" refer to it.
- If the instruction is NOT a change request, return an empty operations array and answer briefly in 'reply'.`;
