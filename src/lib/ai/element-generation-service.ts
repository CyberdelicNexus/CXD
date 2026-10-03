/**
 * AI Element Generation Service (client side)
 *
 * Calls /api/ai/generate-elements and places the returned CanvasElement[]
 * on the canvas through the store's batched, freeze-proof insertion path
 * (addCanvasElements → single Zustand set + one 'template-batch' Y.Doc
 * transaction, which also persists and broadcasts to collaborators).
 */

import type { CanvasElement, CanvasEdge, HypercubeFaceTag } from '@/types/canvas-elements';
import { useCXDStore } from '@/store/cxd-store';
import { elementsBoundingBox } from '@/lib/framing-to-canvas';
import { layoutDraftElements, findClearGroupOrigin, type BoundingBox } from '@/lib/ai/draft-layout';
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
    const edges = (data as { edges?: CanvasEdge[] }).edges || [];
    if (elements.length === 0) {
      return { success: false, count: 0, error: 'No elements generated' };
    }

    const store = useCXDStore.getState();
    const project = store.getCurrentProject();
    if (!project) {
      return { success: false, count: 0, error: 'No active project' };
    }

    // The model's own x/y are not spatially reliable (see draft-layout.ts
    // header) — recompute a real, non-overlapping structure first: each
    // container + its children becomes a grouped column, loose elements
    // flow into a grid, all shelf-packed with generous gaps. When the model
    // emitted connectors, this becomes a radial mind map instead.
    const laidOut = layoutDraftElements(elements, edges);
    const bbox = elementsBoundingBox(laidOut);

    // Then place that group in free space near the current viewport
    // center, offsetting clear of existing content when it would land on
    // top of it, instead of trusting the model's suggested coordinates.
    let dx = 0;
    let dy = 0;
    // Place into the board the user is currently inside (breadcrumb), not the root.
    const activeBoardId = store.activeBoardId ?? null;
    if (bbox) {
      const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const viewportH = typeof window !== 'undefined' ? window.innerHeight - 64 : 700;
      const center = {
        x: (viewportW / 2 - store.canvasPosition.x) / store.canvasZoom,
        y: (viewportH / 2 - store.canvasPosition.y) / store.canvasZoom,
      };
      const obstacles: BoundingBox[] = (project.canvasLayout?.elements || [])
        .filter(
          (el) =>
            !el.inInbox && (el.boardId ?? null) === activeBoardId && el.surface !== 'hypercube' && el.type !== 'line' &&
            el.width > 0 && el.height > 0
        )
        .map((el) => ({ minX: el.x, minY: el.y, maxX: el.x + el.width, maxY: el.y + el.height }));
      const groupSize = { width: bbox.maxX - bbox.minX, height: bbox.maxY - bbox.minY };
      const clearOrigin = findClearGroupOrigin(groupSize, center, obstacles);
      dx = clearOrigin.x - bbox.minX;
      dy = clearOrigin.y - bbox.minY;
    }

    const hypercubeTags: HypercubeFaceTag[] = (options.sourceFaces || [])
      .filter((face) => TAGGABLE_FACES.includes(face))
      .map((face) => FACE_DISPLAY_NAMES[face] as HypercubeFaceTag)
      .filter(Boolean);

    const placed = laidOut.map((el) => {
      const shifted = { ...el, x: el.x + dx, y: el.y + dy, boardId: activeBoardId };
      // Tag hygiene: only top-level elements and containers carry face tags.
      // Children inside a container inherit their parent's tags at query time
      // in the Map views, so tagging each child would just be chip spam.
      if (hypercubeTags.length > 0 && !el.containerId) {
        const merged = Array.from(new Set([...(el.hypercubeTags || []), ...hypercubeTags]));
        return { ...shifted, hypercubeTags: merged } as CanvasElement;
      }
      return shifted;
    });

    store.addCanvasElements(placed);
    // Insert connectors right after the elements so they share one undo entry
    // (addCanvasEdges is batched + freeze-proof and deliberately skips its own
    // history snapshot — see cxd-store.ts). Ids are preserved through layout.
    if (edges.length > 0) {
      store.addCanvasEdges(edges.map((e) => ({ ...e, boardId: activeBoardId })));
    }

    // Frame the camera on the freshly placed group, same UX as the wizard's
    // canvas handoff (completeWizard → setPendingCanvasFitBounds).
    const placedBbox = elementsBoundingBox(placed);
    if (placedBbox) store.setPendingCanvasFitBounds(placedBbox);

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
