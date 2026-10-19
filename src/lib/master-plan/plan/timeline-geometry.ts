/**
 * Hour-grid geometry for the Master Plan → Plan view. Pure functions only:
 * the grid component converts pointer positions with these and never does
 * its own maths.
 *
 * Units: "minutes" are minutes since local midnight; "px" are measured from
 * the top of the grid. A time block never crosses midnight.
 */

export interface GridGeometry {
  startHour: number; // first hour line (inclusive)
  endHour: number; // last hour line (exclusive end of the day window)
  pxPerHour: number;
  snapMin: number;
}

export const DEFAULT_GRID: GridGeometry = {
  startHour: 6,
  endHour: 24,
  pxPerHour: 64,
  snapMin: 15,
};

export const MIN_BLOCK_MIN = 15;
/** Block length when a task with no estimate is dropped onto the grid. */
export const DEFAULT_BLOCK_MIN = 60;

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "14:30" → 870. Null when the string isn't a valid HH:mm. */
export function clockToMinutes(clock: string | undefined | null): number | null {
  if (!clock) return null;
  const m = CLOCK.exec(clock);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** 870 → "14:30". Clamped to the day, so it never rolls past 23:59. */
export function minutesToClock(min: number): string {
  const v = Math.max(0, Math.min(1439, Math.round(min)));
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}

/** Label for an hour line; the final line of the day reads "00:00". */
export function hourLabel(hour: number): string {
  return `${String(hour % 24).padStart(2, '0')}:00`;
}

export function rangeLabel(startMin: number, durationMin: number): string {
  return `${minutesToClock(startMin)} – ${(startMin + durationMin) % 1440 === 0 ? '24:00' : minutesToClock(startMin + durationMin)}`;
}

export function snap(min: number, step: number = DEFAULT_GRID.snapMin): number {
  return Math.round(min / step) * step;
}

export function minutesToPx(min: number, g: GridGeometry = DEFAULT_GRID): number {
  return ((min - g.startHour * 60) / 60) * g.pxPerHour;
}

export function pxToMinutes(px: number, g: GridGeometry = DEFAULT_GRID): number {
  return g.startHour * 60 + (px / g.pxPerHour) * 60;
}

export function gridHeight(g: GridGeometry = DEFAULT_GRID): number {
  return (g.endHour - g.startHour) * g.pxPerHour;
}

export interface TimeWindow {
  startMin: number;
  durationMin: number;
}

/**
 * Keep a window inside the grid's day: duration is held to
 * [MIN_BLOCK_MIN, day length], then the start slides so the whole window fits.
 */
export function clampWindow(startMin: number, durationMin: number, g: GridGeometry = DEFAULT_GRID): TimeWindow {
  const dayStart = g.startHour * 60;
  const dayEnd = g.endHour * 60;
  const dur = Math.max(MIN_BLOCK_MIN, Math.min(durationMin, dayEnd - dayStart));
  const start = Math.max(dayStart, Math.min(startMin, dayEnd - dur));
  return { startMin: start, durationMin: dur };
}

/** Move a block by a pixel delta: snapped, duration kept, kept inside the day. */
export function moveBy(w: TimeWindow, deltaPx: number, g: GridGeometry = DEFAULT_GRID): TimeWindow {
  const moved = w.startMin + (deltaPx / g.pxPerHour) * 60;
  return clampWindow(snap(moved, g.snapMin), w.durationMin, g);
}

/**
 * Resize from one edge by a pixel delta. The opposite edge stays put, the
 * moving edge snaps, and the block never gets shorter than MIN_BLOCK_MIN or
 * leaves the day.
 */
export function resizeBy(
  w: TimeWindow,
  edge: 'start' | 'end',
  deltaPx: number,
  g: GridGeometry = DEFAULT_GRID
): TimeWindow {
  const deltaMin = (deltaPx / g.pxPerHour) * 60;
  const dayStart = g.startHour * 60;
  const dayEnd = g.endHour * 60;
  const end = w.startMin + w.durationMin;
  if (edge === 'end') {
    const newEnd = Math.min(dayEnd, Math.max(w.startMin + MIN_BLOCK_MIN, snap(end + deltaMin, g.snapMin)));
    return { startMin: w.startMin, durationMin: newEnd - w.startMin };
  }
  const newStart = Math.max(dayStart, Math.min(end - MIN_BLOCK_MIN, snap(w.startMin + deltaMin, g.snapMin)));
  return { startMin: newStart, durationMin: end - newStart };
}

/**
 * Start time for a task dropped at `localY` px. Rounds to the nearest snap
 * and keeps a block of `durationMin` inside the day.
 */
export function dropStart(localY: number, durationMin: number, g: GridGeometry = DEFAULT_GRID): number {
  return clampWindow(snap(pxToMinutes(localY, g), g.snapMin), durationMin, g).startMin;
}

/** Block length for a task given time on the grid: its estimate, else 60 min. */
export function defaultDuration(estimatedHours: number | undefined): number {
  if (!estimatedHours || estimatedHours <= 0) return DEFAULT_BLOCK_MIN;
  return Math.max(MIN_BLOCK_MIN, Math.min(1440, snap(estimatedHours * 60, 5)));
}

// ── Overlap lanes ────────────────────────────────────────────────────────

export interface LaneInput {
  id: string;
  startMin: number;
  durationMin: number;
}

export interface LanePlacement {
  lane: number;
  lanes: number;
}

/**
 * Side-by-side placement for overlapping blocks.
 *
 * Blocks are sorted by start (shorter first on ties) and walked once. A
 * cluster is a run of blocks that overlap transitively; every block in a
 * cluster shares the cluster's lane count so they line up in equal-width
 * columns. Inside a cluster each block takes the lowest lane whose previous
 * occupant has already ended.
 */
export function layoutLanes(items: LaneInput[]): Map<string, LanePlacement> {
  const out = new Map<string, LanePlacement>();
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.durationMin - b.durationMin);

  let cluster: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const lanes = laneEnds.length;
    for (const c of cluster) out.set(c.id, { lane: c.lane, lanes });
    cluster = [];
    laneEnds = [];
    clusterEnd = -Infinity;
  };

  for (const item of sorted) {
    const end = item.startMin + item.durationMin;
    if (cluster.length > 0 && item.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= item.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    cluster.push({ id: item.id, lane });
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (cluster.length > 0) flush();
  return out;
}

/** CSS left/width for a block in `lane` of `lanes`, inside the given insets. */
export function laneStyle(
  p: LanePlacement,
  insets: { leftPx: number; rightPx: number; gapPx: number }
): { left: string; width: string } {
  const n = Math.max(1, p.lanes);
  const reserved = insets.leftPx + insets.rightPx + insets.gapPx * (n - 1);
  const width = `calc((100% - ${reserved}px) / ${n})`;
  const left =
    p.lane === 0 ? `${insets.leftPx}px` : `calc(${insets.leftPx}px + ${p.lane} * ((100% - ${reserved}px) / ${n} + ${insets.gapPx}px))`;
  return { left, width };
}

/** Minutes since midnight for the now-line, or null when `day` isn't today. */
export function nowMinutes(day: string, now: Date): number | null {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  if (`${y}-${m}-${d}` !== day) return null;
  return now.getHours() * 60 + now.getMinutes();
}

/** Where to scroll a day grid when it opens: an hour before now, else 08:00. */
export function initialScrollPx(now: number | null, g: GridGeometry = DEFAULT_GRID): number {
  return Math.max(0, minutesToPx((now ?? 9 * 60) - 60, g));
}
