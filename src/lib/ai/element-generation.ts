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
  TableElement,
  TableCell,
  LinkElement,
  BoardElement,
  ExperienceBlockElement,
  InspectorSectionId,
  ElementStyle,
  CanvasEdge,
  HypercubeFaceTag,
} from '@/types/canvas-elements';
import { HYPERCUBE_FACE_TAGS } from '@/types/canvas-elements';
import { RENDER_FLOORS, realBounds, overlaps, GRID_PX, CONTAINER_HEADER_PX } from '@/lib/canvas-layout-rules';
import { CANVAS_COMPOSITION_SKILL } from './canvas-skill';

export const TINT_COLORS = ['violet', 'ocean', 'emerald', 'sunset', 'rose', 'glacier'] as const;
export const SHAPE_TYPES = [
  'rectangle', 'circle', 'diamond', 'triangle', 'hexagon', 'star',
  'pill', 'parallelogram', 'cylinder', 'document', 'callout',
] as const;

type Tint = (typeof TINT_COLORS)[number];

/** How a diagram node is painted (props.look on a shape). */
export const SHAPE_LOOKS = ['outline', 'filled', 'ghost'] as const;
/** What a floating text element is for (props.role on a text). */
export const TEXT_ROLES = ['title', 'heading', 'label', 'caption', 'body'] as const;

// Non-empty tuple form of the canonical face-tag list for z.enum.
const HYPERCUBE_TAG_VALUES = HYPERCUBE_FACE_TAGS as [HypercubeFaceTag, ...HypercubeFaceTag[]];

export const generatedElementSchema = z.object({
  kind: z.enum([
    'container', 'text', 'shape', 'freeform', 'image', 'line',
    'table', 'link', 'board', 'experienceBlock',
  ]),
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
  tint: z
    .enum(TINT_COLORS)
    .nullable()
    .describe('Colour family for this element: frame outline, node ring, heading gradient, note fill, portal hex'),
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
      'JSON object of extra properties for this kind. shape: {"look":"outline","fontSize":16}. text: {"role":"heading","align":"center"}. container: {"titled":false}. freeform: {"emoji":"💡","noteTitle":"...","noteBody":"...","cardType":"note"}. image: {"storyboard":true,"description":"caption"}. line: {"gradientName":"violet","widthPx":2,"kind":"solid"}. Omit or null when not needed.',
    ),
});

// Optional connectors between elements, for mind-map / flow structures.
export const generatedEdgeSchema = z.object({
  from: z.string().describe('ref of the source element (e.g. the central hub of a mind map)'),
  to: z.string().describe('ref of the target element (a branch or child idea)'),
  label: z.string().nullable().describe('Optional short connector label (1-3 words)'),
  props: z
    .string()
    .nullable()
    .describe(
      'JSON object of connector styling. {"gradientName":"ocean","lineStyle":"dashed","thickness":3,"arrowStyle":"both"}. Rotate gradientName per branch so parallel paths read apart.',
    ),
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

const clamp = (v: number, min: number, max: number) =>
  Number.isFinite(v) ? Math.min(Math.max(v, min), max) : min;

/** Hexagon portal fills per tint family (templates.design.md §5). */
export const BOARD_HEX_COLORS: Record<(typeof TINT_COLORS)[number], string> = {
  violet: '#4B1B6B',
  ocean: '#0B3D63',
  emerald: '#0B5138',
  sunset: '#6B2E0B',
  rose: '#6B1B3E',
  glacier: '#17506B',
};

/** Framing sections an experienceBlock may anchor to. */
export const INSPECTOR_SECTION_IDS = [
  'intentionCore', 'desiredChange', 'humanContext', 'contextAndMeaning',
  'realityPlanes', 'sensoryDomains', 'presenceTypes', 'stateMapping', 'traitMapping',
] as const satisfies readonly InspectorSectionId[];

/**
 * Card fill gradients per tint family (templates.design.md §3). Deliberately
 * near-black with only a hint of the family hue: a note is a surface to read
 * text on, and on this canvas the colour belongs to rings, headings and
 * connectors. The earlier mid-saturation fills glared against the background.
 */
export const TINT_GRADIENTS: Record<Tint, string> = {
  violet: 'linear-gradient(135deg, #140A20 0%, #22113A 55%, #0C162E 100%)',
  ocean: 'linear-gradient(135deg, #071523 0%, #0C263F 55%, #08172A 100%)',
  emerald: 'linear-gradient(135deg, #05160F 0%, #0A2B20 55%, #061E1D 100%)',
  sunset: 'linear-gradient(135deg, #1C0C05 0%, #36190A 55%, #220F0A 100%)',
  rose: 'linear-gradient(135deg, #1D0813 0%, #371124 55%, #1E0A1A 100%)',
  glacier: 'linear-gradient(135deg, #0A151E 0%, #122C3A 55%, #0C1B24 100%)',
};

/** Two-hue outline per tint family: the ring of a diagram node. */
export const TINT_RINGS: Record<Tint, string> = {
  violet: 'linear-gradient(135deg, #A855F7, #22D3EE)',
  ocean: 'linear-gradient(135deg, #60A5FA, #34D399)',
  emerald: 'linear-gradient(135deg, #34D399, #22D3EE)',
  sunset: 'linear-gradient(135deg, #F59E0B, #EF4444)',
  rose: 'linear-gradient(135deg, #F472B6, #A78BFA)',
  glacier: 'linear-gradient(135deg, #94A3B8, #E2E8F0)',
};

/** Gradient text per tint family: floating titles and headings. */
export const TINT_TEXT_GRADIENTS: Record<Tint, string> = {
  violet: 'linear-gradient(90deg, #A78BFA, #22D3EE)',
  ocean: 'linear-gradient(90deg, #60A5FA, #34D399)',
  emerald: 'linear-gradient(90deg, #34D399, #22D3EE)',
  sunset: 'linear-gradient(90deg, #F97316, #C084FC)',
  rose: 'linear-gradient(90deg, #C084FC, #F472B6)',
  glacier: 'linear-gradient(90deg, #E2E8F0, #94A3B8)',
};

/** Dark node fills per tint family, for look "filled". */
const TINT_NODE_FILLS: Record<Tint, string> = {
  violet: 'linear-gradient(135deg, #1B0E2E, #0E1A36)',
  ocean: 'linear-gradient(135deg, #0A1C30, #0A2A2E)',
  emerald: 'linear-gradient(135deg, #07201A, #082630)',
  sunset: 'linear-gradient(135deg, #2A1206, #2A0C10)',
  rose: 'linear-gradient(135deg, #2A0C1C, #1C1030)',
  glacier: 'linear-gradient(135deg, #101C26, #18242E)',
};

/**
 * Diagram-node styling. `outline` is the house look: a near-black body with a
 * two-hue ring and bold white text, so a flow reads by its rings and
 * connectors instead of by slabs of colour. Weights are CSS keywords because
 * ShapeCard and TextCard pass fontWeight straight to inline CSS, where
 * "semibold" and "medium" are silently dropped.
 */
function nodeStyle(tint: Tint, look: (typeof SHAPE_LOOKS)[number], fontSize: number): ElementStyle {
  const text = { textColor: '#ffffff', fontSize, fontWeight: 'bold' as const };
  if (look === 'filled') {
    return { bgColor: TINT_NODE_FILLS[tint], fillOpacity: 95, borderColor: TINT_RINGS[tint], borderWidth: 2, ...text };
  }
  if (look === 'ghost') {
    return { bgColor: 'transparent', fillOpacity: 0, borderColor: TINT_RINGS[tint], borderWidth: 2, ...text };
  }
  return { bgColor: '#0B0E17', fillOpacity: 90, borderColor: TINT_RINGS[tint], borderWidth: 2, ...text };
}

const TEXT_ROLE_STYLE: Record<
  (typeof TEXT_ROLES)[number],
  { fontSize: number; fontWeight: 'normal' | 'bold'; color: string | null }
> = {
  title: { fontSize: 30, fontWeight: 'bold', color: null },
  heading: { fontSize: 20, fontWeight: 'bold', color: null },
  label: { fontSize: 12, fontWeight: 'bold', color: 'rgba(255,255,255,0.72)' },
  caption: { fontSize: 13, fontWeight: 'normal', color: 'rgba(255,255,255,0.55)' },
  body: { fontSize: 14, fontWeight: 'normal', color: 'rgba(255,255,255,0.85)' },
};

/** Mirrors TextCard: 4px padding and a 1.3 line height (canvas-element.tsx). */
const TEXT_PAD_PX = 4;
const TEXT_LINE_HEIGHT = 1.3;

/**
 * Height a text element paints at for its width. TextCard always grows to its
 * content, but only writes that height back while the element is selected, so
 * a model-guessed height leaves every layout calculation disagreeing with the
 * screen until the user touches it.
 */
export function estimateTextHeight(content: string, width: number, fontSize: number, bold = false): number {
  const charW = fontSize * (bold ? 0.62 : 0.55);
  const perLine = Math.max(4, Math.floor((width - TEXT_PAD_PX * 2) / charW));
  let lines = 0;
  for (const line of (content || '').split('\n')) lines += Math.max(1, Math.ceil(line.length / perLine));
  return Math.ceil(Math.max(1, lines) * fontSize * TEXT_LINE_HEIGHT) + TEXT_PAD_PX * 2;
}

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

export interface EdgeGeometry {
  from: { x: number; y: number; w: number; h: number };
  to: { x: number; y: number; w: number; h: number };
}

/**
 * World-space control point for a quadratic connector: the midpoint between
 * the two element centres, pushed `offset` px along the perpendicular.
 * CanvasEdge.bend is a WORLD coordinate, not an offset.
 */
export function bendPoint(g: EdgeGeometry, offset: number): { x: number; y: number } {
  const ax = g.from.x + g.from.w / 2;
  const ay = g.from.y + g.from.h / 2;
  const bx = g.to.x + g.to.w / 2;
  const by = g.to.y + g.to.h / 2;
  const len = Math.hypot(bx - ax, by - ay) || 1;
  return {
    x: (ax + bx) / 2 + (-(by - ay) / len) * offset,
    y: (ay + by) / 2 + ((bx - ax) / len) * offset,
  };
}

/**
 * Standard AI-authored connector between two element ids. `props` is the
 * model's optional styling bag; every value is whitelisted here, with a violet
 * solid arrow as the house default (templates.design.md §6). A requested bend
 * is only applied when `geometry` is known, because the control point must be
 * placed in world space.
 */
export function buildConnectorEdge(
  fromId: string,
  toId: string,
  label?: string,
  props?: string | null,
  geometry?: EdgeGeometry,
): CanvasEdge {
  const trimmed = label?.trim();
  const p = parseProps(props);
  const offset = typeof p.bend === 'number' && Number.isFinite(p.bend) ? clamp(p.bend, -400, 400) : 0;
  const bend = offset !== 0 && geometry ? bendPoint(geometry, offset) : null;
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
    style: {
      thickness: typeof p.thickness === 'number' ? clamp(p.thickness, 1, 8) : 2,
      lineStyle: oneOf(p.lineStyle, ['solid', 'dashed', 'dotted'] as const) ?? 'solid',
      gradientName: oneOf(p.gradientName, TINT_COLORS) ?? 'violet',
      arrowStyle: oneOf(p.arrowStyle, ['none', 'start', 'end', 'both'] as const) ?? 'end',
    },
    ...(bend ? { bend } : {}),
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
      // An untitled frame has no header bar to clear.
      const headerPx = (c as ContainerElement).hideLabel ? 0 : CONTAINER_HEADER_PX;
      let cursor = c.y + headerPx + CHILD_GUTTER;
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

  // Frames whose name is already carried by a floating heading inside them.
  const headedContainerRefs = new Set<string>();
  for (const g of items) {
    if (g.kind !== 'text' || !g.parentRef) continue;
    const role = oneOf(parseProps(g.props).role, TEXT_ROLES);
    if (role === 'title' || role === 'heading') headedContainerRefs.add(g.parentRef);
  }
  // One family for every untinted node in the batch: a flow whose nodes each
  // took the next colour in the rotation would read as a legend that isn't there.
  const batchNodeTint: Tint = items.find((g) => g.kind === 'shape' && g.tint)?.tint ?? 'violet';

  const elements: CanvasElement[] = [];
  const elementIds = new Set<string>();
  const tintByContainerRef = new Map<string, Tint>();
  let tintIdx = 0;

  for (const g of items) {
    const isChild = !!(g.parentRef && containerRefs.has(g.parentRef) && g.parentRef !== g.ref);
    const parentTint = isChild ? tintByContainerRef.get(g.parentRef!) : undefined;
    // The typed field wins; props.tint is accepted too, since that is where the
    // operations schema carries it and models reuse the habit here.
    const ownTint: Tint | null = g.tint ?? oneOf(parseProps(g.props).tint, TINT_COLORS) ?? null;
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
      // A container is an outline frame: its header bar stays hidden and a
      // floating text heading names it. The header only comes back when the
      // model asks for it, or when nothing inside would otherwise say what the
      // frame is ("titled": false is the explicit "just an outline").
      const p = parseProps(g.props);
      const tint = ownTint ?? TINT_COLORS[tintIdx++ % TINT_COLORS.length];
      tintByContainerRef.set(g.ref, tint);
      const label = (g.label || g.content || '').trim().slice(0, MAX_LABEL_LEN);
      const titled = bool(p.titled) ?? (!!label && !headedContainerRefs.has(g.ref));
      const container: ContainerElement = {
        ...base,
        type: 'container',
        zIndex: 0,
        containerId: undefined, // no nested containers in v1
        label: label || 'Section',
        hideLabel: !titled,
        tintColor: tint,
        collapsed: false,
        style: containerStyle,
      };
      elements.push(container);
    } else if (g.kind === 'text') {
      const content = (g.content || g.label || '').slice(0, MAX_TEXT_LEN);
      if (!content.trim()) continue;
      const p = parseProps(g.props);
      const role = oneOf(p.role, TEXT_ROLES);
      const textAlign = oneOf(p.align, ['left', 'center', 'right'] as const) ?? 'left';
      if (!role) {
        elements.push({ ...base, type: 'text', zIndex: 1, content, style: textStyle, textAlign } as TextElement);
      } else {
        // Floating typography. Titles and headings take the family's gradient
        // (TextCard paints style.bgColor as background-clip text); the quieter
        // roles stay neutral so they recede behind the diagram.
        const rs = TEXT_ROLE_STYLE[role];
        const gradient = rs.color === null && bool(p.plain) !== true
          ? TINT_TEXT_GRADIENTS[ownTint ?? parentTint ?? batchNodeTint]
          : undefined;
        const text: TextElement = {
          ...base,
          height: estimateTextHeight(content, base.width, rs.fontSize, rs.fontWeight === 'bold'),
          type: 'text',
          zIndex: 1,
          content,
          style: {
            fontSize: rs.fontSize,
            fontWeight: rs.fontWeight,
            textColor: rs.color ?? '#ffffff',
            ...(gradient ? { bgColor: gradient } : {}),
          },
          textAlign,
        };
        elements.push(text);
      }
    } else if (g.kind === 'shape') {
      const p = parseProps(g.props);
      const fontSize = typeof p.fontSize === 'number'
        ? clamp(p.fontSize, 10, 40)
        : Math.min(base.width, base.height) < 70 ? 12 : base.width >= 200 ? 16 : 14;
      const shape: ShapeElement = {
        ...base,
        type: 'shape',
        zIndex: 1,
        shapeType: g.shapeType ?? oneOf(p.shapeType, SHAPE_TYPES) ?? 'rectangle',
        content: g.content ? g.content.slice(0, 80) : undefined,
        style: nodeStyle(ownTint ?? parentTint ?? batchNodeTint, oneOf(p.look, SHAPE_LOOKS) ?? 'outline', fontSize),
      };
      elements.push(shape);
    } else if (g.kind === 'freeform') {
      // Note seed (templates.design.md §4): the editable starter card. Mirrors
      // the shape note-creation-service produces so AI notes and user notes are
      // indistinguishable once placed.
      const p = parseProps(g.props);
      const tint = ownTint ?? parentTint ?? TINT_COLORS[tintIdx++ % TINT_COLORS.length];
      const noteTitle = str(p.noteTitle, MAX_LABEL_LEN) ?? str(g.label, MAX_LABEL_LEN) ?? 'Note';
      const noteBody = str(p.noteBody, MAX_TEXT_LEN) ?? str(g.content, MAX_TEXT_LEN) ?? '';
      const cardType = oneOf(p.cardType, ['note', 'task'] as const) ?? 'note';
      // Note cards paint at a CSS floor of 200x300 and task cards at 300x300
      // (taller with their properties panel) whatever we store. Storing
      // anything smaller makes every downstream layout calculation (overlap
      // checks, container bounds, the user's own eye) disagree with the screen.
      const floor = cardType === 'note' ? RENDER_FLOORS.noteCard : RENDER_FLOORS.taskCard;
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
    } else if (g.kind === 'table') {
      // Grid of editable cells. The model supplies a row-major string matrix;
      // it is normalised to exactly rows x cols so the renderer never indexes
      // past the end of a ragged row.
      const p = parseProps(g.props);
      const raw = Array.isArray(p.cells) ? (p.cells as unknown[]) : [];
      const grid = raw
        .filter((r): r is unknown[] => Array.isArray(r))
        .map((r) => r.map((c) => (typeof c === 'string' ? c.slice(0, 200) : '')));
      const rows = clamp(grid.length || (typeof p.rows === 'number' ? p.rows : 3), 1, 30);
      const cols = clamp(
        grid[0]?.length || (typeof p.cols === 'number' ? p.cols : 3),
        1,
        12,
      );
      const cells: TableCell[][] = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => ({ text: grid[r]?.[c] ?? '' })),
      );
      const table: TableElement = {
        ...base,
        type: 'table',
        zIndex: 1,
        rows,
        cols,
        cells,
        headerRow: bool(p.headerRow) ?? true,
        lineWidth: 1,
        lineColor: 'rgba(255,255,255,0.14)',
        tableBg: 'rgba(255,255,255,0.03)',
      };
      elements.push(table);
    } else if (g.kind === 'link') {
      const p = parseProps(g.props);
      const url = str(p.url, 500);
      if (!url) continue; // a link with no destination is not a link
      const link: LinkElement = {
        ...base,
        type: 'link',
        zIndex: 1,
        url,
        linkMode: oneOf(p.linkMode, ['bookmark', 'embed', 'file'] as const) ?? 'bookmark',
        title: str(g.label, MAX_LABEL_LEN) ?? str(p.title, MAX_LABEL_LEN) ?? url.slice(0, 60),
        description: str(g.content, MAX_LABEL_LEN) ?? '',
      };
      elements.push(link);
    } else if (g.kind === 'board') {
      // Portal into a nested canvas (templates.design.md §5). childBoardId is
      // minted here; the client registers the matching board record when the
      // batch is applied, so the hexagon always opens into something real.
      const p = parseProps(g.props);
      const tint = ownTint ?? TINT_COLORS[tintIdx++ % TINT_COLORS.length];
      const board: BoardElement = {
        ...base,
        type: 'board',
        zIndex: 1,
        childBoardId: crypto.randomUUID(),
        title: (str(g.label, MAX_LABEL_LEN) ?? str(g.content, MAX_LABEL_LEN) ?? 'Board'),
        icon: str(p.icon, 40) ?? 'grid',
        hexColor: str(p.hexColor, 40) ?? BOARD_HEX_COLORS[tint],
      };
      elements.push(board);
    } else if (g.kind === 'experienceBlock') {
      // Anchor onto live framing data (templates.design.md §9) — the handoff
      // that makes a layout part of the pipeline instead of a dead diagram.
      const p = parseProps(g.props);
      const componentKey = oneOf(p.componentKey, INSPECTOR_SECTION_IDS);
      if (!componentKey) continue; // without a real section it anchors to nothing
      const block: ExperienceBlockElement = {
        ...base,
        type: 'experienceBlock',
        zIndex: 1,
        componentKey,
        title: str(g.label, MAX_LABEL_LEN) ?? componentKey,
        viewMode: oneOf(p.viewMode, ['compact', 'inline'] as const) ?? 'compact',
      };
      elements.push(block);
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

  repairLayout(elements);

  // Second pass: remap edges ref→id, keeping only well-formed, non-duplicate
  // connectors between two distinct elements that actually made it into the batch.
  // Edges are built from FINAL positions: bends are world-space points, and
  // repairLayout may have moved elements.
  const boxById = new Map(elements.map((el) => [el.id, realBounds(el) ?? { x: el.x, y: el.y, w: el.width, h: el.height }]));
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
    edges.push(buildConnectorEdge(fromId, toId, e.label ?? undefined, e.props, { from: boxById.get(fromId)!, to: boxById.get(toId)! }));
  }

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
You turn content into a diagram on a spatial design canvas.
${CANVAS_COMPOSITION_SKILL}

HOW TO EXPRESS IT IN THIS SCHEMA
- «tint» is the 'tint' field. 'shapeType' is its own field. Everything else type-specific goes in 'props' as a JSON object string.
- Positions are recomputed for you, so do not spend effort on x/y (send 0). What you control is STRUCTURE and SIZE:
  - 'width' and 'height' are kept for nodes, tables and text, so use the sizes listed above.
  - 'edges' decide the arrangement. A closed ring of edges is laid out as a loop; one node with many edges becomes the hub of a mind map; anything else becomes a left-to-right flow in the direction of the edges. Chain stages with edges from each stage to the next, and hang each detail node off its stage with one more edge.
  - Elements with a 'parentRef' are stacked inside that frame in the order you list them, so put the heading first.
  - Text with no edges and no parent floats above the structure in list order (title, then caption) — or in the middle of a loop.
- Use each ref exactly once, like n1, n2, t1, f1.
- Hypercube face tags: set 'hypercubeTags' ONLY on frames and top-level elements, and only from this exact list: ${HYPERCUBE_FACE_TAGS.join(', ')}. Children inherit their frame's tags. Most elements need no tags; add them only when the semantic fit is clear.`;
