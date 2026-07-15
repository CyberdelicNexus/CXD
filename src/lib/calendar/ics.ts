/**
 * RFC 5545 (iCalendar) generation for the calendar feed
 * (/api/calendar/feed/[token]). Pure formatting helpers — no I/O — so they
 * can be unit-verified without a Supabase connection.
 */

import type { TaskProjection } from '@/types/plan-types';

export interface CalendarFeedItem {
  task: TaskProjection;
  projectName: string;
}

const CRLF = '\r\n';

/**
 * Escape TEXT-valued property content per RFC 5545 §3.3.11: backslash,
 * comma, semicolon, and newline all need escaping. Backslash MUST be
 * escaped first — otherwise the backslashes inserted by the later
 * replacements would themselves get re-escaped.
 */
export function escapeICSText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Fold a single unfolded content line to RFC 5545 §3.1's 75-octet limit
 * (not 75 characters — multi-byte UTF-8 characters count for their full
 * byte length). Continuation lines start with a single space per the spec's
 * "line folding" rule.
 */
export function foldLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;

  const chunks: string[] = [];
  let offset = 0;
  let limit = 75;
  while (offset < bytes.length) {
    // Don't split a multi-byte UTF-8 sequence across a chunk boundary: back
    // off while the next byte is a continuation byte (10xxxxxx).
    let end = Math.min(offset + limit, bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    chunks.push(bytes.subarray(offset, end).toString('utf8'));
    offset = end;
    limit = 74; // continuation lines start with a leading space, which counts toward the 75-octet cap
  }
  return chunks.join(`${CRLF} `);
}

/** Take the date-only (YYYY-MM-DD) portion of an ISO date/datetime string. */
function dateOnlyParts(isoDate: string): { year: number; month: number; day: number } | null {
  const datePart = isoDate.split('T')[0];
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Format an ISO date/datetime string as an RFC 5545 DATE value (YYYYMMDD). */
export function formatDateValue(isoDate: string): string | null {
  const parts = dateOnlyParts(isoDate);
  if (!parts) return null;
  return `${String(parts.year).padStart(4, '0')}${String(parts.month).padStart(2, '0')}${String(parts.day).padStart(2, '0')}`;
}

/** Format an ISO date/datetime string, shifted forward by `days`, as YYYYMMDD. */
export function formatDateValuePlusDays(isoDate: string, days: number): string | null {
  const parts = dateOnlyParts(isoDate);
  if (!parts) return null;
  // Use UTC noon as the anchor so DST transitions in any local timezone
  // never shift the calendar date under us.
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
  d.setUTCDate(d.getUTCDate() + days);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${String(year).padStart(4, '0')}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
}

/** Format a Date as an RFC 5545 UTC DATE-TIME value (YYYYMMDDTHHMMSSZ). */
export function formatDateTimeUTC(date: Date): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function priorityLabel(priority?: string): string {
  if (!priority) return 'Unspecified';
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function statusLabel(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function buildVEvent(item: CalendarFeedItem, dtstamp: string): string[] | null {
  const { task, projectName } = item;
  if (!task.dueDate) return null; // only tasks with a due date become events

  const dtstartValue = task.startDate ? formatDateValue(task.startDate) : formatDateValue(task.dueDate);
  if (!dtstartValue) return null; // unparseable date — skip rather than emit a malformed VEVENT

  const lines: string[] = [];
  lines.push('BEGIN:VEVENT');
  lines.push(foldLine(`UID:${task.id}@cxd`));
  lines.push(foldLine(`DTSTAMP:${dtstamp}`));
  lines.push(foldLine(`DTSTART;VALUE=DATE:${dtstartValue}`));

  if (task.startDate && task.dueDate) {
    const dtendValue = formatDateValuePlusDays(task.dueDate, 1);
    if (dtendValue) lines.push(foldLine(`DTEND;VALUE=DATE:${dtendValue}`));
  }

  const summary = `[${projectName}] ${task.title}`;
  lines.push(foldLine(`SUMMARY:${escapeICSText(summary)}`));

  const description = `Status: ${statusLabel(task.status)}\nPriority: ${priorityLabel(task.priority)}`;
  lines.push(foldLine(`DESCRIPTION:${escapeICSText(description)}`));

  lines.push('END:VEVENT');
  return lines;
}

/**
 * Build a full RFC 5545 VCALENDAR document (CRLF line endings, folded)
 * from a set of cross-project tasks. Completed tasks and tasks without a
 * due date are skipped — see the route doc comment for why.
 */
export function buildICSCalendar(items: CalendarFeedItem[]): string {
  const dtstamp = formatDateTimeUTC(new Date());

  const lines: string[] = [];
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//CXD Canvas//Calendar Feed//EN');
  lines.push('CALSCALE:GREGORIAN');

  for (const item of items) {
    if (item.task.status === 'completed') continue;
    const veventLines = buildVEvent(item, dtstamp);
    if (veventLines) lines.push(...veventLines);
  }

  lines.push('END:VCALENDAR');
  return lines.join(CRLF) + CRLF;
}
