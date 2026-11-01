import { getSupabaseAdmin } from '@/supabase/admin';
import type { TicketEventKind, TicketFilters, TicketPriority, TicketStatus, TicketType } from './tickets';

export interface Ticket {
  id: string;
  user_id: string | null;
  email: string;
  type: TicketType;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee_id: string | null;
  source_path: string | null;
  sentry_issue_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketEvent {
  id: string;
  actor_id: string;
  kind: TicketEventKind;
  body: string;
  created_at: string;
}

export interface StaffMember {
  id: string;
  label: string;
}

export const DONE_LIMIT = 100;

/**
 * Filters must already be validated (see parseTicketFilters). Open cards are
 * never capped, so a busy day cannot hide work; done cards show the newest
 * DONE_LIMIT. A failed read throws.
 */
export async function listTickets(filters: TicketFilters): Promise<Ticket[]> {
  const base = () => {
    let query = getSupabaseAdmin().from('support_tickets').select('*').order('created_at', { ascending: false });
    if (filters.type) query = query.eq('type', filters.type);
    if (filters.assignee) query = query.eq('assignee_id', filters.assignee);
    if (filters.priority) query = query.eq('priority', filters.priority);
    return query;
  };
  const [open, done] = await Promise.all([base().neq('status', 'done'), base().eq('status', 'done').limit(DONE_LIMIT)]);
  if (open.error) throw open.error;
  if (done.error) throw done.error;
  return [...(open.data ?? []), ...(done.data ?? [])] as Ticket[];
}

/** True when the user currently holds a staff role. A failed read throws. */
export async function isStaffMember(userId: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin().from('staff_roles').select('user_id').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return !!data;
}

/** Returns null only when the card does not exist; a failed read throws. */
export async function getTicket(id: string): Promise<{ ticket: Ticket; events: TicketEvent[] } | null> {
  const admin = getSupabaseAdmin();
  const { data: ticket, error } = await admin.from('support_tickets').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!ticket) return null;
  const { data: events, error: eventsError } = await admin
    .from('support_ticket_events')
    .select('id, actor_id, kind, body, created_at')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true });
  if (eventsError) throw eventsError;
  return { ticket: ticket as Ticket, events: (events ?? []) as TicketEvent[] };
}

export async function listTicketsForUser(userId: string): Promise<Pick<Ticket, 'id' | 'title' | 'status'>[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('support_tickets')
    .select('id, title, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as Pick<Ticket, 'id' | 'title' | 'status'>[];
}

export async function listStaff(): Promise<StaffMember[]> {
  const admin = getSupabaseAdmin();
  const { data: roles, error: rolesError } = await admin.from('staff_roles').select('user_id');
  if (rolesError) throw rolesError;
  const ids = (roles ?? []).map((row) => row.user_id as string);
  if (ids.length === 0) return [];
  const { data: people, error: peopleError } = await admin.from('users').select('id, full_name, email').in('id', ids);
  if (peopleError) throw peopleError;
  return (people ?? []).map((person) => ({
    id: person.id as string,
    label: (person.full_name as string | null) || (person.email as string) || 'Staff',
  }));
}
