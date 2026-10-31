import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/supabase/admin';

export interface AuditEntry {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

async function insertAudit(entry: AuditEntry, outcome: 'attempted' | 'succeeded' | 'failed') {
  const { error } = await getSupabaseAdmin().from('admin_audit_log').insert({
    actor_id: entry.actorId,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    reason: entry.reason ?? null,
    outcome,
  });
  if (error) throw new Error(`audit write failed: ${error.message}`);
}

/**
 * For actions that call outside services. The attempt is recorded first, and a
 * failed attempt write aborts the action. Actions inside the database use RPCs,
 * which audit in their own transaction.
 */
export async function withAudit<T>(entry: AuditEntry, action: () => Promise<T>): Promise<T> {
  await insertAudit(entry, 'attempted');
  let result: T;
  try {
    result = await action();
  } catch (err) {
    await insertAudit(entry, 'failed').catch((e) => Sentry.captureException(e));
    throw err;
  }
  await insertAudit(entry, 'succeeded').catch((e) => Sentry.captureException(e));
  return result;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  await insertAudit(entry, 'succeeded');
}
