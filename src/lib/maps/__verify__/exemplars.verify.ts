// Run: npx tsx src/lib/maps/__verify__/exemplars.verify.ts
// The example library is a hard contract (spec §4.3): every exemplar clears
// the library bar, its tags are the derived ones, and together the library
// covers every kind, relation value, tint (with a legend), map type, input
// type and named pairing.
import { CORPUS } from "@/lib/lab/corpus";
import { EXEMPLARS } from "../exemplars";
import { COVERAGE_MINIMUMS, coverageGaps, coverageOf } from "../exemplars/coverage";
import { deriveTags } from "../exemplars/derive";
import { closestCorpusClash, jaccard, MAX_INPUT_SIMILARITY, tooClose, trigrams } from "../exemplars/similarity";
import type { Exemplar } from "../exemplars/types";
import { exemplarProblems } from "../exemplars/validate";

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
