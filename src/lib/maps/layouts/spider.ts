// Spider: each branch travels with its leaves as one cluster (branch on top,
// leaves stacked beneath). Clusters sit on a ring around the centre, spaced by
// their full cluster size, so no leaf can collide with another cluster.
import type { MapNode } from "../types";
import {
  columnSize, footprint, placeCentered, relationLabel, ringCenters, snap, stackColumn, tintAt,
  type LayoutEdge, type LayoutEngine, type PlacedNode,
} from "./shared";

export const spiderLayout: LayoutEngine = (g) => {
  const center = g.nodes.find((x) => x.role === "center")!;
  const branches = g.nodes.filter((x) => x.role === "branch");
  const clusters = branches.map((branch) => {
    const members: MapNode[] = [branch, ...g.nodes.filter((x) => x.role === "leaf" && x.parent === branch.id)];
    return { branch, members, size: columnSize(members) };
  });
  const centers = ringCenters(footprint(center), clusters.map((c) => c.size));
  const placed: PlacedNode[] = [placeCentered(center, 0, 0)];
  const edges: LayoutEdge[] = [];
  clusters.forEach((c, i) => {
    const x = snap(centers[i].x - c.size.w / 2);
    const y = snap(centers[i].y - c.size.h / 2);
    placed.push(...stackColumn(c.members, x, y));
    edges.push({ from: center.id, to: c.branch.id, label: relationLabel(g, center.id, c.branch.id), gradient: tintAt(i), bend: 0, arrow: "none" });
    for (const leaf of c.members.slice(1)) {
      edges.push({ from: c.branch.id, to: leaf.id, label: relationLabel(g, c.branch.id, leaf.id), gradient: tintAt(i), bend: 0, arrow: "none" });
    }
  });
  return { placed, edges, lines: [] };
};
