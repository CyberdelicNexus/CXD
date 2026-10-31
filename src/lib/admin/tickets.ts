export const TICKET_TYPES = ['bug', 'feature', 'support'] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const TICKET_STATUSES = ['new', 'in_progress', 'waiting', 'done'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['low', 'normal', 'high'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  new: 'New',
  in_progress: 'In progress',
  waiting: 'Waiting on user',
  done: 'Done',
};

export const TYPE_LABELS: Record<TicketType, string> = {
  bug: 'Bug',
  feature: 'Feature request',
  support: 'Support',
};

const GENERIC_TITLES = ['Bug Report', 'Support Request', 'Feature Request'];
const TITLE_LENGTH = 80;

export function resolveTicketType(type: unknown, title: string): TicketType {
  if ((TICKET_TYPES as readonly unknown[]).includes(type)) return type as TicketType;
  return title === 'Bug Report' ? 'bug' : 'support';
}

/** The dialogs send a fixed label as the title, which would make every card look alike. */
export function ticketTitle(title: string, description: string): string {
  const source = GENERIC_TITLES.includes(title) ? description.trim().split('\n')[0] : title;
  return oneLine(source).slice(0, TITLE_LENGTH).trim() || 'Untitled';
}

/** Collapses every run of whitespace (including line breaks) to one space. */
export function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** The subject of a reply email: single line, so a title with line breaks cannot split the header. */
export function replySubject(title: string): string {
  return `Re: ${oneLine(title) || 'Untitled'}`;
}

export type TicketEventKind = 'note' | 'reply' | 'status' | 'assignment' | 'delivery_failed';

export function composeTicketBody(description: string, stepsToReproduce: string | undefined): string {
  if (!stepsToReproduce) return description;
  return `${description}\n\nSteps to reproduce:\n${stepsToReproduce}`;
}

export interface TicketFilters {
  type?: TicketType;
  priority?: TicketPriority;
  assignee?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Keeps only filter values that are valid; anything else is dropped rather than queried. */
export function parseTicketFilters(raw: { type?: string; priority?: string; assignee?: string }): TicketFilters {
  const filters: TicketFilters = {};
  if ((TICKET_TYPES as readonly unknown[]).includes(raw.type)) filters.type = raw.type as TicketType;
  if ((TICKET_PRIORITIES as readonly unknown[]).includes(raw.priority)) filters.priority = raw.priority as TicketPriority;
  if (raw.assignee && UUID.test(raw.assignee)) filters.assignee = raw.assignee;
  return filters;
}

/** True only for an http or https URL, so a stored link can never render as javascript: or data:. */
export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}
