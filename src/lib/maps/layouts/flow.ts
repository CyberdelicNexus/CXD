// Flow: steps left to right in path order, centres on one axis, arrows between
// consecutive steps. The optional loop-back is a curved LINE element, not a
// connector: the canvas never draws edge.bend, so a connector between the last
// and first step would cut straight through every step in between. The line
// runs bottom-centre to bottom-centre; a quadratic peaks at half its control
// offset, so a control point 2*LOOP_DROP below the lowest bottom sags the curve
// LOOP_DROP px under the row (deeper when needed to clear a taller step next
// to either end). Its label is dropped (lines carry none).
import { orderFlowSteps } from "../catalog";
import { footprint, LEVEL_GAP, pathConflicts, relationLabel, snapDown, tintAt, type LayoutEdge, type LayoutEngine, type LayoutLine, type PlacedNode } from "./shared";

const LOOP_DROP = 80;
const LOOP_DROP_MAX = 4000;

export const flowLayout: LayoutEngine = (g) => {
  const order = orderFlowSteps(g);
  if (!order) throw new Error("flow steps do not form a single path");
  const byId = new Map(g.nodes.map((x) => [x.id, x]));
  const placed: PlacedNode[] = [];
  let x = 0;
  for (const id of order.order) {
    const node = byId.get(id)!;
    const f = footprint(node);
    placed.push({ node, x, y: snapDown(-f.h / 2), w: f.w, h: f.h });
    x += f.w + LEVEL_GAP;
  }
  const edges: LayoutEdge[] = order.order.slice(1).map((id, i) => ({
    from: order.order[i], to: id, label: relationLabel(g, order.order[i], id),
    gradient: tintAt(i), bend: 0, arrow: "end",
  }));
  const lines: LayoutLine[] = [];
  if (order.backEdge) {
    const from = placed.find((p) => p.node.id === order.backEdge!.from)!;
    const to = placed.find((p) => p.node.id === order.backEdge!.to)!;
    const start = { x: from.x + from.w / 2, y: from.y + from.h + 2 };
    const end = { x: to.x + to.w / 2, y: to.y + to.h + 2 };
    const lowest = Math.max(...placed.map((p) => p.y + p.h));
    const loop = (drop: number): LayoutLine => ({
      start, end,
      bend: { x: (start.x + end.x) / 2, y: 2 * (lowest + drop) - (start.y + end.y) / 2 },
      gradient: "sunset", endCap: "arrow",
    });
    // A shorter step at either end leaves a taller neighbour hanging below its
    // bottom; sag deeper until the curve clears every step it passes under.
    let drop = LOOP_DROP;
    while (drop < LOOP_DROP_MAX && pathConflicts({ placed, edges: [], lines: [loop(drop)] }).length > 0) drop += 20;
    lines.push(loop(drop));
  }
  return { placed, edges, lines };
};
