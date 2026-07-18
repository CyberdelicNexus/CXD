// Shared schema + prompt helpers for whole-experience reflective questions.
//
// The System Insights panel's "generate questions" reads the ENTIRE design
// (intention, desired change, and the tagged element content across all seven
// Hypercube faces) and returns a small set of generative questions addressed
// TO the designer. Like the Edge Resonance feature, this is reflective friction:
// the questions provoke the designer's own insight, they are never answers. The
// server validates the model output before it reaches the client (arrays
// clamped, strings trimmed/truncated, em dashes stripped) exactly like
// edge-insight and tag-suggestion.

import { z } from 'zod';

// Bounds — keep the whole-experience prompt cheap and safe no matter how large
// the project is (a rich design can carry hundreds of elements).
export const MAX_FACES = 7;
export const MAX_SAMPLES_PER_FACE = 6;
export const MAX_TOTAL_SAMPLES = 30;
export const MAX_SAMPLE_TEXT = 180;
export const MAX_INTENTION_LEN = 600;
export const MAX_CHANGE_LEN = 600;
export const MAX_TITLE_LEN = 120;

export type FaceDensity = 'sparse' | 'developing' | 'rich';

/** One face of the Hypercube, reduced to counts + a text sample for the prompt. */
export interface FaceSummary {
  face: string;
  elementCount: number;
  density: FaceDensity;
  samples: string[];
}

/** The bounded summary of the whole project the route reasons over. */
export interface ExperienceSummaryInput {
  title?: string;
  intentionCore?: string;
  desiredChange?: string;
  totalElements: number;
  taggedElements: number;
  faces: FaceSummary[];
}

export const experienceQuestionsSchema = z.object({
  questions: z
    .array(z.string())
    .describe(
      '5-6 generative, whole-experience questions addressed to the designer as "you". ' +
        'Each helps them make sense of their design ACROSS all faces. Never answers.',
    ),
  focusAreas: z
    .array(z.string())
    .describe('1-2 dimensions that look underdeveloped and worth the designer\'s attention')
    .optional(),
});

export type ExperienceQuestions = z.infer<typeof experienceQuestionsSchema>;

/** The shape returned to the client after server-side sanitization. */
export interface SanitizedExperienceQuestions {
  questions: string[];
  focusAreas: string[];
}

/** Replace em/en dashes with a comma so copy never ships em dashes. */
function stripDashes(s: string): string {
  return s.replace(/\s*[—–]\s*/g, ', ');
}

/** Clamp arrays, drop empties, truncate long strings, strip dashes. */
export function sanitizeExperienceQuestions(raw: ExperienceQuestions): SanitizedExperienceQuestions {
  const clean = (s: unknown): string =>
    typeof s === 'string' ? stripDashes(s.trim().replace(/\s+/g, ' ')).slice(0, 300).trim() : '';
  const list = (arr: unknown, max: number): string[] =>
    Array.isArray(arr)
      ? Array.from(new Set(arr.map(clean).filter((s) => s.length > 0))).slice(0, max)
      : [];
  return {
    questions: list(raw.questions, 6),
    focusAreas: list(raw.focusAreas, 2),
  };
}

export const EXPERIENCE_QUESTIONS_SYSTEM_PROMPT =
  'You are a sense-making partner inside CXD, an experience-design workspace. ' +
  'The designer has built an experience across seven dimensions (the faces of a ' +
  'conceptual Hypercube). Your job is to help them make sense of the WHOLE design ' +
  'at once, not any single face. Read across everything you are given: their ' +
  'intention, the change they want to create, and the actual element content on ' +
  'each face. Then ask generative questions that provoke THEIR own insight about ' +
  'how the pieces relate, what the whole is becoming, and where it is thin. ' +
  'Address the designer directly as "you". Ask real, open questions rather than ' +
  'delivering verdicts or answers. Ground every question in the specific content ' +
  'you were given; avoid generic design advice. Never use em dashes.';

/** Build the user prompt from a bounded whole-experience summary. */
export function buildExperienceQuestionsPrompt(input: ExperienceSummaryInput): string {
  const { title, intentionCore, desiredChange, totalElements, taggedElements, faces } = input;
  const lines: string[] = [];

  lines.push('Here is the whole experience the designer is building.');
  if (title && title.trim()) {
    lines.push(`Title: ${JSON.stringify(title.trim())}`);
  }
  if (intentionCore && intentionCore.trim()) {
    lines.push(`Intention (what this experience is at its core): ${JSON.stringify(intentionCore.trim())}`);
  }
  if (desiredChange && desiredChange.trim()) {
    lines.push(`Desired change (what it should shift in the person): ${JSON.stringify(desiredChange.trim())}`);
  }

  lines.push('');
  lines.push(
    `Canvas so far: ${totalElements} element${totalElements !== 1 ? 's' : ''} total, ` +
      `${taggedElements} tagged onto dimensions.`,
  );

  const rich = faces.filter((f) => f.density === 'rich').map((f) => f.face);
  const sparse = faces.filter((f) => f.density === 'sparse').map((f) => f.face);
  if (rich.length > 0) lines.push(`Richer dimensions: ${rich.join(', ')}.`);
  if (sparse.length > 0) lines.push(`Sparse or empty dimensions: ${sparse.join(', ')}.`);

  lines.push('');
  lines.push('Dimension detail (a sample of the actual element text on each):');
  faces.forEach((f) => {
    lines.push(`- ${f.face} [${f.density}, ${f.elementCount} element${f.elementCount !== 1 ? 's' : ''}]:`);
    if (f.samples.length === 0) {
      lines.push('    (no element text yet)');
    } else {
      f.samples.forEach((s) => lines.push(`    * ${JSON.stringify(s)}`));
    }
  });

  lines.push('');
  lines.push(
    'Return 5-6 questions that help the designer make sense of this WHOLE design ' +
      'across all dimensions at once (connections, tensions, coherence, what the ' +
      'experience is becoming), plus 1-2 focusAreas naming dimensions that look ' +
      'underdeveloped and worth their attention. Questions only, never answers.',
  );

  return lines.join('\n');
}
