/**
 * Pure mapping from a Master Plan task patch to the canvas element's
 * `taskMetadata` — which keys to set, and which to delete.
 *
 * `null` in a patch means "clear this field". The Yjs element serializer
 * skips `undefined` when it merges into the nested taskMetadata Y.Map, so a
 * clear can't be expressed as `{ dueDate: undefined }` — it has to be an
 * explicit delete of the key. Splitting the patch into `set` and `clear`
 * here keeps that rule in one tested place.
 */

import type { TaskMetadata } from '../../types/canvas-elements';

export type MasterPlanTaskPatch = {
  title?: string;
  description?: string | null;
  status?: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  priority?: 'low' | 'medium' | 'high' | 'urgent' | null;
  taskType?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  assignee?: string | null;
  estimatedHours?: number | null;
  tags?: string[];
  hypercubeTags?: string[];
  subtasks?: unknown[];
  customProperties?: Record<string, string | number | boolean>;
  versionId?: string | null;
  isArchived?: boolean;
  // Day planning (Master Plan → Plan view)
  plannedDate?: string | null;
  planOrder?: number | null;
  scheduledStart?: string | null;
  durationMinutes?: number | null;
};

/** Patch keys whose metadata key differs from the patch key. */
const RENAMED: Partial<Record<keyof MasterPlanTaskPatch, keyof TaskMetadata>> = {
  tags: 'customTags',
};

/** Patch keys that live on taskMetadata (title/hypercubeTags live on the element). */
const METADATA_KEYS: (keyof MasterPlanTaskPatch)[] = [
  'status',
  'priority',
  'taskType',
  'dueDate',
  'startDate',
  'assignee',
  'estimatedHours',
  'tags',
  'subtasks',
  'customProperties',
  'versionId',
  'isArchived',
  'description',
  'plannedDate',
  'planOrder',
  'scheduledStart',
  'durationMinutes',
];

export function buildTaskMetadataPatch(patch: MasterPlanTaskPatch): {
  set: Partial<TaskMetadata>;
  clear: (keyof TaskMetadata)[];
} {
  const set: Record<string, unknown> = {};
  const clear: (keyof TaskMetadata)[] = [];
  for (const key of METADATA_KEYS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (value === undefined) continue;
    const target = (RENAMED[key] ?? key) as keyof TaskMetadata;
    // An empty description is a clear too — the detail panel sends '' when
    // the field is emptied.
    if (value === null || (key === 'description' && value === '')) {
      clear.push(target);
    } else {
      set[target] = value;
    }
  }
  return { set: set as Partial<TaskMetadata>, clear };
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Validates the day-planning fields. Returns an error message, or null when valid. */
export function validatePlanFields(patch: Record<string, unknown>): string | null {
  if (patch.plannedDate !== undefined && patch.plannedDate !== null) {
    const m = typeof patch.plannedDate === 'string' ? ISO_DAY.exec(patch.plannedDate) : null;
    const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
    if (!m || !d || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) {
      return 'plannedDate must be a YYYY-MM-DD date';
    }
  }
  if (patch.scheduledStart !== undefined && patch.scheduledStart !== null) {
    if (typeof patch.scheduledStart !== 'string' || !CLOCK.test(patch.scheduledStart)) {
      return 'scheduledStart must be an HH:mm time';
    }
  }
  if (patch.durationMinutes !== undefined && patch.durationMinutes !== null) {
    const v = patch.durationMinutes;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 5 || v > 1440) {
      return 'durationMinutes must be a whole number between 5 and 1440';
    }
  }
  if (patch.planOrder !== undefined && patch.planOrder !== null) {
    if (typeof patch.planOrder !== 'number' || !Number.isFinite(patch.planOrder)) {
      return 'planOrder must be a finite number';
    }
  }
  return null;
}
