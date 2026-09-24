// Property test: for every map type with an engine, hundreds of random valid
// graphs must render with ZERO rubric errors and without silently dropping
// any node. Run: npx tsx src/lib/maps/__verify__/layouts.verify.ts
import { checkLayout } from "@/lib/canvas-layout-rules";
import { checkMapStructure } from "../catalog";
import { LAYOUTS } from "../layouts";
import { renderMap } from "../render";
import { MAP_TYPES, type MapType } from "../types";
import { VALID } from "./fixtures";
import { mulberry32, randomGraph } from "./random-graphs";

/** Types that MUST have an engine. Each engine task adds its type. */
const REQUIRED: MapType[] = ["radial", "bubble"];
const SEEDS = 200;

let failures = 0;
const fail = (msg: string) => { failures++; console.error(`  FAIL ${msg}`); };

MAP_TYPES.forEach((type, typeIndex) => {
  if (!LAYOUTS[type]) {
    if (REQUIRED.includes(type)) fail(`${type}: no layout engine registered`);
    else console.log(`  SKIP ${type} (no engine yet)`);
    return;
  }
  let typeFailed = false;
  const graphs = [VALID[type], ...Array.from({ length: SEEDS }, (_, s) => randomGraph(type, mulberry32(s * 9973 + typeIndex)))];
  for (let i = 0; i < graphs.length && !typeFailed; i++) {
    const g = graphs[i];
    const structure = checkMapStructure(g);
    if (structure.length) { fail(`${type} graph #${i} is not valid (generator bug): ${structure.join("; ")}`); typeFailed = true; break; }
    let rendered;
    try {
      rendered = renderMap(g);
    } catch (e) {
      fail(`${type} graph #${i} threw: ${(e as Error).message}`); typeFailed = true; break;
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
  }
  if (!typeFailed) console.log(`  PASS ${type}: ${graphs.length} graphs, 0 layout errors, no dropped nodes`);
});

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
