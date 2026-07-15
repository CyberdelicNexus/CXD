/**
 * Deterministic layout pass for AI-generated canvas elements ("Draft on
 * Canvas"). The model (element-generation.ts / generateElementsSchema)
 * returns container/text/shape elements with x/y coordinates it invented
 * while reasoning about structure in a JSON response — those coordinates
 * are not spatially trustworthy (the model has no notion of real pixel
 * geometry), so inserting them as-is produces an overlapping pile. This
 * module throws the model's coordinates away and recomputes real,
 * non-overlapping positions from the *structure* it expressed instead:
 * which elements are containers, and which elements reference them via
 * `containerId` (see generatedToCanvasElements in element-generation.ts).
 *
 * Unlike the wizard's freeform notes and boards (see framing-to-canvas.ts),
 * container/text/shape elements have NO hard CSS floor in canvas-element.tsx
 * — stored width/height render as-is (see the `style={{ width, height }}`
 * block: only `type === 'freeform'` gets `minHeight`/`minWidth`). So instead
 * of measuring a rendered DOM floor, "real minimum size" here means the
 * sane ranges CANVAS_GENERATION_GUIDE already asks the model for (containers
 * 340-480w, text 280-440w, shapes 40-80px) — and, for text, a height
 * estimated from actual content length so a long note isn't clipped by a
 * too-short stored height.
 *
 * Shape: each container + its children becomes one GROUP (a "grouped
 * column" — the closest equivalent this schema has to framing-to-canvas's
 * hub+satellite, since generate-elements has no experienceBlock/board/edge
 * types to build a literal hub). Loose top-level text/shape elements (no
 * parent container) become single-element groups. Groups are then
 * shelf-packed left-to-right with generous gaps, wrapping into new rows —
 * a flow-grid, same spirit as framing-to-canvas's CELL_W/COLS grid, sized
 * to real content instead of a fixed cell.
 */
import type { CanvasElement, ContainerElement, TextElement, ShapeElement } from '@/types/canvas-elements';

// ─── Tunables ──────────────────────────────────────────────────────────
// Kept in the ranges CANVAS_GENERATION_GUIDE (element-generation.ts) already
// asks the model for, so a well-behaved generation is left looking close to
// its own intent — only spacing/overlap is corrected, not the vocabulary.
const CONTAINER_PAD_X = 24;
const CONTAINER_HEADER_H = 56; // guide: "first 56px below a container's top edge is reserved for its header"
const CONTAINER_PAD_BOTTOM = 24;
const CHILD_GAP = 20; // vertical gap between stacked rows inside a container
const SHAPE_ROW_GAP = 12; // horizontal gap between shapes sharing a row

const MIN_CONTAINER_W = 340;
const MAX_CONTAINER_W = 480;
const MIN_CONTAINER_CONTENT_W = MIN_CONTAINER_W - 2 * CONTAINER_PAD_X;
const MAX_CONTAINER_CONTENT_W = MAX_CONTAINER_W - 2 * CONTAINER_PAD_X;
const MIN_CONTAINER_H = 260;
const MAX_EMPTY_CONTAINER_H = 340;

const MIN_TEXT_W = 280;
const MAX_TEXT_W = 440;
const MIN_TEXT_H = 40;
const MAX_TEXT_H = 400; // sanity cap so one runaway block can't blow out the whole layout

const SHAPE_SIZE_MIN = 40;
const SHAPE_SIZE_MAX = 80;

const GROUP_GAP = 64; // between top-level groups — within the requested 40-90px range
const MAX_ROW_WIDTH = 1700; // wrap point for the shelf-packed flow-grid (~3 containers wide)

const clamp = (v: number, min: number, max: number) =>
  Number.isFinite(v) ? Math.min(Math.max(v, min), max) : min;

/**
 * Rough rendered line count for pre-wrap text at a given pixel width and
 * fontSize (element-generation.ts always uses 14), so a text element is
 * tall enough to actually show its content instead of getting clipped
 * (canvas-element.tsx text rendering has no auto-grow — stored height IS
 * the rendered height).
 */
function estimateTextHeight(content: string, width: number, fontSize = 14): number {
  const avgCharW = fontSize * 0.55;
  const charsPerLine = Math.max(10, Math.floor(width / avgCharW));
  const rawLines = (content || '').split('\n');
  let lines = 0;
  for (const line of rawLines) {
    lines += Math.max(1, Math.ceil(line.length / charsPerLine));
  }
  const lineHeight = fontSize * 1.3;
  return Math.ceil(Math.max(1, lines) * lineHeight + 16);
}

interface LayoutGroup {
  /** Members with LOCAL coordinates relative to the group's own (0,0) top-left. */
  members: CanvasElement[];
  width: number;
  height: number;
}

/** Container + its children, laid out as one stacked column inside the container. */
function layoutContainerGroup(container: ContainerElement, children: CanvasElement[]): LayoutGroup {
  if (children.length === 0) {
    const width = clamp(container.width, MIN_CONTAINER_W, MAX_CONTAINER_W);
    const height = clamp(container.height, MIN_CONTAINER_H, MAX_EMPTY_CONTAINER_H);
    return { members: [{ ...container, x: 0, y: 0, width, height }], width, height };
  }

  // Content width: wide enough for the widest child, within the container's sane range.
  let naturalMax = MIN_CONTAINER_CONTENT_W;
  for (const child of children) {
    const natural =
      child.type === 'shape'
        ? clamp(child.width, SHAPE_SIZE_MIN, SHAPE_SIZE_MAX)
        : clamp(child.width, MIN_TEXT_W, MAX_TEXT_W);
    naturalMax = Math.max(naturalMax, natural);
  }
  const contentW = clamp(naturalMax, MIN_CONTAINER_CONTENT_W, MAX_CONTAINER_CONTENT_W);

  // Row-build: consecutive shapes share a wrapping horizontal row (small
  // accents shouldn't each eat a full row); any other kind (text) gets its
  // own full-width row so its content has room to breathe.
  type RowItem = { el: CanvasElement; width: number; height: number };
  const rows: RowItem[][] = [];
  let pendingShapeRow: RowItem[] = [];

  const flushShapeRow = () => {
    if (pendingShapeRow.length > 0) {
      rows.push(pendingShapeRow);
      pendingShapeRow = [];
    }
  };
  const pendingRowWidth = () =>
    pendingShapeRow.reduce((sum, it, i) => sum + it.width + (i > 0 ? SHAPE_ROW_GAP : 0), 0);

  for (const child of children) {
    if (child.type === 'shape') {
      const w = clamp(child.width, SHAPE_SIZE_MIN, SHAPE_SIZE_MAX);
      const h = clamp(child.height, SHAPE_SIZE_MIN, SHAPE_SIZE_MAX);
      if (pendingShapeRow.length > 0 && pendingRowWidth() + SHAPE_ROW_GAP + w > contentW) {
        flushShapeRow();
      }
      pendingShapeRow.push({ el: child, width: w, height: h });
    } else {
      flushShapeRow();
      const w = contentW;
      const h = Math.max(
        clamp(child.height, MIN_TEXT_H, MAX_TEXT_H),
        estimateTextHeight((child as TextElement).content || '', w)
      );
      rows.push([{ el: child, width: w, height: h }]);
    }
  }
  flushShapeRow();

  const localMembers: CanvasElement[] = [];
  let cursorY = CONTAINER_HEADER_H;
  for (const row of rows) {
    const rowHeight = Math.max(...row.map((it) => it.height));
    let cursorX = CONTAINER_PAD_X;
    for (const it of row) {
      localMembers.push({ ...it.el, x: cursorX, y: cursorY, width: it.width, height: it.height });
      cursorX += it.width + SHAPE_ROW_GAP;
    }
    cursorY += rowHeight + CHILD_GAP;
  }
  const contentHeight = cursorY - CHILD_GAP + CONTAINER_PAD_BOTTOM;

  const width = contentW + 2 * CONTAINER_PAD_X;
  const height = Math.max(MIN_CONTAINER_H, contentHeight);
  const localContainer: ContainerElement = { ...container, x: 0, y: 0, width, height };

  return { members: [localContainer, ...localMembers], width, height };
}

/** A top-level text/shape with no container — its own single-element group. */
function layoutLooseElement(el: CanvasElement): LayoutGroup {
  if (el.type === 'shape') {
    const width = clamp(el.width, SHAPE_SIZE_MIN, SHAPE_SIZE_MAX);
    const height = clamp(el.height, SHAPE_SIZE_MIN, SHAPE_SIZE_MAX);
    return { members: [{ ...el, x: 0, y: 0, width, height }], width, height };
  }
  const width = clamp(el.width, MIN_TEXT_W, MAX_TEXT_W);
  const height = Math.max(
    clamp(el.height, MIN_TEXT_H, MAX_TEXT_H),
    estimateTextHeight((el as ShapeElement | TextElement).content || '', width)
  );
  return { members: [{ ...el, x: 0, y: 0, width, height }], width, height };
}

/**
 * Recompute non-overlapping positions/sizes for a batch of AI-generated
 * elements, ignoring the model's own x/y (see file header). Every other
 * field (id, containerId, label, content, style, hypercubeTags, ...) is
 * left untouched — children keep their real containerId and land fully
 * inside their parent's padded bounds with absolute coordinates.
 *
 * The returned batch's own top-left is anchored near (0,0); callers
 * translate the whole thing to its final canvas position (see
 * elementsBoundingBox + findClearGroupOrigin below and
 * element-generation-service.ts).
 */
export function layoutDraftElements(elements: CanvasElement[]): CanvasElement[] {
  if (elements.length === 0) return [];

  const containerIds = new Set(elements.filter((e) => e.type === 'container').map((e) => e.id));
  const childrenByContainer = new Map<string, CanvasElement[]>();
  const consumed = new Set<string>();
  for (const el of elements) {
    if (el.type === 'container') continue;
    if (el.containerId && containerIds.has(el.containerId)) {
      const list = childrenByContainer.get(el.containerId) || [];
      list.push(el);
      childrenByContainer.set(el.containerId, list);
      consumed.add(el.id);
    }
  }

  const groups: LayoutGroup[] = [];
  for (const el of elements) {
    if (el.type === 'container') {
      groups.push(layoutContainerGroup(el as ContainerElement, childrenByContainer.get(el.id) || []));
    } else if (!consumed.has(el.id)) {
      groups.push(layoutLooseElement(el));
    }
  }

  // Shelf-pack groups into a flow-grid: left to right, wrapping to a new row
  // once MAX_ROW_WIDTH would be exceeded. Handles arbitrary group sizes
  // (variable content) without any pair ever overlapping.
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  const placed: CanvasElement[] = [];
  for (const group of groups) {
    if (cursorX > 0 && cursorX + group.width > MAX_ROW_WIDTH) {
      cursorX = 0;
      cursorY += rowHeight + GROUP_GAP;
      rowHeight = 0;
    }
    for (const member of group.members) {
      placed.push({ ...member, x: member.x + cursorX, y: member.y + cursorY });
    }
    cursorX += group.width + GROUP_GAP;
    rowHeight = Math.max(rowHeight, group.height);
  }

  return placed;
}

// ─── Insertion point ────────────────────────────────────────────────────

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Find a top-left origin for a group of the given size, centered on
 * `center` (the current viewport center in world coordinates) when that
 * doesn't collide with any obstacle, otherwise the nearest clear spot found
 * by an expanding ring search around the centered position. Falls back to
 * placing the group below every obstacle if the ring search exhausts
 * (pathological case: a huge number of scattered obstacles).
 */
export function findClearGroupOrigin(
  groupSize: { width: number; height: number },
  center: { x: number; y: number },
  obstacles: BoundingBox[]
): { x: number; y: number } {
  const desiredX = center.x - groupSize.width / 2;
  const desiredY = center.y - groupSize.height / 2;
  if (obstacles.length === 0) return { x: desiredX, y: desiredY };

  const intersectsAny = (x: number, y: number) =>
    obstacles.some(
      (o) => x < o.maxX && o.minX < x + groupSize.width && y < o.maxY && o.minY < y + groupSize.height
    );

  if (!intersectsAny(desiredX, desiredY)) return { x: desiredX, y: desiredY };

  const STEP = 140;
  const MAX_RING = 40;
  for (let ring = 1; ring <= MAX_RING; ring++) {
    const candidates = [
      { x: desiredX + ring * STEP, y: desiredY },
      { x: desiredX - ring * STEP, y: desiredY },
      { x: desiredX, y: desiredY + ring * STEP },
      { x: desiredX, y: desiredY - ring * STEP },
      { x: desiredX + ring * STEP, y: desiredY + ring * STEP },
      { x: desiredX - ring * STEP, y: desiredY - ring * STEP },
      { x: desiredX + ring * STEP, y: desiredY - ring * STEP },
      { x: desiredX - ring * STEP, y: desiredY + ring * STEP },
    ];
    for (const c of candidates) {
      if (!intersectsAny(c.x, c.y)) return c;
    }
  }

  const maxBottom = Math.max(...obstacles.map((o) => o.maxY));
  return { x: desiredX, y: maxBottom + 160 };
}
