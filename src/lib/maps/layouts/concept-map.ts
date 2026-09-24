// Concept map: layered layout. Back edges found by DFS are ignored for
// ranking (cycles are legal in a concept map), each concept is ranked by the
// longest path reaching it, ranks become rows, and one barycentre pass orders
// each row under its predecessors to reduce crossings.
import {
  footprint, LEVEL_GAP, snapDown, tintAt,
  type LayoutEdge, type LayoutEngine, type PlacedNode,
} from "./shared";

const ROW_GAP = 160; // room for relation labels between rows

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

  const rowCount = Math.max(...ids.map((i) => rank.get(i)!)) + 1;
  const rows: string[][] = Array.from({ length: rowCount }, () => []);
  ids.forEach((i) => rows[rank.get(i)!].push(i));

  const pos = new Map<string, number>();
  rows[0].forEach((id, i) => pos.set(id, i));
  for (let r = 1; r < rows.length; r++) {
    const bary = (id: string) => {
      const ps = preds.get(id)!.filter((p) => pos.has(p));
      return ps.length ? ps.reduce((s, p) => s + pos.get(p)!, 0) / ps.length : Number.MAX_SAFE_INTEGER;
    };
    rows[r] = rows[r]
      .map((id, i) => ({ id, b: bary(id), i }))
      .sort((a, b) => a.b - b.b || a.i - b.i)
      .map((e) => e.id);
    rows[r].forEach((id, i) => pos.set(id, i));
  }

  const placed: PlacedNode[] = [];
  let y = 0;
  for (const row of rows) {
    const nodes = row.map((id) => byId.get(id)!);
    const fps = nodes.map(footprint);
    const rowW = fps.reduce((s, f) => s + f.w, 0) + LEVEL_GAP * (nodes.length - 1);
    let x = snapDown(-rowW / 2);
    nodes.forEach((node, i) => {
      placed.push({ node, x, y, w: fps[i].w, h: fps[i].h });
      x += fps[i].w + LEVEL_GAP;
    });
    y += Math.max(...fps.map((f) => f.h)) + ROW_GAP;
  }

  const edges: LayoutEdge[] = g.relations.map((rel) => ({
    from: rel.from, to: rel.to, label: rel.label,
    gradient: tintAt(rank.get(rel.from) ?? 0), bend: 0, arrow: "end",
  }));
  return { placed, edges, lines: [] };
};
