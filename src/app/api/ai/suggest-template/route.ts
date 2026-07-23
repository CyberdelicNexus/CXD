import { generateObject } from "ai";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { createClient } from "@/supabase/server";
import { getModelInstance, getModelConfig } from "@/lib/ai/provider-registry";
import { checkRateLimit, recordRequest, acquireConcurrencySlot, releaseConcurrencySlot } from "@/lib/ai/rate-limiter";
import { getDailyCreditCap } from "@/lib/ai/cost-tracking";
import { TEMPLATES, FREE_TEMPLATE_IDS } from "@/lib/templates";
import { getTemplateAccess } from "@/lib/plans";
import type { AIProviderKey } from "@/types/ai-types";
import { CREDIT_COSTS } from "@/types/ai-types";

// The AI template composer: given the user's completed framing (summary text),
// pick the best starting template from the curated catalog. Cheap 'chat'-tier
// classification — the catalog is small and the answer is one id.

const modelToProvider: Record<string, AIProviderKey> = {
  "gemini-2.0-flash": "gemini",
  "kimi": "kimi",
  "claude-haiku-4.5": "claude",
  "gemini-2.5-pro": "gemini",
  "claude-sonnet-4.5": "claude",
  "claude-opus-4.6": "claude",
};

export const maxDuration = 60;

const MAX_SUMMARY_LEN = 8000;

const suggestionSchema = z.object({
  templateId: z.string().describe("The id of the single best-fitting template from the catalog"),
  reason: z.string().max(240).describe("One sentence, addressed to the user, explaining why this template fits their framing"),
});

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

    // 2. Parse + bound
    const body = await request.json();
    const { summary, provider = "gemini" }: { summary?: unknown; provider?: AIProviderKey } = body;
    if (typeof summary !== "string" || summary.trim().length === 0) {
      return NextResponse.json({ error: "Missing required field: summary" }, { status: 400 });
    }
    if (summary.length > MAX_SUMMARY_LEN) {
      return NextResponse.json({ error: "Summary too long" }, { status: 413 });
    }
    const resolvedProvider: AIProviderKey = modelToProvider[provider] || (provider as AIProviderKey);

    // 3. Rate limit + concurrency
    const { data: subForRate } = await supabase
      .from("subscriptions")
      .select("plan_id")
      .eq("user_id", user.id)
      .single();
    const callerPlan = subForRate?.plan_id || "free";
    const rateCheck = await checkRateLimit(user.id, "chat", callerPlan);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again shortly.", retryAfterMs: rateCheck.retryAfterMs },
        { status: 429 },
      );
    }
    if (!(await acquireConcurrencySlot(user.id))) {
      return NextResponse.json(
        { error: "Too many concurrent AI requests." },
        { status: 429 },
      );
    }
    concurrencyHeldFor = user.id;

    // 4. Credits (cheap suggestion tier) — gracefully skip if RPC missing
    const creditCost = CREDIT_COSTS.suggestion[resolvedProvider] || 2;
    const dailyCap = getDailyCreditCap(callerPlan);
    const { data: creditResult, error: creditError } = await supabase.rpc(
      "deduct_ai_credits",
      { p_user_id: user.id, p_cost: creditCost, p_daily_cap: dailyCap },
    );
    if (creditError && !isMissing(creditError)) {
      console.error("[AI SuggestTemplate Credit Error]", creditError);
    }
    if (creditResult && (creditResult as { success?: boolean }).success === false) {
      const result = creditResult as { error?: string; message?: string };
      if (result.error === "daily_cap_reached" || result.error === "insufficient_credits") {
        await releaseConcurrency();
        return NextResponse.json(
          { error: result.message ?? "Not enough AI credits." },
          { status: 402 },
        );
      }
    }

    // 5. Prompt — catalog is authoritative on the server, never from the
    // client. Free-tier callers only see the quickstart set: the Composer
    // must never recommend a template the caller can't insert.
    const availableTemplates =
      getTemplateAccess(callerPlan) === "full"
        ? TEMPLATES
        : TEMPLATES.filter((t) => FREE_TEMPLATE_IDS.has(t.id));
    const catalog = availableTemplates.map(
      (t) => `- id: ${t.id} | ${t.name} (${t.category}) — ${t.description}`,
    ).join("\n");
    const prompt = [
      "The user just completed the framing of an experience-design project. Their framing summary:",
      "",
      summary,
      "",
      "Available starting templates:",
      catalog,
      "",
      "Pick the ONE template that best kick-starts THIS project's design work, and explain why in one sentence addressed to the user.",
    ].join("\n");

    // 6. Model (cheap chat tier)
    const modelConfig = getModelConfig(resolvedProvider, "chat");
    const model = getModelInstance(resolvedProvider, "chat");
    recordRequest(user.id, "chat");

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 45000);
    if (request.signal.aborted) abortController.abort();
    else request.signal.addEventListener("abort", () => abortController.abort(), { once: true });

    let result;
    try {
      result = await generateObject({
        model,
        prompt,
        schema: suggestionSchema,
        maxOutputTokens: Math.min(modelConfig.maxTokens, 400),
        ...(modelConfig.isReasoning ? {} : { temperature: 0.2 }),
        abortSignal: abortController.signal,
      });
    } finally {
      clearTimeout(timeoutId);
      releaseConcurrency();
    }

    // 7. Sanitize: the id must exist in the caller's AVAILABLE catalog —
    // validating against the full list would let a hallucinated Pro id
    // slip through to a free user.
    const chosen = availableTemplates.find((t) => t.id === result.object.templateId);
    if (!chosen) {
      return NextResponse.json(
        { error: "Model chose an unknown template.", templateId: null },
        { status: 422 },
      );
    }
    return NextResponse.json({
      templateId: chosen.id,
      templateName: chosen.name,
      reason: result.object.reason.slice(0, 240),
    });
  } catch (error) {
    await releaseConcurrency();
    console.error("[AI SuggestTemplate Error]", error);
    Sentry.captureException(error, { tags: { route: "ai/suggest-template" } });
    return NextResponse.json(
      { error: "Template suggestion failed." },
      { status: 500 },
    );
  }
}
