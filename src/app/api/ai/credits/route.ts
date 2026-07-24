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
    monthlyAllowance: 25, // Free tier monthly drip (see PLANS.FREE)
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

    // Check if period has expired and reset. The reset also RE-SYNCS the
    // monthly allowance from the user's current plan — this is how existing
    // rows pick up plan-config changes (e.g. the free tier's 25/month drip)
    // and how upgrades/downgrades take effect at rollover without a backfill.
    if (credits && new Date(credits.period_end) < new Date()) {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan_id')
        .eq('user_id', user.id)
        .single();
      const currentAllowance = getPlan(subscription?.plan_id || 'free').limits.monthlyAICredits;

      const { data: updated, error: updateError } = await supabase
        .from("ai_credits")
        .update({
          used_this_period: 0,
          monthly_allowance: currentAllowance,
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
        })
        .eq("user_id", user.id)
        .select()
        .single();

      if (!updateError && updated) {
        credits = updated;
      }
    } else if (credits) {
      // Self-heal mid-period drift: the row's allowance can go stale relative
      // to plans.ts (a subscription-table DB trigger also writes this column
      // independently — see 20260724000001_free_tier_monthly_credit_drip.sql
      // for the class of bug this guards against). Patch just the allowance,
      // not used/period fields, so a config bump takes effect immediately
      // without granting an unearned mid-period usage reset.
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan_id')
        .eq('user_id', user.id)
        .single();
      const currentAllowance = getPlan(subscription?.plan_id || 'free').limits.monthlyAICredits;

      if (currentAllowance !== credits.monthly_allowance) {
        const { data: updated, error: updateError } = await supabase
          .from("ai_credits")
          .update({ monthly_allowance: currentAllowance })
          .eq("user_id", user.id)
          .select()
          .single();

        if (!updateError && updated) {
          credits = updated;
        }
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
