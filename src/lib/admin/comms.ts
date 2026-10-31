import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { IN_APP_BODY_MAX } from './comms-limits';

export const CATEGORIES = ['product', 'service'] as const;
export type Category = (typeof CATEGORIES)[number];

export const audienceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({ kind: z.literal('plan'), plan: z.enum(['free', 'pro', 'lifetime', 'beta_tester']) }),
  z.object({ kind: z.literal('users'), userIds: z.array(z.string().uuid()).min(1).max(500) }),
]);
export type Audience = z.infer<typeof audienceSchema>;

export { IN_APP_BODY_MAX };

export const contentFields = z.object({
  channels: z.array(z.enum(['in_app', 'email'])).min(1),
  category: z.enum(CATEGORIES),
  audience: audienceSchema,
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
});

/** True unless the message goes in-app and its body is over the in-app cap. */
export function inAppBodyFits(content: { channels: string[]; body: string }): boolean {
  return !content.channels.includes('in_app') || content.body.length <= IN_APP_BODY_MAX;
}

export const IN_APP_BODY_MESSAGE = `In-app messages are limited to ${IN_APP_BODY_MAX} characters.`;

export const contentSchema = contentFields.refine(inAppBodyFits, { path: ['body'], message: IN_APP_BODY_MESSAGE });

export interface RecipientRow {
  user_id: string;
  email: string;
  name: string | null;
  email_confirmed: boolean;
  banned: boolean;
  opted_out: boolean;
}

export function filterRecipients(rows: RecipientRow[], category: Category) {
  const active = rows.filter((row) => !row.banned);
  return {
    inApp: active,
    email: active.filter((row) => row.email_confirmed && (category === 'service' || !row.opted_out)),
  };
}

export interface SignedContent {
  subject: string;
  body: string;
  category: Category;
}

function contentHash(content: SignedContent, senderId: string, secret: string): string {
  return createHmac('sha256', `test-send:${secret}`)
    .update(JSON.stringify([senderId, content.category, content.subject, content.body]))
    .digest('base64url');
}

/** Proof that this sender test-sent exactly this content. */
export function signContent(content: SignedContent, senderId: string, secret: string): string {
  return contentHash(content, senderId, secret);
}

export function verifyContent(token: string, content: SignedContent, senderId: string, secret: string): boolean {
  const expected = Buffer.from(contentHash(content, senderId, secret));
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Reads a paged source until a short page comes back, so nothing past the
 * server's row cap is dropped. A failed page throws; it is never read as the end.
 */
export async function collectPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize: number,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    all.push(...page);
    if (page.length < pageSize) return all;
  }
}

/**
 * A fixed id for one user's copy of one broadcast (a version 5 style UUID), so
 * inserting it twice is a no-op instead of a second notification.
 */
export function notificationId(broadcastId: string, userId: string): string {
  const hash = createHash('sha1').update(`broadcast-notification:${broadcastId}:${userId}`).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
