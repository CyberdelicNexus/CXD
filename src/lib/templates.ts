import type { CanvasElement, CanvasEdge } from '@/types/canvas-elements';
import { QUICKSTART_TEMPLATES } from './templates-quickstart';
import { CLASSIC_TEMPLATES } from './templates-classics';
import { EXPERIENCE_TEMPLATES } from './templates-experience';

export type TemplateCategory = 'experience' | 'product-brand' | 'creative';

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  experience: 'Experience Design',
  'product-brand': 'Product & Brand',
  creative: 'Creative & General',
};

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: TemplateCategory;
  elements: CanvasElement[];
  /** Curved gradient connectors between template elements (endpoints reference
   *  element ids; remapped alongside them by instantiateTemplate). */
  edges?: CanvasEdge[];
}


/**
 * Re-map element IDs to fresh UUIDs while preserving containerId, childBoardId
 * and boardId references. Call this before adding template elements to a project.
 */
export function remapTemplateIds(elements: CanvasElement[]): CanvasElement[] {
  const idMap = new Map<string, string>();
  // First pass: assign new IDs
  for (const el of elements) {
    idMap.set(el.id, crypto.randomUUID());
    // Also map childBoardId for board elements
    if (el.type === 'board' && 'childBoardId' in el) {
      idMap.set((el as any).childBoardId, crypto.randomUUID());
    }
  }
  // Second pass: apply new IDs and remap containerId + childBoardId + boardId
  return elements.map((el) => {
    const remapped: any = {
      ...el,
      id: idMap.get(el.id)!,
    };
    if ('containerId' in el && el.containerId) {
      remapped.containerId = idMap.get(el.containerId) ?? el.containerId;
    }
    if (el.type === 'board' && 'childBoardId' in el) {
      remapped.childBoardId = idMap.get((el as any).childBoardId) ?? (el as any).childBoardId;
    }
    // Pre-seeded board interiors: elements whose boardId points at a template
    // board's childBoardId must follow it to the fresh id.
    if (el.boardId && idMap.has(el.boardId)) {
      remapped.boardId = idMap.get(el.boardId);
    }
    return remapped;
  });
}

/**
 * Instantiate a template for insertion: fresh UUIDs for every element AND edge,
 * with edge endpoints remapped alongside the elements they connect.
 */
export function instantiateTemplate(tpl: TemplateDefinition): { elements: CanvasElement[]; edges: CanvasEdge[] } {
  const idMap = new Map<string, string>();
  for (const el of tpl.elements) {
    idMap.set(el.id, crypto.randomUUID());
    if (el.type === 'board' && 'childBoardId' in el) {
      idMap.set((el as any).childBoardId, crypto.randomUUID());
    }
  }
  const elements = tpl.elements.map((el) => {
    const remapped: any = { ...el, id: idMap.get(el.id)! };
    if ('containerId' in el && el.containerId) {
      remapped.containerId = idMap.get(el.containerId) ?? el.containerId;
    }
    if (el.type === 'board' && 'childBoardId' in el) {
      remapped.childBoardId = idMap.get((el as any).childBoardId) ?? (el as any).childBoardId;
    }
    if (el.boardId && idMap.has(el.boardId)) {
      // Multilayer templates: interior elements reference a template board's
      // childBoardId — follow it to the fresh id.
      remapped.boardId = idMap.get(el.boardId);
    } else if (el.boardId == null) {
      // Root template elements: leave boardId to addCanvasElements' auto-fill
      // so inserting while INSIDE a board lands on that board, not the root.
      delete remapped.boardId;
    }
    return remapped as CanvasElement;
  });
  const edges = (tpl.edges ?? [])
    // Drop edges whose endpoints don't resolve — a broken endpoint would render
    // a connector to nowhere.
    .filter((e) => idMap.has(e.fromNodeId) && idMap.has(e.toNodeId))
    .map((e) => {
      const remapped: CanvasEdge = {
        ...e,
        id: crypto.randomUUID(),
        fromNodeId: idMap.get(e.fromNodeId)!,
        toNodeId: idMap.get(e.toNodeId)!,
      };
      // Interior edges follow their board like interior elements do.
      if (e.boardId && idMap.has(e.boardId)) {
        remapped.boardId = idMap.get(e.boardId)!;
      }
      return remapped;
    });
  return { elements, edges };
}

/**
 * Bounding box of a template's elements (for post-insert viewport fitting).
 * Lines contribute their start/end points; everything else its x/y/w/h box.
 */
export function templateBounds(elements: CanvasElement[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (elements.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    // Interior elements (pre-seeded board contents) live in another board's
    // coordinate space — they must not skew the root-canvas fit.
    if (el.boardId) continue;
    if (el.type === 'line' && 'start' in el && 'end' in el) {
      const l = el as any;
      minX = Math.min(minX, l.start.x, l.end.x);
      minY = Math.min(minY, l.start.y, l.end.y);
      maxX = Math.max(maxX, l.start.x, l.end.x);
      maxY = Math.max(maxY, l.start.y, l.end.y);
    } else {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }
  }
  return { minX, minY, maxX, maxY };
}

export const TEMPLATES: TemplateDefinition[] = [
  // Quickstart set — authored against src/lib/templates.design.md (gradient
  // edges, tinted zones, hexagon portals, experience-block anchors). Listed
  // first so they lead the picker.
  ...QUICKSTART_TEMPLATES,
  // One per experience element + the generic flow/timeline pair.
  ...EXPERIENCE_TEMPLATES,
  // Classic templates, rebuilt against the same design system.
  ...CLASSIC_TEMPLATES,
];

/**
 * Templates insertable on the free tier (templateAccess 'quickstart').
 * The full catalog stays VISIBLE to free users in the picker — deliberately,
 * as a showroom — but only these ids can be inserted. The AI Composer route
 * (/api/ai/suggest-template) filters its candidate catalog with this same
 * set so it never recommends a template the caller can't insert.
 */
export const FREE_TEMPLATE_IDS: ReadonlySet<string> = new Set(
  QUICKSTART_TEMPLATES.map((t) => t.id),
);

export function isTemplateFree(templateId: string): boolean {
  return FREE_TEMPLATE_IDS.has(templateId);
}
