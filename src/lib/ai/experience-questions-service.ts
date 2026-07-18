/**
 * AI Experience Questions Service (client side)
 *
 * Reflective friction for the System Insights panel's "generate questions".
 * Builds a bounded summary of the WHOLE project (intention, desired change, and
 * a sample of tagged element text across every Hypercube face, with sparse vs
 * rich flags) and sends it to /api/ai/experience-questions, which returns a set
 * of generative, whole-experience questions addressed to the designer. Read-only:
 * it never mutates the canvas, it just returns thinking material.
 */

import { extractElementText } from '@/lib/ai/tag-suggestion';
import { elementMatchesFace, HYPERCUBE_FACE_TAGS } from '@/types/canvas-elements';
import type { CanvasElement } from '@/types/canvas-elements';
import type { CXDProject } from '@/types/cxd-schema';
import {
  MAX_SAMPLES_PER_FACE,
  MAX_TOTAL_SAMPLES,
  MAX_SAMPLE_TEXT,
  MAX_INTENTION_LEN,
  MAX_CHANGE_LEN,
  MAX_TITLE_LEN,
  type FaceDensity,
  type FaceSummary,
  type ExperienceSummaryInput,
  type SanitizedExperienceQuestions,
} from '@/lib/ai/experience-questions';

export interface ExperienceQuestionsResult {
  success: boolean;
  questions: string[];
  focusAreas: string[];
  insufficientCredits?: boolean;
  error?: string;
}

export interface ExperienceQuestionsParams {
  project: CXDProject;
  provider?: string;
}

function densityFor(count: number): FaceDensity {
  if (count <= 1) return 'sparse';
  if (count <= 4) return 'developing';
  return 'rich';
}

/** Join the meaningful free-text fields of a wizard section into one string. */
function joinFields(obj: unknown, keys: string[]): string {
  if (!obj || typeof obj !== 'object') return '';
  const rec = obj as Record<string, unknown>;
  return keys
    .map((k) => rec[k])
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join('. ')
    .trim();
}

/** Build the bounded whole-experience summary from the project + elements. */
export function buildExperienceSummary(project: CXDProject): ExperienceSummaryInput {
  const elements: CanvasElement[] = project?.canvasLayout?.elements || [];

  const faces: FaceSummary[] = [];
  let sampleBudget = MAX_TOTAL_SAMPLES;

  for (const faceTag of HYPERCUBE_FACE_TAGS) {
    const onFace = elements.filter((el) => elementMatchesFace(el, faceTag, elements));
    const samples: string[] = [];
    for (const el of onFace) {
      if (samples.length >= MAX_SAMPLES_PER_FACE || sampleBudget <= 0) break;
      const text = extractElementText(el);
      if (text && text.trim().length > 0) {
        samples.push(text.slice(0, MAX_SAMPLE_TEXT));
        sampleBudget--;
      }
    }
    faces.push({
      face: faceTag,
      elementCount: onFace.length,
      density: densityFor(onFace.length),
      samples,
    });
  }

  const taggedElements = elements.filter(
    (el) => Array.isArray(el.hypercubeTags) && el.hypercubeTags.length > 0,
  ).length;

  const intentionCore = joinFields(project?.intentionCore, ['mainConcept', 'coreMessage']).slice(
    0,
    MAX_INTENTION_LEN,
  );
  const desiredChange = joinFields(project?.desiredChange, [
    'insights',
    'feelings',
    'states',
    'knowledge',
  ]).slice(0, MAX_CHANGE_LEN);

  return {
    title: (project?.name || '').slice(0, MAX_TITLE_LEN),
    intentionCore,
    desiredChange,
    totalElements: elements.length,
    taggedElements,
    faces,
  };
}

/**
 * Request whole-experience questions. Builds + bounds the summary on the client,
 * then defers to the server for the real bounds, generation, and sanitization.
 */
export async function requestExperienceQuestions(
  params: ExperienceQuestionsParams,
): Promise<ExperienceQuestionsResult> {
  const { project, provider } = params;
  try {
    const summary = buildExperienceSummary(project);

    const response = await fetch('/api/ai/experience-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...summary, provider }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        questions: [],
        focusAreas: [],
        insufficientCredits: response.status === 402,
        error: (data as { error?: string }).error || `Analysis failed (${response.status})`,
      };
    }

    const result = data as SanitizedExperienceQuestions;
    return {
      success: true,
      questions: Array.isArray(result.questions) ? result.questions : [],
      focusAreas: Array.isArray(result.focusAreas) ? result.focusAreas : [],
    };
  } catch (error) {
    return {
      success: false,
      questions: [],
      focusAreas: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
