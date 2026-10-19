"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanEntry } from "./plan-entries";
import { FOCUS_RING, PlanTaskCard } from "./plan-task-card";
import type { PlanActions } from "./plan-task-menu";
import type { PlanDrag } from "./use-plan-drag";

/**
 * Where unscheduled work waits. Open tasks still planned for a day that has
 * passed come first ("Earlier, not done") — they are shown, never moved
 * automatically. Then everything with no day, grouped by project.
 */
export function PlanBacklogRail({
  carriedOver,
  backlog,
  today,
  actions,
  drag,
  composer,
  onAdd,
  className,
}: {
  carriedOver: PlanEntry[];
  backlog: PlanEntry[];
  today: string;
  actions: PlanActions;
  drag: PlanDrag;
  composer: React.ReactNode | null;
  onAdd: () => void;
  className?: string;
}) {
  const groups = useMemo(() => {
    const byProject = new Map<string, { name: string; color: string; entries: PlanEntry[] }>();
    for (const e of backlog) {
      const g = byProject.get(e.item.projectId) ?? { name: e.item.projectName, color: e.color, entries: [] };
      g.entries.push(e);
      byProject.set(e.item.projectId, g);
    }
    return Array.from(byProject.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [backlog]);

  const isTarget = drag.session?.target?.kind === "backlog";

  return (
    <aside
      aria-label="Backlog"
      data-plan-zone="backlog"
      className={cn(
        "flex min-h-0 flex-col rounded-xl border bg-black/25 transition-colors motion-reduce:transition-none",
        isTarget ? "border-teal-300/50 bg-teal-400/[0.06]" : "border-white/[0.07]",
        className
      )}
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Backlog</span>
        <span className="text-[11px] tabular-nums text-white/30">{backlog.length}</span>
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add a task to the backlog"
          className={cn("ml-auto rounded-md p-1 text-white/40 hover:bg-white/5 hover:text-white", FOCUS_RING)}
        >
          <Plus className="h-4 w-4" />
        </button>
      </header>
      <div data-plan-scroll className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-3">
        {composer}

        {carriedOver.length > 0 && (
          <>
            <h3 className="mt-1 px-1 text-[10.5px] font-medium uppercase tracking-wider text-amber-200/70">
              Earlier, not done · {carriedOver.length}
            </h3>
            {carriedOver.map((entry) => (
              <PlanTaskCard key={entry.id} entry={entry} actions={actions} drag={drag} today={today} context="column" dragging={drag.session?.key === entry.id} />
            ))}
          </>
        )}

        {groups.map(([projectId, group]) => (
          <div key={projectId} className="flex flex-col gap-1.5">
            <h3 className="mt-2 flex items-center gap-1.5 px-1 text-[10.5px] font-medium uppercase tracking-wider text-white/45">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: group.color }} />
              <span className="truncate">{group.name}</span>
              <span className="text-white/25">{group.entries.length}</span>
            </h3>
            {group.entries.map((entry) => (
              <PlanTaskCard key={entry.id} entry={entry} actions={actions} drag={drag} today={today} context="backlog" dragging={drag.session?.key === entry.id} />
            ))}
          </div>
        ))}

        {backlog.length === 0 && carriedOver.length === 0 && !composer && (
          <p className="px-2 py-6 text-center text-[11.5px] leading-relaxed text-white/30">
            Every open task has a day. Drag one back here to unplan it.
          </p>
        )}
      </div>
    </aside>
  );
}
