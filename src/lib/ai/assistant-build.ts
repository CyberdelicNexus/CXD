// The Canvas Assistant's "build" moment: after a proposal is applied, the
// camera glides to the new diagram and its elements appear in reading order.
//
// The batch itself is already fully committed (one Zustand set + one Y.Doc
// transaction, one undo step) before any of this runs. The reveal is purely
// presentational: each new element gets a CSS animation-delay, so there are no
// timers per element and no re-render per step, and collaborators simply see
// the finished diagram. View state only: never written to the Y.Doc.

import { useSyncExternalStore } from "react";
import type { CanvasEdge, CanvasElement } from "@/types/canvas-elements";
import { realBounds } from "@/lib/canvas-layout-rules";

export interface BuildReveal {
  /** Element or edge id -> delay in ms before it appears. */
  delays: ReadonlyMap<string, number>;
  /** When every element has finished appearing. */
  totalMs: number;
}

interface BuildState {
  reveal: BuildReveal | null;
  /** Ids the canvas should select, with a counter so repeats still fire. */
  select: { ids: string[]; nonce: number } | null;
}

/** How long one element takes to fade in (matches the keyframes in globals.css). */
export const REVEAL_FADE_MS = 420;
const REVEAL_BUDGET_MS = 2800;
const STEP_MIN_MS = 35;
const STEP_MAX_MS = 170;
/** The camera glide (cxd-canvas) finishes before the first element appears. */
export const CAMERA_GLIDE_MS = 650;

let state: BuildState = { reveal: null, select: null };
const listeners = new Set<() => void>();
let clearTimer: ReturnType<typeof setTimeout> | null = null;

const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/**
 * Reading order for a batch: floating titles first, then the diagram in the
 * direction its connectors point (sources first, breadth-first), a frame just
 * before its first child, and anything left over top-to-bottom.
 */
export function revealOrder(elements: CanvasElement[], edges: CanvasEdge[]): string[] {
  const byId = new Map(elements.map((el) => [el.id, el]));
  const pos = (id: string) => {
    const el = byId.get(id)!;
    const b = realBounds(el) ?? { x: el.x, y: el.y, w: el.width, h: el.height };
    return { x: b.x, y: b.y };
  };
  const readingOrder = (a: string, b: string) => pos(a).y - pos(b).y || pos(a).x - pos(b).x;

  const out = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const e of edges) {
    if (!byId.has(e.fromNodeId) || !byId.has(e.toNodeId)) continue;
    out.set(e.fromNodeId, [...(out.get(e.fromNodeId) ?? []), e.toNodeId]);
    indeg.set(e.toNodeId, (indeg.get(e.toNodeId) ?? 0) + 1);
    if (!indeg.has(e.fromNodeId)) indeg.set(e.fromNodeId, indeg.get(e.fromNodeId) ?? 0);
  }

  const order: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    if (seen.has(id)) return;
    const parent = byId.get(id)?.containerId;
    if (parent && byId.has(parent) && !seen.has(parent)) {
      seen.add(parent);
      order.push(parent);
    }
    seen.add(id);
    order.push(id);
  };

  const connected = new Set(indeg.keys());
  // Titles and other unconnected text lead, so the diagram is named before it is drawn.
  elements
    .filter((el) => el.type === "text" && !el.containerId && !connected.has(el.id))
    .map((el) => el.id)
    .sort(readingOrder)
    .forEach(push);

  const queue = Array.from(connected).filter((id) => (indeg.get(id) ?? 0) === 0).sort(readingOrder);
  // A pure cycle has no source: start from its top-left node.
  if (queue.length === 0 && connected.size > 0) queue.push(Array.from(connected).sort(readingOrder)[0]);
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    push(id);
    for (const next of (out.get(id) ?? []).slice().sort(readingOrder)) if (!seen.has(next)) queue.push(next);
  }

  elements.map((el) => el.id).filter((id) => !seen.has(id)).sort(readingOrder).forEach(push);
  return order;
}

/** Start the staged reveal of a freshly applied batch and select it when done. */
export function startBuild(elements: CanvasElement[], edges: CanvasEdge[]): void {
  if (elements.length === 0) return;
  const ids = elements.map((el) => el.id);
  const reduced =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    state = { reveal: null, select: { ids, nonce: (state.select?.nonce ?? 0) + 1 } };
    emit();
    return;
  }

  const order = revealOrder(elements, edges);
  const step = Math.min(STEP_MAX_MS, Math.max(STEP_MIN_MS, REVEAL_BUDGET_MS / order.length));
  const delays = new Map<string, number>();
  order.forEach((id, i) => delays.set(id, CAMERA_GLIDE_MS + i * step));
  // A connector is drawn as it arrives at its target (or its source, if later).
  for (const e of edges) {
    const at = Math.max(delays.get(e.fromNodeId) ?? CAMERA_GLIDE_MS, delays.get(e.toNodeId) ?? CAMERA_GLIDE_MS);
    delays.set(e.id, at + step * 0.5);
  }
  const totalMs = CAMERA_GLIDE_MS + order.length * step + REVEAL_FADE_MS;

  if (clearTimer) clearTimeout(clearTimer);
  state = { reveal: { delays, totalMs }, select: state.select };
  emit();
  clearTimer = setTimeout(() => finishBuild(ids), totalMs);
}

function finishBuild(selectIds: string[]): void {
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = null;
  state = { reveal: null, select: { ids: selectIds, nonce: (state.select?.nonce ?? 0) + 1 } };
  emit();
}

/** Show everything now (the Skip button, or any click on the canvas). */
export function skipBuild(): void {
  if (!state.reveal) return;
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = null;
  state = { reveal: null, select: state.select };
  emit();
}

/** Ask the canvas to select these elements (used when a build has no reveal). */
export function requestSelection(ids: string[]): void {
  state = { reveal: state.reveal, select: { ids, nonce: (state.select?.nonce ?? 0) + 1 } };
  emit();
}

const getReveal = () => state.reveal;
const getSelect = () => state.select;
const serverNull = () => null;

/** Delay (ms) before this element or edge appears, or null when no build is running. */
export function useRevealDelay(id: string): number | null {
  const reveal = useSyncExternalStore(subscribe, getReveal, serverNull);
  return reveal ? reveal.delays.get(id) ?? null : null;
}

/** The running reveal, for the canvas (connector delays, the Skip control). */
export function useBuildReveal(): BuildReveal | null {
  return useSyncExternalStore(subscribe, getReveal, serverNull);
}

export function useBuildSelection(): { ids: string[]; nonce: number } | null {
  return useSyncExternalStore(subscribe, getSelect, serverNull);
}

// ─── Is the assistant working? ───────────────────────────────────────
// The chat panel reports it (answering, or designing a change set); the
// launcher icon reads it to animate. Kept apart from the reveal state so a
// flag flipping does not re-render every canvas element.

let thinking = false;
const thinkingListeners = new Set<() => void>();

export function setAssistantThinking(value: boolean): void {
  if (thinking === value) return;
  thinking = value;
  thinkingListeners.forEach((l) => l());
}

/** True while the assistant is answering, designing, or building on the canvas. */
export function useAssistantActive(): boolean {
  const isThinking = useSyncExternalStore(
    (l) => { thinkingListeners.add(l); return () => thinkingListeners.delete(l); },
    () => thinking,
    () => false,
  );
  const building = useSyncExternalStore(subscribe, getReveal, serverNull) !== null;
  return isThinking || building;
}