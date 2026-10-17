/**
 * GET /api/nexus/return-link — where the "Cyberdelic Nexus" button points for
 * the signed-in user: `{ url }` when they came from the platform (a row in
 * nexus_links) and NEXUS_ISSUER is set, otherwise `{ url: null }`. Only the
 * URL leaves the server, never the member id.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';
import { getSupabaseAdmin } from '@/supabase/admin';
import { getNexusReturnUrl } from '@/lib/nexus/config';
import { getLinkedMemberId } from '@/lib/nexus/server';

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
    return json(memberId ? returnUrl : null);
  } catch {
    return json(null);
  }
}
