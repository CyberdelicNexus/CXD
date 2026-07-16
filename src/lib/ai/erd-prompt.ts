import type { AIProjectContext } from "@/types/ai-types";

/**
 * ERD generation parameters, surfaced in the generator UI. All optional:
 * when omitted (or left at neutral defaults) the produced prompt is identical
 * to the original behavior (all sections, balanced detail, neutral audience).
 */
export type ERDAudience = "technical" | "creative" | "stakeholders";
export type ERDDetail = "concise" | "standard" | "comprehensive";

export interface ERDOptions {
  audience?: ERDAudience | "";
  detail?: ERDDetail;
  /** Section ids to include. Empty/undefined means include all. */
  sections?: string[];
  /** Optional free-text tone note (bounded by the caller). */
  tone?: string;
}

/** The ERD's major sections, in order. Shared by the prompt and the UI. */
export const ERD_SECTIONS: { id: string; title: string }[] = [
  { id: "executive-summary", title: "Executive Summary" },
  { id: "experience-overview", title: "Experience Overview" },
  { id: "reality-plane", title: "Reality Plane Architecture" },
  { id: "sensory", title: "Sensory Design Specification" },
  { id: "interaction", title: "Interaction & Engagement Model" },
  { id: "presence", title: "Presence & Spatial Design" },
  { id: "state", title: "State Transition Design" },
  { id: "transformation", title: "Transformation & Integration Goals" },
  { id: "narrative", title: "Narrative & Meaning Framework" },
  { id: "technical", title: "Technical Requirements & Constraints" },
  { id: "plan", title: "Project Plan & Timeline" },
  { id: "team", title: "Team & Resources" },
  { id: "budget", title: "Budget Considerations" },
  { id: "appendix", title: "Appendix: Diagnostic Insights" },
];

// Section body text (the guidance under each heading). Keyed by section id so
// the prompt can be assembled from a filtered, renumbered subset.
const SECTION_BODIES: Record<string, string> = {
  "executive-summary": `Provide a 2-3 paragraph overview of the experience. Include the core concept, primary audience, and key differentiators. Mention the overall completion state and readiness level.`,
  "experience-overview": `Based on the Framing data (Intention Core):
- Project name and core concept
- Core message to communicate
- Type of experience and medium
- Key objectives and success metrics`,
  "reality-plane": `From the Reality Planes face data:
- Active reality planes and their roles
- Interface modalities per plane
- Cross-plane interaction model
- Technical feasibility assessment`,
  sensory: `From the Sensory Domains face data:
- Active sensory channels and their intensity distribution
- Dominant sense identification and justification
- Multi-sensory interaction patterns
- Perceptual hierarchy and attention flow`,
  interaction: `From the Experience Flow stages:
- Stage-by-stage engagement distribution
- Pacing and rhythm analysis
- User agency and control points
- Feedback loop design`,
  presence: `From the Presence Types face data:
- Active presence modes and their levels
- Spatial environment requirements
- Embodiment specifications
- Immersion depth targets per stage`,
  state: `From the State Mapping face data:
- Defined emotional/cognitive states
- State transition pathways
- Induction techniques per state
- Duration and intensity guidelines`,
  transformation: `From the Trait Mapping face data and Desired Change:
- Target lasting traits/behaviors
- Transformation arc from entry to exit
- Integration touchpoints
- Post-experience retention strategy`,
  narrative: `From the Context & Meaning face data:
- World building elements
- Story/narrative structure
- Symbolic/mythic elements ("magic")
- Meaning architecture coherence`,
  technical: `Synthesized from all faces:
- Platform/hardware requirements
- Software stack recommendations
- Performance requirements
- Accessibility considerations`,
  plan: `From the Plan view task data:
- Total tasks and status breakdown
- Priority distribution
- Upcoming deadlines
- Resource allocation recommendations`,
  team: `Based on project scope:
- Recommended team composition
- Skill requirements per domain
- External vendor needs
- Collaboration structure`,
  budget: `Based on scope and complexity:
- Cost drivers by domain
- Resource intensity assessment
- Phased budget approach
- Risk-adjusted estimates`,
  appendix: `From the diagnostic engine:
- Current diagnostic findings
- Cross-face coherence assessment
- Identified gaps and contradictions
- Priority recommendations for next steps`,
};

const AUDIENCE_GUIDANCE: Record<ERDAudience, string> = {
  technical:
    "Audience: the technical build team. Emphasize implementation specifics, system requirements, feasibility, and precise, buildable specifications.",
  creative:
    "Audience: the creative team. Emphasize experiential intent, aesthetic direction, narrative texture, and emotional design over engineering detail.",
  stakeholders:
    "Audience: stakeholders and decision-makers. Emphasize outcomes, value, feasibility, and risk at a strategic level; keep technical jargon to a minimum.",
};

const DETAIL_GUIDANCE: Record<ERDDetail, string> = {
  concise:
    "Detail level: concise. Keep each section brief, a few tight sentences or a short list. Prioritize signal over completeness.",
  standard: "",
  comprehensive:
    "Detail level: comprehensive. Expand each section with thorough analysis, concrete examples, and edge considerations.",
};

/**
 * Generate the ERD (Experience Requirement Document) prompt.
 * This is sent as the user message to the analysis endpoint with the general system prompt.
 * The AI fills in each section based on the project context.
 */
export function getERDPrompt(context: AIProjectContext, options: ERDOptions = {}): string {
  const { audience, detail, sections, tone } = options;

  // Selected sections, preserving canonical order; empty means all.
  const selectedSet = sections && sections.length > 0 ? new Set(sections) : null;
  const included = ERD_SECTIONS.filter((s) => (selectedSet ? selectedSet.has(s.id) : true));

  const sectionBlocks = included
    .map((s, i) => `## ${i + 1}. ${s.title}\n${SECTION_BODIES[s.id] || ""}`)
    .join("\n\n");

  // Optional guidance lines, only added when they diverge from the neutral default.
  const guidanceLines: string[] = [];
  if (audience && AUDIENCE_GUIDANCE[audience as ERDAudience]) {
    guidanceLines.push(AUDIENCE_GUIDANCE[audience as ERDAudience]);
  }
  if (detail && DETAIL_GUIDANCE[detail]) {
    guidanceLines.push(DETAIL_GUIDANCE[detail]);
  }
  const trimmedTone = tone?.trim();
  if (trimmedTone) {
    guidanceLines.push(`Tone note from the author: "${trimmedTone}".`);
  }
  const guidanceBlock = guidanceLines.length > 0 ? `\n${guidanceLines.join("\n")}\n` : "";

  return `Generate a comprehensive Experience Requirement Document (ERD) for this project.

Use the full project context provided in the system message to fill in each section below.
Write in a professional, clear tone. Use specific details from the project data.
Where data is missing or incomplete, note it as "[To be defined]" and provide a brief recommendation.

Format the output as clean Markdown with proper headings, bullet points, and tables where appropriate.
${guidanceBlock}
---

# Experience Requirement Document: ${context.projectName}

${sectionBlocks}

---

Important: Ground every section in the actual project data. Do not invent details that aren't supported by the context. If a section's data source is empty, acknowledge this clearly and suggest what the team should define next.`;
}
