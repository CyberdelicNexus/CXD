import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePermission } from '@/lib/admin/gate';
import { recordAudit, type AuditEntry } from '@/lib/admin/audit';
import { parseBody } from '@/lib/admin/http';
import { contentFields, inAppBodyFits, IN_APP_BODY_MESSAGE, verifyContent } from '@/lib/admin/comms';
import { emailConfigProblem, resolveRecipients, testSecret } from '@/lib/admin/broadcast';
import { inngest } from '@/inngest/client';

const schema = contentFields
  .extend({
    // One key per draft, made by the composer. A double submit or a retry hits the
    // unique constraint on broadcasts, so a bulk send can only be queued once.
    idempotencyKey: z.string().uuid(),
    confirmCount: z.number().int().optional(),
    confirmInAppCount: z.number().int().optional(),
    testToken: z.string().optional(),
  })
  .refine(inAppBodyFits, { path: ['body'], message: IN_APP_BODY_MESSAGE });

/** Error code and text only, never the message body or a token. */
function describe(error: { code?: string; message: string }): string {
  return `${error.code ?? 'error'}: ${error.message}`;
}

export async function POST(request: Request) {
  const gate = await requirePermission('comms.send');
  if (!gate.ok) return gate.response;
  const parsed = await parseBody(request, schema);
  if (!parsed.ok) return parsed.response;
  const { channels, category, audience, subject, body, idempotencyKey, confirmCount, confirmInAppCount, testToken } = parsed.data;

  const wantsEmail = channels.includes('email');
  const wantsInApp = channels.includes('in_app');

  // A failed lookup sends nothing and creates no broadcast row.
  let recipients;
  try {
    recipients = await resolveRecipients(audience, category);
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'admin-comms-send', step: 'recipients' } });
    return NextResponse.json({ error: 'The recipients could not be loaded. Nothing was sent.' }, { status: 500 });
  }

  const inAppTotal = wantsInApp ? recipients.inApp.length : 0;
  const emailTotal = wantsEmail ? recipients.email.length : 0;
  if (inAppTotal + emailTotal === 0) {
    return NextResponse.json({ error: 'No one matches this audience on the chosen channels. Nothing was sent.' }, { status: 409 });
  }

  if (wantsInApp && confirmInAppCount !== inAppTotal) {
    return NextResponse.json({ error: 'The recipient count changed or does not match. Check it and confirm again.' }, { status: 409 });
  }
  if (wantsEmail) {
    const problem = emailConfigProblem(category);
    const secret = testSecret();
    if (problem || !secret) {
      return NextResponse.json({ error: problem ?? 'Email needs EMAIL_UNSUBSCRIBE_SECRET (or CRON_SECRET) to be set.' }, { status: 409 });
    }
    if (!testToken || !verifyContent(testToken, { subject, body, category }, gate.staff.userId, secret)) {
      return NextResponse.json({ error: 'Send yourself a test of this exact content first.' }, { status: 409 });
    }
    if (confirmCount !== emailTotal) {
      return NextResponse.json({ error: 'The recipient count changed or does not match. Check it and confirm again.' }, { status: 409 });
    }
  }

  const recipientCount = wantsEmail ? emailTotal : inAppTotal;
  const broadcastId = randomUUID();
  const entry: AuditEntry = {
    actorId: gate.staff.userId,
    action: 'broadcast.send',
    targetType: 'broadcast',
    targetId: broadcastId,
    after: { channels, category, audience, subject, recipientCount },
  };

  // The attempt is recorded first. If this write fails nothing exists yet, so the key is not used up.
  try {
    await recordAudit(entry, 'attempted');
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'admin-comms-send', step: 'audit-attempt' } });
    return NextResponse.json({ error: 'The audit log could not be written. Nothing was sent.' }, { status: 500 });
  }

  const admin = getSupabaseAdmin();
  // The insert is the gate: a second request with this key fails here, before anything is queued.
  const { error: createError } = await admin.from('broadcasts').insert({
    id: broadcastId,
    idempotency_key: idempotencyKey,
    sender_id: gate.staff.userId,
    channels,
    category: wantsEmail ? category : null,
    audience,
    subject,
    body,
    recipient_count: recipientCount,
  });
  if (createError) {
    const duplicate = createError.code === '23505';
    if (!duplicate) {
      Sentry.captureException(new Error(`broadcast insert failed: ${describe(createError)}`), {
        tags: { route: 'admin-comms-send', step: 'insert' },
      });
    }
    await recordAudit({ ...entry, reason: duplicate ? 'duplicate send refused' : 'broadcast could not be saved' }, 'failed').catch((err) =>
      Sentry.captureException(err, { tags: { route: 'admin-comms-send', step: 'audit-failed' } }),
    );
    return duplicate
      ? NextResponse.json({ error: 'This message was already sent. Check the history.', duplicate: true }, { status: 409 })
      : NextResponse.json({ error: 'Nothing was sent.' }, { status: 500 });
  }

  try {
    // A fixed event id means a repeat of this request cannot start a second fan-out.
    await inngest.send({ id: `broadcast-fanout-${broadcastId}`, name: 'broadcast/fanout', data: { broadcastId } });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'admin-comms-send', step: 'queue' }, extra: { broadcastId } });
    // Put the failure on the row so history shows it, and keep the audit trail honest.
    const { error: failError } = await admin.rpc('admin_fail_broadcast', {
      p_broadcast: broadcastId,
      p_note: 'The send could not be queued. Nothing was delivered.',
    });
    if (failError) {
      Sentry.captureException(new Error(`broadcast failure not recorded: ${describe(failError)}`), {
        tags: { route: 'admin-comms-send', step: 'record-failure' },
        extra: { broadcastId },
      });
    }
    await recordAudit({ ...entry, reason: 'could not be queued' }, 'failed').catch((auditErr) =>
      Sentry.captureException(auditErr, { tags: { route: 'admin-comms-send', step: 'audit-failed' } }),
    );
    return NextResponse.json(
      { error: 'The send could not be queued and nothing was delivered. Check the history, then start a new message.', broadcastId },
      { status: 500 },
    );
  }

  // Queued is the outcome this request owns; the job records its own failure.
  await recordAudit(entry, 'succeeded').catch((err) =>
    Sentry.captureException(err, { tags: { route: 'admin-comms-send', step: 'audit-succeeded' } }),
  );
  return NextResponse.json({ ok: true, broadcastId, recipientCount });
}
