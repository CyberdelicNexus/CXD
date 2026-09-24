// Live check that every lab model answers a structured request.
// Costs well under $0.05. Run: npx tsx src/lib/lab/__verify__/smoke-models.ts
import { loadEnvLocal } from "./load-env";

async function main() {
  loadEnvLocal();
  const { z } = await import("zod");
  const { LAB_MODELS } = await import("../config");
  const { generateStructured } = await import("../model-client");

  const schema = z.object({ ok: z.boolean(), fruits: z.array(z.string()) });
  let failures = 0;
  for (const m of LAB_MODELS) {
    try {
      const r = await generateStructured({
        modelId: m.id,
        system: "Answer with the requested JSON only.",
        prompt: "Set ok to true and list exactly three fruit names.",
        schema,
        maxTokens: 2000,
      });
      const good = r.object.ok === true && r.object.fruits.length === 3;
      if (!good) failures++;
      console.log(`${good ? "PASS" : "FAIL"} ${m.id.padEnd(24)} ${r.latencyMs}ms $${r.costUsd.toFixed(5)} ${JSON.stringify(r.object)}`);
    } catch (e) {
      failures++;
      console.log(`FAIL ${m.id.padEnd(24)} ${String((e as Error).message).slice(0, 200)}`);
    }
  }
  if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
  console.log("\nALL PASS");
}

main();
