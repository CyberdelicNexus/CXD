// Shared schema + sanitizer + project-summary builder for AI pitch generation.
//
// The model produces a section list; the server validates and clamps it before
// anything reaches the client (the client never renders raw model output). Kept
// as a pure module so both the API route and the client service can import the
// types and helpers without pulling in server-only code.

import { z } from "zod";
import { SENSORY_DOMAINS, REALITY_PLANES, type CXDProject } from "@/types/cxd-schema";

// ---------------------------------------------------------------------------
// Section kinds + output schema
// ---------------------------------------------------------------------------
export const PITCH_SECTION_KINDS = [
  "hero",
  "concept",
  "personas",
  "sensory",
  "stats",
  "roadmap",
  "cta",
] as const;

export type PitchSectionKind = (typeof PITCH_SECTION_KINDS)[number];

const PITCH_KIND_VALUES = PITCH_SECTION_KINDS as unknown as [PitchSectionKind, ...PitchSectionKind[]];

export const pitchSectionSchema = z.object({
  kind: z.enum(PITCH_KIND_VALUES).describe("Section type"),
  title: z.string().describe("Short section heading (a few words)"),
  body: z.string().describe("One or two tight paragraphs of prose for this section"),
  bullets: z
    .array(z.string())
    .nullable()
    .optional()
    .describe("Optional supporting points, 2-5 short lines"),
});

export const generatePitchSchema = z.object({
  sections: z.array(pitchSectionSchema).min(1).max(8),
});

export type GeneratedPitchSection = z.infer<typeof pitchSectionSchema>;

// ---------------------------------------------------------------------------
// Bounded project summary (input to the model)
// ---------------------------------------------------------------------------
export interface PitchLabeledValue {
  label: string;
  value: string;
}

export interface PitchProjectSummary {
  name: string;
  mainConcept: string;
  coreMessage: string;
  desiredChange: PitchLabeledValue[];
  personas: PitchLabeledValue[];
  sensory: { label: string; value: number }[];
  stats: PitchLabeledValue[];
}

/** Which section kinds the builder asked for, plus rendering preferences. */
export interface PitchBuilderOptions {
  theme: "dark" | "light";
  accent: string;
  includeImages: boolean;
  /** Section kinds the user wants generated, in order. */
  sections: PitchSectionKind[];
  /** 'single' = one stacked page; 'deck' = 3-5 full-viewport slides. */
  length: "single" | "deck";
}

function activePlanes(project: CXDProject): string[] {
  const v2 = project.realityPlanesV2;
  if (v2 && v2.length > 0) {
    return [...v2]
      .filter((p) => p.enabled)
      .sort((a, b) => a.priority - b.priority)
      .map((p) => p.code);
  }
  return REALITY_PLANES.filter((r) => (project.realityPlanes?.[r.code] ?? 0) > 0).map((r) => r.code);
}

function countElements(project: CXDProject): number {
  let n = (project.canvasLayout?.elements || []).filter(
    (el) => el.type !== "connector" && el.type !== "line",
  ).length;
  for (const board of project.canvasLayout?.boards || []) {
    n += (board.nodes || []).filter((el) => el.type !== "connector" && el.type !== "line").length;
  }
  return n;
}

/**
 * Build a bounded, structured summary of the project for the model. Pure and
 * side-effect free so the client service can call it before posting.
 */
export function buildPitchProjectSummary(project: CXDProject): PitchProjectSummary {
  const stages = project.experienceFlowStages || [];
  const totalMinutes = stages.reduce((s, st) => s + (st.estimatedMinutes || 0), 0);
  const planes = activePlanes(project);

  const stats: PitchLabeledValue[] = [
    { label: "Design elements", value: String(countElements(project)) },
    { label: "Flow stages", value: String(stages.length) },
    ...(totalMinutes > 0 ? [{ label: "Runtime", value: `${totalMinutes} min` }] : []),
    ...(planes.length > 0 ? [{ label: "Reality planes", value: planes.join(", ") }] : []),
  ];

  return {
    name: project.name || project.intentionCore?.projectName || "Untitled Experience",
    mainConcept: project.intentionCore?.mainConcept?.trim() || "",
    coreMessage: project.intentionCore?.coreMessage?.trim() || "",
    desiredChange: [
      { label: "Insights", value: project.desiredChange?.insights?.trim() || "" },
      { label: "Feelings", value: project.desiredChange?.feelings?.trim() || "" },
      { label: "States", value: project.desiredChange?.states?.trim() || "" },
      { label: "Knowledge", value: project.desiredChange?.knowledge?.trim() || "" },
    ].filter((d) => d.value),
    personas: [
      { label: "Their needs", value: project.humanContext?.audienceNeeds?.trim() || "" },
      { label: "Their desires", value: project.humanContext?.audienceDesires?.trim() || "" },
      { label: "Their role", value: project.humanContext?.userRole?.trim() || "" },
    ].filter((p) => p.value),
    sensory: SENSORY_DOMAINS.map((d) => ({
      label: d.label,
      value: Math.max(0, Math.min(100, project.sensoryDomains?.[d.code] ?? 0)),
    })).filter((s) => s.value > 0),
    stats,
  };
}

// ---------------------------------------------------------------------------
// Prompt building (server side)
// ---------------------------------------------------------------------------
const SECTION_GUIDANCE: Record<PitchSectionKind, string> = {
  hero: "hero: the headline framing. A punchy title plus one or two sentences that state what this experience is and why it matters.",
  concept: "concept: the core idea and the change it creates for people. Ground it in the desired-change material.",
  personas: "personas: who this is for, their needs, desires and role. Warm, specific, second-person where natural.",
  sensory: "sensory: the sensory signature of the experience, describing how the strongest sense domains shape the feel.",
  stats: "stats: a quick at-a-glance summary. Use the bullets field for the concrete numbers provided.",
  roadmap: "roadmap: the path to delivery, framed as milestones or phases. Use bullets for the steps.",
  cta: "cta: a confident closing call to action inviting the reader to take the next step.",
};

export const PITCH_MAX_PROMPT_LEN = 500;

/** Convert the labeled-value arrays into a compact text block for the prompt. */
function labeledBlock(title: string, items: PitchLabeledValue[]): string {
  if (items.length === 0) return "";
  return `${title}:\n` + items.map((i) => `  - ${i.label}: ${i.value}`).join("\n");
}

/**
 * Compose the user prompt for the model from the bounded summary, the chosen
 * options, and the free-text emphasis. Pure string builder.
 */
export function buildPitchPrompt(
  summary: PitchProjectSummary,
  options: PitchBuilderOptions,
  userPrompt: string,
): string {
  const requested = options.sections.length > 0 ? options.sections : [...PITCH_SECTION_KINDS];
  const lengthLine =
    options.length === "single"
      ? "Keep it tight enough to read as a single page. Prefer 3-4 sections, prose over long bullet lists."
      : "Write a short deck of 3 to 5 sections. Each section should stand on its own as a slide.";

  const sensoryLine =
    summary.sensory.length > 0
      ? summary.sensory.map((s) => `${s.label} ${s.value}`).join(", ")
      : "not specified";

  const parts = [
    `Experience name: ${summary.name}`,
    summary.mainConcept ? `Main concept: ${summary.mainConcept}` : "",
    summary.coreMessage ? `Core message: ${summary.coreMessage}` : "",
    labeledBlock("Desired change", summary.desiredChange),
    labeledBlock("Audience", summary.personas),
    `Sensory signature (0-100): ${sensoryLine}`,
    labeledBlock("At a glance", summary.stats),
    "",
    `Sections to produce, in this order: ${requested.join(", ")}.`,
    ...requested.map((k) => `- ${SECTION_GUIDANCE[k]}`),
    "",
    lengthLine,
    "",
    userPrompt.trim()
      ? `What to emphasize (author's words): ${userPrompt.trim()}`
      : "No extra emphasis was given; lead with the strongest material above.",
  ];

  return parts.filter(Boolean).join("\n");
}

export const PITCH_SYSTEM_PROMPT =
  "You are the CXD pitch writer. You turn an experience-design brief into a " +
  "polished, persuasive pitch for stakeholders and collaborators. Write with " +
  "clarity and warmth, concrete not generic, confident not hyperbolic. Never " +
  "use em dashes; use commas, colons, or short sentences instead. Only produce " +
  "the section kinds requested, in the order given. Return prose in 'body' and " +
  "keep 'bullets' to short supporting lines.";

// ---------------------------------------------------------------------------
// Server-side sanitizer
// ---------------------------------------------------------------------------
const MAX_SECTIONS = 8;
const MAX_TITLE_LEN = 120;
const MAX_BODY_LEN = 1400;
const MAX_BULLETS = 6;
const MAX_BULLET_LEN = 220;

/** Strip em dashes (and the odd double hyphen) from generated copy. */
function stripEmDashes(s: string): string {
  return s.replace(/—/g, ", ").replace(/\s--\s/g, ", ");
}

function clean(s: string, max: number): string {
  return stripEmDashes(String(s ?? "")).replace(/\s+/g, " ").trim().slice(0, max);
}

export interface PitchSection {
  kind: PitchSectionKind;
  title: string;
  body: string;
  bullets?: string[];
}

/**
 * Validate + clamp model output into safe PitchSection[]. Drops empty and
 * out-of-vocabulary sections; when `allowed` is given, keeps only those kinds.
 */
export function sanitizePitchSections(
  raw: GeneratedPitchSection[],
  allowed?: PitchSectionKind[],
): PitchSection[] {
  const allowSet = allowed && allowed.length > 0 ? new Set(allowed) : null;
  const out: PitchSection[] = [];

  for (const s of (raw || []).slice(0, MAX_SECTIONS)) {
    if (!s || !PITCH_SECTION_KINDS.includes(s.kind)) continue;
    if (allowSet && !allowSet.has(s.kind)) continue;

    const title = clean(s.title, MAX_TITLE_LEN);
    const body = clean(s.body, MAX_BODY_LEN);
    const bullets = Array.isArray(s.bullets)
      ? s.bullets
          .map((b) => clean(b, MAX_BULLET_LEN))
          .filter(Boolean)
          .slice(0, MAX_BULLETS)
      : [];

    if (!title && !body && bullets.length === 0) continue;

    out.push({
      kind: s.kind,
      title: title || s.kind,
      body,
      ...(bullets.length > 0 ? { bullets } : {}),
    });
  }

  return out;
}
