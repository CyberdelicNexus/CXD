import { NextResponse } from "next/server";
import { CONFIRM_THRESHOLD_USD, DEFAULT_BUDGET_USD, LAB_MODELS } from "@/lib/lab/config";
import { labGate } from "@/lib/lab/http";
import { JUDGES } from "@/lib/lab/judges";
import { ARM_IDS, ARM_LABELS } from "@/lib/lab/types";
import { MAP_TYPES } from "@/lib/maps/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = labGate();
  if (gate) return gate;
  return NextResponse.json({
    models: LAB_MODELS,
    arms: ARM_IDS.map((id) => ({ id, label: ARM_LABELS[id] })),
    judges: Object.values(JUDGES).map((j) => ({ id: j.id, label: j.label, enabled: j.enabled })),
    mapTypes: MAP_TYPES,
    confirmThresholdUsd: CONFIRM_THRESHOLD_USD,
    defaultBudgetUsd: DEFAULT_BUDGET_USD,
  });
}
