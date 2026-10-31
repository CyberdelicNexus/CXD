import { getSupabaseAdmin } from '@/supabase/admin';
import { signUnsubscribeToken } from '@/lib/email-unsubscribe';
import { filterRecipients, type Audience, type Category, type RecipientRow } from './comms';

/** Throws when the lookup fails. A failed lookup must never read as "no recipients" or send anything. */
export async function resolveRecipients(audience: Audience, category: Category) {
  const { data, error } = await getSupabaseAdmin().rpc('admin_recipients', {
    p_plan: audience.kind === 'plan' ? audience.plan : null,
    p_user_ids: audience.kind === 'users' ? audience.userIds : null,
  });
  if (error) throw new Error(`recipient lookup failed: ${error.code ?? 'error'}: ${error.message}`);
  return filterRecipients((data ?? []) as RecipientRow[], category);
}

/**
 * The secret that signs test-send proofs, or null when none is configured.
 * There is no empty fallback: with no secret, nothing can be proven, so email does not go out.
 */
export function testSecret(): string | null {
  return process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || null;
}

/** Why email of this category cannot go out, or null when it can. */
export function emailConfigProblem(category: Category): string | null {
  if (!testSecret()) return 'Email needs EMAIL_UNSUBSCRIBE_SECRET (or CRON_SECRET) to be set.';
  if (category !== 'product') return null;
  if (!process.env.EMAIL_UNSUBSCRIBE_SECRET) return 'Product updates need EMAIL_UNSUBSCRIBE_SECRET to be set.';
  if (!process.env.EMAIL_POSTAL_ADDRESS) return 'Product updates need EMAIL_POSTAL_ADDRESS to be set.';
  return null;
}

export function unsubscribeLinks(userId: string) {
  const token = signUnsubscribeToken(userId, process.env.EMAIL_UNSUBSCRIBE_SECRET ?? '');
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://canvas.cyberdelic.design').replace(/\/+$/, '');
  return {
    pageUrl: `${base}/unsubscribe?token=${encodeURIComponent(token)}`,
    oneClickUrl: `${base}/api/email/unsubscribe?token=${encodeURIComponent(token)}`,
  };
}
