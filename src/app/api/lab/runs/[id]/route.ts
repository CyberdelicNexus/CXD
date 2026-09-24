import { NextResponse } from "next/server";
import { labGate } from "@/lib/lab/http";
import { getRun } from "@/lib/lab/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = labGate();
  if (gate) return gate;
  const run = await getRun(params.id);
  return run ? NextResponse.json({ run }) : NextResponse.json({ error: "run not found" }, { status: 404 });
}
