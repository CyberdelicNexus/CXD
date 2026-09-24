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
import type { LayoutResult } from "../layouts/shared";
import { MAP_TYPES, type MapGraph, type MapType } from "../types";
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
 * Types whose rendered connectors and lines must never pass through an
 * unrelated box. Every type: concept maps included, since the layered engine
 * (barycentre ordering, dominance-sized row gaps, pushing concepts off
 * spanning connectors) reaches zero on every generated graph.
 */
const CROSSING_FREE: MapType[] = [...MAP_TYPES];
/** Types whose rendered aspect (either orientation) must stay at or under ASPECT_MAX. */
const ASPECT_CAPPED: MapType[] = ["radial", "bubble", "spider", "tree", "doubleBubble"];
const ASPECT_MAX = 3;

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
    const expected = g.nodes.length + zones + 1; // every node, each zone's seed card, the title
    if (boxes !== expected) {
      fail(`${type} graph #${i}: rendered ${boxes} elements, expected ${expected} (a node was dropped)`);
      typeFailed = true; break;
    }
    const crossings = connectorCrossings(rendered.elements, rendered.edges);
    if (crossings.length) {
      crossingGraphs++;
      if (CROSSING_FREE.includes(type)) {
        const through = rendered.elements.find((e) => e.id === crossings[0].throughId);
        fail(`${type} graph #${i}: ${crossings.length} connector crossing(s), first: [connector-crossing] ${crossings[0].edgeId} passes through ${through?.type} ${crossings[0].throughId}`);
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

// The crossing rule itself: a connector from the first to the third of three
// cards in a row runs straight through the middle one; a neighbour pair does not.
{
  const card = (id: string, x: number) =>
    ({ id, type: "freeform", x, y: 0, width: 260, height: 300, zIndex: 1, locked: false, boardId: null, surface: "canvas" }) as unknown as CanvasElement;
  const els = [card("a", 0), card("b", 400), card("c", 800)];
  const edge = (from: string, to: string) => ({
    id: `${from}${to}`, fromNodeId: from, toNodeId: to, fromAnchor: "right" as const, toAnchor: "left" as const,
    fromAutoAnchor: true, toAutoAnchor: true, fromAnchorOffset: 0.5, toAnchorOffset: 0.5,
  });
  const hits = connectorCrossings(els, [edge("a", "c"), edge("a", "b")]);
  if (hits.length !== 1 || hits[0].edgeId !== "ac" || hits[0].throughId !== "b") fail(`connector-crossing self-test: got ${JSON.stringify(hits)}`);
  else console.log("  PASS connector-crossing rule detects a connector through a card");
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
