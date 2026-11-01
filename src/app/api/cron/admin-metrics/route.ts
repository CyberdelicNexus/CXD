// Nightly dashboard snapshot of the numbers that cannot be rebuilt later.
// Upserts today's row, so a rerun is safe.

import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/supabase/admin';
import { classifyUsers } from '@/lib/admin/analytics/metrics';
import { fetchMrr, fetchSummary, withTimeout } from '@/lib/admin/analytics/sources';

export const dynamic = 'force-dynamic';

const STRIPE_TIMEOUT_MS = 30000;

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[admin-metrics] CRON_SECRET not configured');
    return NextResponse.json({ error: 'Server config error' }, { status: 500 });
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await fetchSummary(30);
    // A Stripe failure leaves mrr_cents out of the upsert: a new row keeps the column's null
    // default (a gap, not a false zero) and a rerun cannot erase a value saved earlier today.
    const mrr = await withTimeout(fetchMrr(), STRIPE_TIMEOUT_MS).catch((err) => {
      Sentry.captureException(err, { tags: { route: 'admin-metrics', source: 'stripe' } });
      return null;
    });
    const users = classifyUsers(summary.planRows, summary.totalUsers);

    const { error } = await getSupabaseAdmin().from('admin_daily_metrics').upsert({
      day: new Date().toISOString().slice(0, 10),
      active_7d: summary.active7d,
      active_30d: summary.active30d,
      ...(mrr ? { mrr_cents: mrr } : {}),
      paying_users: users.paying,
      comped_users: users.comped,
      free_users: users.free,
      credits_used_period: summary.creditsUsedPeriod,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'admin-metrics' } });
    return NextResponse.json({ error: 'Snapshot failed' }, { status: 500 });
  }
}
