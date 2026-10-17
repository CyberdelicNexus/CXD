// Radial and Bubble: one centre with satellites evenly spaced on a ring.
import { footprint, placeCentered, relationLabel, ringCenters, tintAt, type LayoutEdge, type LayoutEngine, type PlacedNode } from "./shared";

export const radialLayout: LayoutEngine = (g) => {
  const center = g.nodes.find((x) => x.role === "center")!;
  const satellites = g.nodes.filter((x) => x.id !== center.id);
  const centers = ringCenters(footprint(center), satellites.map(footprint));
  const placed: PlacedNode[] = [placeCentered(center, 0, 0)];
  const edges: LayoutEdge[] = [];
  const n = satellites.length;
  // The ring wraps: when the last satellite would repeat the first one's tint
  // (n = 7 with six tints), step it on so ring neighbours always differ.
  const tint = (i: number) => (i === n - 1 && n > 1 && tintAt(i) === tintAt(0) ? tintAt(i + 1) : tintAt(i));
  satellites.forEach((s, i) => {
    placed.push(placeCentered(s, centers[i].x, centers[i].y));
    edges.push({ from: center.id, to: s.id, label: relationLabel(g, center.id, s.id), gradient: tint(i), bend: 0, arrow: "none" });
  });
  return { placed, edges, lines: [] };
};
