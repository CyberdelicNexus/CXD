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
  let judgeCost = 0;
  const failInputs = new Map<string, "throw" | "structure" | "billed" | "crossing">();
  const { cardsAsElements } = await import("../format-input");
  const { autoEdge, connectorCrossings } = await import("@/lib/maps/connector-geometry");
  const { PROMPT_VERSION } = await import("../prompts");
  // Three cards in a row with a connector from the first to the third: it paints over the middle one.
  const rowCards = cardsAsElements([{ title: "A", body: "" }, { title: "Middle card", body: "" }, { title: "C", body: "" }]);
  const crossingEdges = [autoEdge(rowCards[0], rowCards[2])];
  const originalSave = runner.runnerDeps.saveRun;

  runner.runnerDeps.runArm = async (_arm, input: LabInput, _model, _forced, meter): Promise<ArmResult> => {
    calls++;
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      await sleep(20);
      const mode = failInputs.get(input.id);
      if (mode === "throw") throw new Error("model exploded (HTTP 500)");
      if (mode === "billed") {
        // The provider billed the call, then it failed (e.g. max_tokens).
        meter?.add(0.05, 1000, 16000);
        throw new Error("hit max_tokens before the object was complete");
      }
      const base = { graph, inputTokens: 1, outputTokens: 1, costUsd: costPerCell, latencyMs: 20 };
      if (mode === "crossing") return { ...base, elements: rowCards, edges: crossingEdges, structureViolations: [] };
      if (mode === "structure") return { ...base, elements: [], edges: [], structureViolations: ["radial: needs a centre"] };
      return { ...base, elements: rendered.elements, edges: rendered.edges, structureViolations: [] };
    } finally {
      inFlight--;
    }
  };
  JUDGES.llmCheap = {
    ...JUDGES.llmCheap,
    enabled: true,
    async judge({ input, meter }) {
      if (input.id === CORPUS[2].id) {
        meter?.add(judgeCost * 1.5);
        throw new Error("judge timed out");
      }
      meter?.add(judgeCost);
      return { judgeId: "llmCheap", overall: 4, pass: true, scores: {}, notes: "", costUsd: judgeCost };
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

    // 4. A run saved as "running" with no live executor (server restart) is reconciled.
    const orphanId = "run-orphan-test";
    const orphanCells = (await waitDone(r1.id)).cells.slice(0, 2).map((c, i) => ({
      ...c, runId: orphanId, status: (i === 0 ? "running" : "done") as Run["cells"][number]["status"],
    }));
    const orphan: Run = { ...r1, id: orphanId, status: "running", cells: orphanCells };
    await fs.writeFile(path.join(tmp, "lab-data", "runs", `${orphanId}.json`), JSON.stringify(orphan), "utf8");
    const listed = (await runner.listRuns()).find((r) => r.id === orphanId);
    check("orphaned run is listed as stopped", listed?.status === "stopped");
    const fetched = await runner.getRun(orphanId);
    const stuck = fetched?.cells[0];
    check("orphaned running cell becomes a retryable error", stuck?.status === "error" && stuck.error === runner.ORPHANED_CELL_ERROR);
    await sleep(50);
    const persisted = JSON.parse(await fs.readFile(path.join(tmp, "lab-data", "runs", `${orphanId}.json`), "utf8")) as Run;
    check("orphan reconciliation is persisted", persisted.status === "stopped" && persisted.cells[0].status === "error");
    const healed = await runner.retryCell(orphanId, stuck!.id);
    check("orphaned cell retries to done", healed?.cells[0].status === "done" && healed.status === "stopped");

    const readDisk = async (id: string) =>
      JSON.parse(await fs.readFile(path.join(tmp, "lab-data", "runs", `${id}.json`), "utf8")) as Run;
    const settle = () => sleep(60);

    // 5. I3 + I5: calls billed before a failure are charged; generation and judge cost are split.
    failInputs.clear();
    failInputs.set(CORPUS[0].id, "billed");
    costPerCell = 0.01;
    judgeCost = 0.002;
    const r5 = await waitDone((await runner.startRun(cfg(3, 100))).id);
    const [b0, b1, b2] = CORPUS.slice(0, 3).map((i) => r5.cells.find((c) => c.inputId === i.id)!);
    const near = (a: number | undefined, b: number) => a !== undefined && Math.abs(a - b) < 1e-12;
    check("failed arm is charged what the provider billed", b0.status === "error" && near(b0.genCostUsd, 0.05) && near(b0.costUsd, 0.05));
    check("failed arm has no judge cost", near(b0.judgeCostUsd, 0));
    check("done cell splits generation and judge cost", near(b1.genCostUsd, 0.01) && near(b1.judgeCostUsd, 0.002) && near(b1.costUsd, 0.012));
    check("a judge that fails after billing is charged",
      near(b2.judgeCostUsd, 0.003) && b2.judges.find((j) => j.judgeId === "llmCheap")?.costUsd === 0.003);
    check(`run spend includes failed calls (${r5.spentUsd.toFixed(4)})`, near(r5.spentUsd, 0.05 + 0.012 + 0.013));
    await settle();
    check("cost split is persisted", near((await readDisk(r5.id)).cells.find((c) => c.id === b1.id)?.judgeCostUsd, 0.002));

    // 6. I2: retries respect the budget and never replace a done cell.
    calls = 0;
    const doneRetry = await runner.retryCell(r5.id, b1.id).then(() => null, (e: Error) => e);
    check("retrying a done cell is refused (conflict)", doneRetry instanceof runner.LabConflictError && /already succeeded/.test(doneRetry.message));
    check("refused done retry left the cell alone", calls === 0 && (await runner.getRun(r5.id))?.cells.find((c) => c.id === b1.id)?.status === "done");
    const oneCell = estimateRunCost(cfg(1, 0));
    const tight = await waitDone((await runner.startRun(cfg(1, 0.05 + oneCell / 2))).id);
    check("tight run spent the billed failure", tight.cells[0].status === "error" && near(tight.spentUsd, 0.05));
    calls = 0;
    const overBudget = await runner.retryCell(tight.id, tight.cells[0].id).then(() => null, (e: Error) => e);
    check("retry that would exceed the budget is refused (conflict)",
      overBudget instanceof runner.LabConflictError && /exceed/.test(overBudget.message) && /budget/.test(overBudget.message));
    check("refused budget retry made no model call and spent nothing", calls === 0 && near((await runner.getRun(tight.id))!.spentUsd, 0.05));

    // 7. I4: concurrent retries on a run that is not live both persist.
    failInputs.clear();
    failInputs.set(CORPUS[0].id, "throw");
    failInputs.set(CORPUS[1].id, "throw");
    costPerCell = 0;
    judgeCost = 0;
    const r7 = await waitDone((await runner.startRun(cfg(2, 100))).id);
    await settle();
    failInputs.clear();
    calls = 0;
    const [x7, y7] = r7.cells;
    await Promise.all([runner.retryCell(r7.id, x7.id), runner.retryCell(r7.id, y7.id)]);
    await settle();
    const disk7 = await readDisk(r7.id);
    check("both concurrent retries persisted", disk7.cells.every((c) => c.status === "done") && calls === 2);
    // Same cell twice at once: one model call, not two.
    failInputs.set(CORPUS[0].id, "throw");
    const r7b = await waitDone((await runner.startRun(cfg(1, 100))).id);
    await settle();
    failInputs.clear();
    calls = 0;
    await Promise.all([runner.retryCell(r7b.id, r7b.cells[0].id), runner.retryCell(r7b.id, r7b.cells[0].id)]);
    check("two retries of the same cell run it once", calls === 1);

    // 9. M2: a rendered map with connector crossings is not ok and never votable.
    check("crossing fixture really crosses", connectorCrossings(rowCards, crossingEdges).length > 0);
    failInputs.clear();
    failInputs.set(CORPUS[0].id, "crossing");
    const r9 = await waitDone((await runner.startRun({ ...cfg(2, 100), forcedType: "flow" })).id);
    const crossed = r9.cells.find((c) => c.inputId === CORPUS[0].id)!;
    check("crossing cell is failed", crossed.status === "failed");
    check("crossing is recorded in its violations",
      crossed.structureViolations.some((v) => /connector crossing/.test(v) && v.includes("Middle card")) && /connector crossing/.test(crossed.error ?? ""));
    const { pickPair } = await import("../lab-math");
    const clean = r9.cells.find((c) => c.inputId === CORPUS[1].id)!;
    check("crossing cell is never offered for voting",
      pickPair([crossed, { ...clean, inputId: crossed.inputId, arm: "baseline" }], [], () => 0.3) === null);

    // 10. I6: cells are stamped with the prompt version and the forced type.
    check("cells carry the current prompt version", r9.cells.every((c) => c.promptVersion === PROMPT_VERSION));
    check("cells carry the run's forced type", r9.cells.every((c) => c.forcedType === "flow") && r5.cells.every((c) => c.forcedType === null));
    failInputs.clear();

    // 8. M8: a failed save is not assumed to have persisted.
    runner.runnerDeps.saveRun = async () => { throw new Error("disk full"); };
    calls = 0;
    const refusedStart = await runner.startRun(cfg(1, 100)).then(() => null, (e: Error) => e);
    check("a run that cannot be saved is not started", !!refusedStart && /could not save/.test(refusedStart.message) && calls === 0);
    runner.runnerDeps.saveRun = originalSave;
    failInputs.set(CORPUS[0].id, "throw");
    failInputs.set(CORPUS[1].id, "throw");
    const r8 = await waitDone((await runner.startRun(cfg(2, 100))).id);
    await settle();
    failInputs.clear();
    runner.runnerDeps.saveRun = async () => { throw new Error("disk full"); };
    const afterFail = await runner.retryCell(r8.id, r8.cells[0].id);
    check("failed save is recorded on the run", /disk full/.test(afterFail?.persistError ?? ""));
    const stillLive = await runner.getRun(r8.id);
    check("unsaved run stays live in memory (authoritative)", stillLive === afterFail && stillLive?.cells[0].status === "done");
    check("disk still has the old state", (await readDisk(r8.id)).cells[0].status === "error");
    runner.runnerDeps.saveRun = originalSave;
    const healed8 = await runner.retryCell(r8.id, r8.cells[1].id);
    await settle();
    const disk8 = await readDisk(r8.id);
    check("next good save clears the error and persists everything",
      healed8?.persistError === null && disk8.cells.every((c) => c.status === "done") && !disk8.persistError);
  } finally {
    process.chdir(originalCwd);
    await sleep(100); // let any trailing writes land before removing the dir
    await fs.rm(tmp, { recursive: true, force: true });
  }

  if (failures) { console.error(`${failures} FAILED`); process.exit(1); }
  console.log("ALL PASS");
}
main().catch((e) => { console.error(e); process.exit(1); });
