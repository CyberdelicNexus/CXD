import { streamText, convertToModelMessages } from "ai";
import { NextResponse } from "next/server";
import { createClient } from "@/supabase/server";
import { getModelConfig, getModelInstance, getModelInstanceByModelId, MODEL_ID_MAP } from "@/lib/ai/provider-registry";
import { getFaceSystemPrompt, getCoreSystemPrompt, getGeneralSystemPrompt } from "@/lib/ai/system-prompts";
import { checkRateLimit, recordRequest } from "@/lib/ai/rate-limiter";
import { canBringOwnKeys, type ModelId } from "@/lib/ai-credit-config";
import { decryptAPIKey } from "@/lib/encryption";
import type { AIProviderKey, AIProjectContext, FaceContext } from "@/types/ai-types";
import { CREDIT_COSTS } from "@/types/ai-types";
import { retrieveKnowledge, buildSearchQuery } from "@/lib/ai/knowledge-retrieval";

export const maxDuration = 60;

export async function POST(request: Request) {
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
    }: {
      messages: Array<{ id?: string; role: string; parts?: Array<{ type: string; text?: string }>; content?: string }>;
      faceKey: string;
      projectContext: AIProjectContext;
      faceContext?: FaceContext;
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
          console.error('[BYOK Decryption Error]', error);
          // Fall back to default key if decryption fails
          userApiKey = undefined;
        }
      }
    }

    // 4. Rate limit check
    const rateCheck = checkRateLimit(user.id, "chat");
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again shortly.", retryAfterMs: rateCheck.retryAfterMs },
        { status: 429 },
      );
    }

    // 5. Credit check and deduction (skip if using BYOK)
    if (!userApiKey) {
      const creditCost = CREDIT_COSTS.chat[resolvedProvider] || 1;
      const { error: creditError } = await supabase.rpc(
        "deduct_ai_credits",
        { p_user_id: user.id, p_cost: creditCost },
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
        } else if (msg.includes("insufficient")) {
          return NextResponse.json(
            { error: "Insufficient credits. Upgrade your plan or wait for monthly reset." },
            { status: 402 },
          );
        } else {
          console.error("[AI Credit Error]", creditError);
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
        .filter((m: any) => m.role === 'user')
        .pop();

      if (latestMessage) {
        const messageText = latestMessage.parts
          ?.filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join(' ') || latestMessage.content || '';

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

    // 10. Stream the response
    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      temperature: 0.7,
    });

    return result.toTextStreamResponse({
      headers: {
        "x-ai-provider": resolvedProvider,
        "x-ai-model": apiModelId,
        "x-byok-enabled": userApiKey ? "true" : "false",
        "x-selected-model": selectedModel,
      },
    });
  } catch (error) {
    console.error("[AI Chat Error]", error);

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
