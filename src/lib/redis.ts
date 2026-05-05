// Singleton Upstash Redis client with feature detection.
//
// When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, returns
// a real Redis client (lazy-initialized once). When they're not, returns
// null so callers can fall back to in-memory implementations — keeps
// local development working without forcing every contributor to set up
// Upstash, while production gets the distributed rate limiter and
// concurrency cap automatically.

import { Redis } from '@upstash/redis';

let cached: Redis | null = null;
let initialized = false;

export function getRedis(): Redis | null {
  if (initialized) return cached;
  initialized = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[redis] UPSTASH_REDIS_REST_URL/TOKEN not set — falling back to in-memory state. Rate limits and concurrency caps will be per-instance only.');
    }
    return null;
  }

  cached = new Redis({ url, token });
  return cached;
}
