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
 * Client → server patch shape for PATCH /api/master-plan/tasks/[projectId].
 * TaskProjection field names already match the server patch 1:1 except
 * versionId, which the single-project UI nests under a full `taskMetadata`
 * replacement (see task-detail-panel.tsx's handleVersionChange) — flatten
 * it back out here.
 */
export function toServerTaskPatch(updates: Partial<TaskProjection>): Record<string, unknown> {
  const { taskMetadata, ...rest } = updates;
  const patch: Record<string, unknown> = { ...rest };
  if (taskMetadata && 'versionId' in taskMetadata) {
    patch.versionId = taskMetadata.versionId ?? null;
  }
  return patch;
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
