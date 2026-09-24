// Double bubble: five columns left to right — left-only qualities, left topic,
// shared qualities, right topic, right-only qualities. Columns own disjoint
// x-ranges; each is a vertical stack centred on one axis.
import type { MapNode, MapRole } from "../types";
import { centeredColumn, columnSize, relationLabel, ZONE_GAP, type LayoutEdge, type LayoutEngine, type PlacedNode } from "./shared";

export const doubleBubbleLayout: LayoutEngine = (g) => {
  const pick = (role: MapRole) => g.nodes.filter((x) => x.role === role);
  const left = pick("leftTopic")[0];
  const right = pick("rightTopic")[0];
  const shared = pick("shared");
  const leftOnly = pick("leftOnly");
  const rightOnly = pick("rightOnly");

  const columns: MapNode[][] = [leftOnly, [left], shared, [right], rightOnly].filter((c) => c.length > 0);
  const placed: PlacedNode[] = [];
  let x = 0;
  for (const col of columns) {
    placed.push(...centeredColumn(col, x));
    x += columnSize(col).w + ZONE_GAP;
  }

  const edge = (from: MapNode, to: MapNode, gradient: "violet" | "ocean"): LayoutEdge =>
    ({ from: from.id, to: to.id, label: relationLabel(g, from.id, to.id), gradient, bend: 0, arrow: "none" });
  const edges: LayoutEdge[] = [
    ...leftOnly.map((q) => edge(left, q, "violet")),
    ...shared.map((q) => edge(left, q, "violet")),
    ...shared.map((q) => edge(right, q, "ocean")),
    ...rightOnly.map((q) => edge(right, q, "ocean")),
  ];
  return { placed, edges, lines: [] };
};
