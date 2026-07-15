// AI Provider Registry
// Central model configuration and provider factory.
// Adding a new provider requires only a new entry here + the @ai-sdk package.

import { createOpenAI } from "@ai-sdk/openai";
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
  // Claude — verified working IDs for this Anthropic account. The old
  // "claude-sonnet-4-20250514" now 404s (not_found_error). Haiku 4.5 and
  // Opus 4.6 remain hidden in the picker (ai-credit-config.ts HIDDEN_MODEL_IDS)
  // but map to their real IDs so nothing references a dead one.
  'claude-haiku-4.5': 'claude-haiku-4-5',
  'claude-sonnet-4.5': 'claude-sonnet-4-5',
  'claude-opus-4.6': 'claude-opus-4-6',
};

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
      modelId: process.env.CLAUDE_TIER1_MODEL || "claude-sonnet-4-5",
      displayName: "Claude Sonnet 4.5",
      costMultiplier: 1.5,
      maxTokens: 4096,
    },
    analysis: {
      provider: "claude",
      tier: "analysis",
      modelId: process.env.CLAUDE_TIER2_MODEL || "claude-sonnet-4-5",
      displayName: "Claude Sonnet 4.5",
      costMultiplier: 2.5,
      maxTokens: 8192,
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
      if (customApiKey) {
        const customAnthropic = createAnthropic({ apiKey: customApiKey });
        return customAnthropic(config.modelId);
      }
      return anthropic(config.modelId);
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
    if (customApiKey) {
      const customAnthropic = createAnthropic({ apiKey: customApiKey });
      return customAnthropic(apiModelId);
    }
    return anthropic(apiModelId);
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
 * User-facing provider display info.
 */
export const PROVIDER_INFO: Record<AIProviderKey, { name: string; icon: string }> = {
  claude: { name: "Claude", icon: "anthropic" },
  gemini: { name: "Gemini", icon: "google" },
  kimi: { name: "Kimi K2", icon: "nvidia" },
};
