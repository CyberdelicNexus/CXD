// Telegram Bot API helpers for the self-correcting loop.
//
// The bot needs no server of its own: it posts via the HTTP API from server
// contexts, and receives decisions on /api/webhooks/telegram (same Vercel app).
// Setup: create a bot with @BotFather, put the token in TELEGRAM_BOT_TOKEN, your
// chat id in TELEGRAM_CHAT_ID, and a random string in TELEGRAM_WEBHOOK_SECRET,
// then register the webhook once (see .env.example note).

import type { SentryIssue } from './sentry-api';
import type { TriageResult } from './triage';

const API = 'https://api.telegram.org';

function botToken(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  return t;
}

async function tg(method: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}/bot${botToken()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!json.ok) throw new Error(`Telegram ${method} failed: ${JSON.stringify(json)}`);
  return json;
}

/** Only decisions from this chat/user are honored (checked in the webhook). */
export function allowedChatId(): string | undefined {
  return process.env.TELEGRAM_CHAT_ID;
}

export function verifyWebhookSecret(headerValue: string | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return false;
  return headerValue === expected;
}

function esc(s: string | undefined | null): string {
  // Minimal HTML escaping for parse_mode: 'HTML'.
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const TIER_LABEL = ['🟢 Tier 0 · noise', '🟡 Tier 1 · low-risk', '🔴 Tier 2 · human-only'];

/**
 * Post the triage card. Buttons are Phase-1 (decision only, all Sentry-native):
 * snooze 7d / snooze 30d / ignore / acknowledge. `callback_data` encodes the
 * action and the issue id: "sl:<action>:<issueId>".
 */
export async function sendIssueCard(
  issue: SentryIssue,
  triage: TriageResult,
): Promise<{ messageId: string }> {
  const chatId = allowedChatId();
  if (!chatId) throw new Error('TELEGRAM_CHAT_ID is not set');

  const tier = TIER_LABEL[triage.tier] ?? `Tier ${triage.tier}`;
  const flags = [
    triage.isCriticalSurface ? `⚠️ critical surface: ${triage.criticalLabel}` : null,
    triage.isKnownNoise ? `🔇 known noise: ${triage.noiseLabel}` : null,
  ].filter(Boolean).join(' · ');

  const lines = [
    `<b>🛠️ New error flagged</b> — I'm assessing whether to fix now or wait.`,
    ``,
    `<b>${esc(issue.title || issue.metadata?.value || 'Unknown error')}</b>`,
    issue.culprit ? `<code>${esc(issue.culprit)}</code>` : '',
    ``,
    `${tier} · <b>${esc(triage.action)}</b> (conf ${Math.round(triage.confidence * 100)}%)`,
    `${esc(triage.rationale)}`,
    flags ? `\n${esc(flags)}` : '',
    ``,
    `events: <b>${esc(String(issue.count ?? '—'))}</b> · users: <b>${esc(String(issue.userCount ?? '—'))}</b> · level: ${esc(issue.level ?? '—')}`,
  ].filter((l) => l !== '');

  const id = issue.id;
  const json = await tg('sendMessage', {
    chat_id: chatId,
    text: lines.join('\n'),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '😴 Snooze 7d', callback_data: `sl:snooze7:${id}` },
          { text: '💤 Snooze 30d', callback_data: `sl:snooze30:${id}` },
        ],
        [
          { text: '🙈 Ignore', callback_data: `sl:ignore:${id}` },
          { text: '👀 I’ll look', callback_data: `sl:ack:${id}` },
        ],
        ...(issue.permalink ? [[{ text: '🔗 Open in Sentry', url: issue.permalink }]] : []),
      ],
    },
  });

  const result = json.result as { message_id?: number } | undefined;
  return { messageId: String(result?.message_id ?? '') };
}

/** Acknowledge a button tap (stops the spinner, shows a toast). */
export async function answerCallback(callbackQueryId: string, text: string): Promise<void> {
  await tg('answerCallbackQuery', { callback_query_id: callbackQueryId, text });
}

/** Append a decision footer to the original card and drop the buttons. */
export async function markCardDecided(
  chatId: string,
  messageId: string,
  originalText: string,
  footer: string,
): Promise<void> {
  await tg('editMessageText', {
    chat_id: chatId,
    message_id: Number(messageId),
    // originalText comes back from Telegram as plain text (formatting stripped);
    // escape it before re-sending as HTML so stray <, >, & don't break parsing.
    text: `${esc(originalText)}\n\n— ${footer}`,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }).catch(() => {
    // Editing is best-effort; the decision itself already took effect in Sentry.
  });
}
