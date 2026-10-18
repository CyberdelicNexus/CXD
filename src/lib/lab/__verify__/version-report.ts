// Offline report of the spec §6 success criterion from what lab-data holds.
// Run: npx tsx src/lib/lab/__verify__/version-report.ts <oldVersion> [newVersion]
// newVersion defaults to the current PROMPT_VERSION.
async function main() {
  const oldVersion = process.argv[2];
  if (!oldVersion) { console.error("usage: version-report.ts <oldVersion> [newVersion]"); process.exit(2); }
  const { PROMPT_VERSION } = await import("../prompts");
  const newVersion = process.argv[3] ?? PROMPT_VERSION;
  const { allCells, readVotes } = await import("../store");
  const { compareVersions } = await import("../lab-math");
  const r = compareVersions(await allCells(), await readVotes(), oldVersion, newVersion);
  const f = (x: number | null, d = 2) => (x === null ? "-" : x.toFixed(d));
  const row = (label: string, s: typeof r.old) =>
    console.log(`${label.padEnd(5)} ${s.version}  cells ${String(s.cells).padStart(3)}  failures ${f(s.failureRate)}  ` +
      `fit strong ${f(s.elementFitStrong)}  fit cheap ${f(s.elementFitCheap)}  kinds/map ${f(s.kindsPerMap, 1)}  plain cards ${f(s.plainCardShare)}`);
  row("old", r.old);
  row("new", r.next);
  console.log(`votes: new ${r.votes.newWins}, old ${r.votes.oldWins}, ties ${r.votes.ties}`);
  const yn = (b: boolean | null) => (b === null ? "not yet measurable" : b ? "yes" : "no");
  console.log(`elementFit rises: ${yn(r.verdict.elementFitRises)}`);
  console.log(`blind votes favour new: ${yn(r.verdict.votesFavourNew)}`);
  console.log(`failure rate does not rise: ${yn(r.verdict.failureRateHolds)}`);
  console.log(r.verdict.success ? "SUCCESS: all three criteria hold" : "NOT YET: at least one criterion does not hold");
}
main().catch((e) => { console.error(e); process.exit(1); });
