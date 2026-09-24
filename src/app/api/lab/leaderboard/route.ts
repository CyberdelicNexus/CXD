import { NextResponse } from "next/server";
import { labGate } from "@/lib/lab/http";
import { buildLeaderboard } from "@/lib/lab/lab-math";
import { allCells, readVotes } from "@/lib/lab/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = labGate(request);
  if (gate) return gate;
  const [cells, votes] = await Promise.all([allCells(), readVotes()]);
  return NextResponse.json({ leaderboard: buildLeaderboard(cells, votes) });
}
