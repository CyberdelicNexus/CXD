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
  FreeformElement,
  ImageElement,
  LineElement,
  ElementStyle,
  CanvasEdge,
  HypercubeFaceTag,
} from '@/types/canvas-elements';
import { HYPERCUBE_FACE_TAGS } from '@/types/canvas-elements';
import { RENDER_FLOORS, realBounds, overlaps, GRID_PX, CONTAINER_HEADER_PX } from '@/lib/canvas-layout-rules';

export const TINT_COLORS = ['violet', 'ocean', 'emerald', 'sunset', 'rose', 'glacier'] as const;
export const SHAPE_TYPES = ['rectangle', 'circle', 'diamond', 'triangle', 'hexagon', 'star'] as const;

// Non-empty tuple form of the canonical face-tag list for z.enum.
const HYPERCUBE_TAG_VALUES = HYPERCUBE_FACE_TAGS as [HypercubeFaceTag, ...HypercubeFaceTag[]];

export const generatedElementSchema = z.object({
  kind: z.enum(['container', 'text', 'shape', 'freeform', 'image', 'line']),
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
  // Type-specific extras as a JSON object string. Kept as one field rather than
  // ~15 more typed columns because Anthropic's structured output caps both
  // union-typed (<=16) and optional (<=24) parameters per schema; every value
  // is whitelisted server-side in generatedToCanvas, so this loosens the
  // schema, never the validation.
  props: z
    .string()
    .nullable()
    .describe(
      'JSON object of extra properties for this kind. freeform: {"emoji":"💡","noteTitle":"...","noteBody":"...","cardType":"note"}. image: {"storyboard":true,"description":"caption"}. line: {"gradientName":"violet","widthPx":2,"kind":"solid"}. Omit or null when not needed.',
    ),
});

// Optional connectors between elements, for mind-map / flow structures.
export const generatedEdgeSchema = z.object({
  from: z.string().describe('ref of the source element (e.g. the central hub of a mind map)'),
  to: z.string().describe('ref of the target element (a branch or child idea)'),
  label: z.string().nullable().describe('Optional short connector label (1-3 words)'),
});

// NOTE: no .min()/.max() on these arrays. Anthropic's structured output rejects
// minItems/maxItems ("For 'array' type, property 'maxItems' is not supported"),
// which failed EVERY generateObject call for Claude users. The bounds are
// enforced in generatedToCanvas (MAX_ELEMENTS / MAX_EDGES) instead, and the
// route already 422s when zero usable elements come back.
export const generateElementsSchema = z.object({
  title: z.string().describe('Short name for the generated structure'),
  elements: z.array(generatedElementSchema).describe('1 to 60 elements'),
  edges: z
    .array(generatedEdgeSchema)
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
  /** ref -> real element id, for callers that must wire generated elements to
   *  something outside this batch (e.g. connecting a new node to an existing one). */
  idByRef: Map<string, string>;
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

/** Card fill gradients per tint family (templates.design.md §3). */
const TINT_GRADIENTS: Record<(typeof TINT_COLORS)[number], string> = {
  violet: 'linear-gradient(135deg, #2A0A3D 0%, #4B1B6B 50%, #0B2C5A 100%)',
  ocean: 'linear-gradient(135deg, #06243D 0%, #0B3D63 50%, #0A2540 100%)',
  emerald: 'linear-gradient(135deg, #052E22 0%, #0B5138 50%, #052E2E 100%)',
  sunset: 'linear-gradient(135deg, #3D1405 0%, #6B2E0B 50%, #45150B 100%)',
  rose: 'linear-gradient(135deg, #3D0A22 0%, #6B1B3E 50%, #3D0B2C 100%)',
  glacier: 'linear-gradient(135deg, #0A2A3D 0%, #17506B 50%, #10333F 100%)',
};

/** Parse the model's `props` JSON bag. Malformed input yields an empty bag —
 *  a bad extras blob must never cost us the element itself. */
function parseProps(raw: string | null | undefined): Record<string, unknown> {
  if (!raw || typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

const str = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.trim() ? v.slice(0, max) : undefined;
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;

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

const SIDE_PADDING = 24;
const CHILD_GUTTER = 24;

/**
 * Deterministic layout repair, applied to every AI-generated batch.
 *
 * Models are unreliable at spatial arithmetic: they size a container for the
 * dimensions they *stated* rather than the ones that *render* (a note card
 * stored at 140px paints 300px), so children escape their zone and collide.
 * Asking harder in the prompt does not fix this — measuring does. Anything the
 * rubric in canvas-layout-rules.ts can detect, this repairs before the user
 * ever sees a proposal.
 *
 * Conservative on purpose: children are only re-stacked when they ACTUALLY
 * collide or escape, so a deliberate multi-column arrangement survives.
 * Mutates in place.
 */
export function repairLayout(elements: CanvasElement[]): void {
  const snap = (n: number) => Math.round(n / GRID_PX) * GRID_PX;

  // 1. Everything on the 20px grid (templates.design.md §8).
  for (const el of elements) {
    if (el.type === 'line' || el.type === 'connector') continue;
    el.x = snap(el.x);
    el.y = snap(el.y);
  }

  // 2. Per container: make the zone actually contain its children.
  const containers = elements.filter((el) => el.type === 'container');
  for (const c of containers) {
    const children = elements.filter((el) => el.containerId === c.id);
    if (children.length === 0) continue;

    const boxOf = (el: CanvasElement) => realBounds(el) ?? { x: el.x, y: el.y, w: el.width, h: el.height };
    const escapes = children.some((el) => {
      const b = boxOf(el);
      return b.x < c.x || b.y < c.y || b.x + b.w > c.x + c.width || b.y + b.h > c.y + c.height;
    });
    const collide = children.some((a, i) =>
      children.some((b, j) => j > i && overlaps(boxOf(a), boxOf(b))),
    );

    if (escapes || collide) {
      // Re-stack in one column below the reserved header band.
      let cursor = c.y + CONTAINER_HEADER_PX + CHILD_GUTTER;
      for (const child of children) {
        const b = boxOf(child);
        child.x = snap(c.x + SIDE_PADDING);
        child.y = snap(cursor);
        cursor = child.y + b.h + CHILD_GUTTER;
      }
    }

    // 3. Grow the zone to enclose whatever the children now occupy. Never
    //    shrink: the model may have sized it generously for room to grow.
    let maxRight = c.x + c.width;
    let maxBottom = c.y + c.height;
    for (const child of children) {
      const b = boxOf(child);
      maxRight = Math.max(maxRight, b.x + b.w + SIDE_PADDING);
      maxBottom = Math.max(maxBottom, b.y + b.h + CHILD_GUTTER);
    }
    c.width = snap(maxRight - c.x);
    c.height = snap(maxBottom - c.y);
  }

  // 4. De-overlap top-level siblings. Free-floating layouts (mind maps, flows)
  //    are spaced by the model for the sizes it stated, so note cards -- which
  //    paint 300px tall whatever is stored -- routinely collide. Push each
  //    colliding element straight down rather than re-stacking, so a
  //    hub-and-spoke or left-to-right structure survives the repair.
  const boxOfAny = (el: CanvasElement) =>
    realBounds(el) ?? { x: el.x, y: el.y, w: el.width, h: el.height };
  const roots = elements.filter(
    (el) => !el.containerId && el.type !== 'line' && el.type !== 'connector',
  );
  const placed: CanvasElement[] = [];
  for (const el of roots) {
    let guard = 0;
    // eslint-disable-next-line no-constant-condition
    while (guard++ < 200) {
      const b = boxOfAny(el);
      const clash = placed.find((p) => overlaps(b, boxOfAny(p)));
      if (!clash) break;
      const cb = boxOfAny(clash);
      el.y = snap(cb.y + cb.h + CHILD_GUTTER);
    }
    placed.push(el);
  }
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
    } else if (g.kind === 'shape') {
      const shape: ShapeElement = {
        ...base,
        type: 'shape',
        zIndex: 1,
        shapeType: g.shapeType ?? 'rectangle',
        content: g.content ? g.content.slice(0, 80) : undefined,
        style: shapeStyle,
      };
      elements.push(shape);
    } else if (g.kind === 'freeform') {
      // Note seed (templates.design.md §4): the editable starter card. Mirrors
      // the shape note-creation-service produces so AI notes and user notes are
      // indistinguishable once placed.
      const p = parseProps(g.props);
      const tint = g.tint ?? TINT_COLORS[tintIdx++ % TINT_COLORS.length];
      const noteTitle = str(p.noteTitle, MAX_LABEL_LEN) ?? str(g.label, MAX_LABEL_LEN) ?? 'Note';
      const noteBody = str(p.noteBody, MAX_TEXT_LEN) ?? str(g.content, MAX_TEXT_LEN) ?? '';
      const cardType = oneOf(p.cardType, ['note', 'task'] as const) ?? 'note';
      // Note cards paint at a CSS floor of 200x300 whatever we store. Storing
      // anything smaller makes every downstream layout calculation (overlap
      // checks, container bounds, the user's own eye) disagree with the screen.
      const floor = cardType === 'note' ? RENDER_FLOORS.noteCard : { width: 0, height: 0 };
      const freeform: FreeformElement = {
        ...base,
        width: Math.max(base.width, floor.width),
        height: Math.max(base.height, floor.height),
        type: 'freeform',
        zIndex: 1,
        cardType,
        content: '',
        noteTitle,
        noteBody,
        ...(bool(p.hideNoteTitle) !== undefined ? { hideNoteTitle: bool(p.hideNoteTitle) } : {}),
        ...(str(p.emoji, 8) ? { emoji: str(p.emoji, 8) } : {}),
        style: { bgColor: TINT_GRADIENTS[tint], textColor: '#ffffff' },
      };
      elements.push(freeform);
    } else if (g.kind === 'image') {
      // Storyboard seed: empty src renders the upload affordance already framed.
      const p = parseProps(g.props);
      const image: ImageElement = {
        ...base,
        type: 'image',
        zIndex: 1,
        src: '',
        alt: str(g.label, MAX_LABEL_LEN) ?? 'Image',
        storyboard: bool(p.storyboard) ?? true,
        description: str(p.description, MAX_LABEL_LEN) ?? str(g.content, MAX_LABEL_LEN) ?? '',
        objectFit: 'cover',
      };
      elements.push(image);
    } else {
      // Divider / rule (templates.design.md §2). Lines carry their own
      // start/end world coords rather than width/height.
      const p = parseProps(g.props);
      const line: LineElement = {
        ...base,
        type: 'line',
        zIndex: 1,
        start: { x: base.x, y: base.y },
        end: { x: base.x + base.width, y: base.y },
        style: {
          kind: oneOf(p.kind, ['solid', 'dashed', 'dotted'] as const) ?? 'solid',
          widthPx: typeof p.widthPx === 'number' ? clamp(p.widthPx, 1, 12) : 2,
          ...(oneOf(p.gradientName, TINT_COLORS) ? { gradientName: oneOf(p.gradientName, TINT_COLORS) } : {}),
        },
      };
      elements.push(line);
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

  repairLayout(elements);

  // Only expose refs that actually produced an element.
  const liveIdByRef = new Map<string, string>();
  idByRef.forEach((id, ref) => {
    if (elementIds.has(id)) liveIdByRef.set(ref, id);
  });

  return { elements, edges, idByRef: liveIdByRef };
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
- PREFER 'freeform' note cards over bare 'text' for anything the designer will edit and build on — they are the primary card type on this canvas. Size ~300x300. Give every zone at least one seeded note card rather than leaving it empty. Use props: {"emoji":"💡","noteTitle":"Names the move","noteBody":"Concrete starter content","cardType":"note"}. Pick an emoji that fits the idea (🔆 🔥 💡 🎯 🧭 🌊 …).
- 'image' seeds a storyboard frame (empty upload slot + caption): ~320x260, props {"storyboard":true,"description":"caption placeholder"}.
- 'line' is a divider/underline only — never a connection between elements (use edges for that). It spans from (x,y) to (x+width, y); props {"gradientName":"violet","widthPx":2}. A thin divider under a container title is the house style.
- Prefer a clear structure: a grid or left-to-right flow of containers, each seeded with 2-5 text elements of concrete, useful starter content (never generic filler like "Add text here").
- Use each ref exactly once, like c1, c2, t1, t2, s1.
- Hypercube face tags: set 'hypercubeTags' ONLY on containers and top-level elements, and only from this exact list: ${HYPERCUBE_FACE_TAGS.join(', ')}. Tag a CONTAINER with the union of the faces its children relate to — do NOT tag the child text/shape elements individually (children inherit their container's tags automatically). Most elements need no tags; add them only when the semantic fit is clear.
- Mind maps: when the content is conceptual (a central idea that branches into sub-ideas), build a mind map instead of containers — one central hub element (a short text node) with each branch as its own top-level text/shape element, and add 'edges' connecting hub→branch (and branch→sub-branch for deeper trees). Give edges a short 'label' only when it clarifies the relationship. Coordinates are recomputed server-side, so focus on expressing the hub-and-branch structure via edges, not on exact positions.`;
