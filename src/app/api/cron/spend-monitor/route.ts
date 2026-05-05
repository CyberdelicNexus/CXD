// Hourly AI spend watcher.
//
// Aggregates all users' daily credit usage, converts to approximate USD,
// fires a Sentry warning if today's total exceeds the configured threshold.
// Idempotent — read-only against the DB, just observes.
//
// Threshold: AI_ORG_DAILY_ALERT_CENTS env var (default $100/day).

import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/supabase/admin';
import {
  CENTS_PER_CREDIT,
  centsToDollars,
  creditsToCents,
  getOrgDailyAlertCents,
} from '@/lib/ai/cost-tracking';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Cron auth — Vercel sends Authorization: Bearer ${CRON_SECRET}
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[spend-monitor] CRON_SECRET not configured');
    return NextResponse.json({ error: 'Server config error' }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Aggregate org-wide credit usage today via the RPC added in
  // 20240425000009_daily_credit_tracking.sql.
  const { data, error } = await supabase.rpc('get_org_daily_credit_usage');

  if (error) {
    const msg = error.message || '';
    const code = error.code || '';
    const isMissing =
      code === 'PGRST202' || code === '42883' ||
      msg.includes('Could not find') || msg.includes('does not exist');
    if (isMissing) {
      console.warn('[spend-monitor] get_org_daily_credit_usage RPC missing — run migration');
      return NextResponse.json({ skipped: true, reason: 'migration not applied' });
    }
    console.error('[spend-monitor] aggregate failed', error);
    Sentry.captureException(error, { tags: { route: 'cron/spend-monitor' } });
    return NextResponse.json({ error: 'Aggregation failed' }, { status: 500 });
  }

  // RPC returns single-row TABLE; supabase-js wraps in array.
  const row = Array.isArray(data) ? data[0] : data;
  const totalCredits = Number(row?.total_credits ?? 0);
  const activeUsers = Number(row?.active_users ?? 0);
  const totalCents = creditsToCents(totalCredits);
  const threshold = getOrgDailyAlertCents();
  const breached = totalCents >= threshold;

  if (breached) {
    Sentry.captureMessage(
      `[AI spend] org-wide daily total ${centsToDollars(totalCents)} crossed alert threshold ${centsToDollars(threshold)}`,
      {
        level: 'warning',
        tags: { route: 'cron/spend-monitor', alert: 'ai-spend-threshold' },
        extra: { totalCredits, totalCents, activeUsers, thresholdCents: threshold, centsPerCredit: CENTS_PER_CREDIT },
      },
    );
  }

  return NextResponse.json({
    totalCredits,
    activeUsers,
    approxCents: totalCents,
    thresholdCents: threshold,
    breached,
  });
}
