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
} from '@/types/canvas-elements';

export const TINT_COLORS = ['violet', 'ocean', 'emerald', 'sunset', 'rose', 'glacier'] as const;
export const SHAPE_TYPES = ['rectangle', 'circle', 'diamond', 'triangle', 'hexagon', 'star'] as const;

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
  x: z.number().describe('Absolute canvas x (children use absolute coords inside parent bounds)'),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const generateElementsSchema = z.object({
  title: z.string().describe('Short name for the generated structure'),
  elements: z.array(generatedElementSchema).min(1).max(60),
});

export type GeneratedElement = z.infer<typeof generatedElementSchema>;

const MAX_ELEMENTS = 60;
const COORD_LIMIT = 50000;
const MAX_TEXT_LEN = 2000;
const MAX_LABEL_LEN = 120;

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

/**
 * Convert validated AI output into real CanvasElement[]: fresh UUIDs,
 * ref→id remapping, coordinate/size/length clamping, template-idiom styles.
 * Malformed items are dropped rather than failing the whole batch.
 */
export function generatedToCanvasElements(generated: GeneratedElement[]): CanvasElement[] {
  const items = generated.slice(0, MAX_ELEMENTS);

  // First pass: assign ids; only containers are valid parents
  const idByRef = new Map<string, string>();
  const containerRefs = new Set<string>();
  for (const g of items) {
    if (!idByRef.has(g.ref)) idByRef.set(g.ref, crypto.randomUUID());
    if (g.kind === 'container') containerRefs.add(g.ref);
  }

  const elements: CanvasElement[] = [];
  let tintIdx = 0;

  for (const g of items) {
    const base = {
      id: idByRef.get(g.ref)!,
      x: clamp(g.x, -COORD_LIMIT, COORD_LIMIT),
      y: clamp(g.y, -COORD_LIMIT, COORD_LIMIT),
      width: clamp(g.width, 20, 4000),
      height: clamp(g.height, 20, 4000),
      locked: false,
      boardId: null,
      surface: 'canvas' as const,
      containerId:
        g.parentRef && containerRefs.has(g.parentRef) && g.parentRef !== g.ref
          ? idByRef.get(g.parentRef)
          : undefined,
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
  }

  return elements;
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
- Use each ref exactly once, like c1, c2, t1, t2, s1.`;
