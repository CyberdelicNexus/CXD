// Shared schema + prompt helpers for Edge Resonance insight.
//
// An "edge" of the Hypercube is the relationship between two adjacent faces
// (dimensions). When the user opens an edge, the panel first invites THEIR
// reading of the relationship (a hypothesis), then /api/ai/edge-insight
// responds TO that hypothesis rather than replacing it: a thinking partner,
// not an oracle. The server validates the model output before it reaches the
// client (arrays clamped, strings trimmed/truncated) exactly like tag-suggestion.

import { z } from 'zod';

// The four ways to interrogate one edge. Every button re-calls the same route
// with a different mode; the mode steers the prompt, the schema stays constant.
export type EdgeInsightMode = 'analyze' | 'tensions' | 'bridge' | 'deepen';

export const EDGE_INSIGHT_MODES: EdgeInsightMode[] = ['analyze', 'tensions', 'bridge', 'deepen'];

// Bounds — keep the prompt cheap and safe regardless of how many elements share
// the edge (a busy edge can carry 50+ elements).
export const MAX_EDGE_ELEMENTS = 60;
export const MAX_EDGE_ELEMENT_TEXT = 240;
export const MAX_HYPOTHESIS_LEN = 600;

// One shared element, reduced to its text for the prompt.
export interface EdgeInsightElement {
  text: string;
}

export const edgeInsightSchema = z.object({
  keyObservations: z
    .array(z.string())
    .describe('2-3 observations grounded in the actual shared element content'),
  tension: z
    .string()
    .describe('One real tension, friction, or gap between the two dimensions'),
  questions: z
    .array(z.string())
    .describe('2-3 generative questions addressed to the user, never answers'),
});

export type EdgeInsight = z.infer<typeof edgeInsightSchema>;

/** Clamp arrays, drop empties, and truncate long strings before returning. */
export function sanitizeEdgeInsight(raw: EdgeInsight): EdgeInsight {
  const clean = (s: unknown): string =>
    typeof s === 'string' ? s.trim().replace(/\s+/g, ' ').slice(0, 400) : '';
  const list = (arr: unknown, max: number): string[] =>
    Array.isArray(arr)
      ? arr.map(clean).filter((s) => s.length > 0).slice(0, max)
      : [];
  return {
    keyObservations: list(raw.keyObservations, 3),
    tension: clean(raw.tension),
    questions: list(raw.questions, 3),
  };
}

const MODE_GUIDE: Record<EdgeInsightMode, string> = {
  analyze:
    'Read the relationship as a whole. keyObservations: what the shared elements reveal about how these two dimensions actually meet. tension: the single most honest friction or gap. questions: openings that help the designer see more.',
  tensions:
    'Focus on friction. keyObservations: concrete contradictions or pulls between the two dimensions, drawn from the elements. tension: the sharpest single conflict to sit with. questions: questions that help the designer work the conflict rather than resolve it prematurely.',
  bridge:
    'Focus on connection. keyObservations: 2-3 concrete bridge elements the designer could create that would tie these two dimensions together more fully. tension: what is currently missing between them. questions: questions that pressure-test each proposed bridge.',
  deepen:
    'Focus on the questions. Build socratically on the designer\'s own hypothesis. keyObservations: what their reading opens up or leaves unexamined. tension: the assumption most worth questioning. questions: 2-3 deeper questions that extend their thinking.',
};

export const EDGE_INSIGHT_SYSTEM_PROMPT =
  'You are a sense-making partner inside CXD, an experience-design workspace. ' +
  'The designer is examining the relationship between two dimensions of their ' +
  'experience (an edge of a conceptual Hypercube). Your job is to deepen their ' +
  'thinking, never to replace it. Ground every observation in the actual element ' +
  'content you are given. When the designer offers their own reading, respond TO ' +
  'it: extend it, complicate it, or test it, but do not overwrite it. Address the ' +
  'designer directly as "you". Ask real questions rather than delivering verdicts. ' +
  'Be concrete and specific; avoid generic design advice. Never use em dashes.';

/** Build the user prompt for one edge + mode + optional hypothesis. */
export function buildEdgeInsightPrompt(input: {
  faceA: string;
  faceB: string;
  aCount: number;
  bCount: number;
  sharedCount: number;
  elements: EdgeInsightElement[];
  hypothesis?: string;
  mode: EdgeInsightMode;
}): string {
  const { faceA, faceB, aCount, bCount, sharedCount, elements, hypothesis, mode } = input;
  const lines: string[] = [];

  lines.push(`Two dimensions of this experience meet at an edge:`);
  lines.push(`- "${faceA}" carries ${aCount} element${aCount !== 1 ? 's' : ''}.`);
  lines.push(`- "${faceB}" carries ${bCount} element${bCount !== 1 ? 's' : ''}.`);
  lines.push(
    `${sharedCount} element${sharedCount !== 1 ? 's' : ''} sit on BOTH dimensions at once. Their text:`,
  );
  elements.forEach((el, i) => lines.push(`  ${i + 1}. ${JSON.stringify(el.text)}`));

  if (hypothesis && hypothesis.trim().length > 0) {
    lines.push('');
    lines.push(
      `The designer's own reading of what connects "${faceA}" and "${faceB}": ${JSON.stringify(hypothesis.trim())}`,
    );
    lines.push('Respond to this reading directly. Do not restate it back unchanged.');
  } else {
    lines.push('');
    lines.push('The designer has not offered a reading yet, so open the space for one.');
  }

  lines.push('');
  lines.push(MODE_GUIDE[mode]);

  return lines.join('\n');
}
