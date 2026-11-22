import type { CSSProperties } from "react";
import type { PlanTaskLike } from "@/lib/master-plan/plan/plan-days";
import { canPlan } from "@/lib/master-plan/plan/plan-moves";
import { projectColor, type MasterPlanTaskItem } from "../shared";

/**
 * A Master Plan task as the Plan view sees it. `id` is the cross-project
 * key `${projectId}::${taskId}` so day columns, which mix projects, can be
 * ordered with the pure plan modules without id collisions.
 */
export interface PlanEntry extends PlanTaskLike {
  item: MasterPlanTaskItem;
  color: string;
  /** False for checklist rows inside a card: they can be ticked, not planned. */
  plannable: boolean;
}

export const entryKey = (projectId: string, taskId: string) => `${projectId}::${taskId}`;

export function toPlanEntry(item: MasterPlanTaskItem): PlanEntry {
  const { task } = item;
  return {
    id: entryKey(item.projectId, task.id),
    title: task.title || "Untitled task",
    status: task.status,
    isArchived: task.isArchived,
    dueDate: task.dueDate,
    estimatedHours: task.estimatedHours,
    plannedDate: task.plannedDate,
    planOrder: task.planOrder,
    scheduledStart: task.scheduledStart,
    durationMinutes: task.durationMinutes,
    item,
    color: projectColor(item.projectId),
    plannable: canPlan(task),
  };
}

/**
 * The project-tinted surface shared by cards and time blocks: the project
 * colour enters from the top-left over a near-black base, with a 3px edge
 * in the project colour.
 */
export function tintStyle(color: string, strength: "rest" | "lifted" = "rest"): CSSProperties {
  const [a, b] = strength === "lifted" ? [52, 20] : [40, 14];
  return {
    borderLeftColor: color,
    backgroundImage: `linear-gradient(135deg, color-mix(in oklab, ${color} ${a}%, #0a0a12) 0%, color-mix(in oklab, ${color} ${b}%, #07070d) 45%, #050509 100%)`,
  };
}
