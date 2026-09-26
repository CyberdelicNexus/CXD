// Run: npx tsx src/lib/maps/__verify__/select.verify.ts
// Deterministic exemplar selection (spec §4.4) and its place in PROMPT_VERSION.
import { computePromptVersion, exemplarBlock, PROMPT_VERSION } from "@/lib/lab/prompts";
import { EXEMPLARS } from "../exemplars";
import { selectExemplars } from "../exemplars/select";
import type { Exemplar } from "../exemplars/types";
import { EXEMPLAR_INPUT_TYPES } from "../exemplars/types";

let failures = 0;
const check = (name: string, cond: boolean) => {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
};
const ids = (xs: Exemplar[]) => xs.map((x) => x.id).join(",");

for (const t of EXEMPLAR_INPUT_TYPES) {
  const a = selectExemplars(EXEMPLARS, t, null);
  check(`${t}: deterministic (${ids(a)})`, ids(a) === ids(selectExemplars(EXEMPLARS, t, null)));
  check(`${t}: 1 to 3 distinct exemplars`, a.length >= 1 && a.length <= 3 && new Set(a.map((x) => x.id)).size === a.length);
  check(`${t}: the first matches the input type`, a[0].tags.inputType === t);
  const seen = new Set<string>([...a[0].tags.kinds, ...a[0].tags.pairings]);
  let adds = true;
  for (const e of a.slice(1)) {
    const fresh = [...e.tags.kinds, ...e.tags.pairings].filter((x) => !seen.has(x));
    if (fresh.length === 0) adds = false;
    fresh.forEach((x) => seen.add(x));
  }
  check(`${t}: every added exemplar brings new kinds or pairings`, adds);
}
{
  const forced = selectExemplars(EXEMPLARS, "topic", "brace");
  check(`forced type ranks after input type (${forced[0]?.id})`, forced[0]?.tags.inputType === "topic" && forced[0]?.tags.mapType === "brace");
}
{
  // Ties break by id, in the first pick and in the greedy step.
  const base = EXEMPLARS[0];
  const fake = (id: string, kinds: Exemplar["tags"]["kinds"]): Exemplar =>
    ({ ...base, id, tags: { ...base.tags, inputType: "topic", mapType: "radial", kinds, pairings: [] } });
  const lib = [fake("c", ["card"]), fake("a", ["card"]), fake("b", ["table"]), fake("d", ["frame"])];
  const pick = selectExemplars(lib, "topic", null);
  check(`ties break by id (${ids(pick)})`, ids(pick) === "a,b,d");
  const onlySame = [fake("b", ["card"]), fake("a", ["card"])];
  check("nothing new to add: stops after the first", ids(selectExemplars(onlySame, "topic", null)) === "a");
}
{
  const input = { type: "comparison" as const, title: "Two lighting rigs", text: "Compare a fixed lighting rig with a touring one for our shows." };
  const block = exemplarBlock(input, null);
  const picked = selectExemplars(EXEMPLARS, "comparison", null);
  check("the block shows exactly the selected exemplars", picked.every((e) => block.includes(e.title)) &&
    EXEMPLARS.filter((e) => !picked.includes(e)).every((e) => !block.includes(`Example "${e.title}"`)));
  check("the block shows each example's input", picked.every((e) => block.includes(e.input.text.slice(0, 40))));
  const own = EXEMPLARS.find((e) => e.tags.inputType === "comparison")!;
  check("an example is never shown for its own input", !exemplarBlock(own.input, null).includes(`Example "${own.title}"`));
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
