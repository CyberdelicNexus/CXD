import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePermission } from '@/lib/admin/gate';
import { withAudit } from '@/lib/admin/audit';
import { parseBody } from '@/lib/admin/http';
import { contentSchema, verifyContent } from '@/lib/admin/comms';
import { emailConfigProblem, resolveRecipients, testSecret, unsubscribeLinks } from '@/lib/admin/broadcast';
import { enqueueEmail } from '@/lib/email-queue';
import Broadcast from '@emails/broadcast';

const NOTIFICATION_CHUNK = 500;
const EMAIL_CHUNK = 25;

const schema = contentSchema.extend({
  // One key per draft, made by the composer. A double submit or a retry hits the
  // unique constraint on broadcasts, so a bulk send can only go out once.
  idempotencyKey: z.string().uuid(),
  confirmCount: z.number().int().optional(),
  testToken: z.string().optional(),
});

export async function POST(request: Request) {
  const gate = await requirePermission('comms.send');
  if (!gate.ok) return gate.response;
  const parsed = await parseBody(request, schema);
  if (!parsed.ok) return parsed.response;
  const { channels, category, audience, subject, body, idempotencyKey, confirmCount, testToken } = parsed.data;

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

  const admin = getSupabaseAdmin();
  const recipientCount = wantsEmail ? emailTotal : inAppTotal;
  // The insert is the gate: a second request with this key fails here, before anything is sent.
  const { data: broadcast, error: createError } = await admin
    .from('broadcasts')
    .insert({
      idempotency_key: idempotencyKey,
      sender_id: gate.staff.userId,
      channels,
      category: wantsEmail ? category : null,
      audience,
      subject,
      body,
      recipient_count: recipientCount,
    })
    .select('id')
    .single();
  if (createError?.code === '23505') {
    return NextResponse.json({ error: 'This message was already sent. Check the history.' }, { status: 409 });
  }
  if (createError || !broadcast) {
    Sentry.captureException(new Error(`broadcast insert failed: ${createError?.code ?? 'error'}: ${createError?.message ?? 'no row'}`), {
      tags: { route: 'admin-comms-send', step: 'insert' },
    });
    return NextResponse.json({ error: 'Nothing was sent.' }, { status: 500 });
  }
  const broadcastId = broadcast.id as string;

  try {
    await withAudit(
      {
        actorId: gate.staff.userId,
        action: 'broadcast.send',
        targetType: 'broadcast',
        targetId: broadcastId,
        after: { channels, category, audience, subject, recipientCount },
      },
      async () => {
        if (wantsInApp) {
          for (let i = 0; i < recipients.inApp.length; i += NOTIFICATION_CHUNK) {
            const rows = recipients.inApp.slice(i, i + NOTIFICATION_CHUNK).map((row) => ({
              user_id: row.user_id,
              title: subject,
              message: body,
              type: 'announcement',
              is_global: false,
              metadata: { broadcastId },
            }));
            const { error } = await admin.from('notifications').insert(rows);
            if (error) throw new Error(`notification insert failed: ${error.code ?? 'error'}: ${error.message}`);
          }
        }

        if (wantsEmail) {
          const postalAddress = category === 'product' ? process.env.EMAIL_POSTAL_ADDRESS : undefined;
          for (let i = 0; i < recipients.email.length; i += EMAIL_CHUNK) {
            await Promise.all(
              recipients.email.slice(i, i + EMAIL_CHUNK).map((row) => {
                const links = category === 'product' ? unsubscribeLinks(row.user_id) : null;
                return enqueueEmail({
                  to: row.email,
                  subject,
                  userId: row.user_id,
                  emailKind: `broadcast-${broadcastId}`,
                  broadcastId,
                  // Inngest drops a second event with this id, so a retried enqueue emails no one twice.
                  eventId: `broadcast-${broadcastId}-${row.user_id}`,
                  // The direct fallback skips the worker's duplicate check, the event id and the result count.
                  fallbackOnMissing: false,
                  headers: links
                    ? {
                        'List-Unsubscribe': `<${links.oneClickUrl}>`,
                        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                      }
                    : undefined,
                  template: Broadcast({
                    userName: row.name || 'there',
                    subject,
                    body,
                    unsubscribeUrl: links?.pageUrl,
                    postalAddress,
                  }),
                });
              }),
            );
          }
        }
      },
    );
  } catch (err) {
    // Tagged with the broadcast id only, never the message body or a token.
    Sentry.captureException(err, { tags: { route: 'admin-comms-send', step: 'deliver' }, extra: { broadcastId } });
    return NextResponse.json(
      {
        error: 'The send stopped partway and some people may already have it. Do not send it again. Check the history.',
        broadcastId,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, broadcastId, recipientCount });
}
