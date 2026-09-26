// Run: npx tsx src/lib/maps/__verify__/select.verify.ts
// Deterministic exemplar selection (spec §4.4) and its place in PROMPT_VERSION.
import { CORPUS } from "@/lib/lab/corpus";
import { computePromptVersion, exemplarBlock, PROMPT_VERSION } from "@/lib/lab/prompts";
import { EXEMPLARS } from "../exemplars";
import { contentWords, relevance, selectExemplars, SELECTION_VERSION } from "../exemplars/select";
import { tooClose } from "../exemplars/similarity";
import type { Exemplar, ExemplarInput } from "../exemplars/types";
import { EXEMPLAR_INPUT_TYPES } from "../exemplars/types";

let failures = 0;
const check = (name: string, cond: boolean) => {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
};
const ids = (xs: Exemplar[]) => xs.map((x) => x.id).join(",");
const asInput = (t: (typeof EXEMPLAR_INPUT_TYPES)[number]) => ({ type: t, title: "", text: "" });

for (const t of EXEMPLAR_INPUT_TYPES) {
  const a = selectExemplars(EXEMPLARS, asInput(t), null);
  check(`${t}: deterministic (${ids(a)})`, ids(a) === ids(selectExemplars(EXEMPLARS, asInput(t), null)));
  check(`${t}: 1 to 3 distinct exemplars`, a.length >= 1 && a.length <= 3 && new Set(a.map((x) => x.id)).size === a.length);
  check(`${t}: the first matches the input type`, a[0].tags.inputType === t);
}
{
  const forced = selectExemplars(EXEMPLARS, asInput("topic"), "brace");
  check(`forced type ranks after input type (${forced[0]?.id})`, forced[0]?.tags.inputType === "topic" && forced[0]?.tags.mapType === "brace");
}
{
  // Ties break by id, in the first pick and in the greedy step: all fakes
  // share one input, so relevance is equal across them and only kind
  // diversity (and id) can separate the picks.
  const base = EXEMPLARS[0];
  const fake = (id: string, kinds: Exemplar["tags"]["kinds"]): Exemplar =>
    ({ ...base, id, tags: { ...base.tags, inputType: "topic", mapType: "radial", kinds, pairings: [] } });
  const lib = [fake("c", ["card"]), fake("a", ["card"]), fake("b", ["table"]), fake("d", ["frame"])];
  const pick = selectExemplars(lib, asInput("topic"), null);
  check(`ties break by id (${ids(pick)})`, ids(pick) === "a,b,d");
  const onlySame = [fake("b", ["card"]), fake("a", ["card"])];
  check("nothing new to add: stops after the first", ids(selectExemplars(onlySame, asInput("topic"), null)) === "a");
}
{
  const input = { type: "comparison" as const, title: "Two lighting rigs", text: "Compare a fixed lighting rig with a touring one for our shows." };
  const block = exemplarBlock(input, null);
  const picked = selectExemplars(EXEMPLARS.filter((e) => !tooClose(e.input, input)), input, null);
  check("the block shows exactly the selected exemplars", picked.every((e) => block.includes(e.title)) &&
    EXEMPLARS.filter((e) => !picked.includes(e)).every((e) => !block.includes(`Example "${e.title}"`)));
  check("the block shows each example's input", picked.every((e) => block.includes(e.input.text.slice(0, 40))));
  const own = EXEMPLARS.find((e) => e.tags.inputType === "comparison")!;
  check("an example is never shown for its own input", !exemplarBlock(own.input, null).includes(`Example "${own.title}"`));
}

// ── Lexical relevance ────────────────────────────────────────────────
{
  check("content words drop stopwords, short words and numbers, and singularise",
    !contentWords("the price is 49 a month for regulars").has("the") &&
    !contentWords("a b").has("a") &&
    !contentWords("49").has("49") &&
    contentWords("regulars").has("regular"));
  check("relevance is 1 for identical bags, 0 for disjoint or empty ones",
    relevance(contentWords("gong bath retreat"), contentWords("retreat gong bath")) === 1 &&
    relevance(contentWords("gong bath"), contentWords("app pricing")) === 0 &&
    relevance(new Set(), contentWords("anything")) === 0);
  check("a retreat input ranks the retreat exemplar over an unrelated one on relevance alone",
    relevance(contentWords("Plan our weekend sound retreat, budget and rooms"), contentWords("A weekend retreat, budget and rooms"))
      > relevance(contentWords("Plan our weekend sound retreat, budget and rooms"), contentWords("Compare three pass pricing tiers")));
}

// ── Selection relevance across a realistic corpus (item B) ──────────
// Inputs invented only to exercise selection breadth; not corpus or exemplar inputs.
const SYNTHETIC: ExemplarInput[] = [
  { type: "comparison", title: "Pop-up or lease a studio", text: "Should we run a pop-up in a market hall for six months, or sign a longer lease on a permanent studio? What does each risk and what does each open up?", cards: [] },
];
{
  const allInputs: (Pick<ExemplarInput, "type" | "title" | "text"> & { id: string })[] = [
    ...CORPUS,
    ...SYNTHETIC.map((s, i) => ({ ...s, id: `synthetic-${i}` })),
  ];
  const counts = new Map<string, number>(EXEMPLARS.map((e) => [e.id, 0]));
  const corpusCounts = new Map<string, number>(EXEMPLARS.map((e) => [e.id, 0]));
  for (const input of allInputs) {
    const lib = EXEMPLARS.filter((e) => !tooClose(e.input, input));
    const picked = selectExemplars(lib, input, null);
    picked.forEach((e) => {
      counts.set(e.id, (counts.get(e.id) ?? 0) + 1);
      if (!input.id.startsWith("synthetic-")) corpusCounts.set(e.id, (corpusCounts.get(e.id) ?? 0) + 1);
    });
  }
  const never = EXEMPLARS.filter((e) => (counts.get(e.id) ?? 0) === 0).map((e) => e.id);
  check(`every exemplar is picked at least once across the corpus or synthetic inputs${never.length ? `: never picked: ${never.join(", ")}` : ""}`, never.length === 0);
  const hogs = EXEMPLARS.filter((e) => (corpusCounts.get(e.id) ?? 0) > CORPUS.length * 0.5).map((e) => `${e.id} (${corpusCounts.get(e.id)}/${CORPUS.length})`);
  check(`no exemplar is picked for more than 50% of the ${CORPUS.length} corpus inputs${hogs.length ? `: ${hogs.join(", ")}` : ""}`, hogs.length === 0);
  console.log("  --- pick distribution across the corpus (id: count) ---");
  for (const [id, n] of Array.from(corpusCounts).sort((a, b) => b[1] - a[1])) console.log(`       ${id}: ${n}`);
}
{
  // Every exemplar is exempt from its own input (similarity.ts); confirm none leaks through selection.
  check("an exemplar is never shown for its own input, for every exemplar",
    EXEMPLARS.every((e) => !exemplarBlock(e.input, null).includes(`Example "${e.title}"`)));
  check("SELECTION_VERSION was bumped for the relevance rewrite", SELECTION_VERSION === "select-v3-relevance");
}
{
  check("PROMPT_VERSION is computed from the loaded library", PROMPT_VERSION === computePromptVersion(EXEMPLARS));
  check("the version is order-free", computePromptVersion([...EXEMPLARS].reverse()) === PROMPT_VERSION);
  const edited = EXEMPLARS.map((e, i) => (i === 0 ? { ...e, note: `${e.note} (edited)` } : e));
  check("editing one exemplar changes the version", computePromptVersion(edited) !== PROMPT_VERSION);
  check("removing one exemplar changes the version", computePromptVersion(EXEMPLARS.slice(1)) !== PROMPT_VERSION);
}

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log("\nALL PASS");
