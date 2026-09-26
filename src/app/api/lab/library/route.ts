import { NextResponse } from "next/server";
import { labGate } from "@/lib/lab/http";
import { listLibrary } from "@/lib/lab/library-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = labGate(request);
  if (gate) return gate;
  return NextResponse.json(await listLibrary());
}
