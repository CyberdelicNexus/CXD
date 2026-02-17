// AI Provider Registry
// Central model configuration and provider factory.
// Adding a new provider requires only a new entry here + the @ai-sdk package.

import { openai, createOpenAI } from "@ai-sdk/openai";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import type { AIProviderKey, AIModelTier } from "@/types/ai-types";
import type { ModelId } from "@/lib/ai-credit-config";

// Map our model IDs to actual API model IDs
// IMPORTANT: These must match what's actually available in the APIs
// Run test-models.mjs to verify which models work with your API keys
export const MODEL_ID_MAP: Record<ModelId, string> = {
  // Gemini - requires 'models/' prefix
  'gemini-2.0-flash': 'models/gemini-2.0-flash',
  'gemini-2.5-pro': 'models/gemini-2.5-pro',
  // GPT - working
  'gpt-4o-mini': 'gpt-4o-mini',
  'gpt-4o': 'gpt-4o',
  // Kimi - working
  'kimi': 'moonshotai/kimi-k2.5',
  // Claude - only claude-3-haiku-20240307 works with current API key
  // Claude 3.5 models require upgraded API access
  'claude-haiku-4.5': 'claude-3-haiku-20240307',
  'claude-sonnet-4.5': 'claude-3-haiku-20240307', // Fallback to working model
  'claude-opus-4.6': 'claude-3-haiku-20240307', // Fallback to working model
};

// NVIDIA API (OpenAI-compatible) for Kimi K2.5
const nvidia = createOpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY ?? process.env.MOONSHOT_API_KEY ?? "",
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
  gpt: {
    chat: {
      provider: "gpt",
      tier: "chat",
      modelId: process.env.GPT_TIER1_MODEL || "gpt-4.1",
      displayName: "GPT-4.1",
      costMultiplier: 1.0,
      maxTokens: 4096,
    },
    analysis: {
      provider: "gpt",
      tier: "analysis",
      modelId: process.env.GPT_TIER2_MODEL || "gpt-4.1",
      displayName: "GPT-4.1",
      costMultiplier: 2.0,
      maxTokens: 8192,
    },
  },
  claude: {
    chat: {
      provider: "claude",
      tier: "chat",
      modelId: process.env.CLAUDE_TIER1_MODEL || "claude-sonnet-4-5-20250929",
      displayName: "Claude Sonnet 4.5",
      costMultiplier: 1.5,
      maxTokens: 4096,
    },
    analysis: {
      provider: "claude",
      tier: "analysis",
      modelId: process.env.CLAUDE_TIER2_MODEL || "claude-sonnet-4-5-20250929",
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
      modelId: process.env.KIMI_TIER1_MODEL || "moonshotai/kimi-k2.5",
      displayName: "Kimi K2.5",
      costMultiplier: 1.0,
      maxTokens: 4096,
    },
    analysis: {
      provider: "kimi",
      tier: "analysis",
      modelId: process.env.KIMI_TIER2_MODEL || "moonshotai/kimi-k2.5",
      displayName: "Kimi K2.5",
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
    case "gpt":
      if (customApiKey) {
        const customOpenAI = createOpenAI({ apiKey: customApiKey });
        return customOpenAI(config.modelId);
      }
      return openai(config.modelId);
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
        const customNvidia = createOpenAI({
          baseURL: "https://integrate.api.nvidia.com/v1",
          apiKey: customApiKey,
        });
        return customNvidia.chat(config.modelId);
      }
      return nvidia.chat(config.modelId);
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
  if (modelId.startsWith('gpt-')) {
    if (customApiKey) {
      const customOpenAI = createOpenAI({ apiKey: customApiKey });
      return customOpenAI(apiModelId);
    }
    return openai(apiModelId);
  } else if (modelId.startsWith('claude-')) {
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
      const customNvidia = createOpenAI({
        baseURL: "https://integrate.api.nvidia.com/v1",
        apiKey: customApiKey,
      });
      return customNvidia.chat(apiModelId);
    }
    return nvidia.chat(apiModelId);
  }

  throw new Error(`Unknown model ID: ${modelId}`);
}

/**
 * User-facing provider display info.
 */
export const PROVIDER_INFO: Record<AIProviderKey, { name: string; icon: string }> = {
  gpt: { name: "GPT", icon: "openai" },
  claude: { name: "Claude", icon: "anthropic" },
  gemini: { name: "Gemini", icon: "google" },
  kimi: { name: "Kimi K2.5", icon: "nvidia" },
};
