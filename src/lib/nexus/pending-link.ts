/**
 * Pending Nexus link (D182 §3 step 3.2, unconfirmed Canvas email).
 *
 * The callback stores sha256(token) with the member, the Canvas user and the
 * intent, and puts the raw 128-bit token in the httpOnly cookie
 * cxd_nexus_link. After a successful password or Google sign-in AS THAT SAME
 * USER, completePendingNexusLink writes the link, deletes the row and clears
 * the cookie. Never log the token.
 */

import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/supabase/admin';
import { parseIntent } from './handoff';
import { resolveIntentDestination, syncNexusTier, writeNexusLink } from './server';

export const NEXUS_LINK_COOKIE = 'cxd_nexus_link';
export const PENDING_LINK_TTL_SECONDS = 15 * 60;

export function newPendingLinkToken(): { token: string; hash: string } {
  const token = randomBytes(16).toString('base64url');
  return { token, hash: hashPendingLinkToken(token) };
}

export function hashPendingLinkToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export const pendingLinkCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: PENDING_LINK_TTL_SECONDS,
};

/**
 * Complete a pending link for the user who just signed in. Returns the path
 * the intent points at, or null when there was nothing to complete (no
 * cookie, expired, or a different user). Never throws.
 */
export async function completePendingNexusLink(userId: string | null | undefined): Promise<string | null> {
  let cookieStore: ReturnType<typeof cookies>;
  try {
    cookieStore = cookies();
  } catch {
    return null;
  }
  const token = cookieStore.get(NEXUS_LINK_COOKIE)?.value;
  if (!token) return null;

  const clearCookie = () => {
    try {
      cookieStore.set(NEXUS_LINK_COOKIE, '', { ...pendingLinkCookieOptions, maxAge: 0 });
    } catch {
      // Read-only cookie context; the cookie expires on its own.
    }
  };

  if (!userId || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    clearCookie();
    return null;
  }

  try {
    const admin = getSupabaseAdmin();
    const hash = hashPendingLinkToken(token);
    const { data: row } = await admin
      .from('nexus_pending_links')
      .select('member_id, user_id, intent, expires_at')
      .eq('token_hash', hash)
      .maybeSingle();

    clearCookie();
    if (!row) return null;
    const pending = row as { member_id: string; user_id: string; intent: unknown; expires_at: string };
    if (pending.user_id !== userId) return null;

    // Delete first so the row can only be used once, even under a race.
    const { data: deleted } = await admin
      .from('nexus_pending_links')
      .delete()
      .eq('token_hash', hash)
      .select('token_hash');
    if (!deleted || deleted.length === 0) return null;
    if (Date.parse(pending.expires_at) <= Date.now()) return null;

    const linked = await writeNexusLink(admin, pending.member_id, userId);
    if (!linked) return null;

    const plan = await syncNexusTier(admin, userId, pending.member_id, 2_000);
    return await resolveIntentDestination(admin, userId, parseIntent(pending.intent), plan);
  } catch {
    clearCookie();
    return null;
  }
}
