import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const CATEGORIES = ['product', 'service'] as const;
export type Category = (typeof CATEGORIES)[number];

export const audienceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({ kind: z.literal('plan'), plan: z.enum(['free', 'pro', 'lifetime', 'beta_tester']) }),
  z.object({ kind: z.literal('users'), userIds: z.array(z.string().uuid()).min(1).max(500) }),
]);
export type Audience = z.infer<typeof audienceSchema>;

export const contentSchema = z.object({
  channels: z.array(z.enum(['in_app', 'email'])).min(1),
  category: z.enum(CATEGORIES),
  audience: audienceSchema,
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
});

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
