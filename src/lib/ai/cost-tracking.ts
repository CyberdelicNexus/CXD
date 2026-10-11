// AI cost monitoring helpers.
//
// Two protections layered on top of the existing monthly credit allowance:
//
// 1. Per-user DAILY safety cap. Even within a user's monthly allowance, no
//    one should burn the whole budget in a single hour. Caps default by
//    plan tier; override via env vars below for tuning without redeploys.
//
// 2. Org-wide DAILY spend alert. The hourly /api/cron/spend-monitor route
//    pulls aggregate usage and fires a Sentry warning if total approximate
//    USD spend exceeds the configured threshold.
//
// Approximate cost: the credit weights in ai-credit-config.ts are designed
// such that 1 credit ≈ $0.0003 of provider API cost regardless of model
// (cheap models cost 1 credit per call, expensive models cost ~35-58, both
// scaled to roughly the same dollar amount per credit). 0.03 cents per
// credit is good enough for budget alerting — not a billing source of truth.

// Measured 2026-10 from real requests: a Claude canvas build costs about
// $0.075 for 8 credits and a chat about $0.02 for 2, so one credit is roughly
// one cent of API cost. The earlier 0.03 (a figure derived from the unused
// per-model credit weights) made the org spend alert under-report by ~30x.
const CENTS_PER_CREDIT_DEFAULT = 1; // $0.01 per credit
export const CENTS_PER_CREDIT = (() => {
  const raw = process.env.AI_CENTS_PER_CREDIT;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : CENTS_PER_CREDIT_DEFAULT;
})();

type PlanId = 'free' | 'pro' | 'lifetime' | 'beta_tester';

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Per-user daily credit cap by plan. Defaults assume the user should spread
 * their monthly allowance over at least ~5 days. Overridable via env vars.
 *
 * Free's signup bonus is 50 credits TOTAL (one-time), so 50 effectively
 * lets them spend it all in one day if they want — that's intended UX.
 */
export function getDailyCreditCap(planId: string): number {
  switch (planId) {
    // 250: half a Pro month in one day. The old 100 stopped a normal working
    // session with the Canvas Assistant (12 builds on Claude, and every refine
    // is a build) while still being far above anything a runaway loop needs
    // to be caught at. Worst case is about $2.50 of API cost per user per day.
    case 'pro':         return intFromEnv('AI_DAILY_CAP_PRO', 250);
    case 'lifetime':    return intFromEnv('AI_DAILY_CAP_LIFETIME', 250);
    case 'beta_tester': return intFromEnv('AI_DAILY_CAP_BETA', 250);
    case 'free':
    default:            return intFromEnv('AI_DAILY_CAP_FREE', 50);
  }
}

/**
 * Threshold (in cents) for the org-wide daily spend Sentry alert.
 * Default $100/day = 10000 cents. Override via env.
 */
export function getOrgDailyAlertCents(): number {
  return intFromEnv('AI_ORG_DAILY_ALERT_CENTS', 10000);
}

export function creditsToCents(credits: number): number {
  return Math.round(credits * CENTS_PER_CREDIT * 100) / 100;
}

export function centsToDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
