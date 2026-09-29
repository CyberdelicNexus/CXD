// The triage brain. Given a Sentry issue, decide severity, a recommended action,
// a confidence, and a one-line rationale — then fold in the deterministic
// guardrails (critical-surface → human-only, known-noise → auto-snooze eligible).
//
// Uses the same Vercel AI SDK + Anthropic path as the rest of the app
// (getModelInstance('claude','analysis')). Output is schema-validated so the model
// must return well-formed JSON.

import { generateObject } from 'ai';
import { z } from 'zod';
import { getModelInstance } from '@/lib/ai/provider-registry';
import type { SentryIssue } from './sentry-api';
import { CRITICAL_SURFACES, KNOWN_NOISE, matchGroups } from './config';

export type TriageAction = 'fix_now' | 'wait' | 'snooze' | 'ignore';

export interface TriageResult {
  tier: 0 | 1 | 2;
  action: TriageAction;
  confidence: number;
  rationale: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isCriticalSurface: boolean;
  criticalLabel: string | null;
  isKnownNoise: boolean;
  noiseLabel: string | null;
}

const AiTriageSchema = z.object({
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  action: z.enum(['fix_now', 'wait', 'snooze', 'ignore']),
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(280),
});

const CONFIDENCE_FLOOR = 0.6;

export async function triageIssue(issue: SentryIssue): Promise<TriageResult> {
  const criticalLabel = matchGroups(CRITICAL_SURFACES, issue.culprit, issue.title, issue.metadata?.value);
  const noiseLabel = matchGroups(KNOWN_NOISE, issue.culprit, issue.title, issue.metadata?.value);
  const isCriticalSurface = !!criticalLabel;
  const isKnownNoise = !!noiseLabel && !isCriticalSurface;

  const signalPacket = {
    title: issue.title,
    culprit: issue.culprit,
    level: issue.level,
    eventCount: Number(issue.count ?? 0),
    usersAffected: issue.userCount ?? 0,
    matchedCriticalSurface: criticalLabel,
    matchedKnownNoise: noiseLabel,
  };

  let ai: z.infer<typeof AiTriageSchema>;
  try {
    const { object } = await generateObject({
      model: getModelInstance('claude', 'analysis'),
      schema: AiTriageSchema,
      system:
        'You triage production errors for a Next.js app (CXD Canvas). Decide how urgent a fix is. ' +
        'Weigh: event volume & velocity, users affected, error level, whether it looks like a release regression, ' +
        'and whether it sits on a critical surface (auth, billing, data-save, quota). ' +
        'Be conservative: if you are not confident it needs fixing now, recommend "wait". ' +
        'Known-noise matches should usually be "snooze" or "ignore". Keep rationale to one sentence.',
      prompt: `Triage this Sentry issue and return the structured verdict:\n\n${JSON.stringify(signalPacket, null, 2)}`,
    });
    ai = object;
  } catch {
    // If the model call fails, fail SAFE: recommend waiting for a human, low confidence.
    ai = { severity: 'medium', action: 'wait', confidence: 0, rationale: 'Triage model unavailable — deferring to human review.' };
  }

  // ── Deterministic guardrails override the model ──
  let tier: 0 | 1 | 2;
  let action = ai.action;

  if (isCriticalSurface) {
    // Critical surfaces are HUMAN-ONLY regardless of what the model thinks.
    tier = 2;
    if (action === 'ignore' || action === 'snooze') action = 'wait';
  } else if (isKnownNoise) {
    tier = 0;
    if (action === 'fix_now' || action === 'wait') action = 'snooze';
  } else {
    tier = 1;
  }

  // Low confidence never escalates to action.
  if (ai.confidence < CONFIDENCE_FLOOR && action === 'fix_now') action = 'wait';

  return {
    tier,
    action,
    confidence: ai.confidence,
    rationale: ai.rationale,
    severity: ai.severity,
    isCriticalSurface,
    criticalLabel,
    isKnownNoise,
    noiseLabel,
  };
}
