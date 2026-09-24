import type { CanvasElement, CanvasEdge } from "@/types/canvas-elements";
import type { MapGraph, MapType } from "@/lib/maps/types";

export const ARM_IDS = ["baseline", "graph", "graphCritique", "graphExemplars"] as const;
export type ArmId = (typeof ARM_IDS)[number];

export const ARM_LABELS: Record<ArmId, string> = {
  baseline: "Baseline (model places coordinates)",
  graph: "Graph + engine",
  graphCritique: "Graph + critique",
  graphExemplars: "Graph + exemplars",
};

export const JUDGE_IDS = ["rubric", "structure", "llmStrong", "llmCheap", "jev"] as const;
export type JudgeId = (typeof JUDGE_IDS)[number];

export const JUDGE_DIMENSIONS = ["clarity", "typeFit", "balance", "relations", "actionability", "faithfulness"] as const;
export type Dimension = (typeof JUDGE_DIMENSIONS)[number];

export type InputType = "brainDump" | "canvasCards" | "topic" | "comparison";

export interface LabCard {
  title: string;
  body: string;
}

export interface LabInput {
  id: string;
  type: InputType;
  title: string;
  text: string;
  cards: LabCard[];
  /** Map types a thoughtful designer would reach for (informational). */
  expectedTypes: MapType[];
  custom?: boolean;
}

export interface JudgeScore {
  judgeId: JudgeId;
  /** 1–5, or null when the judge does not apply (e.g. structure on baseline). */
  overall: number | null;
  pass: boolean;
  scores: Partial<Record<Dimension, number>>;
  notes: string;
  costUsd: number;
}

export type CellStatus = "pending" | "running" | "done" | "failed" | "error" | "skipped";

export interface Cell {
  id: string;
  runId: string;
  inputId: string;
  arm: ArmId;
  modelId: string;
  status: CellStatus;
  mapType: MapType | null;
  graph: MapGraph | null;
  elements: CanvasElement[];
  edges: CanvasEdge[];
  structureViolations: string[];
  rubricErrors: string[];
  rubricWarnings: string[];
  judges: JudgeScore[];
  latencyMs: number;
  costUsd: number;
  error: string | null;
}

export interface RunConfig {
  inputIds: string[];
  arms: ArmId[];
  modelIds: string[];
  forcedType: MapType | null;
  judges: JudgeId[];
  budgetUsd: number;
}

export interface Run {
  id: string;
  createdAt: string;
  config: RunConfig;
  estimateUsd: number;
  spentUsd: number;
  status: "running" | "done" | "stopped";
  cells: Cell[];
}

export interface RunSummary {
  id: string;
  createdAt: string;
  status: Run["status"];
  cellCount: number;
  doneCount: number;
  spentUsd: number;
  estimateUsd: number;
  config: RunConfig;
}

export interface Vote {
  id: string;
  createdAt: string;
  inputId: string;
  leftCellId: string;
  rightCellId: string;
  winner: "left" | "right" | "tie";
  reason: string;
  repeat: boolean;
}

export const variantKey = (c: Pick<Cell, "arm" | "modelId">) => `${c.arm}|${c.modelId}`;
