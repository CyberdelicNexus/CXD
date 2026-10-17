// Daily Nexus tier sync (D182 §5) for every linked Canvas user.
//
// Vercel sends Authorization: Bearer ${CRON_SECRET}. A no-op while the tier
// read is not configured (NEXUS_ISSUER / NEXUS_TIER_CREDENTIAL unset). A
// failed read changes nothing for that user. Never logs ids or emails.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/supabase/admin';
import { timingSafeStringEqual } from '@/lib/bridge/bridge-auth';
import { getTierReadConfig } from '@/lib/nexus/config';
import { syncNexusTier } from '@/lib/nexus/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PAGE_SIZE = 500;
const CONCURRENCY = 5;
const BUDGET_MS = 50_000; // stay inside the 60 s maxDuration for api/cron/**

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[nexus-tier-sync] CRON_SECRET not configured');
    return NextResponse.json({ error: 'Server config error' }, { status: 500 });
  }
  if (!timingSafeStringEqual(req.headers.get('authorization') || '', `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!getTierReadConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ skipped: true, reason: 'not configured' });
  }

  const admin = getSupabaseAdmin();
  const started = Date.now();
  let checked = 0;
  let from = 0;

  while (Date.now() - started < BUDGET_MS) {
    const { data, error } = await admin
      .from('nexus_links')
      .select('member_id, user_id')
      .order('linked_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error('[nexus-tier-sync] link page failed', error.code);
      return NextResponse.json({ error: 'Read failed', checked }, { status: 500 });
    }
    const links = (data || []) as { member_id: string; user_id: string }[];
    if (links.length === 0) break;

    for (let i = 0; i < links.length && Date.now() - started < BUDGET_MS; i += CONCURRENCY) {
      const batch = links.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map((l) => syncNexusTier(admin, l.user_id, l.member_id, 3_000)));
      checked += batch.length;
    }

    if (links.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return NextResponse.json({ ok: true, checked, complete: Date.now() - started < BUDGET_MS });
}
