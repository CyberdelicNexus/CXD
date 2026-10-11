// What the Canvas Assistant offers before it draws: which diagram FORM fits a
// request, project-specific starting points, and the per-project preferences
// (ask first or not, a saved house style). All of it is deterministic and
// local: no model call, so the suggestions are instant and cost nothing.
//
// Form names here must stay in step with section 1 of CANVAS_COMPOSITION_SKILL
// (canvas-skill.ts), which is what the model reads when a form is chosen.

import type { CanvasEdge, CanvasElement, ContainerElement, ShapeElement } from "@/types/canvas-elements";
import type { AIProjectContext } from "@/types/ai-types";
import { TINT_COLORS, TINT_RINGS } from "./element-generation";

export type FormId =
  | "flow" | "spine" | "loop" | "mindmap" | "table" | "quadrants" | "frames"
  | "stack" | "timeline" | "swimlanes" | "tree" | "funnel" | "note";

export interface FormOption {
  id: FormId;
  label: string;
  /** One line on what the form is good for, shown under the label. */
  hint: string;
}

export const FORMS: Record<FormId, FormOption & { directive: string }> = {
  flow: { id: "flow", label: "Flow", hint: "Stages in order, snaking when long", directive: "Draw it as a FLOW: stage nodes joined by connectors, snaking into rows if there are more than six." },
  spine: { id: "spine", label: "Spine", hint: "Each stage with its explanation beside it", directive: "Draw it as a SPINE: small stage nodes chained in a column, each connected to a wide detail node holding its explanation." },
  loop: { id: "loop", label: "Loop", hint: "A cycle that feeds back into itself", directive: "Draw it as a LOOP: pill nodes in a closed ring of connectors, with the loop's name as floating text in the middle." },
  mindmap: { id: "mindmap", label: "Mind map", hint: "One idea with branches around it", directive: "Draw it as a MIND MAP: one hub node with branch nodes around it, sub-branches off those." },
  table: { id: "table", label: "Table", hint: "Rows and columns to compare", directive: "Draw it as a TABLE: one real table element under a title and a one-line caption." },
  quadrants: { id: "quadrants", label: "Quadrants", hint: "Positions on two axes", directive: "Draw it as QUADRANTS: four untitled outline frames in a grid, each with a floating heading and small pill nodes inside." },
  frames: { id: "frames", label: "Frames", hint: "Parallel themes side by side", directive: "Draw it as FRAMES: untitled outline frames side by side, each with a floating heading and its points as nodes or body text." },
  stack: { id: "stack", label: "Layered stack", hint: "Layers from top to bottom", directive: "Draw it as a LAYERED STACK: one wide rectangle node per layer, stacked top to bottom from what people touch down to what powers it, each layer's components as small pill nodes inside or beside it, with a floating label naming each layer. Connect a layer to the next only where one depends on the other." },
  timeline: { id: "timeline", label: "Timeline", hint: "Events in time order with dates", directive: "Draw it as a TIMELINE: milestone nodes in time order along one row (snaking if more than six), each with a floating label above it for its date or period and a caption below for what happens, joined by connectors." },
  swimlanes: { id: "swimlanes", label: "Swimlanes", hint: "Who does what, lane by lane", directive: "Draw it as SWIMLANES: one untitled outline frame per actor or team, stacked as horizontal lanes with a floating heading naming each, the steps as pill nodes inside the lane of whoever does them, placed left to right in order, with connectors showing each handoff between lanes." },
  tree: { id: "tree", label: "Tree", hint: "A hierarchy that breaks down", directive: "Draw it as a TREE: one root node at the top, its children in a row beneath it, their children beneath them, connected parent to child with connectors and no cross-links." },
  funnel: { id: "funnel", label: "Funnel", hint: "Stages that narrow down", directive: "Draw it as a FUNNEL: one rectangle node per stage stacked top to bottom, each narrower than the one above and centred on the same axis, with a caption beside each for what is lost or kept at that stage, joined by connectors." },
  note: { id: "note", label: "Note", hint: "Long-form writing to keep editing", directive: "Write it as a single note card with a clear title; this is long-form writing, not a diagram." },
};

interface Signal { form: FormId; pattern: RegExp; weight: number }

const SIGNALS: Signal[] = [
  { form: "flow", pattern: /\b(flow|journey|process|pipeline|sequence|stages?|steps?|phases?|onboarding|lifecycle|then)\b|->|→/gi, weight: 2 },
  { form: "stack", pattern: /\b(stack|layers?|layered|architecture|infrastructure|platform|tooling|tech|built on|powered by)\b/gi, weight: 3 },
  { form: "timeline", pattern: /\b(timeline|roadmap|schedule|milestones?|deadlines?|weeks?|months?|quarters?|q[1-4]|by (january|february|march|april|may|june|july|august|september|october|november|december))\b/gi, weight: 3 },
  { form: "swimlanes", pattern: /\b(swim ?lanes?|who does|roles?|hand-?offs?|responsibilit(y|ies)|teams?|departments?|facilitators?|participants? and)\b/gi, weight: 2 },
  { form: "tree", pattern: /\b(hierarchy|org ?chart|breakdown|taxonomy|types of|kinds of|sub-?categories|parent|children|nested)\b/gi, weight: 3 },
  { form: "funnel", pattern: /\b(funnel|conversion|drop-?off|narrow(s|ing)?|qualif(y|ied|ication)|recruitment pipeline)\b/gi, weight: 3 },
  { form: "spine", pattern: /\b(each (stage|step|phase)|for each|explain(ed|ing)?|what happens (in|at)|questions? (they|people) (are )?ask)/gi, weight: 3 },
  { form: "loop", pattern: /\b(loop|cycle|cyclical|flywheel|feedback|back to|repeats?|virtuous|vicious|habit)\b/gi, weight: 3 },
  { form: "mindmap", pattern: /\b(mind ?map|brainstorm|ideas?|branch(es)?|aspects?|facets?|dimensions?|explore|around)\b/gi, weight: 2 },
  { form: "table", pattern: /\b(compare|comparison|versus|vs\.?|pros|cons|before|after|believe|prove|criteria|options?|matrix|trade-?offs?|differences?)\b/gi, weight: 3 },
  { form: "quadrants", pattern: /\b(position(ing)?|quadrants?|2x2|two[- ]by[- ]two|axes|axis|segments?|landscape|competitors?)\b/gi, weight: 3 },
  { form: "frames", pattern: /\b(themes?|pillars?|categories|areas|groups?|clusters?|buckets?|side by side)\b/gi, weight: 2 },
  { form: "note", pattern: /\b(brief|write|draft|script|essay|paragraph|letter|bio|manifesto)\b/gi, weight: 3 },
];

/** A request that already names its form, so there is nothing to ask. */
const EXPLICIT: [FormId, RegExp][] = [
  ["loop", /\b(loop|cycle|flywheel)\b/i],
  ["mindmap", /\bmind ?map\b/i],
  ["table", /\b(table|matrix|grid)\b/i],
  ["quadrants", /\b(quadrants?|2x2)\b/i],
  ["spine", /\bspine\b/i],
  ["flow", /\b(flow ?(chart|diagram)?|flowchart|snake)\b/i],
  ["stack", /\blayered stack\b/i],
  ["timeline", /\btimeline\b/i],
  ["swimlanes", /\bswim ?lanes?\b/i],
  ["tree", /\b(tree|org ?chart)\b/i],
  ["funnel", /\bfunnel\b/i],
  ["frames", /\bframes?\b/i],
];

/** Wording that asks for something to be drawn. */
const DRAW_RE = /\b(draw|map|diagram|visuali[sz]e|lay\s?out|sketch|chart|show|summari[sz]e|organi[sz]e|illustrate|structure|turn\b.*\binto|put\b.*\bon (the |my )?canvas)\b/i;
/** Edits to what is already there, or a request for one specific element: never a form question. */
const NOT_A_DIAGRAM_RE = /\b(delete|remove|rename|retag|tag|untag|connect|link|group|ungroup|move|align|resize|recolou?r|tidy|clean\s?up|duplicate|card|cards|note|notes|container|zone|board|portal|image|storyboard|task|tasks|comment|comments|review)\b/i;

/** Unambiguous "put this on the canvas as a picture" wording. Narrower than
 *  DRAW_RE on purpose: "show" and "summarise" are as often a question for the
 *  chat as a request to draw, so they do not route to the canvas by themselves. */
const DRAW_COMMAND_RE = /^(please\s+)?(can you\s+|could you\s+)?(draw|map|diagram|visuali[sz]e|sketch|chart|illustrate|lay\s?out)\b/i;

/** True when a message asks for a drawing even though it has no edit verb in it. */
export function isDrawRequest(text: string): boolean {
  return DRAW_COMMAND_RE.test((text || "").trim());
}

/** Wording that points at what is already selected: "rearrange these", "a better version", "redo this". */
const REWORK_RE = /\b(re-?arrange|re-?draw|re-?do|re-?work|re-?organi[sz]e|re-?structure|re-?design|improve|better|cleaner|clean up|tidier|nicer|these|this (diagram|flow|map|layout)|selected|selection|them|it)\b/i;

/**
 * True when a request is about reworking the current selection into something
 * better, as opposed to drawing something new next to it. Such a request must
 * be built FROM the selected elements and replace them; treated as a fresh
 * drawing it produced generic content placed beside (or on) the original.
 */
export function reworksSelection(text: string, selectionCount: number): boolean {
  const t = (text || "").trim();
  if (selectionCount < 2 || /^(please\s+)?(delete|remove|tag|untag|rename|group|ungroup|connect|move|align)\b/i.test(t)) return false;
  // It has to be about a picture of them, not just any sentence with "it" in it.
  return REWORK_RE.test(t) && /\b(diagram|visual|layout|chart|map|flow|stack|structure|re-?arrange|re-?draw|re-?organi[sz]e|re-?design)\b/i.test(t);
}

/** The form a request names outright, if any. */
export function explicitForm(text: string): FormId | null {
  return EXPLICIT.find(([, re]) => re.test(text || ""))?.[0] ?? null;
}

/**
 * Form options for this content, best first. Asks the server, which uses Jev
 * when it is configured and quick enough; any failure or delay falls back to
 * the local rules, so this always resolves with usable options.
 */
export async function fetchFormOptions(
  content: string,
  timeoutMs = 2800,
): Promise<{ options: FormOption[]; source: "jev" | "rules"; confidence?: number }> {
  const fallback = { options: suggestForms(content), source: "rules" as const };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch("/api/ai/suggest-form", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.slice(0, 6000) }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return fallback;
    const data = (await res.json()) as { options?: FormOption[]; source?: "jev" | "rules"; confidence?: number };
    if (!Array.isArray(data.options) || data.options.length === 0) return fallback;
    return { options: data.options, source: data.source === "jev" ? "jev" : "rules", confidence: data.confidence };
  } catch {
    return fallback;
  }
}

/** Every form except the plain note, for the chooser's "more" list. */
export function allDiagramForms(): FormOption[] {
  return (Object.keys(FORMS) as FormId[]).filter((id) => id !== "note").map((id) => ({ id, label: FORMS[id].label, hint: FORMS[id].hint }));
}

/** True when it is worth asking which form to draw before generating. */
export function needsFormChoice(text: string): boolean {
  const t = (text || "").trim();
  if (!t || !DRAW_RE.test(t) || NOT_A_DIAGRAM_RE.test(t)) return false;
  return !EXPLICIT.some(([, re]) => re.test(t));
}

/**
 * Up to three forms that fit this content, best first. The first is the
 * recommendation. Scored on wording and on the shape of any list in the text
 * (many short items read as a flow; items with explanations as a spine).
 */
export function suggestForms(text: string): FormOption[] {
  const t = text || "";
  const score = new Map<FormId, number>();
  for (const s of SIGNALS) {
    const hits = t.match(s.pattern)?.length ?? 0;
    if (hits > 0) score.set(s.form, (score.get(s.form) ?? 0) + Math.min(hits, 3) * s.weight);
  }

  const items = t.split(/\n/).map((l) => l.trim()).filter((l) => /^([-*•]|\d+[.)])\s+\S/.test(l));
  if (items.length >= 3) {
    const explained = items.filter((l) => l.length > 70 || /[:–—]| - /.test(l)).length;
    const ordered = items.filter((l) => /^\d+[.)]/.test(l)).length;
    if (explained >= items.length / 2) score.set("spine", (score.get("spine") ?? 0) + 4);
    if (ordered >= items.length / 2) score.set("flow", (score.get("flow") ?? 0) + 3);
    else score.set("mindmap", (score.get("mindmap") ?? 0) + 2);
  }
  if (/\|.+\|/.test(t)) score.set("table", (score.get("table") ?? 0) + 5);

  const ranked = Array.from(score.entries()).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  // Always offer three real choices, padded with the forms that suit most content.
  for (const fallback of ["flow", "mindmap", "table"] as FormId[]) if (!ranked.includes(fallback)) ranked.push(fallback);
  return ranked.slice(0, 3).map((id) => ({ id: FORMS[id].id, label: FORMS[id].label, hint: FORMS[id].hint }));
}

// ─── Project-specific starting points ────────────────────────────────

const has = (s: string | undefined | null) => !!s && s.trim().length > 0;

/**
 * Prompts built from what this project actually contains, most specific
 * first. They are what no generic canvas tool can offer: one click from the
 * framing data to a diagram of it.
 */
export function projectStarters(ctx: AIProjectContext | null | undefined, selectionCount: number): string[] {
  const out: string[] = [];
  if (selectionCount >= 2) out.push(`Turn the ${selectionCount} selected elements into one connected diagram`);
  if (!ctx) return [...out, ...GENERIC_STARTERS].slice(0, 4);

  const f = ctx.framing;
  const stages = f.experienceFlow?.stages?.filter((s) => has(s.name)) ?? [];
  if (stages.length >= 2) out.push(`Map the journey from my experience flow (${stages.length} stages)`);
  if (has(f.intentionCore?.coreMessage) && (has(f.desiredChange?.insights) || has(f.desiredChange?.states))) {
    out.push("Draw how the core message leads to the change we want");
  }
  if (has(f.humanContext?.audienceNeeds)) out.push("Compare what my audience needs with what the experience gives them");
  if (has(f.contextAndMeaning?.world) || has(f.contextAndMeaning?.story)) out.push("Lay out World, Story and Magic side by side");

  const weakest = (ctx.map?.faces ?? [])
    .filter((face) => face.id !== "core")
    .sort((a, b) => a.completion - b.completion)[0];
  if (weakest && weakest.completion < 0.6) out.push(`What is missing from ${weakest.label}?`);
  if ((ctx.canvas?.elementCount ?? 0) >= 6) out.push("Summarise what is on my canvas as one diagram");

  for (const g of GENERIC_STARTERS) if (out.length < 4) out.push(g);
  return out.slice(0, 4);
}

const GENERIC_STARTERS = [
  "Map the participant journey from first contact to follow-up",
  "What is missing from this canvas?",
  "Draw the core loop of this experience",
];

// ─── Per-project preferences (this browser only) ─────────────────────

export interface AssistantPrefs {
  /** Offer form choices before drawing. Off = always take the recommendation. */
  askForm: boolean;
  /** A saved "draw it like this" description, appended to every draw request. */
  style?: string;
}

const prefsKey = (projectId: string) => `cxd:assistant-prefs:${projectId}`;

export function readAssistantPrefs(projectId: string): AssistantPrefs {
  if (typeof window === "undefined") return { askForm: true };
  try {
    const raw = window.localStorage.getItem(prefsKey(projectId));
    const parsed = raw ? (JSON.parse(raw) as Partial<AssistantPrefs>) : {};
    return { askForm: parsed.askForm !== false, ...(typeof parsed.style === "string" && parsed.style ? { style: parsed.style } : {}) };
  } catch {
    return { askForm: true };
  }
}

export function writeAssistantPrefs(projectId: string, prefs: AssistantPrefs): void {
  try {
    window.localStorage.setItem(prefsKey(projectId), JSON.stringify(prefs));
  } catch {
    // Storage full or disabled: the preference still holds for this session.
  }
}

// ─── "Draw it like this one" ─────────────────────────────────────────

function dominant<T extends string>(values: (T | undefined | null)[]): T | undefined {
  const count = new Map<T, number>();
  for (const v of values) if (v) count.set(v, (count.get(v) ?? 0) + 1);
  return Array.from(count.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
}

/**
 * A plain-language description of how a selected diagram is styled, for the
 * model to follow next time. Null when the selection has too little to learn
 * from (fewer than two nodes).
 */
export function describeStyle(elements: CanvasElement[], edges: CanvasEdge[], selectedIds: string[]): string | null {
  const selected = new Set(selectedIds);
  const scope = elements.filter((el) => selected.has(el.id) || (!!el.containerId && selected.has(el.containerId)));
  const shapes = scope.filter((el): el is ShapeElement => el.type === "shape");
  if (shapes.length < 2) return null;

  const tintOfRing = (ring: string | undefined) => TINT_COLORS.find((t) => TINT_RINGS[t] === ring);
  const shapeType = dominant(shapes.map((s) => s.shapeType));
  const tint = dominant(shapes.map((s) => tintOfRing(s.style?.borderColor)));
  const look = dominant(shapes.map((s) =>
    s.style?.fillOpacity === 0 ? "ghost" : s.style?.bgColor?.includes("gradient") ? "filled" : "outline"));
  const parts = [`Nodes are mostly ${shapeType} shapes with the "${look}" look${tint ? ` in the ${tint} family` : ""}.`];

  const ids = new Set(scope.map((el) => el.id));
  const inner = edges.filter((e) => ids.has(e.fromNodeId) && ids.has(e.toNodeId));
  if (inner.length > 0) {
    const gradient = dominant(inner.map((e) => e.style?.gradientName));
    const line = dominant(inner.map((e) => e.style?.lineStyle ?? "solid"));
    const arrow = dominant(inner.map((e) => e.style?.arrowStyle ?? "end"));
    parts.push(`Connectors are ${line}${gradient ? `, ${gradient}` : ""}, arrow style "${arrow}".`);
  }

  const frames = scope.filter((el): el is ContainerElement => el.type === "container");
  if (frames.length > 0) {
    parts.push(frames.every((c) => c.hideLabel) ? "Groups sit in untitled outline frames named by floating headings." : "Groups sit in titled containers.");
  } else {
    parts.push("No frames around the diagram.");
  }
  const notes = scope.filter((el) => el.type === "freeform").length;
  parts.push(notes === 0 ? "No note cards." : `${notes} note card${notes === 1 ? "" : "s"} for long-form text.`);
  if (scope.some((el) => el.type === "text" && el.style?.fontSize === 30)) parts.push("A large gradient title leads the layout.");
  return parts.join(" ");
}
