// Tidy top-down tree. Each subtree owns an x-interval as wide as the wider of
// its node and its children's intervals; siblings get disjoint intervals, so
// nodes in one row can never overlap. A parent sits over the midpoint of its
// first and last child (Reingold–Tilford), clamped inside its interval.
//
// Connectors are drawn from auto anchors, so every parent -> child pair is
// kept vertical-dominant (centre dy beats centre dx by DOMINANCE): the row gap
// below each level grows until that holds for the widest-spread child. Each
// connector then runs from the parent's bottom to the child's top inside the
// parent's own interval, through the empty band between the two rows; rows
// are top-aligned, so no sibling or cousin can sit in that band. A deep,
// narrow tree is laid out left-to-right instead (the same construction,
// mirrored across the diagonal), and only children hang from their parent's
// centre line like an outline, when that keeps the map squarer.
import type { MapGraph, MapNode } from "../types";
import {
  DOMINANCE, footprint, squarest, transposed, GAP, LEVEL_GAP, relationLabel, snap, snapDown, snapUp, tintAt,
  type FootprintFn, type LayoutEdge, type LayoutEngine, type LayoutResult, type PlacedNode,
} from "./shared";

/**
 * `indent`: an only child hangs from its parent's centre line instead of
 * sitting under it, so single-child chains step sideways like an outline
 * rather than stacking into a thin column.
 */
function layoutTree(g: MapGraph, fp: FootprintFn, indent: boolean): LayoutResult {
  const root = g.nodes.find((x) => x.role === "root")!;
  const kids = (id: string) => g.nodes.filter((x) => x.parent === id);
  const hangs = (node: MapNode, ks: MapNode[]) => (indent && ks.length === 1 ? snapUp(fp(node).w / 2) : 0);

  const width = new Map<string, number>();
  const measure = (node: MapNode): number => {
    const ks = kids(node.id);
    const span = ks.length ? ks.reduce((s, k) => s + measure(k), 0) + GAP * (ks.length - 1) : 0;
    const w = Math.max(fp(node).w, hangs(node, ks) + span);
    width.set(node.id, w);
    return w;
  };
  measure(root);

  // Horizontal placement: returns the node's centre x.
  const left = new Map<string, number>();
  const depth = new Map<string, number>();
  const placeX = (node: MapNode, start: number, d: number): number => {
    const w = width.get(node.id)!;
    const f = fp(node);
    depth.set(node.id, d);
    const ks = kids(node.id);
    let cx = start + w / 2;
    const hang = hangs(node, ks);
    if (hang) {
      placeX(ks[0], start + hang, d + 1);
      cx = start + f.w / 2;
    } else if (ks.length) {
      const span = ks.reduce((s, k) => s + width.get(k.id)!, 0) + GAP * (ks.length - 1);
      let cursor = start + snapDown((w - span) / 2);
      const centres = ks.map((k) => {
        const c = placeX(k, cursor, d + 1);
        cursor += width.get(k.id)! + GAP;
        return c;
      });
      cx = (centres[0] + centres[centres.length - 1]) / 2;
    }
    const x = Math.min(Math.max(snap(cx - f.w / 2), start), start + w - f.w);
    left.set(node.id, x);
    return x + f.w / 2;
  };
  placeX(root, 0, 0);

  const rowH: number[] = [];
  for (const node of g.nodes) {
    const d = depth.get(node.id);
    if (d !== undefined) rowH[d] = Math.max(rowH[d] ?? 0, fp(node).h);
  }
  // Gap below each row: at least LEVEL_GAP, and enough that every child is
  // vertical-dominant from its parent. Rows are top-aligned, so a parent's
  // centre sits f.h/2 below its row top and a child's likewise.
  const gapBelow = rowH.map(() => LEVEL_GAP);
  for (const node of g.nodes) {
    const d = depth.get(node.id);
    if (d === undefined || !node.parent) continue;
    const parent = g.nodes.find((x) => x.id === node.parent)!;
    const pf = fp(parent);
    const cf = fp(node);
    const dx = Math.abs(left.get(node.id)! + cf.w / 2 - (left.get(parent.id)! + pf.w / 2));
    const need = dx + DOMINANCE - (rowH[d - 1] - pf.h / 2) - cf.h / 2;
    gapBelow[d - 1] = Math.max(gapBelow[d - 1], snapUp(need));
  }
  const rowY: number[] = [0];
  for (let d = 1; d < rowH.length; d++) rowY[d] = rowY[d - 1] + rowH[d - 1] + gapBelow[d - 1];

  const placed: PlacedNode[] = [];
  const edges: LayoutEdge[] = [];
  const emit = (node: MapNode, branch: number): void => {
    const f = fp(node);
    placed.push({ node, x: left.get(node.id)!, y: rowY[depth.get(node.id)!], w: f.w, h: f.h });
    kids(node.id).forEach((k, i) => {
      const b = node.id === root.id ? i : branch;
      edges.push({ from: node.id, to: k.id, label: relationLabel(g, node.id, k.id), gradient: tintAt(b), bend: 0, arrow: "none" });
      emit(k, b);
    });
  };
  emit(root, 0);
  return { placed, edges, lines: [] };
}

/**
 * Top-down; a deep, narrow tree reads left-to-right instead, and single-child
 * chains step sideways, when that is what keeps the map squarer.
 */
export const treeLayout: LayoutEngine = (g) => squarest([
  () => layoutTree(g, footprint, false),
  () => transposed((fp) => layoutTree(g, fp, false)),
  () => layoutTree(g, footprint, true),
  () => transposed((fp) => layoutTree(g, fp, true)),
], 2.5);
