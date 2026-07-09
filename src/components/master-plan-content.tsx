"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid,
  Kanban,
  List,
  CalendarRange,
  Calendar as CalendarIcon,
  Map as RoadmapIcon,
  Loader2,
  Lock,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { UpgradeModal } from "@/components/modals/upgrade-modal";
import { cn } from "@/lib/utils";
import { ProjectFilterBar } from "@/components/master-plan/project-filter-bar";
import { MasterPlanTableView } from "@/components/master-plan/table-view";
import { MasterPlanKanbanView } from "@/components/master-plan/kanban-view";
import { MasterPlanListView } from "@/components/master-plan/list-view";
import { MasterPlanTimelineView } from "@/components/master-plan/timeline-view";
import { MasterPlanCalendarView } from "@/components/master-plan/calendar-view";
import { MasterPlanRoadmapView } from "@/components/master-plan/roadmap-view";
import { MasterPlanTaskDetailPanel } from "@/components/master-plan/task-detail-panel";
import { toServerTaskPatch, type MasterPlanProject, type MasterPlanTaskItem } from "@/components/master-plan/shared";
import type { MasterPlanVersionItem } from "@/app/api/master-plan/versions/route";
import type { TaskProjection } from "@/types/plan-types";
import type { OKR } from "@/types/version-types";

type MasterPlanView = "table" | "kanban" | "list" | "timeline" | "calendar" | "roadmap";

const VIEWS: { id: MasterPlanView; label: string; icon: typeof LayoutGrid }[] = [
  { id: "table", label: "Table", icon: LayoutGrid },
  { id: "kanban", label: "Kanban", icon: Kanban },
  { id: "list", label: "List", icon: List },
  { id: "timeline", label: "Timeline", icon: CalendarRange },
  { id: "calendar", label: "Calendar", icon: CalendarIcon },
  { id: "roadmap", label: "Roadmap", icon: RoadmapIcon },
];

export function MasterPlanContent() {
  const router = useRouter();
  const { isLoading: subLoading, hasMasterPlan } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const [items, setItems] = useState<MasterPlanTaskItem[]>([]);
  const [projects, setProjects] = useState<MasterPlanProject[]>([]);
  const [versionItems, setVersionItems] = useState<MasterPlanVersionItem[]>([]);
  const [okrs, setOkrs] = useState<(OKR & { projectId: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<MasterPlanView>("table");
  const [hiddenProjectIds, setHiddenProjectIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<{ projectId: string; taskId: string } | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    if (subLoading || !hasMasterPlan) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [tasksRes, versionsRes] = await Promise.all([
          fetch("/api/master-plan/tasks"),
          fetch("/api/master-plan/versions"),
        ]);
        const tasksData = await tasksRes.json();
        if (!tasksRes.ok) throw new Error(tasksData.error || `Failed to load (${tasksRes.status})`);
        if (cancelled) return;
        setItems(tasksData.items || []);
        setProjects(tasksData.projects || []);

        if (versionsRes.ok) {
          const versionsData = await versionsRes.json();
          if (!cancelled) {
            setVersionItems(versionsData.versions || []);
            setOkrs(versionsData.okrs || []);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load Master Plan");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subLoading, hasMasterPlan]);

  const visibleItems = useMemo(
    () => items.filter((it) => !hiddenProjectIds.has(it.projectId)),
    [items, hiddenProjectIds]
  );
  const countsByProject = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const it of items) counts[it.projectId] = (counts[it.projectId] || 0) + 1;
    return counts;
  }, [items]);
  const toggleProject = (projectId: string) =>
    setHiddenProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });

  // Optimistic update, rolled back on a failed PATCH. Shared by every view —
  // inline table edits, Kanban drag, Gantt reschedule, and the detail panel
  // all funnel through this one path so there's exactly one place that talks
  // to the write API and one place that handles rollback.
  const updateTask = useCallback((projectId: string, taskId: string, updates: Partial<TaskProjection>) => {
    let prevItem: MasterPlanTaskItem | null = null;
    setItems((prev) =>
      prev.map((it) => {
        if (it.projectId === projectId && it.task.id === taskId) {
          prevItem = it;
          return { ...it, task: { ...it.task, ...updates } };
        }
        return it;
      })
    );
    fetch(`/api/master-plan/tasks/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, patch: toServerTaskPatch(updates) }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to update task (${res.status})`);
        }
      })
      .catch((e) => {
        if (prevItem) {
          const restored = prevItem;
          setItems((prev) => prev.map((it) => (it.projectId === projectId && it.task.id === taskId ? restored : it)));
        }
        setUpdateError(e instanceof Error ? e.message : "Failed to update task");
      });
  }, []);

  const selectedItem = useMemo(
    () => (selected ? items.find((it) => it.projectId === selected.projectId && it.task.id === selected.taskId) || null : null),
    [selected, items]
  );

  const openTask = useCallback((item: MasterPlanTaskItem) => {
    setSelected({ projectId: item.projectId, taskId: item.task.id });
  }, []);

  // ── Not entitled: soft-locked upsell state (same convention as Plan View) ──
  if (!subLoading && !hasMasterPlan) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Lock className="w-7 h-7 text-violet-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Master Plan is a Pro feature</h1>
        <p className="text-white/50 mb-8">
          A single cockpit for every task across every canvas in your account — Table, Kanban,
          List, Timeline, Calendar, and Roadmap views, all filtered live and editable across your
          whole workspace.
        </p>
        <button
          onClick={() => setShowUpgradeModal(true)}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Upgrade to Pro
        </button>
        <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} feature="master-plan" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-[1600px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Master Plan</h1>
          <p className="text-sm text-white/50 mt-1">
            {isLoading
              ? "Loading…"
              : `${visibleItems.length} task${visibleItems.length === 1 ? "" : "s"} across ${projects.length - hiddenProjectIds.size} project${projects.length - hiddenProjectIds.size === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      {!isLoading && !error && items.length > 0 && (
        <ProjectFilterBar projects={projects} hiddenProjectIds={hiddenProjectIds} onToggle={toggleProject} counts={countsByProject} />
      )}

      {updateError && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {updateError}
          <button onClick={() => setUpdateError(null)} className="ml-auto text-red-300/60 hover:text-red-300">Dismiss</button>
        </div>
      )}

      <div className="flex items-center gap-1.5 mb-4 p-1 rounded-xl bg-black/20 border border-white/10 w-fit">
        {VIEWS.map((v) => {
          const isActive = activeView === v.id;
          return (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              title={v.label}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-violet-500/20 text-violet-200 border border-violet-500/30"
                  : "text-white/60 hover:text-white hover:bg-white/5 border border-transparent"
              )}
            >
              <v.icon className="w-4 h-4" />
              {v.label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0 rounded-xl overflow-hidden bg-black/20 border border-white/10">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
            </div>
          ) : error ? (
            <div className="py-16 text-center text-red-300 text-sm">{error}</div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-white/50">No tasks found across your projects yet.</p>
              <p className="text-white/30 text-sm mt-1">Tag a card as a task or use the Plan tab in any canvas to get started.</p>
            </div>
          ) : visibleItems.length === 0 && activeView !== "roadmap" ? (
            <div className="py-16 text-center text-white/40 text-sm">All projects are hidden. Toggle one back on above to see its tasks.</div>
          ) : activeView === "table" ? (
            <MasterPlanTableView items={visibleItems} onTaskClick={openTask} onTaskUpdate={updateTask} />
          ) : activeView === "kanban" ? (
            <MasterPlanKanbanView items={visibleItems} onTaskClick={openTask} onTaskUpdate={updateTask} />
          ) : activeView === "list" ? (
            <MasterPlanListView items={visibleItems} onTaskClick={openTask} onTaskUpdate={updateTask} />
          ) : activeView === "timeline" ? (
            <MasterPlanTimelineView items={visibleItems} onTaskClick={openTask} onTaskUpdate={updateTask} detailPanelOpen={!!selectedItem} />
          ) : activeView === "roadmap" ? (
            <MasterPlanRoadmapView
              versionItems={versionItems}
              okrs={okrs}
              items={visibleItems}
              hiddenProjectIds={hiddenProjectIds}
              onTaskClick={openTask}
            />
          ) : (
            <MasterPlanCalendarView items={visibleItems} onTaskClick={openTask} />
          )}
        </div>

        {selectedItem && (
          <div className="w-[420px] flex-shrink-0 rounded-xl overflow-hidden bg-black/40 border border-white/10 sticky top-6" style={{ height: "calc(100vh - 220px)" }}>
            <MasterPlanTaskDetailPanel
              task={selectedItem.task}
              projectId={selectedItem.projectId}
              projectName={selectedItem.projectName}
              versions={versionItems.filter((v) => v.projectId === selectedItem.projectId).map((v) => v.version)}
              onClose={() => setSelected(null)}
              onUpdate={(updates) => updateTask(selectedItem.projectId, selectedItem.task.id, updates)}
              onOpenInCanvas={() => router.push(`/cxd/overview/${selectedItem.projectId}`)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
