"use client";

import { Fragment } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMinutes, parseISODay, taskMinutes } from "@/lib/master-plan/plan/plan-days";
import type { PlanEntry } from "./plan-entries";
import { FOCUS_RING, PlanTaskCard } from "./plan-task-card";
import type { PlanActions } from "./plan-task-menu";
import type { PlanDrag } from "./use-plan-drag";

/** Thin insertion line shown where a dragged card will land. */
function DropLine() {
  return <div aria-hidden className="h-0.5 rounded-full bg-teal-300 shadow-[0_0_8px_rgba(94,234,212,0.7)]" />;
}

export function dayHeading(day: string) {
  const date = parseISODay(day);
  return {
    weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
    date: date.getDate(),
    long: date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }),
  };
}

/**
 * Board: one untimed column per day. A column is the day work is assigned
 * to, in the order it should happen; times only appear as a label when a
 * task already has one.
 */
export function PlanBoard({
  days,
  columns,
  today,
  actions,
  drag,
  composer,
  onAdd,
}: {
  days: string[];
  columns: Map<string, PlanEntry[]>;
  today: string;
  actions: PlanActions;
  drag: PlanDrag;
  /** The day whose quick-add is open, and the composer to render there. */
  composer: { day: string | null; node: React.ReactNode };
  onAdd: (day: string) => void;
}) {
  const session = drag.session;
  return (
    <div data-plan-scroll-x className="flex h-full gap-2.5 overflow-x-auto p-3">
      {days.map((day) => {
        const entries = columns.get(day) ?? [];
        const heading = dayHeading(day);
        const isToday = day === today;
        const past = day < today;
        const planned = entries.filter((e) => e.status !== "completed").reduce((sum, e) => sum + taskMinutes(e), 0);
        const target = session?.target?.kind === "column" && session.target.day === day ? session.target : null;
        return (
          <section
            key={day}
            aria-label={heading.long}
            className={cn(
              "flex w-[260px] flex-shrink-0 flex-col rounded-xl border bg-black/25 transition-colors motion-reduce:transition-none",
              isToday ? "border-violet-400/40 bg-violet-500/[0.06]" : "border-white/[0.07]",
              target && "border-teal-300/50 bg-teal-400/[0.06]",
              past && !target && "opacity-60"
            )}
          >
            <header className="flex items-center gap-2 px-3 pb-2 pt-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{heading.weekday}</span>
              <span className={cn("font-mono text-sm", isToday ? "text-violet-200" : "text-white/80")}>{heading.date}</span>
              {isToday && <span className="rounded-full bg-violet-500/20 px-1.5 py-px text-[10px] text-violet-200">Today</span>}
              {planned > 0 && <span className="text-[11px] tabular-nums text-teal-200/80">{formatMinutes(planned)}</span>}
              <button
                type="button"
                onClick={() => onAdd(day)}
                aria-label={`Add a task on ${heading.long}`}
                className={cn("ml-auto rounded-md p-1 text-white/40 hover:bg-white/5 hover:text-white", FOCUS_RING)}
              >
                <Plus className="h-4 w-4" />
              </button>
            </header>
            <div
              data-plan-zone="column"
              data-day={day}
              data-plan-scroll
              className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-3"
            >
              {composer.day === day && composer.node}
              {entries.map((entry) => (
                <Fragment key={entry.id}>
                  {target && target.targetKey === entry.id && !target.below && <DropLine />}
                  <PlanTaskCard
                    entry={entry}
                    actions={actions}
                    drag={drag}
                    today={today}
                    context="column"
                    dragging={session?.key === entry.id}
                  />
                  {target && target.targetKey === entry.id && target.below && <DropLine />}
                </Fragment>
              ))}
              {target && target.targetKey === null && <DropLine />}
              {entries.length === 0 && composer.day !== day && (
                <p className="py-6 text-center text-[11.5px] italic text-white/25">Nothing planned</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
