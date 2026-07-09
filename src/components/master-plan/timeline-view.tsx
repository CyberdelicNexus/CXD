"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { TaskProjection } from "@/types/plan-types";
import type { MasterPlanTaskItem } from "./shared";

const GanttViewEnhanced = dynamic(
  () => import("@/components/cxd/plan/gantt-view-enhanced").then((m) => ({ default: m.GanttViewEnhanced })),
  { ssr: false, loading: () => <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-white/40 animate-spin" /></div> }
);

interface MasterPlanTimelineViewProps {
  items: MasterPlanTaskItem[];
  onTaskClick: (item: MasterPlanTaskItem) => void;
  onTaskUpdate: (projectId: string, taskId: string, updates: Partial<TaskProjection>) => void;
  detailPanelOpen?: boolean;
}

/**
 * The real Gantt chart from the single-project Plan tab, reused as-is —
 * task bars, drag-to-reschedule, dependency lines, hierarchy, all of it.
 * Project grouping/visibility is handled upstream (ProjectFilterBar filters
 * `items` before they ever reach this component).
 *
 * Deliberately NOT passing `versions` here: GanttViewEnhanced renders
 * draggable release swimlane bars that call the single-project store's
 * `updateVersion` directly (no prop override exists for it). On this page
 * there's no live project loaded in that store, so a version drag here
 * could silently no-op or, worse, target whatever project was last loaded
 * into the store elsewhere in the tab. Task bars/dependencies/dates are
 * fully independent of that code path and work exactly as they do
 * single-project. Cross-project version scheduling lives in Roadmap instead
 * (read + task links only, for the same reason).
 */
export function MasterPlanTimelineView({ items, onTaskClick, onTaskUpdate, detailPanelOpen }: MasterPlanTimelineViewProps) {
  const router = useRouter();

  const tasks = useMemo(() => items.map((it) => it.task), [items]);
  const taskIndex = useMemo(() => {
    const map = new Map<string, MasterPlanTaskItem>();
    for (const it of items) map.set(it.task.id, it);
    return map;
  }, [items]);

  return (
    <div className="h-[720px]">
      <GanttViewEnhanced
        tasks={tasks}
        onTaskClick={(taskId) => {
          const item = taskIndex.get(taskId);
          if (item) onTaskClick(item);
        }}
        onTaskNavigate={(taskId) => {
          const item = taskIndex.get(taskId);
          if (item) router.push(`/cxd/overview/${item.projectId}`);
        }}
        onTaskUpdate={(taskId, updates) => {
          const item = taskIndex.get(taskId);
          if (item) onTaskUpdate(item.projectId, taskId, updates);
        }}
        detailPanelOpen={detailPanelOpen}
      />
    </div>
  );
}
