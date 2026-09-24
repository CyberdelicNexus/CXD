// Pure Apply-time translation: SanitizedProposal + selected rows + the LIVE
// canvas state -> one CanvasBatchMutation (+ task/note side effects). Runs at
// the moment the user clicks Apply, so ids are revalidated against reality —
// elements may have changed or vanished since the proposal was generated
// (another collaborator, or the user's own edits, in that window).

import type { CanvasElement, CanvasEdge, ContainerElement, ElementStyle, HypercubeFaceTag } from "@/types/canvas-elements";
import type { SanitizedProposal, CanvasBatchMutation } from "@/types/ai-operations";
import type { ExtractedTask } from "@/lib/ai/ai-response-classifier";
import { buildConnectorEdge } from "./canvas-operations";
import { realBounds, overlaps, GRID_PX, type Box } from "@/lib/canvas-layout-rules";

export interface ApplyPlan {
  batch: CanvasBatchMutation;
  tasks: ExtractedTask[];
  notes: string[];
  /** Review pins, already resolved to canvas coordinates. */
  comments: { content: string; position: { x: number; y: number } }[];
  /** rows whose targets no longer exist (reported to the user, never silently applied) */
  skippedRowIds: string[];
}

const GROUP_PADDING = 40;
// Matches the reserved header band the canvas generation guide assumes.
const GROUP_HEADER = 56;

const TINT_FAMILIES = ["violet", "ocean", "emerald", "sunset", "rose", "glacier"] as const;
type Tint = (typeof TINT_FAMILIES)[number];

/**
 * templates.design.md §3: adjacent zones never share a tint. Pick the first
 * family no neighbouring container is already using.
 */
function pickTint(liveElements: CanvasElement[], box: Box): Tint {
  const NEIGHBOUR_GAP = 140;
  const taken = new Set<string>();
  for (const el of liveElements) {
    if (el.type !== "container") continue;
    const b = realBounds(el);
    if (!b) continue;
    const gapX = Math.max(0, Math.max(b.x, box.x) - Math.min(b.x + b.w, box.x + box.w));
    const gapY = Math.max(0, Math.max(b.y, box.y) - Math.min(b.y + b.h, box.y + box.h));
    if (gapX < NEIGHBOUR_GAP && gapY < NEIGHBOUR_GAP) {
      const t = (el as unknown as { tintColor?: string }).tintColor;
      if (t) taken.add(t);
    }
  }
  return TINT_FAMILIES.find((t) => !taken.has(t)) ?? "violet";
}

const groupContainerStyle: ElementStyle = {
  borderColor: "rgba(255,255,255,0.15)",
  borderWidth: 1,
  borderStyle: "dashed",
  bgColor: "rgba(255,255,255,0.03)",
};

/** templates.design.md §8: zones sit 80-140px apart. */
const ZONE_GUTTER = 140;

/**
 * Keep a freshly generated batch off the user's existing work.
 *
 * The model is given the canvas inventory and asked to place new content in
 * clear space, but it does that unreliably — it cannot really see the canvas,
 * and dropping a new zone on top of existing cards is the most destructive-
 * looking mistake it makes. Detect the collision and slide the WHOLE batch
 * (preserving its internal layout) to the right of everything that exists.
 * Mutates the given elements.
 */
function relocateIfColliding(created: CanvasElement[], live: CanvasElement[]): { dx: number; dy: number } {
  if (created.length === 0 || live.length === 0) return { dx: 0, dy: 0 };

  const createdIds = new Set(created.map((e) => e.id));
  // Only elements that land on the shared canvas can collide with live ones;
  // children of a container created in this same batch travel with it.
  const exposed = created.filter((e) => !e.containerId || !createdIds.has(e.containerId));
  const liveRoot = live.filter((e) => !e.containerId);

  const hit = exposed.some((a) => {
    const ab = realBounds(a);
    if (!ab) return false;
    return liveRoot.some((b) => {
      const bb = realBounds(b);
      return bb ? overlaps(ab, bb) : false;
    });
  });
  if (!hit) return { dx: 0, dy: 0 };

  const liveBoxes = liveRoot.map(realBounds).filter((b): b is Box => !!b);
  const createdBoxes = created.map(realBounds).filter((b): b is Box => !!b);
  if (liveBoxes.length === 0 || createdBoxes.length === 0) return { dx: 0, dy: 0 };

  const liveRight = Math.max(...liveBoxes.map((b) => b.x + b.w));
  const batchLeft = Math.min(...createdBoxes.map((b) => b.x));
  const batchTop = Math.min(...createdBoxes.map((b) => b.y));
  const liveTop = Math.min(...liveBoxes.map((b) => b.y));

  const snap = (n: number) => Math.round(n / GRID_PX) * GRID_PX;
  const dx = snap(liveRight + ZONE_GUTTER - batchLeft);
  const dy = snap(liveTop - batchTop);

  for (const el of created) {
    el.x += dx;
    el.y += dy;
    if (el.type === 'line') {
      const line = el as unknown as { start: { x: number; y: number }; end: { x: number; y: number } };
      line.start = { x: line.start.x + dx, y: line.start.y + dy };
      line.end = { x: line.end.x + dx, y: line.end.y + dy };
      const bent = el as unknown as { bend?: { x: number; y: number } };
      if (bent.bend) bent.bend = { x: bent.bend.x + dx, y: bent.bend.y + dy };
    }
  }
  return { dx, dy };
}

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
  const comments: ApplyPlan["comments"] = [];
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
    // Clone before relocating: the proposal is React state and must not be
    // mutated by previewing an apply.
    const created = proposal.creates.elements.map((e) => ({ ...e }) as CanvasElement);
    const shift = relocateIfColliding(created, liveElements);
    const createdIds = new Set(created.map((e) => e.id));
    batch.addElements.push(...created);
    // Bends are world-space: edges wholly inside the moved batch move with it.
    batch.addEdges.push(...proposal.creates.edges.map((e) =>
      e.bend && createdIds.has(e.fromNodeId) && createdIds.has(e.toNodeId)
        ? { ...e, bend: { x: e.bend.x + shift.dx, y: e.bend.y + shift.dy } }
        : e,
    ));
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
        // Presentation edits, each only on the types that actually carry them.
        if (op.patch.emoji !== undefined && el.type === "freeform") updates.emoji = op.patch.emoji;
        if (op.patch.noteTitle !== undefined && el.type === "freeform") updates.noteTitle = op.patch.noteTitle;
        if (op.patch.noteBody !== undefined && el.type === "freeform") updates.noteBody = op.patch.noteBody;
        if (op.patch.tintColor !== undefined && el.type === "container") updates.tintColor = op.patch.tintColor;
        if (op.patch.shapeType !== undefined && el.type === "shape") updates.shapeType = op.patch.shapeType;
        // A note card's visible title lives in noteTitle, not label — let a
        // plain "rename this card" instruction land where the user can see it.
        if (op.patch.label !== undefined && el.type === "freeform" && op.patch.noteTitle === undefined) {
          updates.noteTitle = op.patch.label;
        }
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
        // Gather, then wrap. Wrapping members where they lie would swallow any
        // unrelated element sitting between them, so the members are first
        // packed into a tidy column and the zone is drawn around THAT. Uses
        // rendered footprints: a note card stored at 140px paints 300px tall.
        const boxes = new Map(
          members.map((el) => [el.id, realBounds(el) ?? { x: el.x, y: el.y, w: el.width, h: el.height }] as const),
        );
        const widest = Math.max(...members.map((el) => boxes.get(el.id)!.w));
        const stackHeight =
          members.reduce((sum, el) => sum + boxes.get(el.id)!.h, 0) +
          GROUP_PADDING * (members.length - 1);

        const snapDown = (n: number) => Math.floor(n / GRID_PX) * GRID_PX;
        const snapUp = (n: number) => Math.ceil(n / GRID_PX) * GRID_PX;

        // Anchor the cluster at the top-left member so the zone appears where
        // the user was already working rather than jumping across the canvas.
        const anchorX = Math.min(...members.map((el) => boxes.get(el.id)!.x));
        const anchorY = Math.min(...members.map((el) => boxes.get(el.id)!.y));

        let gx = snapDown(anchorX - GROUP_PADDING);
        let gy = snapDown(anchorY - GROUP_PADDING - GROUP_HEADER);
        const gw = snapUp(widest + GROUP_PADDING * 2);
        const gh = snapUp(stackHeight + GROUP_PADDING * 2 + GROUP_HEADER);

        // Gathering shrinks the footprint, so the zone can land on elements the
        // members used to straddle. Keep it clear of everything that isn't a
        // member, matching how generated batches are placed.
        const memberIds = new Set(members.map((m) => m.id));
        const obstacles = liveElements
          .filter((e) => !memberIds.has(e.id) && !e.containerId)
          .map(realBounds)
          .filter((b): b is Box => !!b);
        if (obstacles.some((o) => overlaps({ x: gx, y: gy, w: gw, h: gh }, o))) {
          gx = snapUp(Math.max(...obstacles.map((o) => o.x + o.w)) + ZONE_GUTTER);
          gy = snapDown(Math.min(...obstacles.map((o) => o.y)));
        }

        // Re-lay the members down the column, inside the zone we just sized.
        let cursor = gy + GROUP_HEADER + GROUP_PADDING;
        for (const m of members) {
          const mb = boxes.get(m.id)!;
          queueUpdate(m.id, { x: snapDown(gx + GROUP_PADDING), y: snapDown(cursor) });
          cursor += mb.h + GROUP_PADDING;
        }
        const container: ContainerElement = {
          id: crypto.randomUUID(),
          type: "container",
          x: gx,
          y: gy,
          width: gw,
          height: gh,
          zIndex: 0,
          label: op.title,
          tintColor: pickTint(liveElements, { x: gx, y: gy, w: gw, h: gh }),
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
      case "comment": {
        // Pin just off the anchor's top-right corner so it points at the
        // element without covering it. Unanchored comments go to the origin.
        const anchor = op.anchorId ? liveById.get(op.anchorId) : undefined;
        const box = anchor ? realBounds(anchor) : null;
        comments.push({
          content: op.content,
          position: box ? { x: box.x + box.w + 12, y: box.y } : { x: 0, y: 0 },
        });
        break;
      }
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
  return { batch, tasks, notes, comments, skippedRowIds: Array.from(new Set(skippedRowIds)) };
}
