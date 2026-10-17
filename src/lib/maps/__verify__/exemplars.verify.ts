// Run: npx tsx src/lib/maps/__verify__/exemplars.verify.ts
// The example library is a hard contract (spec §4.3): every exemplar clears
// the library bar, its tags are the derived ones, and together the library
// covers every kind, relation value, tint (with a legend), map type, input
// type and named pairing.
import { CORPUS } from "@/lib/lab/corpus";
import { EXEMPLARS } from "../exemplars";
import { COVERAGE_MINIMUMS, coverageGaps, coverageOf } from "../exemplars/coverage";
import { deriveTags } from "../exemplars/derive";
import { faithfulnessProblems, numberTokens } from "../exemplars/faithful";
import { closestCorpusClash, jaccard, MAX_INPUT_SIMILARITY, tooClose, trigrams } from "../exemplars/similarity";
import type { Exemplar } from "../exemplars/types";
import { exemplarProblems } from "../exemplars/validate";
import { renderMap } from "../render";
import type { MapGraph } from "../types";

let failures = 0;
const check = (name: string, cond: boolean) => {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
};

check(`about twenty exemplars (${EXEMPLARS.length})`, EXEMPLARS.length >= 18);
const ids = EXEMPLARS.map((e) => e.id);
check("exemplar ids are unique", new Set(ids).size === ids.length);
check("exemplar ids are slugs", ids.every((id) => /^[a-z0-9-]+$/.test(id)));

for (const ex of EXEMPLARS) {
  const problems = exemplarProblems(ex.graph);
  check(`${ex.id}: passes structure, legend and render checks${problems.length ? `: ${problems.slice(0, 3).join("; ")}` : ""}`, problems.length === 0);
  check(`${ex.id}: note is one line`, !!ex.note.trim() && !ex.note.includes("\n") && ex.note.length <= 200);
  check(`${ex.id}: input has text`, !!ex.input.text.trim() && !!ex.input.title.trim());
  check(`${ex.id}: tags are the derived ones`,
    JSON.stringify(ex.tags) === JSON.stringify(deriveTags(ex.input, ex.graph, ex.tags.labels)));
  check(`${ex.id}: provenance is recorded`, ex.provenance.source === "authored" || ex.provenance.source === "promoted");
  const clash = closestCorpusClash(ex.input, CORPUS, ex.provenance.inputId);
  check(`${ex.id}: not too close to any corpus input${clash ? `: ${clash}` : ""}`, clash === null);
  const unfaithful = faithfulnessProblems(ex.input, ex.graph);
  check(`${ex.id}: every URL and number is in the input${unfaithful.length ? `: ${unfaithful.slice(0, 3).join("; ")}` : ""}`, unfaithful.length === 0);
  if (ex.input.type === "canvasCards") {
    const details = new Set(ex.graph.nodes.map((x) => x.detail));
    const urls = new Set(ex.graph.nodes.map((x) => String(JSON.parse(x.props || "{}").url ?? "")));
    // A card the map draws as a connector keeps its body as the relation label.
    const relLabels = new Set(ex.graph.relations.map((r) => r.label.trim().toLowerCase()));
    const dropped = ex.input.cards
      .filter((c) => c.body && !details.has(c.body) && !urls.has(c.body) && !relLabels.has(c.body.trim().toLowerCase()))
      .map((c) => c.title);
    check(`${ex.id}: every card body is kept as a detail (or a link's url, or a connector's label)${dropped.length ? `; dropped: ${dropped.join(", ")}` : ""}`, dropped.length === 0);
  }
  // A relation that labels a hierarchy edge must not become a second connector.
  const pairs = renderMap(ex.graph).edges.map((e) => [e.fromNodeId, e.toNodeId].sort().join("|"));
  check(`${ex.id}: no connector is drawn twice`, new Set(pairs).size === pairs.length);
}

// Emphasis is not always "the hub": some exemplar marks two strong nodes, and
// some exemplar's strong node is not a hub (a recommended option, a peak moment).
const HUB_ROLES: readonly string[] = ["center", "root", "whole", "event", "leftTopic", "rightTopic"];
check("some exemplar has two strong nodes", EXEMPLARS.some((e) => e.graph.nodes.filter((x) => x.emphasis === "strong").length >= 2));
check("some exemplar's strong node is not a hub", EXEMPLARS.some((e) => e.graph.nodes.some((x) => x.emphasis === "strong" && !HUB_ROLES.includes(x.role))));

// Faithfulness rule self-tests (faithful.ts).
{
  const g = (label: string, extra: Partial<MapGraph["nodes"][number]> = {}): MapGraph => ({
    mapType: "radial", title: "T", legend: [], relations: [],
    nodes: [{ id: "c", label, detail: "", role: "center", kind: "card", parent: "", props: "{}", tint: "none", emphasis: "normal", ...extra }],
  });
  const inp = (text: string, cards: { title: string; body: string }[] = []) => ({ title: "In", text, cards });
  check("faithful: a number from the input passes, with currency and percent", faithfulnessProblems(inp("costs 4,200 and 15% off"), g("€4200 at 15%")).length === 0);
  check("faithful: an invented number fails", faithfulnessProblems(inp("about twenty guests"), g("18 guests")).length === 1);
  check("faithful: decimals must match exactly", faithfulnessProblems(inp("18 a visit"), g("18.00 a visit")).length === 1);
  check("faithful: numbers in detail, legend and relation labels are checked", faithfulnessProblems(inp("x"),
    { ...g("A", { detail: "9:30" }), legend: [{ tint: "rose", meaning: "Top 3" }], relations: [{ from: "c", to: "c", label: "in 2 days", style: "solid", weight: "normal", direction: "forward" }] }).length === 4);
  check("faithful: table cells are checked", faithfulnessProblems(inp("7 days"),
    g("T", { kind: "table", props: JSON.stringify({ cells: [["Tier", "Window"], ["A", "7 days"], ["B", "14 days"]], headerRow: true }) })).length === 1);
  check("faithful: header-row ordinals 1 to 10 are allowed", faithfulnessProblems(inp("compare them"),
    g("T", { kind: "table", props: JSON.stringify({ cells: [["Option 1", "Option 2"], ["a", "b"]], headerRow: true }) })).length === 0);
  check("faithful: the same ordinal in a body row is not", faithfulnessProblems(inp("compare them"),
    g("T", { kind: "table", props: JSON.stringify({ cells: [["A", "B"], ["Option 1", "b"]], headerRow: true }) })).length === 1);
  check("faithful: a bare header ordinal is allowed", faithfulnessProblems(inp("compare them"),
    g("T", { kind: "table", props: JSON.stringify({ cells: [["1", "2"], ["a", "b"]], headerRow: true }) })).length === 0);
  check("faithful: a header cell that merely contains a number is not exempt (\"Fits 8\")", faithfulnessProblems(inp("compare them"),
    g("T", { kind: "table", props: JSON.stringify({ cells: [["Fits 8", "Other"], ["a", "b"]], headerRow: true }) })).length === 1);
  check("faithful: a header cell that merely contains a number is not exempt (\"8 visits\")", faithfulnessProblems(inp("compare them"),
    g("T", { kind: "table", props: JSON.stringify({ cells: [["8 visits", "Other"], ["a", "b"]], headerRow: true }) })).length === 1);
  check("faithful: a number inside a word from the input is allowed", faithfulnessProblems(inp("the Q3 launch"), g("Q3 launch")).length === 0);
  check("faithful: a number inside a new word is not", faithfulnessProblems(inp("the launch"), g("Q3 launch")).length === 1);
  check("faithful: emoji and other decoration props are not read", faithfulnessProblems(inp("x"), g("A", { props: JSON.stringify({ emoji: "1️⃣" }) })).length === 0);
  check("faithful: a URL must be in the input verbatim", faithfulnessProblems(inp("see ons.gov.uk"),
    g("A", { kind: "link", props: JSON.stringify({ url: "https://www.ons.gov.uk/wellbeing" }) })).length === 1);
  check("faithful: a URL given in a card passes, and its digits do not count as numbers", faithfulnessProblems(inp("x", [{ title: "Src", body: "https://example.org/2024/report" }]),
    g("A", { kind: "link", props: JSON.stringify({ url: "https://example.org/2024/report" }) })).length === 0);
  check("faithful: a deeper path than the one given fails", faithfulnessProblems(inp("https://www.apa.org"),
    g("A", { kind: "link", props: JSON.stringify({ url: "https://www.apa.org/topics/social-support" }) })).length === 1);
  check("faithful: number tokens keep separators and skip URLs", numberTokens("4,200 and 12.25 at https://a.b/9").join("|") === "4,200|12.25");
}

// The similarity rule itself.
check("threshold is 0.3", MAX_INPUT_SIMILARITY === 0.3);
check("3-grams ignore case and punctuation", trigrams("Group these, sensory IDEAS!").has("group these sensory") && trigrams("a b").size === 0);
check("Jaccard of identical texts is 1, of disjoint texts 0",
  jaccard(trigrams("one two three four"), trigrams("one two three four")) === 1 && jaccard(trigrams("one two three"), trigrams("four five six")) === 0);
check("a near copy of a corpus input is too close", tooClose({ title: "x", text: `${CORPUS[0].text} Thanks!` }, CORPUS[0]) !== null);
check("a matching title is too close whatever the text", tooClose({ title: ` ${CORPUS[1].title.toUpperCase()}!`, text: "unrelated words entirely here" }, CORPUS[1]) !== null);
check("an unrelated input is not too close", tooClose({ title: "Tide pools", text: "What lives in a rock pool at low tide?" }, CORPUS[0]) === null);
check("the source input is exempt for a promoted example",
  closestCorpusClash(CORPUS[0], CORPUS, CORPUS[0].id) === null && closestCorpusClash(CORPUS[0], CORPUS) !== null);

const gaps = coverageGaps(EXEMPLARS);
check(`coverage: every requirement met${gaps.length ? `; gaps: ${gaps.join("; ")}` : ""}`, gaps.length === 0);
for (const item of coverageOf(EXEMPLARS)) console.log(`       ${item.label}: ${item.count} (min ${item.min})`);

// The check itself must bite: take away every dotted relation and every portal.
const without = (pred: (e: Exemplar) => Exemplar): Exemplar[] => EXEMPLARS.map(pred);
const noDotted = without((e) => ({ ...e, graph: { ...e.graph, relations: e.graph.relations.map((r) => (r.style === "dotted" ? { ...r, style: "solid" as const } : r)) } }));
check("removing every dotted relation is reported as a gap", coverageGaps(noDotted).some((g) => g.startsWith("dotted relation")));
const noPortal = EXEMPLARS.map((e) => ({ ...e, tags: { ...e.tags, kinds: e.tags.kinds.filter((k) => k !== "portal") } }));
check("removing every portal is reported as a gap", coverageGaps(noPortal).some((g) => g.startsWith("portal node")));
check("minimums are the spec's", COVERAGE_MINIMUMS.kind === 2 && COVERAGE_MINIMUMS.mapType === 2 && COVERAGE_MINIMUMS.inputType === 4 &&
  COVERAGE_MINIMUMS.pairing === 1 && COVERAGE_MINIMUMS.tint === 1 && COVERAGE_MINIMUMS.style === 1);

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log("\nALL PASS");
