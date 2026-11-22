/**
 * Day maths and in-day ordering for the Master Plan → Plan view.
 *
 * A board column is a day a task is *planned for* (taskMetadata.plannedDate),
 * with no clock times. The hour grid shows the same day against the clock,
 * and a task only appears there once it has a scheduledStart. Both read the
 * same fields, so neither view invents a time the other doesn't have.
 *
 * Days are local calendar days as "YYYY-MM-DD" strings — never Date objects
 * across module boundaries, so there is no timezone drift between what a
 * column shows and what gets written.
 */

export type ISODay = string;

export function toISODay(date: Date): ISODay {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Local midnight of an ISO day. */
export function parseISODay(day: ISODay): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(day: ISODay, n: number): ISODay {
  const date = parseISODay(day);
  date.setDate(date.getDate() + n);
  return toISODay(date);
}

/** `count` consecutive days starting at `start`. */
export function daysFrom(start: ISODay, count: number): ISODay[] {
  const out: ISODay[] = [];
  for (let i = 0; i < count; i++) out.push(addDays(start, i));
  return out;
}

/** Monday of the week containing `day`. */
export function startOfWeek(day: ISODay): ISODay {
  const dow = parseISODay(day).getDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

// ── Views ────────────────────────────────────────────────────────────────

export type PlanViewMode = 'board' | 'day' | 'three' | 'week';

export interface PlanViewSpec {
  label: string;
  /** Hour grid (true) or untimed day columns (false). */
  timed: boolean;
}

export const PLAN_VIEW_SPECS: Record<PlanViewMode, PlanViewSpec> = {
  board: { label: 'Board', timed: false },
  day: { label: 'Day', timed: true },
  three: { label: '3 days', timed: true },
  week: { label: 'Week', timed: true },
};

export const BOARD_DAY_COUNT = 7;

/** The days a view shows for a given anchor day. */
export function daysForView(mode: PlanViewMode, anchor: ISODay): ISODay[] {
  switch (mode) {
    case 'day':
      return [anchor];
    case 'three':
      return daysFrom(anchor, 3);
    case 'week':
      return daysFrom(startOfWeek(anchor), 7);
    case 'board':
    default:
      return daysFrom(anchor, BOARD_DAY_COUNT);
  }
}

/** How far ‹ / › move the anchor in each view. */
export function stepForView(mode: PlanViewMode): number {
  if (mode === 'day') return 1;
  if (mode === 'three') return 3;
  return 7;
}

// ── Plan state of a task ─────────────────────────────────────────────────

/** The subset of a task the planner reads. */
export interface PlanTaskLike {
  id: string;
  title: string;
  status: string;
  isArchived?: boolean;
  dueDate?: string;
  estimatedHours?: number;
  plannedDate?: string;
  planOrder?: number;
  scheduledStart?: string;
  durationMinutes?: number;
}

export const isDone = (t: Pick<PlanTaskLike, 'status'>) => t.status === 'completed';

/**
 * Open tasks planned for a day before today. They are shown, never moved
 * automatically — the planner doesn't write anything on load.
 */
export function isCarriedOver(t: PlanTaskLike, today: ISODay): boolean {
  return !!t.plannedDate && t.plannedDate < today && !isDone(t) && !t.isArchived;
}

/** Open, unarchived tasks with no planned day. */
export function isBacklog(t: PlanTaskLike): boolean {
  return !t.plannedDate && !isDone(t) && !t.isArchived;
}

/**
 * Sort within a day column:
 *   1. done tasks sink to the bottom
 *   2. manual planOrder ascending; ordered tasks before unordered ones
 *   3. clock time, then due date, then title
 */
export function compareInDay(a: PlanTaskLike, b: PlanTaskLike): number {
  const doneDiff = Number(isDone(a)) - Number(isDone(b));
  if (doneDiff !== 0) return doneDiff;
  const ao = a.planOrder;
  const bo = b.planOrder;
  if (ao !== undefined && bo !== undefined && ao !== bo) return ao - bo;
  if (ao !== undefined && bo === undefined) return -1;
  if (ao === undefined && bo !== undefined) return 1;
  const as = a.scheduledStart ?? '99:99';
  const bs = b.scheduledStart ?? '99:99';
  if (as !== bs) return as < bs ? -1 : 1;
  const ad = a.dueDate ?? '9999';
  const bd = b.dueDate ?? '9999';
  if (ad !== bd) return ad < bd ? -1 : 1;
  return a.title.localeCompare(b.title);
}

/** Backlog order: soonest due first, undated last, then title. */
export function compareBacklog(a: PlanTaskLike, b: PlanTaskLike): number {
  const ad = a.dueDate ?? '9999';
  const bd = b.dueDate ?? '9999';
  if (ad !== bd) return ad < bd ? -1 : 1;
  return a.title.localeCompare(b.title);
}

export const ORDER_STEP = 1000;

/** A planOrder value strictly between two neighbours (either may be missing). */
export function positionBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return ORDER_STEP;
  if (before === undefined) return (after as number) - ORDER_STEP;
  if (after === undefined) return before + ORDER_STEP;
  return (before + after) / 2;
}

export interface OrderWrite {
  id: string;
  planOrder: number;
}

/**
 * planOrder writes needed to put `movedId` next to `targetId` in a column.
 *
 * `column` is the column as currently shown (sorted, may or may not already
 * contain the moved task — it doesn't when the task comes from another day
 * or the backlog). `targetId === null` appends to the end.
 *
 * If every task in the resulting column already has a planOrder, only the
 * moved task is written (a midpoint between its new neighbours). Otherwise
 * the whole column is seeded from what's on screen at multiples of 1000, so
 * the order the user sees is the order that gets saved.
 *
 * Returns [] when the task lands where it already was.
 */
export function reorderWrites(
  column: Pick<PlanTaskLike, 'id' | 'planOrder'>[],
  movedId: string,
  targetId: string | null,
  below: boolean
): OrderWrite[] {
  const from = column.findIndex((t) => t.id === movedId);
  const moved = from >= 0 ? column[from] : { id: movedId, planOrder: undefined };
  const rest = column.filter((t) => t.id !== movedId);

  let insertAt = rest.length;
  if (targetId !== null && targetId !== movedId) {
    const ti = rest.findIndex((t) => t.id === targetId);
    if (ti >= 0) insertAt = ti + (below ? 1 : 0);
  } else if (targetId === movedId && from >= 0) {
    return [];
  }

  const next = [...rest.slice(0, insertAt), moved, ...rest.slice(insertAt)];
  if (from >= 0 && next.every((t, i) => t.id === column[i].id)) return [];

  const othersOrdered = rest.every((t) => t.planOrder !== undefined);
  if (!othersOrdered) {
    return next
      .map((t, i) => ({ id: t.id, planOrder: (i + 1) * ORDER_STEP }))
      .filter((w) => {
        const orig = column.find((t) => t.id === w.id);
        return !orig || orig.planOrder !== w.planOrder;
      });
  }
  const before = next[insertAt - 1]?.planOrder;
  const after = next[insertAt + 1]?.planOrder;
  return [{ id: movedId, planOrder: positionBetween(before, after) }];
}

/** Minutes a task takes up in a day: its block, else its estimate, else 0. */
export function taskMinutes(t: Pick<PlanTaskLike, 'durationMinutes' | 'estimatedHours'>): number {
  if (t.durationMinutes) return t.durationMinutes;
  if (t.estimatedHours) return Math.round(t.estimatedHours * 60);
  return 0;
}

/** "1h 30m", "45m", "2h". Empty string for 0. */
export function formatMinutes(min: number): string {
  if (min <= 0) return '';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
