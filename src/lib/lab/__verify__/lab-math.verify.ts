// Run: npx tsx src/lib/lab/__verify__/lab-math.verify.ts
import {
  ARM_TOKENS, buildLeaderboard, computeElo, estimateRunCost, expectedScore, judgeAgreement, pickPair, selfConsistency,
} from "../lab-math";
import { JUDGE_MODELS } from "../config";
import { CORPUS } from "../corpus";
import { exemplarBlock } from "../prompts";
import { buildMapGuide } from "@/lib/maps/prompt";
import { parseVariantKey, type Cell, type Vote } from "../types";

let failures = 0;
const check = (name: string, cond: boolean) => {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
};
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

const cell = (id: string, arm: Cell["arm"], modelId: string, judgeOverall: number | null = null, inputId = "i1"): Cell => ({
  id, runId: "r", inputId, arm, modelId, status: "done", mapType: "radial", graph: null,
  elements: [{ id: `${id}-el` } as Cell["elements"][number]], edges: [],
  structureViolations: [], rubricErrors: [], rubricWarnings: [],
  judges: judgeOverall === null ? [] : [{ judgeId: "llmCheap", overall: judgeOverall, pass: true, scores: {}, notes: "", costUsd: 0 }],
  latencyMs: 0, costUsd: 0.01, error: null,
});
let t = 0;
const vote = (left: string, right: string, winner: Vote["winner"]): Vote =>
  ({ id: `v${t}`, createdAt: new Date(1_700_000_000_000 + t++ * 1000).toISOString(), inputId: "i1", leftCellId: left, rightCellId: right, winner, reason: "", repeat: false });

check("equal ratings expect 0.5", near(expectedScore(1000, 1000), 0.5));

const a = cell("a", "graph", "m1", 4);
const b = cell("b", "baseline", "m1", 2);
const byId = new Map([a, b].map((c) => [c.id, c]));

{
  const elo = computeElo([vote("a", "b", "left")], byId);
  check("winner gains 16 at K=32 from equal ratings", near(elo.get("graph|m1")!.rating, 1016));
  check("loser drops 16", near(elo.get("baseline|m1")!.rating, 984));
  check("wins counted", elo.get("graph|m1")!.wins === 1 && elo.get("baseline|m1")!.wins === 0);
}
{
  const elo = computeElo([vote("a", "b", "tie")], byId);
  check("tie between equals leaves ratings unchanged", near(elo.get("graph|m1")!.rating, 1000));
}
{
  const ag = judgeAgreement([vote("a", "b", "left"), vote("b", "a", "left")], byId, "llmCheap");
  check("judge agrees on one vote, disagrees on the other → 0.5", ag.agreement !== null && near(ag.agreement, 0.5) && ag.compared === 2);
  const none = judgeAgreement([vote("a", "b", "left")], byId, "llmStrong");
  check("judge without scores has null agreement", none.agreement === null && none.compared === 0);
}
{
  const same = selfConsistency([vote("a", "b", "left"), vote("b", "a", "right")]);
  check("same winner on a repeat with swapped sides is consistent", same.consistency === 1 && same.pairs === 1);
  const flip = selfConsistency([vote("a", "b", "left"), vote("a", "b", "right")]);
  check("different winner on a repeat is inconsistent", flip.consistency === 0);
  check("no repeats → null consistency", selfConsistency([vote("a", "b", "left")]).consistency === null);
}
{
  const cost = estimateRunCost({ inputIds: ["x"], arms: ["graph"], modelIds: ["claude-sonnet-5"], forcedType: null, judges: [], budgetUsd: 5 });
  // graph arm assumption: 4000 in, 3000 out at $2 / $10 per MTok
  check("cost estimate matches the token assumption", near(cost, (4000 * 2 + 3000 * 10) / 1_000_000));
}
{
  check("no pair when every cell is the same variant", pickPair([cell("x", "graph", "m1"), cell("y", "graph", "m1")], [], () => 0.3) === null);
  const p = pickPair([a, b], [], () => 0.3);
  check("pairs two different variants for the same input", !!p && new Set([p.left.id, p.right.id]).size === 2 && !p.repeat);
  check("cells from different inputs are never paired", pickPair([a, cell("z", "graph", "m2", null, "i2")], [], () => 0.3) === null);
  check("fully judged pool returns null outside the repeat path", pickPair([a, b], [vote("a", "b", "left")], () => 0.99) === null);
}
{
  const lb = buildLeaderboard([a, b], [vote("a", "b", "left")]);
  check("leaderboard ranks the winner first", lb.rows[0].variant === "graph|m1");
  check("leaderboard reports judge agreement", lb.judges.some((j) => j.judgeId === "llmCheap" && j.agreement === 1));
}

{
  // I5: cost per win counts generation only; old cells without the split read as all generation.
  const split: Cell = { ...cell("s", "graph", "m1"), costUsd: 0.05, genCostUsd: 0.03, judgeCostUsd: 0.02 };
  const legacy: Cell = { ...cell("l", "baseline", "m1"), costUsd: 0.04 };
  const lb = buildLeaderboard([split, legacy], [vote("s", "l", "left"), vote("l", "s", "left")]);
  const g = lb.rows.find((r) => r.variant === "graph|m1")!;
  const bl = lb.rows.find((r) => r.variant === "baseline|m1")!;
  check("cost per win uses generation cost only", near(g.costPerWin!, 0.03) && near(g.genCostUsd, 0.03) && near(g.judgeCostUsd, 0.02));
  check("total cost still includes judges", near(g.costUsd, 0.05));
  check("legacy cell: generation = costUsd, judge = 0", near(bl.genCostUsd, 0.04) && bl.judgeCostUsd === 0 && near(bl.costPerWin!, 0.04));
}

{
  // M2: only clean maps are votable, including legacy done cells whose rubric flagged crossings.
  const crossedLegacy: Cell = { ...cell("x1", "graph", "m2"), judges: [{ judgeId: "rubric", overall: 3, pass: false, scores: {}, notes: "1 connector crossing(s)", costUsd: 0 }] };
  check("legacy done cell with a failing rubric (crossings) is not paired", pickPair([a, crossedLegacy], [], () => 0.3) === null);
  const violated: Cell = { ...cell("x2", "graph", "m2"), structureViolations: ["connector crossing: ..."] };
  check("cell with structure violations is not paired", pickPair([a, violated], [], () => 0.3) === null);
  const passing: Cell = { ...cell("x3", "graph", "m2"), judges: [{ judgeId: "rubric", overall: 5, pass: true, scores: {}, notes: "", costUsd: 0 }] };
  check("cell with a passing rubric is paired", pickPair([a, passing], [], () => 0.3) !== null);
}
{
  // I6: prompt versions and forced types.
  const cur = (id: string, arm: Cell["arm"], extra: Partial<Cell> = {}): Cell => ({ ...cell(id, arm, "m1"), promptVersion: "v2", ...extra });
  const n1 = cur("n1", "graph");
  const n2 = cur("n2", "baseline");
  const old1 = { ...cell("o1", "graph", "m1"), promptVersion: "v1" };
  const legacy1 = cell("g1", "baseline", "m1"); // no promptVersion: legacy
  const forced = cur("f1", "graph", { forcedType: "tree" });
  const votes = [vote("n1", "n2", "left"), vote("o1", "g1", "right"), vote("n1", "o1", "left"), vote("f1", "n2", "left")];
  const all = [n1, n2, old1, legacy1, forced];

  const def = buildLeaderboard(all, votes, { promptVersion: "v2" });
  check("default leaderboard counts only current-version votes", def.totalVotes === 2 && def.excludedVotes === 2);
  check("legacy and old-version cells are excluded by default", def.excludedCells === 2 && def.promptVersion === "v2");
  const forcedRow = def.rows.find((r) => r.forcedType === "tree");
  check("forced-type cells form their own variant", !!forcedRow && forcedRow.variant === "graph|m1|forced:tree" && forcedRow.wins === 1);
  check("unforced variant is separate from the forced one", def.rows.find((r) => r.variant === "graph|m1")?.wins === 1);
  check("variant key round-trips", parseVariantKey("graph|m1|forced:tree").forcedType === "tree" && parseVariantKey("graph|m1").forcedType === null);

  const everything = buildLeaderboard(all, votes);
  check("all versions: every vote counts", everything.totalVotes === 4 && everything.excludedCells === 0 && everything.promptVersion === null);

  check("pickPair with a version only pairs cells of that version",
    pickPair([n1, old1, legacy1], [], () => 0.3, { promptVersion: "v2" }) === null &&
    pickPair([n1, n2, old1], [], () => 0.3, { promptVersion: "v2" }) !== null);
  check("pickPair pairs forced and unforced cells as different variants", pickPair([n1, forced], [], () => 0.3) !== null);
}
{
  // M10: agreement excluding the judge's own model.
  const strong = JUDGE_MODELS.strong;
  const sj = (id: string, modelId: string, overall: number): Cell =>
    ({ ...cell(id, "graph", modelId), arm: modelId === strong ? "graph" : "baseline", judges: [{ judgeId: "llmStrong", overall, pass: true, scores: {}, notes: "", costUsd: 0 }] });
  const own = sj("own", strong, 5);
  const other1 = sj("o-1", "m-x", 1);
  const other2 = { ...sj("o-2", "m-y", 2), arm: "graphCritique" as const };
  const votes = [vote("own", "o-1", "right"), vote("o-2", "o-1", "left")];
  const lb = buildLeaderboard([own, other1, other2], votes);
  const row = lb.judges.find((j) => j.judgeId === "llmStrong")!;
  check("agreement counts every vote", row.compared === 2 && near(row.agreement!, 0.5));
  check("excl. own model skips votes involving the judge's model", row.comparedExSelf === 1 && near(row.agreementExSelf!, 1));
  const rubricRow = lb.judges.find((j) => j.judgeId === "rubric")!;
  check("non-LLM judges have identical excl. figures", rubricRow.comparedExSelf === rubricRow.compared);
}

{
  // The graphExemplars token estimate (item C) must honestly cover the real
  // block size across the corpus, chars/4, with margin, not a stale guess.
  const guideChars = buildMapGuide(null).length;
  const chars = CORPUS.map((c) => guideChars + exemplarBlock(c, null).length + `Organise this into the clearest thinking map for the canvas.\n\n${c.text}`.length);
  const maxTokens = Math.max(...chars) / 4;
  const avgTokens = chars.reduce((a, b) => a + b, 0) / chars.length / 4;
  console.log(`       graphExemplars real system+task tokens (chars/4): avg ${Math.round(avgTokens)}, max ${Math.round(maxTokens)}; estimate ${ARM_TOKENS.graphExemplars.input}`);
  check(`graphExemplars.input (${ARM_TOKENS.graphExemplars.input}) covers the measured max (${Math.round(maxTokens)}) with margin`,
    ARM_TOKENS.graphExemplars.input >= maxTokens && ARM_TOKENS.graphExemplars.input <= maxTokens * 1.5);
  check("graphExemplars.input is well below the old ~8.8k-token estimate", ARM_TOKENS.graphExemplars.input < 8800 / 2);
}

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log("\nALL PASS");
