/**
 * Quick-add parsing for the Plan view. One line becomes a task title plus
 * optional timing, written inline:
 *
 *   "Draft brief 45m"          → duration 45 min
 *   "Call studio @14:30"       → starts 14:30
 *   "Review @2pm 1h30"         → starts 14:00, 90 min
 *   "Sync @9-10:30"            → starts 09:00, 90 min (range)
 *
 * A token is only read at the start of the text or after a space, so
 * "C@t" or an email address stays in the title. Unparseable tokens are left
 * in the title untouched — nothing typed is ever silently dropped.
 */

export interface QuickAddResult {
  title: string;
  scheduledStart?: string; // HH:mm
  durationMinutes?: number;
}

const DURATION = /^(?:(\d{1,2})h(?:(\d{1,2})m?)?|(\d{1,3})m(?:in)?)$/i;
const TIME = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?$/i;

function parseDuration(token: string): number | null {
  const m = DURATION.exec(token);
  if (!m) return null;
  const min = m[3] !== undefined ? Number(m[3]) : Number(m[1]) * 60 + Number(m[2] ?? 0);
  return min >= 5 && min <= 720 ? min : null;
}

function parseTime(token: string, inheritMeridiem?: string): { min: number; meridiem?: string } | null {
  const m = TIME.exec(token);
  if (!m) return null;
  let h = Number(m[1]);
  const mins = Number(m[2] ?? 0);
  if (mins > 59) return null;
  const mer = (m[3] ?? inheritMeridiem)?.toLowerCase();
  if (mer) {
    if (h < 1 || h > 12) return null;
    if (mer.startsWith('p') && h !== 12) h += 12;
    if (mer.startsWith('a') && h === 12) h = 0;
  } else if (h > 23) {
    return null;
  }
  return { min: h * 60 + mins, meridiem: m[3]?.toLowerCase() };
}

function clock(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

function parseAt(token: string): { start: number; duration?: number } | null {
  const body = token.slice(1);
  const parts = body.split(/[-–]/);
  if (parts.length === 1) {
    const t = parseTime(parts[0]);
    return t ? { start: t.min } : null;
  }
  if (parts.length !== 2) return null;
  const endRaw = parseTime(parts[1]);
  if (!endRaw) return null;
  // "10-11pm": the start borrows the end's am/pm when it has none.
  const start = parseTime(parts[0], /[ap]m?$/i.test(parts[0]) ? undefined : endRaw.meridiem);
  if (!start) return null;
  let end = endRaw.min;
  if (end <= start.min) end += 12 * 60;
  if (end > 24 * 60) return null;
  const duration = end - start.min;
  return duration >= 5 && duration <= 720 ? { start: start.min, duration } : null;
}

export function parseQuickAdd(text: string): QuickAddResult {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  let scheduledStart: string | undefined;
  let durationMinutes: number | undefined;

  for (const token of tokens) {
    if (token.startsWith('@') && scheduledStart === undefined) {
      const at = parseAt(token);
      if (at) {
        scheduledStart = clock(at.start);
        if (at.duration !== undefined) durationMinutes = at.duration;
        continue;
      }
    }
    if (durationMinutes === undefined && kept.length > 0) {
      const d = parseDuration(token);
      if (d !== null) {
        durationMinutes = d;
        continue;
      }
    }
    kept.push(token);
  }

  const result: QuickAddResult = { title: kept.join(' ') };
  if (scheduledStart !== undefined) result.scheduledStart = scheduledStart;
  if (durationMinutes !== undefined) result.durationMinutes = durationMinutes;
  return result;
}
