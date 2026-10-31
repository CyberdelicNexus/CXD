import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePermission } from '@/lib/admin/gate';
import { isUuid, notFoundResponse, parseBody } from '@/lib/admin/http';
import { recordAudit } from '@/lib/admin/audit';
import { STATUS_LABELS, TICKET_PRIORITIES, TICKET_STATUSES, isHttpUrl } from '@/lib/admin/tickets';

type Ctx = { params: { id: string } };

const schema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  // z.string().url() also accepts javascript: and data: URLs, so require http or https.
  sentryIssueUrl: z.string().max(500).refine(isHttpUrl, 'Must be an http or https link').nullable().optional(),
});

function reportDbError(error: { code?: string; message: string }, step: string) {
  // Code and message only: details can echo the row.
  Sentry.captureException(new Error(`admin support ${step} failed: ${error.code ?? 'error'}: ${error.message}`), {
    tags: { route: 'admin-support', step },
  });
}

export async function PATCH(request: Request, context: Ctx) {
  const gate = await requirePermission('tickets.work');
  if (!gate.ok) return gate.response;
  if (!isUuid(context.params.id)) return notFoundResponse();
  const body = await parseBody(request, schema);
  if (!body.ok) return body.response;
  const { status, priority, assigneeId, sentryIssueUrl } = body.data;
  const ticketId = context.params.id;
  const admin = getSupabaseAdmin();

  const { data: before, error: readError } = await admin
    .from('support_tickets')
    .select('status, assignee_id, priority')
    .eq('id', ticketId)
    .maybeSingle();
  if (readError) {
    reportDbError(readError, 'read');
    return NextResponse.json({ error: 'The card could not be loaded.' }, { status: 500 });
  }
  if (!before) return NextResponse.json({ error: 'Card not found.' }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) patch.status = status;
  if (priority) patch.priority = priority;
  if (assigneeId !== undefined) patch.assignee_id = assigneeId;
  if (sentryIssueUrl !== undefined) patch.sentry_issue_url = sentryIssueUrl;

  const { error } = await admin.from('support_tickets').update(patch).eq('id', ticketId);
  if (error) {
    if (error.code === '23503') {
      return NextResponse.json({ error: 'That assignee does not exist.' }, { status: 409 });
    }
    reportDbError(error, 'update');
    return NextResponse.json({ error: 'The card was not changed.' }, { status: 500 });
  }

  const events: { ticket_id: string; actor_id: string; kind: string; body: string }[] = [];
  if (status && status !== before.status) {
    events.push({ ticket_id: ticketId, actor_id: gate.staff.userId, kind: 'status', body: `Moved to ${STATUS_LABELS[status]}` });
  }
  if (assigneeId !== undefined && assigneeId !== before.assignee_id) {
    events.push({ ticket_id: ticketId, actor_id: gate.staff.userId, kind: 'assignment', body: assigneeId ? 'Assigned' : 'Unassigned' });
  }
  if (events.length) {
    // The change is already saved; a missing history line is reported but does not fail the request.
    const { error: eventError } = await admin.from('support_ticket_events').insert(events);
    if (eventError) reportDbError(eventError, 'event-insert');
  }

  // The change is already committed, so a failed audit write is reported but does not fail the request.
  try {
    await recordAudit({
      actorId: gate.staff.userId,
      action: 'ticket.update',
      targetType: 'ticket',
      targetId: ticketId,
      before,
      after: patch,
    });
  } catch (e) {
    Sentry.captureException(e, {
      tags: { route: 'admin-audit', action: 'ticket.update' },
      extra: { targetId: ticketId, outcome: 'succeeded' },
    });
  }
  return NextResponse.json({ ok: true });
}
