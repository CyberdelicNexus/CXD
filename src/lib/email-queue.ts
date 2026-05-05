// Caller-friendly helper for queueing emails via Inngest.
//
// Renders the React-email template, fires an `email/send` event, returns
// immediately. The Inngest function on the other end handles delivery
// (with retries) and email_log idempotency.
//
// Drop-in replacement pattern for old call sites:
//   - `await sendEmail({ to, subject, html })` → `await enqueueEmail({ to, subject, template })`
//   - `await sendKindOnce({ userId, userEmail, kind, subject, template, stripeEventId })`
//     → `await enqueueEmail({ to: userEmail, subject, template, userId, emailKind: kind, stripeEventId })`

import type { ReactElement } from 'react';
import { render } from '@react-email/render';
import { inngest } from '@/inngest/client';
import { sendEmail } from '@/lib/email';

interface EnqueueEmailOptions {
  to: string;
  subject: string;
  template: ReactElement;
  /** When set together with emailKind, the worker enforces email_log idempotency. */
  userId?: string;
  emailKind?: string;
  /** Optional Stripe event id for webhook-driven sends — second dedupe path. */
  stripeEventId?: string;
  /**
   * If true, fall back to direct Resend send when Inngest isn't configured
   * (no INNGEST_EVENT_KEY in dev/local without the dev CLI). Defaults true.
   */
  fallbackOnMissing?: boolean;
}

/**
 * Queue an email through Inngest. Returns when the event has been accepted
 * by Inngest (typically <50ms), NOT when the email is delivered.
 */
export async function enqueueEmail(opts: EnqueueEmailOptions): Promise<void> {
  const html = await render(opts.template);

  try {
    await inngest.send({
      name: 'email/send',
      data: {
        to: opts.to,
        subject: opts.subject,
        html,
        userId: opts.userId,
        emailKind: opts.emailKind,
        stripeEventId: opts.stripeEventId,
      },
    });
  } catch (err) {
    // Inngest unreachable. Either we're in dev without the CLI running, or
    // there's an outage. Default behavior: fall back to direct Resend send
    // so emails still go out. Log so the issue is visible in Sentry.
    console.error('[enqueueEmail] Inngest send failed, falling back to direct send', err);

    if (opts.fallbackOnMissing === false) {
      throw err;
    }

    // Direct send doesn't enforce email_log idempotency — but at this
    // point we've already lost durable retry, so accept the trade.
    await sendEmail({ to: opts.to, subject: opts.subject, html });
  }
}
