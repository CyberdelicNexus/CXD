"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Inbox, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays, daysFrom, isDone } from "@/lib/master-plan/plan/plan-days";
import type { TimeWindow } from "@/lib/master-plan/plan/timeline-geometry";
import type { PlanEntry } from "./plan-entries";
import { dayHeading } from "./plan-board";
import { PlanBacklogRail } from "./plan-backlog-rail";
import { FOCUS_RING, PlanTaskCard } from "./plan-task-card";
import type { PlanActions } from "./plan-task-menu";
import { PlanTimeGrid } from "./plan-time-grid";
import type { PlanDrag } from "./use-plan-drag";

/**
 * Phone layout: one day at a time. A day strip picks the day, the hour
 * grid sits under it with that day's untimed tasks as chips on top (long-
 * press a chip and drag it onto an hour), and the day's full cards follow.
 * The backlog opens as a bottom sheet; starting a drag from it closes the
 * sheet so the grid is there to drop on.
 */
export function PlanMobileDay({
  day,
  onDayChange,
  today,
  nowMin,
  entries,
  carriedOver,
  backlog,
  actions,
  drag,
  onBlockChange,
  composer,
  onAdd,
  sheetOpen,
  onSheetChange,
}: {
  day: string;
  onDayChange: (day: string) => void;
  today: string;
  nowMin: number;
  entries: PlanEntry[];
  carriedOver: PlanEntry[];
  backlog: PlanEntry[];
  actions: PlanActions;
  drag: PlanDrag;
  onBlockChange: (entry: PlanEntry, day: string, window: TimeWindow) => void;
  composer: { open: "day" | "backlog" | null; node: React.ReactNode };
  onAdd: (where: "day" | "backlog") => void;
  sheetOpen: boolean;
  onSheetChange: (open: boolean) => void;
}) {
  const heading = dayHeading(day);
  const strip = daysFrom(addDays(day, -3), 7);
  const stripRef = useRef<HTMLDivElement>(null);
  const done = entries.filter(isDone).length;

  useEffect(() => {
    const selected = stripRef.current?.querySelector<HTMLElement>('[aria-current="date"]');
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    selected?.scrollIntoView({ inline: "center", block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [day]);

  // While the sheet is open the page underneath shouldn't scroll.
  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheetOpen]);

  // A drag that starts in the sheet needs the grid, so get out of the way.
  useEffect(() => {
    if (drag.session && sheetOpen) onSheetChange(false);
  }, [drag.session, sheetOpen, onSheetChange]);

  const byDay = new Map([[day, entries]]);

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onDayChange(addDays(day, -1))}
          aria-label="Previous day"
          className={cn("rounded-lg p-2 text-white/60 hover:bg-white/5", FOCUS_RING)}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[16px] font-semibold text-white">{heading.long}</p>
          {day === today ? (
            <span className="text-[11px] uppercase tracking-wider text-violet-200">Today</span>
          ) : (
            <button type="button" onClick={() => onDayChange(today)} className={cn("text-[11.5px] text-teal-200/80 underline-offset-2 hover:underline", FOCUS_RING)}>
              Jump to today
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDayChange(addDays(day, 1))}
          aria-label="Next day"
          className={cn("rounded-lg p-2 text-white/60 hover:bg-white/5", FOCUS_RING)}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div ref={stripRef} className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto pb-1">
        {strip.map((d) => {
          const h = dayHeading(d);
          const selected = d === day;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onDayChange(d)}
              aria-current={selected ? "date" : undefined}
              aria-label={h.long}
              className={cn(
                "flex min-h-[58px] min-w-[46px] flex-1 snap-center flex-col items-center justify-center rounded-2xl border text-white/70",
                selected ? "border-violet-400/60 bg-violet-500/30 text-white" : "border-white/10 bg-white/[0.03]",
                d === today && !selected && "border-teal-300/50",
                FOCUS_RING
              )}
            >
              <span className="text-[10.5px] uppercase">{h.weekday.slice(0, 2)}</span>
              <span className="font-mono text-[15px]">{h.date}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-[12px] text-white/45">
        <span>
          {entries.length} planned · {done} done
        </span>
        <button
          type="button"
          onClick={() => onAdd("day")}
          className={cn("ml-auto flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-white/70", FOCUS_RING)}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
        <button
          type="button"
          onClick={() => onSheetChange(true)}
          className={cn("flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-white/70", FOCUS_RING)}
        >
          <Inbox className="h-3.5 w-3.5" /> Backlog
          <span className="tabular-nums text-white/40">{backlog.length + carriedOver.length}</span>
        </button>
      </div>

      {composer.open === "day" && composer.node}

      <div className="h-[60vh] min-h-[380px] overflow-hidden rounded-xl border border-white/[0.07] bg-black/25">
        <PlanTimeGrid
          days={[day]}
          entriesByDay={byDay}
          today={today}
          nowMin={nowMin}
          actions={actions}
          drag={drag}
          onBlockChange={onBlockChange}
        />
      </div>

      {entries.length > 0 ? (
        <div className="flex flex-col gap-1.5" data-plan-zone="column" data-day={day}>
          <h3 className="px-1 text-[10.5px] font-medium uppercase tracking-wider text-white/45">Planned for this day</h3>
          {entries.map((entry) => (
            <PlanTaskCard key={entry.id} entry={entry} actions={actions} drag={drag} today={today} context="column" dragging={drag.session?.key === entry.id} />
          ))}
        </div>
      ) : (
        <p className="py-4 text-center text-[12px] italic text-white/30">Nothing planned for this day yet.</p>
      )}

      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Backlog">
          <button type="button" aria-label="Close backlog" className="absolute inset-0 bg-black/60" onClick={() => onSheetChange(false)} />
          <div className="relative flex max-h-[78vh] flex-col rounded-t-2xl border-t border-white/10 bg-[#0d0d14] pt-2">
            <div className="flex items-center px-3 pb-1">
              <span className="mx-auto h-1 w-10 rounded-full bg-white/20" aria-hidden />
              <button
                type="button"
                onClick={() => onSheetChange(false)}
                aria-label="Close backlog"
                className={cn("absolute right-2 top-2 rounded-lg p-1.5 text-white/50", FOCUS_RING)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <PlanBacklogRail
              carriedOver={carriedOver}
              backlog={backlog}
              today={today}
              actions={actions}
              drag={drag}
              composer={composer.open === "backlog" ? composer.node : null}
              onAdd={() => onAdd("backlog")}
              className="min-h-0 flex-1 border-0 bg-transparent"
            />
          </div>
        </div>
      )}
    </div>
  );
}
