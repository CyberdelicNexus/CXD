/**
 * Bridge token verification (PS2_CANVAS_BRIDGE.md B1).
 *
 * Verifies the `x-bridge-token` request header against `BRIDGE_TOKEN` and,
 * during a rotation window, `BRIDGE_TOKEN_PREVIOUS` — using a timing-safe
 * comparison so response latency can't be used to guess the secret byte by
 * byte. NEVER log the header value or the env values — callers must not
 * either. This module only returns a boolean-shaped result, never the
 * secret itself.
 */

import { timingSafeEqual } from 'crypto';

/**
 * Timing-safe string equality.
 *
 * `crypto.timingSafeEqual` throws if the two buffers differ in length,
 * which would leak a length mismatch via a distinct code path (and,
 * depending on call site, a different exception-handling timing profile).
 * We avoid that by comparing against a same-length filler buffer whenever
 * lengths differ, so the function always performs a full-length constant-time
 * compare before returning — no early exit on length alone.
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');

  if (aBuf.length !== bBuf.length) {
    // Run a same-shape compare so this branch isn't measurably faster than
    // the equal-length path below; the result is discarded — always false.
    const filler = Buffer.alloc(aBuf.length);
    timingSafeEqual(aBuf, filler);
    return false;
  }

  return timingSafeEqual(aBuf, bBuf);
}

export type BridgeTokenCheck =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'invalid' | 'not_configured' };

/**
 * Verify a bridge auth header value against `BRIDGE_TOKEN` / `BRIDGE_TOKEN_PREVIOUS`.
 *
 * Pass the raw `x-bridge-token` header value (or null/undefined if absent).
 * Checks the current token first, then the previous token (rotation overlap
 * window, PS2 B1) if the current one doesn't match. Never throws.
 */
export function verifyBridgeToken(headerValue: string | null | undefined): BridgeTokenCheck {
  const current = process.env.BRIDGE_TOKEN;
  if (!current) {
    // Misconfigured server — fail closed, not open.
    return { ok: false, reason: 'not_configured' };
  }
  if (!headerValue) {
    return { ok: false, reason: 'missing' };
  }

  if (timingSafeStringEqual(headerValue, current)) {
    return { ok: true };
  }

  const previous = process.env.BRIDGE_TOKEN_PREVIOUS;
  if (previous && timingSafeStringEqual(headerValue, previous)) {
    return { ok: true };
  }

  return { ok: false, reason: 'invalid' };
}
