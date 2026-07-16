/**
 * AI Edge Insight Service (client side)
 *
 * Reflective friction for the Hypercube's Edge Resonance panel. The user first
 * offers their own reading of what connects two dimensions; this service passes
 * that hypothesis (plus the shared elements' text and counts) to
 * /api/ai/edge-insight, which responds TO the hypothesis rather than replacing
 * it. Read-only: it never mutates the canvas, it just returns thinking material.
 */

import { extractElementText } from '@/lib/ai/tag-suggestion';
import type { CanvasElement } from '@/types/canvas-elements';
import {
  MAX_EDGE_ELEMENTS,
  MAX_EDGE_ELEMENT_TEXT,
  MAX_HYPOTHESIS_LEN,
  type EdgeInsight,
  type EdgeInsightMode,
} from '@/lib/ai/edge-insight';

export interface EdgeInsightResult {
  success: boolean;
  insight?: EdgeInsight;
  mode: EdgeInsightMode;
  insufficientCredits?: boolean;
  error?: string;
}

export interface EdgeInsightParams {
  faceA: string;
  faceB: string;
  aCount: number;
  bCount: number;
  shared: CanvasElement[];
  hypothesis?: string;
  mode: EdgeInsightMode;
  provider?: string;
}

/**
 * Request an edge insight for the given face pair. Extracts + bounds the shared
 * elements' text on the client, then defers to the server for the real bounds,
 * generation, and sanitization.
 */
export async function requestEdgeInsight(params: EdgeInsightParams): Promise<EdgeInsightResult> {
  const { faceA, faceB, aCount, bCount, shared, hypothesis, mode, provider } = params;
  try {
    const elements = shared
      .map((el) => ({ text: extractElementText(el) }))
      .filter((e) => e.text && e.text.trim().length > 0)
      .slice(0, MAX_EDGE_ELEMENTS)
      .map((e) => ({ text: e.text.slice(0, MAX_EDGE_ELEMENT_TEXT) }));

    if (elements.length === 0) {
      return { success: false, mode, error: 'No shared elements carry text to analyze.' };
    }

    const response = await fetch('/api/ai/edge-insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        faceA,
        faceB,
        aCount,
        bCount,
        sharedCount: shared.length,
        elements,
        hypothesis: hypothesis ? hypothesis.slice(0, MAX_HYPOTHESIS_LEN) : undefined,
        mode,
        provider,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        mode,
        insufficientCredits: response.status === 402,
        error: (data as { error?: string }).error || `Analysis failed (${response.status})`,
      };
    }

    return {
      success: true,
      mode: (data as { mode?: EdgeInsightMode }).mode || mode,
      insight: (data as { insight?: EdgeInsight }).insight,
    };
  } catch (error) {
    return {
      success: false,
      mode,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
