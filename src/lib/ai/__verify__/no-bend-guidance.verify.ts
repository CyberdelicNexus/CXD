// Run: npx tsx src/lib/ai/__verify__/no-bend-guidance.verify.ts
// The canvas never draws edge.bend, so no prompt or schema description may ask a model for one.
import { z } from "zod";
import { CANVAS_OPERATIONS_GUIDE, canvasOperationsSchema } from "../canvas-operations";
import { CANVAS_GENERATION_GUIDE, generateElementsSchema } from "../element-generation";

let failures = 0;
const check = (name: string, cond: boolean) => {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
};

check("generation guide never asks for a bend", !/bend/i.test(CANVAS_GENERATION_GUIDE));
check("generation schema descriptions never ask for a bend", !/bend/i.test(JSON.stringify(z.toJSONSchema(generateElementsSchema))));
check("operations guide never asks for a bend", !/bend/i.test(CANVAS_OPERATIONS_GUIDE));
check("operations schema descriptions never ask for a bend", !/bend/i.test(JSON.stringify(z.toJSONSchema(canvasOperationsSchema))));

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log("\nALL PASS");
