// Executes a run: every input × arm × model cell, RUN_CONCURRENCY at a time,
// halting new cells once spend reaches the confirmed budget. Server-only; runs
// continue in the background of the Next dev process while the UI polls.
import { checkLayout } from "@/lib/canvas-layout-rules";
import { CORPUS } from "./corpus";
import { RUN_CONCURRENCY } from "./config";
import { runArm } from "./arms";
import { JUDGES } from "./judges";
import { estimateRunCost } from "./lab-math";
import { readCustomInputs, readRun, saveRun } from "./store";
import type { Cell, LabInput, Run, RunConfig } from "./types";

/** Indirection so the offline verify script can fake the model call. */
export const runnerDeps = { runArm };

const live = new Map<string, Run>();

export async function getInputs(): Promise<LabInput[]> {
  return [...CORPUS, ...(await readCustomInputs())];
}

export async function getRun(id: string): Promise<Run | null> {
  return live.get(id) ?? (await readRun(id));
}

function blankCell(runId: string, inputId: string, arm: Cell["arm"], modelId: string): Cell {
  return {
    id: crypto.randomUUID(), runId, inputId, arm, modelId, status: "pending",
    mapType: null, graph: null, elements: [], edges: [],
    structureViolations: [], rubricErrors: [], rubricWarnings: [], judges: [],
    latencyMs: 0, costUsd: 0, error: null,
  };
}

export async function startRun(config: RunConfig): Promise<Run> {
  const inputs = new Map((await getInputs()).map((i) => [i.id, i]));
  const missing = config.inputIds.filter((id) => !inputs.has(id));
  if (missing.length) throw new Error(`Unknown input(s): ${missing.join(", ")}`);

  const id = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const cells: Cell[] = [];
  for (const inputId of config.inputIds) {
    for (const arm of config.arms) {
      for (const modelId of config.modelIds) cells.push(blankCell(id, inputId, arm, modelId));
    }
  }
  const run: Run = {
    id, createdAt: new Date().toISOString(), config,
    estimateUsd: estimateRunCost(config), spentUsd: 0, status: "running", cells,
  };
  live.set(id, run);
  await saveRun(run);
  void executeRun(run, inputs).catch(async (e) => {
    console.error("[lab] run crashed", e);
    run.status = "stopped";
    await saveRun(run);
    live.delete(run.id);
  });
  return run;
}

/** Estimated cost of one cell (arm + model + the run's judges), used to reserve budget while it is in flight. */
function cellEstimate(config: RunConfig, cell: Cell): number {
  return estimateRunCost({ ...config, inputIds: [cell.inputId], arms: [cell.arm], modelIds: [cell.modelId] });
}

async function executeRun(run: Run, inputs: Map<string, LabInput>): Promise<void> {
  const queue = run.cells.filter((c) => c.status === "pending");
  let next = 0;
  // Spend is only known when a cell finishes, so in-flight cells reserve their
  // estimate; otherwise RUN_CONCURRENCY cells could all start just under budget.
  let reserved = 0;
  const worker = async () => {
    while (next < queue.length) {
      const cell = queue[next++];
      if (cell.status !== "pending") continue; // already taken by a manual retry
      if (run.spentUsd + reserved >= run.config.budgetUsd) {
        cell.status = "skipped";
        cell.error = "budget reached";
      } else {
        const hold = cellEstimate(run.config, cell);
        reserved += hold;
        try {
          await runCell(run, cell, inputs.get(cell.inputId)!);
        } finally {
          reserved -= hold;
        }
      }
      await saveRun(run);
    }
  };
  await Promise.all(Array.from({ length: RUN_CONCURRENCY }, worker));
  run.status = run.cells.some((c) => c.status === "skipped") ? "stopped" : "done";
  await saveRun(run);
  live.delete(run.id);
}

async function runCell(run: Run, cell: Cell, input: LabInput): Promise<void> {
  cell.status = "running";
  let spent = 0;
  try {
    const out = await runnerDeps.runArm(cell.arm, input, cell.modelId, run.config.forcedType);
    spent += out.costUsd;
    cell.graph = out.graph;
    cell.mapType = out.graph?.mapType ?? null;
    cell.elements = out.elements;
    cell.edges = out.edges;
    cell.structureViolations = out.structureViolations;
    cell.latencyMs = out.latencyMs;

    const v = checkLayout(out.elements, out.edges, { includeDesignSystemRules: true });
    cell.rubricErrors = v.filter((x) => x.severity === "error").map((x) => `[${x.rule}] ${x.message}`);
    cell.rubricWarnings = v.filter((x) => x.severity === "warn").map((x) => `[${x.rule}] ${x.message}`);

    cell.judges = [];
    for (const judgeId of run.config.judges) {
      const judge = JUDGES[judgeId];
      if (!judge.enabled) continue;
      try {
        const score = await judge.judge({ input, cell });
        spent += score.costUsd;
        cell.judges.push(score);
      } catch (e) {
        cell.judges.push({ judgeId, overall: null, pass: false, scores: {}, notes: `judge error: ${(e as Error).message.slice(0, 200)}`, costUsd: 0 });
      }
    }

    const ok = out.elements.length > 0 && cell.structureViolations.length === 0 && cell.rubricErrors.length === 0;
    cell.status = ok ? "done" : "failed";
    cell.error = ok ? null : cell.structureViolations[0] ?? cell.rubricErrors[0] ?? "nothing was rendered";
  } catch (e) {
    cell.status = "error";
    cell.error = (e as Error).message.slice(0, 500);
  }
  cell.costUsd = spent;
  run.spentUsd += spent;
}

export async function retryCell(runId: string, cellId: string): Promise<Run | null> {
  const run = await getRun(runId);
  if (!run) return null;
  const cell = run.cells.find((c) => c.id === cellId);
  // A "running" cell in a run that is not live was orphaned by a server restart: retryable.
  if (!cell || (cell.status === "running" && live.has(run.id))) return run;
  const input = (await getInputs()).find((i) => i.id === cell.inputId);
  if (!input) return run;
  Object.assign(cell, blankCell(run.id, cell.inputId, cell.arm, cell.modelId), { id: cell.id });
  live.set(run.id, run);
  await runCell(run, cell, input);
  await saveRun(run);
  if (run.status !== "running") live.delete(run.id);
  return run;
}
