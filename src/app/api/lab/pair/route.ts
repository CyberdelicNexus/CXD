import { NextResponse } from "next/server";
import { formatInput } from "@/lib/lab/format-input";
import { labGate } from "@/lib/lab/http";
import { pickPair } from "@/lib/lab/lab-math";
import { PROMPT_VERSION } from "@/lib/lab/prompts";
import { getInputs } from "@/lib/lab/runner";
import { allCells, readVotes } from "@/lib/lab/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = labGate(request);
  if (gate) return gate;
  const [cells, votes, inputs] = await Promise.all([allCells(), readVotes(), getInputs()]);
  // Only cells made with the current prompts, so every new vote counts on the default leaderboard.
  const pick = pickPair(cells, votes, Math.random, { promptVersion: PROMPT_VERSION });
  if (!pick) return NextResponse.json({ pair: null, totalVotes: votes.length });
  const input = inputs.find((i) => i.id === pick.left.inputId);
  // Arm and model are deliberately withheld: votes must not be swayed by brand.
  return NextResponse.json({
    pair: {
      inputId: pick.left.inputId,
      inputTitle: input?.title ?? pick.left.inputId,
      inputText: input ? formatInput(input) : "",
      repeat: pick.repeat,
      left: { cellId: pick.left.id, elements: pick.left.elements, edges: pick.left.edges },
      right: { cellId: pick.right.id, elements: pick.right.elements, edges: pick.right.edges },
    },
    totalVotes: votes.length,
  });
}
