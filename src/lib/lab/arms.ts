// The four generation strategies the lab compares. Graph arms produce a typed
// graph that the deterministic engine lays out; the baseline is today's
// assistant path, where the model places coordinates itself.
import type { CanvasElement, CanvasEdge } from "@/types/canvas-elements";
import { canvasOperationsSchema, sanitizeCanvasOperations, CANVAS_OPERATIONS_GUIDE } from "@/lib/ai/canvas-operations";
import { translateForApply } from "@/lib/ai/canvas-operations-executor";
import { checkMapStructure } from "@/lib/maps/catalog";
import { EXEMPLARS } from "@/lib/maps/exemplars";
import { buildMapGuide } from "@/lib/maps/prompt";
import { renderMap } from "@/lib/maps/render";
import { mapGraphSchema } from "@/lib/maps/schema";
import type { MapGraph, MapType } from "@/lib/maps/types";
import type { CostMeter } from "./cost-meter";
import { generateStructured, type StructuredResult } from "./model-client";
import { cardsAsElements, cardsAsInventory, formatInput } from "./format-input";
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

const TASK = "Organise this into the clearest thinking map for the canvas.";

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

function exemplarBlock(): string {
  return "\n\nEXAMPLES of well-formed graphs:\n" +
    EXEMPLARS.map((e) => `${e.note}\n${JSON.stringify(e.graph)}`).join("\n\n");
}

function critiquePrompt(inputText: string, draft: MapGraph): string {
  const violations = checkMapStructure(draft);
  return `${TASK}

${inputText}

YOUR DRAFT:
${JSON.stringify(draft)}

${violations.length ? `STRUCTURAL PROBLEMS FOUND:\n- ${violations.join("\n- ")}\n\n` : ""}Critique the draft, then return a complete improved graph. Check: Is this the best map type for what the input needs? Are siblings distinct, and do they cover the topic together? Are branches balanced? Are labels short and specific? Are relations labelled where they carry meaning? Is anything unfaithful to the input, invented or dropped? Fix every problem.`;
}

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
  const prompt =
    `Canvas inventory (${inventory.totalCount} elements total):\n${JSON.stringify(inventory.elements)}` +
    `\n\nSelected element ids: []\n\nInstruction:\n${TASK}\n\n${formatInput(input)}`;
  const res = await generateStructured({
    modelId,
    system: "You are the CXD canvas assistant.\n" + CANVAS_OPERATIONS_GUIDE,
    prompt,
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
      const res = await draftGraph(modelId, guide + exemplarBlock(), `${TASK}\n\n${inputText}`, meter);
      return finish(res.object, [res]);
    }
    case "graphCritique": {
      const draft = await draftGraph(modelId, guide, `${TASK}\n\n${inputText}`, meter);
      const revised = await draftGraph(modelId, guide, critiquePrompt(inputText, draft.object), meter);
      return finish(revised.object, [draft, revised]);
    }
  }
}
