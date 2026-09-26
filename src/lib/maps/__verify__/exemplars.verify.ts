// Run: npx tsx src/lib/maps/__verify__/exemplars.verify.ts
import { checkLayout } from "@/lib/canvas-layout-rules";
import { checkMapStructure } from "../catalog";
import { connectorCrossings } from "../connector-geometry";
import { EXEMPLARS } from "../exemplars";
import { renderMap } from "../render";

let failures = 0;
const check = (name: string, cond: boolean) => {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
};

check("at least three exemplars", EXEMPLARS.length >= 3);
for (const ex of EXEMPLARS) {
  const v = checkMapStructure(ex.graph);
  check(`exemplar "${ex.graph.title}" is structurally valid${v.length ? `: ${v.join("; ")}` : ""}`, v.length === 0);
  if (v.length === 0) {
    const out = renderMap(ex.graph);
    const errors = checkLayout(out.elements, out.edges, { includeDesignSystemRules: true }).filter((x) => x.severity === "error");
    check(`exemplar "${ex.graph.title}" renders with 0 layout errors${errors.length ? `: ${errors.map((e) => e.message).join("; ")}` : ""}`, errors.length === 0);
    const crossings = connectorCrossings(out.elements, out.edges);
    check(`exemplar "${ex.graph.title}" renders with 0 connector crossings${crossings.length ? ` (${crossings.length})` : ""}`, crossings.length === 0);
  }
}

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log("\nALL PASS");
