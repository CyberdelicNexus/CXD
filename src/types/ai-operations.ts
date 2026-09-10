// Shared types for the Canvas Assistant operation pipeline
// (propose → preview → confirm → applyCanvasBatch).

import type { CanvasElement, CanvasEdge, HypercubeFaceTag } from "@/types/canvas-elements";
import type { ExtractedTask } from "@/lib/ai/ai-response-classifier";

// ─── Inventory (client → server): the model's view of the canvas ────

export interface CanvasInventoryItem {
  id: string;
  type: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  containerId?: string;
  tags?: string[];
  selected?: boolean;
}

export interface CanvasInventory {
  totalCount: number;
  truncated: boolean;
  selectedIds: string[];
  elements: CanvasInventoryItem[];
}

// ─── Sanitized proposal (server → client) ──────────────────────────

export interface ProposalRow {
  rowId: string;
  kind: "create" | "update" | "delete" | "tag" | "group" | "connect" | "task" | "note" | "comment";
  summary: string;
  destructive: boolean;
}

/** Fields an update op may change. Applied per element type by the executor —
 *  `content` never lands on a container, `label` never on a text card, etc. */
export interface UpdatePatch {
  content?: string;
  label?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  emoji?: string;
  noteTitle?: string;
  noteBody?: string;
  tintColor?: "violet" | "ocean" | "emerald" | "sunset" | "rose" | "glacier";
  shapeType?: string;
}

export type SemanticOp =
  | { rowId: string; kind: "update"; id: string; patch: UpdatePatch }
  | { rowId: string; kind: "delete"; ids: string[] }
  | { rowId: string; kind: "tag"; ids: string[]; add: HypercubeFaceTag[]; remove: HypercubeFaceTag[] }
  | { rowId: string; kind: "group"; ids: string[]; title: string }
  | { rowId: string; kind: "connect"; fromId: string; toId: string; label?: string }
  | { rowId: string; kind: "task"; task: ExtractedTask }
  | { rowId: string; kind: "note"; content: string }
  /** A review pin. `anchorId` is the element being commented on; without one
   *  the comment lands in open canvas space. */
  | { rowId: string; kind: "comment"; content: string; anchorId?: string };

export interface SanitizedProposal {
  /** 1-3 sentence model explanation, displayed above the rows */
  reply: string;
  rows: ProposalRow[];
  /** All create-type rows collapse into one converted batch (fresh UUIDs, clamped) */
  creates: { rowId: string; elements: CanvasElement[]; edges: CanvasEdge[] } | null;
  ops: SemanticOp[];
  /** Rows the sanitizer discarded — unknown ids, malformed fields; lets the route log model hallucination */
  droppedCount: number;
}

// ─── Batch mutation (executor → store.applyCanvasBatch) ────────────

export interface CanvasBatchMutation {
  addElements: CanvasElement[];
  addEdges: CanvasEdge[];
  updates: { id: string; updates: Partial<CanvasElement> }[];
  removeElementIds: string[];
  removeEdgeIds: string[];
}
