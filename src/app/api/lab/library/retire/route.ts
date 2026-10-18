import { NextResponse } from "next/server";
import { z } from "zod";
import { labGate } from "@/lib/lab/http";
import { retireExample } from "@/lib/lab/library-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = labGate(request);
  if (gate) return gate;
  const parsed = z.object({ id: z.string().min(1), undo: z.boolean().default(false) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    return NextResponse.json({ state: await retireExample(parsed.data.id, parsed.data.undo) });
  } catch (e) {
    const name = (e as Error)?.name;
    if (name === "LibraryConflictError") return NextResponse.json({ error: (e as Error).message }, { status: 409 });
    if (name === "LibraryNotFoundError") return NextResponse.json({ error: (e as Error).message }, { status: 404 });
    throw e;
  }
}
