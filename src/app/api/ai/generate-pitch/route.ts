import { generateObject } from "ai";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/supabase/server";
import { getModelInstance, getModelConfig } from "@/lib/ai/provider-registry";
import { checkRateLimit, recordRequest, acquireConcurrencySlot, releaseConcurrencySlot } from "@/lib/ai/rate-limiter";
import { getDailyCreditCap } from "@/lib/ai/cost-tracking";
import {
  generatePitchSchema,
  sanitizePitchSections,
  buildPitchPrompt,
  PITCH_SYSTEM_PROMPT,
  PITCH_MAX_PROMPT_LEN,
  PITCH_SECTION_KINDS,
  type PitchProjectSummary,
  type PitchBuilderOptions,
  type PitchSectionKind,
} from "@/lib/ai/pitch-generation";
import type { AIProviderKey } from "@/types/ai-types";
import { CREDIT_COSTS } from "@/types/ai-types";

// Map model IDs to provider keys (model IDs may arrive from client as provider)
const modelToProvider: Record<string, AIProviderKey> = {
  "gemini-2.0-flash": "gemini",
  "kimi": "kimi",
  "claude-haiku-4.5": "claude",
  "gemini-2.5-pro": "gemini",
  "claude-sonnet-4.5": "claude",
  "claude-opus-4.6": "claude",
};

export const maxDuration = 180;

function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message || "";
  const code = error.code || "";
  return (
    code === "PGRST202" || code === "PGRST205" || code === "42P01" ||
    msg.includes("schema cache") || msg.includes("Could not find") || msg.includes("does not exist")
  );
}

// Bound the incoming summary so a hostile/oversized body can't reach the model.
function boundSummary(input: unknown): PitchProjectSummary | null {
  if (!input || typeof input !== "object") return null;
  const s = input as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const labeled = (v: unknown) =>
    Array.isArray(v)
      ? v
          .slice(0, 8)
          .map((i) => {
            const r = (i || {}) as Record<string, unknown>;
            return { label: str(r.label, 60), value: str(r.value, 600) };
          })
          .filter((i) => i.value)
      : [];
  const sensory = Array.isArray(s.sensory)
    ? s.sensory
        .slice(0, 12)
        .map((i) => {
          const r = (i || {}) as Record<string, unknown>;
          return { label: str(r.label, 40), value: Math.max(0, Math.min(100, Number(r.value) || 0)) };
        })
        .filter((i) => i.value > 0)
    : [];

  return {
    name: str(s.name, 200) || "Untitled Experience",
    mainConcept: str(s.mainConcept, 600),
    coreMessage: str(s.coreMessage, 600),
    desiredChange: labeled(s.desiredChange),
    personas: labeled(s.personas),
    sensory,
    stats: labeled(s.stats),
  };
}

function boundOptions(input: unknown): PitchBuilderOptions {
  const o = (input || {}) as Record<string, unknown>;
  const sections = Array.isArray(o.sections)
    ? (o.sections.filter(
        (k): k is PitchSectionKind => typeof k === "string" && (PITCH_SECTION_KINDS as readonly string[]).includes(k),
      ) as PitchSectionKind[])
    : [];
  return {
    theme: o.theme === "light" ? "light" : "dark",
    accent: typeof o.accent === "string" ? o.accent.slice(0, 16) : "#8b5cf6",
    includeImages: o.includeImages !== false,
    sections,
    length: o.length === "single" ? "single" : "deck",
  };
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
    const {
      prompt = "",
      summary,
      options,
      provider = "gemini",
    }: {
      prompt?: string;
      summary?: unknown;
      options?: unknown;
      provider?: AIProviderKey;
    } = body;

    if (typeof prompt !== "string" || prompt.length > PITCH_MAX_PROMPT_LEN) {
      return NextResponse.json({ error: "Emphasis prompt is too long." }, { status: 413 });
    }

    const boundedSummary = boundSummary(summary);
    if (!boundedSummary) {
      return NextResponse.json({ error: "Missing required field: summary" }, { status: 400 });
    }
    const boundedOptions = boundOptions(options);

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
        console.warn("[AI GeneratePitch] deduct_ai_credits RPC not found - skipping. Run migrations to fix.");
      } else {
        console.error("[AI GeneratePitch Credit Error]", creditError);
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
        console.warn("[AI GeneratePitch] no record for user; allowing request and relying on /api/ai/credits to provision");
      }
    }

    // 5. Build prompt
    const userPrompt = buildPitchPrompt(boundedSummary, boundedOptions, prompt);

    // 6. Model + record
    const modelConfig = getModelConfig(resolvedProvider, "analysis");
    const model = getModelInstance(resolvedProvider, "analysis");
    recordRequest(user.id, "analysis");

    // 7. Generate structured pitch (120s timeout, abort on client disconnect)
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 120000);
    if (request.signal.aborted) {
      abortController.abort();
    } else {
      request.signal.addEventListener("abort", () => abortController.abort(), { once: true });
    }

    let result;
    try {
      result = await generateObject({
        model,
        system: PITCH_SYSTEM_PROMPT,
        prompt: userPrompt,
        schema: generatePitchSchema,
        maxOutputTokens: modelConfig.maxTokens,
        ...(modelConfig.isReasoning ? {} : { temperature: 0.6 }),
        abortSignal: abortController.signal,
      });
    } finally {
      clearTimeout(timeoutId);
      releaseConcurrency();
    }

    // 8. Server-side sanitize before returning to the client
    const sections = sanitizePitchSections(
      result.object.sections,
      boundedOptions.sections.length > 0 ? boundedOptions.sections : undefined,
    );
    if (sections.length === 0) {
      return NextResponse.json(
        { error: "The model produced no usable sections. Try rephrasing the request." },
        { status: 422 },
      );
    }

    return NextResponse.json({ sections, usage: result.usage });
  } catch (error) {
    await releaseConcurrency();
    console.error("[AI GeneratePitch Error]", error);

    Sentry.captureException(error, {
      tags: { route: "ai/generate-pitch" },
    });

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
      { error: "AI generation failed. Please try again or switch to a different model." },
      { status: 500 },
    );
  }
}
