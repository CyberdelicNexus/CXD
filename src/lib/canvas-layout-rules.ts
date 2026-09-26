/**
 * Canvas layout rubric — the machine-checkable half of templates.design.md.
 *
 * One source of truth for "is this layout actually good", used by BOTH the
 * hand-authored template verifier (`__verify__/templates.verify.ts`) and the AI
 * output eval (`ai/__evals__/canvas-eval.ts`), so AI-generated layouts are held
 * to exactly the same bar as templates we wrote ourselves.
 *
 * Pure functions, no I/O.
 */

import type { CanvasElement, CanvasEdge } from '@/types/canvas-elements';

// ─── Rendered geometry ──────────────────────────────────────────────

/**
 * CSS floors applied at render time regardless of stored dimensions. A note
 * card stored at 120px tall still paints 300px tall and will overlap whatever
 * sits beneath it, so every geometry check must use these, never el.height.
 */
export const RENDER_FLOORS = {
  noteCard: { width: 200, height: 300 },
  document: { width: 100, height: 130 },
  boardHex: { width: 170, height: 230 },
  /** Task cards: the element wrapper pins width to 300px and every
   *  non-document freeform has min-height 300px (canvas-element.tsx). The
   *  properties panel usually pushes the painted height past this floor, and
   *  the ResizeObserver then writes the real height back to el.height. */
  taskCard: { width: 300, height: 300 },
} as const;

export interface Box { x: number; y: number; w: number; h: number }

/** Real rendered bounds. Lines/connectors have no box and return null. */
export function realBounds(el: CanvasElement): Box | null {
  if (el.type === 'line' || el.type === 'connector') return null;
  let w = el.width;
  let h = el.height;
  if (el.type === 'freeform') {
    const f = el as unknown as { isDocument?: boolean; cardType?: string; taskMetadata?: unknown };
    // getFreeformCardType: an explicit cardType wins; taskMetadata alone means task.
    const isTask = f.cardType === 'task' || (!f.cardType && !!f.taskMetadata);
    if (f.isDocument) {
      w = Math.max(w, RENDER_FLOORS.document.width);
      h = Math.max(h, RENDER_FLOORS.document.height);
    } else if (f.cardType === 'note') {
      w = Math.max(w, RENDER_FLOORS.noteCard.width);
      h = Math.max(h, RENDER_FLOORS.noteCard.height);
    } else if (isTask) {
      w = Math.max(w, RENDER_FLOORS.taskCard.width);
      h = Math.max(h, RENDER_FLOORS.taskCard.height);
    }
  } else if (el.type === 'board') {
    w = Math.max(w, RENDER_FLOORS.boardHex.width);
    h = Math.max(h, RENDER_FLOORS.boardHex.height);
  }
  return { x: el.x, y: el.y, w, h };
}

export const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Comparison scope. Interior (pre-seeded board) elements live in another
 * board's coordinate space and must never be compared against root canvas
 * elements; children of different containers likewise never collide.
 */
export const scopeOf = (el: CanvasElement) =>
  `${el.boardId ?? '__rootboard__'}|${el.containerId ?? '__root__'}`;

// ─── Rules ──────────────────────────────────────────────────────────

export type Severity = 'error' | 'warn';

export interface Violation {
  rule: string;
  severity: Severity;
  message: string;
  elementId?: string;
}

/** templates.design.md §2: the top of a container is reserved for its header. */
export const CONTAINER_HEADER_PX = 56;
/** templates.design.md §8: everything snaps to a 20px grid. */
export const GRID_PX = 20;

export interface LayoutCheckOptions {
  /** Rules from the design system that hand-authored templates predate.
   *  Off by default so the template verifier's result is unchanged. */
  includeDesignSystemRules?: boolean;
}

/**
 * Structural + geometric audit. `error` = broken canvas (escaped containers,
 * overlaps, dangling refs). `warn` = house-style drift (off-grid, empty zone).
 */
export function checkLayout(
  elements: CanvasElement[],
  edges: CanvasEdge[] = [],
  opts: LayoutCheckOptions = {},
): Violation[] {
  const v: Violation[] = [];
  const add = (rule: string, severity: Severity, message: string, elementId?: string) =>
    v.push({ rule, severity, message, elementId });

  // 1. Unique ids (elements + childBoardIds)
  const ids = new Set<string>();
  for (const el of elements) {
    if (ids.has(el.id)) add('unique-ids', 'error', `duplicate id ${el.id}`, el.id);
    ids.add(el.id);
    const cb = (el as unknown as { childBoardId?: string }).childBoardId;
    if (cb) {
      if (ids.has(cb)) add('unique-ids', 'error', `duplicate childBoardId ${cb}`, el.id);
      ids.add(cb);
    }
  }

  // 2. Edge endpoints resolve
  for (const e of edges) {
    if (!ids.has(e.fromNodeId)) add('edge-endpoints', 'error', `edge ${e.id}: unknown fromNodeId ${e.fromNodeId}`);
    if (!ids.has(e.toNodeId)) add('edge-endpoints', 'error', `edge ${e.id}: unknown toNodeId ${e.toNodeId}`);
  }

  // 3/4. containerId resolves to a container, and children stay inside it
  const byId = new Map(elements.map((el) => [el.id, el]));
  for (const el of elements) {
    if (!el.containerId) continue;
    const parent = byId.get(el.containerId);
    if (!parent || parent.type !== 'container') {
      add('container-ref', 'error', `${el.id}: containerId ${el.containerId} is not a container`, el.id);
      continue;
    }
    const rb = realBounds(el);
    if (!rb) continue;
    const inX = rb.x >= parent.x && rb.x + rb.w <= parent.x + parent.width;
    const inY = rb.y >= parent.y && rb.y + rb.h <= parent.y + parent.height;
    if (!inX || !inY) {
      add(
        'container-bounds',
        'error',
        `${el.id} (${el.type}) escapes container ${parent.id}: ${JSON.stringify(rb)} vs ${parent.x},${parent.y} ${parent.width}x${parent.height}`,
        el.id,
      );
    }
    if (opts.includeDesignSystemRules && rb.y < parent.y + CONTAINER_HEADER_PX) {
      add('container-header', 'warn', `${el.id} sits in ${parent.id}'s reserved ${CONTAINER_HEADER_PX}px header band`, el.id);
    }
  }

  // 5. No overlaps within a scope. A container legitimately covers its own
  //    children, but those children sit in a different scope, so they never
  //    meet here — callers auditing a post-apply canvas must therefore apply
  //    reparenting updates BEFORE calling, or wrapping will read as collision.
  const byScope = new Map<string, CanvasElement[]>();
  for (const el of elements) {
    const s = scopeOf(el);
    if (!byScope.has(s)) byScope.set(s, []);
    byScope.get(s)!.push(el);
  }
  for (const [scope, group] of Array.from(byScope.entries())) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = realBounds(group[i]);
        const b = realBounds(group[j]);
        if (!a || !b) continue;
        if (overlaps(a, b)) {
          add('overlap', 'error', `[${scope}] ${group[i].id} (${group[i].type}) overlaps ${group[j].id} (${group[j].type})`, group[i].id);
        }
      }
    }
  }

  if (!opts.includeDesignSystemRules) return v;

  // ─ House style (templates.design.md) ─

  // §8: 20px grid
  for (const el of elements) {
    if (el.type === 'line' || el.type === 'connector') continue;
    if (el.x % GRID_PX !== 0 || el.y % GRID_PX !== 0) {
      add('grid-snap', 'warn', `${el.id} is off the ${GRID_PX}px grid at ${el.x},${el.y}`, el.id);
    }
  }

  // §4: never ship an empty zone
  const containers = elements.filter((el) => el.type === 'container');
  for (const c of containers) {
    const children = elements.filter((el) => el.containerId === c.id);
    if (children.length === 0) {
      add('empty-zone', 'warn', `container ${c.id} has no seeded content`, c.id);
    } else if (!children.some((el) => el.type === 'freeform')) {
      add('note-seed', 'warn', `container ${c.id} has no editable note card to build on`, c.id);
    }
  }

  // §2/§3: containers are labelled, and adjacent zones don't share a tint
  for (const c of containers) {
    const label = (c as unknown as { label?: string; hideLabel?: boolean }).label;
    const hidden = (c as unknown as { hideLabel?: boolean }).hideLabel;
    if (!hidden && !label?.trim()) add('zone-label', 'warn', `container ${c.id} has no label`, c.id);
  }
  const rootContainers = containers.filter((c) => !c.containerId);
  for (let i = 0; i < rootContainers.length; i++) {
    for (let j = i + 1; j < rootContainers.length; j++) {
      const a = rootContainers[i];
      const b = rootContainers[j];
      const ta = (a as unknown as { tintColor?: string }).tintColor;
      const tb = (b as unknown as { tintColor?: string }).tintColor;
      if (!ta || !tb || ta !== tb) continue;
      const ba = realBounds(a);
      const bb = realBounds(b);
      if (!ba || !bb) continue;
      // "Adjacent" = within a zone gutter of each other on either axis.
      const gapX = Math.max(0, Math.max(ba.x, bb.x) - Math.min(ba.x + ba.w, bb.x + bb.w));
      const gapY = Math.max(0, Math.max(ba.y, bb.y) - Math.min(ba.y + ba.h, bb.y + bb.h));
      if (gapX < 140 && gapY < 140) {
        add('tint-rotation', 'warn', `adjacent zones ${a.id} and ${b.id} share tint "${ta}"`, a.id);
      }
    }
  }

  return v;
}

/** Group violations by rule for reporting. */
export function tallyByRule(violations: Violation[]): Map<string, number> {
  const t = new Map<string, number>();
  for (const x of violations) t.set(x.rule, (t.get(x.rule) ?? 0) + 1);
  return t;
}
