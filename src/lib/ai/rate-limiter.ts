// In-memory rate limiter for AI endpoints.
// Tracks request timestamps per user per endpoint type.
//
// LIMITATION: in-memory means each Vercel instance has its own counter,
// so under autoscale the effective limit = configured × instance_count.
// Fine at low scale (single instance). Replace with Upstash Redis sliding
// window when Phase 3 lands.

type EndpointType = "chat" | "analysis";

const WINDOW_MS = 60_000;

// Per-plan request budgets per endpoint per minute. Tunable via env vars
// without redeploys.
function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

interface TierLimits {
  chat: number;
  analysis: number;
}

function tierLimits(planId: string): TierLimits {
  switch (planId) {
    case 'pro':
      return {
        chat:     intFromEnv('AI_RATE_CHAT_PRO',     30),
        analysis: intFromEnv('AI_RATE_ANALYSIS_PRO',  5),
      };
    case 'lifetime':
      return {
        chat:     intFromEnv('AI_RATE_CHAT_LIFETIME',     60),
        analysis: intFromEnv('AI_RATE_ANALYSIS_LIFETIME', 10),
      };
    case 'beta_tester':
      return {
        chat:     intFromEnv('AI_RATE_CHAT_BETA',     30),
        analysis: intFromEnv('AI_RATE_ANALYSIS_BETA',  5),
      };
    case 'free':
    default:
      return {
        chat:     intFromEnv('AI_RATE_CHAT_FREE',     5),
        analysis: intFromEnv('AI_RATE_ANALYSIS_FREE', 1),
      };
  }
}

const requestLog = new Map<string, number[]>();

function getKey(userId: string, endpoint: EndpointType): string {
  return `${userId}:${endpoint}`;
}

/**
 * Check if a user is rate-limited for an endpoint type, scoped to their
 * plan tier. Returns { allowed: true } or { allowed: false, retryAfterMs }.
 *
 * Pass the user's plan_id ('free' | 'pro' | 'lifetime' | 'beta_tester').
 * Unknown plans fall back to free limits.
 */
export function checkRateLimit(
  userId: string,
  endpoint: EndpointType,
  planId: string = 'free',
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const key = getKey(userId, endpoint);
  const maxRequests = tierLimits(planId)[endpoint];
  const now = Date.now();

  // Get existing timestamps, filter to current window
  const timestamps = (requestLog.get(key) || []).filter(
    (t) => now - t < WINDOW_MS,
  );

  if (timestamps.length >= maxRequests) {
    const oldestInWindow = timestamps[0];
    const retryAfterMs = WINDOW_MS - (now - oldestInWindow);
    return { allowed: false, retryAfterMs };
  }

  return { allowed: true };
}

/**
 * Record a request for rate-limiting purposes.
 * Call this AFTER a successful check.
 */
export function recordRequest(userId: string, endpoint: EndpointType): void {
  const key = getKey(userId, endpoint);
  const now = Date.now();

  const timestamps = (requestLog.get(key) || []).filter(
    (t) => now - t < WINDOW_MS,
  );
  timestamps.push(now);
  requestLog.set(key, timestamps);
}

// Periodic cleanup to prevent memory leaks (every 5 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    const keys = Array.from(requestLog.keys());
    for (const key of keys) {
      const timestamps = requestLog.get(key) || [];
      const filtered = timestamps.filter((t: number) => now - t < 120_000);
      if (filtered.length === 0) {
        requestLog.delete(key);
      } else {
        requestLog.set(key, filtered);
      }
    }
  }, 300_000);
}

// ---------------------------------------------------------------------------
// Concurrent stream cap (cost-runaway protection)
// A single scripted user can otherwise hold many streams open in parallel
// and burn through your AI provider budget. This caps in-flight AI requests
// per user. In-memory; per Vercel instance — fine at low scale, replace with
// Redis when autoscaling kicks in.
// ---------------------------------------------------------------------------

const MAX_CONCURRENT_AI_REQUESTS_PER_USER = 2;
const concurrentRequests = new Map<string, number>();

export function acquireConcurrencySlot(userId: string): boolean {
  const current = concurrentRequests.get(userId) || 0;
  if (current >= MAX_CONCURRENT_AI_REQUESTS_PER_USER) return false;
  concurrentRequests.set(userId, current + 1);
  return true;
}

export function releaseConcurrencySlot(userId: string): void {
  const current = concurrentRequests.get(userId) || 0;
  if (current <= 1) {
    concurrentRequests.delete(userId);
  } else {
    concurrentRequests.set(userId, current - 1);
  }
}
