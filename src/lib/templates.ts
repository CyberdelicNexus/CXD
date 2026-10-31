import type { CanvasElement, CanvasEdge } from '@/types/canvas-elements';
import { QUICKSTART_TEMPLATES } from './templates-quickstart';
import { CLASSIC_TEMPLATES } from './templates-classics';
import { EXPERIENCE_TEMPLATES } from './templates-experience';
import { FRAMEWORK_TEMPLATES, FREE_FRAMEWORK_IDS } from './templates-frameworks';

export type TemplateCategory = 'experience' | 'product-brand' | 'creative' | 'framework';

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  experience: 'Experience Design',
  'product-brand': 'Product & Brand',
  creative: 'Creative & General',
  framework: 'Frameworks',
};

/** Where in the life of an experience a framework earns its keep. Order = display order. */
export type FrameworkStage = 'think' | 'ideate' | 'plan' | 'ship' | 'market' | 'distribute' | 'sell';

export const FRAMEWORK_STAGES: readonly FrameworkStage[] = ['think', 'ideate', 'plan', 'ship', 'market', 'distribute', 'sell'];

export const FRAMEWORK_STAGE_LABELS: Record<FrameworkStage, string> = {
  think: 'Think',
  ideate: 'Ideate',
  plan: 'Plan',
  ship: 'Ship',
  market: 'Market',
  distribute: 'Distribute',
  sell: 'Sell',
};

export interface FrameworkStep {
  title: string;
  detail: string;
}

/**
 * The explainer and coaching brief that turn a template into a framework.
 * The canvas template carries one numbered step card per `steps` entry with the
 * same title (checked by src/lib/__verify__/frameworks-registry.verify.ts).
 */
export interface FrameworkMeta {
  stage: FrameworkStage;
  /** Attribution line, e.g. "Gary Klein, 2007". */
  origin: string;
  /** Canonical public reference when one exists. */
  sourceUrl?: string;
  /** 2–3 sentences. */
  whatItIs: string;
  /** 3–4 bullets. */
  whenToUse: string[];
  /** 4–7 steps. */
  steps: FrameworkStep[];
  /** 2–4 bullets. */
  pitfalls: string[];
  /** ~150 words, imperative. Appended to the assistant's system prompt server-side. */
  assistantBrief: string;
}

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
  /** Present iff category === 'framework'. */
  framework?: FrameworkMeta;
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

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

/** Lines contribute their start/end points; everything else its x/y/w/h box. */
function elementsBounds(elements: CanvasElement[]): Bounds | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    if (el.type === 'line' && 'start' in el && 'end' in el) {
      const l = el as any;
      minX = Math.min(minX, l.start.x, l.end.x);
      minY = Math.min(minY, l.start.y, l.end.y);
      maxX = Math.max(maxX, l.start.x, l.end.x);
      maxY = Math.max(maxY, l.start.y, l.end.y);
    } else if (Number.isFinite(el.x) && Number.isFinite(el.y)) {
      // Live canvases can hold legacy elements with no size; a NaN here would
      // reach every inserted element through the offset.
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + (el.width || 0));
      maxY = Math.max(maxY, el.y + (el.height || 0));
    }
  }
  return minX === Infinity ? null : { minX, minY, maxX, maxY };
}

/**
 * Bounding box of a template's elements (for post-insert viewport fitting).
 * Interior elements (pre-seeded board contents) live in another board's
 * coordinate space, so they must not skew the fit.
 */
export function templateBounds(elements: CanvasElement[]): Bounds | null {
  return elementsBounds(elements.filter((el) => !el.boardId));
}

/** Gap between what is already on a surface and a template inserted beside it. */
const TEMPLATE_INSERT_GAP = 200;
const TEMPLATE_GRID = 20;

/**
 * What a picker insert lands beside: elements of the given board (null = root)
 * on the canvas surface, inbox items excluded. Templates stamp surface 'canvas'
 * on every element, so this is the canvas surface even when the hypercube view
 * is active, which is why it isn't the store's getCanvasElements().
 */
export function templateInsertSurface(elements: CanvasElement[], boardId: string | null): CanvasElement[] {
  return elements.filter((el) =>
    !el.inInbox
    && (el.boardId ?? null) === boardId
    && (el.surface ?? 'canvas') === 'canvas');
}

/**
 * Offset that puts a template clear of existing content: left edge 200px past
 * the existing right edge, top aligned with the existing top, on the 20px grid.
 * The gap rounds up so it is never under 200. Empty surface: no offset.
 * `existing` must already be one surface (see templateInsertSurface); unlike
 * templateBounds it counts every element, because inside a board they all carry
 * a boardId.
 */
export function templateInsertOffset(existing: CanvasElement[], templateElements: CanvasElement[]): { dx: number; dy: number } {
  const occupied = elementsBounds(existing);
  const incoming = templateBounds(templateElements);
  if (!occupied || !incoming) return { dx: 0, dy: 0 };
  return {
    dx: Math.ceil((occupied.maxX + TEMPLATE_INSERT_GAP - incoming.minX) / TEMPLATE_GRID) * TEMPLATE_GRID,
    dy: Math.round((occupied.minY - incoming.minY) / TEMPLATE_GRID) * TEMPLATE_GRID,
  };
}

/**
 * Shift a template's root elements by (dx, dy). Interior elements keep their
 * board's coordinates. Lines move their x/y and start/end/bend together, as a
 * canvas drag does. Edges aren't touched: they follow their nodes, and the
 * canvas ignores edge.bend, which no template sets.
 */
export function offsetTemplateElements(elements: CanvasElement[], dx: number, dy: number): CanvasElement[] {
  const move = (p: { x: number; y: number }) => ({ x: p.x + dx, y: p.y + dy });
  return elements.map((el) => {
    if (el.boardId) return el;
    const moved = { ...el, ...move(el) };
    if (moved.type === 'line') {
      moved.start = move(moved.start);
      moved.end = move(moved.end);
      if (moved.bend) moved.bend = move(moved.bend);
    }
    return moved;
  });
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
  // Frameworks: method explainer + guided layout + assistant brief.
  ...FRAMEWORK_TEMPLATES,
];

/**
 * Templates insertable on the free tier (templateAccess 'quickstart').
 * The full catalog stays VISIBLE to free users in the picker — deliberately,
 * as a showroom — but only these ids can be inserted. The AI Composer route
 * (/api/ai/suggest-template) filters its candidate catalog with this same
 * set so it never recommends a template the caller can't insert.
 */
export const FREE_TEMPLATE_IDS: ReadonlySet<string> = new Set([
  ...QUICKSTART_TEMPLATES.map((t) => t.id),
  ...FREE_FRAMEWORK_IDS,
]);

export function isTemplateFree(templateId: string): boolean {
  return FREE_TEMPLATE_IDS.has(templateId);
}

/**
 * What the AI Composer may recommend after framing: experience structures,
 * never thinking methods. Frameworks are reached from the Frameworks tab.
 */
export const COMPOSER_TEMPLATES: TemplateDefinition[] = TEMPLATES.filter((t) => t.category !== 'framework');

export function getFrameworkTemplate(id: string): TemplateDefinition | undefined {
  const t = TEMPLATES.find((x) => x.id === id);
  return t && t.category === 'framework' && t.framework ? t : undefined;
}

export function getFrameworkBrief(id: string): string | undefined {
  return getFrameworkTemplate(id)?.framework?.assistantBrief;
}

export interface FrameworkStageGroup {
  stage: FrameworkStage;
  label: string;
  templates: TemplateDefinition[];
}

/** Frameworks grouped by stage in FRAMEWORK_STAGES order; empty stages omitted. */
export function frameworkTemplatesByStage(list: TemplateDefinition[] = FRAMEWORK_TEMPLATES): FrameworkStageGroup[] {
  return FRAMEWORK_STAGES
    .map((stage) => ({
      stage,
      label: FRAMEWORK_STAGE_LABELS[stage],
      templates: list.filter((t) => t.framework?.stage === stage),
    }))
    .filter((g) => g.templates.length > 0);
}
