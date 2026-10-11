import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/supabase/server";
import { refundAICredits } from "@/lib/ai/credit-refund";

// Records one Canvas Assistant beta event (see the migration
// 20261011000002_assistant_feedback_and_credit_refund.sql). No model call and
// no credits: this is the training signal, so it must be cheap and must never
// get in the user's way. Every failure answers 2xx with stored:false.

const MAX_PAYLOAD_BYTES = 120_000;

// A rating earns one credit back: a small thank-you that makes feedback worth
// a tap. Guarded so it cannot be farmed. It is only given for a diagram this
// user actually built (a `built` row exists for the entry), once per diagram,
// and a limited number of times a day; and the "credit" is a refund, which can
// only ever lower what the user has already spent, never add beyond it.
const RATING_REWARD_CREDITS = 1;
const RATING_REWARDS_PER_DAY = 10;

const bodySchema = z.object({
  entryId: z.string().min(1).max(80),
  event: z.enum(["form_picked", "built", "discarded", "refined", "rated", "removed"]),
  projectId: z.string().max(80).optional(),
  rating: z.union([z.literal(1), z.literal(-1)]).optional(),
  reason: z.string().max(400).optional(),
  instruction: z.string().max(4000).optional(),
  model: z.string().max(80).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
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
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid feedback event." }, { status: 400 });
    }
    const e = parsed.data;
    if (e.event === "rated" && e.rating === undefined) {
      return NextResponse.json({ error: "A rating needs a value." }, { status: 400 });
    }

    // A snapshot of a large diagram can be big; drop it rather than the event.
    let payload = e.payload ?? {};
    if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) {
      const { snapshot: _dropped, ...rest } = payload as Record<string, unknown>;
      payload = { ...rest, snapshotDropped: true };
    }

    let earnsCredit = false;
    if (e.event === "rated") {
      const since = new Date();
      since.setUTCHours(0, 0, 0, 0);
      const [built, already, today] = await Promise.all([
        supabase.from("canvas_assistant_feedback").select("id", { count: "exact", head: true })
          .eq("user_id", user.id).eq("entry_id", e.entryId).eq("event", "built"),
        supabase.from("canvas_assistant_feedback").select("id", { count: "exact", head: true })
          .eq("user_id", user.id).eq("entry_id", e.entryId).eq("event", "rated"),
        supabase.from("canvas_assistant_feedback").select("id", { count: "exact", head: true })
          .eq("user_id", user.id).eq("event", "rated").gte("created_at", since.toISOString()),
      ]);
      earnsCredit =
        !built.error && !already.error && !today.error &&
        (built.count ?? 0) > 0 && (already.count ?? 0) === 0 && (today.count ?? 0) < RATING_REWARDS_PER_DAY;
    }

    const { error } = await supabase.from("canvas_assistant_feedback").insert({
      user_id: user.id,
      project_id: e.projectId ?? null,
      entry_id: e.entryId,
      event: e.event,
      rating: e.event === "rated" ? e.rating : null,
      reason: e.reason ?? null,
      instruction: e.instruction ?? null,
      model: e.model ?? null,
      payload,
    });

    if (error) {
      if (isMissing(error)) {
        console.warn("[AI CanvasFeedback] table not found — run the assistant feedback migration.");
      } else {
        console.error("[AI CanvasFeedback]", error);
        Sentry.captureException(error, { tags: { route: "ai/canvas-feedback" } });
      }
      return NextResponse.json({ stored: false }, { status: 202 });
    }
    if (earnsCredit) {
      await refundAICredits(user.id, RATING_REWARD_CREDITS, "ai/canvas-feedback");
    }
    return NextResponse.json({ stored: true, credited: earnsCredit });
  } catch (error) {
    Sentry.captureException(error, { tags: { route: "ai/canvas-feedback" } });
    return NextResponse.json({ stored: false }, { status: 202 });
  }
}
