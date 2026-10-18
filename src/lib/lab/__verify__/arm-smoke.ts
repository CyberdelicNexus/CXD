// Live: one graph arm + the baseline on one input with the cheapest model.
// Run: npx tsx src/lib/lab/__verify__/arm-smoke.ts
import { loadEnvLocal } from "./load-env";

async function main() {
  loadEnvLocal();
  const { runArm } = await import("../arms");
  const { CORPUS } = await import("../corpus");
  const input = CORPUS.find((i) => i.id === "cmp-app-live")!;
  for (const arm of ["graph", "baseline"] as const) {
    const r = await runArm(arm, input, "gemini-3.8-flash", null);
    console.log(`${arm}: mapType=${r.graph?.mapType ?? "-"} elements=${r.elements.length} violations=${r.structureViolations.length} cost=$${r.costUsd.toFixed(4)}`);
    if (r.structureViolations.length) console.log("  ", r.structureViolations.join("; "));
  }
}
main();
