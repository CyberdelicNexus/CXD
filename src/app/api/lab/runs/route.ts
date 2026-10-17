import { NextResponse } from "next/server";
import { z } from "zod";
import { CONFIRM_THRESHOLD_USD, LAB_MODELS } from "@/lib/lab/config";
import { labGate } from "@/lib/lab/http";
import { estimateRunCost } from "@/lib/lab/lab-math";
import { getInputs, listRuns, startRun } from "@/lib/lab/runner";
import { summarise } from "@/lib/lab/store";
import { ARM_IDS, JUDGE_IDS } from "@/lib/lab/types";
import { MAP_TYPES } from "@/lib/maps/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = labGate(request);
  if (gate) return gate;
  // runner.listRuns reports runs orphaned by a server restart as stopped.
  return NextResponse.json({ runs: (await listRuns()).map(summarise) });
}

// Request validation only; this schema is never sent to a model.
const bodySchema = z.object({
  confirmed: z.boolean().default(false),
  config: z.object({
    inputIds: z.array(z.string()).min(1),
    arms: z.array(z.enum(ARM_IDS)).min(1),
    modelIds: z.array(z.string()).min(1),
    forcedType: z.enum(MAP_TYPES).nullable(),
    judges: z.array(z.enum(JUDGE_IDS)),
    budgetUsd: z.number().positive().max(200),
  }),
});

export async function POST(request: Request) {
  const gate = labGate(request);
  if (gate) return gate;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid run config" }, { status: 400 });
  const { config, confirmed } = parsed.data;
  const unknownModel = config.modelIds.find((id) => !LAB_MODELS.some((m) => m.id === id));
  if (unknownModel) return NextResponse.json({ error: `unknown model ${unknownModel}` }, { status: 400 });

  // Real input content, so graphExemplars' estimate scales with the actual
  // input size (a large canvasCards board) rather than a flat guess.
  const estimateUsd = estimateRunCost(config, await getInputs());
  if (estimateUsd > CONFIRM_THRESHOLD_USD && !confirmed) {
    return NextResponse.json({ needsConfirmation: true, estimateUsd }, { status: 409 });
  }
  // Without an explicit confirmation the run may never spend more than the
  // confirmation threshold, whatever budget the request asked for.
  const budgetUsd = confirmed ? config.budgetUsd : Math.min(config.budgetUsd, CONFIRM_THRESHOLD_USD);
  try {
    const run = await startRun({ ...config, budgetUsd });
    return NextResponse.json({ run: summarise(run) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
