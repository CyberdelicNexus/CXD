/**
 * Server-side Nexus bridge helpers: JWKS, the jti store, user resolution,
 * tier sync and intent destinations (D182 §3, §5). Service-role only — never
 * import from client code. Never log tokens, emails or payloads.
 */

import { randomUUID } from 'crypto';
import { createRemoteJWKSet } from 'jose';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getTierReadConfig } from './config';
import type { HandoffClaims, JtiStore, NexusIntent } from './handoff';
import {
  buildNewProjectRow,
  destinationForNewProject,
  destinationForProject,
  isAtCanvasLimit,
  UPGRADE_DESTINATION,
} from './listing';
import {
  decideTierSync,
  isTierCheckDue,
  parseTierResponse,
  type NexusTierAnswer,
  type SubscriptionSyncRow,
} from './tier';

// ---------------------------------------------------------------------------
// JWKS (cached per URL; an unknown kid refetches at most once a minute)
// ---------------------------------------------------------------------------

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export function getNexusJwks(jwksUrl: string) {
  let jwks = jwksCache.get(jwksUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUrl), { cooldownDuration: 60_000, timeoutDuration: 3_000 });
    jwksCache.set(jwksUrl, jwks);
  }
  return jwks;
}

// ---------------------------------------------------------------------------
// Single-use jti store backed by nexus_handoff_jti
// ---------------------------------------------------------------------------

const PURGE_AFTER_MS = 24 * 60 * 60 * 1000;

export function supabaseJtiStore(admin: SupabaseClient): JtiStore {
  return {
    async claim(jti, expiresAt) {
      const { error } = await admin
        .from('nexus_handoff_jti')
        .insert({ jti, expires_at: expiresAt.toISOString() });
      if (error) {
        if (error.code === '23505') return 'replayed';
        throw new Error(`nexus_handoff_jti insert failed (${error.code ?? 'unknown'})`);
      }
      return 'ok';
    },
  };
}

/** Best effort: drop jti rows older than a day and expired pending links. */
export async function purgeExpiredNexusRows(admin: SupabaseClient, now = new Date()): Promise<void> {
  try {
    await Promise.all([
      admin
        .from('nexus_handoff_jti')
        .delete()
        .lt('expires_at', new Date(now.getTime() - PURGE_AFTER_MS).toISOString()),
      admin.from('nexus_pending_links').delete().lt('expires_at', now.toISOString()),
    ]);
  } catch {
    // Opportunistic only.
  }
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export async function getLinkedMemberId(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await admin
    .from('nexus_links')
    .select('member_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { member_id: string }).member_id;
}

/** Insert a link. true when the pair is (now) linked; false on a conflict with another pair. */
export async function writeNexusLink(admin: SupabaseClient, memberId: string, userId: string): Promise<boolean> {
  const { error } = await admin.from('nexus_links').insert({ member_id: memberId, user_id: userId });
  if (!error) return true;
  if (error.code !== '23505') return false;
  const { data } = await admin
    .from('nexus_links')
    .select('member_id, user_id')
    .eq('member_id', memberId)
    .maybeSingle();
  return Boolean(data && (data as { user_id: string }).user_id === userId);
}

export type ResolveUserResult =
  | { kind: 'user'; userId: string }
  | { kind: 'pending'; userId: string }
  | { kind: 'error'; code: 'link_conflict' | 'failed' };

/** §3 step 3: linked member → that user; confirmed email → link; unconfirmed → pending; none → create. */
export async function resolveCanvasUser(admin: SupabaseClient, claims: HandoffClaims): Promise<ResolveUserResult> {
  const { data: link, error: linkError } = await admin
    .from('nexus_links')
    .select('user_id')
    .eq('member_id', claims.memberId)
    .maybeSingle();
  if (linkError) return { kind: 'error', code: 'failed' };
  if (link) return { kind: 'user', userId: (link as { user_id: string }).user_id };

  const { data: found, error: findError } = await admin.rpc('nexus_find_auth_user', { p_email: claims.email });
  if (findError) return { kind: 'error', code: 'failed' };
  const match = (Array.isArray(found) ? found[0] : found) as
    | { id: string; email_confirmed_at: string | null }
    | undefined
    | null;

  if (match?.id) {
    const { data: otherLink, error: otherError } = await admin
      .from('nexus_links')
      .select('member_id')
      .eq('user_id', match.id)
      .maybeSingle();
    if (otherError) return { kind: 'error', code: 'failed' };
    if (otherLink) return { kind: 'error', code: 'link_conflict' };

    if (!match.email_confirmed_at) return { kind: 'pending', userId: match.id };

    const linked = await writeNexusLink(admin, claims.memberId, match.id);
    return linked ? { kind: 'user', userId: match.id } : { kind: 'error', code: 'link_conflict' };
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: claims.email,
    email_confirm: true,
    user_metadata: { full_name: claims.name ?? undefined, source: 'nexus' },
  });
  if (createError || !created?.user) return { kind: 'error', code: 'failed' };

  const linked = await writeNexusLink(admin, claims.memberId, created.user.id);
  return linked ? { kind: 'user', userId: created.user.id } : { kind: 'error', code: 'link_conflict' };
}

// ---------------------------------------------------------------------------
// Tier read + sync
// ---------------------------------------------------------------------------

export async function fetchNexusTier(memberId: string, timeoutMs: number): Promise<NexusTierAnswer> {
  const config = getTierReadConfig();
  if (!config) return { ok: false };
  const url = new URL(config.url);
  url.searchParams.set('member', memberId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.credential}`, Accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    });
    let body: unknown = null;
    if (res.status === 200) {
      const text = await res.text();
      if (text.length <= 4096) {
        try {
          body = JSON.parse(text);
        } catch {
          body = null;
        }
      }
    }
    return parseTierResponse(res.status, body);
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

const SYNC_COLUMNS = 'plan_id, status, stripe_subscription_id, plan_source, nexus_checked_at';

/**
 * Read the member's tier from Nexus and apply the §5 rule to the user's
 * subscriptions row. Returns the plan after the sync, or the current plan when
 * nothing changed. Never throws and never downgrades on a failed read.
 */
export async function syncNexusTier(
  admin: SupabaseClient,
  userId: string,
  memberId: string,
  timeoutMs: number,
): Promise<string | null> {
  try {
    const { data: row, error } = await admin
      .from('subscriptions')
      .select(SYNC_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !row) return null;
    const current = row as SubscriptionSyncRow;

    const answer = await fetchNexusTier(memberId, timeoutMs);
    const decision = decideTierSync(current, answer, new Date());
    if (!decision.patch) return current.plan_id;

    const { error: updateError } = await admin.from('subscriptions').update(decision.patch).eq('user_id', userId);
    if (updateError) {
      console.error('[nexus] tier sync update failed', updateError.code);
      return current.plan_id;
    }
    return decision.planAfter;
  } catch {
    return null;
  }
}

export async function getPlanId(admin: SupabaseClient, userId: string): Promise<string> {
  const { data } = await admin.from('subscriptions').select('plan_id').eq('user_id', userId).maybeSingle();
  return (data as { plan_id?: string } | null)?.plan_id || 'free';
}

// ---------------------------------------------------------------------------
// Intent destinations
// ---------------------------------------------------------------------------

export async function userCanOpenProject(admin: SupabaseClient, userId: string, projectId: string): Promise<boolean> {
  const { data: project } = await admin
    .from('cxd_projects')
    .select('owner_id')
    .eq('id', projectId)
    .maybeSingle();
  if (!project) return false;
  if ((project as { owner_id: string }).owner_id === userId) return true;
  const { data: collab } = await admin
    .from('canvas_collaborators')
    .select('id')
    .eq('canvas_id', projectId)
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(collab);
}

export async function countOwnedProjects(admin: SupabaseClient, userId: string): Promise<number | null> {
  const { count, error } = await admin
    .from('cxd_projects')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId);
  if (error) return null;
  return count ?? 0;
}

/** §3 step 6. Always returns a same-origin path; falls back to /dashboard. */
export async function resolveIntentDestination(
  admin: SupabaseClient,
  userId: string,
  intent: NexusIntent,
  planId: string | null,
): Promise<string> {
  try {
    if (intent.go === 'project') {
      return destinationForProject(intent.id, await userCanOpenProject(admin, userId, intent.id));
    }
    if (intent.go === 'new') {
      const owned = await countOwnedProjects(admin, userId);
      if (owned === null) return '/dashboard';
      const plan = planId ?? (await getPlanId(admin, userId));
      if (isAtCanvasLimit(plan, owned)) return UPGRADE_DESTINATION;
      const id = randomUUID();
      const { error } = await admin.from('cxd_projects').insert(buildNewProjectRow(id, intent.name, userId));
      if (error) {
        console.error('[nexus] new project insert failed', error.code);
        return '/dashboard';
      }
      return destinationForNewProject(id);
    }
  } catch {
    return '/dashboard';
  }
  return '/dashboard';
}

const TIER_REFRESH_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * For GET /api/projects: refresh a linked user's tier when the last check is
 * older than an hour. Skipped while the tier read is unconfigured; bounded by
 * a 2 s read; never throws.
 */
export async function refreshNexusTierIfDue(admin: SupabaseClient, userId: string): Promise<void> {
  try {
    if (!getTierReadConfig()) return;
    const memberId = await getLinkedMemberId(admin, userId);
    if (!memberId) return;
    const { data } = await admin
      .from('subscriptions')
      .select('nexus_checked_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) return;
    const checkedAt = (data as { nexus_checked_at: string | null }).nexus_checked_at;
    if (!isTierCheckDue(checkedAt, new Date(), TIER_REFRESH_MAX_AGE_MS)) return;
    await syncNexusTier(admin, userId, memberId, 2_000);
  } catch {
    // Never fail the listing.
  }
}
