// Canvas Assistant operation pipeline: zod schema for generateObject, the
// server-side sanitizer that converts raw model rows into a SanitizedProposal
// (the client never applies raw model output), the prompt guide, and the
// client-side routing heuristic.

import { z } from "zod";
import type { HypercubeFaceTag } from "@/types/canvas-elements";
import { HYPERCUBE_FACE_TAGS } from "@/types/canvas-elements";
import type { CanvasInventory, SanitizedProposal, SemanticOp, ProposalRow } from "@/types/ai-operations";
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

// Flat row + op enum + nullable fields: the schema style already proven with
// this provider set (see generatedElementSchema) — avoid discriminated unions.
export const canvasOpRowSchema = z.object({
  op: z.enum(["create", "update", "delete", "tag", "group", "connect", "task", "note"]),
  summary: z.string().describe('Short human-readable description of this change, e.g. "Delete 2 empty cards"'),
  // create fields (op=create only, null otherwise)
  kind: z.enum(["container", "text", "shape"]).nullable(),
  ref: z.string().nullable().describe('Unique short ref for created elements, e.g. "c1", "t2"'),
  parentRef: z.string().nullable(),
  label: z.string().nullable(),
  content: z.string().nullable(),
  tint: z.enum(TINT_COLORS).nullable(),
  shapeType: z.enum(SHAPE_TYPES).nullable(),
  hypercubeTags: z.array(z.enum(HYPERCUBE_TAG_VALUES)).nullable(),
  x: z.number().nullable(),
  y: z.number().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  // targeting fields (update/delete/tag/group)
  targetIds: z.array(z.string()).nullable().describe("Existing element ids from the inventory ONLY"),
  newContent: z.string().nullable(),
  newLabel: z.string().nullable(),
  newX: z.number().nullable(),
  newY: z.number().nullable(),
  newWidth: z.number().nullable(),
  newHeight: z.number().nullable(),
  addTags: z.array(z.enum(HYPERCUBE_TAG_VALUES)).nullable(),
  removeTags: z.array(z.enum(HYPERCUBE_TAG_VALUES)).nullable(),
  groupTitle: z.string().nullable(),
  // connect fields — an existing id, or the ref of an element created in THIS proposal
  fromRef: z.string().nullable(),
  toRef: z.string().nullable(),
  edgeLabel: z.string().nullable(),
  // task/note fields
  taskTitle: z.string().nullable(),
  taskDescription: z.string().nullable(),
  taskPriority: z.enum(["low", "medium", "high"]).nullable(),
  taskDueDate: z.string().nullable().describe("YYYY-MM-DD"),
});

export const canvasOperationsSchema = z.object({
  reply: z.string().describe("1-3 sentence explanation of the proposed changes, shown to the user"),
  operations: z.array(canvasOpRowSchema).max(MAX_OPS),
});

export type CanvasOpRow = z.infer<typeof canvasOpRowSchema>;
export type CanvasOperationsRaw = z.infer<typeof canvasOperationsSchema>;

const clampNum = (v: number | null, min: number, max: number, fallback: number) =>
  v == null || !Number.isFinite(v) ? fallback : Math.min(Math.max(v, min), max);

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
  let rowSeq = 0;
  const nextRowId = () => `row-${++rowSeq}`;

  for (const r of (raw.operations || []).slice(0, MAX_OPS)) {
    const summary = (r.summary || "").trim().slice(0, MAX_SUMMARY);
    switch (r.op) {
      case "create": {
        if (!r.kind || !r.ref) break;
        createRows.push(r);
        break;
      }
      case "update": {
        const id = (r.targetIds || []).find((t) => knownIds.has(t));
        if (!id) break;
        const patch: { content?: string; label?: string; x?: number; y?: number; width?: number; height?: number } = {};
        if (typeof r.newContent === "string" && r.newContent.trim()) patch.content = r.newContent.slice(0, MAX_TEXT);
        if (typeof r.newLabel === "string" && r.newLabel.trim()) patch.label = r.newLabel.slice(0, 120);
        if (r.newX != null) patch.x = clampNum(r.newX, -COORD_LIMIT, COORD_LIMIT, 0);
        if (r.newY != null) patch.y = clampNum(r.newY, -COORD_LIMIT, COORD_LIMIT, 0);
        if (r.newWidth != null) patch.width = clampNum(r.newWidth, 20, 4000, 300);
        if (r.newHeight != null) patch.height = clampNum(r.newHeight, 20, 4000, 100);
        if (Object.keys(patch).length === 0) break;
        const rowId = nextRowId();
        ops.push({ rowId, kind: "update", id, patch });
        rows.push({ rowId, kind: "update", summary: summary || `Update element`, destructive: false });
        break;
      }
      case "delete": {
        const ids = (r.targetIds || []).filter((t) => knownIds.has(t));
        if (ids.length === 0) break;
        const rowId = nextRowId();
        ops.push({ rowId, kind: "delete", ids });
        rows.push({ rowId, kind: "delete", summary: summary || `Delete ${ids.length} element(s)`, destructive: true });
        break;
      }
      case "tag": {
        const ids = (r.targetIds || []).filter((t) => knownIds.has(t));
        const add = validTags(r.addTags);
        const remove = validTags(r.removeTags);
        if (ids.length === 0 || (add.length === 0 && remove.length === 0)) break;
        const rowId = nextRowId();
        ops.push({ rowId, kind: "tag", ids, add, remove });
        rows.push({ rowId, kind: "tag", summary: summary || `Retag ${ids.length} element(s)`, destructive: false });
        break;
      }
      case "group": {
        const ids = (r.targetIds || []).filter((t) => knownIds.has(t));
        if (ids.length < 2) break;
        const rowId = nextRowId();
        ops.push({ rowId, kind: "group", ids, title: (r.groupTitle || "Group").slice(0, 120) });
        rows.push({ rowId, kind: "group", summary: summary || `Group ${ids.length} elements`, destructive: false });
        break;
      }
      case "connect": {
        if (!r.fromRef || !r.toRef || r.fromRef === r.toRef) break;
        const fromExisting = knownIds.has(r.fromRef);
        const toExisting = knownIds.has(r.toRef);
        if (fromExisting && toExisting) {
          const rowId = nextRowId();
          ops.push({ rowId, kind: "connect", fromId: r.fromRef, toId: r.toRef, ...(r.edgeLabel ? { label: r.edgeLabel } : {}) });
          rows.push({ rowId, kind: "connect", summary: summary || "Connect two elements", destructive: false });
        } else if (!fromExisting && !toExisting) {
          // both are refs of created elements — resolved by generatedToCanvas below
          refConnects.push({ from: r.fromRef, to: r.toRef, label: r.edgeLabel ?? null });
        }
        // mixed ref<->id connects are unsupported in v1 — dropped
        break;
      }
      case "task": {
        const title = (r.taskTitle || "").trim();
        if (!title) break;
        const rowId = nextRowId();
        ops.push({
          rowId,
          kind: "task",
          task: {
            title: title.slice(0, 160),
            description: (r.taskDescription || "").slice(0, MAX_TEXT),
            suggestedFaces: [],
            isSubtask: false,
            ...(r.taskPriority || r.taskDueDate
              ? { metadata: { ...(r.taskPriority ? { priority: r.taskPriority } : {}), ...(r.taskDueDate ? { dueDate: r.taskDueDate } : {}) } }
              : {}),
          },
        });
        rows.push({ rowId, kind: "task", summary: summary || `Add task: ${title.slice(0, 60)}`, destructive: false });
        break;
      }
      case "note": {
        const content = (r.content || "").trim();
        if (!content) break;
        const rowId = nextRowId();
        ops.push({ rowId, kind: "note", content: content.slice(0, MAX_TEXT) });
        rows.push({ rowId, kind: "note", summary: summary || "Add note to Inbox", destructive: false });
        break;
      }
    }
  }

  // Convert create rows (+ ref<->ref connects) through the proven generator path
  let creates: SanitizedProposal["creates"] = null;
  if (createRows.length > 0) {
    const generated: GeneratedElement[] = createRows.map((r) => ({
      kind: r.kind as "container" | "text" | "shape",
      ref: r.ref as string,
      parentRef: r.parentRef,
      label: r.label,
      content: r.content,
      tint: r.tint,
      shapeType: r.shapeType,
      hypercubeTags: r.hypercubeTags,
      x: clampNum(r.x, -COORD_LIMIT, COORD_LIMIT, 0),
      y: clampNum(r.y, -COORD_LIMIT, COORD_LIMIT, 0),
      width: clampNum(r.width, 20, 4000, 320),
      height: clampNum(r.height, 20, 4000, 120),
    }));
    const converted = generatedToCanvas(generated, refConnects);
    if (converted.elements.length > 0) {
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

  return { reply: (raw.reply || "").slice(0, 1200), rows, creates, ops };
}

// Re-export for executor convenience
export { buildConnectorEdge };

// ─── Client-side routing heuristic ─────────────────────────────────

const QUESTION_PREFIX_RE = /^(what|why|how|should|could|would|do you|can you explain|explain|tell me|help me think)/i;
const ACTION_RE = /\b(add|create|make|build|place|put|insert|delete|remove|clear|move|arrange|align|organi[sz]e|group|ungroup|tag|untag|label|connect|link|rename|resize|duplicate|split|merge|reorder|clean\s?up|lay\s?out)\b/i;

/** True when a message reads as a canvas instruction rather than a question. */
export function isActionableMessage(text: string): boolean {
  const trimmed = (text || "").trim();
  if (!trimmed) return false;
  if (QUESTION_PREFIX_RE.test(trimmed)) return false;
  return ACTION_RE.test(trimmed);
}

// ─── Prompt guide appended to the ops-route system prompt ──────────

export const CANVAS_OPERATIONS_GUIDE = `
You translate a designer's instruction into a small batch of canvas operations.
Rules:
- Emit only operations the instruction asks for. Fewer, precise ops beat many speculative ones. Never exceed ${MAX_OPS}.
- 'targetIds', and 'fromRef'/'toRef' when referring to existing elements, must be ids copied EXACTLY from the provided inventory. Never invent ids.
- To create elements use op=create rows with unique refs (c1, t1, s1...). Containers: 340-480px wide with a short label; child text sits inside via parentRef with absolute coords. Keep new layouts within x 0..2400, y 0..1600 and clear of existing elements listed in the inventory.
- To connect two NEW elements, use their refs in fromRef/toRef. To connect two EXISTING elements, use their inventory ids. Never mix a ref with an id in one connect row.
- Hypercube tags must come from this exact list: ${HYPERCUBE_FACE_TAGS.join(", ")}.
- op=delete is destructive: only propose it when the instruction clearly asks for removal, and target exactly what was asked.
- op=task adds a task to the Plan tab; op=note (with 'content') adds a note card to the canvas Inbox.
- Every row needs a concise human-readable 'summary' (it becomes a review checkbox the designer approves).
- 'reply' is your short conversational explanation of what you propose and why.
- The user's current selection is marked in the inventory ("selected": true). Instructions like "these" or "the selected cards" refer to it.
- If the instruction is NOT a change request, return an empty operations array and answer briefly in 'reply'.`;
