import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePagePermission } from '@/lib/admin/gate';
import { isUuid } from '@/lib/admin/http';
import { getTicket, listStaff } from '@/lib/admin/support';
import { TYPE_LABELS, isHttpUrl, type TicketEventKind } from '@/lib/admin/tickets';
import { TicketCompose } from '@/components/admin/ticket-compose';
import { TicketControls } from '@/components/admin/ticket-controls';

const KIND_LABELS: Record<TicketEventKind, string> = {
  note: 'Internal note',
  reply: 'Emailed reply',
  status: 'Status',
  assignment: 'Assignment',
  delivery_failed: 'Delivery failed',
};

export default async function AdminTicketPage({ params }: { params: { id: string } }) {
  await requirePagePermission('tickets.work');
  if (!isUuid(params.id)) notFound();
  // A failed read throws (500); only a card that does not exist is a 404.
  const [found, staff] = await Promise.all([getTicket(params.id), listStaff()]);
  if (!found) notFound();
  const { ticket, events } = found;
  const authorName = new Map(staff.map((member) => [member.id, member.label]));

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/support" className="text-sm text-white/50 hover:text-white">Support</Link>
        <h1 className="text-xl font-semibold break-words">{ticket.title}</h1>
        <p className="text-sm text-white/50 break-all">
          {TYPE_LABELS[ticket.type]} from{' '}
          {ticket.user_id ? (
            <Link href={`/admin/users/${ticket.user_id}`} className="text-violet-200 hover:underline">{ticket.email}</Link>
          ) : ticket.email}
          {ticket.source_path ? ` on ${ticket.source_path}` : ''}
        </p>
        {/* Only an http(s) link becomes a clickable link; anything else stays out of the page. */}
        {isHttpUrl(ticket.sentry_issue_url) && (
          <a href={ticket.sentry_issue_url} target="_blank" rel="noreferrer noopener" className="text-sm text-violet-200 hover:underline">
            Open in Sentry
          </a>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        <div className="space-y-4 min-w-0">
          <p className="whitespace-pre-wrap break-words rounded-lg border border-white/10 p-4 text-sm">{ticket.description}</p>
          {events.map((event) => (
            <div key={event.id} className="rounded-md bg-white/[0.03] p-3">
              <p className="text-xs text-white/40">{KIND_LABELS[event.kind]} · {authorName.get(event.actor_id) ?? 'Former staff'} · {event.created_at.slice(0, 16).replace('T', ' ')}</p>
              <p className={`mt-1 whitespace-pre-wrap break-words text-sm ${event.kind === 'delivery_failed' ? 'text-rose-300' : ''}`}>{event.body}</p>
            </div>
          ))}
          <TicketCompose ticketId={ticket.id} email={ticket.email} />
        </div>
        <TicketControls ticket={ticket} staff={staff} />
      </div>
    </div>
  );
}
