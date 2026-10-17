// Run: npx tsx src/lib/lab/__verify__/corpus.verify.ts
import { EXEMPLARS } from "@/lib/maps/exemplars";
import { closestCorpusClash, tooClose } from "@/lib/maps/exemplars/similarity";
import { CORPUS } from "../corpus";

let failures = 0;
const check = (name: string, cond: boolean) => {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
};

const NEW = ["cmp-pricing-numbers", "bd-research-sources", "tp-journey-subjourney", "bd-workshop-owners",
  "cmp-go-no-go", "bd-event-scenes", "cc-risks-opps", "tp-ecosystem-ties"];

check(`32 inputs (${CORPUS.length})`, CORPUS.length === 32);
check("ids are unique", new Set(CORPUS.map((i) => i.id)).size === CORPUS.length);
check("the 8 element-rich inputs are present", NEW.every((id) => CORPUS.some((i) => i.id === id)));
check("every input has a title and text", CORPUS.every((i) => i.title.trim() && i.text.trim()));
check("canvas-card inputs carry cards", CORPUS.filter((i) => i.type === "canvasCards").every((i) => i.cards.length > 0));
check("no authored exemplar is too close to a corpus input (same title, or word 3-gram Jaccard >= 0.3)",
  EXEMPLARS.filter((e) => e.provenance.source === "authored").every((e) => closestCorpusClash(e.input, CORPUS) === null));
check("corpus inputs are distinct from each other by the same rule",
  CORPUS.every((a, i) => CORPUS.every((b, j) => i === j || tooClose(a, b) === null)));

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log("\nALL PASS");
