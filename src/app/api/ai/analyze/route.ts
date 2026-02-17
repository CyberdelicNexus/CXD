import { generateText } from "ai";
import { NextResponse } from "next/server";
import { createClient } from "@/supabase/server";
import { getModelInstance, getModelConfig } from "@/lib/ai/provider-registry";
import {
  getAnalysisPrompt,
  getHolisticAnalysisPrompt,
  getCoreSystemPrompt,
  getGeneralSystemPrompt,
} from "@/lib/ai/system-prompts";
import { checkRateLimit, recordRequest } from "@/lib/ai/rate-limiter";
import type { AIProviderKey, AIProjectContext, FaceContext } from "@/types/ai-types";
import { CREDIT_COSTS } from "@/types/ai-types";

export const maxDuration = 180;

// Check if a Supabase error indicates a missing table/RPC
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
  try {
    // 1. Authenticate
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request
    const body = await request.json();
    const {
      faceKey,
      projectContext,
      faceContext,
      provider = "gpt",
      analysisType = "face",
    }: {
      faceKey: string;
      projectContext: AIProjectContext;
      faceContext?: FaceContext;
      provider: AIProviderKey;
      analysisType: "face" | "holistic" | "erd";
    } = body;

    if (!faceKey || !projectContext) {
      return NextResponse.json(
        { error: "Missing required fields: faceKey, projectContext" },
        { status: 400 },
      );
    }

    // 3. Rate limit check
    const rateCheck = checkRateLimit(user.id, "analysis");
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded for analysis. Try again shortly.", retryAfterMs: rateCheck.retryAfterMs },
        { status: 429 },
      );
    }

    // 4. Credit deduction — gracefully skip if tables/RPC not deployed yet
    const costKey = analysisType === "erd" ? "erd" : "analyze";
    const creditCost = (CREDIT_COSTS as Record<string, Record<string, number>>)[costKey]?.[provider] || 5;
    const { error: creditError } = await supabase.rpc(
      "deduct_ai_credits",
      { p_user_id: user.id, p_cost: creditCost },
    );

    if (creditError) {
      if (isMissing(creditError)) {
        console.warn("[AI Analyze] deduct_ai_credits RPC not found — skipping. Run migrations to fix.");
      } else if ((creditError.message || "").includes("insufficient")) {
        return NextResponse.json(
          { error: "Insufficient credits. Upgrade your plan or wait for monthly reset." },
          { status: 402 },
        );
      } else {
        console.error("[AI Analyze Credit Error]", creditError);
      }
    }

    // 5. Build prompt based on analysis type
    let systemPrompt: string;
    let userPrompt: string;

    if (analysisType === "holistic") {
      systemPrompt = getGeneralSystemPrompt(projectContext);
      userPrompt = getHolisticAnalysisPrompt(projectContext);
    } else if (analysisType === "erd") {
      systemPrompt = getGeneralSystemPrompt(projectContext);
      userPrompt = body.erdPrompt || getHolisticAnalysisPrompt(projectContext);
    } else {
      if (faceKey === "core") {
        systemPrompt = getCoreSystemPrompt(projectContext);
        userPrompt = getHolisticAnalysisPrompt(projectContext);
      } else if (faceContext) {
        systemPrompt = getGeneralSystemPrompt(projectContext);
        userPrompt = getAnalysisPrompt(faceKey, faceContext, projectContext);
      } else {
        systemPrompt = getGeneralSystemPrompt(projectContext);
        userPrompt = getHolisticAnalysisPrompt(projectContext);
      }
    }

    // 6. Get model instance + config
    const modelConfig = getModelConfig(provider as AIProviderKey, "analysis");
    const model = getModelInstance(provider as AIProviderKey, "analysis");

    // 7. Record the request
    recordRequest(user.id, "analysis");

    // 8. Generate full response (non-streaming for analysis)
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: analysisType === "erd" ? 8192 : modelConfig.maxTokens,
      ...(modelConfig.isReasoning ? {} : { temperature: 0.5 }),
    });

    return NextResponse.json({
      content: result.text,
      usage: result.usage,
    });
  } catch (error) {
    console.error("[AI Analysis Error]", error);

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

    if (message.includes("context") || message.includes("token") || message.includes("too long")) {
      return NextResponse.json(
        { error: "Project context is too large. Try reducing canvas elements." },
        { status: 413 },
      );
    }

    // Include partial error message for debugging
    return NextResponse.json(
      { error: `Generation failed: ${message.substring(0, 150)}` },
      { status: 500 },
    );
  }
}
