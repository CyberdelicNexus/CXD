/**
 * Nexus handoff token: verification, single-use claim and intent parsing.
 *
 * Contract: D182 §1 and §3 (the platform at NEXUS_ISSUER signs, the Canvas
 * verifies). Everything here is pure or takes its dependencies (key, clock,
 * jti store) as arguments, so src/lib/nexus/__verify__ can exercise it without
 * a network or a database. Never log the token, the email or the payload.
 */

import { errors, jwtVerify } from 'jose';

export const HANDOFF_AUDIENCE = 'cxd-canvas';
export const HANDOFF_ALGORITHM = 'ES256';
export const HANDOFF_MAX_AGE_SECONDS = 60;
const MAX_TOKEN_LENGTH = 4096;
export const MAX_PROJECT_NAME_LENGTH = 120;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// C0 controls, DEL and C1 controls.
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F-\u009F]/;

export const NEXUS_TIERS = ['cybernaut', 'hacker', 'weaver', 'lifetime'] as const;
export type NexusTier = (typeof NEXUS_TIERS)[number];

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function isNexusTier(value: unknown): value is NexusTier {
  return typeof value === 'string' && (NEXUS_TIERS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Intent (`cxd` claim)
// ---------------------------------------------------------------------------

export type NexusIntent =
  | { go: 'dashboard' }
  | { go: 'project'; id: string }
  | { go: 'new'; name: string };

const DASHBOARD: NexusIntent = { go: 'dashboard' };

/**
 * Strict parse of the `cxd` claim. Anything unknown or malformed falls back to
 * the dashboard; it never throws.
 */
export function parseIntent(raw: unknown): NexusIntent {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return DASHBOARD;
  const obj = raw as Record<string, unknown>;

  if (obj.go === 'project') {
    return isUuid(obj.id) ? { go: 'project', id: obj.id.toLowerCase() } : DASHBOARD;
  }

  if (obj.go === 'new') {
    const name = normalizeProjectName(obj.name);
    return name ? { go: 'new', name } : DASHBOARD;
  }

  return DASHBOARD;
}

/** 1-120 characters after trimming, no control characters; otherwise null. */
export function normalizeProjectName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim();
  const length = Array.from(name).length;
  if (length < 1 || length > MAX_PROJECT_NAME_LENGTH) return null;
  if (CONTROL_CHARS_RE.test(name)) return null;
  return name;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export interface HandoffClaims {
  memberId: string;
  email: string;
  name: string | null;
  tier: NexusTier | null;
  jti: string;
  expiresAt: Date;
  intent: NexusIntent;
}

export type HandoffErrorCode = 'invalid' | 'expired' | 'replayed' | 'unavailable';

export type VerifyResult =
  | { ok: true; claims: HandoffClaims }
  | { ok: false; code: HandoffErrorCode };

/** A public key, a JWKS resolver (createRemoteJWKSet) or anything jwtVerify accepts. */
export type HandoffKey = Parameters<typeof jwtVerify>[1];

export interface VerifyOptions {
  issuer: string;
  /** Injected clock for tests. */
  currentDate?: Date;
}

export async function verifyHandoffToken(
  token: unknown,
  key: HandoffKey,
  opts: VerifyOptions,
): Promise<VerifyResult> {
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    return { ok: false, code: 'invalid' };
  }
  if (token.split('.').length !== 3) return { ok: false, code: 'invalid' };

  let payload: Record<string, unknown>;
  try {
    // The algorithm is pinned here; the header's `alg` is never trusted.
    const result = await jwtVerify(token, key as never, {
      algorithms: [HANDOFF_ALGORITHM],
      issuer: opts.issuer,
      audience: HANDOFF_AUDIENCE,
      typ: 'JWT',
      maxTokenAge: `${HANDOFF_MAX_AGE_SECONDS}s`,
      requiredClaims: ['jti', 'sub', 'exp', 'iat', 'email'],
      currentDate: opts.currentDate,
    });
    payload = result.payload as Record<string, unknown>;
  } catch (err) {
    if (err instanceof errors.JWTExpired) return { ok: false, code: 'expired' };
    if (err instanceof errors.JWTClaimValidationFailed && err.claim === 'iat') {
      // maxTokenAge exceeded (or iat in the future).
      return { ok: false, code: 'expired' };
    }
    // A JWKS fetch that times out or fails at the network level is not the
    // token's fault: say "unavailable" rather than "invalid".
    if (err instanceof errors.JWKSTimeout || !(err instanceof errors.JOSEError)) {
      return { ok: false, code: 'unavailable' };
    }
    return { ok: false, code: 'invalid' };
  }

  const { sub, email, email_verified, name, tier, jti, iat, exp } = payload;

  if (!isUuid(sub)) return { ok: false, code: 'invalid' };
  if (typeof email !== 'string' || email.length > 320 || !/^[^@\s]+@[^@\s]+$/.test(email)) {
    return { ok: false, code: 'invalid' };
  }
  // Accounts are linked by email, so the platform must vouch for it.
  if (email_verified !== true) return { ok: false, code: 'invalid' };
  if (typeof jti !== 'string' || jti.length < 1 || jti.length > 128) {
    return { ok: false, code: 'invalid' };
  }
  if (typeof iat !== 'number' || typeof exp !== 'number') return { ok: false, code: 'invalid' };
  if (exp <= iat || exp - iat > HANDOFF_MAX_AGE_SECONDS) return { ok: false, code: 'invalid' };

  let displayName: string | null = null;
  if (typeof name === 'string') {
    const trimmed = name.trim();
    if (trimmed && trimmed.length <= 200 && !CONTROL_CHARS_RE.test(trimmed)) displayName = trimmed;
  }

  return {
    ok: true,
    claims: {
      memberId: sub.toLowerCase(),
      email: email.toLowerCase(),
      name: displayName,
      tier: isNexusTier(tier) ? tier : null,
      jti,
      expiresAt: new Date(exp * 1000),
      intent: parseIntent(payload.cxd),
    },
  };
}

// ---------------------------------------------------------------------------
// Single use
// ---------------------------------------------------------------------------

export interface JtiStore {
  /** 'ok' the first time a jti is seen, 'replayed' afterwards. Throws on storage failure. */
  claim(jti: string, expiresAt: Date): Promise<'ok' | 'replayed'>;
}

/** In-memory store for tests and the verify script. */
export function createMemoryJtiStore(): JtiStore {
  const seen = new Set<string>();
  return {
    async claim(jti) {
      if (seen.has(jti)) return 'replayed';
      seen.add(jti);
      return 'ok';
    },
  };
}

/** Verify, then claim the jti. A token passes this exactly once. */
export async function consumeHandoffToken(
  token: unknown,
  key: HandoffKey,
  opts: VerifyOptions,
  store: JtiStore,
): Promise<VerifyResult> {
  const result = await verifyHandoffToken(token, key, opts);
  if (!result.ok) return result;
  try {
    const claimed = await store.claim(result.claims.jti, result.claims.expiresAt);
    if (claimed === 'replayed') return { ok: false, code: 'replayed' };
  } catch {
    return { ok: false, code: 'unavailable' };
  }
  return result;
}
