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
    triggers: [{ event: 'email/send' }],
    onFailure: async ({ event }) => {
      const { broadcastId, ticketId, actorId } = event.data.event.data as EmailSendData;
      // Staff must see that a reply never arrived. This write cannot throw, so it never blocks the broadcast path below.
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
      if (broadcastId) await recordBroadcastResult(broadcastId, 0, 1);
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
        const { data } = await supabase
          .from('email_log')
          .select('id')
          .or(
            stripeEventId
              ? `and(user_id.eq.${userId},email_kind.eq.${emailKind}),stripe_event_id.eq.${stripeEventId}`
              : `and(user_id.eq.${userId},email_kind.eq.${emailKind})`,
          )
          .maybeSingle();
        return !!data;
      });

      if (isDuplicate) {
        return { skipped: true, reason: 'duplicate', userId, emailKind };
      }
    }

    // Send via Resend. step.run gives this its own retry boundary so a
    // Resend hiccup doesn't re-trigger the dedupe check above.
    await step.run('send-via-resend', async () => {
      await sendEmail({ to, subject, html, replyTo, headers });
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
          // 23505 = unique violation = race with parallel send; benign.
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
