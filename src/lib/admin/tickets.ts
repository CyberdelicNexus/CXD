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
  if (!GENERIC_TITLES.includes(title)) return title.slice(0, TITLE_LENGTH);
  return description.trim().split('\n')[0].slice(0, TITLE_LENGTH);
}

export function composeTicketBody(description: string, stepsToReproduce: string | undefined): string {
  if (!stepsToReproduce) return description;
  return `${description}\n\nSteps to reproduce:\n${stepsToReproduce}`;
}
