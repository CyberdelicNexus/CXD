"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { createTouchArm } from "@/lib/master-plan/plan/touch-arm";
import {
  DEFAULT_GRID,
  clampWindow,
  clockToMinutes,
  defaultDuration,
  dropStart,
  gridHeight,
  hourLabel,
  initialScrollPx,
  laneStyle,
  layoutLanes,
  minutesToClock,
  minutesToPx,
  moveBy,
  rangeLabel,
  resizeBy,
  type TimeWindow,
} from "@/lib/master-plan/plan/timeline-geometry";
import { tintStyle, type PlanEntry } from "./plan-entries";
import { dayHeading } from "./plan-board";
import { DoneToggle, FOCUS_RING } from "./plan-task-card";
import { PlanTaskMenu, type PlanActions } from "./plan-task-menu";
import type { PlanDrag } from "./use-plan-drag";

const g = DEFAULT_GRID;
const GUTTER_PX = 48;
const LANE_INSETS = { leftPx: 3, rightPx: 6, gapPx: 3 };
/** Below this height a block shows only its title on one line. */
const TIGHT_PX = 34;
/** At this height or more a block also shows its project. */
const ROOMY_PX = 60;
const KEY_STEP_PX = g.pxPerHour / 4; // 15 minutes

interface Gesture {
  key: string;
  day: string;
  window: TimeWindow;
  moved: boolean;
}

function windowOf(entry: PlanEntry): TimeWindow | null {
  const start = clockToMinutes(entry.scheduledStart);
  if (start === null) return null;
  return { startMin: start, durationMin: entry.durationMinutes ?? defaultDuration(entry.estimatedHours) };
}

/**
 * The hour grid: one column per day against the clock. Drag a card from a
 * day's "No time yet" tray (or the backlog) onto an hour to give it a time;
 * drag a block to move it (across days too), drag its top or bottom edge to
 * resize it. Arrow keys nudge a focused block by 15 minutes; Shift+arrows
 * change its length.
 */
export function PlanTimeGrid({
  days,
  entriesByDay,
  today,
  nowMin,
  actions,
  drag,
  onBlockChange,
  showTray = true,
}: {
  days: string[];
  entriesByDay: Map<string, PlanEntry[]>;
  today: string;
  /** Minutes since midnight now, for the now-line on today's column. */
  nowMin: number;
  actions: PlanActions;
  drag: PlanDrag;
  onBlockChange: (entry: PlanEntry, day: string, window: TimeWindow) => void;
  showTray?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const suppressClick = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  const showsToday = days.includes(today);
  const daysKey = days.join(",");
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = initialScrollPx(showsToday ? nowMin : null, g);
    // Only when the visible days change, not every minute.
  }, [daysKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const layout = useMemo(() => {
    const out = new Map<string, { timed: { entry: PlanEntry; window: TimeWindow }[]; untimed: PlanEntry[] }>();
    for (const day of days) {
      const timed: { entry: PlanEntry; window: TimeWindow }[] = [];
      const untimed: PlanEntry[] = [];
      for (const entry of entriesByDay.get(day) ?? []) {
        const w = windowOf(entry);
        if (w) timed.push({ entry, window: clampWindow(w.startMin, w.durationMin, g) });
        else if (entry.status !== "completed" && entry.plannable) untimed.push(entry);
      }
      out.set(day, { timed, untimed });
    }
    return out;
  }, [days, entriesByDay]);

  const startGesture = (e: React.PointerEvent, entry: PlanEntry, day: string, base: TimeWindow, mode: "move" | "start" | "end") => {
    // A fresh press always clears the post-gesture click guard first.
    suppressClick.current = false;
    if (e.button !== 0 || !entry.plannable) return;
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    e.stopPropagation();
    cleanupRef.current?.();
    const arm = createTouchArm();
    const originY = e.clientY;
    let current: Gesture = { key: entry.id, day, window: base, moved: false };

    const blockScroll = (ev: TouchEvent) => ev.preventDefault();
    const onArm = () => {
      document.addEventListener("touchmove", blockScroll, { passive: false });
      document.body.style.userSelect = "none";
      // The preview appears on the first movement, so a plain click doesn't flash it.
      if (e.pointerType !== "mouse") navigator.vibrate?.(10);
    };

    const onMove = (ev: PointerEvent) => {
      if (!arm.armed) {
        if (arm.move({ x: ev.clientX, y: ev.clientY })) cleanup();
        return;
      }
      const delta = ev.clientY - originY;
      let window = mode === "move" ? moveBy(base, delta, g) : resizeBy(base, mode, delta, g);
      let targetDay = day;
      if (mode === "move") {
        const zone = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>(
          '[data-plan-zone="grid"]'
        );
        if (zone?.dataset.day) targetDay = zone.dataset.day;
      }
      window = clampWindow(window.startMin, window.durationMin, g);
      const moved =
        current.moved || window.startMin !== base.startMin || window.durationMin !== base.durationMin || targetDay !== day;
      current = { key: entry.id, day: targetDay, window, moved };
      setGesture(current);
    };

    const onUp = () => {
      if (arm.armed && current.moved) {
        suppressClick.current = true;
        onBlockChange(entry, current.day, current.window);
      }
      cleanup();
    };

    const cleanup = () => {
      arm.end();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", cleanup);
      document.removeEventListener("touchmove", blockScroll);
      document.body.style.userSelect = "";
      cleanupRef.current = null;
      setGesture(null);
    };
    cleanupRef.current = cleanup;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", cleanup);
    arm.begin({ pointerType: e.pointerType, x: e.clientX, y: e.clientY }, onArm);
  };

  const onBlockKey = (e: React.KeyboardEvent, entry: PlanEntry, day: string, w: TimeWindow) => {
    if (e.key === "Enter") return actions.open(entry);
    if (e.key === " ") {
      e.preventDefault();
      return actions.toggleDone(entry);
    }
    if (!entry.plannable || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    const dir = e.key === "ArrowUp" ? -1 : 1;
    const next = e.shiftKey ? resizeBy(w, "end", dir * KEY_STEP_PX, g) : moveBy(w, dir * KEY_STEP_PX, g);
    if (next.startMin !== w.startMin || next.durationMin !== w.durationMin) onBlockChange(entry, day, next);
  };

  const session = drag.session;
  const height = gridHeight(g);
  const hours = Array.from({ length: g.endHour - g.startHour + 1 }, (_, i) => g.startHour + i);
  const gestureEntry = gesture ? Array.from(entriesByDay.values()).flat().find((e) => e.id === gesture.key) : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Day headers + "No time yet" trays */}
      <div className="flex border-b border-white/[0.07]">
        <div style={{ width: GUTTER_PX }} className="flex-shrink-0" />
        {days.map((day) => {
          const heading = dayHeading(day);
          const untimed = layout.get(day)?.untimed ?? [];
          return (
            <div
              key={day}
              data-plan-zone="column"
              data-day={day}
              className={cn("min-w-0 flex-1 border-l border-white/[0.07] px-2 py-2", day === today && "bg-violet-500/[0.06]")}
            >
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{heading.weekday}</span>
                <span className={cn("font-mono text-sm", day === today ? "text-violet-200" : "text-white/80")}>{heading.date}</span>
              </div>
              {showTray && untimed.length > 0 && (
                <div className="mt-1.5 flex max-h-[76px] flex-wrap gap-1 overflow-y-auto" aria-label={`No time yet on ${heading.long}`}>
                  {untimed.map((entry) => (
                    <PlanTaskMenu key={entry.id} entry={entry} actions={actions} today={today}>
                      <button
                        type="button"
                        data-plan-card={entry.id}
                        onClick={() => actions.open(entry)}
                        {...drag.sourceProps({
                          key: entry.id,
                          title: entry.title,
                          color: entry.color,
                          durationMin: entry.durationMinutes ?? defaultDuration(entry.estimatedHours),
                        })}
                        title={`${entry.title}: drag onto an hour to give it a time`}
                        className={cn(
                          "flex max-w-full touch-pan-y select-none items-center gap-1 truncate rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[11px] text-white/75 hover:bg-white/10",
                          session?.key === entry.id && "opacity-35",
                          FOCUS_RING
                        )}
                      >
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="truncate">{entry.title}</span>
                      </button>
                    </PlanTaskMenu>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div ref={scrollRef} data-plan-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="relative flex" style={{ height }}>
          <div style={{ width: GUTTER_PX }} className="relative flex-shrink-0">
            {hours.map((h) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 font-mono text-[10.5px] text-white/35 tabular-nums"
                style={{ top: minutesToPx(h * 60, g) }}
              >
                {h === g.startHour ? "" : hourLabel(h)}
              </span>
            ))}
          </div>

          {days.map((day) => {
            const { timed } = layout.get(day) ?? { timed: [] };
            const lanes = layoutLanes(timed.map(({ entry, window }) => ({ id: entry.id, ...window })));
            const dropTarget = session?.target?.kind === "grid" && session.target.day === day ? session.target : null;
            const dropMin = dropTarget ? dropStart(dropTarget.localY, session!.durationMin, g) : null;
            return (
              <div
                key={day}
                data-plan-zone="grid"
                data-day={day}
                className={cn("relative min-w-0 flex-1 border-l border-white/[0.07]", day === today && "bg-violet-500/[0.03]")}
                style={{
                  backgroundImage: `repeating-linear-gradient(to bottom, rgba(198,183,255,0.09) 0 1px, transparent 1px ${g.pxPerHour / 2}px, rgba(198,183,255,0.035) ${g.pxPerHour / 2}px ${g.pxPerHour / 2 + 1}px, transparent ${g.pxPerHour / 2 + 1}px ${g.pxPerHour}px)`,
                }}
              >
                {timed.map(({ entry, window }) => {
                  const top = minutesToPx(window.startMin, g);
                  const h = Math.max(18, minutesToPx(window.startMin + window.durationMin, g) - top);
                  const pos = laneStyle(lanes.get(entry.id) ?? { lane: 0, lanes: 1 }, LANE_INSETS);
                  const done = entry.status === "completed";
                  const beingMoved = gesture?.key === entry.id;
                  return (
                    <PlanTaskMenu key={entry.id} entry={entry} actions={actions} today={today}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={`${entry.title}, ${rangeLabel(window.startMin, window.durationMin)}${done ? ", done" : ""}. Arrow keys move it, Shift and arrow keys resize it.`}
                        onPointerDown={(e) => startGesture(e, entry, day, window, "move")}
                        onClick={() => {
                          if (suppressClick.current) {
                            suppressClick.current = false;
                            return;
                          }
                          actions.open(entry);
                        }}
                        onKeyDown={(e) => onBlockKey(e, entry, day, window)}
                        style={{ ...tintStyle(entry.color), top, height: h, left: pos.left, width: pos.width }}
                        className={cn(
                          "group absolute touch-pan-y select-none overflow-hidden rounded-lg border-l-[3px] pl-2 pr-7 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_3px_12px_rgba(0,0,0,0.45)]",
                          h < TIGHT_PX ? "py-0.5" : "py-1",
                          entry.plannable ? "cursor-grab" : "cursor-pointer",
                          beingMoved && "opacity-30",
                          FOCUS_RING
                        )}
                      >
                        {h >= TIGHT_PX && (
                          <DoneToggle entry={entry} onToggle={() => actions.toggleDone(entry)} className="absolute right-1 top-1 h-5 w-5" />
                        )}
                        <p className={cn("truncate text-[12px] font-medium leading-tight text-white/90", done && "text-white/45 line-through")}>
                          {entry.title}
                        </p>
                        {h >= TIGHT_PX && (
                          <p className="truncate text-[10.5px] tabular-nums text-white/55">{rangeLabel(window.startMin, window.durationMin)}</p>
                        )}
                        {h >= ROOMY_PX && <p className="truncate text-[10.5px] text-white/40">{entry.item.projectName}</p>}
                        {entry.plannable && (
                          <>
                            <span
                              aria-hidden
                              onPointerDown={(e) => startGesture(e, entry, day, window, "start")}
                              className="absolute inset-x-0 -top-0.5 flex h-2.5 cursor-ns-resize justify-center [@media(pointer:coarse)]:h-5"
                            >
                              <span className="mt-0.5 h-0.5 w-6 rounded-full bg-white/50 opacity-0 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-60" />
                            </span>
                            <span
                              aria-hidden
                              onPointerDown={(e) => startGesture(e, entry, day, window, "end")}
                              className="absolute inset-x-0 -bottom-0.5 flex h-2.5 cursor-ns-resize items-end justify-center [@media(pointer:coarse)]:h-5"
                            >
                              <span className="mb-0.5 h-0.5 w-6 rounded-full bg-white/50 opacity-0 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-60" />
                            </span>
                          </>
                        )}
                      </div>
                    </PlanTaskMenu>
                  );
                })}

                {/* Live preview while moving or resizing a block */}
                {gesture && gestureEntry && gesture.day === day && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute z-10 overflow-hidden rounded-lg border-l-[3px] px-2 py-1 shadow-[0_6px_20px_rgba(0,0,0,0.5)]"
                    style={{
                      ...tintStyle(gestureEntry.color, "lifted"),
                      top: minutesToPx(gesture.window.startMin, g),
                      height: Math.max(18, (gesture.window.durationMin / 60) * g.pxPerHour),
                      left: LANE_INSETS.leftPx,
                      right: LANE_INSETS.rightPx,
                    }}
                  >
                    <p className="truncate text-[12px] font-medium text-white">{gestureEntry.title}</p>
                    <p className="text-[10.5px] tabular-nums text-teal-100">{rangeLabel(gesture.window.startMin, gesture.window.durationMin)}</p>
                  </div>
                )}

                {/* Where a dragged card will land */}
                {dropMin !== null && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute z-10 rounded-lg border border-dashed border-teal-300/70 bg-teal-400/20 px-2 py-1"
                    style={{
                      top: minutesToPx(dropMin, g),
                      height: (session!.durationMin / 60) * g.pxPerHour,
                      left: LANE_INSETS.leftPx,
                      right: LANE_INSETS.rightPx,
                    }}
                  >
                    <span className="font-mono text-[10.5px] text-teal-100">
                      {rangeLabel(dropMin, session!.durationMin)}
                    </span>
                  </div>
                )}

                {day === today && nowMin >= g.startHour * 60 && (
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 z-20" style={{ top: minutesToPx(nowMin, g) }}>
                    <div className="h-0.5 bg-rose-400" />
                    <div className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-rose-400" />
                    {days.length === 1 && (
                      <span className="absolute -top-4 right-1 rounded bg-[#0a0a0f] px-1 font-mono text-[10px] text-rose-300">
                        {minutesToClock(nowMin)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
