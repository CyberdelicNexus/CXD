'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminPost } from '@/lib/admin/client';
import { STATUS_LABELS, TICKET_PRIORITIES, TICKET_STATUSES } from '@/lib/admin/tickets';
import type { StaffMember, Ticket } from '@/lib/admin/support';

const FIELD = 'h-9 w-full rounded-md bg-white/5 border border-white/10 px-2 text-sm text-white';

export function TicketControls({ ticket, staff }: { ticket: Ticket; staff: StaffMember[] }) {
  const router = useRouter();
  const [error, setError] = useState('');

  async function update(patch: Record<string, unknown>) {
    setError('');
    try {
      await adminPost(`/api/admin/support/${ticket.id}`, patch, 'PATCH');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-white/10 p-4">
      <div className="space-y-1">
        <label htmlFor="status" className="text-sm text-white/60">Status</label>
        <select id="status" className={FIELD} defaultValue={ticket.status} onChange={(e) => update({ status: e.target.value })}>
          {TICKET_STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="priority" className="text-sm text-white/60">Priority</label>
        <select id="priority" className={FIELD} defaultValue={ticket.priority} onChange={(e) => update({ priority: e.target.value })}>
          {TICKET_PRIORITIES.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="assignee" className="text-sm text-white/60">Assignee</label>
        <select id="assignee" className={FIELD} defaultValue={ticket.assignee_id ?? ''} onChange={(e) => update({ assigneeId: e.target.value || null })}>
          <option value="">Unassigned</option>
          {staff.map((member) => <option key={member.id} value={member.id}>{member.label}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="sentry" className="text-sm text-white/60">Sentry issue link</label>
        <input
          id="sentry"
          type="url"
          className={FIELD}
          defaultValue={ticket.sentry_issue_url ?? ''}
          onBlur={(e) => {
            const value = e.target.value.trim() || null;
            if (value !== ticket.sentry_issue_url) update({ sentryIssueUrl: value });
          }}
        />
      </div>
      {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
    </div>
  );
}
