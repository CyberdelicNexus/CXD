// Spider: each branch travels with its leaves as one cluster. Clusters sit
// around the centre (the first to its right, then evenly round), and each is
// oriented by the side its connector from the centre lands on: the branch is
// the member nearest the centre and its leaves fan AWAY from it, as a column
// beside it (left/right clusters) or a row beyond it (top/bottom clusters).
//
// Connectors are drawn from auto anchors (the facing sides along the dominant
// axis between the centres), so legibility is geometric:
//   - branch -> leaf: the leaf column/row keeps every leaf dominant along the
//     cluster's axis (the gap grows with the column), and its near edges are
//     aligned, so each connector stays in the empty gap between branch and
//     leaves and never crosses a sibling leaf;
//   - centre -> branch: each cluster is pushed out along its own ray until
//     no connector hull from the centre meets it and it comes within GAP of
//     no other cluster (spacing is per pair, not by the largest cluster).
import type { MapNode } from "../types";
import {
  boxesMeet, boxOf, centerOf, DOMINANCE, footprint, GAP, hullOf, LEVEL_GAP, placeAt, placeCentered,
  relationLabel, renderedAspect, snap, snapDown, snapUp, tintAt, unionBox,
  type Box, type LayoutEdge, type LayoutEngine, type PlacedNode,
} from "./shared";

/** Direction the leaves fan out from the branch. */
type Fan = "right" | "left" | "down" | "up";
const STEP = 40;
const MAX_ROUNDS = 2000;

/** Branch at its own origin (top-left 0,0) with its leaves fanned out towards `fan`. */
function cluster(branch: MapNode, leaves: MapNode[], fan: Fan): PlacedNode[] {
  const b = placeAt(branch, 0, 0);
  const bc = centerOf(b);
  if (leaves.length === 0) return [b];
  const fps = leaves.map(footprint);
  if (fan === "right" || fan === "left") {
    const total = fps.reduce((s, f) => s + f.h, 0) + GAP * (leaves.length - 1);
    let y = snapDown(bc.y - total / 2);
    const ys = fps.map((f) => { const top = y; y += f.h + GAP; return top; });
    // Horizontal dominance for every leaf: centre dx beats centre dy by DOMINANCE.
    const need = Math.max(...fps.map((f, i) => Math.abs(ys[i] + f.h / 2 - bc.y) - b.w / 2 - f.w / 2 + DOMINANCE));
    const gap = Math.max(LEVEL_GAP, snapUp(need));
    return [b, ...leaves.map((leaf, i) => placeAt(leaf, fan === "right" ? b.w + gap : -gap - fps[i].w, ys[i]))];
  }
  const total = fps.reduce((s, f) => s + f.w, 0) + GAP * (leaves.length - 1);
  let x = snapDown(bc.x - total / 2);
  const xs = fps.map((f) => { const left = x; x += f.w + GAP; return left; });
  const need = Math.max(...fps.map((f, i) => Math.abs(xs[i] + f.w / 2 - bc.x) - b.h / 2 - f.h / 2 + DOMINANCE));
  const gap = Math.max(LEVEL_GAP, snapUp(need));
  return [b, ...leaves.map((leaf, i) => placeAt(leaf, xs[i], fan === "down" ? b.h + gap : -gap - fps[i].h))];
}

/**
 * Clusters around the hub, the first at `rotation` radians (0 = right of the
 * centre), each pushed out until clear. Returns each cluster's members, or
 * null if the push did not settle.
 */
function arrange(hub: PlacedNode, groups: { branch: MapNode; leaves: MapNode[] }[], rotation: number): PlacedNode[][] | null {
  const hc = centerOf(hub);
  const k = groups.length;
  const hubDiag = Math.hypot(hub.w, hub.h) / 2;
  const radius = groups.map((gr) => {
    const f = footprint(gr.branch);
    return snapUp(hubDiag + Math.hypot(f.w, f.h) / 2 + GAP);
  });

  const build = () => groups.map((gr, i) => {
    const angle = rotation + (2 * Math.PI * i) / k;
    const f = footprint(gr.branch);
    const bx = snap(hc.x + radius[i] * Math.cos(angle) - f.w / 2);
    const by = snap(hc.y + radius[i] * Math.sin(angle) - f.h / 2);
    // The side the centre's connector lands on decides the fan (same rule as getClosestAnchors).
    const dx = bx + f.w / 2 - hc.x;
    const dy = by + f.h / 2 - hc.y;
    const fan: Fan = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    const members = cluster(gr.branch, gr.leaves, fan).map((p) => ({ ...p, x: p.x + bx, y: p.y + by }));
    const box: Box = unionBox(members.map(boxOf));
    return { members, box, spoke: hullOf(hub, members[0]) };
  });

  let clusters = build();
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const bad = new Set<number>();
    clusters.forEach((c, i) => {
      if (boxesMeet(c.box, boxOf(hub), GAP)) bad.add(i);
      clusters.forEach((o, j) => {
        if (j === i) return;
        if (j > i && boxesMeet(c.box, o.box, GAP)) { bad.add(i); bad.add(j); }
        // The centre's connector to this branch must not paint over another
        // cluster: push that cluster out along its own ray, clear of the hull.
        if (boxesMeet(c.spoke, o.box, 20)) bad.add(j);
      });
    });
    if (bad.size === 0) return clusters.map((c) => c.members);
    bad.forEach((i) => { radius[i] += STEP; });
    clusters = build();
  }
  return null;
}

export const spiderLayout: LayoutEngine = (g) => {
  const center = g.nodes.find((x) => x.role === "center")!;
  const hub = placeCentered(center, 0, 0);
  const groups = g.nodes.filter((x) => x.role === "branch").map((branch) => ({
    branch,
    leaves: g.nodes.filter((x) => x.role === "leaf" && x.parent === branch.id),
  }));
  // Start on the right (two branches read left/right); a turn of the whole
  // ring is taken instead when it gives a squarer map.
  const k = groups.length;
  let best: { members: PlacedNode[][]; aspect: number } | null = null;
  // Distinct turns only (for k = 2, π/k is π/2 and π/2k is π/4).
  const rotations = Array.from(new Set([0, Math.PI / 2, Math.PI / k, Math.PI / 4, Math.PI / (2 * k)]));
  for (const rotation of rotations) {
    const members = arrange(hub, groups, rotation);
    if (!members) continue;
    const aspect = renderedAspect([hub, ...members.flat()]);
    if (!best || aspect < best.aspect - 0.01) best = { members, aspect };
  }
  if (!best) throw new Error("spider clusters did not settle");

  const placed: PlacedNode[] = [hub];
  const edges: LayoutEdge[] = [];
  groups.forEach((gr, i) => {
    placed.push(...best!.members[i]);
    edges.push({ from: center.id, to: gr.branch.id, label: relationLabel(g, center.id, gr.branch.id), gradient: tintAt(i), bend: 0, arrow: "none" });
    for (const leaf of gr.leaves) {
      edges.push({ from: gr.branch.id, to: leaf.id, label: relationLabel(g, gr.branch.id, leaf.id), gradient: tintAt(i), bend: 0, arrow: "none" });
    }
  });
  return { placed, edges, lines: [] };
};
