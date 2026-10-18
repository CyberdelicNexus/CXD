import { NextResponse } from "next/server";
import { z } from "zod";
import { labGate } from "@/lib/lab/http";
import { allCells, appendVote } from "@/lib/lab/store";
import type { Cell } from "@/lib/lab/types";

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
  const gate = labGate(request);
  if (gate) return gate;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid vote" }, { status: 400 });
  const { leftCellId, rightCellId } = parsed.data;
  if (leftCellId === rightCellId) return NextResponse.json({ error: "a cell cannot be compared with itself" }, { status: 400 });
  const cells = await allCells();
  const left = cells.find((c) => c.id === leftCellId);
  const right = cells.find((c) => c.id === rightCellId);
  if (!left || !right) {
    const missing = [!left && leftCellId, !right && rightCellId].filter(Boolean).join(", ");
    return NextResponse.json({ error: `unknown cell id(s): ${missing}` }, { status: 400 });
  }
  if (left.status !== "done" || right.status !== "done") {
    return NextResponse.json({ error: "only successfully rendered (done) cells can be voted on" }, { status: 400 });
  }
  if (left.inputId !== right.inputId) {
    return NextResponse.json({ error: "cells are for different inputs, so not comparable" }, { status: 400 });
  }
  await appendVote({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), inputId: left.inputId, ...parsed.data });
  // The pair was shown blind; once the vote is stored, reveal who made each map.
  const reveal = (c: Cell) => ({ arm: c.arm, modelId: c.modelId, mapType: c.mapType, costUsd: c.costUsd });
  return NextResponse.json({ ok: true, reveal: { left: reveal(left), right: reveal(right) } }, { status: 201 });
}
