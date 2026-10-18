// AI Provider Registry
// Central model configuration and provider factory.
// Adding a new provider requires only a new entry here + the @ai-sdk package.

import { createOpenAI } from "@ai-sdk/openai";
import { wrapLanguageModel, type LanguageModelMiddleware } from "ai";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import type { AIProviderKey, AIModelTier } from "@/types/ai-types";
import type { ModelId } from "@/lib/ai-credit-config";

// Map our model IDs to actual API model IDs.
// IMPORTANT: These must match what's actually available in the APIs.
// Run test-models.mjs to verify which models work with your API keys.
// Maps our stable internal model IDs to the real provider API model IDs.
// Verified against the live APIs with the current keys (2026-07). Update here
// when a provider retires an ID — a dead ID produces an EMPTY stream, not an
// error, so it looks like "the model returned nothing".
export const MODEL_ID_MAP: Record<ModelId, string> = {
  // Gemini — the AI SDK adds the "models/" prefix automatically, so bare IDs work.
  // This Google project can no longer access the pinned 2.0/2.5 Flash IDs
  // ("no longer available to new users"); the rolling "-latest" Flash alias works.
  'gemini-2.0-flash': 'gemini-flash-latest',
  'gemini-2.5-pro': 'gemini-2.5-pro',
  // Kimi — Moonshot's own API (matches MOONSHOT_API_KEY + the 'moonshot' BYOK
  // provider). The old NVIDIA-hosted "moonshotai/kimi-k2.6" 404'd: no
  // NVIDIA_API_KEY was set and a Moonshot key can't auth NVIDIA's endpoint.
  'kimi': 'kimi-k2-0905-preview',
  // Claude — the current generation, verified against the live API with this
  // account's key (2026-10). The KEYS on the left are our stable internal ids:
  // they are stored in user preferences and referenced across the routes, so
  // they keep their old spelling while pointing at the current model of the
  // same tier. Upgrading a tier is a one-line change here (or the env override
  // below), not a rename everywhere.
  'claude-haiku-4.5': 'claude-haiku-5-5',
  'claude-sonnet-4.5': 'claude-sonnet-5-5',
  'claude-opus-4.6': 'claude-opus-5-5',
};

/**
 * The 4.7-and-later Claude models changed their request surface in ways that
 * turn this app's existing calls into 400s (verified by probe, 2026-10):
 *   - any `temperature` / `topP` / `topK` is rejected, and every route sets one;
 *   - a forced tool call is rejected, which is how the AI SDK implements
 *     generateObject unless told to use native structured output;
 *   - thinking is always on, so its depth has to be set with `effort`.
 * This middleware adapts every call in one place so the routes stay
 * provider-agnostic. Explicit providerOptions from a route still win.
 * Models older than that (reachable only through an env override) are left
 * untouched, since they need the opposite: they reject `effort`.
 */
const LEGACY_CLAUDE_RE = /claude-(3|(opus|sonnet|haiku)-4-[0-6](\b|-))/;

function modernClaude(effort: "low" | "medium"): LanguageModelMiddleware {
  return {
    specificationVersion: "v3",
    transformParams: async ({ params }) => {
      const { temperature: _t, topP: _p, topK: _k, ...rest } = params;
      return {
        ...rest,
        providerOptions: {
          ...rest.providerOptions,
          anthropic: { structuredOutputMode: "outputFormat", effort, ...rest.providerOptions?.anthropic },
        },
      };
    },
  };
}

/** A Claude model ready for this app's routes. Chat stays quick; analysis and
 *  canvas builds get more thought. */
function claudeModel(apiModelId: string, tier: AIModelTier, customApiKey?: string) {
  const provider = customApiKey ? createAnthropic({ apiKey: customApiKey }) : anthropic;
  const model = provider(apiModelId);
  if (LEGACY_CLAUDE_RE.test(apiModelId)) return model;
  return wrapLanguageModel({ model, middleware: modernClaude(tier === "chat" ? "low" : "medium") });
}

// Kimi is reached through Moonshot's OpenAI-compatible API. Prefer the Moonshot
// key/endpoint; only fall back to NVIDIA's hosted endpoint if a Moonshot key is
// absent and an NVIDIA key is present (they are NOT interchangeable).
const KIMI_BASE_URL =
  process.env.MOONSHOT_BASE_URL ??
  (process.env.MOONSHOT_API_KEY
    ? "https://api.moonshot.ai/v1"
    : "https://integrate.api.nvidia.com/v1");

const kimiProvider = createOpenAI({
  baseURL: KIMI_BASE_URL,
  apiKey: process.env.MOONSHOT_API_KEY ?? process.env.NVIDIA_API_KEY ?? "",
});

interface ModelEntry {
  provider: AIProviderKey;
  tier: AIModelTier;
  modelId: string;
  displayName: string;
  costMultiplier: number;
  maxTokens: number;
  isReasoning?: boolean;
}

// Model configurations per provider per tier
const MODEL_CONFIGS: Record<AIProviderKey, Record<AIModelTier, ModelEntry>> = {
  claude: {
    chat: {
      provider: "claude",
      tier: "chat",
      modelId: process.env.CLAUDE_TIER1_MODEL || "claude-sonnet-5-5",
      displayName: "Claude Sonnet 5.5",
      costMultiplier: 1.5,
      // Thinking is always on and counts toward this ceiling.
      maxTokens: 8192,
    },
    analysis: {
      provider: "claude",
      tier: "analysis",
      modelId: process.env.CLAUDE_TIER2_MODEL || "claude-sonnet-5-5",
      displayName: "Claude Sonnet 5.5",
      costMultiplier: 2.5,
      maxTokens: 16000,
    },
  },
  gemini: {
    chat: {
      provider: "gemini",
      tier: "chat",
      modelId: process.env.GEMINI_TIER1_MODEL || "gemini-2.5-pro",
      displayName: "Gemini 2.5 Pro",
      costMultiplier: 0.8,
      maxTokens: 4096,
    },
    analysis: {
      provider: "gemini",
      tier: "analysis",
      modelId: process.env.GEMINI_TIER2_MODEL || "gemini-2.5-pro",
      displayName: "Gemini 2.5 Pro",
      costMultiplier: 1.8,
      maxTokens: 8192,
    },
  },
  kimi: {
    chat: {
      provider: "kimi",
      tier: "chat",
      modelId: process.env.KIMI_TIER1_MODEL || "kimi-k2-0905-preview",
      displayName: "Kimi K2",
      costMultiplier: 1.0,
      maxTokens: 4096,
    },
    analysis: {
      provider: "kimi",
      tier: "analysis",
      modelId: process.env.KIMI_TIER2_MODEL || "kimi-k2-0905-preview",
      displayName: "Kimi K2",
      costMultiplier: 2.0,
      maxTokens: 8192,
    },
  },
};

/**
 * Get model configuration for a provider and tier.
 */
export function getModelConfig(provider: AIProviderKey, tier: AIModelTier): ModelEntry {
  return MODEL_CONFIGS[provider][tier];
}

/**
 * Get the Vercel AI SDK model instance for a given provider and tier.
 * @param provider - The AI provider
 * @param tier - The model tier (chat or analysis)
 * @param customApiKey - Optional custom API key (for BYOK users)
 */
export function getModelInstance(
  provider: AIProviderKey,
  tier: AIModelTier,
  customApiKey?: string
) {
  const config = getModelConfig(provider, tier);

  switch (provider) {
    case "claude":
      return claudeModel(config.modelId, tier, customApiKey);
    case "gemini":
      if (customApiKey) {
        const customGoogle = createGoogleGenerativeAI({ apiKey: customApiKey });
        return customGoogle(config.modelId);
      }
      return google(config.modelId);
    case "kimi":
      if (customApiKey) {
        const customKimi = createOpenAI({
          baseURL: KIMI_BASE_URL,
          apiKey: customApiKey,
        });
        return customKimi.chat(config.modelId);
      }
      return kimiProvider.chat(config.modelId);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

/**
 * Get model instance by specific model ID
 * @param modelId - The specific model ID from ai-credit-config
 * @param customApiKey - Optional custom API key (for BYOK users)
 */
export function getModelInstanceByModelId(
  modelId: ModelId,
  customApiKey?: string
) {
  const apiModelId = MODEL_ID_MAP[modelId];

  // Determine provider from model ID
  if (modelId.startsWith('claude-')) {
    // By-id access is the chat route.
    return claudeModel(apiModelId, "chat", customApiKey);
  } else if (modelId.startsWith('gemini-')) {
    if (customApiKey) {
      const customGoogle = createGoogleGenerativeAI({ apiKey: customApiKey });
      return customGoogle(apiModelId);
    }
    return google(apiModelId);
  } else if (modelId === 'kimi') {
    if (customApiKey) {
      const customKimi = createOpenAI({
        baseURL: KIMI_BASE_URL,
        apiKey: customApiKey,
      });
      return customKimi.chat(apiModelId);
    }
    return kimiProvider.chat(apiModelId);
  }

  throw new Error(`Unknown model ID: ${modelId}`);
}

/**
 * The model that draws a canvas build for the user's selection. Opus draws its
 * own builds (it is priced for it, see MODEL_COST_MULTIPLIER); every other
 * selection uses its family's analysis-tier model, which is the one the
 * build prompts are tuned and tested against.
 */
export function getCanvasBuildModel(selected: string, provider: AIProviderKey) {
  const config = getModelConfig(provider, "analysis");
  if (selected === "claude-opus-4.6") {
    const modelId = MODEL_ID_MAP["claude-opus-4.6"];
    return { model: claudeModel(modelId, "analysis"), modelId, maxTokens: config.maxTokens };
  }
  return { model: getModelInstance(provider, "analysis"), modelId: config.modelId, maxTokens: config.maxTokens };
}

/**
 * User-facing provider display info.
 */
export const PROVIDER_INFO: Record<AIProviderKey, { name: string; icon: string }> = {
  claude: { name: "Claude", icon: "anthropic" },
  gemini: { name: "Gemini", icon: "google" },
  kimi: { name: "Kimi K2", icon: "nvidia" },
};

/**
 * Generation settings for the structured canvas routes (canvas-operations,
 * generate-elements), where the answer is one long JSON object.
 *
 * Gemini 2.5 Pro thinks before it answers, and its thinking tokens count
 * against maxOutputTokens: on a large diagram it spent about 6,200 of an 8,192
 * budget thinking, the JSON was cut off mid-row, and the request failed after
 * a minute. Capping the thinking budget fixes the failure and is also most of
 * the latency (measured: 61s and failing, then 35s and complete). The ceiling
 * is raised for the same reason; a ceiling costs nothing unless it is used.
 */
export function structuredCanvasSettings(
  provider: string,
  configuredMaxTokens: number,
): { maxOutputTokens: number; providerOptions?: Record<string, Record<string, string | number | { thinkingBudget: number }>> } {
  const maxOutputTokens = provider === "kimi" ? configuredMaxTokens : Math.max(configuredMaxTokens, 12000);
  if (provider === "gemini") {
    return { maxOutputTokens, providerOptions: { google: { thinkingConfig: { thinkingBudget: 1024 } } } };
  }
  if (provider === "claude") {
    // A canvas build is layout arithmetic, not deliberation: at low effort the
    // large test diagram came out as complete and slightly tighter, for fewer
    // (billed) thinking tokens.
    return { maxOutputTokens, providerOptions: { anthropic: { effort: "low" } } };
  }
  return { maxOutputTokens };
}