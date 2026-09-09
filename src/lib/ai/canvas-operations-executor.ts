// Pure Apply-time translation: SanitizedProposal + selected rows + the LIVE
// canvas state -> one CanvasBatchMutation (+ task/note side effects). Runs at
// the moment the user clicks Apply, so ids are revalidated against reality —
// elements may have changed or vanished since the proposal was generated
// (another collaborator, or the user's own edits, in that window).

import type { CanvasElement, CanvasEdge, ContainerElement, ElementStyle, HypercubeFaceTag } from "@/types/canvas-elements";
import type { SanitizedProposal, CanvasBatchMutation } from "@/types/ai-operations";
import type { ExtractedTask } from "@/lib/ai/ai-response-classifier";
import { buildConnectorEdge } from "./canvas-operations";

export interface ApplyPlan {
  batch: CanvasBatchMutation;
  tasks: ExtractedTask[];
  notes: string[];
  /** rows whose targets no longer exist (reported to the user, never silently applied) */
  skippedRowIds: string[];
}

const GROUP_PADDING = 40;
// Matches the reserved header band the canvas generation guide assumes.
const GROUP_HEADER = 56;

const groupContainerStyle: ElementStyle = {
  borderColor: "rgba(255,255,255,0.15)",
  borderWidth: 1,
  borderStyle: "dashed",
  bgColor: "rgba(255,255,255,0.03)",
};

export function translateForApply(
  proposal: SanitizedProposal,
  selectedRowIds: Set<string>,
  liveElements: CanvasElement[],
  liveEdges: CanvasEdge[],
): ApplyPlan {
  const liveById = new Map(liveElements.map((el) => [el.id, el]));
  const batch: CanvasBatchMutation = {
    addElements: [],
    addEdges: [],
    updates: [],
    removeElementIds: [],
    removeEdgeIds: [],
  };
  const tasks: ExtractedTask[] = [];
  const notes: string[] = [];
  const skippedRowIds: string[] = [];
  // Patches are field bags that never carry `type`. Accumulating them as
  // Partial<CanvasElement> would spread into a cross-product of the element
  // union (type: "image" | "freeform" | ...), which matches no single member —
  // so accumulate loosely and cast once at the boundary below.
  const patchedById = new Map<string, Record<string, unknown>>();

  const queueUpdate = (id: string, updates: Record<string, unknown>) => {
    patchedById.set(id, { ...(patchedById.get(id) || {}), ...updates });
  };

  if (proposal.creates && selectedRowIds.has(proposal.creates.rowId)) {
    batch.addElements.push(...proposal.creates.elements);
    batch.addEdges.push(...proposal.creates.edges);
  }

  for (const op of proposal.ops) {
    if (!selectedRowIds.has(op.rowId)) continue;
    switch (op.kind) {
      case "update": {
        const el = liveById.get(op.id);
        if (!el) { skippedRowIds.push(op.rowId); break; }
        const updates: Record<string, unknown> = {};
        // Only assign fields the target element actually supports, so a patch
        // can't graft `content` onto a container or `label` onto a text card.
        if (op.patch.content !== undefined && (el.type === "text" || el.type === "freeform" || el.type === "shape")) {
          updates.content = op.patch.content;
        }
        if (op.patch.label !== undefined && el.type === "container") updates.label = op.patch.label;
        if (op.patch.x !== undefined) updates.x = op.patch.x;
        if (op.patch.y !== undefined) updates.y = op.patch.y;
        if (op.patch.width !== undefined) updates.width = op.patch.width;
        if (op.patch.height !== undefined) updates.height = op.patch.height;
        if (Object.keys(updates).length === 0) { skippedRowIds.push(op.rowId); break; }
        queueUpdate(op.id, updates);
        break;
      }
      case "delete": {
        const ids = op.ids.filter((id) => liveById.has(id));
        if (ids.length === 0) { skippedRowIds.push(op.rowId); break; }
        const removing = new Set(ids);
        batch.removeElementIds.push(...ids);
        // Orphan-heal: children of a deleted container lose their containerId.
        // A dangling containerId has caused real canvas corruption before.
        for (const el of liveElements) {
          if (el.containerId && removing.has(el.containerId) && !removing.has(el.id)) {
            queueUpdate(el.id, { containerId: undefined });
          }
        }
        // Edges pointing at a removed element would render into nothing.
        for (const e of liveEdges) {
          if (removing.has(e.fromNodeId) || removing.has(e.toNodeId)) {
            batch.removeEdgeIds.push(e.id);
          }
        }
        break;
      }
      case "tag": {
        let touched = false;
        for (const id of op.ids) {
          const el = liveById.get(id);
          if (!el) continue;
          const current = (el.hypercubeTags || []) as HypercubeFaceTag[];
          const next = Array.from(
            new Set([...current.filter((t) => !op.remove.includes(t)), ...op.add]),
          );
          queueUpdate(id, { hypercubeTags: next });
          touched = true;
        }
        if (!touched) skippedRowIds.push(op.rowId);
        break;
      }
      case "group": {
        const members = op.ids
          .map((id) => liveById.get(id))
          .filter((el): el is CanvasElement => !!el);
        if (members.length < 2) { skippedRowIds.push(op.rowId); break; }
        const minX = Math.min(...members.map((el) => el.x));
        const minY = Math.min(...members.map((el) => el.y));
        const maxX = Math.max(...members.map((el) => el.x + el.width));
        const maxY = Math.max(...members.map((el) => el.y + el.height));
        const container: ContainerElement = {
          id: crypto.randomUUID(),
          type: "container",
          x: minX - GROUP_PADDING,
          y: minY - GROUP_PADDING - GROUP_HEADER,
          width: maxX - minX + GROUP_PADDING * 2,
          height: maxY - minY + GROUP_PADDING * 2 + GROUP_HEADER,
          zIndex: 0,
          label: op.title,
          tintColor: "violet",
          collapsed: false,
          locked: false,
          // Inherit the members' board/surface: a container placed on the root
          // board while its children stay on another board would be invisible
          // where the user asked for it, and its containerId links cross-board.
          boardId: members[0].boardId ?? null,
          surface: members[0].surface,
          containerId: undefined,
          style: groupContainerStyle,
        };
        batch.addElements.push(container);
        for (const m of members) {
          queueUpdate(m.id, { containerId: container.id });
        }
        break;
      }
      case "connect": {
        if (!liveById.has(op.fromId) || !liveById.has(op.toId)) {
          skippedRowIds.push(op.rowId);
          break;
        }
        batch.addEdges.push(buildConnectorEdge(op.fromId, op.toId, op.label));
        break;
      }
      case "task":
        tasks.push(op.task);
        break;
      case "note":
        notes.push(op.content);
        break;
    }
  }

  // A delete anywhere in the batch wins over an update queued for the same id.
  const removed = new Set(batch.removeElementIds);
  batch.updates = Array.from(patchedById.entries())
    .filter(([id]) => !removed.has(id))
    .map(([id, updates]) => ({ id, updates: updates as Partial<CanvasElement> }));
  batch.removeElementIds = Array.from(removed);
  batch.removeEdgeIds = Array.from(new Set(batch.removeEdgeIds));

  // One row can produce several ops (a multi-target update), so dedupe before
  // reporting "N change(s) skipped" to the user.
  return { batch, tasks, notes, skippedRowIds: Array.from(new Set(skippedRowIds)) };
}
