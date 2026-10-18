// Jev (TypeSafe "System One"): a decision model, not a text generator. You
// send a state and typed questions; it answers with a choice and a calibrated
// probability for every option. Server-only: the key never reaches the client.
//
// Used where the assistant has to DECIDE something quickly rather than write
// something: which diagram form fits a request. It is strictly optional. With
// no TYPESAFE_API_KEY, on any error, or past the time budget, callers get null
// and fall back to the local rules in assistant-forms.ts, so the assistant
// behaves the same with or without it, only less sharply.
//
// API: POST https://api.typesafe.ai/v1/systemone (docs.typesafe.ai/api).

import { FORMS, type FormId } from "./assistant-forms";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const MODEL = process.env.TYPESAFE_MODEL || "jev-latest";
/** A suggestion that arrives late is worth less than the rule-based one already on hand. */
const TIME_BUDGET_MS = 2500;

export const jevConfigured = (): boolean => !!process.env.TYPESAFE_API_KEY;

/**
 * What each form is FOR, phrased as the content it suits. This is the
 * "dataset" Jev chooses against: sharper descriptions here are the cheapest
 * way to improve its picks. Keep in step with CANVAS_COMPOSITION_SKILL.
 */
const FORM_CRITERIA: Record<Exclude<FormId, "note">, string> = {
  flow: "A sequence of steps or stages that happen one after another, possibly with decisions: a process, journey, pipeline or onboarding.",
  spine: "A sequence of stages where each stage needs its own explanation, question or detail shown next to it.",
  loop: "A cycle that returns to where it started: a feedback loop, habit loop, flywheel, iterative practice.",
  mindmap: "One central idea with several loosely related branches or aspects to explore, not ordered in time.",
  table: "A comparison across the same attributes: options versus criteria, before versus after, believe versus prove, pros and cons.",
  quadrants: "Things positioned on two axes or sorted into four groups: competitive positioning, a 2x2, segments.",
  frames: "A few parallel themes, pillars or categories, each with its own handful of points, with no order between them.",
  stack: "Layers that sit on top of one another: a technology stack, architecture, infrastructure, tools and what they are built on.",
  timeline: "Events, milestones or phases tied to dates or periods: a roadmap, schedule or history.",
  swimlanes: "A process where different people, roles or teams each do some of the steps and hand work to each other.",
  tree: "A hierarchy that breaks one thing down into parts and sub-parts: an org chart, taxonomy or breakdown.",
  funnel: "Stages that narrow, where fewer people or options remain at each one: recruitment, conversion, screening.",
};

/**
 * Worked examples placed in the state. Jev has no training call; examples in
 * the state are how it is shown the house judgement. Replace and extend these
 * from real `form_picked` rows in canvas_assistant_feedback (what people chose
 * when the suggestion was wrong) as the beta produces them.
 */
const EXAMPLES: { request: string; form: Exclude<FormId, "note"> }[] = [
  { request: "Map the participant journey from landing to follow-up", form: "flow" },
  { request: "How a patient discovers the programme, and the question they ask at each stage", form: "spine" },
  { request: "Experience, reflect, practise, embody, back to experience", form: "loop" },
  { request: "Ideas for the opening ritual", form: "mindmap" },
  { request: "What we believe versus what we must prove", form: "table" },
  { request: "Where we sit against retreats, apps and festivals on depth and continuity", form: "quadrants" },
  { request: "World, Story and Magic side by side", form: "frames" },
  { request: "Rearrange my tools into a better tech stack diagram", form: "stack" },
  { request: "The study calendar: week 0, weeks 1 to 6, one month and three months after", form: "timeline" },
  { request: "What facilitators, participants and the tech team each do during a session", form: "swimlanes" },
  { request: "Break the touchpoints down into channels and messages", form: "tree" },
  { request: "Recruitment from prospects to screened to enrolled", form: "funnel" },
];

export interface FormRanking {
  /** Forms best first, each with Jev's probability. */
  ranked: { form: FormId; probability: number }[];
  /** 0..1: how concentrated the distribution is on the top pick. */
  confidence: number;
}

/**
 * Ask Jev which form fits. `content` is what will be drawn (the request, plus
 * the answer or the selected elements' text when there is any). Returns null
 * when Jev is not configured, slow, or errors.
 */
export async function rankFormsWithJev(content: string, signal?: AbortSignal): Promise<FormRanking | null> {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key || !content.trim()) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIME_BUDGET_MS);
  signal?.addEventListener("abort", () => controller.abort(), { once: true });
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        state: { content: content.slice(0, 6000), examples: EXAMPLES },
        questions: {
          form: {
            type: "choice",
            instructions:
              "A designer wants `content` drawn as one diagram on a canvas. Choose the diagram form whose structure matches the structure of the content. `examples` shows how past requests were matched.",
            criteria: FORM_CRITERIA,
          },
        },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      answers?: { form?: { choice?: string; probabilities?: Record<string, number>; confidence?: number } };
    };
    const answer = data.answers?.form;
    if (!answer?.probabilities) return null;
    const ranked = Object.entries(answer.probabilities)
      .filter((entry): entry is [FormId, number] => entry[0] in FORMS && typeof entry[1] === "number")
      .sort((a, b) => b[1] - a[1])
      .map(([form, probability]) => ({ form, probability }));
    if (ranked.length === 0) return null;
    return { ranked, confidence: typeof answer.confidence === "number" ? answer.confidence : ranked[0].probability };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
