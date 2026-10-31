// Inngest functions for asynchronous email delivery.
//
// All email sends in the app fire `email/send` events instead of awaiting
// Resend inline. This means:
//   - Webhooks return in <100ms instead of holding for the email roundtrip.
//   - Resend outages no longer fail the user-facing request.
//   - Retries are durable (Inngest persists state across function attempts).
//   - Idempotency for kind-tracked emails moves into the worker so the
//     caller doesn't carry that complexity.

import { inngest } from './client';
import { sendEmail } from '@/lib/email';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/supabase/admin';

interface EmailSendData {
  to: string;
  subject: string;
  html: string;
  // When userId + emailKind are present, the worker enforces email_log
  // idempotency so duplicate events (Stripe replays, double-fires) won't
  // double-send.
  userId?: string;
  emailKind?: string;
  // Optional Stripe event id for webhook-driven sends. Adds an extra
  // dedupe path: same event id won't fire twice across email kinds.
  stripeEventId?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  broadcastId?: string;
  ticketId?: string;
  actorId?: string;
}

async function recordBroadcastResult(broadcastId: string, sent: number, failed: number) {
  const { error } = await getSupabaseAdmin().rpc('admin_record_broadcast_result', {
    p_broadcast: broadcastId,
    p_sent: sent,
    p_failed: failed,
  });
  if (error) throw error;
}

export const sendEmailFn = inngest.createFunction(
  {
    id: 'send-email',
    name: 'Send email (Resend)',
    retries: 4, // ~4 attempts over ~1 hour with exponential backoff
    // A broadcast enqueues one event per recipient; stay inside Resend's rate limit.
    throttle: { limit: 2, period: '1s' },
    // Everything that is not a broadcast gets a 600 second head start in the queue,
    // so a bulk send cannot hold up a password reset, receipt or support reply.
    // Priority only reorders runs that are waiting; a negative value would be a
    // fixed delay, so broadcasts stay at 0 and the rest are raised.
    priority: { run: 'event.data.broadcastId != null ? 0 : 600' },
    triggers: [{ event: 'email/send' }],
    onFailure: async ({ event }) => {
      const { broadcastId, ticketId, actorId, userId, emailKind } = event.data.event.data as EmailSendData;
      // Each branch handles its own failure, so one cannot stop the other.
      let broadcastError: unknown = null;
      if (broadcastId) {
        try {
          // A run can fail after the email went out, for example when only the
          // result count failed. A logged send must not count as failed.
          let wasSent = false;
          if (userId && emailKind) {
            const { data, error } = await getSupabaseAdmin()
              .from('email_log')
              .select('id')
              .eq('user_id', userId)
              .eq('email_kind', emailKind)
              .limit(1);
            if (error) throw new Error(`email_log read failed: ${error.code ?? 'error'}: ${error.message}`);
            wasSent = (data?.length ?? 0) > 0;
          }
          await recordBroadcastResult(broadcastId, wasSent ? 1 : 0, wasSent ? 0 : 1);
        } catch (err) {
          broadcastError = err;
          Sentry.captureException(err, { tags: { route: 'inngest-send-email', step: 'broadcast-result' }, extra: { broadcastId } });
        }
      }
      // Staff must see that a reply never arrived. This write cannot throw, so it never blocks the broadcast path.
      if (ticketId && actorId) {
        try {
          const { error } = await getSupabaseAdmin().from('support_ticket_events').insert({
            ticket_id: ticketId,
            actor_id: actorId,
            kind: 'delivery_failed',
            body: 'Reply could not be delivered.',
          });
          if (error) throw new Error(`${error.code ?? 'error'}: ${error.message}`);
        } catch (err) {
          Sentry.captureException(new Error(`delivery failure not recorded: ${err instanceof Error ? err.message : 'unknown'}`), {
            tags: { route: 'inngest-send-email', step: 'delivery-failed-event' },
          });
        }
      }
      // Rethrow so the missing count is visible instead of silently lost.
      if (broadcastError) throw broadcastError;
    },
  },
  async ({ event, step }) => {
    const { to, subject, html, userId, emailKind, stripeEventId, replyTo, headers, broadcastId } = event.data as EmailSendData;

    if (!to || !subject || !html) {
      return { skipped: true, reason: 'missing required fields' };
    }

    // Idempotency check (only when caller passed user/kind tracking).
    if (userId && emailKind) {
      const isDuplicate = await step.run('check-email-log', async () => {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
          .from('email_log')
          .select('id')
          .or(
            stripeEventId
              ? `and(user_id.eq.${userId},email_kind.eq.${emailKind}),stripe_event_id.eq.${stripeEventId}`
              : `and(user_id.eq.${userId},email_kind.eq.${emailKind})`,
          )
          .limit(1);
        // A failed read is not "not sent": throw so the step retries.
        if (error) throw new Error(`email_log read failed: ${error.code ?? 'error'}: ${error.message}`);
        return (data?.length ?? 0) > 0;
      });

      if (isDuplicate) {
        return { skipped: true, reason: 'duplicate', userId, emailKind };
      }
    }

    // Send via Resend. step.run gives this its own retry boundary so a
    // Resend hiccup doesn't re-trigger the dedupe check above.
    await step.run('send-via-resend', async () => {
      const result = await sendEmail({
        to,
        subject,
        html,
        replyTo,
        headers,
        // Resend drops a repeat of this send, so a retry after a lost response emails no one twice.
        idempotencyKey: broadcastId && userId ? `broadcast-${broadcastId}-${userId}` : undefined,
      });
      // sendEmail returns null when RESEND_API_KEY is missing. A broadcast must not count that as sent.
      if (broadcastId && result === null) throw new Error('email provider is not configured');
    });

    // Log after successful send (kind-tracked sends only). If the log
    // insert fails, the email already went out — accept the duplicate
    // risk on retry rather than the email-never-sent risk.
    if (userId && emailKind) {
      await step.run('write-email-log', async () => {
        const supabase = getSupabaseAdmin();
        const { error } = await supabase.from('email_log').insert({
          user_id: userId,
          email_kind: emailKind,
          stripe_event_id: stripeEventId ?? null,
        });
        if (error && error.code !== '23505') {
          // 23505 cannot happen today: email_log has no unique constraint on these columns.
          // Kept in case one is added, where it would mean a parallel send logged first.
          throw error;
        }
      });
    }

    if (broadcastId) {
      await step.run('record-broadcast-result', () => recordBroadcastResult(broadcastId, 1, 0));
    }

    return { sent: true, to, subject, emailKind };
  },
);

export const inngestFunctions = [sendEmailFn];
