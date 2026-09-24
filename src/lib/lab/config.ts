// Structure Lab configuration. Prices verified 2026-09-24 (Anthropic model
// table; ai.google.dev/gemini-api/docs/pricing). Re-verify before trusting
// cost figures on a later date.

export type LabProvider = "anthropic" | "google";

export interface LabModel {
  /** Exact API model id. */
  id: string;
  label: string;
  provider: LabProvider;
  tier: "main" | "cheap" | "ceiling";
  /** USD per million input tokens. */
  inputPerMTok: number;
  /** USD per million output tokens. */
  outputPerMTok: number;
  /** Anthropic effort level. Omit where unsupported: Haiku 4.5 returns 400 on it. */
  effort?: "low" | "medium" | "high";
}

export const LAB_MODELS: LabModel[] = [
  { id: "claude-sonnet-5", label: "Sonnet 5", provider: "anthropic", tier: "main", inputPerMTok: 2, outputPerMTok: 10, effort: "medium" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", provider: "google", tier: "main", inputPerMTok: 2, outputPerMTok: 12 },
  { id: "claude-haiku-4-5", label: "Haiku 4.5", provider: "anthropic", tier: "cheap", inputPerMTok: 1, outputPerMTok: 5 },
  // Promo price through 2026-12-31; $1.50 / $7.50 from 2027-01-01.
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", provider: "google", tier: "cheap", inputPerMTok: 0.75, outputPerMTok: 3.75 },
  { id: "claude-opus-5-5", label: "Opus 5.5", provider: "anthropic", tier: "ceiling", inputPerMTok: 4, outputPerMTok: 20, effort: "medium" },
];

export function getLabModel(id: string): LabModel {
  const model = LAB_MODELS.find((m) => m.id === id);
  if (!model) throw new Error(`Unknown lab model: ${id}`);
  return model;
}

/** USD for a call. Lives here (not in model-client) so pure maths can import it without pulling in SDKs. */
export function costOf(model: LabModel, inputTokens: number, outputTokens: number): number {
  return (inputTokens * model.inputPerMTok + outputTokens * model.outputPerMTok) / 1_000_000;
}

/** Models used by the LLM judges. */
export const JUDGE_MODELS = { strong: "claude-sonnet-5", cheap: "claude-haiku-4-5" } as const;

/** Runs estimated above this need an explicit confirmation in the UI. */
export const CONFIRM_THRESHOLD_USD = 2;
export const DEFAULT_BUDGET_USD = 10;
export const RUN_CONCURRENCY = 4;

/** Relative to process.cwd() (the repo root under `next dev`). Gitignored. */
export const LAB_DATA_DIR = "lab-data";
