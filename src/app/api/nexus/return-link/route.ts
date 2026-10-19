/**
 * GET /api/nexus/return-link — where the "Cyberdelic Nexus" button points for
 * the signed-in user: `{ url }` when they came from the platform (a row in
 * nexus_links), their Nexus membership is active right now (a live tier read)
 * and NEXUS_ISSUER is set, otherwise `{ url: null }`. Only the URL leaves the
 * server, never the member id or the tier.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';
import { getSupabaseAdmin } from '@/supabase/admin';
import { getNexusReturnUrl } from '@/lib/nexus/config';
import { fetchNexusTier, getLinkedMemberId } from '@/lib/nexus/server';
import { showsNexusReturn } from '@/lib/nexus/tier';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function json(url: string | null, status = 200): NextResponse {
  return NextResponse.json({ url }, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function GET() {
  const returnUrl = getNexusReturnUrl();
  if (!returnUrl) return json(null);

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return json(null, 401);

  try {
    const memberId = await getLinkedMemberId(getSupabaseAdmin(), user.id);
    if (!memberId) return json(null);
    const answer = await fetchNexusTier(memberId, 2000);
    return json(showsNexusReturn(answer) ? returnUrl : null);
  } catch {
    return json(null);
  }
}
