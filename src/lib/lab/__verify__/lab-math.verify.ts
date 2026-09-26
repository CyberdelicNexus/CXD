// Run: npx tsx src/lib/lab/__verify__/lab-math.verify.ts
import {
  ARM_TOKENS, buildLeaderboard, compareVersions, computeElo, estimateRunCost, expectedScore, judgeAgreement, pickPair, selfConsistency,
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

{
  // Spec §6: mean elementFit per variant, strong and cheap judges separately.
  const fit = (id: string, judgeId: "llmStrong" | "llmCheap", v: number): Cell =>
    ({ ...cell(id, "graphExemplars", "m9"), judges: [{ judgeId, overall: 3, pass: true, scores: { elementFit: v }, notes: "", costUsd: 0 }] });
  const lb = buildLeaderboard([fit("f1", "llmStrong", 4), fit("f2", "llmStrong", 2), fit("f3", "llmCheap", 5), cell("f4", "graph", "m9")], []);
  const row = lb.rows.find((r) => r.variant === "graphExemplars|m9")!;
  check("mean elementFit from the strong judge", near(row.elementFitStrong!, 3));
  check("mean elementFit from the cheap judge, separately", near(row.elementFitCheap!, 5));
  check("a variant nobody scored for fit reads null", lb.rows.find((r) => r.variant === "graph|m9")!.elementFitStrong === null);
}
{
  // Element usage: distinct kinds per map and share of plain cards, from the drawn elements.
  const el = (id: string, type: string, extra: object = {}) =>
    ({ id, type, x: 0, y: 0, width: 100, height: 100, zIndex: 1, locked: false, boardId: null, surface: "canvas", ...extra }) as unknown as Cell["elements"][number];
  const rich: Cell = { ...cell("u1", "graph", "m8"), elements: [el("a", "freeform", { cardType: "note" }), el("b", "table"), el("c", "freeform", { cardType: "task" }), el("d", "link")] };
  const plain: Cell = { ...cell("u2", "graph", "m8"), elements: [el("e", "freeform", { cardType: "note" }), el("f", "freeform", { cardType: "note" })] };
  const row = buildLeaderboard([rich, plain], []).rows.find((r) => r.variant === "graph|m8")!;
  check("kinds per map is the mean of distinct kinds (4 and 1)", near(row.kindsPerMap!, 2.5));
  check("plain card share is the mean share (0.25 and 1)", near(row.plainCardShare!, 0.625));
}

{
  // Old vs new prompt versions: same input, arm, model; different versions (spec §6).
  const v = (id: string, version: string, extra: Partial<Cell> = {}): Cell =>
    ({ ...cell(id, "graphExemplars", "m1"), promptVersion: version, ...extra });
  const o1 = v("o1", "old");
  const n1 = v("n1", "new");
  const n2 = { ...v("n2", "new"), arm: "graph" as const };
  check("versions mode pairs the same variant across versions", (() => {
    const p = pickPair([o1, n1, n2], [], () => 0.3, { versions: ["old", "new"] });
    return !!p && new Set([p.left.id, p.right.id]).size === 2 && [p.left.id, p.right.id].sort().join(",") === "n1,o1";
  })());
  check("versions mode never pairs two cells of one version", pickPair([n1, { ...n2, arm: "graphExemplars" as const, id: "n3" }], [], () => 0.3, { versions: ["old", "new"] }) === null);

  const fit = (c: Cell, strong: number, cheap: number): Cell => ({ ...c, judges: [
    { judgeId: "llmStrong", overall: 3, pass: true, scores: { elementFit: strong }, notes: "", costUsd: 0 },
    { judgeId: "llmCheap", overall: 3, pass: true, scores: { elementFit: cheap }, notes: "", costUsd: 0 },
  ] });
  const oldA = fit(v("oa", "old"), 2, 3);
  const newA = fit(v("na", "new"), 4, 4);
  const oldB = fit(v("ob", "old", { inputId: "i2" }), 3, 3);
  const newB = { ...v("nb", "new", { inputId: "i2" }), status: "failed" as const };
  const lonely = fit(v("nl", "new", { inputId: "i9" }), 5, 5); // no old counterpart: excluded
  const votes = [vote("na", "oa", "left"), vote("ob", "nb", "left")];
  const cmp = compareVersions([oldA, newA, oldB, newB, lonely], votes, "old", "new");
  check("only slots present in both versions count", cmp.old.cells === 2 && cmp.next.cells === 2);
  check("mean elementFit per version and judge", near(cmp.old.elementFitStrong!, 2.5) && near(cmp.next.elementFitStrong!, 4) && near(cmp.next.elementFitCheap!, 4));
  check("failure rate per version", cmp.old.failureRate === 0 && near(cmp.next.failureRate, 0.5));
  check("cross-version votes counted by version", cmp.votes.newWins === 1 && cmp.votes.oldWins === 1 && cmp.votes.ties === 0);
  check("verdict: fit rises, votes tie, failures rose, so not a success",
    cmp.verdict.elementFitRises === true && cmp.verdict.votesFavourNew === false && cmp.verdict.failureRateHolds === false && cmp.verdict.success === false);

  // A re-scored copy supersedes its original everywhere (Task 22 never rewrites the original run).
  const orig = fit(v("orig", "old"), 1, 1);
  const copy: Cell = { ...fit(v("copy", "old"), 3, 3), rescoredFrom: "orig" };
  const fresh = fit(v("fresh", "new"), 4, 4);
  const withCopy = compareVersions([orig, copy, fresh], [vote("orig", "fresh", "left"), vote("copy", "fresh", "right")], "old", "new");
  check("the copy stands in for its original in the comparison", withCopy.old.cells === 1 && near(withCopy.old.elementFitStrong!, 3));
  check("votes on a superseded original are ignored", withCopy.votes.newWins === 1 && withCopy.votes.oldWins === 0);
  check("versions mode never offers a superseded original", (() => {
    const p = pickPair([orig, copy, fresh], [], () => 0.3, { versions: ["old", "new"] });
    return !!p && [p.left.id, p.right.id].sort().join(",") === "copy,fresh";
  })());
  check("the leaderboard counts the copy, not both",
    buildLeaderboard([orig, copy], [], { promptVersion: "old" }).rows.find((r) => r.variant === "graphExemplars|m1")?.cells === 1);
}

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log("\nALL PASS");
