// Client side of the Canvas Assistant beta log: what people asked for, which
// form they chose against the one suggested, whether they built or discarded
// it, what they refined, and how they rated it. Fire-and-forget: logging must
// never slow the assistant down or surface an error to the user.

import type { CanvasEdge, CanvasElement } from "@/types/canvas-elements";

export type AssistantEvent = "form_picked" | "built" | "discarded" | "refined" | "rated" | "removed";

/** Reasons offered when a result is rated "not right". Stored verbatim. */
export const NOT_RIGHT_REASONS = [
  "Wrong kind of diagram",
  "Too crowded",
  "Missing or wrong content",
  "Layout is broken",
  "Wrong style or colours",
] as const;

export interface AssistantEventInput {
  entryId: string;
  event: AssistantEvent;
  projectId?: string | null;
  rating?: 1 | -1;
  reason?: string;
  instruction?: string;
  model?: string;
  payload?: Record<string, unknown>;
}

/**
 * What was drawn, small enough to store and complete enough to redraw: type,
 * text, geometry and the few style fields that carry the diagram's look.
 * Deliberately not the raw elements (ids, rich text, task metadata).
 */
export function snapshotBuild(elements: CanvasElement[], edges: CanvasEdge[]): Record<string, unknown> {
  const index = new Map(elements.map((el, i) => [el.id, i]));
  return {
    elements: elements.slice(0, 120).map((el) => {
      const e = el as unknown as Record<string, unknown> & { style?: Record<string, unknown> };
      const text = (e.content ?? e.label ?? e.noteTitle ?? e.title ?? "") as string;
      return {
        t: el.type,
        ...(e.shapeType ? { shape: e.shapeType } : {}),
        text: String(text).slice(0, 160),
        x: Math.round(el.x), y: Math.round(el.y), w: Math.round(el.width), h: Math.round(el.height),
        ...(el.containerId && index.has(el.containerId) ? { parent: index.get(el.containerId) } : {}),
        ...(e.style?.borderColor ? { ring: e.style.borderColor } : {}),
        ...(e.style?.fontSize ? { size: e.style.fontSize } : {}),
      };
    }),
    edges: edges
      .filter((ed) => index.has(ed.fromNodeId) && index.has(ed.toNodeId))
      .slice(0, 160)
      .map((ed) => [index.get(ed.fromNodeId), index.get(ed.toNodeId), ed.label?.text ?? ""]),
  };
}

/** Record one event. Resolves true when it was stored. Never throws. */
export async function logAssistantEvent(input: AssistantEventInput): Promise<boolean> {
  return (await sendAssistantEvent(input)).stored;
}

/** As logAssistantEvent, also reporting whether a rating earned a credit back. */
export async function sendAssistantEvent(input: AssistantEventInput): Promise<{ stored: boolean; credited: boolean }> {
  try {
    const res = await fetch("/api/ai/canvas-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, projectId: input.projectId ?? undefined }),
      keepalive: true,
    });
    if (!res.ok) return { stored: false, credited: false };
    const data = (await res.json().catch(() => ({}))) as { stored?: boolean; credited?: boolean };
    if (data.credited) window.dispatchEvent(new CustomEvent("ai-credits-changed"));
    return { stored: data.stored === true, credited: data.credited === true };
  } catch {
    return { stored: false, credited: false };
  }
}
