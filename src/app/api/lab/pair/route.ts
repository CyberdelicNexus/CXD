import { NextResponse } from "next/server";
import { formatInput } from "@/lib/lab/format-input";
import { labGate } from "@/lib/lab/http";
import { pickPair } from "@/lib/lab/lab-math";
import { PROMPT_VERSION } from "@/lib/lab/prompts";
import { getInputs } from "@/lib/lab/runner";
import { allCells, readVotes } from "@/lib/lab/store";
import { LEGACY_PROMPT_VERSION } from "@/lib/lab/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = labGate(request);
  if (gate) return gate;
  // ?compare=<old version>: old-vs-new pairs (same input, arm and model) against the current prompts.
  const compare = new URL(request.url).searchParams.get("compare");
  if (compare !== null && !/^[0-9a-f]{10}$/.test(compare) && compare !== LEGACY_PROMPT_VERSION) {
    return NextResponse.json({ error: "compare must be a prompt version (10 hex characters) or legacy" }, { status: 400 });
  }
  const [cells, votes, inputs] = await Promise.all([allCells(), readVotes(), getInputs()]);
  // Otherwise only cells made with the current prompts, so every new vote counts on the default leaderboard.
  const pick = pickPair(cells, votes, Math.random, compare ? { versions: [compare, PROMPT_VERSION] } : { promptVersion: PROMPT_VERSION });
  const mode = compare ? { old: compare, current: PROMPT_VERSION } : null;
  if (!pick) return NextResponse.json({ pair: null, totalVotes: votes.length, mode });
  const input = inputs.find((i) => i.id === pick.left.inputId);
  // Arm, model and prompt version are deliberately withheld: votes must not be swayed.
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
    mode,
  });
}
