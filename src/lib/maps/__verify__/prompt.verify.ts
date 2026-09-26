// Run: npx tsx src/lib/maps/__verify__/prompt.verify.ts
// The map guide names every kind with a content trigger, names no default, and
// describes every new field, in exactly the values the schema accepts.
import { INSPECTOR_SECTION_IDS } from "@/lib/ai/element-generation";
import { buildMapGuide } from "../prompt";
import { MAP_TYPES, NODE_KINDS, RELATION_DIRECTIONS, RELATION_STYLES, TINTS } from "../types";

let failures = 0;
const check = (name: string, cond: boolean) => {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
};

const guide = buildMapGuide();
check("guide names every map type", MAP_TYPES.every((t) => guide.includes(`- ${t} (`)));
check("guide names every node kind", NODE_KINDS.every((k) => guide.includes(`- ${k}:`)));
check("guide names no default kind", !/default/i.test(guide));
check("guide describes tint, legend and emphasis", ["- tint:", "- legend:", "- emphasis:"].every((s) => guide.includes(s)));
check("guide describes relation style, weight and direction",
  ["- relation style:", "- relation weight:", "- relation direction:"].every((s) => guide.includes(s)));
check("guide lists every tint", TINTS.every((t) => guide.includes(t)));
check("guide quotes every relation style and direction",
  [...RELATION_STYLES, ...RELATION_DIRECTIONS].every((v) => guide.includes(`"${v}"`)));
check("guide lists every framing section for anchors", INSPECTOR_SECTION_IDS.every((s) => guide.includes(s)));
check("guide says where headings may go", guide.includes("only in spider, tree, brace maps"));
check("guide never mentions bends", !/bend/i.test(guide));
check("forced type is stated", buildMapGuide("brace").includes('mapType MUST be "brace"'));

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log("\nALL PASS");
