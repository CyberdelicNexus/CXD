// Run: npx tsx src/lib/lab/__verify__/store.verify.ts
// Works in a throwaway temp dir (chdir), so no lab-data/ junk is left behind.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Run, Vote } from "../types";

let failures = 0;
const check = (name: string, cond: boolean) => {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
};

const run = (id: string, n: number, createdAt = "2026-09-24T00:00:00.000Z"): Run => ({
  id, createdAt, estimateUsd: 1, spentUsd: n, status: "running", cells: [],
  config: { inputIds: [], arms: [], modelIds: [], forcedType: null, judges: [], budgetUsd: 10 },
});
const vote = (id: string): Vote => ({
  id, createdAt: "2026-09-24T00:00:00.000Z", inputId: "i", leftCellId: "a", rightCellId: "b", winner: "left", reason: "", repeat: false,
});

async function main() {
  const store = await import("../store");
  const originalCwd = process.cwd();
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "lab-store-"));
  process.chdir(tmp);
  try {
    const runsDir = path.join(tmp, "lab-data", "runs");

    // Serialised writes: the last save wins, the file always parses.
    await Promise.all(Array.from({ length: 20 }, (_, i) => store.saveRun(run("run-a", i))));
    const a = await store.readRun("run-a");
    check("concurrent saves leave the last version", a?.spentUsd === 19);
    check("no tmp files left behind", (await fs.readdir(runsDir)).every((f) => !f.endsWith(".tmp")));

    // A crash mid-write leaves only a stray tmp file; the stored run is untouched.
    await fs.writeFile(path.join(runsDir, "run-a.json.123.456.tmp"), '{"id":"run-a","spe', "utf8");
    check("stray tmp does not affect readRun", (await store.readRun("run-a"))?.spentUsd === 19);
    await store.saveRun(run("run-b", 1, "2026-09-25T00:00:00.000Z"));
    const list = await store.listRuns();
    check("listRuns ignores tmp files and sorts newest first", list.map((r) => r.id).join(",") === "run-b,run-a");

    // M8: a failed write rejects (never silently "succeeds") and does not block later writes.
    await fs.mkdir(path.join(runsDir, "run-blocked.json"), { recursive: true });
    const failed = await store.saveRun(run("run-blocked", 1)).then(() => null, (e: Error) => e);
    check("a failed save rejects", failed instanceof Error);
    await store.saveRun(run("run-after", 2));
    check("writes after a failed one still land", (await store.readRun("run-after"))?.spentUsd === 2);
    await fs.rm(path.join(runsDir, "run-blocked.json"), { recursive: true, force: true });
    const queued = await Promise.allSettled([store.saveRun(run("run-q", 1)), store.saveRun(run("run-q", 2))]);
    check("queued saves after recovery resolve", queued.every((r) => r.status === "fulfilled") && (await store.readRun("run-q"))?.spentUsd === 2);

    check("readRun rejects path-like ids", (await store.readRun("../x")) === null);
    check("readRun of missing run is null", (await store.readRun("nope")) === null);

    const s = store.summarise({ ...run("run-c", 0.5), cells: [{ status: "done" }, { status: "failed" }] as Run["cells"] });
    check("summarise counts cells", s.cellCount === 2 && s.doneCount === 1 && s.spentUsd === 0.5);

    // Votes: a torn trailing line (crash mid-append) must not lose earlier votes.
    await store.appendVote(vote("v1"));
    await store.appendVote(vote("v2"));
    await fs.appendFile(path.join(tmp, "lab-data", "votes.jsonl"), '{"id":"v3","crea', "utf8");
    const votes = await store.readVotes();
    check("torn vote line is skipped, earlier votes kept", votes.map((v) => v.id).join(",") === "v1,v2");
    await store.appendVote(vote("v4"));
    check("appending after a torn line still yields later votes", (await store.readVotes()).some((v) => v.id === "v4"));

    // Custom inputs: upsert by id.
    const input = { id: "c1", type: "topic" as const, title: "T", text: "x", cards: [], expectedTypes: [], custom: true };
    await store.saveCustomInput(input);
    await store.saveCustomInput({ ...input, title: "T2" });
    await store.saveCustomInput({ ...input, id: "c2" });
    const inputs = await store.readCustomInputs();
    check("custom inputs upsert by id", inputs.length === 2 && inputs.find((i) => i.id === "c1")?.title === "T2");
  } finally {
    process.chdir(originalCwd);
    await fs.rm(tmp, { recursive: true, force: true });
  }

  if (failures) { console.error(`${failures} FAILED`); process.exit(1); }
  console.log("ALL PASS");
}
main();
