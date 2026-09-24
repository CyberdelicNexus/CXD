// Tidy top-down tree. Each subtree owns an x-interval as wide as the wider of
// its node and its children's intervals; siblings get disjoint intervals, so
// nodes in one row can never overlap, and rows are separated by LEVEL_GAP.
import type { MapNode } from "../types";
import {
  footprint, GAP, LEVEL_GAP, relationLabel, snapDown, tintAt,
  type LayoutEdge, type LayoutEngine, type PlacedNode,
} from "./shared";

export const treeLayout: LayoutEngine = (g) => {
  const root = g.nodes.find((x) => x.role === "root")!;
  const kids = (id: string) => g.nodes.filter((x) => x.parent === id);

  const width = new Map<string, number>();
  const measure = (node: MapNode): number => {
    const ks = kids(node.id);
    const span = ks.length ? ks.reduce((s, k) => s + measure(k), 0) + GAP * (ks.length - 1) : 0;
    const w = Math.max(footprint(node).w, span);
    width.set(node.id, w);
    return w;
  };
  measure(root);

  const rowH: number[] = [];
  const collect = (node: MapNode, d: number): void => {
    rowH[d] = Math.max(rowH[d] ?? 0, footprint(node).h);
    kids(node.id).forEach((k) => collect(k, d + 1));
  };
  collect(root, 0);
  const rowY: number[] = [0];
  for (let d = 1; d < rowH.length; d++) rowY[d] = rowY[d - 1] + rowH[d - 1] + LEVEL_GAP;

  const placed: PlacedNode[] = [];
  const edges: LayoutEdge[] = [];
  const place = (node: MapNode, left: number, d: number, branch: number): void => {
    const w = width.get(node.id)!;
    const f = footprint(node);
    placed.push({ node, x: left + snapDown((w - f.w) / 2), y: rowY[d], w: f.w, h: f.h });
    const ks = kids(node.id);
    if (ks.length === 0) return;
    const span = ks.reduce((s, k) => s + width.get(k.id)!, 0) + GAP * (ks.length - 1);
    let cursor = left + snapDown((w - span) / 2);
    ks.forEach((k, i) => {
      const b = d === 0 ? i : branch;
      edges.push({ from: node.id, to: k.id, label: relationLabel(g, node.id, k.id), gradient: tintAt(b), bend: 0, arrow: "none" });
      place(k, cursor, d + 1, b);
      cursor += width.get(k.id)! + GAP;
    });
  };
  place(root, 0, 0, 0);
  return { placed, edges, lines: [] };
};
