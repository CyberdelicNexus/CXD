import { streamText, convertToModelMessages } from "ai";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/supabase/server";
import { getModelConfig, getModelInstance, getModelInstanceByModelId, MODEL_ID_MAP } from "@/lib/ai/provider-registry";
import { getFaceSystemPrompt, getCoreSystemPrompt, getGeneralSystemPrompt, getCanvasSystemPrompt } from "@/lib/ai/system-prompts";
import { checkRateLimit, recordRequest, acquireConcurrencySlot, releaseConcurrencySlot } from "@/lib/ai/rate-limiter";
import { canBringOwnKeys, type ModelId } from "@/lib/ai-credit-config";
import { getDailyCreditCap } from "@/lib/ai/cost-tracking";
import { decryptAPIKey } from "@/lib/encryption";
import type { AIProviderKey, AIProjectContext, FaceContext } from "@/types/ai-types";
import { CREDIT_COSTS } from "@/types/ai-types";
import { retrieveKnowledge, buildSearchQuery } from "@/lib/ai/knowledge-retrieval";

export const maxDuration = 60;

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

    // 2. Parse request body (v6 sends UIMessages with parts[], plus extra body fields)
    const body = await request.json();
    const {
      messages: rawMessages,
      faceKey,
      projectContext,
      faceContext,
      canvasSelection,
    }: {
      messages: Array<{ id?: string; role: string; parts?: Array<{ type: string; text?: string }>; content?: string }>;
      faceKey: string;
      projectContext: AIProjectContext;
      faceContext?: FaceContext;
      canvasSelection?: { count: number; titles: string[] };
    } = body;

    if (!rawMessages || !faceKey || !projectContext) {
      return NextResponse.json(
        { error: "Missing required fields: messages, faceKey, projectContext" },
        { status: 400 },
      );
    }

    // 2b. Fetch user's selected model from database
    const { data: credits } = await supabase
      .from('ai_credits')
      .select('selected_model')
      .eq('user_id', user.id)
      .single();

    const selectedModel = credits?.selected_model || 'gemini-2.0-flash';

    // Map model ID to provider
    const modelToProvider: Record<string, AIProviderKey> = {
      'gemini-2.0-flash': 'gemini',
      'kimi': 'kimi',
      'claude-haiku-4.5': 'claude',
      'gemini-2.5-pro': 'gemini',
      'claude-sonnet-4.5': 'claude',
      'claude-opus-4.6': 'claude',
    };

    const resolvedProvider: AIProviderKey = modelToProvider[selectedModel] || 'gemini';

    console.log(`[AI Chat] Using model: ${selectedModel}, provider: ${resolvedProvider}`);

    // 3. Check for BYOK (Bring Your Own Key)
    let userApiKey: string | undefined;
    let hasBYOK = false;

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', user.id)
      .single();

    hasBYOK = canBringOwnKeys(subscription?.plan_id || 'free');

    if (hasBYOK) {
      // Map provider to BYOK provider names
      const providerMap: Record<AIProviderKey, string> = {
        claude: 'anthropic',
        gemini: 'google',
        kimi: 'moonshot',
      };

      const byokProvider = providerMap[resolvedProvider];

      // Fetch user's active API key for this provider
      const { data: keyData } = await supabase
        .from('user_api_keys')
        .select('encrypted_key')
        .eq('user_id', user.id)
        .eq('provider', byokProvider)
        .eq('is_active', true)
        .single();

      if (keyData?.encrypted_key) {
        try {
          userApiKey = decryptAPIKey(keyData.encrypted_key);
          console.log(`[BYOK] Using user's ${byokProvider} API key`);
        } catch (error) {
          console.error(`[BYOK Decryption Error] user=${user.id} provider=${byokProvider}`, error);
          // Fall back to default key if decryption fails
          userApiKey = undefined;
        }
      }
    }

    // 4. Rate limit check (per-tier limits)
    const rateCheck = await checkRateLimit(user.id, "chat", subscription?.plan_id || 'free');
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again shortly.", retryAfterMs: rateCheck.retryAfterMs },
        { status: 429 },
      );
    }

    // 4b. Concurrent-stream cap (cost runaway protection: one user can't hold N streams open)
    if (!(await acquireConcurrencySlot(user.id))) {
      return NextResponse.json(
        { error: "Too many concurrent AI requests. Wait for the previous one to finish." },
        { status: 429 },
      );
    }
    concurrencyHeldFor = user.id;

    // 5. Credit check and deduction (skip if using BYOK)
    if (!userApiKey) {
      const creditCost = CREDIT_COSTS.chat[resolvedProvider] || 1;
      const dailyCap = getDailyCreditCap(subscription?.plan_id || 'free');

      const { data: creditResult, error: creditError } = await supabase.rpc(
        "deduct_ai_credits",
        { p_user_id: user.id, p_cost: creditCost, p_daily_cap: dailyCap },
      );

      if (creditError) {
        const msg = creditError.message || "";
        const code = creditError.code || "";
        const isMissing =
          code === "PGRST202" || code === "PGRST205" || code === "42P01" ||
          msg.includes("schema cache") || msg.includes("Could not find") || msg.includes("does not exist");

        if (isMissing) {
          // RPC or table doesn't exist yet — skip credit deduction
          console.warn("[AI Credits] deduct_ai_credits RPC not found — skipping. Run migrations to fix.");
        } else {
          console.error("[AI Credit Error]", creditError);
        }
      }

      // The RPC returns a JSONB object; business-logic failures land in `data`,
      // not `error`. Surface them with a clear 402.
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
          // Auto-provision happens in /api/ai/credits — let the request through
          // and the user's first GET will create their row.
          console.warn("[AI Credits] no record for user; allowing request and relying on GET to provision");
        }
      }
    } else {
      console.log('[BYOK] Skipping credit deduction - using user API key');
    }

    // 5.5. Retrieve relevant knowledge context (non-blocking, graceful fallback)
    let knowledgeContextBlock = '';
    try {
      // Extract latest user message for semantic search
      const latestMessage = rawMessages
        .filter((m: { role: string }) => m.role === 'user')
        .pop();

      if (latestMessage) {
        const msg = latestMessage as { parts?: { type: string; text?: string }[]; content?: string };
        const messageText = msg.parts
          ?.filter((p) => p.type === 'text')
          .map((p) => p.text)
          .join(' ') || msg.content || '';

        const searchQuery = buildSearchQuery(messageText, {
          projectName: projectContext.projectName,
          coreMessage: projectContext.framing?.intentionCore?.coreMessage,
          faceKey,
        });

        const knowledge = await retrieveKnowledge(searchQuery, {
          matchCount: 3,           // Keep context window small
          similarityThreshold: 0.5,  // Lowered from 0.72 for better recall
        });

        console.log('[AI Chat] Knowledge retrieval results:', {
          resultCount: knowledge.retrievalMeta.resultCount,
          avgSimilarity: knowledge.retrievalMeta.avgSimilarity,
          queryUsed: knowledge.retrievalMeta.queryUsed.slice(0, 100),
        });

        knowledgeContextBlock = knowledge.contextBlock;
      }
    } catch (err) {
      // Knowledge retrieval failure must never block chat
      console.warn('[AI Chat] Knowledge retrieval failed, continuing without:', err);
    }

    // 6. Build system prompt based on faceKey (with knowledge context)
    let systemPrompt: string;
    if (faceKey === "general") {
      systemPrompt = getGeneralSystemPrompt(projectContext);
    } else if (faceKey === "core") {
      systemPrompt = getCoreSystemPrompt(projectContext);
    } else if (faceKey === "canvas") {
      systemPrompt = getCanvasSystemPrompt(projectContext, canvasSelection);
    } else if (faceContext) {
      systemPrompt = getFaceSystemPrompt(faceKey, faceContext, projectContext);
    } else {
      systemPrompt = getGeneralSystemPrompt(projectContext);
    }

    // Append knowledge context if available
    if (knowledgeContextBlock) {
      systemPrompt += '\n\n' + knowledgeContextBlock;
    }

    // 7. Get model instance for the specific model (with BYOK if available)
    const model = getModelInstanceByModelId(selectedModel as ModelId, userApiKey);
    const apiModelId = MODEL_ID_MAP[selectedModel as ModelId];

    // 8. Record the request for rate limiting
    recordRequest(user.id, "chat");

    // 9. Convert UIMessages to ModelMessages for streamText
    const modelMessages = await convertToModelMessages(rawMessages as any);

    // 10. Stream the response (60s timeout, abort on client disconnect)
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 60000);

    // Forward client disconnect (tab close, navigate away) to model so we stop billing tokens
    // and release the concurrency slot.
    const onAbort = () => {
      abortController.abort();
      clearTimeout(timeoutId);
      releaseConcurrency();
    };
    if (request.signal.aborted) {
      onAbort();
    } else {
      request.signal.addEventListener("abort", onAbort, { once: true });
    }

    // streamText delivers provider/stream failures to onError (they fire AFTER
    // the HTTP 200 status line is committed) rather than throwing — so a bad
    // model ID or provider outage yields an EMPTY stream, which the UI shows as
    // a blank assistant bubble with no error. Track the error and append a
    // visible message to the text stream so the user actually sees a failure.
    let streamError: unknown = null;

    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      temperature: 0.7,
      abortSignal: abortController.signal,
      onFinish: () => {
        clearTimeout(timeoutId);
        releaseConcurrency();
      },
      onError: ({ error }) => {
        clearTimeout(timeoutId);
        releaseConcurrency();
        streamError = error;
        // Capture so provider outages and bad model IDs surface in Sentry.
        Sentry.captureException(error, {
          tags: { route: "ai/chat", phase: "streamText" },
          extra: { provider: resolvedProvider, model: selectedModel },
        });
      },
    });

    // Pipe text deltas through manually. TextStreamChatTransport (client) reads
    // the body as raw UTF-8 text, so plain concatenated deltas are compatible.
    // On error (delivered to onError, not thrown) append a user-visible notice.
    const modelLabel = getModelConfig(resolvedProvider, "chat").displayName;
    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const delta of result.textStream) {
            controller.enqueue(encoder.encode(delta));
          }
        } catch (err) {
          streamError = streamError ?? err;
        }
        if (streamError) {
          controller.enqueue(
            encoder.encode(
              `\n\nThe selected AI model (${modelLabel}) is currently unavailable. Please switch to another model or try again shortly.`,
            ),
          );
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "x-ai-provider": resolvedProvider,
        "x-ai-model": apiModelId,
        "x-byok-enabled": userApiKey ? "true" : "false",
        "x-selected-model": selectedModel,
      },
    });
  } catch (error) {
    await releaseConcurrency();
    console.error("[AI Chat Error]", error);

    // Tag with route + provider/model so provider outages cluster cleanly in Sentry.
    Sentry.captureException(error, {
      tags: { route: "ai/chat" },
    });

    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("API key") || message.includes("authentication")) {
      return NextResponse.json(
        { error: "The selected AI model is temporarily unavailable. Try switching to another model or retry in a moment." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
