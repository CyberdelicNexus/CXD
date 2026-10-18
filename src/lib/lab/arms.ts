// The four generation strategies the lab compares. Graph arms produce a typed
// graph that the deterministic engine lays out; the baseline is today's
// assistant path, where the model places coordinates itself.
import type { CanvasElement, CanvasEdge } from "@/types/canvas-elements";
import { canvasOperationsSchema, sanitizeCanvasOperations } from "@/lib/ai/canvas-operations";
import { translateForApply } from "@/lib/ai/canvas-operations-executor";
import { checkMapStructure } from "@/lib/maps/catalog";
import { buildMapGuide } from "@/lib/maps/prompt";
import { renderMap } from "@/lib/maps/render";
import { mapGraphSchema } from "@/lib/maps/schema";
import type { MapGraph, MapType } from "@/lib/maps/types";
import type { CostMeter } from "./cost-meter";
import { generateStructured, type StructuredResult } from "./model-client";
import { cardsAsElements, cardsAsInventory, formatInput } from "./format-input";
import { BASELINE_SYSTEM, baselinePrompt, critiquePrompt, exemplarBlock, TASK } from "./prompts";
import type { ArmId, LabInput } from "./types";

export interface ArmResult {
  graph: MapGraph | null;
  elements: CanvasElement[];
  edges: CanvasEdge[];
  structureViolations: string[];
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
}

function usageOf(calls: StructuredResult<unknown>[]) {
  return {
    inputTokens: calls.reduce((s, c) => s + c.inputTokens, 0),
    outputTokens: calls.reduce((s, c) => s + c.outputTokens, 0),
    costUsd: calls.reduce((s, c) => s + c.costUsd, 0),
    latencyMs: calls.reduce((s, c) => s + c.latencyMs, 0),
  };
}

/** Structure-check then render. An invalid graph is a recorded failure, not a crash. */
function finish(graph: MapGraph, calls: StructuredResult<unknown>[]): ArmResult {
  const structureViolations = checkMapStructure(graph);
  if (structureViolations.length > 0) {
    return { graph, elements: [], edges: [], structureViolations, ...usageOf(calls) };
  }
  const rendered = renderMap(graph);
  return { graph, elements: rendered.elements, edges: rendered.edges, structureViolations: [], ...usageOf(calls) };
}

const draftGraph = (modelId: string, system: string, prompt: string, meter?: CostMeter) =>
  generateStructured({ modelId, system, prompt, schema: mapGraphSchema, meter });

/** Existing canvas after the baseline's changes: what the user would actually see. */
function materialise(existing: CanvasElement[], plan: ReturnType<typeof translateForApply>): CanvasElement[] {
  const removed = new Set(plan.batch.removeElementIds);
  const updates = new Map(plan.batch.updates.map((u) => [u.id, u.updates]));
  return [
    ...existing.filter((e) => !removed.has(e.id)).map((e) => (updates.has(e.id) ? ({ ...e, ...updates.get(e.id) } as CanvasElement) : e)),
    ...plan.batch.addElements,
  ];
}

async function runBaseline(input: LabInput, modelId: string, meter?: CostMeter): Promise<ArmResult> {
  const existing = cardsAsElements(input.cards);
  const inventory = cardsAsInventory(input.cards);
  const res = await generateStructured({
    modelId,
    system: BASELINE_SYSTEM,
    prompt: baselinePrompt(inventory.totalCount, JSON.stringify(inventory.elements), formatInput(input)),
    schema: canvasOperationsSchema,
    meter,
  });
  const proposal = sanitizeCanvasOperations(res.object, inventory);
  const plan = translateForApply(proposal, new Set(proposal.rows.map((r) => r.rowId)), existing, []);
  return {
    graph: null,
    elements: materialise(existing, plan),
    edges: plan.batch.addEdges,
    structureViolations: [],
    ...usageOf([res]),
  };
}

/**
 * Run one arm. `meter` receives the billed usage of every model call as it is
 * billed, so when the arm throws part-way (max_tokens, refusal, unparseable
 * output, a critique revision failing after its draft) the caller can still
 * charge what was spent. On success its total equals the result's costUsd.
 */
export async function runArm(arm: ArmId, input: LabInput, modelId: string, forcedType: MapType | null, meter?: CostMeter): Promise<ArmResult> {
  const inputText = formatInput(input);
  const guide = buildMapGuide(forcedType);
  switch (arm) {
    case "baseline":
      return runBaseline(input, modelId, meter);
    case "graph": {
      const res = await draftGraph(modelId, guide, `${TASK}\n\n${inputText}`, meter);
      return finish(res.object, [res]);
    }
    case "graphExemplars": {
      const res = await draftGraph(modelId, guide + exemplarBlock(input, forcedType), `${TASK}\n\n${inputText}`, meter);
      return finish(res.object, [res]);
    }
    case "graphCritique": {
      const draft = await draftGraph(modelId, guide, `${TASK}\n\n${inputText}`, meter);
      const revised = await draftGraph(modelId, guide, critiquePrompt(inputText, JSON.stringify(draft.object), checkMapStructure(draft.object)), meter);
      return finish(revised.object, [draft, revised]);
    }
  }
}
