import { NextResponse } from "next/server";
import { createClient } from "@/supabase/server";
import { checkRateLimit, recordRequest } from "@/lib/ai/rate-limiter";
import { jevConfigured, rankFormsWithJev } from "@/lib/ai/jev";
import { FORMS, suggestForms } from "@/lib/ai/assistant-forms";

// Which diagram form fits this content? Answered by Jev when it is configured
// and quick enough, otherwise by the local rules. No credits: it is a
// sub-second decision that only orders the choices the user is about to see.

export const maxDuration = 15;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { content?: unknown } | null;
  const content = typeof body?.content === "string" ? body.content.slice(0, 6000) : "";
  if (!content.trim()) {
    return NextResponse.json({ error: "Missing content." }, { status: 400 });
  }

  const rules = suggestForms(content);
  if (!jevConfigured()) {
    return NextResponse.json({ options: rules, source: "rules" });
  }

  // Shares the light chat bucket; over the limit just means "use the rules".
  const { data: sub } = await supabase.from("subscriptions").select("plan_id").eq("user_id", user.id).single();
  const rate = await checkRateLimit(user.id, "chat", sub?.plan_id || "free");
  if (!rate.allowed) {
    return NextResponse.json({ options: rules, source: "rules" });
  }
  recordRequest(user.id, "chat");

  const ranking = await rankFormsWithJev(content, request.signal);
  if (!ranking) {
    return NextResponse.json({ options: rules, source: "rules" });
  }
  const options = ranking.ranked.slice(0, 3).map(({ form }) => ({
    id: form,
    label: FORMS[form].label,
    hint: FORMS[form].hint,
  }));
  return NextResponse.json({ options, source: "jev", confidence: ranking.confidence });
}
