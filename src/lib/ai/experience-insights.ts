import { z } from "zod";

/**
 * Shared schema / prompt / sanitizer for the dashboard "AI insights" feature:
 * a concise plain-language summary of an experience plus a short, prioritized
 * list of concrete next-step recommendations. On-demand only (the dashboard
 * panel spends credits behind an explicit button), so this stays cheap and text-only.
 */

export const INSIGHTS_MAX_PROMPT_LEN = 8000;

export const experienceInsightsSchema = z.object({
  summary: z
    .string()
    .describe(
      "A 2-4 sentence, plain-language summary of what this experience is about and its current state of progress. No preamble, no markdown headings.",
    ),
  recommendations: z
    .array(z.string())
    .min(1)
    .max(6)
    .describe(
      "Prioritized, concrete, actionable next steps — the areas or tasks the maker should focus on now, most important first. Each item one short sentence, no numbering (the UI numbers them).",
    ),
});

export type ExperienceInsights = z.infer<typeof experienceInsightsSchema>;

export const INSIGHTS_SYSTEM_PROMPT = `You are a pragmatic product and experience-design strategist reviewing a CXD (Cyberdelic Experience Design) project. You are given the project's core concept, canvas/tagging progress, task status breakdown, roadmap versions, and OKRs.

Produce:
1. summary — 2 to 4 sentences describing what the experience is and how far along it is. Ground it in the data provided; never invent facts not present.
2. recommendations — up to 6 prioritized, specific next steps. Favour what will most move the project forward: unblock stalled work, close near-complete OKRs, fill obvious gaps (untagged elements, empty roadmap, no tasks). Be concrete ("Tag the 12 untagged elements so they populate the Hypercube") rather than generic ("do more work"). Most important first.

Write for the maker, in a direct, encouraging, non-fluffy voice.`;

export interface InsightsTaskStats {
  total: number;
  notStarted: number;
  inProgress: number;
  blocked: number;
  done: number;
}

export interface InsightsInput {
  name: string;
  concept: string;
  description: string;
  elementCount: number;
  taggedCount: number;
  tasks: InsightsTaskStats;
  sensory: { label: string; value: number }[];
  roadmap: { name: string; status: string; type: string }[];
  okrs: { name: string; status: string; progress: number }[];
}

/** Bound an untrusted client payload before it can reach the model. */
export function boundInsightsInput(input: unknown): InsightsInput | null {
  if (!input || typeof input !== "object") return null;
  const s = input as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);
  const pct = (v: unknown) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

  const t = (s.tasks || {}) as Record<string, unknown>;
  const tasks: InsightsTaskStats = {
    total: num(t.total),
    notStarted: num(t.notStarted),
    inProgress: num(t.inProgress),
    blocked: num(t.blocked),
    done: num(t.done),
  };

  const sensory = Array.isArray(s.sensory)
    ? s.sensory
        .slice(0, 12)
        .map((i) => {
          const r = (i || {}) as Record<string, unknown>;
          return { label: str(r.label, 40), value: pct(r.value) };
        })
        .filter((i) => i.label && i.value > 0)
    : [];

  const roadmap = Array.isArray(s.roadmap)
    ? s.roadmap.slice(0, 20).map((i) => {
        const r = (i || {}) as Record<string, unknown>;
        return { name: str(r.name, 80), status: str(r.status, 40), type: str(r.type, 40) };
      }).filter((i) => i.name)
    : [];

  const okrs = Array.isArray(s.okrs)
    ? s.okrs.slice(0, 20).map((i) => {
        const r = (i || {}) as Record<string, unknown>;
        return { name: str(r.name, 120), status: str(r.status, 40), progress: pct(r.progress) };
      }).filter((i) => i.name)
    : [];

  return {
    name: str(s.name, 200) || "Untitled Experience",
    concept: str(s.concept, 800),
    description: str(s.description, 800),
    elementCount: num(s.elementCount),
    taggedCount: num(s.taggedCount),
    tasks,
    sensory,
    roadmap,
    okrs,
  };
}

export function buildInsightsPrompt(input: InsightsInput): string {
  const lines: string[] = [];
  lines.push(`Experience name: ${input.name}`);
  if (input.concept) lines.push(`Core concept: ${input.concept}`);
  if (input.description) lines.push(`Description: ${input.description}`);
  lines.push("");
  lines.push(`Canvas: ${input.elementCount} elements, ${input.taggedCount} tagged for the Hypercube (${input.elementCount - input.taggedCount} untagged).`);
  lines.push(
    `Tasks: ${input.tasks.total} total — ${input.tasks.notStarted} not started, ${input.tasks.inProgress} in progress, ${input.tasks.blocked} blocked, ${input.tasks.done} done.`,
  );

  if (input.sensory.length > 0) {
    lines.push(
      `Sensory signature: ${input.sensory.map((s) => `${s.label} ${s.value}%`).join(", ")}.`,
    );
  }

  if (input.roadmap.length > 0) {
    lines.push("");
    lines.push("Roadmap versions:");
    for (const v of input.roadmap) lines.push(`- ${v.name} (${v.type}, status: ${v.status})`);
  } else {
    lines.push("Roadmap: no versions defined yet.");
  }

  if (input.okrs.length > 0) {
    lines.push("");
    lines.push("OKRs:");
    for (const o of input.okrs) lines.push(`- ${o.name} — ${o.status}, ${o.progress}% complete`);
  } else {
    lines.push("OKRs: none defined yet.");
  }

  lines.push("");
  lines.push("Summarize this experience and give prioritized recommendations for what to focus on next.");
  return lines.join("\n");
}

/** Server-side clamp of the model output before returning to the client. */
export function sanitizeInsights(obj: unknown): ExperienceInsights {
  const o = (obj || {}) as Record<string, unknown>;
  const summary = typeof o.summary === "string" ? o.summary.trim().slice(0, 1200) : "";
  const recommendations = Array.isArray(o.recommendations)
    ? o.recommendations
        .map((r) => (typeof r === "string" ? r.trim().replace(/^\d+[.)]\s*/, "").slice(0, 400) : ""))
        .filter(Boolean)
        .slice(0, 6)
    : [];
  return { summary, recommendations };
}
