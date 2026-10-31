/**
 * POST /auth/nexus-callback — the Canvas end of the Nexus handoff (D182 §3).
 *
 * The platform auto-posts a form with a 60-second ES256 token (field `token`).
 * Any failure redirects (303) to /sign-in?error=<code> and creates no session.
 * Inert while NEXUS_ISSUER / NEXUS_JWKS_URL are unset (error=unavailable).
 * Never log the token, the email or the payload.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/supabase/server';
import { getSupabaseAdmin } from '@/supabase/admin';
import { isBanned } from '@/lib/admin/permissions';
import { getHandoffConfig } from '@/lib/nexus/config';
import { consumeHandoffToken } from '@/lib/nexus/handoff';
import {
  getNexusJwks,
  purgeExpiredNexusRows,
  resolveCanvasUser,
  resolveIntentDestination,
  supabaseJtiStore,
  syncNexusTier,
} from '@/lib/nexus/server';
import {
  NEXUS_LINK_COOKIE,
  PENDING_LINK_TTL_SECONDS,
  newPendingLinkToken,
  pendingLinkCookieOptions,
} from '@/lib/nexus/pending-link';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BODY_BYTES = 16 * 1024;

function redirectTo(request: NextRequest, path: string): NextResponse {
  const res = NextResponse.redirect(new URL(path, request.url), 303);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Referrer-Policy', 'no-referrer');
  return res;
}

function fail(request: NextRequest, code: string): NextResponse {
  return redirectTo(request, `/sign-in?error=${encodeURIComponent(code)}`);
}

async function readToken(request: NextRequest): Promise<string | null> {
  const type = request.headers.get('content-type') || '';
  if (!type.toLowerCase().startsWith('application/x-www-form-urlencoded')) return null;
  const declared = Number(request.headers.get('content-length') || '0');
  if (declared > MAX_BODY_BYTES) return null;
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  const token = new URLSearchParams(text).get('token');
  return token && token.length > 0 ? token : null;
}

export async function POST(request: NextRequest) {
  const config = getHandoffConfig();
  if (!config || !process.env.SUPABASE_SERVICE_ROLE_KEY) return fail(request, 'unavailable');

  let token: string | null;
  try {
    token = await readToken(request);
  } catch {
    token = null;
  }
  if (!token) return fail(request, 'invalid');

  const admin = getSupabaseAdmin();

  // 1–2. Verify (ES256 pinned) and claim the jti once.
  const verified = await consumeHandoffToken(
    token,
    getNexusJwks(config.jwksUrl),
    { issuer: config.issuer },
    supabaseJtiStore(admin),
  );
  void purgeExpiredNexusRows(admin);
  if (!verified.ok) return fail(request, verified.code);
  const { claims } = verified;

  // 3. Resolve the Canvas user.
  const resolved = await resolveCanvasUser(admin, claims);
  if (resolved.kind === 'error') return fail(request, resolved.code);

  if (resolved.kind === 'pending') {
    const { token: linkToken, hash } = newPendingLinkToken();
    const { error } = await admin.from('nexus_pending_links').insert({
      token_hash: hash,
      member_id: claims.memberId,
      user_id: resolved.userId,
      intent: claims.intent,
      expires_at: new Date(Date.now() + PENDING_LINK_TTL_SECONDS * 1000).toISOString(),
    });
    if (error) return fail(request, 'failed');
    const res = redirectTo(request, '/sign-in?nexus=link');
    res.cookies.set(NEXUS_LINK_COOKIE, linkToken, pendingLinkCookieOptions);
    return res;
  }

  const userId = resolved.userId;

  // 4. Session for that user: a magic link minted and verified server-side (no email is sent).
  try {
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
    const email = userData?.user?.email;
    if (userError || !email) return fail(request, 'failed');
    if (isBanned(userData.user.banned_until, new Date())) {
      return fail(request, 'failed');
    }

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    const hashed = link?.properties?.hashed_token;
    if (linkError || !hashed) return fail(request, 'failed');

    const supabase = await createClient();
    const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: hashed, type: 'magiclink' });
    if (otpError) return fail(request, 'failed');
  } catch {
    return fail(request, 'failed');
  }

  // 5. Tier sync (never blocks the session, never downgrades on a failed read).
  const plan = await syncNexusTier(admin, userId, claims.memberId, 2_000);

  // 6. Intent.
  const destination = await resolveIntentDestination(admin, userId, claims.intent, plan);
  return redirectTo(request, destination);
}
