"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createTouchArm } from "@/lib/master-plan/plan/touch-arm";

/**
 * Pointer-driven drag for Plan cards — one mechanism for mouse, pen and
 * touch. A mouse drag starts after a few pixels of travel (so a click still
 * opens the task); a finger arms after a long press (so a swipe still
 * scrolls). Drop targets are found by hit-testing `data-plan-zone`
 * elements under the pointer:
 *
 *   data-plan-zone="column" data-day   a board day column (cards inside carry data-plan-card)
 *   data-plan-zone="grid"   data-day   the hour grid of one day
 *   data-plan-zone="backlog"           the backlog rail
 *
 * Scroll containers marked data-plan-scroll (vertical) or
 * data-plan-scroll-x (horizontal) auto-scroll when the pointer nears an edge.
 */

export type DropTarget =
  | { kind: "column"; day: string; targetKey: string | null; below: boolean }
  | { kind: "grid"; day: string; localY: number }
  | { kind: "backlog" };

export interface DragSource {
  key: string;
  title: string;
  color: string;
  durationMin: number;
}

export interface DragSession extends DragSource {
  x: number;
  y: number;
  target: DropTarget | null;
}

const MOUSE_SLOP_PX = 4;
const EDGE_PX = 48;
const SCROLL_STEP_PX = 14;

function resolveTarget(x: number, y: number): DropTarget | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const zone = el?.closest<HTMLElement>("[data-plan-zone]");
  if (!zone) return null;
  const kind = zone.dataset.planZone;
  const day = zone.dataset.day ?? "";
  if (kind === "backlog") return { kind: "backlog" };
  if (kind === "grid") return { kind: "grid", day, localY: y - zone.getBoundingClientRect().top };
  if (kind === "column") {
    const cards = Array.from(zone.querySelectorAll<HTMLElement>("[data-plan-card]"));
    for (const card of cards) {
      const r = card.getBoundingClientRect();
      if (y < r.top + r.height / 2) return { kind: "column", day, targetKey: card.dataset.planCard ?? null, below: false };
    }
    const last = cards[cards.length - 1];
    return { kind: "column", day, targetKey: last?.dataset.planCard ?? null, below: !!last };
  }
  return null;
}

/**
 * Scroll a container while the pointer rests near its edge. A container
 * only becomes scroll-ready once the pointer has been in its interior, so
 * entering it across an edge (dragging from a tray down into the grid)
 * doesn't scroll it out from under the pointer.
 */
function autoScroll(x: number, y: number, ready: WeakSet<HTMLElement>) {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const v = el?.closest<HTMLElement>("[data-plan-scroll]");
  if (v) {
    const r = v.getBoundingClientRect();
    const dir = y < r.top + EDGE_PX ? -1 : y > r.bottom - EDGE_PX ? 1 : 0;
    if (dir === 0) ready.add(v);
    else if (ready.has(v)) v.scrollTop += dir * SCROLL_STEP_PX;
  }
  const h = el?.closest<HTMLElement>("[data-plan-scroll-x]");
  if (h) {
    const r = h.getBoundingClientRect();
    const dir = x < r.left + EDGE_PX ? -1 : x > r.right - EDGE_PX ? 1 : 0;
    if (dir === 0) ready.add(h);
    else if (ready.has(h)) h.scrollLeft += dir * SCROLL_STEP_PX;
  }
}

/** While a touch drag is armed, stop the page from scrolling under the finger. */
function blockTouchScroll(e: TouchEvent) {
  e.preventDefault();
}

export function usePlanDrag(onDrop: (key: string, target: DropTarget) => void) {
  const [session, setSession] = useState<DragSession | null>(null);
  const sessionRef = useRef<DragSession | null>(null);
  const suppressClick = useRef(false);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const cleanupRef = useRef<(() => void) | null>(null);
  const scrollReady = useRef(new WeakSet<HTMLElement>());

  const update =(next: DragSession | null) => {
    sessionRef.current = next;
    setSession(next);
  };

  // Auto-scroll keeps running while the pointer rests near an edge.
  useEffect(() => {
    if (!session) return;
    let frame = 0;
    const tick = () => {
      const s = sessionRef.current;
      if (s) {
        autoScroll(s.x, s.y, scrollReady.current);
        const target = resolveTarget(s.x, s.y);
        if (JSON.stringify(target) !== JSON.stringify(s.target)) update({ ...s, target });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [session !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => cleanupRef.current?.(), []);

  const begin = useCallback((e: React.PointerEvent<HTMLElement>, source: DragSource) => {
    // A fresh press always clears the post-drag click guard, even on a
    // button inside the card — otherwise a drop that ended elsewhere would
    // swallow the next click.
    suppressClick.current = false;
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    cleanupRef.current?.();
    scrollReady.current = new WeakSet();

    const arm = createTouchArm();
    const origin = { x: e.clientX, y: e.clientY };
    const isMouse = e.pointerType === "mouse" || e.pointerType === "pen";
    let started = false;

    const start = (x: number, y: number) => {
      started = true;
      suppressClick.current = true;
      document.addEventListener("touchmove", blockTouchScroll, { passive: false });
      document.body.style.userSelect = "none";
      update({ ...source, x, y, target: resolveTarget(x, y) });
    };

    const onMove = (ev: PointerEvent) => {
      if (!started) {
        if (isMouse) {
          const dx = ev.clientX - origin.x;
          const dy = ev.clientY - origin.y;
          if (dx * dx + dy * dy > MOUSE_SLOP_PX * MOUSE_SLOP_PX) start(ev.clientX, ev.clientY);
        } else if (arm.move({ x: ev.clientX, y: ev.clientY })) {
          cleanup(); // moved before the long press: it was a scroll
        }
        return;
      }
      const s = sessionRef.current;
      if (s) update({ ...s, x: ev.clientX, y: ev.clientY, target: resolveTarget(ev.clientX, ev.clientY) });
    };

    const onUp = (ev: PointerEvent) => {
      const s = sessionRef.current;
      if (started && s) {
        const target = resolveTarget(ev.clientX, ev.clientY);
        if (target) onDropRef.current(s.key, target);
      }
      cleanup();
    };

    const cleanup = () => {
      arm.end();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", cleanup);
      document.removeEventListener("touchmove", blockTouchScroll);
      document.body.style.userSelect = "";
      cleanupRef.current = null;
      update(null);
    };
    cleanupRef.current = cleanup;

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", cleanup);

    if (!isMouse) {
      arm.begin({ pointerType: e.pointerType, x: e.clientX, y: e.clientY }, () => {
        navigator.vibrate?.(10);
        start(origin.x, origin.y);
      });
    }
  }, []);

  /** Props for a draggable element. */
  const sourceProps = useCallback(
    (source: DragSource) => ({
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => begin(e, source),
      onClickCapture: (e: React.MouseEvent) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      },
    }),
    [begin]
  );

  return { session, sourceProps };
}

export type PlanDrag = ReturnType<typeof usePlanDrag>;
