// Shared schema + conversion for AI canvas-element generation.
// The AI produces a simplified, generation-friendly shape; the server
// validates and converts it into real CanvasElement[] before returning
// anything to the client — the client never inserts raw model output.

import { z } from 'zod';
import type {
  CanvasElement,
  ContainerElement,
  TextElement,
  ShapeElement,
  ElementStyle,
  CanvasEdge,
  HypercubeFaceTag,
} from '@/types/canvas-elements';
import { HYPERCUBE_FACE_TAGS } from '@/types/canvas-elements';

export const TINT_COLORS = ['violet', 'ocean', 'emerald', 'sunset', 'rose', 'glacier'] as const;
export const SHAPE_TYPES = ['rectangle', 'circle', 'diamond', 'triangle', 'hexagon', 'star'] as const;

// Non-empty tuple form of the canonical face-tag list for z.enum.
const HYPERCUBE_TAG_VALUES = HYPERCUBE_FACE_TAGS as [HypercubeFaceTag, ...HypercubeFaceTag[]];

export const generatedElementSchema = z.object({
  kind: z.enum(['container', 'text', 'shape']),
  ref: z.string().describe('Unique short reference within this response, e.g. "c1", "t2"'),
  parentRef: z
    .string()
    .nullable()
    .describe('ref of the container this element sits inside, or null for top level'),
  label: z.string().nullable().describe('Header label (containers only)'),
  content: z
    .string()
    .nullable()
    .describe('Text content for text elements; short label or emoji for shapes'),
  tint: z.enum(TINT_COLORS).nullable().describe('Container tint color'),
  shapeType: z.enum(SHAPE_TYPES).nullable(),
  hypercubeTags: z
    .array(z.enum(HYPERCUBE_TAG_VALUES))
    .nullable()
    .describe(
      'Hypercube face tags — set ONLY on containers and top-level elements, NEVER on child elements inside a container. Tag a container with the UNION of the faces its children relate to.',
    ),
  x: z.number().describe('Absolute canvas x (children use absolute coords inside parent bounds)'),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

// Optional connectors between elements, for mind-map / flow structures.
export const generatedEdgeSchema = z.object({
  from: z.string().describe('ref of the source element (e.g. the central hub of a mind map)'),
  to: z.string().describe('ref of the target element (a branch or child idea)'),
  label: z.string().nullable().describe('Optional short connector label (1-3 words)'),
});

export const generateElementsSchema = z.object({
  title: z.string().describe('Short name for the generated structure'),
  elements: z.array(generatedElementSchema).min(1).max(60),
  edges: z
    .array(generatedEdgeSchema)
    .max(80)
    .nullable()
    .optional()
    .describe(
      'Connectors between elements (reference elements by ref). Emit these to build mind maps / concept graphs — a central hub element linked out to branch elements. Omit or leave empty for plain container layouts.',
    ),
});

export type GeneratedElement = z.infer<typeof generatedElementSchema>;
export type GeneratedEdge = z.infer<typeof generatedEdgeSchema>;

export interface GeneratedToCanvasResult {
  elements: CanvasElement[];
  edges: CanvasEdge[];
}

const MAX_ELEMENTS = 60;
const MAX_EDGES = 80;
const COORD_LIMIT = 50000;
const MAX_TEXT_LEN = 2000;
const MAX_LABEL_LEN = 120;
const MAX_EDGE_LABEL_LEN = 40;

const containerStyle: ElementStyle = {
  borderColor: 'rgba(255,255,255,0.15)',
  borderWidth: 1,
  borderStyle: 'dashed',
  bgColor: 'rgba(255,255,255,0.03)',
};

const textStyle: ElementStyle = {
  fontSize: 14,
  fontWeight: 'normal',
  textColor: 'rgba(255,255,255,0.85)',
};

const shapeStyle: ElementStyle = {
  bgColor: 'rgba(139,92,246,0.25)',
  textColor: '#c084fc',
};

const clamp = (v: number, min: number, max: number) =>
  Number.isFinite(v) ? Math.min(Math.max(v, min), max) : min;

/** Standard AI-authored connector between two existing element ids. */
export function buildConnectorEdge(fromId: string, toId: string, label?: string): CanvasEdge {
  const trimmed = label?.trim();
  return {
    id: crypto.randomUUID(),
    fromNodeId: fromId,
    toNodeId: toId,
    fromAnchor: 'right',
    toAnchor: 'left',
    fromAutoAnchor: true,
    toAutoAnchor: true,
    fromAnchorOffset: 0.5,
    toAnchorOffset: 0.5,
    boardId: null,
    surface: 'canvas',
    style: { thickness: 2, lineStyle: 'solid', gradientName: 'violet', arrowStyle: 'end' },
    ...(trimmed ? { label: { text: trimmed.slice(0, MAX_EDGE_LABEL_LEN) } } : {}),
  };
}

/** Keep only real face tags, deduped. Returns undefined when nothing valid. */
function sanitizeTags(tags: HypercubeFaceTag[] | null | undefined): HypercubeFaceTag[] | undefined {
  if (!tags || tags.length === 0) return undefined;
  const valid = tags.filter((t): t is HypercubeFaceTag => HYPERCUBE_FACE_TAGS.includes(t));
  if (valid.length === 0) return undefined;
  return Array.from(new Set(valid)).slice(0, HYPERCUBE_FACE_TAGS.length);
}

/**
 * Convert validated AI output into real CanvasElement[] + CanvasEdge[]: fresh
 * UUIDs, ref→id remapping, coordinate/size/length clamping, template-idiom
 * styles. Malformed items are dropped rather than failing the whole batch.
 *
 * Tag hygiene: only containers and top-level elements keep hypercubeTags —
 * any element that sits inside a container is stripped of its own tags (it
 * inherits its parent's at query time in the Map views, so tagging children
 * would just produce visual tag spam). Edges reference elements by ref and are
 * remapped to real ids, dropping any that don't resolve to two distinct
 * generated elements.
 */
export function generatedToCanvas(
  generated: GeneratedElement[],
  generatedEdges?: GeneratedEdge[] | null,
): GeneratedToCanvasResult {
  const items = generated.slice(0, MAX_ELEMENTS);

  // First pass: assign ids; only containers are valid parents
  const idByRef = new Map<string, string>();
  const containerRefs = new Set<string>();
  for (const g of items) {
    if (!idByRef.has(g.ref)) idByRef.set(g.ref, crypto.randomUUID());
    if (g.kind === 'container') containerRefs.add(g.ref);
  }

  const elements: CanvasElement[] = [];
  const elementIds = new Set<string>();
  let tintIdx = 0;

  for (const g of items) {
    const isChild = !!(g.parentRef && containerRefs.has(g.parentRef) && g.parentRef !== g.ref);
    // Strip tags from children — only containers and top-level elements carry them.
    const tags = isChild ? undefined : sanitizeTags(g.hypercubeTags);
    const base = {
      id: idByRef.get(g.ref)!,
      x: clamp(g.x, -COORD_LIMIT, COORD_LIMIT),
      y: clamp(g.y, -COORD_LIMIT, COORD_LIMIT),
      width: clamp(g.width, 20, 4000),
      height: clamp(g.height, 20, 4000),
      locked: false,
      boardId: null,
      surface: 'canvas' as const,
      containerId: isChild ? idByRef.get(g.parentRef!) : undefined,
      ...(tags ? { hypercubeTags: tags } : {}),
    };

    if (g.kind === 'container') {
      const container: ContainerElement = {
        ...base,
        type: 'container',
        zIndex: 0,
        containerId: undefined, // no nested containers in v1
        label: (g.label || g.content || 'Section').slice(0, MAX_LABEL_LEN),
        tintColor: g.tint ?? TINT_COLORS[tintIdx++ % TINT_COLORS.length],
        collapsed: false,
        style: containerStyle,
      };
      elements.push(container);
    } else if (g.kind === 'text') {
      const content = (g.content || g.label || '').slice(0, MAX_TEXT_LEN);
      if (!content.trim()) continue;
      const text: TextElement = {
        ...base,
        type: 'text',
        zIndex: 1,
        content,
        style: textStyle,
        textAlign: 'left',
      };
      elements.push(text);
    } else {
      const shape: ShapeElement = {
        ...base,
        type: 'shape',
        zIndex: 1,
        shapeType: g.shapeType ?? 'rectangle',
        content: g.content ? g.content.slice(0, 80) : undefined,
        style: shapeStyle,
      };
      elements.push(shape);
    }
    elementIds.add(base.id);
  }

  // Second pass: remap edges ref→id, keeping only well-formed, non-duplicate
  // connectors between two distinct elements that actually made it into the batch.
  const edges: CanvasEdge[] = [];
  const seenEdge = new Set<string>();
  for (const e of (generatedEdges || []).slice(0, MAX_EDGES)) {
    const fromId = idByRef.get(e.from);
    const toId = idByRef.get(e.to);
    if (!fromId || !toId || fromId === toId) continue;
    if (!elementIds.has(fromId) || !elementIds.has(toId)) continue;
    const key = `${fromId}->${toId}`;
    if (seenEdge.has(key)) continue;
    seenEdge.add(key);
    edges.push(buildConnectorEdge(fromId, toId, e.label ?? undefined));
  }

  return { elements, edges };
}

/** Back-compat thin wrapper: elements only (edges dropped). */
export function generatedToCanvasElements(generated: GeneratedElement[]): CanvasElement[] {
  return generatedToCanvas(generated).elements;
}

/** Canvas conventions the model must follow, appended to the system prompt. */
export const CANVAS_GENERATION_GUIDE = `
You generate elements for a spatial design canvas. Rules:
- Coordinates are absolute pixels; (0,0) is the top-left of the area you lay out. Keep everything within x 0..2400, y 0..1600 unless more room is genuinely needed.
- Containers are tinted section boxes: typically 340-480px wide, 260-600px tall, with a short 'label'. Never overlap two containers; leave at least 60px between them.
- Child elements (text, shapes) reference their container via parentRef and must sit fully inside the parent's bounds with at least 24px padding on every side. The first 56px below a container's top edge is reserved for its header.
- Text elements hold the actual content (questions, prompts, notes): usually 280-440px wide, 40-120px tall, fontSize is fixed at 14 so about 60 characters fit per line.
- Shapes (circle, diamond, hexagon...) are small accents 40-80px, content is a single emoji or 1-3 words.
- Prefer a clear structure: a grid or left-to-right flow of containers, each seeded with 2-5 text elements of concrete, useful starter content (never generic filler like "Add text here").
- Use each ref exactly once, like c1, c2, t1, t2, s1.
- Hypercube face tags: set 'hypercubeTags' ONLY on containers and top-level elements, and only from this exact list: ${HYPERCUBE_FACE_TAGS.join(', ')}. Tag a CONTAINER with the union of the faces its children relate to — do NOT tag the child text/shape elements individually (children inherit their container's tags automatically). Most elements need no tags; add them only when the semantic fit is clear.
- Mind maps: when the content is conceptual (a central idea that branches into sub-ideas), build a mind map instead of containers — one central hub element (a short text node) with each branch as its own top-level text/shape element, and add 'edges' connecting hub→branch (and branch→sub-branch for deeper trees). Give edges a short 'label' only when it clarifies the relationship. Coordinates are recomputed server-side, so focus on expressing the hub-and-branch structure via edges, not on exact positions.`;
