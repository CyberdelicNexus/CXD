// Radial and Bubble: one centre with satellites evenly spaced on a ring.
import { footprint, placeCentered, relationLabel, ringCenters, tintAt, type LayoutEdge, type LayoutEngine, type PlacedNode } from "./shared";

export const radialLayout: LayoutEngine = (g) => {
  const center = g.nodes.find((x) => x.role === "center")!;
  const satellites = g.nodes.filter((x) => x.id !== center.id);
  const centers = ringCenters(footprint(center), satellites.map(footprint));
  const placed: PlacedNode[] = [placeCentered(center, 0, 0)];
  const edges: LayoutEdge[] = [];
  satellites.forEach((s, i) => {
    placed.push(placeCentered(s, centers[i].x, centers[i].y));
    edges.push({ from: center.id, to: s.id, label: relationLabel(g, center.id, s.id), gradient: tintAt(i), bend: 0, arrow: "none" });
  });
  return { placed, edges, lines: [] };
};
