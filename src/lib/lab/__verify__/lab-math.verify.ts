// Run: npx tsx src/lib/lab/__verify__/lab-math.verify.ts
import {
  buildLeaderboard, computeElo, estimateRunCost, expectedScore, judgeAgreement, pickPair, selfConsistency,
} from "../lab-math";
import type { Cell, Vote } from "../types";

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

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log("\nALL PASS");
