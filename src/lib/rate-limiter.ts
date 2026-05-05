// General-purpose in-memory rate limiter for auth and checkout endpoints.
// Tracks request timestamps per key per endpoint type.
// Can be upgraded to Redis for multi-instance deployments.

type EndpointType = 'sign-in' | 'sign-up' | 'forgot-password' | 'checkout';

const LIMITS: Record<EndpointType, { windowMs: number; maxRequests: number }> = {
  'sign-in': { windowMs: 900_000, maxRequests: 5 },          // 5 per 15 min
  'sign-up': { windowMs: 3_600_000, maxRequests: 3 },        // 3 per hour
  'forgot-password': { windowMs: 3_600_000, maxRequests: 3 }, // 3 per hour
  'checkout': { windowMs: 3_600_000, maxRequests: 10 },      // 10 per hour
};

const requestLog = new Map<string, number[]>();

function getKey(key: string, endpoint: EndpointType): string {
  return `${key}:${endpoint}`;
}

/**
 * Check if a key (IP or user ID) is rate-limited for an endpoint type.
 * Also records the request if allowed.
 * Returns { allowed: true } or { allowed: false, retryAfter: number (ms) }.
 */
export function checkRateLimit(
  key: string,
  endpoint: EndpointType,
): { allowed: boolean; retryAfter?: number } {
  const compositeKey = getKey(key, endpoint);
  const limit = LIMITS[endpoint];
  const now = Date.now();

  // Get existing timestamps, filter to current window
  const timestamps = (requestLog.get(compositeKey) || []).filter(
    (t) => now - t < limit.windowMs,
  );

  if (timestamps.length >= limit.maxRequests) {
    const oldestInWindow = timestamps[0];
    const retryAfter = limit.windowMs - (now - oldestInWindow);
    requestLog.set(compositeKey, timestamps);
    return { allowed: false, retryAfter };
  }

  // Record this request
  timestamps.push(now);
  requestLog.set(compositeKey, timestamps);
  return { allowed: true };
}

// Periodic cleanup to prevent memory leaks (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    const maxWindow = 3_600_000; // 1 hour (largest window)
    const keys = Array.from(requestLog.keys());
    for (const key of keys) {
      const timestamps = requestLog.get(key) || [];
      const filtered = timestamps.filter((t: number) => now - t < maxWindow);
      if (filtered.length === 0) {
        requestLog.delete(key);
      } else {
        requestLog.set(key, filtered);
      }
    }
  }, 300_000);
}
