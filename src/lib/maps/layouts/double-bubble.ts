// Double bubble: five columns left to right — left-only qualities, left topic,
// shared qualities, right topic, right-only qualities. Columns own disjoint
// x-ranges; the topics sit on the axis y = 0.
//
// Connectors are drawn from auto anchors, so legibility is geometric. Every
// topic -> quality pair is kept horizontal-dominant (centre dx beats centre dy
// by DOMINANCE): the gap between a topic and a column grows with the column's
// height. Each connector then runs inside the empty gap between the topic and
// its column, and must only avoid the column's other members:
//   - one-sided columns (left-only, right-only) align the edge facing their
//     topic, so no member reaches into the gap;
//   - the shared column faces both topics, so it is centre-aligned with its
//     narrowest member on the axis and members no narrower further out: any
//     member lying between a quality and the axis is inside that quality's
//     x-range and cannot meet its connector.
// A map too wide for its height (few, flat qualities) hangs its one-sided
// qualities above and below the topics instead of beside them, or is laid
// out top to bottom (the same construction mirrored across the diagonal),
// whichever passes the hull check and is squarer. A sparse map of wide, flat
// members (e.g. two topics and one shared quality in a line) can exceed the
// aspect cap in every variant with major-column gaps; only then are the
// variants retried with level gaps, and kept if clean and squarer.
import type { MapGraph, MapNode, MapRole } from "../types";
import {
  ASPECT_MAX, ASPECT_TARGET, DOMINANCE, footprint, GAP, isClean, LEVEL_GAP, relationLabel, renderedAspect,
  snap, snapDown, snapUp, squarest, transposed, ZONE_GAP,
  type Footprint, type FootprintFn, type LayoutEdge, type LayoutEngine, type LayoutResult, type PlacedNode,
} from "./shared";

/** Members stacked top to bottom from `top`; returns their top y. */
function stackTops(fps: Footprint[], top: number): number[] {
  let y = top;
  return fps.map((f) => { const t = y; y += f.h + GAP; return t; });
}

/** Narrowest in the middle, widths non-decreasing outward (stable for ties). */
function widthOrdered(nodes: MapNode[], fp: FootprintFn): MapNode[] {
  const sorted = nodes.map((n, i) => ({ n, i, w: fp(n).w })).sort((a, b) => a.w - b.w || a.i - b.i).map((e) => e.n);
  const out: MapNode[] = [];
  sorted.forEach((n, i) => { if (i % 2 === 0) out.push(n); else out.unshift(n); });
  return out;
}

/**
 * `flankL` / `flankR`: instead of an outer column, the left-only qualities
 * hang in a row above the left topic / the right-only ones in a row below
 * the right topic (vertical-dominant, facing edges aligned) — a squarer shape for maps
 * with few, flat qualities.
 */
function layoutDoubleBubble(
  g: MapGraph, fp: FootprintFn, flankL: boolean, flankR: boolean, columnGap: number = ZONE_GAP,
): LayoutResult {
  const pick = (role: MapRole) => g.nodes.filter((x) => x.role === role);
  const left = pick("leftTopic")[0];
  const right = pick("rightTopic")[0];
  const shared = widthOrdered(pick("shared"), fp);
  const leftOnly = pick("leftOnly");
  const rightOnly = pick("rightOnly");

  const lf = fp(left);
  const rf = fp(right);
  const ltY = snapDown(-lf.h / 2);
  const rtY = snapDown(-rf.h / 2);
  const ltCy = ltY + lf.h / 2;
  const rtCy = rtY + rf.h / 2;

  // Vertical placement of each column.
  const centredTops = (nodes: MapNode[]) => {
    const fps = nodes.map(fp);
    const h = fps.reduce((s, f) => s + f.h, 0) + GAP * (nodes.length - 1);
    return stackTops(fps, snapDown(-h / 2));
  };
  const loTops = centredTops(leftOnly);
  const roTops = centredTops(rightOnly);
  // Shared: the middle (narrowest) member is centred on the axis.
  const sFps = shared.map(fp);
  const midIndex = Math.floor((shared.length - 1) / 2) + (shared.length % 2 === 0 ? 1 : 0);
  const aboveMid = sFps.slice(0, midIndex).reduce((s, f) => s + f.h + GAP, 0);
  const sTops = stackTops(sFps, snapDown(-sFps[midIndex].h / 2) - aboveMid);

  /** Gap from a topic's side to a column so every member is horizontal-dominant. */
  const gapFor = (topic: Footprint, topicCy: number, fps: Footprint[], tops: number[], reach: (f: Footprint) => number) =>
    Math.max(columnGap, snapUp(Math.max(...fps.map((f, i) =>
      Math.abs(tops[i] + f.h / 2 - topicCy) + DOMINANCE - topic.w / 2 - reach(f)))));

  const placed: PlacedNode[] = [];
  const put = (node: MapNode, x: number, y: number) => { const f = fp(node); placed.push({ node, x, y, w: f.w, h: f.h }); };

  /** A row of `nodes` centred on a topic, facing edges aligned, clear of it vertically. */
  const flankRow = (nodes: MapNode[], topic: PlacedNode, above: boolean) => {
    const fps = nodes.map(fp);
    const tcx = topic.x + topic.w / 2;
    const total = fps.reduce((s, f) => s + f.w, 0) + GAP * (nodes.length - 1);
    let cx = snapDown(tcx - total / 2);
    const xs = fps.map((f) => { const l = cx; cx += f.w + GAP; return l; });
    const need = Math.max(...fps.map((f, i) => Math.abs(xs[i] + f.w / 2 - tcx) + DOMINANCE - topic.h / 2 - f.h / 2));
    let gap = Math.max(columnGap, snapUp(need));
    // Clear every box already placed under/over the row's span (e.g. a tall shared column).
    const x0 = xs[0];
    const x1 = xs[xs.length - 1] + fps[fps.length - 1].w;
    for (const p of placed) {
      if (p.x >= x1 + GAP || p.x + p.w <= x0 - GAP) continue;
      gap = Math.max(gap, above ? topic.y - p.y + GAP : p.y + p.h - (topic.y + topic.h) + GAP);
    }
    nodes.forEach((n, i) => put(n, xs[i], above ? topic.y - gap - fps[i].h : topic.y + topic.h + gap));
  };

  // Left-only column, right-aligned (its facing edge) at x = 0.
  let x = 0;
  const loFps = leftOnly.map(fp);
  if (!flankL) {
    leftOnly.forEach((n, i) => put(n, x - loFps[i].w, loTops[i]));
    if (leftOnly.length) x += gapFor(lf, ltCy, loFps, loTops, (f) => f.w / 2);
  }
  put(left, x, ltY);
  const ltPlaced = placed[placed.length - 1];
  x += lf.w;

  // Shared column, centre-aligned; both topics need clearance to its centre line.
  const sW = Math.max(...sFps.map((f) => f.w));
  const sGapL = gapFor(lf, ltCy, sFps, sTops, () => sW / 2);
  const sGapR = gapFor(rf, rtCy, sFps, sTops, () => sW / 2);
  const sCx = x + sGapL + sW / 2;
  shared.forEach((n, i) => put(n, snap(sCx - sFps[i].w / 2), sTops[i]));
  x += sGapL + sW + sGapR;
  put(right, x, rtY);
  const rtPlaced = placed[placed.length - 1];
  x += rf.w;

  if (flankL && leftOnly.length) flankRow(leftOnly, ltPlaced, true);
  if (flankR && rightOnly.length) {
    flankRow(rightOnly, rtPlaced, false);
  } else if (rightOnly.length) {
    // Right-only column, left-aligned (its facing edge).
    const roFps = rightOnly.map(fp);
    x += gapFor(rf, rtCy, roFps, roTops, (f) => f.w / 2);
    rightOnly.forEach((n, i) => put(n, x, roTops[i]));
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
}

/** Classic columns unless too wide or tall; then flanks and/or top-to-bottom, whichever is clean and squarer. */
export const doubleBubbleLayout: LayoutEngine = (g) => {
  const variants: [boolean, boolean][] = [[false, false], [true, true], [true, false], [false, true]];
  const run = (gap: number) => squarest([
    ...variants.map(([l, r]) => () => layoutDoubleBubble(g, footprint, l, r, gap)),
    ...variants.map(([l, r]) => () => transposed((fp) => layoutDoubleBubble(g, fp, l, r, gap))),
  ], ASPECT_TARGET);
  const roomy = run(ZONE_GAP);
  const roomyAspect = renderedAspect(roomy.placed);
  if (roomyAspect <= ASPECT_MAX) return roomy;
  // Too sparse to square with major-column gaps: tighten to level gaps.
  const tight = run(LEVEL_GAP);
  return isClean(tight) && renderedAspect(tight.placed) < roomyAspect ? tight : roomy;
};
