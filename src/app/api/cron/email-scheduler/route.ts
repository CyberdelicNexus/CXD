import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/supabase/admin';
import TrialDay1 from '../../../../../emails/trial-day-1';
import PaymentFinalWarning from '../../../../../emails/payment-final-warning';
import { EMAIL_KINDS, sendKindOnce } from '@/lib/email-kinds';

export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

async function runTrialDay1Scan(): Promise<{ sent: number; skipped: number }> {
  const supabase = getSupabaseAdmin();
  const now = Date.now();

  // Window: 24–48 hours after trial_start. Generous so a missed cron run
  // catches up the next day without skipping users.
  const upper = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const lower = new Date(now - 48 * 60 * 60 * 1000).toISOString();

  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select('user_id, trial_end, users:users!inner(email, full_name)')
    .eq('status', 'trialing')
    .gte('trial_start', lower)
    .lte('trial_start', upper);

  if (error) {
    console.error('[cron] trial-day-1 scan failed:', error);
    return { sent: 0, skipped: 0 };
  }

  const rows = (subs ?? []) as Array<{
    user_id: string;
    trial_end: string | null;
    users: { email: string; full_name: string | null } | { email: string; full_name: string | null }[];
  }>;
  let sent = 0;
  let skipped = 0;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvas.cyberdelic.design';

  for (const row of rows) {
    const userObj = Array.isArray(row.users) ? row.users[0] : row.users;
    if (!userObj?.email) continue;

    const trialEndDate = row.trial_end
      ? new Date(row.trial_end).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'soon';

    const wasSent = await sendKindOnce({
      userId: row.user_id,
      userEmail: userObj.email,
      kind: EMAIL_KINDS.TRIAL_DAY_1,
      subject: "Your Pro trial is live — let's get started",
      template: TrialDay1({
        userName: userObj.full_name || 'there',
        trialEndDate,
        dashboardUrl: `${baseUrl}/dashboard`,
      }),
    });

    if (wasSent) sent++;
    else skipped++;
  }

  return { sent, skipped };
}

async function runPaymentFinalWarningScan(): Promise<{ sent: number; skipped: number }> {
  const supabase = getSupabaseAdmin();
  const now = Date.now();

  // Window: 4.5–5.5 days after the payment-failed email was logged.
  const upper = new Date(now - 4.5 * 24 * 60 * 60 * 1000).toISOString();
  const lower = new Date(now - 5.5 * 24 * 60 * 60 * 1000).toISOString();

  // Find past_due users whose payment-failed email was logged in the window
  // AND who haven't already received a payment-final-warning.
  const { data: candidates, error } = await supabase
    .from('email_log')
    .select('user_id, sent_at')
    .eq('email_kind', 'payment-failed')
    .gte('sent_at', lower)
    .lte('sent_at', upper);

  if (error) {
    console.error('[cron] payment-final-warning candidate query failed:', error);
    return { sent: 0, skipped: 0 };
  }

  let sent = 0;
  let skipped = 0;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvas.cyberdelic.design';

  for (const candidate of candidates ?? []) {
    // Confirm still past_due + pull user + subscription info.
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('user_id, status, current_period_end, users:users!inner(email, full_name), stripe_subscription_id')
      .eq('user_id', candidate.user_id)
      .single();

    if (!sub || sub.status !== 'past_due') {
      skipped++;
      continue;
    }

    const userObj = Array.isArray(sub.users) ? sub.users[0] : sub.users;
    if (!userObj?.email) {
      skipped++;
      continue;
    }

    // Access ends ~2 days after the final warning (when Stripe's 4th retry
    // runs at day 7 and fails, subscription.deleted fires). We surface that
    // as "in 2 days" friendly copy.
    const accessEndsDate = new Date(now + 2 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Amount: fetch the open invoice for the most recent amount_due, or fall
    // back to "your subscription amount".
    let amountDue = '$20.00';
    try {
      if (sub.stripe_subscription_id) {
        // Lazy import of Stripe to avoid pulling it into the top-level module
        // graph more than necessary.
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' });
        const invoices = await stripe.invoices.list({
          subscription: sub.stripe_subscription_id,
          status: 'open',
          limit: 1,
        });
        const open = invoices.data[0];
        if (open) amountDue = `$${(open.amount_due / 100).toFixed(2)}`;
      }
    } catch (err) {
      console.warn('[cron] Could not retrieve open invoice amount:', err);
    }

    const wasSent = await sendKindOnce({
      userId: sub.user_id,
      userEmail: userObj.email,
      kind: EMAIL_KINDS.PAYMENT_FINAL_WARNING,
      subject: 'Last chance to restore your Pro access',
      template: PaymentFinalWarning({
        userName: userObj.full_name || 'there',
        amountDue,
        accessEndsDate,
        updatePaymentUrl: `${baseUrl}/dashboard/profile`,
      }),
    });

    if (wasSent) sent++;
    else skipped++;
  }

  return { sent, skipped };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET) {
    console.error('[cron] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  if (authHeader !== expected) {
    return unauthorized();
  }

  const startedAt = Date.now();
  const results: Record<string, { sent: number; skipped: number }> = {};

  results.trialDay1 = await runTrialDay1Scan();
  results.paymentFinalWarning = await runPaymentFinalWarningScan();

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    results,
  });
}
