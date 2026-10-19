/**
 * What each Plan-view gesture writes. Every function returns the per-task
 * field updates to send through the Master Plan's single optimistic update
 * path; `null` clears a field.
 *
 * One time slot per task: moving a task to another day carries its clock
 * time with it, sending it back to the backlog drops both day and time.
 */

import { addDays, reorderWrites, type ISODay, type PlanTaskLike } from './plan-days';
import { minutesToClock } from './timeline-geometry';

export interface PlanFieldUpdates {
  plannedDate?: string | null;
  planOrder?: number | null;
  scheduledStart?: string | null;
  durationMinutes?: number | null;
  status?: 'not_started' | 'completed';
  isArchived?: boolean;
}

export interface PlanUpdate {
  id: string;
  updates: PlanFieldUpdates;
}

/**
 * Checklist rows inside a card (ids like `${cardId}-task-2`) are projected
 * as tasks, but only their done state can be written — everything else
 * belongs to the parent card.
 */
export function canPlan(task: { id: string; sourceElementId?: string }): boolean {
  return task.sourceElementId === undefined || task.id === task.sourceElementId;
}

/**
 * Drop `task` into `day`'s column next to `targetId` (null = end).
 * `column` is that day's column as shown, sorted.
 */
export function moveToDay(
  task: PlanTaskLike,
  day: ISODay,
  column: PlanTaskLike[],
  targetId: string | null,
  below: boolean
): PlanUpdate[] {
  const sameDay = task.plannedDate === day;
  const columnWithMoved = sameDay ? column : column.filter((t) => t.id !== task.id);
  const writes = reorderWrites(columnWithMoved, task.id, targetId, below);
  const out: PlanUpdate[] = writes.map((w) => ({ id: w.id, updates: { planOrder: w.planOrder } }));
  if (!sameDay) {
    const own = out.find((u) => u.id === task.id);
    if (own) own.updates.plannedDate = day;
    else out.push({ id: task.id, updates: { plannedDate: day } });
  }
  return out;
}

export function moveToBacklog(task: PlanTaskLike): PlanUpdate {
  return { id: task.id, updates: { plannedDate: null, planOrder: null, scheduledStart: null } };
}

/** Give a task a time on `day` (and plan it for that day if it wasn't). */
export function scheduleAt(task: PlanTaskLike, day: ISODay, startMin: number, durationMin: number): PlanUpdate {
  const updates: PlanFieldUpdates = {
    scheduledStart: minutesToClock(startMin),
    durationMinutes: Math.round(durationMin),
  };
  if (task.plannedDate !== day) {
    updates.plannedDate = day;
    updates.planOrder = null;
  }
  return { id: task.id, updates };
}

/** Take a task off the clock but keep it planned for its day. */
export function clearTime(task: PlanTaskLike): PlanUpdate {
  return { id: task.id, updates: { scheduledStart: null } };
}

export function planForDay(task: PlanTaskLike, day: ISODay): PlanUpdate {
  if (task.plannedDate === day) return { id: task.id, updates: {} };
  return { id: task.id, updates: { plannedDate: day, planOrder: null } };
}

/** Push to the day after the task's planned day (or after today when unplanned or overdue). */
export function pushToNextDay(task: PlanTaskLike, today: ISODay): PlanUpdate {
  const base = task.plannedDate && task.plannedDate >= today ? task.plannedDate : today;
  return { id: task.id, updates: { plannedDate: addDays(base, 1), planOrder: null } };
}

export function toggleDone(task: PlanTaskLike): PlanUpdate {
  return { id: task.id, updates: { status: task.status === 'completed' ? 'not_started' : 'completed' } };
}

export function archive(task: PlanTaskLike): PlanUpdate {
  return { id: task.id, updates: { isArchived: true } };
}
