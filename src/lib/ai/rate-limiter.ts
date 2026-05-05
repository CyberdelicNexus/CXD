// In-memory rate limiter for AI endpoints.
// Tracks request timestamps per user per endpoint type.

type EndpointType = "chat" | "analysis";

const LIMITS: Record<EndpointType, { windowMs: number; maxRequests: number }> = {
  chat: { windowMs: 60_000, maxRequests: 20 },
  analysis: { windowMs: 60_000, maxRequests: 5 },
};

const requestLog = new Map<string, number[]>();

function getKey(userId: string, endpoint: EndpointType): string {
  return `${userId}:${endpoint}`;
}

/**
 * Check if a user is rate-limited for an endpoint type.
 * Returns { allowed: true } or { allowed: false, retryAfterMs }.
 */
export function checkRateLimit(
  userId: string,
  endpoint: EndpointType,
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const key = getKey(userId, endpoint);
  const limit = LIMITS[endpoint];
  const now = Date.now();

  // Get existing timestamps, filter to current window
  const timestamps = (requestLog.get(key) || []).filter(
    (t) => now - t < limit.windowMs,
  );

  if (timestamps.length >= limit.maxRequests) {
    const oldestInWindow = timestamps[0];
    const retryAfterMs = limit.windowMs - (now - oldestInWindow);
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
  const limit = LIMITS[endpoint];

  const timestamps = (requestLog.get(key) || []).filter(
    (t) => now - t < limit.windowMs,
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
