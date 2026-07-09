"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { TaskProjection, TaskStatus, TaskPriority } from "@/types/plan-types";
import { projectColor, type MasterPlanTaskItem } from "./shared";

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "not_started", label: "Not Started" },
  { id: "in_progress", label: "In Progress" },
  { id: "blocked", label: "Blocked" },
  { id: "completed", label: "Completed" },
];
const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "text-white/40",
  medium: "text-cyan-300",
  high: "text-amber-300",
  urgent: "text-red-300",
};

interface MasterPlanKanbanViewProps {
  items: MasterPlanTaskItem[];
  onTaskClick: (item: MasterPlanTaskItem) => void;
  onTaskUpdate: (projectId: string, taskId: string, updates: Partial<TaskProjection>) => void;
}

/**
 * Status is the primary axis (that's what makes it a Kanban board); project
 * is shown via a colored dot + label on each card rather than a second
 * grouping axis, which would fragment the board into too many sub-lanes.
 * Drag a card between columns to change its status.
 */
export function MasterPlanKanbanView({ items, onTaskClick, onTaskUpdate }: MasterPlanKanbanViewProps) {
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const byStatus = useMemo(() => {
    const map = new Map<TaskStatus, MasterPlanTaskItem[]>();
    for (const col of COLUMNS) map.set(col.id, []);
    for (const it of items) {
      if (!map.has(it.task.status)) map.set(it.task.status, []);
      map.get(it.task.status)!.push(it);
    }
    return map;
  }, [items]);

  return (
    <div className="flex gap-4 p-4 overflow-x-auto">
      {COLUMNS.map((col) => {
        const colItems = byStatus.get(col.id) || [];
        return (
          <div
            key={col.id}
            className="flex-shrink-0 w-72"
            onDragOver={(e) => { e.preventDefault(); setDragOverColumn(col.id); }}
            onDragLeave={() => setDragOverColumn((prev) => (prev === col.id ? null : prev))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverColumn(null);
              if (!draggedKey) return;
              const [projectId, taskId] = draggedKey.split("::");
              const item = items.find((it) => it.projectId === projectId && it.task.id === taskId);
              if (item && item.task.status !== col.id) onTaskUpdate(projectId, taskId, { status: col.id });
              setDraggedKey(null);
            }}
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold text-white/70 uppercase tracking-wide">{col.label}</span>
              <span className="text-xs text-white/30">{colItems.length}</span>
            </div>
            <div className={cn("space-y-2 min-h-[40px] rounded-lg transition-colors", dragOverColumn === col.id && "bg-violet-500/10 ring-1 ring-violet-500/30")}>
              {colItems.map((item) => {
                const { task, projectId, projectName } = item;
                const key = `${projectId}::${task.id}`;
                return (
                <div
                  key={key}
                  draggable
                  onDragStart={() => setDraggedKey(key)}
                  onDragEnd={() => setDraggedKey(null)}
                  onClick={() => onTaskClick(item)}
                  className={cn(
                    "p-3 rounded-lg bg-white/5 border border-white/10 hover:border-violet-400/40 hover:bg-white/[0.07] cursor-pointer transition-all",
                    draggedKey === key && "opacity-40"
                  )}
                >
                  <p className="text-sm text-white/85 line-clamp-2 mb-2">{task.title || "Untitled task"}</p>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-[10px] text-white/50 truncate">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: projectColor(projectId) }} />
                      {projectName}
                    </span>
                    {task.priority && <span className={cn("text-[10px] capitalize flex-shrink-0", PRIORITY_STYLES[task.priority])}>{task.priority}</span>}
                  </div>
                </div>
                );
              })}
              {colItems.length === 0 && <div className="text-xs text-white/20 text-center py-6">No tasks</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
