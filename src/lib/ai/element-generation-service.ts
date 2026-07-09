/**
 * AI Element Generation Service (client side)
 *
 * Calls /api/ai/generate-elements and places the returned CanvasElement[]
 * on the canvas through the store's batched, freeze-proof insertion path
 * (addCanvasElements → single Zustand set + one 'template-batch' Y.Doc
 * transaction, which also persists and broadcasts to collaborators).
 */

import type { CanvasElement, HypercubeFaceTag } from '@/types/canvas-elements';
import { useCXDStore } from '@/store/cxd-store';
import { framingInsertionOrigin } from '@/lib/framing-to-canvas';
import { FACE_DISPLAY_NAMES } from '@/lib/display-utils';

export interface ElementGenerationOptions {
  provider?: string;
  /** Face keys (e.g. 'sensoryDomains') to tag generated elements with */
  sourceFaces?: string[];
}

export interface ElementGenerationResult {
  success: boolean;
  title?: string;
  count: number;
  /** 402 — out of credits / daily cap */
  insufficientCredits?: boolean;
  error?: string;
}

const TAGGABLE_FACES = [
  'realityPlanes', 'sensoryDomains', 'presence', 'stateMapping',
  'traitMapping', 'contextAndMeaning', 'intentionCore',
];

/**
 * Generate canvas elements from a prompt and place them on the canvas,
 * offset clear of existing content.
 */
export async function generateElementsFromPrompt(
  prompt: string,
  options: ElementGenerationOptions = {}
): Promise<ElementGenerationResult> {
  try {
    if (!prompt || !prompt.trim()) {
      return { success: false, count: 0, error: 'Prompt is required' };
    }

    const response = await fetch('/api/ai/generate-elements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        provider: options.provider,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        count: 0,
        insufficientCredits: response.status === 402,
        error: (data as { error?: string }).error || `Generation failed (${response.status})`,
      };
    }

    const elements = (data as { elements?: CanvasElement[] }).elements || [];
    if (elements.length === 0) {
      return { success: false, count: 0, error: 'No elements generated' };
    }

    const store = useCXDStore.getState();
    const project = store.getCurrentProject();
    if (!project) {
      return { success: false, count: 0, error: 'No active project' };
    }

    // Shift the batch so its bounding box lands clear of existing content
    const origin = framingInsertionOrigin(project);
    const minX = Math.min(...elements.map((el) => el.x));
    const minY = Math.min(...elements.map((el) => el.y));
    const dx = origin.x - minX;
    const dy = origin.y - minY;

    const hypercubeTags: HypercubeFaceTag[] = (options.sourceFaces || [])
      .filter((face) => TAGGABLE_FACES.includes(face))
      .map((face) => FACE_DISPLAY_NAMES[face] as HypercubeFaceTag)
      .filter(Boolean);

    const placed = elements.map((el) => ({
      ...el,
      x: el.x + dx,
      y: el.y + dy,
      ...(hypercubeTags.length > 0 ? { hypercubeTags } : {}),
    }));

    store.addCanvasElements(placed);

    return {
      success: true,
      title: (data as { title?: string }).title,
      count: placed.length,
    };
  } catch (error) {
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
