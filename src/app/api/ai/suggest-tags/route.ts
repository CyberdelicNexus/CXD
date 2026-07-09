import { generateObject } from "ai";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/supabase/server";
import { getModelInstance, getModelConfig } from "@/lib/ai/provider-registry";
import { checkRateLimit, recordRequest, acquireConcurrencySlot, releaseConcurrencySlot } from "@/lib/ai/rate-limiter";
import { getDailyCreditCap } from "@/lib/ai/cost-tracking";
import {
  tagSuggestionSchema,
  sanitizeSuggestions,
  buildTagSuggestionPrompt,
  TAG_SUGGESTION_SYSTEM_PROMPT,
  MAX_TAGGABLE_ITEMS,
  MAX_ITEM_TEXT,
  type TaggableItem,
} from "@/lib/ai/tag-suggestion";
import type { AIProviderKey } from "@/types/ai-types";
import { CREDIT_COSTS } from "@/types/ai-types";

// Map model IDs to provider keys (model IDs may arrive from client as provider)
const modelToProvider: Record<string, AIProviderKey> = {
  'gemini-2.0-flash': 'gemini',
  'kimi': 'kimi',
  'claude-haiku-4.5': 'claude',
  'gemini-2.5-pro': 'gemini',
  'claude-sonnet-4.5': 'claude',
  'claude-opus-4.6': 'claude',
};

export const maxDuration = 120;

function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message || "";
  const code = error.code || "";
  return (
    code === "PGRST202" || code === "PGRST205" || code === "42P01" ||
    msg.includes("schema cache") || msg.includes("Could not find") || msg.includes("does not exist")
  );
}

export async function POST(request: Request) {
  let concurrencyHeldFor: string | null = null;
  const releaseConcurrency = async () => {
    if (concurrencyHeldFor) {
      const userId = concurrencyHeldFor;
      concurrencyHeldFor = null;
      try { await releaseConcurrencySlot(userId); } catch { /* noop */ }
    }
  };

  try {
    // 1. Authenticate
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse + validate body
    const body = await request.json();
    const { items: rawItems, provider = "gemini" }: { items: TaggableItem[]; provider: AIProviderKey } = body;

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json({ error: "Missing required field: items" }, { status: 400 });
    }

    // Sanitize/bound the input server-side (don't trust client sizes)
    const items: TaggableItem[] = rawItems
      .filter((it) => it && typeof it.id === "string" && typeof it.text === "string" && it.text.trim().length >= 3)
      .slice(0, MAX_TAGGABLE_ITEMS)
      .map((it) => ({ id: it.id, text: it.text.slice(0, MAX_ITEM_TEXT) }));

    if (items.length === 0) {
      return NextResponse.json({ error: "No classifiable elements provided." }, { status: 400 });
    }

    const resolvedProvider: AIProviderKey = modelToProvider[provider] || (provider as AIProviderKey);

    // 3. Rate limit (shares the analysis bucket) + concurrency cap
    const { data: subForRate } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', user.id)
      .single();
    const callerPlan = subForRate?.plan_id || 'free';
    const rateCheck = await checkRateLimit(user.id, "analysis", callerPlan);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again shortly.", retryAfterMs: rateCheck.retryAfterMs },
        { status: 429 },
      );
    }

    if (!(await acquireConcurrencySlot(user.id))) {
      return NextResponse.json(
        { error: "Too many concurrent AI requests. Wait for the previous one to finish." },
        { status: 429 },
      );
    }
    concurrencyHeldFor = user.id;

    // 4. Credit deduction — classification is cheap (the 'suggestion' tier)
    const creditCost = CREDIT_COSTS.suggestion[resolvedProvider] || 1;
    const dailyCap = getDailyCreditCap(callerPlan);

    const { data: creditResult, error: creditError } = await supabase.rpc(
      "deduct_ai_credits",
      { p_user_id: user.id, p_cost: creditCost, p_daily_cap: dailyCap },
    );

    if (creditError) {
      if (isMissing(creditError)) {
        console.warn("[AI SuggestTags] deduct_ai_credits RPC not found — skipping. Run migrations to fix.");
      } else {
        console.error("[AI SuggestTags Credit Error]", creditError);
      }
    }

    if (creditResult && (creditResult as { success?: boolean }).success === false) {
      const result = creditResult as { error?: string; message?: string; used_today?: number; daily_cap?: number };
      if (result.error === 'daily_cap_reached') {
        await releaseConcurrency();
        return NextResponse.json(
          {
            error: result.message ?? "Daily AI usage limit reached. Resets at UTC midnight.",
            usedToday: result.used_today,
            dailyCap: result.daily_cap,
          },
          { status: 402 },
        );
      }
      if (result.error === 'insufficient_credits') {
        await releaseConcurrency();
        return NextResponse.json(
          { error: "Insufficient credits. Upgrade your plan or wait for monthly reset." },
          { status: 402 },
        );
      }
      if (result.error === 'no_credits_record') {
        console.warn("[AI SuggestTags] no record for user; allowing request and relying on /api/ai/credits to provision");
      }
    }

    // 5. Model + record. Classification is a light task → 'chat' tier (cheapest).
    const modelConfig = getModelConfig(resolvedProvider, "chat");
    const model = getModelInstance(resolvedProvider, "chat");
    recordRequest(user.id, "analysis");

    // 6. Classify (90s timeout, abort on client disconnect)
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 90000);
    if (request.signal.aborted) {
      abortController.abort();
    } else {
      request.signal.addEventListener("abort", () => abortController.abort(), { once: true });
    }

    let result;
    try {
      result = await generateObject({
        model,
        system: TAG_SUGGESTION_SYSTEM_PROMPT,
        prompt: buildTagSuggestionPrompt(items),
        schema: tagSuggestionSchema,
        maxOutputTokens: modelConfig.maxTokens,
        ...(modelConfig.isReasoning ? {} : { temperature: 0.2 }),
        abortSignal: abortController.signal,
      });
    } finally {
      clearTimeout(timeoutId);
      releaseConcurrency();
    }

    // 7. Validate against known ids/tags before returning
    const validIds = new Set(items.map((it) => it.id));
    const suggestions = sanitizeSuggestions(result.object.suggestions, validIds);

    return NextResponse.json({
      suggestions,
      considered: items.length,
      usage: result.usage,
    });
  } catch (error) {
    await releaseConcurrency();
    console.error("[AI SuggestTags Error]", error);

    Sentry.captureException(error, {
      tags: { route: "ai/suggest-tags" },
    });

    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("timeout") || message.includes("TIMEOUT") || message.includes("ETIMEDOUT")) {
      return NextResponse.json(
        { error: "Tag suggestion timed out. Try again or use fewer elements." },
        { status: 504 },
      );
    }
    if (message.includes("API key") || message.includes("authentication") || message.includes("Incorrect API key")) {
      return NextResponse.json(
        { error: "The selected AI model is temporarily unavailable. Try switching to another model." },
        { status: 503 },
      );
    }
    if (message.includes("rate") || message.includes("quota") || message.includes("429")) {
      return NextResponse.json(
        { error: "AI provider rate limit reached. Please wait a moment and try again." },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: "Tag suggestion failed. Please try again or switch to a different model." },
      { status: 500 },
    );
  }
}
