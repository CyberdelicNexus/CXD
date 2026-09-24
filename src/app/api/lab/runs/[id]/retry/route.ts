import { NextResponse } from "next/server";
import { z } from "zod";
import { labGate } from "@/lib/lab/http";
import { LabConflictError, retryCell } from "@/lib/lab/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const gate = labGate(request);
  if (gate) return gate;
  const parsed = z.object({ cellId: z.string().min(1) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "cellId required" }, { status: 400 });
  let run;
  try {
    run = await retryCell(params.id, parsed.data.cellId);
  } catch (e) {
    // Refused for a reason the user can act on (over budget, already done): shown inline on the cell.
    // (Matched by name too: a dev hot reload can leave two copies of the class.)
    if (e instanceof LabConflictError || (e as Error)?.name === "LabConflictError") return NextResponse.json({ error: (e as Error).message }, { status: 409 });
    throw e;
  }
  return run ? NextResponse.json({ run }) : NextResponse.json({ error: "run not found" }, { status: 404 });
}
