import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import TrialDay1 from '../../../../../emails/trial-day-1';
import { EMAIL_KINDS, sendKindOnce } from '@/lib/email-kinds';

export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

async function runTrialDay1Scan(): Promise<{ sent: number; skipped: number }> {
  const supabase = adminClient();
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

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    results,
  });
}
