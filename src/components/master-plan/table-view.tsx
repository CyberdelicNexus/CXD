"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskProjection, TaskStatus, TaskPriority } from "@/types/plan-types";
import { projectColor, type MasterPlanTaskItem } from "./shared";

const STATUS_OPTIONS: TaskStatus[] = ["not_started", "in_progress", "blocked", "completed"];
const PRIORITY_OPTIONS: TaskPriority[] = ["low", "medium", "high", "urgent"];

const STATUS_STYLES: Record<TaskStatus, string> = {
  not_started: "bg-white/10 text-white/60 border-white/10",
  in_progress: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  blocked: "bg-red-500/15 text-red-300 border-red-500/30",
};
const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
  blocked: "Blocked",
};
const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "text-white/50",
  medium: "text-cyan-300",
  high: "text-amber-300",
  urgent: "text-red-300",
};

type GroupBy = "project" | "status" | "priority" | "none";
type SortField = "title" | "status" | "priority" | "dueDate";

interface MasterPlanTableViewProps {
  items: MasterPlanTaskItem[];
  onTaskClick: (item: MasterPlanTaskItem) => void;
  onTaskUpdate: (projectId: string, taskId: string, updates: Partial<TaskProjection>) => void;
}

export function MasterPlanTableView({ items, onTaskClick, onTaskUpdate }: MasterPlanTableViewProps) {
  const router = useRouter();
  const [groupBy, setGroupBy] = useState<GroupBy>("project");
  const [sortField, setSortField] = useState<SortField>("priority");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const priorityRank: Record<TaskPriority, number> = { low: 0, medium: 1, high: 2, urgent: 3 };
    return [...items].sort((a, b) => {
      switch (sortField) {
        case "title":
          return a.task.title.localeCompare(b.task.title) * dir;
        case "status":
          return a.task.status.localeCompare(b.task.status) * dir;
        case "priority":
          return (priorityRank[a.task.priority || "low"] - priorityRank[b.task.priority || "low"]) * dir;
        case "dueDate":
          return (a.task.dueDate || "").localeCompare(b.task.dueDate || "") * dir;
        default:
          return 0;
      }
    });
  }, [items, sortField, sortDir]);

  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: "All Tasks", color: undefined as string | undefined, items: sorted }];
    const map = new Map<string, { label: string; color?: string; items: MasterPlanTaskItem[] }>();
    for (const it of sorted) {
      let key: string;
      let label: string;
      let color: string | undefined;
      if (groupBy === "project") {
        key = it.projectId;
        label = it.projectName;
        color = projectColor(it.projectId);
      } else if (groupBy === "status") {
        key = it.task.status;
        label = STATUS_LABELS[it.task.status];
      } else {
        key = it.task.priority || "none";
        label = it.task.priority ? it.task.priority[0].toUpperCase() + it.task.priority.slice(1) : "No priority";
      }
      if (!map.has(key)) map.set(key, { label, color, items: [] });
      map.get(key)!.items.push(it);
    }
    return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
  }, [sorted, groupBy]);

  const toggleSort = (field: SortField) => {
    if (field === sortField) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };
  const toggleCollapse = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const colCount = groupBy !== "project" ? 7 : 6;

  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10">
        <span className="text-xs text-white/40">Group by</span>
        {(["project", "status", "priority", "none"] as GroupBy[]).map((g) => (
          <button
            key={g}
            onClick={() => setGroupBy(g)}
            className={cn(
              "px-2 py-1 rounded-md text-xs capitalize transition-colors",
              groupBy === g ? "bg-violet-500/20 text-violet-200" : "text-white/50 hover:text-white hover:bg-white/5"
            )}
          >
            {g}
          </button>
        ))}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-white/50">
            {(
              [
                ["title", "Task"],
                ["status", "Status"],
                ["priority", "Priority"],
                ["dueDate", "Due"],
              ] as [SortField, string][]
            ).map(([field, label]) => (
              <th key={field} className="px-4 py-3 font-medium">
                <button onClick={() => toggleSort(field)} className="flex items-center gap-1 hover:text-white transition-colors">
                  {label}
                  <ArrowUpDown className={cn("w-3 h-3", sortField === field ? "text-violet-400" : "text-white/20")} />
                </button>
              </th>
            ))}
            {groupBy !== "project" && <th className="px-4 py-3 font-medium">Project</th>}
            <th className="px-4 py-3 font-medium">Assignee</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.key);
            return (
              <Fragment key={group.key}>
                {groupBy !== "none" && (
                  <tr className="bg-white/[0.03] cursor-pointer" onClick={() => toggleCollapse(group.key)}>
                    <td colSpan={colCount} className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 text-white/40" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-white/40" />
                        )}
                        {group.color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />}
                        <span className="text-xs font-semibold text-white/80">{group.label}</span>
                        <span className="text-xs text-white/30">{group.items.length}</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!isCollapsed &&
                  group.items.map((item) => {
                    const { task, projectId, projectName } = item;
                    return (
                    <tr
                      key={`${projectId}-${task.id}`}
                      className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors group"
                      onClick={() => onTaskClick(item)}
                    >
                      <td className="px-4 py-3 text-white max-w-[320px] truncate">
                        <span className="inline-flex items-center gap-2">
                          {groupBy !== "project" && (
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: projectColor(projectId) }} />
                          )}
                          {task.title || "Untitled task"}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={task.status}
                          onChange={(e) => onTaskUpdate(projectId, task.id, { status: e.target.value as TaskStatus })}
                          className={cn("appearance-none cursor-pointer px-2 py-0.5 rounded-full text-xs border bg-transparent", STATUS_STYLES[task.status])}
                          style={{ colorScheme: "dark" }}
                        >
                          {STATUS_OPTIONS.map((s) => <option key={s} value={s} className="bg-black text-white">{STATUS_LABELS[s]}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 capitalize" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={task.priority || ""}
                          onChange={(e) => onTaskUpdate(projectId, task.id, { priority: (e.target.value as TaskPriority) || undefined })}
                          className={cn("appearance-none cursor-pointer bg-transparent border-none", task.priority ? PRIORITY_STYLES[task.priority] : "text-white/30")}
                          style={{ colorScheme: "dark" }}
                        >
                          <option value="" className="bg-black text-white">—</option>
                          {PRIORITY_OPTIONS.map((p) => <option key={p} value={p} className="bg-black text-white capitalize">{p}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-white/60">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}</td>
                      {groupBy !== "project" && <td className="px-4 py-3 text-white/60 max-w-[140px] truncate">{projectName}</td>}
                      <td className="px-4 py-3 text-white/60">{task.assignee || "—"}</td>
                      <td className="px-4 py-3 text-white/20 group-hover:text-white/50 transition-colors">
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/cxd/overview/${projectId}`); }}
                          title="Open project"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                    );
                  })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
