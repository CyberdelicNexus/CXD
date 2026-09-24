import { NextResponse } from "next/server";
import { z } from "zod";
import { labGate } from "@/lib/lab/http";
import { allCells, appendVote } from "@/lib/lab/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  leftCellId: z.string().min(1),
  rightCellId: z.string().min(1),
  winner: z.enum(["left", "right", "tie"]),
  reason: z.string().max(500).default(""),
  repeat: z.boolean().default(false),
});

export async function POST(request: Request) {
  const gate = labGate();
  if (gate) return gate;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid vote" }, { status: 400 });
  const cells = await allCells();
  const left = cells.find((c) => c.id === parsed.data.leftCellId);
  const right = cells.find((c) => c.id === parsed.data.rightCellId);
  if (!left || !right || left.inputId !== right.inputId) {
    return NextResponse.json({ error: "cells not found or not comparable" }, { status: 400 });
  }
  await appendVote({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), inputId: left.inputId, ...parsed.data });
  return NextResponse.json({ ok: true }, { status: 201 });
}
