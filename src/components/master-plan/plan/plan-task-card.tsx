"use client";

import { Archive, CalendarArrowUp, CalendarCheck2, Check, Inbox, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMinutes, taskMinutes } from "@/lib/master-plan/plan/plan-days";
import { clockToMinutes, rangeLabel } from "@/lib/master-plan/plan/timeline-geometry";
import { tintStyle, type PlanEntry } from "./plan-entries";
import { PlanTaskMenu, type PlanActions } from "./plan-task-menu";
import type { PlanDrag } from "./use-plan-drag";

export const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-violet-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]";

/** The round done toggle used on cards and time blocks. */
export function DoneToggle({ entry, onToggle, className }: { entry: PlanEntry; onToggle: () => void; className?: string }) {
  const done = entry.status === "completed";
  return (
    <button
      type="button"
      data-no-drag
      aria-pressed={done}
      aria-label={done ? `Mark "${entry.title}" as not done` : `Mark "${entry.title}" as done`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border transition-colors motion-reduce:transition-none",
        done
          ? "border-teal-300/80 bg-teal-400/20 text-teal-200"
          : "border-white/25 text-transparent hover:border-teal-300/70 hover:text-teal-200/70",
        FOCUS_RING,
        className
      )}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </button>
  );
}

function QuickAction({ label, onClick, children, tone }: { label: string; onClick: () => void; children: React.ReactNode; tone?: "warn" }) {
  return (
    <button
      type="button"
      data-no-drag
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-white/35 transition-colors motion-reduce:transition-none",
        "group-hover:border-white/10 group-hover:text-white/55",
        tone === "warn" ? "hover:!text-orange-300" : "hover:!text-violet-200",
        FOCUS_RING
      )}
    >
      {children}
    </button>
  );
}

export interface PlanTaskCardProps {
  entry: PlanEntry;
  actions: PlanActions;
  drag: PlanDrag;
  today: string;
  /** Hide quick actions that make no sense where the card sits. */
  context: "column" | "backlog" | "tray";
  dragging?: boolean;
}

export function PlanTaskCard({ entry, actions, drag, today, context, dragging }: PlanTaskCardProps) {
  const { task, projectName } = entry.item;
  const done = entry.status === "completed";
  const minutes = taskMinutes(entry);
  const start = clockToMinutes(entry.scheduledStart);
  const late = !done && entry.dueDate ? entry.dueDate.slice(0, 10) < today : false;
  const tags = (task.tags ?? []).slice(0, 2);
  const dragProps = entry.plannable
    ? drag.sourceProps({ key: entry.id, title: entry.title, color: entry.color, durationMin: minutes || 60 })
    : {};

  return (
    <PlanTaskMenu entry={entry} actions={actions} today={today}>
      <div
        data-plan-card={entry.id}
        role="button"
        tabIndex={0}
        aria-label={`${entry.title}, ${projectName}${done ? ", done" : ""}`}
        onClick={() => actions.open(entry)}
        onKeyDown={(e) => {
          if (e.key === "Enter") actions.open(entry);
          if (e.key === " ") {
            e.preventDefault();
            actions.toggleDone(entry);
          }
        }}
        {...dragProps}
        style={tintStyle(entry.color)}
        className={cn(
          "group relative rounded-xl border-l-[3px] py-2 pl-3 pr-10 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_3px_14px_rgba(0,0,0,0.5)]",
          "cursor-pointer select-none transition-[filter,opacity] hover:brightness-125 motion-reduce:transition-none",
          entry.plannable && "touch-pan-y",
          dragging && "opacity-35",
          FOCUS_RING
        )}
      >
        <DoneToggle entry={entry} onToggle={() => actions.toggleDone(entry)} className="absolute right-2 top-2" />

        {(start !== null || minutes > 0 || entry.dueDate) && (
          <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums">
            {start !== null && <span className="font-medium text-white/75">{rangeLabel(start, entry.durationMinutes ?? 60)}</span>}
            {start === null && minutes > 0 && (
              <span className="rounded bg-white/[0.07] px-1.5 py-px font-mono text-[10.5px] text-white/60">{formatMinutes(minutes)}</span>
            )}
            {entry.dueDate && (
              <span className={cn("text-[10.5px]", late ? "text-red-300" : "text-white/40")}>
                due {entry.dueDate.slice(5, 10)}
              </span>
            )}
          </div>
        )}

        <p className={cn("text-[13.5px] leading-snug text-white/90 line-clamp-3", done && "text-white/45 line-through opacity-80")}>
          {entry.title}
        </p>

        {entry.plannable && task.totalSubtasks > 0 && (
          <div className="mt-2">
            <div className="mb-1 flex justify-between text-[10px] text-white/40 tabular-nums">
              <span>
                {task.completedSubtasks}/{task.totalSubtasks} subtasks
              </span>
              <span>{task.completionPercent}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
                style={{
                  width: `${task.completionPercent}%`,
                  minWidth: task.completionPercent > 0 ? 4 : 0,
                  background: `linear-gradient(90deg, color-mix(in oklab, ${entry.color} 55%, #0a0a12), color-mix(in oklab, ${entry.color} 90%, white))`,
                }}
              />
            </div>
          </div>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex max-w-full items-center gap-1 truncate text-[10.5px] text-white/50">
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
            {projectName}
          </span>
          {tags.map((tag) => (
            <span
              key={tag}
              className="max-w-[110px] truncate rounded-full border px-1.5 py-px text-[10px]"
              style={{ color: entry.color, borderColor: `${entry.color}66` }}
            >
              #{tag}
            </span>
          ))}
          {!entry.plannable && (
            <span className="inline-flex items-center gap-1 text-[10px] text-white/35" title="A checklist item inside a card">
              <ListChecks className="h-3 w-3" /> checklist
            </span>
          )}
        </div>

        {entry.plannable && !done && (
          <div className="mt-1.5 flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100">
            {entry.plannedDate !== today && (
              <QuickAction label="Plan for today" onClick={() => actions.planToday(entry)}>
                <CalendarCheck2 className="h-[15px] w-[15px]" />
              </QuickAction>
            )}
            <QuickAction label="Push to next day" onClick={() => actions.pushNextDay(entry)}>
              <CalendarArrowUp className="h-[15px] w-[15px]" />
            </QuickAction>
            {context !== "backlog" && entry.plannedDate && (
              <QuickAction label="Move to backlog" onClick={() => actions.toBacklog(entry)}>
                <Inbox className="h-[15px] w-[15px]" />
              </QuickAction>
            )}
            <QuickAction label="Archive" tone="warn" onClick={() => actions.archive(entry)}>
              <Archive className="h-[15px] w-[15px]" />
            </QuickAction>
          </div>
        )}
      </div>
    </PlanTaskMenu>
  );
}
