import { generateObject } from "ai";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/supabase/server";
import { getModelInstance, getModelConfig } from "@/lib/ai/provider-registry";
import { checkRateLimit, recordRequest, acquireConcurrencySlot, releaseConcurrencySlot } from "@/lib/ai/rate-limiter";
import { getDailyCreditCap } from "@/lib/ai/cost-tracking";
import {
  edgeInsightSchema,
  sanitizeEdgeInsight,
  buildEdgeInsightPrompt,
  EDGE_INSIGHT_SYSTEM_PROMPT,
  EDGE_INSIGHT_MODES,
  MAX_EDGE_ELEMENTS,
  MAX_EDGE_ELEMENT_TEXT,
  MAX_HYPOTHESIS_LEN,
  type EdgeInsightElement,
  type EdgeInsightMode,
} from "@/lib/ai/edge-insight";
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
    const {
      faceA: rawFaceA,
      faceB: rawFaceB,
      aCount: rawACount,
      bCount: rawBCount,
      sharedCount: rawSharedCount,
      elements: rawElements,
      hypothesis: rawHypothesis,
      mode: rawMode,
      provider = "gemini",
    }: {
      faceA?: string;
      faceB?: string;
      aCount?: number;
      bCount?: number;
      sharedCount?: number;
      elements?: EdgeInsightElement[];
      hypothesis?: string;
      mode?: string;
      provider?: AIProviderKey;
    } = body;

    const faceA = typeof rawFaceA === "string" ? rawFaceA.slice(0, 80).trim() : "";
    const faceB = typeof rawFaceB === "string" ? rawFaceB.slice(0, 80).trim() : "";
    if (!faceA || !faceB) {
      return NextResponse.json({ error: "Missing required fields: faceA, faceB" }, { status: 400 });
    }

    // Sanitize/bound the input server-side (don't trust client sizes).
    const elements: EdgeInsightElement[] = (Array.isArray(rawElements) ? rawElements : [])
      .filter((el) => el && typeof el.text === "string" && el.text.trim().length > 0)
      .slice(0, MAX_EDGE_ELEMENTS)
      .map((el) => ({ text: el.text.slice(0, MAX_EDGE_ELEMENT_TEXT) }));

    if (elements.length === 0) {
      return NextResponse.json({ error: "No shared elements to analyze." }, { status: 400 });
    }

    const mode: EdgeInsightMode = EDGE_INSIGHT_MODES.includes(rawMode as EdgeInsightMode)
      ? (rawMode as EdgeInsightMode)
      : "analyze";
    const hypothesis =
      typeof rawHypothesis === "string" ? rawHypothesis.slice(0, MAX_HYPOTHESIS_LEN) : undefined;
    const clampCount = (n: unknown): number =>
      typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), 9999) : 0;
    const aCount = clampCount(rawACount);
    const bCount = clampCount(rawBCount);
    const sharedCount = clampCount(rawSharedCount) || elements.length;

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

    // 4. Credit deduction — a light generative task (the 'suggestion' tier).
    const creditCost = CREDIT_COSTS.suggestion[resolvedProvider] || 1;
    const dailyCap = getDailyCreditCap(callerPlan);

    const { data: creditResult, error: creditError } = await supabase.rpc(
      "deduct_ai_credits",
      { p_user_id: user.id, p_cost: creditCost, p_daily_cap: dailyCap },
    );

    if (creditError) {
      if (isMissing(creditError)) {
        console.warn("[AI EdgeInsight] deduct_ai_credits RPC not found — skipping. Run migrations to fix.");
      } else {
        console.error("[AI EdgeInsight Credit Error]", creditError);
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
        console.warn("[AI EdgeInsight] no record for user; allowing request and relying on /api/ai/credits to provision");
      }
    }

    // 5. Model + record. A light sense-making task → 'chat' tier (cheapest).
    const modelConfig = getModelConfig(resolvedProvider, "chat");
    const model = getModelInstance(resolvedProvider, "chat");
    recordRequest(user.id, "analysis");

    // 6. Generate (90s timeout, abort on client disconnect)
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
        system: EDGE_INSIGHT_SYSTEM_PROMPT,
        prompt: buildEdgeInsightPrompt({ faceA, faceB, aCount, bCount, sharedCount, elements, hypothesis, mode }),
        schema: edgeInsightSchema,
        maxOutputTokens: modelConfig.maxTokens,
        ...(modelConfig.isReasoning ? {} : { temperature: 0.5 }),
        abortSignal: abortController.signal,
      });
    } finally {
      clearTimeout(timeoutId);
      releaseConcurrency();
    }

    // 7. Validate/clamp before returning — never hand raw model output to the client.
    const insight = sanitizeEdgeInsight(result.object);

    return NextResponse.json({
      insight,
      mode,
      considered: elements.length,
      usage: result.usage,
    });
  } catch (error) {
    await releaseConcurrency();
    console.error("[AI EdgeInsight Error]", error);

    Sentry.captureException(error, {
      tags: { route: "ai/edge-insight" },
    });

    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("timeout") || message.includes("TIMEOUT") || message.includes("ETIMEDOUT")) {
      return NextResponse.json(
        { error: "Analysis timed out. Try again or use a simpler edge." },
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
      { error: "Analysis failed. Please try again or switch to a different model." },
      { status: 500 },
    );
  }
}
