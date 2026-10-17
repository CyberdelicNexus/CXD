/**
 * Nexus bridge env (D182 §7). Every route that uses the bridge is inert while
 * its env is unset: these helpers return null / not_configured, never throw.
 * Never log the values.
 */

import { timingSafeStringEqual } from '@/lib/bridge/bridge-auth';

function readUrl(name: string): string | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null;
    return raw;
  } catch {
    return null;
  }
}

/** Issuer and JWKS URL for verifying handoff tokens; null when either is unset. */
export function getHandoffConfig(): { issuer: string; jwksUrl: string } | null {
  const issuer = readUrl('NEXUS_ISSUER');
  const jwksUrl = readUrl('NEXUS_JWKS_URL');
  if (!issuer || !jwksUrl) return null;
  return { issuer, jwksUrl };
}

/** Where and how to read a member's tier; null when unset. */
export function getTierReadConfig(): { url: string; credential: string } | null {
  const issuer = readUrl('NEXUS_ISSUER');
  const credential = process.env.NEXUS_TIER_CREDENTIAL;
  if (!issuer || !credential) return null;
  return { url: new URL('/api/handoff/tier', issuer).toString(), credential };
}

export function isBridgeListingEnabled(): boolean {
  return Boolean(process.env.NEXUS_BRIDGE_TOKEN);
}

/** "Bearer <token>" → token, or null. */
export function bearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

export type NexusBridgeCheck =
  | { ok: true; token: string }
  | { ok: false; reason: 'not_configured' | 'missing' | 'invalid' };

/** Timing-safe check of the listing credential against NEXUS_BRIDGE_TOKEN (and _PREVIOUS during rotation). */
export function verifyNexusBridgeToken(authorization: string | null | undefined): NexusBridgeCheck {
  const current = process.env.NEXUS_BRIDGE_TOKEN;
  if (!current) return { ok: false, reason: 'not_configured' };
  const token = bearerToken(authorization);
  if (!token) return { ok: false, reason: 'missing' };
  if (timingSafeStringEqual(token, current)) return { ok: true, token };
  const previous = process.env.NEXUS_BRIDGE_TOKEN_PREVIOUS;
  if (previous && timingSafeStringEqual(token, previous)) return { ok: true, token };
  return { ok: false, reason: 'invalid' };
}

/** The member's Canvas page on the platform (`${NEXUS_ISSUER}/me/create`); null when unset. */
export function getNexusReturnUrl(): string | null {
  const issuer = readUrl('NEXUS_ISSUER');
  if (!issuer) return null;
  return `${issuer.replace(/\/+$/, '')}/me/create`;
}
