/**
 * Nexus tier → Canvas plan, and the tier sync rule (D182 §4, §5). Pure.
 */

import { isNexusTier, type NexusTier } from './handoff';

export type NexusTierAnswer =
  | { ok: true; tier: NexusTier; active: boolean }
  | { ok: false };

/**
 * The "Back to Cyberdelic Nexus" button is for current members only: a successful tier read
 * that says the membership is active (D76). A failed read hides it.
 */
export function showsNexusReturn(answer: NexusTierAnswer): boolean {
  return answer.ok && answer.active;
}

/** Parse a GET /api/handoff/tier response. Anything but a well-formed 200 is a failure. */
export function parseTierResponse(status: number, body: unknown): NexusTierAnswer {
  if (status !== 200 || !body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false };
  }
  const { tier, active } = body as Record<string, unknown>;
  if (!isNexusTier(tier) || typeof active !== 'boolean') return { ok: false };
  return { ok: true, tier, active };
}

const PRO_TIERS: readonly NexusTier[] = ['hacker', 'weaver', 'lifetime'];

/** active && tier in (hacker, weaver, lifetime) → pro; anything else → free (D45, D60). */
export function canvasPlanForTier(answer: { tier: NexusTier; active: boolean }): 'pro' | 'free' {
  return answer.active && PRO_TIERS.includes(answer.tier) ? 'pro' : 'free';
}

export interface SubscriptionSyncRow {
  plan_id: string;
  status: string;
  stripe_subscription_id: string | null;
  plan_source: string | null;
}

export interface TierSyncPatch {
  plan_id?: 'pro' | 'free';
  status?: 'active';
  plan_source?: 'nexus' | null;
  nexus_checked_at?: string;
}

export type TierSyncOutcome =
  | 'no_change' // Nexus failed: nothing is written
  | 'protected' // Stripe / lifetime / beta plan: only nexus_checked_at
  | 'granted_pro'
  | 'revoked_to_free'
  | 'stays_free';

export interface TierSyncDecision {
  outcome: TierSyncOutcome;
  /** null when nothing should be written. */
  patch: TierSyncPatch | null;
  /** The plan_id the row has after the patch. */
  planAfter: string;
}

function isProtected(row: SubscriptionSyncRow): boolean {
  const activeStripe =
    row.stripe_subscription_id != null && (row.status === 'active' || row.status === 'trialing');
  const ownedPlan =
    (row.plan_id === 'lifetime' || row.plan_id === 'beta_tester') && row.plan_source !== 'nexus';
  return activeStripe || ownedPlan || row.plan_source === 'admin';
}

/**
 * The §5 rule table. plan_id is only put in the patch when it changes, because
 * the on_subscription_change trigger fires on any UPDATE OF plan_id and resets
 * the monthly credit allowance.
 */
export function decideTierSync(
  row: SubscriptionSyncRow,
  answer: NexusTierAnswer,
  now: Date,
): TierSyncDecision {
  if (!answer.ok) return { outcome: 'no_change', patch: null, planAfter: row.plan_id };

  const checkedAt = now.toISOString();

  if (isProtected(row)) {
    return { outcome: 'protected', patch: { nexus_checked_at: checkedAt }, planAfter: row.plan_id };
  }

  if (canvasPlanForTier(answer) === 'pro') {
    const patch: TierSyncPatch = { status: 'active', plan_source: 'nexus', nexus_checked_at: checkedAt };
    if (row.plan_id !== 'pro') patch.plan_id = 'pro';
    return { outcome: 'granted_pro', patch, planAfter: 'pro' };
  }

  if (row.plan_source === 'nexus') {
    const patch: TierSyncPatch = { status: 'active', plan_source: null, nexus_checked_at: checkedAt };
    if (row.plan_id !== 'free') patch.plan_id = 'free';
    return { outcome: 'revoked_to_free', patch, planAfter: 'free' };
  }

  return { outcome: 'stays_free', patch: { nexus_checked_at: checkedAt }, planAfter: row.plan_id };
}

/** Whether a linked user's tier is due for a refresh (older than maxAgeMs, or never checked). */
export function isTierCheckDue(nexusCheckedAt: string | null | undefined, now: Date, maxAgeMs: number): boolean {
  if (!nexusCheckedAt) return true;
  const t = Date.parse(nexusCheckedAt);
  if (!Number.isFinite(t)) return true;
  return now.getTime() - t > maxAgeMs;
}
