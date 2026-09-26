// Property test: for every map type with an engine, hundreds of random valid
// graphs must render with ZERO rubric errors and without silently dropping
// any node or edge. The engine's RAW output is checked too: renderMap runs
// repairLayout, which pushes overlapping boxes apart, so checkLayout alone
// cannot see overlaps an engine creates.
//
// Legibility is checked on the rendered map too. The canvas draws connectors
// ABOVE every element, so a connector (or a layout line) whose drawn path
// passes through an unrelated box paints over its content: connectorCrossings
// mirrors the canvas's path exactly and must find none. Aspect ratio
// (rendered width/height, either orientation) is reported per type and
// capped where a compact shape is always achievable.
// Run: npx tsx src/lib/maps/__verify__/layouts.verify.ts
import { checkLayout } from "@/lib/canvas-layout-rules";
import type { CanvasElement } from "@/types/canvas-elements";
import { checkMapStructure } from "../catalog";
import { connectorCrossings } from "../connector-geometry";
import { LAYOUTS } from "../layouts";
import { normalizeGraph, renderMap } from "../render";
import { ASPECT_MAX, type LayoutResult } from "../layouts/shared";
import {
  EMPHASES, MAP_TYPES, NODE_KINDS, RELATION_DIRECTIONS, RELATION_STYLES, RELATION_WEIGHTS, TINTS,
  type MapGraph, type MapType,
} from "../types";
import { VALID } from "./fixtures";
import { mulberry32, randomGraph } from "./random-graphs";

/** Types that MUST have an engine. Each engine task adds its type. */
const REQUIRED: MapType[] = [...MAP_TYPES];
const SEEDS = 200;
/** Types whose relations are drawn; every relation must reach the canvas. */
const DRAWS_RELATIONS: MapType[] = ["flow", "multiFlow", "conceptMap"];
/**
 * Types whose connectors are implied by structure (hub -> satellite, parent ->
 * child, topic -> quality, cause/effect -> event), not by relations: every
 * placed node must be an endpoint of at least one layout edge. Brace draws
 * brackets as lines, so it is not listed.
 */
const EDGE_PER_NODE: MapType[] = ["radial", "bubble", "spider", "tree", "doubleBubble", "multiFlow"];
/**
 * Types whose rendered connectors, lines and label pills must never pass
 * through an unrelated box. Every type, on the generator's normal-size graphs
 * (concept maps of 4-10 concepts). Dense concept maps are the stress tier below.
 */
const CROSSING_FREE: MapType[] = [...MAP_TYPES];
/** Types whose rendered aspect (either orientation) must stay at or under ASPECT_MAX. */
const ASPECT_CAPPED: MapType[] = ["radial", "bubble", "spider", "tree", "doubleBubble"];
/**
 * Concept-map stress tier: up to MAX_NODES concepts and up to one extra
 * relation per concept. Arbitrary dense relations cannot always be drawn
 * crossing-free with one cubic per relation, so maps of at most
 * STRESS_HARD_MAX_NODES concepts must still be clean, and the rest are held
 * to a ceiling the engine must beat (14/200 when set; the first
 * crossing-free engine had 61/200 and the original 186/200 under this check).
 */
const STRESS_SEEDS = 200;
const STRESS_HARD_MAX_NODES = 20;
const STRESS_CROSSING_CEILING = 16;
/** Largest rendered side (px) a stress-tier map may reach. */
const STRESS_MAX_EXTENT = 26000;

/** Rendered width/height over every box (title included), >= 1 in either orientation. */
function aspectOf(elements: CanvasElement[]): number {
  const boxes = elements.filter((e) => e.type !== "line");
  const w = Math.max(...boxes.map((e) => e.x + e.width)) - Math.min(...boxes.map((e) => e.x));
  const h = Math.max(...boxes.map((e) => e.y + e.height)) - Math.min(...boxes.map((e) => e.y));
  return Math.max(w / h, h / w);
}

/** Violations in the engine's own output, before any repair. */
function rawProblems(type: MapType, g: MapGraph, layout: LayoutResult): string[] {
  const out: string[] = [];
  const p = layout.placed;
  // Strict interior overlap; boxes that merely touch are fine.
  for (let a = 0; a < p.length; a++) {
    for (let b = a + 1; b < p.length; b++) {
      const A = p[a], B = p[b];
      if (A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h) {
        out.push(`raw-overlap: ${A.node.id} x ${B.node.id}`);
      }
    }
  }
  if (layout.residualConflicts) out.push(`residual-conflicts: engine reports ${layout.residualConflicts} crossing(s) it could not remove`);
  const placedIds = new Set(p.map((x) => x.node.id));
  for (const e of layout.edges) {
    if (!placedIds.has(e.from) || !placedIds.has(e.to)) out.push(`dangling-edge: ${e.from}->${e.to}`);
  }
  if (EDGE_PER_NODE.includes(type) && p.length > 1) {
    const touched = new Set(layout.edges.flatMap((e) => [e.from, e.to]));
    for (const x of p) if (!touched.has(x.node.id)) out.push(`unconnected: ${x.node.id}`);
  }
  if (DRAWS_RELATIONS.includes(type)) {
    const edgeKeys = new Set(layout.edges.map((e) => `${e.from}->${e.to}`));
    for (const r of g.relations) {
      if (!placedIds.has(r.from) || !placedIds.has(r.to)) continue;
      const covered = edgeKeys.has(`${r.from}->${r.to}`) || (type === "flow" && layout.lines.length > 0);
      if (!covered) out.push(`missing-relation: ${r.from}->${r.to}`);
    }
  }
  return out;
}

let failures = 0;
const fail = (msg: string) => { failures++; console.error(`  FAIL ${msg}`); };

/** What the generator actually produced, so a harness that stops covering a value fails loudly. */
const seen = {
  kinds: new Set<string>(), tints: new Set<string>(), emphasis: new Set<string>(),
  styles: new Set<string>(), weights: new Set<string>(), directions: new Set<string>(), legends: 0,
};
const tally = (g: MapGraph) => {
  g.nodes.forEach((x) => { seen.kinds.add(x.kind); if (x.tint) seen.tints.add(x.tint); seen.emphasis.add(x.emphasis); });
  g.relations.forEach((r) => { seen.styles.add(r.style); seen.weights.add(r.weight); seen.directions.add(r.direction); });
  if (g.legend.length) seen.legends++;
};

MAP_TYPES.forEach((type, typeIndex) => {
  if (!LAYOUTS[type]) {
    if (REQUIRED.includes(type)) fail(`${type}: no layout engine registered`);
    else console.log(`  SKIP ${type} (no engine yet)`);
    return;
  }
  let typeFailed = false;
  let crossingGraphs = 0;
  const aspects: number[] = [];
  const graphs = [VALID[type], ...Array.from({ length: SEEDS }, (_, s) => randomGraph(type, mulberry32(s * 9973 + typeIndex)))];
  for (let i = 0; i < graphs.length && !typeFailed; i++) {
    const g = graphs[i];
    tally(g);
    const structure = checkMapStructure(g);
    if (structure.length) { fail(`${type} graph #${i} is not valid (generator bug): ${structure.join("; ")}`); typeFailed = true; break; }
    let rendered;
    let layout: LayoutResult;
    try {
      layout = LAYOUTS[type]!(normalizeGraph(g));
      rendered = renderMap(g);
    } catch (e) {
      fail(`${type} graph #${i} threw: ${(e as Error).message}`); typeFailed = true; break;
    }
    const raw = rawProblems(type, normalizeGraph(g), layout);
    if (raw.length) {
      fail(`${type} graph #${i}: ${raw.length} raw engine problem(s), first: ${raw[0]}`);
      typeFailed = true; break;
    }
    if (rendered.edges.length !== layout.edges.length) {
      fail(`${type} graph #${i}: rendered ${rendered.edges.length} edges, engine produced ${layout.edges.length} (an edge was dropped)`);
      typeFailed = true; break;
    }
    const errors = checkLayout(rendered.elements, rendered.edges, { includeDesignSystemRules: true }).filter((v) => v.severity === "error");
    if (errors.length) {
      fail(`${type} graph #${i}: ${errors.length} layout error(s), first: [${errors[0].rule}] ${errors[0].message}`);
      typeFailed = true; break;
    }
    const zones = g.nodes.filter((x) => x.kind === "zone").length;
    const boxes = rendered.elements.filter((e) => e.type !== "line").length;
    // every node, each zone's seed card, the title, and a swatch plus a label per legend entry
    const expected = g.nodes.length + zones + 1 + 2 * g.legend.length;
    if (boxes !== expected) {
      fail(`${type} graph #${i}: rendered ${boxes} elements, expected ${expected} (a node was dropped)`);
      typeFailed = true; break;
    }
    const crossings = connectorCrossings(rendered.elements, rendered.edges);
    if (crossings.length) {
      crossingGraphs++;
      if (CROSSING_FREE.includes(type)) {
        const through = rendered.elements.find((e) => e.id === crossings[0].throughId);
        fail(`${type} graph #${i}: ${crossings.length} connector crossing(s), first: [connector-crossing] ${crossings[0].edgeId} ${crossings[0].by === "label" ? "label pill covers" : "passes through"} ${through?.type} ${crossings[0].throughId}`);
        typeFailed = true; break;
      }
    }
    const aspect = aspectOf(rendered.elements);
    aspects.push(aspect);
    if (ASPECT_CAPPED.includes(type) && aspect > ASPECT_MAX) {
      fail(`${type} graph #${i}: [aspect] rendered aspect ${aspect.toFixed(2)} exceeds ${ASPECT_MAX}`);
      typeFailed = true; break;
    }
  }
  if (!typeFailed) {
    console.log(`  PASS ${type}: ${graphs.length} graphs, 0 raw overlaps, 0 layout errors, no dropped nodes or edges, 0 connector crossings`);
    const sorted = [...aspects].sort((a, b) => a - b);
    const cap = ASPECT_CAPPED.includes(type) ? ` (cap ${ASPECT_MAX})` : " (reported only)";
    console.log(`       aspect ${type}: worst ${sorted[sorted.length - 1].toFixed(2)}, median ${sorted[sorted.length >> 1].toFixed(2)}${cap}; crossing graphs ${crossingGraphs}/${graphs.length}`);
  }
});

// Dense concept maps: hard for up to STRESS_HARD_MAX_NODES concepts, a
// ceiling above that; size and time are reported (and size bounded).
if (!LAYOUTS.conceptMap) console.log("  SKIP conceptMap stress (no engine yet)");
else {
  let crossing = 0;
  let hardFailed = false;
  const extents: number[] = [];
  const times: number[] = [];
  const byK = new Map<string, [number, number]>();
  for (let s = 0; s < STRESS_SEEDS && !hardFailed; s++) {
    const g = randomGraph("conceptMap", mulberry32(s * 7919 + 77), { tier: "stress" });
    const t0 = performance.now();
    const rendered = renderMap(g);
    times.push(performance.now() - t0);
    if (rendered.edges.length !== normalizeGraph(g).relations.length) { fail(`conceptMap stress #${s}: an edge was dropped`); hardFailed = true; break; }
    const boxes = rendered.elements.filter((e) => e.type !== "line");
    extents.push(Math.max(
      Math.max(...boxes.map((e) => e.x + e.width)) - Math.min(...boxes.map((e) => e.x)),
      Math.max(...boxes.map((e) => e.y + e.height)) - Math.min(...boxes.map((e) => e.y)),
    ));
    const k = g.nodes.length;
    const band = k <= 10 ? "4-10" : k <= 20 ? "11-20" : k <= 30 ? "21-30" : "31-40";
    const tally = byK.get(band) ?? [0, 0];
    tally[1]++;
    byK.set(band, tally);
    if (connectorCrossings(rendered.elements, rendered.edges).length === 0) continue;
    crossing++;
    tally[0]++;
    if (k <= STRESS_HARD_MAX_NODES) { fail(`conceptMap stress #${s} (${k} concepts): connector crossing on a map of <= ${STRESS_HARD_MAX_NODES} concepts`); hardFailed = true; }
  }
  const maxExtent = Math.max(...extents);
  if (!hardFailed && crossing > STRESS_CROSSING_CEILING) fail(`conceptMap stress: ${crossing}/${STRESS_SEEDS} graphs cross, ceiling ${STRESS_CROSSING_CEILING}`);
  else if (!hardFailed && maxExtent > STRESS_MAX_EXTENT) fail(`conceptMap stress: a map reached ${maxExtent}px, bound ${STRESS_MAX_EXTENT}`);
  else if (!hardFailed) {
    const sorted = [...times].sort((a, b) => a - b);
    const bands = Array.from(byK.entries()).sort().map(([band, [c, n]]) => `${band}: ${c}/${n}`).join(", ");
    console.log(`  PASS conceptMap stress: ${crossing}/${STRESS_SEEDS} graphs cross (ceiling ${STRESS_CROSSING_CEILING}; by concepts ${bands}), 0 at <= ${STRESS_HARD_MAX_NODES} concepts`);
    console.log(`       size: largest side ${maxExtent}px (bound ${STRESS_MAX_EXTENT}); render time median ${sorted[sorted.length >> 1].toFixed(0)}ms, max ${sorted[sorted.length - 1].toFixed(0)}ms`);
  }
}

// The generator must exercise the whole vocabulary (spec §3.5).
{
  const missing = [
    ...NODE_KINDS.filter((k) => !seen.kinds.has(k)).map((k) => `kind ${k}`),
    ...TINTS.filter((t) => !seen.tints.has(t)).map((t) => `tint ${t}`),
    ...EMPHASES.filter((e) => !seen.emphasis.has(e)).map((e) => `emphasis ${e}`),
    ...RELATION_STYLES.filter((s) => !seen.styles.has(s)).map((s) => `style ${s}`),
    ...RELATION_WEIGHTS.filter((w) => !seen.weights.has(w)).map((w) => `weight ${w}`),
    ...RELATION_DIRECTIONS.filter((d) => !seen.directions.has(d)).map((d) => `direction ${d}`),
    ...(seen.legends === 0 ? ["a graph with a legend"] : []),
  ];
  if (missing.length) fail(`generator coverage: never produced ${missing.join(", ")}`);
  else console.log(`  PASS generator covers every kind, tint (${seen.legends} graphs with a legend), emphasis, relation style, weight and direction`);
}

// The crossing rule itself, on hand-built canvases.
{
  const el = (id: string, type: string, x: number, y: number, width: number, height: number, extra: object = {}) =>
    ({ id, type, x, y, width, height, zIndex: 1, locked: false, boardId: null, surface: "canvas", ...extra }) as unknown as CanvasElement;
  const card = (id: string, x: number, y = 0) => el(id, "freeform", x, y, 260, 300);
  const edge = (from: string, to: string, label?: string) => ({
    id: `${from}${to}`, fromNodeId: from, toNodeId: to, fromAnchor: "right" as const, toAnchor: "left" as const,
    fromAutoAnchor: true, toAutoAnchor: true, fromAnchorOffset: 0.5, toAnchorOffset: 0.5,
    ...(label ? { label: { text: label } } : {}),
  });
  const got = (els: CanvasElement[], edges: ReturnType<typeof edge>[]) =>
    connectorCrossings(els, edges).map((c) => `${c.edgeId}>${c.throughId}${c.by === "label" ? ":label" : ""}`).sort().join(",");
  const cases: [string, string, string][] = [
    // Straight: a -> c runs through b; the neighbour pair a -> b does not.
    ["straight connector through a card", got([card("a", 0), card("b", 400), card("c", 800)], [edge("a", "c"), edge("a", "b")]), "ac>b"],
    // Cubic: horizontal anchors with a 400px drop; its middle crosses m.
    ["cubic connector through a card", got([card("a", 0), el("m", "shape", 460, 300, 140, 140), card("c", 1000, 600)], [edge("a", "c")]), "ac>m"],
    // A small box between two samples of a long straight connector is still caught.
    ["small box on a long connector", got([card("a", 0), el("w", "shape", 5000, 130, 40, 40), card("c", 10000)], [edge("a", "c")]), "ac>w"],
    // A line element: a quadratic sagging through a card below its chord.
    ["line element through a card", got([el("l", "line", 0, 0, 1000, 1, { start: { x: 0, y: 0 }, end: { x: 1000, y: 0 }, bend: { x: 500, y: 600 } }), card("b", 370, 150)], []), "l>b"],
    // Zones: an edge into a seed card may cross the seed's own zone; one
    // passing over an unrelated zone is flagged by the zone itself.
    ["own zone excluded, unrelated zone flagged", got([
      card("a", 0, 40),
      el("z", "container", 400, 0, 340, 420), el("s", "freeform", 440, 80, 260, 300, { containerId: "z" }),
      el("z2", "container", 1200, 0, 340, 420), el("s2", "freeform", 1240, 80, 260, 300, { containerId: "z2" }),
      card("c", 1800, 40),
    ], [edge("a", "s"), edge("s", "c")]), "sc>s2,sc>z2"],
    // A label pill is opaque: it may not cover an unrelated box the stroke misses.
    ["label pill over a card", got([card("a", 0, 0), el("t", "shape", 610, 152, 40, 20), card("c", 1000, 0)], [edge("a", "c", "causes")]), "ac>t:label"],
  ];
  for (const [name, actual, expected] of cases) {
    if (actual !== expected) fail(`connector-crossing self-test "${name}": got [${actual}], expected [${expected}]`);
  }
  if (cases.every(([, a, e]) => a === e)) console.log(`  PASS connector-crossing rule self-tests (${cases.length} cases: straight, cubic, small box, line, zones, label pill)`);
}

// The map lands at the requested origin (title's top-left).
{
  const out = renderMap(VALID.radial, { x: 1000, y: 500 });
  const minX = Math.min(...out.elements.map((e) => e.x));
  const minY = Math.min(...out.elements.map((e) => e.y));
  if (minX !== 1000 || minY !== 500) fail(`origin not honoured: got ${minX},${minY}`);
  else console.log("  PASS origin honoured");
}

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log("\nALL PASS");
