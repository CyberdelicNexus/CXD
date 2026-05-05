import type { AIProjectContext } from "@/types/ai-types";

/**
 * Generate the ERD (Experience Requirement Document) prompt.
 * This is sent as the user message to the analysis endpoint with the general system prompt.
 * The AI fills in each section based on the project context.
 */
export function getERDPrompt(context: AIProjectContext): string {
  return `Generate a comprehensive Experience Requirement Document (ERD) for this project.

Use the full project context provided in the system message to fill in each section below.
Write in a professional, clear tone. Use specific details from the project data.
Where data is missing or incomplete, note it as "[To be defined]" and provide a brief recommendation.

Format the output as clean Markdown with proper headings, bullet points, and tables where appropriate.

---

# Experience Requirement Document: ${context.projectName}

## 1. Executive Summary
Provide a 2-3 paragraph overview of the experience. Include the core concept, primary audience, and key differentiators. Mention the overall completion state and readiness level.

## 2. Experience Overview
Based on the Framing data (Intention Core):
- Project name and core concept
- Core message to communicate
- Type of experience and medium
- Key objectives and success metrics

## 3. Reality Plane Architecture
From the Reality Planes face data:
- Active reality planes and their roles
- Interface modalities per plane
- Cross-plane interaction model
- Technical feasibility assessment

## 4. Sensory Design Specification
From the Sensory Domains face data:
- Active sensory channels and their intensity distribution
- Dominant sense identification and justification
- Multi-sensory interaction patterns
- Perceptual hierarchy and attention flow

## 5. Interaction & Engagement Model
From the Experience Flow stages:
- Stage-by-stage engagement distribution
- Pacing and rhythm analysis
- User agency and control points
- Feedback loop design

## 6. Presence & Spatial Design
From the Presence Types face data:
- Active presence modes and their levels
- Spatial environment requirements
- Embodiment specifications
- Immersion depth targets per stage

## 7. State Transition Design
From the State Mapping face data:
- Defined emotional/cognitive states
- State transition pathways
- Induction techniques per state
- Duration and intensity guidelines

## 8. Transformation & Integration Goals
From the Trait Mapping face data and Desired Change:
- Target lasting traits/behaviors
- Transformation arc from entry to exit
- Integration touchpoints
- Post-experience retention strategy

## 9. Narrative & Meaning Framework
From the Context & Meaning face data:
- World building elements
- Story/narrative structure
- Symbolic/mythic elements ("magic")
- Meaning architecture coherence

## 10. Technical Requirements & Constraints
Synthesized from all faces:
- Platform/hardware requirements
- Software stack recommendations
- Performance requirements
- Accessibility considerations

## 11. Project Plan & Timeline
From the Plan view task data:
- Total tasks and status breakdown
- Priority distribution
- Upcoming deadlines
- Resource allocation recommendations

## 12. Team & Resources
Based on project scope:
- Recommended team composition
- Skill requirements per domain
- External vendor needs
- Collaboration structure

## 13. Budget Considerations
Based on scope and complexity:
- Cost drivers by domain
- Resource intensity assessment
- Phased budget approach
- Risk-adjusted estimates

## 14. Appendix: Diagnostic Insights
From the diagnostic engine:
- Current diagnostic findings
- Cross-face coherence assessment
- Identified gaps and contradictions
- Priority recommendations for next steps

---

Important: Ground every section in the actual project data. Do not invent details that aren't supported by the context. If a section's data source is empty, acknowledge this clearly and suggest what the team should define next.`;
}
