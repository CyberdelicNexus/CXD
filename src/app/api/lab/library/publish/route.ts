import { NextResponse } from "next/server";
import { labGate } from "@/lib/lab/http";
import { publishLibrary } from "@/lib/lab/library-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Writes into src/: dev-only (labGate 404s in production) and same-origin JSON only. */
export async function POST(request: Request) {
  const gate = labGate(request);
  if (gate) return gate;
  try {
    return NextResponse.json(await publishLibrary());
  } catch (e) {
    if ((e as Error)?.name === "LibraryConflictError") return NextResponse.json({ error: (e as Error).message }, { status: 409 });
    return NextResponse.json({ error: `Publish failed and was rolled back: ${(e as Error).message}` }, { status: 500 });
  }
}
