// Pure maths for the lab: no I/O, no SDK imports (safe in client components).
import { costOf, getLabModel, JUDGE_MODELS } from "./config";
import type { ArmId, Cell, JudgeId, RunConfig, Vote } from "./types";
import { cellCosts, JUDGE_IDS, variantKey } from "./types";

export const ELO_START = 1000;
export const ELO_K = 32;

export function expectedScore(ra: number, rb: number): number {
  return 1 / (1 + 10 ** ((rb - ra) / 400));
}

export interface EloEntry { rating: number; games: number; wins: number; ties: number }

const byTime = (votes: Vote[]) => [...votes].sort((x, y) => x.createdAt.localeCompare(y.createdAt));

export function computeElo(votes: Vote[], cellsById: Map<string, Cell>, k = ELO_K): Map<string, EloEntry> {
  const table = new Map<string, EloEntry>();
  const entry = (key: string) => {
    let e = table.get(key);
    if (!e) { e = { rating: ELO_START, games: 0, wins: 0, ties: 0 }; table.set(key, e); }
    return e;
  };
  for (const v of byTime(votes)) {
    const left = cellsById.get(v.leftCellId);
    const right = cellsById.get(v.rightCellId);
    if (!left || !right) continue;
    const kl = variantKey(left);
    const kr = variantKey(right);
    if (kl === kr) continue;
    const a = entry(kl);
    const b = entry(kr);
    const sa = v.winner === "left" ? 1 : v.winner === "right" ? 0 : 0.5;
    const ea = expectedScore(a.rating, b.rating);
    a.rating += k * (sa - ea);
    b.rating += k * ((1 - sa) - (1 - ea));
    a.games++;
    b.games++;
    if (sa === 1) a.wins++;
    if (sa === 0) b.wins++;
    if (sa === 0.5) { a.ties++; b.ties++; }
  }
  return table;
}

/** Share of non-tie votes where the judge preferred the variant the user preferred (judge ties count ½). */
export function judgeAgreement(votes: Vote[], cellsById: Map<string, Cell>, judgeId: JudgeId): { agreement: number | null; compared: number } {
  let score = 0;
  let compared = 0;
  for (const v of votes) {
    if (v.winner === "tie") continue;
    const jl = cellsById.get(v.leftCellId)?.judges.find((j) => j.judgeId === judgeId)?.overall;
    const jr = cellsById.get(v.rightCellId)?.judges.find((j) => j.judgeId === judgeId)?.overall;
    if (jl == null || jr == null) continue;
    compared++;
    if (jl === jr) score += 0.5;
    else if ((jl > jr) === (v.winner === "left")) score += 1;
  }
  return { agreement: compared ? score / compared : null, compared };
}

const pairKey = (x: string, y: string) => [x, y].sort().join("|");

/** How often the user picks the same winner when a pair is shown again. The ceiling for any judge. */
export function selfConsistency(votes: Vote[]): { consistency: number | null; pairs: number } {
  const groups = new Map<string, string[]>();
  for (const v of votes) {
    const winner = v.winner === "tie" ? "tie" : v.winner === "left" ? v.leftCellId : v.rightCellId;
    const key = pairKey(v.leftCellId, v.rightCellId);
    groups.set(key, [...(groups.get(key) || []), winner]);
  }
  const repeated = Array.from(groups.values()).filter((w) => w.length >= 2);
  if (repeated.length === 0) return { consistency: null, pairs: 0 };
  const consistent = repeated.filter((w) => w.every((x) => x === w[0])).length;
  return { consistency: consistent / repeated.length, pairs: repeated.length };
}

/** Token assumptions per arm, used only for the pre-run estimate. Actual cost is measured. */
export const ARM_TOKENS: Record<ArmId, { input: number; output: number }> = {
  baseline: { input: 6000, output: 4000 },
  graph: { input: 4000, output: 3000 },
  graphCritique: { input: 10000, output: 6000 },
  graphExemplars: { input: 6500, output: 3000 },
};
const JUDGE_TOKENS = { input: 3500, output: 600 };

export function estimateRunCost(config: RunConfig): number {
  const perArmModel = config.inputIds.length;
  let total = 0;
  for (const modelId of config.modelIds) {
    const model = getLabModel(modelId);
    for (const arm of config.arms) total += perArmModel * costOf(model, ARM_TOKENS[arm].input, ARM_TOKENS[arm].output);
  }
  const cells = config.inputIds.length * config.arms.length * config.modelIds.length;
  if (config.judges.includes("llmStrong")) total += cells * costOf(getLabModel(JUDGE_MODELS.strong), JUDGE_TOKENS.input, JUDGE_TOKENS.output);
  if (config.judges.includes("llmCheap")) total += cells * costOf(getLabModel(JUDGE_MODELS.cheap), JUDGE_TOKENS.input, JUDGE_TOKENS.output);
  return total;
}

export interface PairPick { left: Cell; right: Cell; repeat: boolean }

/**
 * Next pair to judge: two successfully rendered cells for the same input from
 * different variants, never shown before. About 10% of the time (once 10+ votes
 * exist) a judged pair is re-shown with sides swapped, to measure self-consistency.
 */
export function pickPair(cells: Cell[], votes: Vote[], rng: () => number = Math.random): PairPick | null {
  const eligible = cells.filter((c) => c.status === "done" && c.elements.length > 0);
  const byInput = new Map<string, Cell[]>();
  for (const c of eligible) byInput.set(c.inputId, [...(byInput.get(c.inputId) || []), c]);

  const seen = new Set(votes.map((v) => pairKey(v.leftCellId, v.rightCellId)));
  const candidates: [Cell, Cell][] = [];
  Array.from(byInput.values()).forEach((group) => {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (variantKey(group[i]) !== variantKey(group[j])) candidates.push([group[i], group[j]]);
      }
    }
  });
  if (candidates.length === 0) return null;

  const orient = ([x, y]: [Cell, Cell], repeat: boolean): PairPick =>
    rng() < 0.5 ? { left: x, right: y, repeat } : { left: y, right: x, repeat };

  const judged = candidates.filter(([x, y]) => seen.has(pairKey(x.id, y.id)));
  if (votes.length >= 10 && judged.length > 0 && rng() < 0.1) {
    return orient(judged[Math.floor(rng() * judged.length)], true);
  }
  const fresh = candidates.filter(([x, y]) => !seen.has(pairKey(x.id, y.id)));
  if (fresh.length === 0) return null;
  return orient(fresh[Math.floor(rng() * fresh.length)], false);
}

export interface LeaderboardRow {
  variant: string;
  arm: string;
  modelId: string;
  rating: number;
  games: number;
  wins: number;
  ties: number;
  cells: number;
  failures: number;
  failureRate: number;
  /** Generation + judges. */
  costUsd: number;
  genCostUsd: number;
  judgeCostUsd: number;
  /** Generation cost per win: what the variant costs to produce, not to grade. */
  costPerWin: number | null;
}

export interface Leaderboard {
  rows: LeaderboardRow[];
  byMapType: { mapType: string; variant: string; wins: number; games: number }[];
  judges: { judgeId: JudgeId; agreement: number | null; compared: number }[];
  selfConsistency: number | null;
  repeatedPairs: number;
  totalVotes: number;
}

export function buildLeaderboard(cells: Cell[], votes: Vote[]): Leaderboard {
  const cellsById = new Map(cells.map((c) => [c.id, c]));
  const elo = computeElo(votes, cellsById);

  const perVariant = new Map<string, { cells: number; failures: number; gen: number; judge: number; arm: string; modelId: string }>();
  for (const c of cells) {
    if (c.status === "pending" || c.status === "running" || c.status === "skipped") continue;
    const key = variantKey(c);
    const e = perVariant.get(key) || { cells: 0, failures: 0, gen: 0, judge: 0, arm: c.arm, modelId: c.modelId };
    e.cells++;
    if (c.status === "failed" || c.status === "error") e.failures++;
    const cost = cellCosts(c);
    e.gen += cost.gen;
    e.judge += cost.judge;
    perVariant.set(key, e);
  }

  const rows: LeaderboardRow[] = Array.from(perVariant.entries()).map(([variant, v]) => {
    const r = elo.get(variant) || { rating: ELO_START, games: 0, wins: 0, ties: 0 };
    return {
      variant, arm: v.arm, modelId: v.modelId,
      rating: Math.round(r.rating), games: r.games, wins: r.wins, ties: r.ties,
      cells: v.cells, failures: v.failures, failureRate: v.cells ? v.failures / v.cells : 0,
      costUsd: v.gen + v.judge, genCostUsd: v.gen, judgeCostUsd: v.judge,
      costPerWin: r.wins ? v.gen / r.wins : null,
    };
  }).sort((x, y) => y.rating - x.rating || y.wins - x.wins);

  const typeTable = new Map<string, { mapType: string; variant: string; wins: number; games: number }>();
  for (const v of votes) {
    for (const [id, won] of [[v.leftCellId, v.winner === "left"], [v.rightCellId, v.winner === "right"]] as const) {
      const c = cellsById.get(id);
      if (!c?.mapType) continue;
      const key = `${c.mapType}|${variantKey(c)}`;
      const e = typeTable.get(key) || { mapType: c.mapType, variant: variantKey(c), wins: 0, games: 0 };
      e.games++;
      if (won) e.wins++;
      typeTable.set(key, e);
    }
  }

  const sc = selfConsistency(votes);
  return {
    rows,
    byMapType: Array.from(typeTable.values()).sort((x, y) => x.mapType.localeCompare(y.mapType) || y.wins - x.wins),
    judges: JUDGE_IDS.map((judgeId) => ({ judgeId, ...judgeAgreement(votes, cellsById, judgeId) })),
    selfConsistency: sc.consistency,
    repeatedPairs: sc.pairs,
    totalVotes: votes.length,
  };
}
