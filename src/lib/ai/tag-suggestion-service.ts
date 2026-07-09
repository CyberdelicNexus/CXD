/**
 * AI Tag Suggestion Service (client side)
 *
 * Collects untagged canvas elements, asks /api/ai/suggest-tags to classify
 * them onto hypercube faces, and (only when the user accepts) writes the
 * tags back through the store's per-element update path. Propose-only:
 * requesting suggestions never mutates the canvas.
 */

import { useCXDStore } from '@/store/cxd-store';
import { collectUntaggedItems, type TagSuggestion } from '@/lib/ai/tag-suggestion';
import type { CanvasElement, HypercubeFaceTag } from '@/types/canvas-elements';

export interface SuggestTagsResult {
  success: boolean;
  suggestions: EnrichedSuggestion[];
  /** untagged elements that had classifiable text */
  considered: number;
  insufficientCredits?: boolean;
  error?: string;
}

/** A suggestion joined with a short text preview of its element for the review UI. */
export interface EnrichedSuggestion extends TagSuggestion {
  preview: string;
}

function elementPreview(el: CanvasElement | undefined): string {
  if (!el) return '(element)';
  const anyEl = el as unknown as Record<string, unknown>;
  const raw =
    (anyEl.noteTitle as string) ||
    (anyEl.title as string) ||
    (anyEl.label as string) ||
    (anyEl.content as string) ||
    (anyEl.description as string) ||
    '(untitled)';
  const text = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 80 ? text.slice(0, 77) + '…' : text;
}

/**
 * Request tag suggestions for the current project's untagged elements.
 * Does not modify the canvas — returns proposals for review.
 */
export async function requestTagSuggestions(
  provider?: string
): Promise<SuggestTagsResult> {
  try {
    const store = useCXDStore.getState();
    const project = store.getCurrentProject();
    if (!project) {
      return { success: false, suggestions: [], considered: 0, error: 'No active project' };
    }

    const elements = project.canvasLayout?.elements || [];
    const { items } = collectUntaggedItems(elements);

    if (items.length === 0) {
      return {
        success: false,
        suggestions: [],
        considered: 0,
        error: 'No untagged elements with text to classify.',
      };
    }

    const response = await fetch('/api/ai/suggest-tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, provider }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        suggestions: [],
        considered: items.length,
        insufficientCredits: response.status === 402,
        error: (data as { error?: string }).error || `Suggestion failed (${response.status})`,
      };
    }

    const byId = new Map(elements.map((el) => [el.id, el]));
    const suggestions: EnrichedSuggestion[] = ((data as { suggestions?: TagSuggestion[] }).suggestions || [])
      .filter((s) => byId.has(s.id))
      .map((s) => ({ ...s, preview: elementPreview(byId.get(s.id)) }));

    return {
      success: true,
      suggestions,
      considered: (data as { considered?: number }).considered ?? items.length,
    };
  } catch (error) {
    return {
      success: false,
      suggestions: [],
      considered: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Apply accepted suggestions to the canvas. Merges (unions) with any tags the
 * element already has, so nothing is clobbered. Returns how many elements were
 * updated.
 */
export function applyTagSuggestions(
  accepted: Array<{ id: string; tags: HypercubeFaceTag[] }>
): number {
  const store = useCXDStore.getState();
  const project = store.getCurrentProject();
  if (!project) return 0;
  const byId = new Map((project.canvasLayout?.elements || []).map((el) => [el.id, el]));

  let updated = 0;
  for (const { id, tags } of accepted) {
    if (tags.length === 0) continue;
    const el = byId.get(id);
    if (!el) continue;
    const existing = el.hypercubeTags || [];
    const merged = Array.from(new Set([...existing, ...tags]));
    if (merged.length === existing.length) continue; // nothing new
    store.updateCanvasElement(id, { hypercubeTags: merged });
    updated++;
  }
  return updated;
}
