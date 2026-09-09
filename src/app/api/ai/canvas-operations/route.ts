import { generateObject } from "ai";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/supabase/server";
import { getModelInstance, getModelConfig } from "@/lib/ai/provider-registry";
import { getGeneralSystemPrompt } from "@/lib/ai/system-prompts";
import { checkRateLimit, recordRequest, acquireConcurrencySlot, releaseConcurrencySlot } from "@/lib/ai/rate-limiter";
import { getDailyCreditCap } from "@/lib/ai/cost-tracking";
import { canvasOperationsSchema, sanitizeCanvasOperations, CANVAS_OPERATIONS_GUIDE } from "@/lib/ai/canvas-operations";
import type { AIProviderKey, AIProjectContext } from "@/types/ai-types";
import { CREDIT_COSTS } from "@/types/ai-types";
import type { CanvasInventory } from "@/types/ai-operations";

// Model IDs may arrive from the client in the `provider` field.
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

    // 2. Parse + bound
    const body = await request.json();
    const {
      instruction,
      projectContext,
      inventory,
      provider = "gemini",
    }: {
      instruction: string;
      projectContext?: AIProjectContext;
      inventory: CanvasInventory;
      provider: AIProviderKey;
    } = body;

    if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
      return NextResponse.json({ error: "Missing required field: instruction" }, { status: 400 });
    }
    if (instruction.length > 12000) {
      return NextResponse.json({ error: "Instruction too long." }, { status: 413 });
    }
    if (!inventory || !Array.isArray(inventory.elements) || inventory.elements.length > 200) {
      return NextResponse.json({ error: "Invalid canvas inventory." }, { status: 400 });
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

    // 4. Credit deduction — gracefully skip if tables/RPC not deployed yet
    const creditCost = CREDIT_COSTS.canvasOperations[resolvedProvider] || 4;
    const dailyCap = getDailyCreditCap(callerPlan);
    const { data: creditResult, error: creditError } = await supabase.rpc(
      "deduct_ai_credits",
      { p_user_id: user.id, p_cost: creditCost, p_daily_cap: dailyCap },
    );

    if (creditError) {
      if (isMissing(creditError)) {
        console.warn("[AI CanvasOps] deduct_ai_credits RPC not found — skipping. Run migrations to fix.");
      } else {
        console.error("[AI CanvasOps Credit Error]", creditError);
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
        console.warn("[AI CanvasOps] no record for user; allowing request and relying on /api/ai/credits to provision");
      }
    }

    // 5. Prompts: project context + ops guide as system; inventory + instruction as user prompt
    const systemPrompt =
      (projectContext ? getGeneralSystemPrompt(projectContext) : "You are the CXD canvas assistant.") +
      "\n" + CANVAS_OPERATIONS_GUIDE;
    const userPrompt =
      `Canvas inventory (${inventory.totalCount} elements total${inventory.truncated ? ", truncated to the most relevant" : ""}):\n` +
      JSON.stringify(inventory.elements) +
      `\n\nSelected element ids: ${JSON.stringify(inventory.selectedIds)}` +
      `\n\nInstruction:\n${instruction.trim()}`;

    // 6. Model + record
    const modelConfig = getModelConfig(resolvedProvider, "analysis");
    const model = getModelInstance(resolvedProvider, "analysis");
    recordRequest(user.id, "analysis");

    // 7. Generate structured operations (90s timeout, abort on client disconnect)
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
        system: systemPrompt,
        prompt: userPrompt,
        schema: canvasOperationsSchema,
        maxOutputTokens: modelConfig.maxTokens,
        ...(modelConfig.isReasoning ? {} : { temperature: 0.3 }),
        abortSignal: abortController.signal,
      });
    } finally {
      clearTimeout(timeoutId);
      releaseConcurrency();
    }

    // 8. Server-side sanitize — the client never applies raw model output
    const proposal = sanitizeCanvasOperations(result.object, inventory);

    // A model that hallucinates ids produces a confident reply with nothing to
    // approve; surface that rather than letting it fail silently.
    if (proposal.droppedCount > 0) {
      console.warn(
        `[AI CanvasOps] dropped ${proposal.droppedCount} unusable operation row(s) ` +
        `(kept ${proposal.rows.length}) for user=${user.id} model=${resolvedProvider}`,
      );
    }

    return NextResponse.json({ proposal, usage: result.usage });
  } catch (error) {
    await releaseConcurrency();
    console.error("[AI CanvasOps Error]", error);

    Sentry.captureException(error, { tags: { route: "ai/canvas-operations" } });

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
      { error: "Couldn't build a change set. Try rephrasing the request." },
      { status: 500 },
    );
  }
}
