"use client";

import { useMemo } from "react";
import { CheckCircle2, Circle, CircleDot, CircleSlash, Calendar, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { TaskProjection, TaskStatus, TaskPriority } from "@/types/plan-types";
import { projectColor, type MasterPlanTaskItem } from "./shared";

const STATUS_ICON: Record<TaskStatus, typeof Circle> = {
  not_started: Circle,
  in_progress: CircleDot,
  completed: CheckCircle2,
  blocked: CircleSlash,
};
const STATUS_COLOR: Record<TaskStatus, string> = {
  not_started: "text-white/30",
  in_progress: "text-blue-400",
  completed: "text-emerald-400",
  blocked: "text-red-400",
};
const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: "bg-white/20",
  medium: "bg-cyan-400",
  high: "bg-amber-400",
  urgent: "bg-red-400",
};

interface MasterPlanListViewProps {
  items: MasterPlanTaskItem[];
  onTaskClick: (item: MasterPlanTaskItem) => void;
  onTaskUpdate: (projectId: string, taskId: string, updates: Partial<TaskProjection>) => void;
}

/** Grouped by project, always — "grouping by project is essential to keep the display organized". */
export function MasterPlanListView({ items, onTaskClick, onTaskUpdate }: MasterPlanListViewProps) {
  const router = useRouter();
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: MasterPlanTaskItem[] }>();
    for (const it of items) {
      if (!map.has(it.projectId)) map.set(it.projectId, { name: it.projectName, items: [] });
      map.get(it.projectId)!.items.push(it);
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
  }, [items]);

  return (
    <div className="divide-y divide-white/5">
      {groups.map((group) => (
        <div key={group.id}>
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.02]">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: projectColor(group.id) }} />
            <span className="text-sm font-semibold text-white/80">{group.name}</span>
            <span className="text-xs text-white/30">{group.items.length}</span>
          </div>
          {group.items.map((item) => {
            const { task, projectId } = item;
            const StatusIcon = STATUS_ICON[task.status];
            return (
              <div
                key={`${projectId}-${task.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 cursor-pointer transition-colors group"
                onClick={() => onTaskClick(item)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTaskUpdate(projectId, task.id, { status: task.status === "completed" ? "not_started" : "completed" });
                  }}
                  title="Toggle completed"
                >
                  <StatusIcon className={cn("w-4 h-4 flex-shrink-0", STATUS_COLOR[task.status])} />
                </button>
                <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", task.priority ? PRIORITY_DOT[task.priority] : "bg-transparent")} />
                <span className={cn("text-sm flex-1 truncate", task.status === "completed" ? "text-white/40 line-through" : "text-white/80")}>
                  {task.title || "Untitled task"}
                </span>
                {task.dueDate && (
                  <span className="flex items-center gap-1 text-xs text-white/40 flex-shrink-0">
                    <Calendar className="w-3 h-3" />
                    {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); router.push(`/cxd/overview/${projectId}`); }}
                  className="text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0"
                  title="Open project"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
