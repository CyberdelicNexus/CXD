// AI rate limiter with two-mode operation:
//
// 1. Upstash Redis (distributed) — when UPSTASH_REDIS_REST_URL + TOKEN are
//    set. Sliding-window via @upstash/ratelimit. Correct under autoscale.
// 2. In-memory fallback — when Redis isn't configured. Correct on a single
//    Vercel instance only; under autoscale the effective limit becomes
//    configured × instance_count. Fine for local dev or low-traffic prod.
//
// Both modes share the same async API. Callers pass the user's plan_id to
// pick the per-tier limit. Same module also gates concurrent in-flight
// requests per user (cost-runaway protection).

import { Ratelimit } from '@upstash/ratelimit';
import { getRedis } from '@/lib/redis';

type EndpointType = 'chat' | 'analysis';

const WINDOW_MS = 60_000;

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

// ---------------------------------------------------------------------------
// Upstash Ratelimit cache: one instance per (limit, endpoint) so we re-use
// the underlying script. Created lazily.
// ---------------------------------------------------------------------------
const limiterCache = new Map<string, Ratelimit>();

function getLimiter(maxRequests: number, endpoint: EndpointType): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const key = `${endpoint}:${maxRequests}`;
  let cached = limiterCache.get(key);
  if (!cached) {
    cached = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, '1 m'),
      prefix: `cxd:ai-rl:${endpoint}`,
      analytics: false,
    });
    limiterCache.set(key, cached);
  }
  return cached;
}

// ---------------------------------------------------------------------------
// In-memory fallback (per-instance only)
// ---------------------------------------------------------------------------
const inMemoryLog = new Map<string, number[]>();

function inMemoryCheck(
  userId: string,
  endpoint: EndpointType,
  maxRequests: number,
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const key = `${userId}:${endpoint}`;
  const now = Date.now();
  const timestamps = (inMemoryLog.get(key) || []).filter(
    (t) => now - t < WINDOW_MS,
  );
  if (timestamps.length >= maxRequests) {
    const oldestInWindow = timestamps[0];
    return { allowed: false, retryAfterMs: WINDOW_MS - (now - oldestInWindow) };
  }
  return { allowed: true };
}

function inMemoryRecord(userId: string, endpoint: EndpointType): void {
  const key = `${userId}:${endpoint}`;
  const now = Date.now();
  const timestamps = (inMemoryLog.get(key) || []).filter(
    (t) => now - t < WINDOW_MS,
  );
  timestamps.push(now);
  inMemoryLog.set(key, timestamps);
}

// In-memory cleanup (only relevant when Redis isn't configured)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    const keys = Array.from(inMemoryLog.keys());
    for (const key of keys) {
      const timestamps = inMemoryLog.get(key) || [];
      const filtered = timestamps.filter((t: number) => now - t < 120_000);
      if (filtered.length === 0) inMemoryLog.delete(key);
      else inMemoryLog.set(key, filtered);
    }
  }, 300_000);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if a user is rate-limited for an endpoint, scoped to their plan tier.
 * Distributed via Redis when configured, in-memory fallback otherwise.
 *
 * Pass the user's plan_id ('free' | 'pro' | 'lifetime' | 'beta_tester').
 * Unknown plans fall back to free limits.
 */
export async function checkRateLimit(
  userId: string,
  endpoint: EndpointType,
  planId: string = 'free',
): Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }> {
  const maxRequests = tierLimits(planId)[endpoint];
  const limiter = getLimiter(maxRequests, endpoint);

  if (limiter) {
    try {
      const { success, reset } = await limiter.limit(userId);
      if (!success) {
        return { allowed: false, retryAfterMs: Math.max(0, reset - Date.now()) };
      }
      return { allowed: true };
    } catch (err) {
      // Redis hiccup — fall back to in-memory rather than DDoS ourselves.
      console.warn('[rate-limiter] Redis check failed, falling back to in-memory', err);
    }
  }

  return inMemoryCheck(userId, endpoint, maxRequests);
}

/**
 * Record a request for rate-limiting purposes.
 *
 * No-op when running with Upstash (the limit() call already counts the
 * request atomically). Kept for in-memory mode and call-site compatibility.
 */
export function recordRequest(userId: string, endpoint: EndpointType): void {
  if (getRedis()) return; // Upstash counts on .limit() — nothing to do.
  inMemoryRecord(userId, endpoint);
}

// ---------------------------------------------------------------------------
// Concurrent in-flight cap (per user)
// ---------------------------------------------------------------------------

const MAX_CONCURRENT_AI_REQUESTS_PER_USER = 2;
const CONCURRENCY_TTL_SECONDS = 90; // safety: stale slots auto-expire if release fails
const inMemoryConcurrent = new Map<string, number>();

/**
 * Try to acquire a concurrent-request slot for the user.
 * Returns true on success, false if the user is at their cap.
 *
 * In Redis mode: INCR a per-user counter with TTL. If post-incr value
 * exceeds the cap, DECR back and refuse.
 */
export async function acquireConcurrencySlot(userId: string): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    const key = `cxd:ai-conc:${userId}`;
    try {
      const after = await redis.incr(key);
      if (after === 1) {
        // First holder — set TTL so a crashed handler doesn't pin the slot forever
        await redis.expire(key, CONCURRENCY_TTL_SECONDS);
      }
      if (after > MAX_CONCURRENT_AI_REQUESTS_PER_USER) {
        await redis.decr(key); // give the slot back; we're refusing
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[rate-limiter] Redis concurrency check failed, falling back', err);
    }
  }

  const current = inMemoryConcurrent.get(userId) || 0;
  if (current >= MAX_CONCURRENT_AI_REQUESTS_PER_USER) return false;
  inMemoryConcurrent.set(userId, current + 1);
  return true;
}

export async function releaseConcurrencySlot(userId: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      const after = await redis.decr(`cxd:ai-conc:${userId}`);
      // Don't go negative if release is called more times than acquire (defensive).
      if (after < 0) await redis.set(`cxd:ai-conc:${userId}`, 0, { ex: CONCURRENCY_TTL_SECONDS });
      return;
    } catch (err) {
      console.warn('[rate-limiter] Redis concurrency release failed, falling back', err);
    }
  }

  const current = inMemoryConcurrent.get(userId) || 0;
  if (current <= 1) inMemoryConcurrent.delete(userId);
  else inMemoryConcurrent.set(userId, current - 1);
}
