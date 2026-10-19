"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PLAN_VIEW_SPECS,
  addDays,
  compareBacklog,
  compareInDay,
  daysForView,
  isBacklog,
  isCarriedOver,
  parseISODay,
  stepForView,
  toISODay,
  type PlanViewMode,
} from "@/lib/master-plan/plan/plan-days";
import {
  archive,
  clearTime,
  moveToBacklog,
  moveToDay,
  planForDay,
  pushToNextDay,
  scheduleAt,
  toggleDone,
  type PlanUpdate,
} from "@/lib/master-plan/plan/plan-moves";
import { defaultDuration, dropStart, rangeLabel, type TimeWindow } from "@/lib/master-plan/plan/timeline-geometry";
import type { QuickAddResult } from "@/lib/master-plan/plan/quick-add";
import type { MasterPlanProject, MasterPlanTaskItem, TaskUpdate } from "../shared";
import { toPlanEntry, type PlanEntry } from "./plan-entries";
import { PlanBacklogRail } from "./plan-backlog-rail";
import { PlanBoard } from "./plan-board";
import { PlanMobileDay } from "./plan-mobile-day";
import { PlanQuickAdd } from "./plan-quick-add";
import { FOCUS_RING } from "./plan-task-card";
import type { PlanActions } from "./plan-task-menu";
import { PlanTimeGrid } from "./plan-time-grid";
import { usePlanDrag, type DropTarget } from "./use-plan-drag";

/** Body of the quick-add POST. */
export interface NewPlanTask {
  title: string;
  plannedDate?: string;
  planOrder?: number;
  scheduledStart?: string;
  durationMinutes?: number;
}

const MODES: PlanViewMode[] = ["board", "day", "three", "week"];
const MODE_KEY = "masterPlan.plan.mode";
const PROJECT_KEY = "masterPlan.plan.project";

function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writePref(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Preferences are a convenience; private mode just forgets them.
  }
}

/** The current time, refreshed every minute (drives "today" and the now-line). */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function rangeTitle(days: string[]): string {
  const first = parseISODay(days[0]);
  if (days.length === 1) return first.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const last = parseISODay(days[days.length - 1]);
  const fmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${first.toLocaleDateString(undefined, fmt)} – ${last.toLocaleDateString(undefined, fmt)}`;
}

/**
 * Master Plan → Plan: running a day. Pick tasks from the backlog, put them
 * on a day in order (Board), give them time on the clock (Day / 3 days /
 * Week), and tick them off. Every edit goes through the Master Plan's
 * optimistic update path; nothing is written just by opening the view.
 */
export function MasterPlanPlanView({
  items,
  projects,
  onTaskClick,
  onTaskUpdate,
  onTaskCreate,
}: {
  items: MasterPlanTaskItem[];
  projects: MasterPlanProject[];
  onTaskClick: (item: MasterPlanTaskItem) => void;
  onTaskUpdate: (projectId: string, taskId: string, updates: TaskUpdate) => void;
  onTaskCreate: (projectId: string, fields: NewPlanTask) => Promise<boolean>;
}) {
  const now = useNow();
  const today = toISODay(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const [mode, setMode] = useState<PlanViewMode>("board");
  const [anchor, setAnchor] = useState(today);
  const [mobileDay, setMobileDay] = useState(today);
  const [composerAt, setComposerAt] = useState<string | null>(null); // a day, "backlog", or "mobile-day"
  const [sheetOpen, setSheetOpen] = useState(false);
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    const saved = readPref(MODE_KEY) as PlanViewMode | null;
    if (saved && MODES.includes(saved)) setMode(saved);
  }, []);
  useEffect(() => {
    if (projects.some((p) => p.id === projectId)) return;
    const saved = readPref(PROJECT_KEY);
    setProjectId(saved && projects.some((p) => p.id === saved) ? saved : projects[0]?.id ?? "");
  }, [projects, projectId]);

  const changeMode = (m: PlanViewMode) => {
    setMode(m);
    writePref(MODE_KEY, m);
  };
  const changeProject = (id: string) => {
    setProjectId(id);
    writePref(PROJECT_KEY, id);
  };

  // ── Derived plan state ────────────────────────────────────────────────
  const entries = useMemo(() => items.map(toPlanEntry).filter((e) => !e.isArchived), [items]);
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const byDay = useMemo(() => {
    const map = new Map<string, PlanEntry[]>();
    for (const e of entries) {
      if (!e.plannedDate) continue;
      const list = map.get(e.plannedDate) ?? [];
      list.push(e);
      map.set(e.plannedDate, list);
    }
    map.forEach((list) => list.sort(compareInDay));
    return map;
  }, [entries]);
  const carriedOver = useMemo(
    () => entries.filter((e) => isCarriedOver(e, today)).sort((a, b) => (a.plannedDate! < b.plannedDate! ? -1 : 1)),
    [entries, today]
  );
  const backlog = useMemo(() => entries.filter(isBacklog).sort(compareBacklog), [entries]);
  const days = useMemo(() => daysForView(mode, anchor), [mode, anchor]);

  // ── Writes ────────────────────────────────────────────────────────────
  const apply = useCallback(
    (updates: PlanUpdate | PlanUpdate[]) => {
      for (const u of Array.isArray(updates) ? updates : [updates]) {
        const entry = byId.get(u.id);
        if (!entry || Object.keys(u.updates).length === 0) continue;
        onTaskUpdate(entry.item.projectId, entry.item.task.id, u.updates);
      }
    },
    [byId, onTaskUpdate]
  );

  const actions: PlanActions = useMemo(
    () => ({
      open: (e) => onTaskClick(e.item),
      toggleDone: (e) => apply(toggleDone(e)),
      planToday: (e) => apply(planForDay(e, today)),
      pushNextDay: (e) => apply(pushToNextDay(e, today)),
      toBacklog: (e) => apply(moveToBacklog(e)),
      clearTime: (e) => apply(clearTime(e)),
      archive: (e) => apply(archive(e)),
    }),
    [apply, onTaskClick, today]
  );

  const onDrop = useCallback(
    (key: string, target: DropTarget) => {
      const entry = byId.get(key);
      if (!entry || !entry.plannable) return;
      if (target.kind === "column") {
        apply(moveToDay(entry, target.day, byDay.get(target.day) ?? [], target.targetKey, target.below));
      } else if (target.kind === "grid") {
        const duration = entry.durationMinutes ?? defaultDuration(entry.estimatedHours);
        apply(scheduleAt(entry, target.day, dropStart(target.localY, duration), duration));
      } else if (entry.plannedDate) {
        apply(moveToBacklog(entry));
      }
    },
    [apply, byDay, byId]
  );
  const drag = usePlanDrag(onDrop);

  const onBlockChange = useCallback(
    (entry: PlanEntry, day: string, w: TimeWindow) => apply(scheduleAt(entry, day, w.startMin, w.durationMin)),
    [apply]
  );

  const create = useCallback(
    async (day: string | null, pid: string, parsed: QuickAddResult) => {
      const fields: NewPlanTask = { title: parsed.title };
      // A time with no day means today.
      const plannedDate = day ?? (parsed.scheduledStart ? today : undefined);
      if (plannedDate) {
        fields.plannedDate = plannedDate;
        const orders = (byDay.get(plannedDate) ?? []).map((e) => e.planOrder).filter((o): o is number => o !== undefined);
        fields.planOrder = orders.length ? Math.min(...orders) - 1000 : 1000;
      }
      if (parsed.scheduledStart) fields.scheduledStart = parsed.scheduledStart;
      if (parsed.durationMinutes) fields.durationMinutes = parsed.durationMinutes;
      return onTaskCreate(pid, fields);
    },
    [byDay, onTaskCreate, today]
  );

  const composerFor = (day: string | null) => (
    <PlanQuickAdd
      projects={projects}
      projectId={projectId}
      onProjectChange={changeProject}
      onSubmit={(pid, parsed) => create(day, pid, parsed)}
      onCancel={() => setComposerAt(null)}
      placeholder={day ? "Add a task to this day…" : "Add to the backlog…"}
    />
  );

  const spec = PLAN_VIEW_SPECS[mode];
  const step = stepForView(mode);
  const showsToday = days.includes(today);
  const session = drag.session;
  const ghostTime =
    session?.target?.kind === "grid" ? rangeLabel(dropStart(session.target.localY, session.durationMin), session.durationMin) : null;

  return (
    <div>
      {/* ── Desktop / tablet ── */}
      <div className="hidden h-[calc(100dvh-250px)] min-h-[540px] flex-col md:flex">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.07] px-3 py-2">
          <div role="radiogroup" aria-label="Plan layout" className="flex gap-1 rounded-lg bg-black/30 p-0.5">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => changeMode(m)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[12.5px] transition-colors motion-reduce:transition-none",
                  mode === m ? "bg-violet-500/25 text-violet-100" : "text-white/55 hover:text-white",
                  FOCUS_RING
                )}
              >
                {PLAN_VIEW_SPECS[m].label}
              </button>
            ))}
          </div>
          <span className="ml-2 text-[13px] text-white/70">{rangeTitle(days)}</span>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              aria-label="Earlier"
              onClick={() => setAnchor(addDays(anchor, -step))}
              className={cn("rounded-md p-1.5 text-white/55 hover:bg-white/5 hover:text-white", FOCUS_RING)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={anchor === today}
              onClick={() => setAnchor(today)}
              className={cn(
                "rounded-md border border-white/10 px-2.5 py-1 text-[12px] text-white/70 hover:bg-white/5 disabled:opacity-40",
                FOCUS_RING
              )}
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Later"
              onClick={() => setAnchor(addDays(anchor, step))}
              className={cn("rounded-md p-1.5 text-white/55 hover:bg-white/5 hover:text-white", FOCUS_RING)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 gap-3 p-3">
          <PlanBacklogRail
            carriedOver={carriedOver}
            backlog={backlog}
            today={today}
            actions={actions}
            drag={drag}
            composer={composerAt === "backlog" ? composerFor(null) : null}
            onAdd={() => setComposerAt("backlog")}
            className="w-[272px] flex-shrink-0"
          />
          <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-white/[0.07] bg-black/20">
            {spec.timed ? (
              <PlanTimeGrid
                days={days}
                entriesByDay={byDay}
                today={today}
                nowMin={nowMin}
                actions={actions}
                drag={drag}
                onBlockChange={onBlockChange}
              />
            ) : (
              <PlanBoard
                days={days}
                columns={byDay}
                today={today}
                actions={actions}
                drag={drag}
                composer={{
                  day: composerAt && composerAt !== "backlog" && composerAt !== "mobile" ? composerAt : null,
                  node: composerAt && composerAt !== "backlog" && composerAt !== "mobile" ? composerFor(composerAt) : null,
                }}
                onAdd={(day) => setComposerAt(day)}
              />
            )}
          </div>
        </div>
        {!showsToday && spec.timed && (
          <p className="sr-only" aria-live="polite">
            Today is not in this range.
          </p>
        )}
      </div>

      {/* ── Phone ── */}
      <div className="md:hidden">
        <PlanMobileDay
          day={mobileDay}
          onDayChange={setMobileDay}
          today={today}
          nowMin={nowMin}
          entries={byDay.get(mobileDay) ?? []}
          carriedOver={carriedOver}
          backlog={backlog}
          actions={actions}
          drag={drag}
          onBlockChange={onBlockChange}
          composer={{
            open: composerAt === "mobile" ? "day" : composerAt === "backlog" ? "backlog" : null,
            node: composerAt === "mobile" ? composerFor(mobileDay) : composerAt === "backlog" ? composerFor(null) : null,
          }}
          onAdd={(where) => setComposerAt(where === "day" ? "mobile" : "backlog")}
          sheetOpen={sheetOpen}
          onSheetChange={setSheetOpen}
        />
      </div>

      {/* Drag ghost */}
      {session && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[60] flex max-w-[240px] items-center gap-2 rounded-lg border border-white/15 bg-[#14141c]/95 px-2.5 py-1.5 text-[12px] text-white shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
          style={{ left: session.x + 14, top: session.y + 10 }}
        >
          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: session.color }} />
          <span className="truncate">{session.title}</span>
          {ghostTime && <span className="flex-shrink-0 font-mono text-[10.5px] text-teal-200">{ghostTime}</span>}
          {session.target?.kind === "backlog" && <span className="flex-shrink-0 text-[10.5px] text-white/50">to backlog</span>}
        </div>
      )}
    </div>
  );
}
