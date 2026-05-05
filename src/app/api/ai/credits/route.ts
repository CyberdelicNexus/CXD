import { NextResponse } from "next/server";
import { createClient } from "@/supabase/server";
import type { AIProviderKey } from "@/types/ai-types";
import { AI_MODELS, type ModelId, getAllowedModels, type TierId } from "@/lib/ai-credit-config";
import { getPlan } from "@/lib/plans";

// Route uses cookies() via Supabase auth — force dynamic so Next.js
// doesn't try to statically pre-render it at build time.
export const dynamic = 'force-dynamic';

// Check if a Supabase error indicates the table doesn't exist
function isTableMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    (error.message || "").includes("schema cache") ||
    (error.message || "").includes("does not exist")
  );
}

// Default credits when table hasn't been created yet
function defaultCredits(userId: string, model: string = "gemini-2.0-flash") {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  return {
    userId,
    monthlyAllowance: 50, // Free tier default
    usedThisPeriod: 0,
    addonCredits: 0,
    periodStart: now.toISOString(),
    periodEnd: periodEnd.toISOString(),
    selectedModel: model,
  };
}

// GET - Fetch user's credit balance
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get or create credits row
    let { data: credits, error } = await supabase
      .from("ai_credits")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      // If the table doesn't exist, return defaults
      if (isTableMissing(error)) {
        console.warn("[AI Credits] Table not found — returning defaults. Run migrations to fix.");
        return NextResponse.json({ credits: defaultCredits(user.id) });
      }
      console.error("[AI Credits GET Error]", error);
      return NextResponse.json({ error: "Failed to fetch credits" }, { status: 500 });
    }

    // Auto-provision if no row exists
    if (!credits) {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      // Get user's subscription to determine allowance
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan_id')
        .eq('user_id', user.id)
        .single();

      const plan = getPlan(subscription?.plan_id || 'free');
      const allowance = plan.limits.monthlyAICredits;

      const { data: newCredits, error: insertError } = await supabase
        .from("ai_credits")
        .insert({
          user_id: user.id,
          monthly_allowance: allowance,
          used_this_period: 0,
          addon_credits: 0,
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
          selected_model: "gemini-2.0-flash",
        })
        .select()
        .single();

      if (insertError) {
        if (isTableMissing(insertError)) {
          return NextResponse.json({ credits: defaultCredits(user.id) });
        }
        console.error("[AI Credits Insert Error]", insertError);
        return NextResponse.json({ error: "Failed to create credits" }, { status: 500 });
      }

      credits = newCredits;
    }

    // Check if period has expired and reset
    if (credits && new Date(credits.period_end) < new Date()) {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const { data: updated, error: updateError } = await supabase
        .from("ai_credits")
        .update({
          used_this_period: 0,
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
        })
        .eq("user_id", user.id)
        .select()
        .single();

      if (!updateError && updated) {
        credits = updated;
      }
    }

    return NextResponse.json({
      credits: {
        userId: credits.user_id,
        monthlyAllowance: credits.monthly_allowance,
        usedThisPeriod: credits.used_this_period,
        addonCredits: credits.addon_credits,
        periodStart: credits.period_start,
        periodEnd: credits.period_end,
        selectedModel: credits.selected_model,
      },
    });
  } catch (error) {
    console.error("[AI Credits GET Error]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PUT - Update model selection
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { selectedModel } = body as { selectedModel: ModelId };

    // Validate model ID against config
    if (!selectedModel || !AI_MODELS[selectedModel as ModelId]) {
      return NextResponse.json({ error: "Invalid model" }, { status: 400 });
    }

    // Check if user's tier allows this model
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', user.id)
      .single();

    const planId = subscription?.plan_id || 'free';
    const allowedModels = getAllowedModels(planId as TierId);

    if (!allowedModels.includes(selectedModel as ModelId)) {
      return NextResponse.json(
        { error: "Model not available in your plan" },
        { status: 403 }
      );
    }

    const { data: credits, error } = await supabase
      .from("ai_credits")
      .update({ selected_model: selectedModel })
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      if (isTableMissing(error)) {
        console.warn("[AI Credits] Table not found — returning defaults. Run migrations to fix.");
        return NextResponse.json({ credits: defaultCredits(user.id, selectedModel) });
      }
      console.error("[AI Credits PUT Error]", error);
      return NextResponse.json({ error: "Failed to update model" }, { status: 500 });
    }

    return NextResponse.json({
      credits: {
        userId: credits.user_id,
        monthlyAllowance: credits.monthly_allowance,
        usedThisPeriod: credits.used_this_period,
        addonCredits: credits.addon_credits,
        periodStart: credits.period_start,
        periodEnd: credits.period_end,
        selectedModel: credits.selected_model,
      },
    });
  } catch (error) {
    console.error("[AI Credits PUT Error]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
