// Durable fan-out for admin broadcasts.
//
// The send route validates, records the broadcast and queues one `broadcast/fanout`
// event. This job does the slow part: it re-resolves recipients (so someone who
// unsubscribed since the preview is skipped), then writes in-app rows and enqueues
// emails in chunks. Each chunk is its own step, so a retry never redoes finished
// chunks, and every write is also safe to repeat: notification ids and email event
// ids are fixed per recipient.

import { NonRetriableError } from 'inngest';
import * as Sentry from '@sentry/nextjs';
import { inngest } from './client';
import { getSupabaseAdmin } from '@/supabase/admin';
import { recordAudit } from '@/lib/admin/audit';
import { audienceSchema, chunk, notificationId, type Category } from '@/lib/admin/comms';
import { emailConfigProblem, resolveRecipients, unsubscribeLinks } from '@/lib/admin/broadcast';
import { enqueueEmail } from '@/lib/email-queue';
import Broadcast from '@emails/broadcast';

const NOTIFICATION_CHUNK = 500;
const EMAIL_CHUNK = 25;

interface FanoutData {
  broadcastId: string;
}

interface Target {
  userId: string;
  email: string;
  name: string | null;
}

async function recordProgress(broadcastId: string, enqueued: number, recipientCount?: number) {
  const { error } = await getSupabaseAdmin().rpc('admin_record_broadcast_progress', {
    p_broadcast: broadcastId,
    p_enqueued: enqueued,
    p_recipient_count: recipientCount ?? null,
  });
  if (error) throw new Error(`progress write failed: ${error.code ?? 'error'}: ${error.message}`);
}

export const broadcastFanoutFn = inngest.createFunction(
  {
    id: 'broadcast-fanout',
    name: 'Broadcast fan-out',
    retries: 3,
    triggers: [{ event: 'broadcast/fanout' }],
    onFailure: async ({ event, error }) => {
      const { broadcastId } = event.data.event.data as FanoutData;
      const note = `Delivery stopped: ${error.message}`.slice(0, 300);
      const admin = getSupabaseAdmin();
      try {
        // Everything not yet enqueued counts as failed, so history shows the shortfall.
        const { error: failError } = await admin.rpc('admin_fail_broadcast', { p_broadcast: broadcastId, p_note: note });
        if (failError) throw new Error(`${failError.code ?? 'error'}: ${failError.message}`);

        const { data, error: readError } = await admin.from('broadcasts').select('sender_id').eq('id', broadcastId).maybeSingle();
        if (readError || !data) throw new Error(`broadcast read failed: ${readError?.code ?? 'missing'}`);
        await recordAudit(
          { actorId: data.sender_id as string, action: 'broadcast.fanout', targetType: 'broadcast', targetId: broadcastId, reason: note },
          'failed',
        );
      } catch (err) {
        Sentry.captureException(err, { tags: { route: 'broadcast-fanout', step: 'on-failure' }, extra: { broadcastId } });
        throw err;
      }
    },
  },
  async ({ event, step }) => {
    const { broadcastId } = event.data as FanoutData;

    const plan = await step.run('load', async () => {
      const { data: row, error } = await getSupabaseAdmin()
        .from('broadcasts')
        .select('id, channels, category, audience, subject, body')
        .eq('id', broadcastId)
        .maybeSingle();
      if (error) throw new Error(`broadcast read failed: ${error.code ?? 'error'}: ${error.message}`);
      if (!row) throw new NonRetriableError('broadcast not found');

      const audience = audienceSchema.safeParse(row.audience);
      if (!audience.success) throw new NonRetriableError('broadcast audience is not valid');
      const channels = row.channels as string[];
      const wantsEmail = channels.includes('email');
      const wantsInApp = channels.includes('in_app');
      const category = (row.category ?? 'service') as Category;
      if (wantsEmail) {
        const problem = emailConfigProblem(category);
        if (problem) throw new NonRetriableError(problem);
      }

      // Re-resolved now, so an unsubscribe or suspension since the preview is honoured.
      const recipients = await resolveRecipients(audience.data, category);
      const inApp: Target[] = wantsInApp ? recipients.inApp.map((r) => ({ userId: r.user_id, email: r.email, name: r.name })) : [];
      const email: Target[] = wantsEmail ? recipients.email.map((r) => ({ userId: r.user_id, email: r.email, name: r.name })) : [];
      return {
        subject: row.subject as string,
        body: row.body as string,
        category,
        wantsEmail,
        inApp,
        email,
      };
    });

    // The count shown in history becomes the number actually reachable now.
    const recipientCount = plan.wantsEmail ? plan.email.length : plan.inApp.length;
    await step.run('set-count', () => recordProgress(broadcastId, 0, recipientCount));

    const admin = getSupabaseAdmin();

    const inAppBatches = chunk<Target>(plan.inApp, NOTIFICATION_CHUNK);
    for (let index = 0; index < inAppBatches.length; index++) {
      const batch = inAppBatches[index];
      await step.run(`in-app-${index}`, async () => {
        const rows = batch.map((target) => ({
          id: notificationId(broadcastId, target.userId),
          user_id: target.userId,
          title: plan.subject,
          message: plan.body,
          type: 'announcement',
          is_global: false,
          metadata: { broadcastId },
        }));
        // A fixed id per recipient makes a repeat of this step a no-op.
        const { error } = await admin.from('notifications').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
        if (error) throw new Error(`notification insert failed: ${error.code ?? 'error'}: ${error.message}`);
        // For an in-app only broadcast the notifications are the whole send.
        if (!plan.wantsEmail) await recordProgress(broadcastId, rows.length);
      });
    }

    const postalAddress = plan.category === 'product' ? process.env.EMAIL_POSTAL_ADDRESS : undefined;
    const emailBatches = chunk<Target>(plan.email, EMAIL_CHUNK);
    for (let index = 0; index < emailBatches.length; index++) {
      const batch = emailBatches[index];
      await step.run(`email-${index}`, async () => {
        await Promise.all(
          batch.map((target) => {
            const links = plan.category === 'product' ? unsubscribeLinks(target.userId) : null;
            return enqueueEmail({
              to: target.email,
              subject: plan.subject,
              userId: target.userId,
              emailKind: `broadcast-${broadcastId}`,
              broadcastId,
              // Inngest drops a second event with this id, so a retried chunk emails no one twice.
              eventId: `broadcast-${broadcastId}-${target.userId}`,
              // The direct fallback skips the worker's duplicate check, the event id and the result count.
              fallbackOnMissing: false,
              headers: links
                ? {
                    'List-Unsubscribe': `<${links.oneClickUrl}>`,
                    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                  }
                : undefined,
              template: Broadcast({
                userName: target.name || 'there',
                subject: plan.subject,
                body: plan.body,
                unsubscribeUrl: links?.pageUrl,
                postalAddress,
              }),
            });
          }),
        );
        await recordProgress(broadcastId, batch.length);
      });
    }

    return { broadcastId, recipientCount };
  },
);

export const broadcastFunctions = [broadcastFanoutFn];
