'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminPost } from '@/lib/admin/client';
import { STATUS_LABELS, TICKET_PRIORITIES, TICKET_STATUSES } from '@/lib/admin/tickets';
import type { StaffMember, Ticket } from '@/lib/admin/support';

const FIELD = 'h-9 w-full rounded-md bg-white/5 border border-white/10 px-2 text-sm text-white';

export function TicketControls({ ticket, staff }: { ticket: Ticket; staff: StaffMember[] }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentry, setSentry] = useState(ticket.sentry_issue_url ?? '');

  // The selects show the saved card (props), so a status change made elsewhere, such
  // as a reply moving the card to Waiting, appears after the refresh, and a failed
  // save leaves them on the saved value.
  useEffect(() => {
    setSentry(ticket.sentry_issue_url ?? '');
  }, [ticket.sentry_issue_url]);

  async function update(patch: Record<string, unknown>) {
    setError('');
    setBusy(true);
    try {
      await adminPost(`/api/admin/support/${ticket.id}`, patch, 'PATCH');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setSentry(ticket.sentry_issue_url ?? '');
    } finally {
      setBusy(false);
    }
  }

  const assigneeKnown = !ticket.assignee_id || staff.some((member) => member.id === ticket.assignee_id);

  return (
    <div className="space-y-3 rounded-lg border border-white/10 p-4">
      <div className="space-y-1">
        <label htmlFor="status" className="text-sm text-white/60">Status</label>
        <select id="status" className={FIELD} value={ticket.status} disabled={busy} onChange={(e) => update({ status: e.target.value })}>
          {TICKET_STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="priority" className="text-sm text-white/60">Priority</label>
        <select id="priority" className={FIELD} value={ticket.priority} disabled={busy} onChange={(e) => update({ priority: e.target.value })}>
          {TICKET_PRIORITIES.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="assignee" className="text-sm text-white/60">Assignee</label>
        <select id="assignee" className={FIELD} value={ticket.assignee_id ?? ''} disabled={busy} onChange={(e) => update({ assigneeId: e.target.value || null })}>
          <option value="">Unassigned</option>
          {!assigneeKnown && ticket.assignee_id && <option value={ticket.assignee_id}>Former staff</option>}
          {staff.map((member) => <option key={member.id} value={member.id}>{member.label}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="sentry" className="text-sm text-white/60">Sentry issue link</label>
        <input
          id="sentry"
          type="url"
          className={FIELD}
          value={sentry}
          disabled={busy}
          onChange={(e) => setSentry(e.target.value)}
          onBlur={() => {
            const value = sentry.trim() || null;
            if (value !== ticket.sentry_issue_url) update({ sentryIssueUrl: value });
          }}
        />
      </div>
      {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
    </div>
  );
}
