import { NextResponse } from "next/server";
import { labGate } from "@/lib/lab/http";
import { buildLeaderboard } from "@/lib/lab/lab-math";
import { PROMPT_VERSION } from "@/lib/lab/prompts";
import { allCells, readVotes } from "@/lib/lab/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = labGate(request);
  if (gate) return gate;
  // Default: only cells made with the prompts in force now. ?versions=all counts every version, legacy included.
  const allVersions = new URL(request.url).searchParams.get("versions") === "all";
  const [cells, votes] = await Promise.all([allCells(), readVotes()]);
  return NextResponse.json({
    leaderboard: buildLeaderboard(cells, votes, allVersions ? {} : { promptVersion: PROMPT_VERSION }),
    currentPromptVersion: PROMPT_VERSION,
  });
}
