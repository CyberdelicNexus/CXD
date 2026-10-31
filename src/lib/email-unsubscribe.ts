import { createHmac, timingSafeEqual } from 'node:crypto';

function sign(payload: string, secret: string): string {
  return createHmac('sha256', `unsubscribe:${secret}`).update(payload).digest('base64url');
}

export function signUnsubscribeToken(userId: string, secret: string): string {
  const payload = Buffer.from(userId).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

/** Returns the user id, or null for anything not signed with this secret. */
export function verifyUnsubscribeToken(token: string, secret: string): string | null {
  if (!token || !secret) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  return Buffer.from(payload, 'base64url').toString();
}
