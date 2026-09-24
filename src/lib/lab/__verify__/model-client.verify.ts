// Run: npx tsx src/lib/lab/__verify__/model-client.verify.ts
// Offline: both providers are faked through modelClientDeps, so no API is called.
// Checks that every billed call reaches the CostMeter, including calls that
// then fail (max_tokens, refusal, unparseable output, schema failure), and that
// a graphCritique whose revision fails is still charged for its draft.
import { NoObjectGeneratedError } from "ai";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { costOf, getLabModel } from "../config";
import { CostMeter } from "../cost-meter";
import { generateStructured, modelClientDeps } from "../model-client";
import { runArm } from "../arms";
import { CORPUS } from "../corpus";
import { EXEMPLARS } from "@/lib/maps/exemplars";

let failures = 0;
const check = (name: string, cond: boolean) => {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
};
const near = (a: number, b: number) => Math.abs(a - b) < 1e-12;

const schema = z.object({ answer: z.number() });
const HAIKU = "claude-haiku-4-5";
const FLASH = "gemini-3.8-flash";

function message(text: string, stop: Anthropic.Messages.Message["stop_reason"], inTok: number, outTok: number): Anthropic.Messages.Message {
  return {
    id: "msg", type: "message", role: "assistant", model: HAIKU, stop_reason: stop, stop_sequence: null,
    content: [{ type: "text", text, citations: null }],
    usage: { input_tokens: inTok, output_tokens: outTok },
  } as unknown as Anthropic.Messages.Message;
}

let queue: Anthropic.Messages.Message[] = [];
let anthropicCalls = 0;
modelClientDeps.anthropic = () => ({
  messages: {
    async create() {
      anthropicCalls++;
      const next = queue.shift();
      if (!next) throw new Error("network down (no response)");
      return next;
    },
  },
});

async function attempt(meter: CostMeter, modelId = HAIKU): Promise<Error | null> {
  try {
    await generateStructured({ modelId, system: "s", prompt: "p", schema, meter });
    return null;
  } catch (e) {
    return e as Error;
  }
}

async function main() {
  const haiku = getLabModel(HAIKU);
  const flash = getLabModel(FLASH);

  // ── Anthropic ──
  {
    queue = [message('{"answer":4}', "end_turn", 100, 20)];
    const meter = new CostMeter();
    const res = await generateStructured({ modelId: HAIKU, system: "s", prompt: "p", schema, meter });
    check("success returns the parsed object", res.object.answer === 4);
    check("success bills the meter exactly once", near(meter.costUsd, res.costUsd) && near(res.costUsd, costOf(haiku, 100, 20)));
  }
  {
    queue = [message('{"answer":', "max_tokens", 3000, 16000)];
    const meter = new CostMeter();
    const err = await attempt(meter);
    check("max_tokens throws", !!err && /max_tokens/.test(err.message));
    check("max_tokens is billed", near(meter.costUsd, costOf(haiku, 3000, 16000)) && meter.outputTokens === 16000);
  }
  {
    queue = [message("", "refusal", 500, 10)];
    const meter = new CostMeter();
    const err = await attempt(meter);
    check("refusal throws and is billed", !!err && /refused/.test(err.message) && near(meter.costUsd, costOf(haiku, 500, 10)));
  }
  {
    queue = [message('{"answer":"four"}', "end_turn", 400, 30)];
    const meter = new CostMeter();
    const err = await attempt(meter);
    check("schema-invalid output throws and is billed", !!err && /parseable/.test(err.message) && near(meter.costUsd, costOf(haiku, 400, 30)));
  }
  {
    queue = [];
    const meter = new CostMeter();
    const err = await attempt(meter);
    check("failure before any response costs 0", !!err && meter.costUsd === 0);
  }

  // ── Gemini ──
  {
    modelClientDeps.generateObject = (async () => {
      throw new NoObjectGeneratedError({
        message: "No object generated: response did not match schema.",
        text: '{"answer":"x"}',
        response: { id: "r", timestamp: new Date(), modelId: FLASH },
        usage: { inputTokens: 2000, outputTokens: 700, totalTokens: 2700 } as never,
        finishReason: "stop",
      });
    }) as unknown as typeof modelClientDeps.generateObject;
    const meter = new CostMeter();
    const err = await attempt(meter, FLASH);
    check("Gemini NoObjectGenerated is rethrown and billed", !!err && near(meter.costUsd, costOf(flash, 2000, 700)));
  }
  {
    modelClientDeps.generateObject = (async () => { throw new Error("fetch failed"); }) as unknown as typeof modelClientDeps.generateObject;
    const meter = new CostMeter();
    const err = await attempt(meter, FLASH);
    check("Gemini network error costs 0", !!err && meter.costUsd === 0);
  }
  {
    modelClientDeps.generateObject = (async () => ({
      object: { answer: 7 }, usage: { inputTokens: 10, outputTokens: 5 },
    })) as unknown as typeof modelClientDeps.generateObject;
    const meter = new CostMeter();
    const res = await generateStructured({ modelId: FLASH, system: "s", prompt: "p", schema, meter });
    check("Gemini success bills the meter", res.object.answer === 7 && near(meter.costUsd, costOf(flash, 10, 5)));
  }

  // ── graphCritique: a billed draft followed by a failed revision is still charged ──
  {
    anthropicCalls = 0;
    queue = [
      message(JSON.stringify(EXEMPLARS[0].graph), "end_turn", 4000, 3000),
      message('{"mapType":"radial","ti', "max_tokens", 9000, 16000),
    ];
    const meter = new CostMeter();
    const err = await runArm("graphCritique", CORPUS[0], HAIKU, null, meter).then(() => null, (e: Error) => e);
    check("critique revision failure throws", !!err && /max_tokens/.test(err.message) && anthropicCalls === 2);
    check("critique draft + failed revision are both billed",
      near(meter.costUsd, costOf(haiku, 4000, 3000) + costOf(haiku, 9000, 16000)));
  }

  if (failures) { console.error(`${failures} FAILED`); process.exit(1); }
  console.log("ALL PASS");
}
main().catch((e) => { console.error(e); process.exit(1); });
