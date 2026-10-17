// One structured-output call shape for every lab model.
// Claude goes through the official SDK's native structured outputs: the
// installed @ai-sdk/anthropic does not recognise Sonnet 5 / Opus 5.5 and falls
// back to forced-tool JSON, which Opus 5.5 rejects with a 400. No temperature is
// sent (400 on Sonnet 5 / Opus 5.5); effort only where the model supports it.
//
// Every call reports its usage to the optional CostMeter as soon as the
// provider has billed it, before any check that may throw (refusal,
// max_tokens, unparseable output), so failed calls are not counted as free.
// Only a failure before any response (network, 5xx) has no usage: cost 0.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { generateObject, NoObjectGeneratedError } from "ai";
import { google } from "@ai-sdk/google";
import type { z } from "zod";
import { costOf, getLabModel } from "./config";
import type { CostMeter } from "./cost-meter";

export interface StructuredResult<T> {
  object: T;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
}

export interface StructuredRequest<S extends z.ZodTypeAny> {
  modelId: string;
  system: string;
  prompt: string;
  schema: S;
  maxTokens?: number;
  /** Receives the billed usage of this call, whether or not it then succeeds. */
  meter?: CostMeter;
}

/** The slice of the Anthropic client the lab uses. */
export interface AnthropicLike {
  messages: { create(params: Anthropic.Messages.MessageCreateParamsNonStreaming): Promise<Anthropic.Messages.Message> };
}

let anthropicClient: Anthropic | null = null;

/** Indirection so the offline verify script can fake both providers. */
export const modelClientDeps: { anthropic: () => AnthropicLike; generateObject: typeof generateObject } = {
  anthropic: () => {
    if (!anthropicClient) anthropicClient = new Anthropic();
    return anthropicClient;
  },
  generateObject,
};

export async function generateStructured<S extends z.ZodTypeAny>(
  req: StructuredRequest<S>,
): Promise<StructuredResult<z.infer<S>>> {
  const model = getLabModel(req.modelId);
  const started = Date.now();
  const maxTokens = req.maxTokens ?? 16000;

  if (model.provider === "anthropic") {
    const format = zodOutputFormat(req.schema);
    // create + our own parse (not messages.parse): parse throws on truncated
    // JSON before usage can be read, which would make a billed call look free.
    const res = await modelClientDeps.anthropic().messages.create({
      model: model.id,
      max_tokens: maxTokens,
      system: req.system,
      messages: [{ role: "user", content: req.prompt }],
      output_config: {
        format,
        ...(model.effort ? { effort: model.effort } : {}),
      },
    });
    const inputTokens = res.usage.input_tokens;
    const outputTokens = res.usage.output_tokens;
    const costUsd = costOf(model, inputTokens, outputTokens);
    req.meter?.add(costUsd, inputTokens, outputTokens);
    if (res.stop_reason === "refusal") throw new Error("model refused the request");
    if (res.stop_reason === "max_tokens") throw new Error("hit max_tokens before the object was complete");
    const text = res.content.find((b): b is Anthropic.Messages.TextBlock => b.type === "text")?.text;
    if (text == null) throw new Error("model returned no parseable object");
    let object: z.infer<S>;
    try {
      object = format.parse(text) as z.infer<S>;
    } catch (e) {
      throw new Error(`model returned no parseable object: ${(e as Error).message.slice(0, 200)}`);
    }
    return { object, inputTokens, outputTokens, latencyMs: Date.now() - started, costUsd };
  }

  let res: Awaited<ReturnType<typeof generateObject>>;
  try {
    res = await modelClientDeps.generateObject({
      model: google(model.id),
      system: req.system,
      prompt: req.prompt,
      schema: req.schema,
      maxOutputTokens: maxTokens,
    });
  } catch (e) {
    // A response that failed to parse or validate was still generated, and billed.
    if (NoObjectGeneratedError.isInstance(e) && e.usage) {
      const inTok = e.usage.inputTokens ?? 0;
      const outTok = e.usage.outputTokens ?? 0;
      req.meter?.add(costOf(model, inTok, outTok), inTok, outTok);
    }
    throw e;
  }
  const inputTokens = res.usage.inputTokens ?? 0;
  const outputTokens = res.usage.outputTokens ?? 0;
  const costUsd = costOf(model, inputTokens, outputTokens);
  req.meter?.add(costUsd, inputTokens, outputTokens);
  return {
    object: res.object as z.infer<S>,
    inputTokens,
    outputTokens,
    latencyMs: Date.now() - started,
    costUsd,
  };
}
