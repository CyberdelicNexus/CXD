// Run: npx tsx src/lib/lab/__verify__/runner.verify.ts
// Offline: the arm and the LLM judge are faked through runnerDeps / JUDGES, so no
// API is called. Works in a throwaway temp dir (chdir): no lab-data/ junk left behind.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ArmResult } from "../arms";
import type { LabInput, Run, RunConfig } from "../types";

let failures = 0;
const check = (name: string, cond: boolean) => {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const runner = await import("../runner");
  const { JUDGES } = await import("../judges");
  const { estimateRunCost } = await import("../lab-math");
  const { RUN_CONCURRENCY } = await import("../config");
  const { EXEMPLARS } = await import("@/lib/maps/exemplars");
  const { renderMap } = await import("@/lib/maps/render");
  const { CORPUS } = await import("../corpus");

  const originalCwd = process.cwd();
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "lab-runner-"));
  process.chdir(tmp);

  const graph = EXEMPLARS[0].graph;
  const rendered = renderMap(graph);
  let inFlight = 0;
  let maxInFlight = 0;
  let calls = 0;
  let costPerCell = 0;
  const failInputs = new Map<string, "throw" | "structure">();

  runner.runnerDeps.runArm = async (_arm, input: LabInput): Promise<ArmResult> => {
    calls++;
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      await sleep(20);
      const mode = failInputs.get(input.id);
      if (mode === "throw") throw new Error("model exploded (HTTP 500)");
      const base = { graph, inputTokens: 1, outputTokens: 1, costUsd: costPerCell, latencyMs: 20 };
      if (mode === "structure") return { ...base, elements: [], edges: [], structureViolations: ["radial: needs a centre"] };
      return { ...base, elements: rendered.elements, edges: rendered.edges, structureViolations: [] };
    } finally {
      inFlight--;
    }
  };
  JUDGES.llmCheap = {
    ...JUDGES.llmCheap,
    enabled: true,
    async judge({ input }) {
      if (input.id === CORPUS[2].id) throw new Error("judge timed out");
      return { judgeId: "llmCheap", overall: 4, pass: true, scores: {}, notes: "", costUsd: 0 };
    },
  };

  const waitDone = async (id: string): Promise<Run> => {
    for (let i = 0; i < 500; i++) {
      const r = await runner.getRun(id);
      if (r && r.status !== "running") return r;
      await sleep(20);
    }
    throw new Error("run did not finish");
  };

  const cfg = (n: number, budgetUsd: number): RunConfig => ({
    inputIds: CORPUS.slice(0, n).map((i) => i.id), arms: ["graph"], modelIds: ["gemini-3.8-flash"],
    forcedType: null, judges: ["rubric", "llmCheap"], budgetUsd,
  });

  try {
    // 1. Concurrency cap + failure isolation.
    failInputs.set(CORPUS[0].id, "throw");
    failInputs.set(CORPUS[1].id, "structure");
    const r1 = await waitDone((await runner.startRun(cfg(10, 100))).id);
    check(`never more than ${RUN_CONCURRENCY} cells in flight (saw ${maxInFlight})`, maxInFlight === RUN_CONCURRENCY);
    check("every cell ran exactly once", calls === 10);
    const byInput = new Map(r1.cells.map((c) => [c.inputId, c]));
    const thrown = byInput.get(CORPUS[0].id)!;
    check("model error is recorded as an error cell", thrown.status === "error" && /exploded/.test(thrown.error ?? ""));
    const bad = byInput.get(CORPUS[1].id)!;
    check("structure violation is recorded as a failed cell", bad.status === "failed" && bad.error === "radial: needs a centre");
    const judgeErr = byInput.get(CORPUS[2].id)!;
    check("judge error is recorded without failing the cell",
      judgeErr.status === "done" && judgeErr.judges.some((j) => j.judgeId === "llmCheap" && /judge error/.test(j.notes)));
    check("other cells completed", r1.cells.filter((c) => c.status === "done").length === 8);
    check("run finished as done (nothing skipped)", r1.status === "done");
    // The live status flips before the final save lands; give the write a moment.
    let onDisk: Run | null = null;
    for (let i = 0; i < 50 && onDisk?.status !== "done"; i++) {
      await sleep(20);
      onDisk = JSON.parse(await fs.readFile(path.join(tmp, "lab-data", "runs", `${r1.id}.json`), "utf8")) as Run;
    }
    onDisk = onDisk!;
    check("final state persisted", onDisk.status === "done" && onDisk.cells.every((c) => c.status !== "pending" && c.status !== "running"));

    // 2. Retry turns a failed cell into a done one.
    failInputs.clear();
    const retried = await runner.retryCell(r1.id, thrown.id);
    const again = retried?.cells.find((c) => c.id === thrown.id);
    check("retry re-runs the cell and keeps its id", again?.status === "done" && again.error === null);

    // 3. Budget: in-flight cells count against it, so spend stops within one cell of the budget.
    calls = 0; maxInFlight = 0;
    costPerCell = estimateRunCost(cfg(1, 0));
    const budget = costPerCell * 2.5;
    const r3 = await waitDone((await runner.startRun(cfg(12, budget))).id);
    const ran = r3.cells.filter((c) => c.status === "done").length;
    const skipped = r3.cells.filter((c) => c.status === "skipped");
    check(`spend stays within one cell of budget (spent ${r3.spentUsd.toFixed(5)}, budget ${budget.toFixed(5)})`,
      r3.spentUsd <= budget + costPerCell + 1e-12);
    check(`budget halts new cells (${ran} ran, ${skipped.length} skipped)`, ran < 12 && skipped.length === 12 - ran && calls === ran);
    check("skipped cells say why", skipped.every((c) => c.error === "budget reached"));
    check("budget-halted run is stopped", r3.status === "stopped");
  } finally {
    process.chdir(originalCwd);
    await sleep(100); // let any trailing writes land before removing the dir
    await fs.rm(tmp, { recursive: true, force: true });
  }

  if (failures) { console.error(`${failures} FAILED`); process.exit(1); }
  console.log("ALL PASS");
}
main().catch((e) => { console.error(e); process.exit(1); });
