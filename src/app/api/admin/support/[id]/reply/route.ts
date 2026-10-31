import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePermission } from '@/lib/admin/gate';
import { isUuid, notFoundResponse, parseBody } from '@/lib/admin/http';
import { withAudit } from '@/lib/admin/audit';
import { enqueueEmail } from '@/lib/email-queue';
import { STATUS_LABELS, replySubject } from '@/lib/admin/tickets';
import SupportReply from '@emails/support-reply';

type Ctx = { params: { id: string } };

const SUPPORT_INBOX = 'contact@cyberdelic.design';

const schema = z.object({
  body: z.string().trim().min(1).max(10000),
  // One key per draft. It becomes the queue event id, so a retried request cannot send twice.
  idempotencyKey: z.string().uuid(),
});

function report(message: string, step: string) {
  // Messages here come from the database or mail layer, never from the reply text or a token.
  Sentry.captureException(new Error(`admin support reply ${step} failed: ${message}`), {
    tags: { route: 'admin-support-reply', step },
  });
}

export async function POST(request: Request, context: Ctx) {
  const gate = await requirePermission('tickets.work');
  if (!gate.ok) return gate.response;
  if (!isUuid(context.params.id)) return notFoundResponse();
  const body = await parseBody(request, schema);
  if (!body.ok) return body.response;
  const ticketId = context.params.id;
  const admin = getSupabaseAdmin();

  const { data: ticket, error: ticketError } = await admin
    .from('support_tickets')
    .select('email, title, user_id, status')
    .eq('id', ticketId)
    .maybeSingle();
  if (ticketError) {
    report(`${ticketError.code ?? 'error'}: ${ticketError.message}`, 'ticket-read');
    return NextResponse.json({ error: 'The card could not be loaded.' }, { status: 500 });
  }
  if (!ticket) return NextResponse.json({ error: 'Card not found.' }, { status: 404 });

  // The name only personalises the greeting, so a failed lookup falls back to "there".
  let userName = 'there';
  if (ticket.user_id) {
    const { data: profile, error: profileError } = await admin
      .from('users')
      .select('full_name')
      .eq('id', ticket.user_id)
      .maybeSingle();
    if (profileError) report(`${profileError.code ?? 'error'}: ${profileError.message}`, 'profile-read');
    else if (profile?.full_name) userName = profile.full_name;
  }

  try {
    await withAudit(
      { actorId: gate.staff.userId, action: 'ticket.reply', targetType: 'ticket', targetId: ticketId },
      () =>
        enqueueEmail({
          to: ticket.email,
          subject: replySubject(ticket.title),
          replyTo: SUPPORT_INBOX,
          eventId: `support-reply-${ticketId}-${body.data.idempotencyKey}`,
          // The direct-send fallback would bypass the event id, so a queue outage fails the request instead.
          fallbackOnMissing: false,
          ticketId,
          actorId: gate.staff.userId,
          template: SupportReply({
            userName,
            ticketTitle: ticket.title,
            body: body.data.body,
          }),
        }),
    );
  } catch (err) {
    report(err instanceof Error ? err.message : 'unknown', 'send');
    return NextResponse.json({ error: 'The reply was not sent.' }, { status: 500 });
  }

  // The email is queued, so from here a failure must not read as "not sent".
  const events = [{ ticket_id: ticketId, actor_id: gate.staff.userId, kind: 'reply', body: body.data.body }];
  if (ticket.status !== 'waiting') {
    events.push({ ticket_id: ticketId, actor_id: gate.staff.userId, kind: 'status', body: `Moved to ${STATUS_LABELS.waiting}` });
  }
  const { error: eventError } = await admin.from('support_ticket_events').insert(events);
  if (eventError) report(`${eventError.code ?? 'error'}: ${eventError.message}`, 'event-insert');

  const { error: statusError } = await admin
    .from('support_tickets')
    .update({ status: 'waiting', updated_at: new Date().toISOString() })
    .eq('id', ticketId);
  if (statusError) report(`${statusError.code ?? 'error'}: ${statusError.message}`, 'status-update');

  if (eventError || statusError) {
    return NextResponse.json(
      { error: 'The reply was sent, but the card was not fully updated. Do not send it again; reload to check the card.', sent: true },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
