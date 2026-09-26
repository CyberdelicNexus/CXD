import { NextResponse } from "next/server";
import { z } from "zod";
import { labGate } from "@/lib/lab/http";
import { previewPromotion, promoteCell } from "@/lib/lab/library-store";
import { getInputs, listRuns } from "@/lib/lab/runner";
import type { Cell } from "@/lib/lab/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function findCell(cellId: string): Promise<Cell | undefined> {
  return (await listRuns()).flatMap((r) => r.cells).find((c) => c.id === cellId);
}

/** Preview: is this cell eligible, what would it add, and why not when it is not. */
export async function GET(request: Request) {
  const gate = labGate(request);
  if (gate) return gate;
  const cellId = new URL(request.url).searchParams.get("cellId") ?? "";
  const cell = cellId ? await findCell(cellId) : undefined;
  if (!cell) return NextResponse.json({ error: "cell not found" }, { status: 404 });
  const input = (await getInputs()).find((i) => i.id === cell.inputId);
  return NextResponse.json(await previewPromotion(cell, input));
}

// Request validation only; this schema is never sent to a model.
const bodySchema = z.object({
  cellId: z.string().min(1),
  note: z.string().trim().min(1, "Write a one-line note saying why this map is good.").max(200),
  title: z.string().max(120).default(""),
  labels: z.array(z.string().max(30)).max(8).default([]),
});

export async function POST(request: Request) {
  const gate = labGate(request);
  if (gate) return gate;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid promotion" }, { status: 400 });
  const cell = await findCell(parsed.data.cellId);
  if (!cell) return NextResponse.json({ error: "cell not found" }, { status: 404 });
  const input = (await getInputs()).find((i) => i.id === cell.inputId);
  try {
    const out = await promoteCell(cell, input, parsed.data);
    return NextResponse.json(out, { status: 201 });
  } catch (e) {
    // (Matched by name too: a dev hot reload can leave two copies of the class.)
    if ((e as Error)?.name === "LibraryConflictError") return NextResponse.json({ error: (e as Error).message }, { status: 409 });
    throw e;
  }
}
