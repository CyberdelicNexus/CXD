import type { ReactElement } from 'react';
import { render } from '@react-email/render';
import { createClient as createAdminClient, SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

/**
 * Stable identifiers for every automated email. These strings are persisted in
 * email_log.email_kind — never rename without a migration.
 */
export const EMAIL_KINDS = {
  TRIAL_DAY_1: 'trial-day-1',
  TRIAL_ENDING_SOON: 'trial-ending-soon',
  TRIAL_CONVERTED: 'trial-converted',
  PAYMENT_FAILED: 'payment-failed',
  PAYMENT_FINAL_WARNING: 'payment-final-warning',
} as const;

export type EmailKind = typeof EMAIL_KINDS[keyof typeof EMAIL_KINDS];

function adminClient(): SupabaseClient {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

interface SendKindOnceOptions {
  userId: string;
  userEmail: string;
  kind: EmailKind;
  subject: string;
  template: ReactElement;
  /** For webhook-triggered sends, pass the Stripe event id for stronger idempotency. */
  stripeEventId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Idempotent email send. Returns true if the email was sent this invocation;
 * false if it was skipped because email_log already has a matching row. Never
 * throws — failures are logged and reported via the boolean.
 */
export async function sendKindOnce(opts: SendKindOnceOptions): Promise<boolean> {
  const supabase = adminClient();

  // Idempotency check. Either an existing (user, kind) row OR a matching
  // stripe_event_id (when provided) means we already processed this send.
  const orFilter = opts.stripeEventId
    ? `and(user_id.eq.${opts.userId},email_kind.eq.${opts.kind}),stripe_event_id.eq.${opts.stripeEventId}`
    : `and(user_id.eq.${opts.userId},email_kind.eq.${opts.kind})`;

  const { data: existing } = await supabase
    .from('email_log')
    .select('id')
    .or(orFilter)
    .limit(1)
    .maybeSingle();

  if (existing) {
    console.log(`[email] Skipped ${opts.kind} for user=${opts.userId} — already sent`);
    return false;
  }

  const html = await render(opts.template);

  try {
    await sendEmail({ to: opts.userEmail, subject: opts.subject, html });
  } catch (err) {
    console.error(`[email] Failed to send ${opts.kind} for user=${opts.userId}:`, err);
    return false;
  }

  const { error: logErr } = await supabase.from('email_log').insert({
    user_id: opts.userId,
    email_kind: opts.kind,
    stripe_event_id: opts.stripeEventId ?? null,
    metadata: opts.metadata ?? null,
  });

  if (logErr) {
    // The send succeeded; log write failed. Report but don't throw — a
    // duplicate email on next retry is less bad than crashing the webhook.
    console.error(`[email] sendEmail succeeded but email_log insert failed for ${opts.kind}:`, logErr);
  }

  console.log(`[email] Sent ${opts.kind} to user=${opts.userId}`);
  return true;
}
