/**
 * GET /api/nexus/projects?member=<uuid> — the Nexus dashboard's canvas grid
 * (D182 §6), server to server.
 *
 * Bearer NEXUS_BRIDGE_TOKEN (or NEXUS_BRIDGE_TOKEN_PREVIOUS while rotating),
 * compared timing-safe and rate-limited per credential. 404 while
 * NEXUS_BRIDGE_TOKEN is unset (kill switch). Owned + shared-with-me, newest
 * first, at most 60, https-only cover images. Never log the token or ids.
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/supabase/admin';
import { verifyNexusBridgeToken } from '@/lib/nexus/config';
import { checkNexusRateLimit } from '@/lib/nexus/nexus-rate-limit';
import { isUuid } from '@/lib/nexus/handoff';
import { buildProjectListing, LISTING_CAP, UNLINKED_LISTING, type ListingSourceRow } from '@/lib/nexus/listing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function json(body: unknown, status = 200, extra: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...extra } });
}

const COLUMNS = 'id, name, description, updated_at, coverImage:project_data->>coverImage';

export async function GET(request: Request) {
  if (!process.env.NEXUS_BRIDGE_TOKEN) return json({}, 404);

  const auth = verifyNexusBridgeToken(request.headers.get('authorization'));
  if (!auth.ok) return json({}, auth.reason === 'not_configured' ? 404 : 401);

  const limit = await checkNexusRateLimit(auth.token);
  if (!limit.allowed) {
    const retry = Math.max(1, Math.ceil((limit.retryAfterMs ?? 60_000) / 1000));
    return json({}, 429, { 'Retry-After': String(retry) });
  }

  const member = new URL(request.url).searchParams.get('member');
  if (!isUuid(member)) return json({}, 400);

  try {
    const admin = getSupabaseAdmin();
    const { data: link, error: linkError } = await admin
      .from('nexus_links')
      .select('user_id')
      .eq('member_id', member.toLowerCase())
      .maybeSingle();
    if (linkError) return json({}, 502);
    if (!link) return json(UNLINKED_LISTING);
    const userId = (link as { user_id: string }).user_id;

    const [subRes, ownedRes, ownedCountRes, collabRes] = await Promise.all([
      admin.from('subscriptions').select('plan_id').eq('user_id', userId).maybeSingle(),
      admin
        .from('cxd_projects')
        .select(COLUMNS)
        .eq('owner_id', userId)
        .order('updated_at', { ascending: false })
        .limit(LISTING_CAP),
      admin.from('cxd_projects').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
      admin.from('canvas_collaborators').select('canvas_id').eq('user_id', userId),
    ]);
    if (ownedRes.error || ownedCountRes.error || collabRes.error) return json({}, 502);

    const rows: ListingSourceRow[] = (ownedRes.data || []).map((r: any) => ({ ...r, role: 'owner' as const }));

    const collabIds = (collabRes.data || []).map((c: { canvas_id: string }) => c.canvas_id);
    if (collabIds.length > 0) {
      const { data: shared, error: sharedError } = await admin
        .from('cxd_projects')
        .select(COLUMNS)
        .in('id', collabIds.slice(0, 500))
        .neq('owner_id', userId)
        .order('updated_at', { ascending: false })
        .limit(LISTING_CAP);
      if (sharedError) return json({}, 502);
      for (const r of shared || []) rows.push({ ...(r as any), role: 'collaborator' });
    }

    const plan = (subRes.data as { plan_id?: string } | null)?.plan_id ?? 'free';
    return json(buildProjectListing({ plan, ownedCount: ownedCountRes.count ?? 0, rows }));
  } catch {
    return json({}, 502);
  }
}
