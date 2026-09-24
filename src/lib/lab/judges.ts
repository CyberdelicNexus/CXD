// Automated judges. None is trusted a priori: the lab measures each one's
// agreement with the user's pairwise votes (lab-math judgeAgreement).
import { z } from "zod";
import { checkLayout } from "@/lib/canvas-layout-rules";
import { checkMapStructure } from "@/lib/maps/catalog";
import { connectorCrossings } from "@/lib/maps/connector-geometry";
import { getElementTitle } from "@/utils/ai-context-aggregator";
import { JUDGE_MODELS } from "./config";
import type { CostMeter } from "./cost-meter";
import { generateStructured } from "./model-client";
import { formatInput } from "./format-input";
import type { Cell, Dimension, JudgeId, JudgeScore, LabInput } from "./types";
import { JUDGE_DIMENSIONS } from "./types";

export interface JudgeContext {
  input: LabInput;
  cell: Pick<Cell, "graph" | "elements" | "edges">;
  /** Receives billed usage even when the judge call then fails. */
  meter?: CostMeter;
}

export interface Judge {
  id: JudgeId;
  label: string;
  enabled: boolean;
  judge(ctx: JudgeContext): Promise<JudgeScore>;
}

const rubric: Judge = {
  id: "rubric",
  label: "Layout rubric",
  enabled: true,
  async judge({ cell }) {
    const v = checkLayout(cell.elements, cell.edges, { includeDesignSystemRules: true });
    const errors = v.filter((x) => x.severity === "error").length;
    const warnings = v.length - errors;
    // Connectors paint above every element, so one through an unrelated card
    // hides its content: a legibility defect checkLayout does not see.
    const crossings = connectorCrossings(cell.elements, cell.edges).length;
    const pass = errors === 0 && crossings === 0 && cell.elements.length > 0;
    const notes = [
      errors ? `${errors} layout error(s)` : `${warnings} house-style warning(s)`,
      crossings ? `${crossings} connector crossing(s)` : "",
    ].filter(Boolean).join("; ");
    return {
      judgeId: "rubric",
      overall: errors === 0 && cell.elements.length > 0 ? Math.max(1, 5 - warnings * 0.5 - crossings) : 1,
      pass,
      scores: {},
      notes,
      costUsd: 0,
    };
  },
};

const structure: Judge = {
  id: "structure",
  label: "Structure rules",
  enabled: true,
  async judge({ cell }) {
    if (!cell.graph) return { judgeId: "structure", overall: null, pass: false, scores: {}, notes: "not a graph arm", costUsd: 0 };
    const v = checkMapStructure(cell.graph);
    return {
      judgeId: "structure",
      overall: v.length === 0 ? 5 : Math.max(1, 5 - v.length),
      pass: v.length === 0,
      scores: {},
      notes: v.length ? v.slice(0, 3).join("; ") : "all catalog rules satisfied",
      costUsd: 0,
    };
  },
};

/** Every field required: Anthropic structured-output limits (schema-guards). */
export const judgeSchema = z.object({
  clarity: z.number(),
  typeFit: z.number(),
  balance: z.number(),
  relations: z.number(),
  actionability: z.number(),
  faithfulness: z.number(),
  notes: z.string(),
});

const JUDGE_SYSTEM = `You grade thinking maps made from a person's input. Score each dimension from 1 (poor) to 5 (excellent):
- clarity: can someone grasp the structure at a glance?
- typeFit: is this the right kind of map for what the input needs? (compare two things → double bubble; sequence → flow; causes/effects → multi-flow; categories → tree; whole into parts → brace; how ideas relate → concept map; one idea explored → radial, spider or bubble)
- balance: are branches evenly developed, siblings distinct, and together complete?
- relations: are connections meaningful, and labelled where the relationship is not obvious?
- actionability: would this help the person decide or act next?
- faithfulness: does it stay true to the input without inventing or dropping key points?
Be strict and calibrated: 3 is acceptable, 5 is exceptional. notes: one sentence naming the single biggest improvement.`;

function describeResult(cell: JudgeContext["cell"]): string {
  if (cell.graph) return JSON.stringify(cell.graph);
  const lines = cell.elements
    .filter((e) => e.type !== "line")
    .map((e) => `- ${e.type}: ${getElementTitle(e)}${e.containerId ? ` (inside ${e.containerId})` : ""}`);
  return `Canvas elements (${lines.length}):\n${lines.join("\n")}\nConnectors: ${cell.edges.length}`;
}

function llmJudge(id: JudgeId, label: string, modelId: string): Judge {
  return {
    id,
    label,
    enabled: true,
    async judge({ input, cell, meter }) {
      if (cell.elements.length === 0) {
        return { judgeId: id, overall: null, pass: false, scores: {}, notes: "nothing was rendered", costUsd: 0 };
      }
      const res = await generateStructured({
        modelId,
        system: JUDGE_SYSTEM,
        prompt: `INPUT:\n${formatInput(input)}\n\nRESULT:\n${describeResult(cell)}`,
        schema: judgeSchema,
        maxTokens: 4000,
        meter,
      });
      const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(n)));
      const scores = Object.fromEntries(JUDGE_DIMENSIONS.map((d) => [d, clamp(res.object[d])])) as Record<Dimension, number>;
      const overall = JUDGE_DIMENSIONS.reduce((s, d) => s + scores[d], 0) / JUDGE_DIMENSIONS.length;
      return { judgeId: id, overall, pass: overall >= 3, scores, notes: res.object.notes.slice(0, 300), costUsd: res.costUsd };
    },
  };
}

/** Jev (TypeSafe System One) slot. Signups closed as of 2026-09-24; enable when a key exists. */
const jev: Judge = {
  id: "jev",
  label: "Jev (unavailable)",
  enabled: false,
  async judge() {
    throw new Error("Jev is not available: TypeSafe is not accepting accounts yet.");
  },
};

export const JUDGES: Record<JudgeId, Judge> = {
  rubric,
  structure,
  llmStrong: llmJudge("llmStrong", "Sonnet 5 judge", JUDGE_MODELS.strong),
  llmCheap: llmJudge("llmCheap", "Haiku 4.5 judge", JUDGE_MODELS.cheap),
  jev,
};
