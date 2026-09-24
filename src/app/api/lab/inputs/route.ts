import { NextResponse } from "next/server";
import { z } from "zod";
import { labGate } from "@/lib/lab/http";
import { getInputs } from "@/lib/lab/runner";
import { saveCustomInput } from "@/lib/lab/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = labGate();
  if (gate) return gate;
  return NextResponse.json({ inputs: await getInputs() });
}

const bodySchema = z.object({
  title: z.string().trim().min(1).max(120),
  type: z.enum(["brainDump", "canvasCards", "topic", "comparison"]),
  text: z.string().trim().min(1).max(8000),
  cards: z.array(z.object({ title: z.string().max(120), body: z.string().max(500) })).max(30).default([]),
});

export async function POST(request: Request) {
  const gate = labGate();
  if (gate) return gate;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid input" }, { status: 400 });
  const input = { id: `custom-${Date.now()}`, ...parsed.data, expectedTypes: [], custom: true };
  await saveCustomInput(input);
  return NextResponse.json({ input }, { status: 201 });
}
