import { NextResponse } from "next/server";
import { z } from "zod";
import { labGate } from "@/lib/lab/http";
import { retryCell } from "@/lib/lab/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const gate = labGate(request);
  if (gate) return gate;
  const parsed = z.object({ cellId: z.string().min(1) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "cellId required" }, { status: 400 });
  const run = await retryCell(params.id, parsed.data.cellId);
  return run ? NextResponse.json({ run }) : NextResponse.json({ error: "run not found" }, { status: 404 });
}
