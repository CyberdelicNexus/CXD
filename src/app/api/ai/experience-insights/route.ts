import { generateObject } from "ai";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/supabase/server";
import { getModelInstance, getModelConfig } from "@/lib/ai/provider-registry";
import { checkRateLimit, recordRequest, acquireConcurrencySlot, releaseConcurrencySlot } from "@/lib/ai/rate-limiter";
import { getDailyCreditCap } from "@/lib/ai/cost-tracking";
import {
  experienceInsightsSchema,
  boundInsightsInput,
  buildInsightsPrompt,
  sanitizeInsights,
  INSIGHTS_SYSTEM_PROMPT,
} from "@/lib/ai/experience-insights";
import type { AIProviderKey } from "@/types/ai-types";
import { CREDIT_COSTS } from "@/types/ai-types";

const modelToProvider: Record<string, AIProviderKey> = {
  "gemini-2.0-flash": "gemini",
  "kimi": "kimi",
  "claude-haiku-4.5": "claude",
  "gemini-2.5-pro": "gemini",
  "claude-sonnet-4.5": "claude",
  "claude-opus-4.6": "claude",
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

    // 2. Parse + bound request
    const body = await request.json();
    const { input, provider = "gemini" }: { input?: unknown; provider?: AIProviderKey } = body;

    const boundedInput = boundInsightsInput(input);
    if (!boundedInput) {
      return NextResponse.json({ error: "Missing required field: input" }, { status: 400 });
    }

    const resolvedProvider: AIProviderKey = modelToProvider[provider] || (provider as AIProviderKey);

    // 3. Rate limit (shares the analysis bucket) + concurrency cap
    const { data: subForRate } = await supabase
      .from("subscriptions")
      .select("plan_id")
      .eq("user_id", user.id)
      .single();
    const callerPlan = subForRate?.plan_id || "free";
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

    // 4. Credit deduction - gracefully skip if tables/RPC not deployed yet
    const creditCost = CREDIT_COSTS.analyze[resolvedProvider] || 8;
    const dailyCap = getDailyCreditCap(callerPlan);

    const { data: creditResult, error: creditError } = await supabase.rpc(
      "deduct_ai_credits",
      { p_user_id: user.id, p_cost: creditCost, p_daily_cap: dailyCap },
    );

    if (creditError) {
      if (isMissing(creditError)) {
        console.warn("[AI ExperienceInsights] deduct_ai_credits RPC not found - skipping. Run migrations to fix.");
      } else {
        console.error("[AI ExperienceInsights Credit Error]", creditError);
      }
    }

    if (creditResult && (creditResult as { success?: boolean }).success === false) {
      const result = creditResult as { error?: string; message?: string; used_today?: number; daily_cap?: number };
      if (result.error === "daily_cap_reached") {
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
      if (result.error === "insufficient_credits") {
        await releaseConcurrency();
        return NextResponse.json(
          { error: "Insufficient credits. Upgrade your plan or wait for monthly reset." },
          { status: 402 },
        );
      }
      if (result.error === "no_credits_record") {
        console.warn("[AI ExperienceInsights] no record for user; allowing request and relying on /api/ai/credits to provision");
      }
    }

    // 5. Build prompt
    const userPrompt = buildInsightsPrompt(boundedInput);

    // 6. Model + record
    const modelConfig = getModelConfig(resolvedProvider, "analysis");
    const model = getModelInstance(resolvedProvider, "analysis");
    recordRequest(user.id, "analysis");

    // 7. Generate (90s timeout, abort on client disconnect)
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
        system: INSIGHTS_SYSTEM_PROMPT,
        prompt: userPrompt,
        schema: experienceInsightsSchema,
        maxOutputTokens: modelConfig.maxTokens,
        ...(modelConfig.isReasoning ? {} : { temperature: 0.5 }),
        abortSignal: abortController.signal,
      });
    } finally {
      clearTimeout(timeoutId);
      releaseConcurrency();
    }

    // 8. Server-side sanitize before returning
    const insights = sanitizeInsights(result.object);
    if (!insights.summary && insights.recommendations.length === 0) {
      return NextResponse.json(
        { error: "The model produced no usable insights. Try again." },
        { status: 422 },
      );
    }

    return NextResponse.json({ insights, usage: result.usage });
  } catch (error) {
    await releaseConcurrency();
    console.error("[AI ExperienceInsights Error]", error);
    Sentry.captureException(error, { tags: { route: "ai/experience-insights" } });

    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("timeout") || message.includes("TIMEOUT") || message.includes("ETIMEDOUT")) {
      return NextResponse.json(
        { error: "AI generation timed out. Try again or switch to a different model." },
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
      { error: "AI insights failed. Please try again." },
      { status: 500 },
    );
  }
}
