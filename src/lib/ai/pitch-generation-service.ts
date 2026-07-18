/**
 * AI Pitch Generation Service (client side)
 *
 * Calls /api/ai/generate-pitch with a bounded project summary, the author's
 * emphasis prompt, and the builder options, then returns sanitized sections.
 * The caller renders them through buildPitchDeckHTML. On any failure the caller
 * falls back to the template-based one-pager so the card never dead-ends.
 */

import type { CXDProject } from "@/types/cxd-schema";
import {
  buildPitchProjectSummary,
  type PitchBuilderOptions,
  type PitchSection,
} from "@/lib/ai/pitch-generation";

export interface PitchGenerationResult {
  success: boolean;
  sections?: PitchSection[];
  /** 402 - out of credits / daily cap */
  insufficientCredits?: boolean;
  error?: string;
}

export async function generatePitch(
  project: CXDProject,
  options: PitchBuilderOptions,
  prompt: string,
  providerOrModel?: string,
): Promise<PitchGenerationResult> {
  try {
    const summary = buildPitchProjectSummary(project);

    const response = await fetch("/api/ai/generate-pitch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary,
        options,
        prompt,
        provider: providerOrModel,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        insufficientCredits: response.status === 402,
        error: (data as { error?: string }).error || `Generation failed (${response.status})`,
      };
    }

    const sections = (data as { sections?: PitchSection[] }).sections || [];
    if (sections.length === 0) {
      return { success: false, error: "No sections generated" };
    }

    return { success: true, sections };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
