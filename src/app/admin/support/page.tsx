import Link from 'next/link';
import { requirePagePermission } from '@/lib/admin/gate';
import { listStaff, listTickets } from '@/lib/admin/support';
import { singleParam } from '@/lib/admin/users-query';
import {
  STATUS_LABELS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
  TYPE_LABELS,
  parseTicketFilters,
} from '@/lib/admin/tickets';

const FIELD = 'h-9 rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white';

type Param = string | string[] | undefined;

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: { type?: Param; assignee?: Param; priority?: Param };
}) {
  await requirePagePermission('tickets.work');
  // Invalid filter values are dropped here, so only known types, priorities and UUIDs reach the query.
  const filters = parseTicketFilters({
    type: singleParam(searchParams.type),
    assignee: singleParam(searchParams.assignee),
    priority: singleParam(searchParams.priority),
  });
  const [tickets, staff] = await Promise.all([listTickets(filters), listStaff()]);
  const staffName = new Map(staff.map((member) => [member.id, member.label]));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Support</h1>
      <form className="flex flex-wrap gap-2">
        <select name="type" defaultValue={filters.type ?? ''} aria-label="Type" className={FIELD}>
          <option value="">All types</option>
          {TICKET_TYPES.map((value) => <option key={value} value={value}>{TYPE_LABELS[value]}</option>)}
        </select>
        <select name="assignee" defaultValue={filters.assignee ?? ''} aria-label="Assignee" className={FIELD}>
          <option value="">Anyone</option>
          {staff.map((member) => <option key={member.id} value={member.id}>{member.label}</option>)}
        </select>
        <select name="priority" defaultValue={filters.priority ?? ''} aria-label="Priority" className={FIELD}>
          <option value="">Any priority</option>
          {TICKET_PRIORITIES.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <button type="submit" className={`${FIELD} hover:bg-white/10`}>Filter</button>
      </form>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {TICKET_STATUSES.map((status) => {
          const column = tickets.filter((ticket) => ticket.status === status);
          return (
            <section key={status} aria-label={STATUS_LABELS[status]} className="space-y-2">
              <h2 className="text-sm font-medium text-white/60">{STATUS_LABELS[status]} ({column.length})</h2>
              {column.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/admin/support/${ticket.id}`}
                  className="block rounded-md border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.06]"
                >
                  <p className="text-sm break-words">{ticket.title}</p>
                  <p className="mt-1 text-xs text-white/40 break-all">
                    {TYPE_LABELS[ticket.type]}{ticket.priority === 'high' ? ' · High' : ''} · {ticket.email}
                    {ticket.assignee_id ? ` · ${staffName.get(ticket.assignee_id) ?? 'Former staff'}` : ''}
                  </p>
                </Link>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
