// Run: npx tsx src/lib/maps/__verify__/schema.verify.ts
import type { z } from "zod";
import { TINT_COLORS } from "@/lib/ai/element-generation";
import { auditSchemaForAnthropic } from "@/lib/ai/schema-guards";
import { upgradeGraph } from "../legacy";
import { legendEntrySchema, mapGraphSchema, mapNodeSchema, mapRelationSchema } from "../schema";
import { NODE_KINDS, TINTS, type MapGraph } from "../types";

let failures = 0;
const check = (name: string, cond: boolean) => {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
};

// Compile-time: the schema's inferred type must be assignable to MapGraph.
const _typecheck = (x: z.infer<typeof mapGraphSchema>): MapGraph => x;
void _typecheck;

const a = auditSchemaForAnthropic(mapGraphSchema);
check("no array min/max bounds", a.arrayBounds === 0);
check(`no union-typed params (found ${a.unions})`, a.unions === 0);
check(`every field required: zero optional params (found ${a.optionals})`, a.optionals === 0);
check(`no enum has an empty string as a member (found ${a.emptyEnumMembers}) — Gemini's structured output rejects that ("enum[0]: cannot be empty")`, a.emptyEnumMembers === 0);

check("node fields", Object.keys(mapNodeSchema.shape).sort().join(",") === "detail,emphasis,id,kind,label,parent,props,role,tint");
check("relation fields", Object.keys(mapRelationSchema.shape).sort().join(",") === "direction,from,label,style,to,weight");
check("legend entry fields", Object.keys(legendEntrySchema.shape).sort().join(",") === "meaning,tint");
check("graph fields", Object.keys(mapGraphSchema.shape).sort().join(",") === "legend,mapType,nodes,relations,title");
check("node kinds include task, shape and heading", ["task", "shape", "heading"].every((k) => (NODE_KINDS as readonly string[]).includes(k)));
check("TINTS matches the canvas TINT_COLORS", TINTS.join(",") === TINT_COLORS.join(","));

const node = { id: "n1", label: "Hub", detail: "", role: "center", kind: "card", parent: "", props: "{}", tint: "none", emphasis: "normal" };
const ok = mapGraphSchema.safeParse({
  mapType: "radial", title: "T", legend: [],
  nodes: [node, { ...node, id: "n2", label: "Risk", role: "branch", tint: "rose", emphasis: "strong" }],
  relations: [{ from: "n1", to: "n2", label: "", style: "dashed", weight: "strong", direction: "both" }],
});
check("a well-formed graph parses", ok.success);
check("a legend entry parses", mapGraphSchema.safeParse({ mapType: "radial", title: "T", legend: [{ tint: "rose", meaning: "Risk" }], nodes: [node], relations: [] }).success);
check("a node missing required fields is rejected", !mapGraphSchema.safeParse({ mapType: "radial", title: "T", legend: [], nodes: [{ id: "n1" }], relations: [] }).success);
check("a node without tint is rejected", !mapGraphSchema.safeParse({ mapType: "radial", title: "T", legend: [], nodes: [{ ...node, tint: undefined }], relations: [] }).success);
check("an unknown tint is rejected", !mapGraphSchema.safeParse({ mapType: "radial", title: "T", legend: [], nodes: [{ ...node, tint: "pink" }], relations: [] }).success);
check("a legend entry cannot use the empty tint", !mapGraphSchema.safeParse({ mapType: "radial", title: "T", legend: [{ tint: "", meaning: "x" }], nodes: [node], relations: [] }).success);
check("a legend entry cannot use the node's \"no tint\" sentinel either", !mapGraphSchema.safeParse({ mapType: "radial", title: "T", legend: [{ tint: "none", meaning: "x" }], nodes: [node], relations: [] }).success);
check("a graph without legend is rejected", !mapGraphSchema.safeParse({ mapType: "radial", title: "T", nodes: [node], relations: [] }).success);

// Graphs stored before this change keep reading correctly.
const legacy = upgradeGraph({
  mapType: "flow", title: "Old",
  nodes: [{ id: "a", label: "A", detail: "", role: "step", kind: "card", parent: "", props: "{}" }],
  relations: [{ from: "a", to: "a", label: "" }],
});
check("legacy node defaults: tint \"none\", emphasis normal", legacy.nodes[0].tint === "none" && legacy.nodes[0].emphasis === "normal");
check("legacy relation defaults: solid, normal, forward",
  legacy.relations[0].style === "solid" && legacy.relations[0].weight === "normal" && legacy.relations[0].direction === "forward");
check("legacy legend defaults to []", Array.isArray(legacy.legend) && legacy.legend.length === 0);
check("upgrade keeps set values", upgradeGraph({ ...legacy, nodes: [{ ...legacy.nodes[0], tint: "rose" }] }).nodes[0].tint === "rose");

// Data stored before the "none" sentinel renaming may literally carry tint: "" rather than
// a missing field — that old empty-string sentinel must still upgrade to "none", not pass through.
check("a stored literal tint: \"\" (the pre-rename sentinel) upgrades to \"none\"",
  upgradeGraph({
    mapType: "flow", title: "Old",
    nodes: [{ id: "a", label: "A", detail: "", role: "step", kind: "card", parent: "", props: "{}", tint: "" as never, emphasis: "normal" }],
    relations: [],
  }).nodes[0].tint === "none");

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log("\nALL PASS");
