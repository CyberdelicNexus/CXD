// Concept map: layered (Sugiyama-style) layout. Back edges found by DFS are
// ignored for ranking (cycles are legal in a concept map), each concept is
// ranked by the longest path reaching it, and ranks become rows.
//
//   1. Every relation spanning more than one row gets a chain of dummy slots
//      in the rows it passes, so it has a lane of its own.
//   2. Rows are ordered by barycentre sweeps (down, then up, several times)
//      over real and dummy neighbours, which removes most crossings between
//      relations.
//   3. Each slot is pulled towards the mean x of its neighbours, keeping the
//      row's order and minimum spacing.
//   4. The gap below each row grows until every relation between adjacent
//      rows is vertical-dominant (centre dy beats centre dx by DOMINANCE), so
//      the canvas's auto anchors run it bottom -> top through the empty band.
//   5. Any connector that still paints over a concept (a relation spanning
//      rows, or a back edge) pushes that concept, and the rest of its row on
//      the far side, out of the way; step 4 is re-applied after each push.
import type { MapNode } from "../types";
import {
  connectorSamples, DOMINANCE, footprint, GAP, LEVEL_GAP, pathConflicts, snap, snapDown, snapUp, tintAt,
  type LayoutEdge, type LayoutEngine, type LayoutResult, type PlacedNode,
} from "./shared";

const ROW_GAP = 160; // room for relation labels between rows
const DUMMY_W = 40;
const SWEEPS = 6;
const PULLS = 4;
const MAX_PUSHES = 60;

/** The drawn connector of layout edge `i`, sampled. */
const curveXs = (r: LayoutResult, i: number) => {
  const e = r.edges[i];
  return connectorSamples(r.placed.find((q) => q.node.id === e.from)!, r.placed.find((q) => q.node.id === e.to)!);
};

interface Slot { id: string; node: MapNode | null; w: number; h: number; x: number }

export const conceptMapLayout: LayoutEngine = (g) => {
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

  // Rows of slots: every concept, plus a dummy per row a relation passes through.
  const rowCount = Math.max(...ids.map((i) => rank.get(i)!)) + 1;
  const rows: Slot[][] = Array.from({ length: rowCount }, () => []);
  const slotOf = new Map<string, Slot>();
  for (const id of ids) {
    const f = footprint(byId.get(id)!);
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
  g.relations.forEach((rel, ri) => {
    const ra = rank.get(rel.from);
    const rb = rank.get(rel.to);
    if (ra === undefined || rb === undefined || ra === rb) return;
    const [top, bottom] = ra < rb ? [rel.from, rel.to] : [rel.to, rel.from];
    let prev = top;
    for (let r = Math.min(ra, rb) + 1; r < Math.max(ra, rb); r++) {
      const d: Slot = { id: `__d${ri}_${r}`, node: null, w: DUMMY_W, h: 0, x: 0 };
      rows[r].push(d);
      slotOf.set(d.id, d);
      link(prev, d.id);
      prev = d.id;
    }
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
    // Forward pass keeps order and spacing; the row then shifts back by its
    // mean displacement so it is not dragged rightwards as a whole.
    const xs = wanted.map(snap);
    for (let i = 1; i < row.length; i++) xs[i] = Math.max(xs[i], xs[i - 1] + row[i - 1].w + sep(row[i - 1], row[i]));
    const drift = snap(xs.reduce((s, x, i) => s + x - wanted[i], 0) / row.length);
    row.forEach((s, i) => { s.x = xs[i] - drift; });
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
      return ns.length ? ns.reduce((sum, n) => sum + cx(slotOf.get(n)!), 0) / ns.length - s.w / 2 : s.x;
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
  const build = (): LayoutResult => {
    const rowH = realRows.map((row) => Math.max(0, ...row.map((s) => s.h)));
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
    realRows.forEach((row, r) => {
      for (const s of row) placed.push({ node: s.node!, x: s.x, y, w: s.w, h: s.h });
      y += rowH[r] + gap[r];
    });
    return { placed, edges, lines: [] };
  };

  let layout = build();
  let best = { layout, conflicts: Number.MAX_SAFE_INTEGER };
  for (let push = 0; push <= MAX_PUSHES; push++) {
    const conflicts = pathConflicts(layout);
    if (conflicts.length < best.conflicts) best = { layout, conflicts: conflicts.length };
    if (conflicts.length === 0 || push === MAX_PUSHES) break;
    // Move the first offender just clear of the curve where it crosses the
    // offender's band, taking its row-mates on that side along.
    const { edge, node } = conflicts[0];
    const p = layout.placed.find((q) => q.node.id === node)!;
    const inBand = curveXs(layout, edge).filter((q) => q.y > p.y - 4 && q.y < p.y + p.h + 4).map((q) => q.x);
    const lo = Math.min(...inBand);
    const hi = Math.max(...inBand);
    const row = realRows[rank.get(node)!];
    const i = row.findIndex((s) => s.id === node);
    const move = (rightward: boolean, sign: 1 | -1) => {
      const shift = rightward ? snapUp(hi + GAP - p.x) : -snapUp(p.x + p.w + GAP - lo);
      row.forEach((s, j) => { if (rightward ? j >= i : j <= i) s.x += sign * shift; });
    };
    // Try both sides; keep the one leaving fewer conflicts (the nearer side on a tie).
    const nearRight = p.x + p.w / 2 >= (lo + hi) / 2;
    const score = (rightward: boolean) => {
      move(rightward, 1);
      const n = pathConflicts(build()).length;
      move(rightward, -1);
      return n;
    };
    const first = score(nearRight);
    const second = score(!nearRight);
    move(second < first ? !nearRight : nearRight, 1);
    layout = build();
  }
  return best.layout;
};
