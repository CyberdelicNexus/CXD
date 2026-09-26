// Flow: steps left to right in path order, arrows between consecutive steps.
// Without a loop-back the step centres share one axis. The optional
// loop-back is a curved LINE element, not a connector: the canvas never
// draws edge.bend, so a connector between the last and first step would cut
// straight through every step in between. With a loop the steps are
// bottom-aligned instead, and the line runs bottom-centre to bottom-centre
// (2px below the shared bottom) with its quadratic control point below:
// every point of the curve then lies below every step, so it can never cross
// one, and a quadratic peaks at half its control offset, so the curve sags
// LOOP_DROP px under the row. Its label is dropped (lines carry none).
// Consecutive steps are spaced so each arrow stays horizontal-dominant
// (centre dx beats centre dy by DOMINANCE) and runs in the gap between them.
import { orderFlowSteps } from "../catalog";
import {
  DOMINANCE, footprint, LEVEL_GAP, relationLabel, snapDown, snapUp, tintAt,
  type LayoutEdge, type LayoutEngine, type LayoutLine, type PlacedNode,
} from "./shared";

const LOOP_DROP = 80;

export const flowLayout: LayoutEngine = (g) => {
  const order = orderFlowSteps(g);
  if (!order) throw new Error("flow steps do not form a single path");
  const byId = new Map(g.nodes.map((x) => [x.id, x]));
  const looped = !!order.backEdge;
  const placed: PlacedNode[] = [];
  let x = 0;
  for (const id of order.order) {
    const node = byId.get(id)!;
    const f = footprint(node);
    const y = looped ? -f.h : snapDown(-f.h / 2);
    const prev = placed[placed.length - 1];
    if (prev) {
      const dy = Math.abs(y + f.h / 2 - (prev.y + prev.h / 2));
      x += Math.max(LEVEL_GAP, snapUp(dy + DOMINANCE - prev.w / 2 - f.w / 2));
    }
    placed.push({ node, x, y, w: f.w, h: f.h });
    x += f.w;
  }
  const edges: LayoutEdge[] = order.order.slice(1).map((id, i) => ({
    from: order.order[i], to: id, label: relationLabel(g, order.order[i], id),
    gradient: tintAt(i), bend: 0, arrow: "end",
  }));
  const lines: LayoutLine[] = [];
  if (order.backEdge) {
    const back = order.backEdge;
    const from = placed.find((p) => p.node.id === back.from)!;
    const to = placed.find((p) => p.node.id === back.to)!;
    const start = { x: from.x + from.w / 2, y: 2 };
    const end = { x: to.x + to.w / 2, y: 2 };
    const direction = back.direction ?? "forward";
    lines.push({
      start, end,
      bend: { x: (start.x + end.x) / 2, y: 2 + 2 * LOOP_DROP },
      // The back relation styles its line, as styleEdges styles connectors.
      gradient: from.node.tint || "sunset",
      ...(direction === "none" ? {} : { endCap: "arrow" as const }),
      ...(direction === "both" ? { startCap: "arrow" as const } : {}),
      kind: back.style ?? "solid",
      widthPx: back.weight === "strong" ? 4 : 2,
    });
  }
  return { placed, edges, lines };
};
