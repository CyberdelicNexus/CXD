// Sentry self-correcting loop — static policy config.
//
// These lists drive triage. They are intentionally checked into the repo (not a
// database) so a change to what counts as "critical" or "noise" goes through code
// review like any other guardrail.

/**
 * Critical surfaces: any issue whose culprit / transaction / title matches one of
 * these is treated as HIGH severity and, in later phases, HUMAN-ONLY (never
 * auto-fixed). Match is a case-insensitive substring test against the issue's
 * culprit, transaction, and title.
 *
 * These map to the parts of CXD where a bad automated change is most costly:
 * billing, auth, the Y.Doc save path (site of the July 2026 data-loss incident),
 * and free-tier quota invariants.
 */
export const CRITICAL_SURFACES: { label: string; patterns: string[] }[] = [
  { label: 'billing', patterns: ['stripe', 'api/webhooks/stripe', 'checkout', 'billing', 'credit'] },
  { label: 'auth', patterns: ['auth', 'supabase/ssr', 'getuser', 'session', 'sign-in', 'sign-up'] },
  { label: 'yjs-save', patterns: ['yjs', 'y-doc', 'ydoc', 'reconcile', 'project_data', 'yjs_state', 'y-zustand-bridge'] },
  { label: 'quota', patterns: ['quota', 'quotagovernor', 'plan-limit'] },
];

/**
 * Known-noise patterns: transient/environmental errors that are not product bugs.
 * Matches here are eligible for Tier 0 auto-snooze. Seeded from CXD's own history.
 */
export const KNOWN_NOISE: { label: string; patterns: string[] }[] = [
  // Supabase auth Web-Lock contention. We shipped a getUser() dedup fix; anything
  // that still slips through is transient, not a code bug.
  { label: 'supabase-auth-lock', patterns: ['auth-token', 'another request stole it', 'lock broken', '_acquirelock'] },
  // Code-split chunk fetch failures after a deploy (user on a stale HTML shell).
  { label: 'chunk-load', patterns: ['chunkloaderror', 'loading chunk', 'failed to fetch dynamically imported module', "cannot find module './"] },
  // Benign browser noise.
  { label: 'browser-noise', patterns: ['resizeobserver loop', 'aborterror', 'network request failed', 'load failed'] },
];

/** Substring-match a haystack of issue fields against a pattern group. */
export function matchGroups(
  groups: { label: string; patterns: string[] }[],
  ...fields: (string | null | undefined)[]
): string | null {
  const hay = fields.filter(Boolean).join(' ␟ ').toLowerCase();
  for (const g of groups) {
    if (g.patterns.some((p) => hay.includes(p))) return g.label;
  }
  return null;
}

/**
 * Global kill switch. Set SENTRY_LOOP_ENABLED=false in Vercel env to pause the
 * whole loop (checked as step 0 of the triage function). A runtime-flippable
 * switch (Upstash flag + a /pause Telegram command) is a Phase 2 upgrade; for
 * now this env flag is the backstop.
 */
export function isLoopEnabled(): boolean {
  return process.env.SENTRY_LOOP_ENABLED !== 'false';
}
