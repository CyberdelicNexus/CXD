// LIVE AND PAID. Spec §6 success criterion: the old and new prompt versions on
// the same inputs and models, scored by the same (current) judges.
//
// The old version (03564b1967, the prompts at 2676e95) is already recorded in
// OLD_RUN_ID; its maps are not regenerated and that run is never written.
// This script:
//   1. checks the 12 old done cells are there, the prompts changed, and no
//      re-scored copy exists yet;
//   2. prints the estimate and refuses above MAX_TOTAL_USD; without --yes it stops here;
//   3. backs up OLD_RUN_ID, writes COPY_RUN_ID with copies of the old cells
//      (new ids, rescoredFrom = original id) and re-scores only the copies with
//      the current llmStrong and llmCheap;
//   4. runs the new prompts on the same inputs and models (budget-capped);
//   5. proves the original run and votes.jsonl are byte-identical, then prints
//      the comparison (votes come next, in /lab?compare=OLD_VERSION).
//
// Run: npx tsx src/lib/lab/__verify__/version-compare-live.ts          (dry run)
//      npx tsx src/lib/lab/__verify__/version-compare-live.ts --yes    (spends, at most ~$1)
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { loadEnvLocal } from "./load-env";

const OLD_VERSION = "03564b1967";
const OLD_RUN_ID = "run-2026-09-26T09-21-01-644Z";
const COPY_RUN_ID = `${OLD_RUN_ID}-rescored`;
const INPUTS = ["bd-retreat", "bd-launch", "bd-museum", "bd-habits", "bd-festival", "bd-workshop"];
const MODELS = ["claude-haiku-4-5", "gemini-3.8-flash"];
const ARM = "graphExemplars" as const;
const RESCORE = ["llmStrong", "llmCheap"] as const;
const NEW_RUN_BUDGET_USD = 0.75;
const MAX_TOTAL_USD = 1;

const abort = (msg: string): never => { console.error(`ABORT: ${msg}`); process.exit(1); };
const labFile = (...parts: string[]) => path.resolve(process.cwd(), "lab-data", ...parts);
async function sha256(file: string): Promise<string> {
  try {
    return createHash("sha256").update(await fs.readFile(file)).digest("hex");
  } catch {
    return "missing";
  }
}

async function main() {
  loadEnvLocal();
  const { estimateRunCost, JUDGE_TOKENS, compareVersions } = await import("../lab-math");
  const { costOf, getLabModel, JUDGE_MODELS } = await import("../config");
  const store = await import("../store");
  const { PROMPT_VERSION } = await import("../prompts");
  const { promptVersionOf } = await import("../types");
  type Cell = import("../types").Cell;
  type Run = import("../types").Run;

  if (PROMPT_VERSION === OLD_VERSION) abort("the prompts are unchanged; there is nothing to compare");
  const oldRun = await store.readRun(OLD_RUN_ID);
  if (!oldRun) return abort(`old run ${OLD_RUN_ID} not found in lab-data/runs`);
  if (await store.readRun(COPY_RUN_ID)) abort(`${COPY_RUN_ID} already exists: this comparison was already scored (delete it only if you mean to pay again)`);
  const isOld = (c: Cell) =>
    promptVersionOf(c) === OLD_VERSION && c.arm === ARM && MODELS.includes(c.modelId) && INPUTS.includes(c.inputId) && c.status === "done";
  const oldCells = oldRun.cells.filter(isOld);
  if (oldCells.length !== INPUTS.length * MODELS.length) abort(`expected ${INPUTS.length * MODELS.length} old done cells, found ${oldCells.length}`);

  const config = {
    inputIds: INPUTS, arms: [ARM], modelIds: MODELS, forcedType: null,
    judges: ["rubric", "structure", "llmStrong", "llmCheap"] as ("rubric" | "structure" | "llmStrong" | "llmCheap")[],
    budgetUsd: NEW_RUN_BUDGET_USD,
  };
  const runEstimate = estimateRunCost(config);
  const perRescore = costOf(getLabModel(JUDGE_MODELS.strong), JUDGE_TOKENS.input, JUDGE_TOKENS.output) +
    costOf(getLabModel(JUDGE_MODELS.cheap), JUDGE_TOKENS.input, JUDGE_TOKENS.output);
  const rescoreEstimate = oldCells.length * perRescore;
  const total = runEstimate + rescoreEstimate;
  console.log(`old version ${OLD_VERSION}: ${oldCells.length} recorded cells in ${OLD_RUN_ID} (read only; copies go to ${COPY_RUN_ID})`);
  console.log(`new version ${PROMPT_VERSION}: ${INPUTS.length} inputs x ${MODELS.length} models, arm ${ARM}`);
  console.log(`estimate: new run $${runEstimate.toFixed(3)} (budget cap $${NEW_RUN_BUDGET_USD}), re-scoring the copies $${rescoreEstimate.toFixed(3)}, total $${total.toFixed(3)}`);
  if (total > MAX_TOTAL_USD) abort(`estimate $${total.toFixed(3)} is over the $${MAX_TOTAL_USD} cap`);
  if (!process.argv.includes("--yes")) { console.log("Dry run: nothing spent. Re-run with --yes to spend."); return; }

  const originalFile = labFile("runs", `${OLD_RUN_ID}.json`);
  const votesFile = labFile("votes.jsonl");
  const before = { run: await sha256(originalFile), votes: await sha256(votesFile) };

  // 1. Back up the original anyway (a second guard; it is never written).
  await fs.mkdir(labFile("backups"), { recursive: true });
  await fs.copyFile(originalFile, labFile("backups", `${OLD_RUN_ID}.json`));
  console.log(`backed up ${OLD_RUN_ID} to lab-data/backups/`);

  // 2. The copy: same maps and prompt version, new ids, rescoredFrom = the original.
  const copy: Run = {
    ...JSON.parse(JSON.stringify(oldRun)) as Run,
    id: COPY_RUN_ID,
    createdAt: new Date().toISOString(),
    spentUsd: 0,
    status: "done",
    persistError: null,
    cells: oldCells.map((c): Cell => ({
      ...JSON.parse(JSON.stringify(c)) as Cell,
      id: crypto.randomUUID(),
      runId: COPY_RUN_ID,
      rescoredFrom: c.id,
      // Generation was paid by the original run; only this copy's judging is charged here.
      genCostUsd: 0,
      judgeCostUsd: 0,
      costUsd: 0,
      judges: c.judges.filter((j) => j.judgeId === "rubric" || j.judgeId === "structure"),
    })),
  };
  const { JUDGES } = await import("../judges");
  const { CostMeter } = await import("../cost-meter");
  const runner = await import("../runner");
  const inputs = await runner.getInputs();
  for (const cell of copy.cells) {
    const input = inputs.find((i) => i.id === cell.inputId)!;
    for (const judgeId of RESCORE) {
      const meter = new CostMeter();
      let cost = 0;
      try {
        const score = await JUDGES[judgeId].judge({ input, cell, meter });
        cost = score.costUsd;
        cell.judges.push(score);
      } catch (e) {
        cost = meter.costUsd;
        cell.judges.push({ judgeId, overall: null, pass: false, scores: {}, notes: `judge error: ${(e as Error).message.slice(0, 200)}`, costUsd: cost });
      }
      cell.judgeCostUsd = (cell.judgeCostUsd ?? 0) + cost;
      cell.costUsd += cost;
      copy.spentUsd += cost;
    }
  }
  await store.saveRun(copy);
  console.log(`wrote ${COPY_RUN_ID}: ${copy.cells.length} re-scored copies, spent $${copy.spentUsd.toFixed(3)}`);

  // 3. The new prompts on the same inputs and models, in this process.
  const run = await runner.startRun(config);
  console.log(`started ${run.id}`);
  const deadline = Date.now() + 20 * 60_000;
  let settled = await runner.getRun(run.id);
  while (settled && settled.status === "running") {
    if (Date.now() > deadline) abort("the new run did not settle within 20 minutes");
    await new Promise((r) => setTimeout(r, 2000));
    settled = await runner.getRun(run.id);
  }
  console.log(`new run ${settled?.status}: ${settled?.cells.filter((c) => c.status === "done").length}/${settled?.cells.length} done, spent $${settled?.spentUsd.toFixed(3)}`);
  console.log(`total spent: $${((settled?.spentUsd ?? 0) + copy.spentUsd).toFixed(3)}`);

  // 4. The original run and the votes must be untouched.
  const after = { run: await sha256(originalFile), votes: await sha256(votesFile) };
  if (after.run !== before.run) abort(`${OLD_RUN_ID}.json changed; restore it from lab-data/backups/`);
  if (after.votes !== before.votes) abort("votes.jsonl changed during the script");
  console.log(`unchanged: ${OLD_RUN_ID}.json and votes.jsonl (sha256 match)`);

  const r = compareVersions(await store.allCells(), await store.readVotes(), OLD_VERSION, PROMPT_VERSION);
  const f = (x: number | null) => (x === null ? "-" : x.toFixed(2));
  console.log(`elementFit strong: old ${f(r.old.elementFitStrong)}, new ${f(r.next.elementFitStrong)}; cheap: old ${f(r.old.elementFitCheap)}, new ${f(r.next.elementFitCheap)}`);
  console.log(`failure rate: old ${f(r.old.failureRate)}, new ${f(r.next.failureRate)}`);
  console.log(`Next: npx next dev -p 3047, open http://localhost:3047/lab?compare=${OLD_VERSION}, Compare tab, vote every pair.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
