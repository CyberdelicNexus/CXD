// Executes a run: every input × arm × model cell, RUN_CONCURRENCY at a time,
// halting new cells once spend reaches the confirmed budget. Server-only; runs
// continue in the background of the Next dev process while the UI polls.
import { checkLayout } from "@/lib/canvas-layout-rules";
import { connectorCrossings } from "@/lib/maps/connector-geometry";
import { CORPUS } from "./corpus";
import { RUN_CONCURRENCY } from "./config";
import { runArm } from "./arms";
import { CostMeter } from "./cost-meter";
import { elementText } from "./describe";
import { JUDGES } from "./judges";
import { PROMPT_VERSION } from "./prompts";
import { estimateRunCost } from "./lab-math";
import { listRuns as listStoredRuns, readCustomInputs, readRun, saveRun } from "./store";
import type { Cell, LabInput, Run, RunConfig } from "./types";

/** Indirection so the offline verify script can fake the model call and the disk. */
export const runnerDeps = { runArm, saveRun };

/** A request the lab refuses for a reason the user can act on (HTTP 409). */
export class LabConflictError extends Error {
  override name = "LabConflictError";
}

// Runs executing in this process. Kept on globalThis so a dev hot reload of this
// module does not forget runs whose executors are still going.
const liveKey = "__cxdLabLiveRuns";
const live: Map<string, Run> =
  ((globalThis as Record<string, unknown>)[liveKey] as Map<string, Run> | undefined) ??
  ((globalThis as Record<string, unknown>)[liveKey] = new Map<string, Run>()) as Map<string, Run>;

/**
 * Per-run bookkeeping that is never persisted: budget reserved by cells in
 * flight (executor and retries alike), and how many retries hold the run live.
 */
interface RunState { reserved: number; retries: number }
const stateKey = "__cxdLabRunState";
const runStates: Map<string, RunState> =
  ((globalThis as Record<string, unknown>)[stateKey] as Map<string, RunState> | undefined) ??
  ((globalThis as Record<string, unknown>)[stateKey] = new Map<string, RunState>()) as Map<string, RunState>;
function stateOf(runId: string): RunState {
  let st = runStates.get(runId);
  if (!st) { st = { reserved: 0, retries: 0 }; runStates.set(runId, st); }
  return st;
}

/** Drop a run from memory once nothing holds it: no executor, no retry, and its latest state is on disk. */
function release(run: Run): void {
  const st = stateOf(run.id);
  if (run.status === "running" || st.retries > 0 || run.persistError) return;
  live.delete(run.id);
  if (st.reserved === 0) runStates.delete(run.id);
}

/**
 * Save the run. A failed save is recorded on the run (persistError) instead of
 * being assumed to have worked, and release() then keeps the run live so the
 * in-memory copy stays authoritative and visible; the next good save clears it.
 */
async function persist(run: Run): Promise<boolean> {
  try {
    await runnerDeps.saveRun({ ...run, persistError: null });
    run.persistError = null;
    return true;
  } catch (e) {
    run.persistError = `saving the run failed: ${(e as Error).message.slice(0, 300)}`;
    console.error("[lab] saveRun failed", e);
    return false;
  }
}

export const ORPHANED_CELL_ERROR = "interrupted: the server restarted mid-run";

export async function getInputs(): Promise<LabInput[]> {
  return [...CORPUS, ...(await readCustomInputs())];
}

/**
 * A run saved as "running" whose executor is not live in this process was
 * orphaned by a server restart. Mark it stopped (and its in-flight cells as
 * errors, which retryCell accepts) and persist that, so it does not show as
 * running forever.
 */
async function reconcileOrphan(run: Run): Promise<Run> {
  if (run.status !== "running" || live.has(run.id)) return run;
  run.status = "stopped";
  for (const cell of run.cells) {
    if (cell.status === "running") {
      cell.status = "error";
      cell.error = ORPHANED_CELL_ERROR;
    }
  }
  // If this save fails the next read reconciles again: nothing is lost.
  await persist(run);
  return run;
}

export async function getRun(id: string): Promise<Run | null> {
  const liveRun = live.get(id);
  if (liveRun) return liveRun;
  const stored = await readRun(id);
  return stored ? reconcileOrphan(stored) : null;
}

/** Every stored run, newest first, live runs from memory and orphans reconciled. */
export async function listRuns(): Promise<Run[]> {
  const stored = await listStoredRuns();
  return Promise.all(stored.map((r) => live.get(r.id) ?? reconcileOrphan(r)));
}

/** A fresh cell, stamped with the prompts and forced type it will be generated under. */
function blankCell(runId: string, inputId: string, arm: Cell["arm"], modelId: string, forcedType: RunConfig["forcedType"]): Cell {
  return {
    id: crypto.randomUUID(), runId, inputId, arm, modelId, status: "pending",
    promptVersion: PROMPT_VERSION, forcedType,
    mapType: null, graph: null, elements: [], edges: [],
    structureViolations: [], rubricErrors: [], rubricWarnings: [], judges: [],
    latencyMs: 0, costUsd: 0, genCostUsd: 0, judgeCostUsd: 0, error: null,
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
      for (const modelId of config.modelIds) cells.push(blankCell(id, inputId, arm, modelId, config.forcedType));
    }
  }
  const run: Run = {
    id, createdAt: new Date().toISOString(), config,
    estimateUsd: estimateRunCost(config), spentUsd: 0, status: "running", cells,
  };
  // Never spend on a run that could not be written down.
  try {
    await runnerDeps.saveRun(run);
  } catch (e) {
    throw new Error(`could not save the new run, so it was not started: ${(e as Error).message}`);
  }
  live.set(id, run);
  void executeRun(run, inputs).catch(async (e) => {
    console.error("[lab] run crashed", e);
    run.status = "stopped";
    await persist(run);
    release(run);
  });
  return run;
}

/** Estimated cost of one cell (arm + model + the run's judges), used to reserve budget while it is in flight. */
function cellEstimate(config: RunConfig, cell: Cell): number {
  return estimateRunCost({ ...config, inputIds: [cell.inputId], arms: [cell.arm], modelIds: [cell.modelId] });
}

async function executeRun(run: Run, inputs: Map<string, LabInput>): Promise<void> {
  const queue = run.cells.filter((c) => c.status === "pending");
  const st = stateOf(run.id);
  let next = 0;
  // Spend is only known when a cell finishes, so in-flight cells (including
  // manual retries) reserve their estimate; otherwise RUN_CONCURRENCY cells
  // could all start just under budget.
  const worker = async () => {
    while (next < queue.length) {
      const cell = queue[next++];
      if (cell.status !== "pending") continue; // already taken by a manual retry
      if (run.spentUsd + st.reserved >= run.config.budgetUsd) {
        cell.status = "skipped";
        cell.error = "budget reached";
      } else {
        const hold = cellEstimate(run.config, cell);
        st.reserved += hold;
        try {
          await runCell(run, cell, inputs.get(cell.inputId)!);
        } finally {
          st.reserved -= hold;
        }
      }
      await persist(run);
    }
  };
  await Promise.all(Array.from({ length: RUN_CONCURRENCY }, worker));
  run.status = run.cells.some((c) => c.status === "skipped") ? "stopped" : "done";
  await persist(run);
  release(run);
}

async function runCell(run: Run, cell: Cell, input: LabInput): Promise<void> {
  cell.status = "running";
  // Providers bill failed calls too: the meters see every billed call, so a
  // cell that throws part-way is still charged for what it spent.
  const armMeter = new CostMeter();
  let armReturned = false;
  let genCost = 0;
  let judgeCost = 0;
  try {
    const out = await runnerDeps.runArm(cell.arm, input, cell.modelId, run.config.forcedType, armMeter);
    armReturned = true;
    genCost = out.costUsd;
    cell.graph = out.graph;
    cell.mapType = out.graph?.mapType ?? null;
    cell.elements = out.elements;
    cell.edges = out.edges;
    cell.latencyMs = out.latencyMs;
    // A connector painted through an unrelated card hides its content: that map
    // is not ok, exactly like a structure violation, and is never offered for voting.
    const byId = new Map(out.elements.map((e) => [e.id, e]));
    const crossings = connectorCrossings(out.elements, out.edges).map((x) => {
      const through = byId.get(x.throughId);
      const text = through ? elementText(through) : "";
      return `connector crossing: ${x.by === "label" ? "a connector label" : "a connector"} paints over ` +
        `${through?.type ?? "an element"}${text ? ` "${text.slice(0, 60)}"` : ""}`;
    });
    cell.structureViolations = [...out.structureViolations, ...crossings];

    const v = checkLayout(out.elements, out.edges, { includeDesignSystemRules: true });
    cell.rubricErrors = v.filter((x) => x.severity === "error").map((x) => `[${x.rule}] ${x.message}`);
    cell.rubricWarnings = v.filter((x) => x.severity === "warn").map((x) => `[${x.rule}] ${x.message}`);

    cell.judges = [];
    for (const judgeId of run.config.judges) {
      const judge = JUDGES[judgeId];
      if (!judge.enabled) continue;
      const judgeMeter = new CostMeter();
      try {
        const score = await judge.judge({ input, cell, meter: judgeMeter });
        judgeCost += score.costUsd;
        cell.judges.push(score);
      } catch (e) {
        judgeCost += judgeMeter.costUsd;
        cell.judges.push({
          judgeId, overall: null, pass: false, scores: {},
          notes: `judge error: ${(e as Error).message.slice(0, 200)}`, costUsd: judgeMeter.costUsd,
        });
      }
    }

    const ok = out.elements.length > 0 && cell.structureViolations.length === 0 && cell.rubricErrors.length === 0;
    cell.status = ok ? "done" : "failed";
    cell.error = ok ? null : cell.structureViolations[0] ?? cell.rubricErrors[0] ?? "nothing was rendered";
  } catch (e) {
    if (!armReturned) genCost = armMeter.costUsd;
    cell.status = "error";
    cell.error = (e as Error).message.slice(0, 500);
  }
  cell.genCostUsd = genCost;
  cell.judgeCostUsd = judgeCost;
  cell.costUsd = genCost + judgeCost;
  run.spentUsd += cell.costUsd;
}

// Concurrent retries on a run that is not live must share one in-memory copy:
// two separate readRun copies would each save, and the last save would drop
// the other retry's result.
const loading = new Map<string, Promise<Run | null>>();

/** The run, registered live and held by one more retry (let go with release()). */
async function acquireForRetry(runId: string): Promise<Run | null> {
  let run = live.get(runId);
  if (!run) {
    let pending = loading.get(runId);
    if (!pending) {
      pending = getRun(runId).finally(() => loading.delete(runId));
      loading.set(runId, pending);
    }
    const loaded = await pending;
    if (!loaded) return null;
    // Another retry may have registered (or finished with and released) the
    // same object meanwhile; either way there is one copy to use.
    run = live.get(runId) ?? loaded;
    live.set(runId, run);
  }
  stateOf(run.id).retries++;
  return run;
}

/**
 * Re-run one cell. Refused (LabConflictError) for a cell that already
 * succeeded, since votes may refer to its map, and when the retry could take
 * the run over its budget. Returns null for an unknown run.
 */
export async function retryCell(runId: string, cellId: string): Promise<Run | null> {
  const run = await acquireForRetry(runId);
  if (!run) return null;
  const st = stateOf(run.id);
  try {
    const inputs = await getInputs();
    // From here to runCell (which marks the cell running) there is no await,
    // so two retries of the same cell cannot both pass these checks.
    const cell = run.cells.find((c) => c.id === cellId);
    // Orphaned "running" cells were reconciled to errors on load, so a running
    // cell here is genuinely in flight (the executor or another retry).
    if (!cell || cell.status === "running") return run;
    if (cell.status === "done") {
      throw new LabConflictError("This cell already succeeded. Retrying it would replace a map your votes may refer to.");
    }
    const estimate = cellEstimate(run.config, cell);
    if (run.spentUsd + st.reserved + estimate > run.config.budgetUsd) {
      const inFlight = st.reserved > 0 ? ` + $${st.reserved.toFixed(3)} in flight` : "";
      throw new LabConflictError(
        `Retry refused: $${run.spentUsd.toFixed(3)} spent${inFlight} + about $${estimate.toFixed(3)} for this cell ` +
        `would exceed the $${run.config.budgetUsd.toFixed(2)} budget.`,
      );
    }
    const input = inputs.find((i) => i.id === cell.inputId);
    if (!input) return run;
    Object.assign(cell, blankCell(run.id, cell.inputId, cell.arm, cell.modelId, run.config.forcedType), { id: cell.id });
    st.reserved += estimate;
    try {
      await runCell(run, cell, input);
    } finally {
      st.reserved -= estimate;
    }
    await persist(run);
    return run;
  } finally {
    st.retries--;
    release(run);
  }
}
