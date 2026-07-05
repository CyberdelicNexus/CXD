/**
 * Per-token rate limiting for POST /api/bridge/task-writeback (PS2_CANVAS_BRIDGE.md B6).
 *
 * Reuses the same primitive as src/lib/ai/rate-limiter.ts: Upstash Redis
 * sliding-window when configured (correct under Vercel autoscale), in-memory
 * fallback otherwise (correct on a single instance only — acceptable for
 * this low-volume, single-tenant-pilot endpoint; document the caveat rather
 * than pretend it's distributed when Redis isn't configured).
 *
 * Default: 60 requests/minute per token. Override via BRIDGE_RATE_LIMIT_PER_MIN.
 */

import { createHash } from 'crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { getRedis } from '@/lib/redis';

const WINDOW_MS = 60_000;
const DEFAULT_MAX_PER_MIN = 60;

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Never use the raw bridge token as a Redis/in-memory map key — hash it so
 * the secret never appears in Redis key listings, logs, or memory dumps.
 */
function keyFor(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ---------------------------------------------------------------------------
// Upstash Ratelimit (distributed) — recreated only when the configured max
// changes (env override), mirroring src/lib/ai/rate-limiter.ts's cache-by-limit
// approach.
// ---------------------------------------------------------------------------
let cachedLimiter: Ratelimit | null = null;
let cachedMax = -1;

function getLimiter(maxRequests: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!cachedLimiter || cachedMax !== maxRequests) {
    cachedLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, '1 m'),
      prefix: 'cxd:bridge-rl',
      analytics: false,
    });
    cachedMax = maxRequests;
  }
  return cachedLimiter;
}

// ---------------------------------------------------------------------------
// In-memory fallback (per-instance only)
// ---------------------------------------------------------------------------
const inMemoryLog = new Map<string, number[]>();

function inMemoryCheck(key: string, maxRequests: number): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const timestamps = (inMemoryLog.get(key) || []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= maxRequests) {
    const oldestInWindow = timestamps[0];
    return { allowed: false, retryAfterMs: WINDOW_MS - (now - oldestInWindow) };
  }

  timestamps.push(now);
  inMemoryLog.set(key, timestamps);
  return { allowed: true };
}

// Periodic cleanup so the in-memory map doesn't grow unbounded (mirrors
// src/lib/rate-limiter.ts / src/lib/ai/rate-limiter.ts).
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    const keys = Array.from(inMemoryLog.keys());
    for (const key of keys) {
      const filtered = (inMemoryLog.get(key) || []).filter((t) => now - t < WINDOW_MS);
      if (filtered.length === 0) inMemoryLog.delete(key);
      else inMemoryLog.set(key, filtered);
    }
  }, 300_000);
}

/**
 * Check + record a request against the per-token sliding window.
 * Returns `{ allowed: false, retryAfterMs }` when the caller should get a 429.
 */
export async function checkBridgeRateLimit(
  token: string,
): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const max = intFromEnv('BRIDGE_RATE_LIMIT_PER_MIN', DEFAULT_MAX_PER_MIN);
  const key = keyFor(token);
  const limiter = getLimiter(max);

  if (limiter) {
    try {
      const { success, reset } = await limiter.limit(key);
      if (!success) {
        return { allowed: false, retryAfterMs: Math.max(0, reset - Date.now()) };
      }
      return { allowed: true };
    } catch (err) {
      console.warn('[bridge-rate-limit] Redis check failed, falling back to in-memory', err);
    }
  }

  return inMemoryCheck(key, max);
}
