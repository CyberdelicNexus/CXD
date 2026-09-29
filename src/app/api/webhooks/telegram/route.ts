// Telegram webhook → human decision handler for the self-correcting loop.
//
// Register once (replace <TOKEN>/<SECRET>/<HOST>):
//   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
//     -d url="https://<HOST>/api/webhooks/telegram" \
//     -d secret_token="<TELEGRAM_WEBHOOK_SECRET>"
// Telegram then sends every update with the X-Telegram-Bot-Api-Secret-Token header,
// which we verify below. Only the configured chat/user may issue decisions.

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getSupabaseAdmin } from '@/supabase/admin';
import { ignoreIssue } from '@/lib/sentry-loop/sentry-api';
import {
  verifyWebhookSecret,
  allowedChatId,
  answerCallback,
  markCardDecided,
} from '@/lib/sentry-loop/telegram';

const DAY = 24 * 60;

// callback_data actions → (Sentry snooze minutes | null=ignore forever | undefined=no change)
const ACTIONS: Record<string, { minutes?: number | null; decision: string; label: string }> = {
  snooze7: { minutes: 7 * DAY, decision: 'snooze', label: 'Snoozed 7 days' },
  snooze30: { minutes: 30 * DAY, decision: 'snooze', label: 'Snoozed 30 days' },
  ignore: { minutes: null, decision: 'ignore', label: 'Ignored' },
  ack: { minutes: undefined, decision: 'ack', label: 'Acknowledged — will review' },
};

export async function POST(req: Request) {
  const headersList = await headers();
  if (!verifyWebhookSecret(headersList.get('x-telegram-bot-api-secret-token'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let update: Record<string, unknown>;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const cb = update.callback_query as
    | { id: string; from?: { id: number }; message?: { message_id: number; chat?: { id: number }; text?: string }; data?: string }
    | undefined;

  // We only handle button taps. Anything else (plain messages) is acknowledged and ignored.
  if (!cb) return NextResponse.json({ ok: true });

  // Only the configured chat may decide.
  const allowed = allowedChatId();
  const fromId = cb.from?.id != null ? String(cb.from.id) : undefined;
  const chatId = cb.message?.chat?.id != null ? String(cb.message.chat.id) : undefined;
  if (allowed && fromId !== allowed && chatId !== allowed) {
    await answerCallback(cb.id, 'Not authorized.').catch(() => {});
    return NextResponse.json({ ok: true });
  }

  // callback_data = "sl:<action>:<issueId>"
  const parts = (cb.data ?? '').split(':');
  if (parts[0] !== 'sl' || parts.length < 3) {
    await answerCallback(cb.id, 'Unknown action.').catch(() => {});
    return NextResponse.json({ ok: true });
  }
  const action = parts[1];
  const issueId = parts.slice(2).join(':');
  const spec = ACTIONS[action];
  if (!spec) {
    await answerCallback(cb.id, 'Unknown action.').catch(() => {});
    return NextResponse.json({ ok: true });
  }

  try {
    // Apply the Sentry-native snooze/ignore (ack makes no Sentry change).
    if (spec.minutes !== undefined) {
      await ignoreIssue(issueId, spec.minutes ?? undefined);
    }

    // Record the decision on the pipeline row.
    const supabase = getSupabaseAdmin();
    await supabase
      .from('fix_pipeline')
      .update({
        status: spec.decision === 'ack' ? 'acknowledged' : spec.decision === 'ignore' ? 'ignored' : 'snoozed',
        decision: spec.decision,
        decided_by: fromId ?? 'unknown',
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('sentry_issue_id', issueId);

    await answerCallback(cb.id, `✅ ${spec.label}`);
    if (chatId && cb.message?.message_id) {
      await markCardDecided(chatId, String(cb.message.message_id), cb.message.text ?? '', `✅ <b>${spec.label}</b>`);
    }
  } catch (err) {
    console.error('[sentry-loop] telegram decision failed:', err);
    await answerCallback(cb.id, '⚠️ Failed — check logs.').catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
