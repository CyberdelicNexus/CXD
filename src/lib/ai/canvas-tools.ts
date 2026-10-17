// Canvas Assistant actions that need no model: instant, free, and
// deterministic. Each returns a CanvasBatchMutation for store.applyCanvasBatch
// (one undo step), or null when there is nothing to do. Pure functions.

import type { CanvasEdge, CanvasElement } from "@/types/canvas-elements";
import type { CanvasBatchMutation } from "@/types/ai-operations";
import { GRID_PX, realBounds } from "@/lib/canvas-layout-rules";
import { layoutDraftElements } from "./draft-layout";
import { buildConnectorEdge } from "./element-generation";

const emptyBatch = (): CanvasBatchMutation => ({
  addElements: [], addEdges: [], updates: [], removeElementIds: [], removeEdgeIds: [],
});

const snap = (n: number) => Math.round(n / GRID_PX) * GRID_PX;

/** The selection plus everything inside any selected container; no lines or connectors. */
function scopeOf(elements: CanvasElement[], selectedIds: string[]): CanvasElement[] {
  const selected = new Set(selectedIds);
  return elements.filter(
    (el) =>
      el.type !== "line" && el.type !== "connector" && !el.locked &&
      (selected.has(el.id) || (!!el.containerId && selected.has(el.containerId))),
  );
}

/**
 * Re-lay out the selection with the same engine that arranges drafted
 * diagrams (loop / mind map / snaking flow by the shape of its connectors,
 * a tidy grid when nothing is connected), keeping its top-left corner where
 * it was.
 */
export function tidyLayout(
  elements: CanvasElement[],
  edges: CanvasEdge[],
  selectedIds: string[],
): CanvasBatchMutation | null {
  const scope = scopeOf(elements, selectedIds);
  if (scope.length < 2) return null;
  const ids = new Set(scope.map((el) => el.id));
  // A child whose frame is not part of the tidy is laid out as a loose element.
  const detached = scope.map((el) =>
    el.containerId && !ids.has(el.containerId) ? ({ ...el, containerId: undefined } as CanvasElement) : el,
  );
  const inner = edges.filter((e) => ids.has(e.fromNodeId) && ids.has(e.toNodeId));

  const laidOut = layoutDraftElements(detached, inner);
  if (laidOut.length === 0) return null;

  const before = scope.map((el) => realBounds(el) ?? { x: el.x, y: el.y, w: el.width, h: el.height });
  const originX = Math.min(...before.map((b) => b.x));
  const originY = Math.min(...before.map((b) => b.y));
  const minX = Math.min(...laidOut.map((el) => el.x));
  const minY = Math.min(...laidOut.map((el) => el.y));

  const byId = new Map(scope.map((el) => [el.id, el]));
  const batch = emptyBatch();
  for (const next of laidOut) {
    const prev = byId.get(next.id);
    if (!prev) continue;
    const x = snap(next.x - minX + originX);
    const y = snap(next.y - minY + originY);
    const patch: Partial<CanvasElement> = {};
    if (x !== prev.x) patch.x = x;
    if (y !== prev.y) patch.y = y;
    if (next.width !== prev.width) patch.width = next.width;
    if (next.height !== prev.height) patch.height = next.height;
    if (Object.keys(patch).length > 0) batch.updates.push({ id: prev.id, updates: patch });
  }
  return batch.updates.length > 0 ? batch : null;
}

/**
 * Chain the selected elements with connectors in reading order: left to right
 * when the selection is wider than tall, top to bottom otherwise. Pairs that
 * are already connected (either direction) are left alone.
 */
export function connectInOrder(
  elements: CanvasElement[],
  edges: CanvasEdge[],
  selectedIds: string[],
): CanvasBatchMutation | null {
  const selected = new Set(selectedIds);
  const nodes = elements.filter(
    (el) => selected.has(el.id) && el.type !== "line" && el.type !== "connector" && el.type !== "container",
  );
  if (nodes.length < 2) return null;

  const centre = (el: CanvasElement) => {
    const b = realBounds(el) ?? { x: el.x, y: el.y, w: el.width, h: el.height };
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  };
  const xs = nodes.map((el) => centre(el).x);
  const ys = nodes.map((el) => centre(el).y);
  const horizontal = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys);
  const ordered = nodes.slice().sort((a, b) => {
    const p = centre(a);
    const q = centre(b);
    return horizontal ? p.x - q.x || p.y - q.y : p.y - q.y || p.x - q.x;
  });

  const linked = new Set(edges.flatMap((e) => [`${e.fromNodeId}>${e.toNodeId}`, `${e.toNodeId}>${e.fromNodeId}`]));
  const batch = emptyBatch();
  for (let i = 1; i < ordered.length; i++) {
    const from = ordered[i - 1].id;
    const to = ordered[i].id;
    if (linked.has(`${from}>${to}`)) continue;
    batch.addEdges.push(buildConnectorEdge(from, to));
  }
  return batch.addEdges.length > 0 ? batch : null;
}
