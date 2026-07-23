/**
 * AI Credit System Configuration
 *
 * Credit Weight Methodology:
 * - 1 credit = baseline cost unit (Gemini 2.0 Flash)
 * - Weights calculated based on actual API pricing per 1K conversation
 * - Average conversation: 1,000 input tokens + 500 output tokens
 * - Pricing researched February 2026
 *
 * Sources:
 * - Anthropic: https://platform.claude.com/docs/en/about-claude/pricing
 * - Google: https://ai.google.dev/gemini-api/docs/pricing
 * - Moonshot: https://platform.moonshot.ai/docs/pricing/chat
 */

export const AI_MODELS = {
  // Google Gemini (Cheapest - Baseline)
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    creditWeight: 1,
    pricing: {
      input: 0.10,  // per 1M tokens
      output: 0.40,
    },
    contextWindow: 1_000_000,
    features: ['fast', 'cost-effective', 'multimodal'],
    tier: 'budget',
  },
  'kimi': {
    id: 'kimi',
    name: 'Kimi K2.6',
    provider: 'moonshot',
    creditWeight: 6,
    pricing: {
      input: 0.60,
      output: 2.50,
    },
    contextWindow: 1_000_000,
    features: ['long-context', 'chinese', 'smart'],
    tier: 'standard',
  },
  'claude-haiku-4.5': {
    id: 'claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    creditWeight: 12,
    pricing: {
      input: 1.00,
      output: 5.00,
    },
    contextWindow: 200_000,
    features: ['fast', 'efficient', 'smart'],
    tier: 'standard',
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    creditWeight: 33,
    pricing: {
      input: 2.50,
      output: 15.00,
    },
    contextWindow: 2_000_000,
    features: ['smart', 'long-context', 'multimodal'],
    tier: 'premium',
  },
  'claude-sonnet-4.5': {
    id: 'claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    creditWeight: 35,
    pricing: {
      input: 3.00,
      output: 15.00,
    },
    contextWindow: 200_000,
    features: ['balanced', 'smart', 'creative'],
    tier: 'premium',
  },
  'claude-opus-4.6': {
    id: 'claude-opus-4.6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    creditWeight: 58,
    pricing: {
      input: 5.00,
      output: 25.00,
    },
    contextWindow: 200_000,
    features: ['most-capable', 'reasoning', 'creative'],
    tier: 'flagship',
  },
} as const;

export type ModelId = keyof typeof AI_MODELS;

/**
 * Models that exist in the type system / pricing config but are intentionally
 * hidden from user-facing pickers. Use when an API tier doesn't expose the
 * underlying model — keeping the IDs registered prevents type churn elsewhere
 * but the UI shouldn't offer them.
 *
 * Currently hiding Claude Haiku 4.5 and Opus 4.6 — Anthropic account only
 * exposes Sonnet 4 right now. Re-enable by removing from this list when the
 * tier is upgraded.
 */
export const HIDDEN_MODEL_IDS: readonly ModelId[] = [
  'claude-haiku-4.5',
  'claude-opus-4.6',
];

export function isModelVisible(id: ModelId): boolean {
  return !HIDDEN_MODEL_IDS.includes(id);
}

/**
 * Tier Credit Allowances
 *
 * Credit allocation philosophy:
 * - Free: 25 monthly drip + 50 signup bonus (one-time), standard models only.
 *   The drip (vs. one-time-and-dead) keeps the AI surface alive month after
 *   month — a monthly re-activation ping and a recurring moment of hitting
 *   the ceiling while engaged, which is where upgrades happen. Costs ~nothing
 *   (25 credits ≈ 12-25 cheap-model chats).
 * - Pro: 500 monthly credits for professional daily use
 * - Lifetime: 0 monthly + 1000 one-time credits + BYOK option
 * - Beta Tester: Early supporter benefit (Pro equivalent)
 */
export const TIER_CREDIT_ALLOWANCES = {
  free: {
    monthlyCredits: 25,  // Monthly drip — keep in sync with PLANS.FREE.limits.monthlyAICredits
    signupBonusCredits: 50,  // One-time 50 credit signup bonus
    allowedModels: ['gemini-2.0-flash', 'kimi'] as ModelId[],  // Standard models only
    canBYOK: false,
  },
  pro: {
    monthlyCredits: 500,  // ~500 Gemini Flash or ~83 Kimi or ~14 Sonnet conversations or ~8 Opus conversations
    allowedModels: [
      'gemini-2.0-flash',
      'kimi',
      'claude-haiku-4.5',
      'gemini-2.5-pro',
      'claude-sonnet-4.5',
      'claude-opus-4.6',
    ] as ModelId[],
    canBYOK: true,  // Pro users can now bring their own API keys
  },
  lifetime: {
    monthlyCredits: 0,  // No monthly credits - use BYOK or one-time credits
    lifetimeCredits: 1000,  // One-time 1000 credits on signup/upgrade
    allowedModels: [
      'gemini-2.0-flash',
      'kimi',
      'claude-haiku-4.5',
      'gemini-2.5-pro',
      'claude-sonnet-4.5',
      'claude-opus-4.6',
    ] as ModelId[],
    canBYOK: true,  // Can bring own API keys (no credit deduction when using BYOK)
  },
  beta_tester: {
    monthlyCredits: 500,  // Same as Pro
    allowedModels: [
      'gemini-2.0-flash',
      'kimi',
      'claude-haiku-4.5',
      'gemini-2.5-pro',
      'claude-sonnet-4.5',
    ] as ModelId[],
    canBYOK: false,
  },
} as const;

export type TierId = keyof typeof TIER_CREDIT_ALLOWANCES;

/**
 * Get model credit weight
 */
export function getModelCreditWeight(modelId: ModelId): number {
  return AI_MODELS[modelId]?.creditWeight ?? 1;
}

/**
 * Get allowed models for a tier
 */
export function getAllowedModels(tierId: TierId): ModelId[] {
  return TIER_CREDIT_ALLOWANCES[tierId]?.allowedModels ?? ['gemini-2.0-flash'];
}

/**
 * Check if user can use a model
 */
export function canUseModel(tierId: TierId, modelId: ModelId): boolean {
  const allowedModels = getAllowedModels(tierId);
  return allowedModels.includes(modelId);
}

/**
 * Get monthly credit allowance for tier
 */
export function getMonthlyAllowance(tierId: TierId): number {
  return TIER_CREDIT_ALLOWANCES[tierId]?.monthlyCredits ?? 50;
}

/**
 * Calculate credits consumed by a request
 */
export function calculateCreditsConsumed(
  modelId: ModelId,
  inputTokens: number,
  outputTokens: number
): number {
  const weight = getModelCreditWeight(modelId);

  // Each "credit" represents the cost of 1K tokens on Gemini Flash
  // Scale other models proportionally based on their weight
  const totalTokens = inputTokens + outputTokens;
  const creditsPerThousandTokens = weight;

  return Math.ceil((totalTokens / 1000) * creditsPerThousandTokens);
}

/**
 * Get model by ID with fallback
 */
export function getModel(modelId: string) {
  return AI_MODELS[modelId as ModelId] ?? AI_MODELS['gemini-2.0-flash'];
}

/**
 * Check if user has BYOK capability
 */
export function canBringOwnKeys(tierId: TierId): boolean {
  return TIER_CREDIT_ALLOWANCES[tierId]?.canBYOK ?? false;
}

/**
 * Get best model within credit budget
 */
export function getBestModelInBudget(
  tierId: TierId,
  availableCredits: number
): ModelId {
  const allowedModels = getAllowedModels(tierId);

  // Filter models user can afford (at least 1 conversation)
  const affordableModels = allowedModels.filter(
    modelId => getModelCreditWeight(modelId) <= availableCredits
  );

  if (affordableModels.length === 0) {
    return allowedModels[0]; // Return cheapest allowed model
  }

  // Return most capable affordable model (highest weight)
  return affordableModels.reduce((best, current) => {
    return getModelCreditWeight(current) > getModelCreditWeight(best)
      ? current
      : best;
  });
}

/**
 * Format credit count for display
 */
export function formatCredits(credits: number): string {
  if (credits >= 1000) {
    return `${(credits / 1000).toFixed(1)}k`;
  }
  return credits.toString();
}

/**
 * Estimate conversations remaining
 */
export function estimateConversationsRemaining(
  credits: number,
  modelId: ModelId
): number {
  const weight = getModelCreditWeight(modelId);
  return Math.floor(credits / weight);
}
