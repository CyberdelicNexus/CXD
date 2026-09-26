// Concept map: layered (Sugiyama-style) layout. Back edges found by DFS are
// ignored for ranking (cycles are legal in a concept map), each concept is
// ranked by the longest path reaching it, and ranks become rows.
//
// The canvas draws each relation as ONE cubic between auto anchors; a
// relation spanning several rows cannot be routed through waypoints, so each
// row it passes must keep the stretch of row its curve actually crosses free:
//   1. Every relation spanning more than one row gets a LANE slot in each row
//      it passes.
//   2. Rows are ordered by barycentre sweeps (down, then up, several times)
//      over concepts and lanes, which removes most crossings between relations.
//   3. Slots are pulled towards the mean x of their neighbours (lane links
//      pull harder, straightening each spanning relation), keeping order and
//      spacing.
//   4. The gap below each row grows until every relation between adjacent
//      rows is vertical-dominant (centre dy beats centre dx by DOMINANCE), so
//      the canvas runs it bottom -> top through the band between the rows.
//   5. Lane fitting, for a number of rounds: each lane is set to the x-range
//      its drawn curve covers inside its row (plus LANE_CLEAR for the label
//      pill), and concepts in the row step out of any lane they touch on the
//      nearer side, keeping their order. Lanes may overlap each other (curves
//      may cross curves), never a concept.
//   6. Whatever still crosses is repaired by pushing the crossed concept, and
//      the rest of its row on that side, just clear of the curve (the nearer
//      side first, the far side if that did not help).
// Variants (fewer lane rounds, the left-to-right mirror) are tried in order
// until one is crossing-free within SIZE_BUDGET; all share one budget of
// crossing checks, so time stays bounded. Anything left is reported as
// residualConflicts. Every step is deterministic.
import type { MapGraph, MapNode } from "../types";
import {
  boundsOf, connectorGeometry, DOMINANCE, footprint, GAP, LEVEL_GAP, pathConflicts, snap, snapDown, snapUp, tintAt, transposed,
  type FootprintFn, type LayoutEdge, type LayoutEngine, type LayoutResult, type PlacedNode, type Point,
} from "./shared";
import { LABEL_PILL, SAMPLES } from "../connector-geometry";

const ROW_GAP = 160; // room for relation labels between rows
/** Initial lane width (before fitting) and the clearance a pushed concept keeps from a curve. */
const LANE_PAD = LABEL_PILL.w;
const LANE_W = 2 * LANE_PAD;
/** Clearance either side of a curve inside its lane: half the label pill plus slack. */
const LANE_CLEAR = 40;
const SWEEPS = 6;
const PULLS = 6;
/** How much harder a lane link pulls than a concept-to-concept link. */
const LANE_WEIGHT = 4;
/** Lane-fitting rounds per variant, most thorough first (thorough fitting can spread a dense map). */
const LANE_ROUND_STEPS = [16, 8, 4, 0];
/** Largest side (px) a variant may reach and still be preferred. */
const SIZE_BUDGET = 25000;
const MAX_PUSHES = 40;
/** Crossing checks (pathConflicts calls) all variants may spend repairing, together. */
const CHECK_BUDGET = 64;
/** Pushes in a row without a new best before a variant's repair gives up. */
const STALL_PUSHES = 6;

interface Slot { id: string; node: MapNode | null; w: number; h: number; x: number }
interface Lane { from: string; to: string; slots: Slot[]; rowOf: Map<Slot, number> }

/** The drawn connector of layout edge `i`, sampled. */
const curvePoints = (r: LayoutResult, i: number): Point[] => {
  const e = r.edges[i];
  return connectorGeometry(r.placed.find((q) => q.node.id === e.from)!, r.placed.find((q) => q.node.id === e.to)!).sample(SAMPLES);
};

function layoutConceptMap(g: MapGraph, fp: FootprintFn, laneRounds: number, work: { checks: number }): LayoutResult {
  const ids = g.nodes.map((x) => x.id);
  const byId = new Map(g.nodes.map((x) => [x.id, x]));
  const out = new Map<string, string[]>(ids.map((i) => [i, []]));
  for (const rel of g.relations) out.get(rel.from)?.push(rel.to);

  const state = new Map<string, 1 | 2>();
  const preds = new Map<string, string[]>(ids.map((i) => [i, []]));
  const dfs = (u: string): void => {
    state.set(u, 1);
    for (const v of out.get(u) || []) {
      if (state.get(v) === 1) continue; // back edge: a cycle, not a rank constraint
      preds.get(v)!.push(u);
      if (!state.has(v)) dfs(v);
    }
    state.set(u, 2);
  };
  ids.forEach((i) => { if (!state.has(i)) dfs(i); });

  const rank = new Map<string, number>();
  const rankOf = (v: string): number => {
    const known = rank.get(v);
    if (known !== undefined) return known;
    const ps = preds.get(v)!;
    const r = ps.length ? Math.max(...ps.map(rankOf)) + 1 : 0;
    rank.set(v, r);
    return r;
  };
  ids.forEach(rankOf);

  // 1. Rows of slots: every concept, plus a lane per row a relation passes through.
  const rowCount = Math.max(...ids.map((i) => rank.get(i)!)) + 1;
  const rows: Slot[][] = Array.from({ length: rowCount }, () => []);
  const slotOf = new Map<string, Slot>();
  for (const id of ids) {
    const f = fp(byId.get(id)!);
    const s: Slot = { id, node: byId.get(id)!, w: f.w, h: f.h, x: 0 };
    rows[rank.get(id)!].push(s);
    slotOf.set(id, s);
  }
  const up = new Map<string, string[]>();   // neighbours in the row above
  const down = new Map<string, string[]>(); // neighbours in the row below
  const link = (a: string, b: string) => { // a is one row above b
    (down.get(a) ?? down.set(a, []).get(a)!).push(b);
    (up.get(b) ?? up.set(b, []).get(b)!).push(a);
  };
  const lanes: Lane[] = [];
  g.relations.forEach((rel, ri) => {
    const ra = rank.get(rel.from);
    const rb = rank.get(rel.to);
    if (ra === undefined || rb === undefined || ra === rb) return;
    const [top, bottom] = ra < rb ? [rel.from, rel.to] : [rel.to, rel.from];
    const lane: Lane = { from: rel.from, to: rel.to, slots: [], rowOf: new Map() };
    let prev = top;
    for (let r = Math.min(ra, rb) + 1; r < Math.max(ra, rb); r++) {
      const d: Slot = { id: `__lane${ri}_${r}`, node: null, w: LANE_W, h: 0, x: 0 };
      rows[r].push(d);
      slotOf.set(d.id, d);
      lane.slots.push(d);
      lane.rowOf.set(d, r);
      link(prev, d.id);
      prev = d.id;
    }
    if (lane.slots.length) lanes.push(lane);
    link(prev, bottom);
  });

  // 2. Barycentre ordering.
  const index = new Map<string, number>();
  const reindex = (row: Slot[]) => row.forEach((s, i) => index.set(s.id, i));
  rows.forEach(reindex);
  const orderBy = (row: Slot[], nbrs: Map<string, string[]>) => {
    const key = (s: Slot) => {
      const ns = nbrs.get(s.id) ?? [];
      return ns.length ? ns.reduce((sum, n) => sum + index.get(n)!, 0) / ns.length : index.get(s.id)!;
    };
    const keyed = row.map((s, i) => ({ s, k: key(s), i }));
    keyed.sort((a, b) => a.k - b.k || a.i - b.i);
    row.splice(0, row.length, ...keyed.map((e) => e.s));
    reindex(row);
  };
  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    for (let r = 1; r < rowCount; r++) orderBy(rows[r], up);
    for (let r = rowCount - 2; r >= 0; r--) orderBy(rows[r], down);
  }

  // 3. Horizontal placement: packed and centred, then pulled towards neighbours.
  const sep = (a: Slot, b: Slot) => (a.node && b.node ? LEVEL_GAP : GAP);
  const pack = (row: Slot[], wanted: number[]) => {
    // Keeps order and spacing with balanced displacement: the average of the
    // left-to-right packing (pushes right) and the right-to-left one (pushes
    // left) — both feasible, so their average is too — snapped, then one
    // forward pass restores any spacing lost to snapping.
    const n = row.length;
    const l = wanted.slice();
    for (let i = 1; i < n; i++) l[i] = Math.max(l[i], l[i - 1] + row[i - 1].w + sep(row[i - 1], row[i]));
    const r = wanted.slice();
    for (let i = n - 2; i >= 0; i--) r[i] = Math.min(r[i], r[i + 1] - row[i].w - sep(row[i], row[i + 1]));
    const xs = l.map((x, i) => snap((x + r[i]) / 2));
    for (let i = 1; i < n; i++) xs[i] = Math.max(xs[i], xs[i - 1] + row[i - 1].w + sep(row[i - 1], row[i]));
    row.forEach((s, i) => { s.x = xs[i]; });
  };
  for (const row of rows) {
    const total = row.reduce((s, x) => s + x.w, 0) + row.slice(1).reduce((s, x, i) => s + sep(row[i], x), 0);
    let x = snapDown(-total / 2);
    row.forEach((s, i) => { if (i) x += sep(row[i - 1], s); s.x = x; x += s.w; });
  }
  const cx = (s: Slot) => s.x + s.w / 2;
  const pull = (row: Slot[], nbrs: Map<string, string[]>) => {
    const wanted = row.map((s) => {
      const ns = nbrs.get(s.id) ?? [];
      if (!ns.length) return s.x;
      // Lane links pull harder, straightening each spanning relation's chain.
      let sum = 0, wsum = 0;
      for (const n of ns) {
        const o = slotOf.get(n)!;
        const w = !s.node || !o.node ? LANE_WEIGHT : 1;
        sum += w * cx(o); wsum += w;
      }
      return sum / wsum - s.w / 2;
    });
    pack(row, wanted);
  };
  for (let p = 0; p < PULLS; p++) {
    for (let r = 1; r < rowCount; r++) pull(rows[r], up);
    for (let r = rowCount - 2; r >= 0; r--) pull(rows[r], down);
  }

  // 4 + 5. Row gaps for vertical dominance, then push concepts off connectors.
  const realRows = rows.map((row) => row.filter((s) => s.node));
  const edges: LayoutEdge[] = g.relations.map((rel) => ({
    from: rel.from, to: rel.to, label: rel.label,
    gradient: tintAt(rank.get(rel.from) ?? 0), bend: 0, arrow: "end",
  }));
  let rowY: number[] = [];
  let rowH: number[] = [];
  const build = (): LayoutResult => {
    rowH = realRows.map((row) => Math.max(0, ...row.map((s) => s.h)));
    const gap = rowH.map(() => ROW_GAP);
    for (const rel of g.relations) {
      const a = slotOf.get(rel.from);
      const b = slotOf.get(rel.to);
      const ra = rank.get(rel.from)!;
      const rb = rank.get(rel.to)!;
      if (!a || !b || Math.abs(ra - rb) !== 1) continue;
      const [t, bt, r] = ra < rb ? [a, b, ra] : [b, a, rb];
      const need = Math.abs(cx(t) - cx(bt)) + DOMINANCE - (rowH[r] - t.h / 2) - bt.h / 2;
      gap[r] = Math.max(gap[r], snapUp(need));
    }
    const placed: PlacedNode[] = [];
    let y = 0;
    rowY = [];
    realRows.forEach((row, r) => {
      rowY.push(y);
      for (const s of row) placed.push({ node: s.node!, x: s.x, y, w: s.w, h: s.h });
      y += rowH[r] + gap[r];
    });
    return { placed, edges, lines: [] };
  };

  // Fit each lane to where its curve actually crosses the row (plus room for
  // the label pill), then repack; a few rounds let rows settle around lanes.
  for (let round = 0; round < laneRounds && lanes.length; round++) {
    const l = build();
    const at = new Map(l.placed.map((p) => [p.node.id, p]));
    for (const lane of lanes) {
      const pts = connectorGeometry(at.get(lane.from)!, at.get(lane.to)!).sample(SAMPLES);
      for (const slot of lane.slots) {
        const r = lane.rowOf.get(slot)!;
        const top = rowY[r];
        const xs = pts.filter((q) => q.y >= top - 4 && q.y <= top + rowH[r] + 4).map((q) => q.x);
        if (!xs.length) continue;
        const lo = Math.min(...xs);
        const hi = Math.max(...xs);
        slot.w = snapUp(hi - lo) + 2 * LANE_CLEAR;
        slot.x = snapDown(lo - LANE_CLEAR);
      }
    }
    // Lanes may overlap each other (curves may cross curves); concepts may not
    // enter a lane. Each row's concepts keep their order and step out of any
    // lane they touch on the nearer side, when order allows, else rightwards.
    for (const row of rows) {
      const blocked = row.filter((x) => !x.node).map((x) => [x.x - GAP, x.x + x.w + GAP] as const);
      const hits = (x: number, w: number) => blocked.find(([a, b]) => x < b && x + w > a);
      let prevRight = -Infinity;
      for (const slot of row) {
        if (!slot.node) continue;
        const floor = prevRight + LEVEL_GAP;
        let x = Math.max(slot.x, floor);
        for (let guard = 0, hit = hits(x, slot.w); hit && guard < 100; guard++, hit = hits(x, slot.w)) {
          const left = snapDown(hit[0] - slot.w);
          const right = snapUp(hit[1]);
          x = left >= floor && x - left < right - x && !hits(left, slot.w) ? left : right;
        }
        slot.x = x;
        prevRight = x + slot.w;
      }
    }
  }

  let layout = build();
  let conflicts = pathConflicts(layout);
  work.checks--;
  let best = { layout, n: conflicts.length };
  let stalled = 0;
  for (let push = 0; push < MAX_PUSHES && conflicts.length > 0 && work.checks > 0; push++) {
    // Move the first offender just clear of the curve where it crosses the
    // offender's band, taking its row-mates on that side along.
    const { edge, node } = conflicts[0];
    const p = layout.placed.find((q) => q.node.id === node)!;
    const inBand = curvePoints(layout, edge).filter((q) => q.y > p.y - 4 && q.y < p.y + p.h + 4).map((q) => q.x);
    const lo = inBand.length ? Math.min(...inBand) : p.x;
    const hi = inBand.length ? Math.max(...inBand) : p.x + p.w;
    const row = realRows[rank.get(node)!];
    const i = row.findIndex((s) => s.id === node);
    const move = (rightward: boolean, sign: 1 | -1) => {
      const shift = rightward ? snapUp(hi + LANE_PAD / 2 - p.x) : -snapUp(p.x + p.w + LANE_PAD / 2 - lo);
      row.forEach((s, j) => { if (rightward ? j >= i : j <= i) s.x += sign * shift; });
    };
    // The nearer side first; the far side only if that did not help, and the
    // one leaving fewer conflicts wins (the nearer on a tie).
    const nearRight = p.x + p.w / 2 >= (lo + hi) / 2;
    const trial = (rightward: boolean) => {
      move(rightward, 1);
      const r = build();
      const c = pathConflicts(r);
      work.checks--;
      move(rightward, -1);
      return { r, c, rightward };
    };
    const a = trial(nearRight);
    const b = a.c.length < conflicts.length || work.checks <= 0 ? a : trial(!nearRight);
    const pick = b.c.length < a.c.length ? b : a;
    move(pick.rightward, 1);
    layout = pick.r;
    conflicts = pick.c;
    if (conflicts.length < best.n) { best = { layout, n: conflicts.length }; stalled = 0; }
    // A push that leaves as many conflicts usually undoes the last one: stop
    // oscillating and leave the shared budget to the next variant.
    else if (++stalled >= STALL_PUSHES) break;
  }
  return best.n ? { ...best.layout, residualConflicts: best.n } : best.layout;
}

const extent = (r: LayoutResult) => {
  const b = boundsOf(r.placed);
  return Math.max(b.maxX - b.minX, b.maxY - b.minY);
};

/**
 * Variants in order: full lane fitting top-down, then its
 * left-to-right mirror, then fewer lane rounds (lane fitting can spread a
 * dense map; fewer rounds keep it within SIZE_BUDGET). The first variant with
 * no conflicts within budget wins; otherwise the fewest conflicts among
 * those within budget, else the smallest.
 */
export const conceptMapLayout: LayoutEngine = (g) => {
  // One deterministic budget of crossing checks shared by every variant's
  // repair loop: bounds the time a dense 40-concept map can take.
  const work = { checks: CHECK_BUDGET };
  const variants: (() => LayoutResult)[] = [];
  for (const rounds of LANE_ROUND_STEPS) {
    variants.push(() => layoutConceptMap(g, footprint, rounds, work));
    variants.push(() => {
      // Label pills and board anchors are not symmetric, so recount in the real frame.
      const m = transposed((fp) => layoutConceptMap(g, fp, rounds, work));
      const n = pathConflicts(m).length;
      return { placed: m.placed, edges: m.edges, lines: m.lines, ...(n ? { residualConflicts: n } : {}) };
    });
  }
  let best: { r: LayoutResult; key: [number, number, number] } | null = null;
  for (const make of variants) {
    const r = make();
    const size = extent(r);
    const within = size <= SIZE_BUDGET;
    // Within budget: fewest conflicts, then smaller. Over budget: smaller first.
    const key: [number, number, number] = within ? [0, r.residualConflicts ?? 0, size] : [1, size, r.residualConflicts ?? 0];
    if (key[0] === 0 && key[1] === 0) return r;
    if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && (key[1] < best.key[1] || (key[1] === best.key[1] && key[2] < best.key[2])))) best = { r, key };
  }
  return best!.r;
};
