// Inngest functions for the Sentry self-correcting loop (Phase 1).
//
// Trigger: `sentry/issue.flagged` (fired by /api/webhooks/sentry when Sentry
// alerts on a newly-seen issue). Durable: each stage is its own step.run so a
// Sentry/Anthropic/Telegram hiccup retries in isolation.

import { inngest } from './client';
import { getSupabaseAdmin } from '@/supabase/admin';
import { fetchIssue, ignoreIssue } from '@/lib/sentry-loop/sentry-api';
import { triageIssue } from '@/lib/sentry-loop/triage';
import { sendIssueCard } from '@/lib/sentry-loop/telegram';
import { isLoopEnabled } from '@/lib/sentry-loop/config';

interface IssueFlaggedData {
  issueId: string;
  permalink?: string;
  projectSlug?: string;
}

const NOISE_SNOOZE_MINUTES = 14 * 24 * 60; // 14 days

export const triageIssueFn = inngest.createFunction(
  {
    id: 'sentry-triage-issue',
    name: 'Sentry loop — triage flagged issue',
    retries: 3,
    triggers: [{ event: 'sentry/issue.flagged' }],
    // One pipeline per issue at a time; re-fired webhooks for the same issue
    // collapse instead of racing to insert duplicate rows.
    concurrency: { key: 'event.data.issueId', limit: 1 },
  },
  async ({ event, step }) => {
    const { issueId, permalink, projectSlug } = event.data as IssueFlaggedData;
    if (!issueId) return { skipped: true, reason: 'missing issueId' };

    if (!isLoopEnabled()) return { skipped: true, reason: 'loop disabled (kill switch)' };

    // 1. Dedup — already tracking this issue? bail.
    const already = await step.run('dedup', async () => {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from('fix_pipeline')
        .select('id')
        .eq('sentry_issue_id', issueId)
        .maybeSingle();
      return !!data;
    });
    if (already) return { skipped: true, reason: 'already tracked', issueId };

    // 2. Fetch full issue detail from Sentry.
    const issue = await step.run('fetch-issue', () => fetchIssue(issueId));

    // 3. Triage (AI + deterministic guardrails).
    const triage = await step.run('triage', () => triageIssue(issue));

    // 4. Persist the pipeline row.
    await step.run('insert-pipeline-row', async () => {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase.from('fix_pipeline').insert({
        sentry_issue_id: issue.id,
        sentry_short_id: issue.shortId ?? null,
        project_slug: issue.projectSlug ?? projectSlug ?? null,
        title: issue.title ?? null,
        culprit: issue.culprit ?? null,
        permalink: issue.permalink ?? permalink ?? null,
        status: 'triaged',
        triage_tier: triage.tier,
        triage_action: triage.action,
        triage_confidence: triage.confidence,
        triage_rationale: triage.rationale,
        is_critical_surface: triage.isCriticalSurface,
        is_known_noise: triage.isKnownNoise,
        event_count: Number(issue.count ?? 0),
        user_count: issue.userCount ?? 0,
        level: issue.level ?? null,
      });
      // 23505 = unique violation = a concurrent webhook won the race; benign.
      if (error && error.code !== '23505') throw error;
    });

    // 5. Tier 0 (known noise): auto-snooze via Sentry-native ignore.
    if (triage.tier === 0) {
      await step.run('auto-snooze-noise', async () => {
        await ignoreIssue(issue.id, NOISE_SNOOZE_MINUTES);
        const supabase = getSupabaseAdmin();
        await supabase
          .from('fix_pipeline')
          .update({ status: 'snoozed', decision: 'auto-snooze', decided_by: 'system', decided_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('sentry_issue_id', issue.id);
      });
    }

    // 6. Notify the human on Telegram (all tiers — Tier 0 card shows it was auto-handled).
    const { messageId } = await step.run('notify-telegram', () => sendIssueCard(issue, triage));

    await step.run('save-message-id', async () => {
      const supabase = getSupabaseAdmin();
      await supabase
        .from('fix_pipeline')
        .update({ telegram_message_id: messageId, status: triage.tier === 0 ? 'snoozed' : 'notified', updated_at: new Date().toISOString() })
        .eq('sentry_issue_id', issue.id);
    });

    return { issueId: issue.id, tier: triage.tier, action: triage.action };
  },
);

export const sentryLoopFunctions = [triageIssueFn];
