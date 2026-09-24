// One structured-output call shape for every lab model.
// Claude goes through the official SDK's native structured outputs: the
// installed @ai-sdk/anthropic does not recognise Sonnet 5 / Opus 5.5 and falls
// back to forced-tool JSON, which Opus 5.5 rejects with a 400. No temperature is
// sent (400 on Sonnet 5 / Opus 5.5); effort only where the model supports it.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import type { z } from "zod";
import { costOf, getLabModel } from "./config";

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
}

let anthropicClient: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!anthropicClient) anthropicClient = new Anthropic();
  return anthropicClient;
}

export async function generateStructured<S extends z.ZodTypeAny>(
  req: StructuredRequest<S>,
): Promise<StructuredResult<z.infer<S>>> {
  const model = getLabModel(req.modelId);
  const started = Date.now();
  const maxTokens = req.maxTokens ?? 16000;

  if (model.provider === "anthropic") {
    const res = await anthropic().messages.parse({
      model: model.id,
      max_tokens: maxTokens,
      system: req.system,
      messages: [{ role: "user", content: req.prompt }],
      output_config: {
        format: zodOutputFormat(req.schema),
        ...(model.effort ? { effort: model.effort } : {}),
      },
    });
    if (res.stop_reason === "refusal") throw new Error("model refused the request");
    if (res.stop_reason === "max_tokens") throw new Error("hit max_tokens before the object was complete");
    if (res.parsed_output == null) throw new Error("model returned no parseable object");
    const inputTokens = res.usage.input_tokens;
    const outputTokens = res.usage.output_tokens;
    return {
      object: res.parsed_output as z.infer<S>,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - started,
      costUsd: costOf(model, inputTokens, outputTokens),
    };
  }

  const res = await generateObject({
    model: google(model.id),
    system: req.system,
    prompt: req.prompt,
    schema: req.schema,
    maxOutputTokens: maxTokens,
  });
  const inputTokens = res.usage.inputTokens ?? 0;
  const outputTokens = res.usage.outputTokens ?? 0;
  return {
    object: res.object as z.infer<S>,
    inputTokens,
    outputTokens,
    latencyMs: Date.now() - started,
    costUsd: costOf(model, inputTokens, outputTokens),
  };
}
