import type { TaskProjection } from "@/types/plan-types";

export interface MasterPlanTaskItem {
  task: TaskProjection;
  projectId: string;
  projectName: string;
}

export interface MasterPlanProject {
  id: string;
  name: string;
}

/**
 * A task edit from any Master Plan view. `null` (or an explicit `undefined`)
 * on a clearable field means "clear it".
 */
export type TaskUpdate = { [K in keyof TaskProjection]?: TaskProjection[K] | null };

/** Fields the server accepts `null` for, meaning "delete this field". */
const CLEARABLE_FIELDS = new Set<string>([
  "priority",
  "taskType",
  "dueDate",
  "startDate",
  "assignee",
  "estimatedHours",
  "description",
  "plannedDate",
  "planOrder",
  "scheduledStart",
  "durationMinutes",
]);

/**
 * Client → server patch shape for PATCH /api/master-plan/tasks/[projectId].
 * TaskProjection field names already match the server patch 1:1 except
 * versionId, which the single-project UI nests under a full `taskMetadata`
 * replacement (see task-detail-panel.tsx's handleVersionChange) — flatten
 * it back out here.
 *
 * A clearable field set to `undefined` is sent as `null`: JSON.stringify
 * drops undefined keys, so without this a "clear the due date" edit would
 * never reach the server.
 */
export function toServerTaskPatch(updates: TaskUpdate): Record<string, unknown> {
  const { taskMetadata, ...rest } = updates;
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined || value === null) {
      if (CLEARABLE_FIELDS.has(key)) patch[key] = null;
      continue;
    }
    patch[key] = value;
  }
  if (taskMetadata && 'versionId' in taskMetadata) {
    patch.versionId = taskMetadata.versionId ?? null;
  }
  return patch;
}

/** Apply an update to a task locally: `null`/`undefined` removes the field. */
export function applyTaskUpdate(task: TaskProjection, updates: TaskUpdate): TaskProjection {
  const next: Record<string, unknown> = { ...task };
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null) delete next[key];
    else next[key] = value;
  }
  return next as unknown as TaskProjection;
}

const PROJECT_COLORS = [
  "#8B5CF6", "#22D3EE", "#F472B6", "#34D399", "#F97316",
  "#60A5FA", "#FBBF24", "#A78BFA", "#4ADE80", "#F87171",
  "#38BDF8", "#E879F9",
];

/**
 * Stable, deterministic color per project — hashed from the project id, not
 * derived from list order/index, so a project keeps the same color across
 * reloads, re-sorts, and re-fetches. Shared by every Master Plan view so a
 * project reads as the same color everywhere (filter pills, table rows,
 * Kanban cards, calendar dots).
 */
export function projectColor(projectId: string): string {
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = (hash * 31 + projectId.charCodeAt(i)) | 0;
  }
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}
