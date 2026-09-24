// Run: npx tsx src/lib/maps/__verify__/schema.verify.ts
import type { z } from "zod";
import { mapGraphSchema } from "../schema";
import type { MapGraph } from "../types";
import { auditSchemaForAnthropic } from "@/lib/ai/schema-guards";

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
check(`every field required — zero optional params (found ${a.optionals})`, a.optionals === 0);

const ok = mapGraphSchema.safeParse({
  mapType: "radial", title: "T",
  nodes: [{ id: "n1", label: "Hub", detail: "", role: "center", kind: "card", parent: "", props: "{}" }],
  relations: [],
});
check("a well-formed graph parses", ok.success);
const bad = mapGraphSchema.safeParse({ mapType: "radial", title: "T", nodes: [{ id: "n1" }], relations: [] });
check("a node missing required fields is rejected", !bad.success);

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log("\nALL PASS");
