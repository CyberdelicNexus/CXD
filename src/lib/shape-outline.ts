// Where a connector meets a shape's OUTLINE.
//
// Shapes other than rectangles don't fill their bounding box (a triangle's
// side-midpoints are well outside it), so an anchor on the box edge floated in
// empty space. The anchor now slides along its axis until it meets the outline:
// a 'left' anchor at 40% height is the first point the horizontal line at 40%
// enters the shape from the left, and so on. Browser-only (it hit-tests the
// real path on a canvas); on the server it falls back to the box edge.

import type { ShapeType } from '@/types/canvas-elements';
import { shapePath } from '@/lib/shape-geometry';

type Side = 'top' | 'right' | 'bottom' | 'left';

let ctx: CanvasRenderingContext2D | null | undefined;
function getCtx(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx;
  ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  return ctx;
}

const cache = new Map<string, { x: number; y: number } | null>();
const paths = new Map<string, Path2D>();

/**
 * Point on the outline, in the element's local px (0,0 = top-left of its box),
 * for an anchor `side` at `offset` (0..1) along that side. Returns null when the
 * box edge IS the outline (rectangles) or the outline can't be found.
 */
export function shapeOutlinePoint(
  type: ShapeType | undefined,
  width: number,
  height: number,
  side: Side,
  offset: number,
): { x: number; y: number } | null {
  if (!type || type === 'rectangle') return null;
  const c = getCtx();
  if (!c || !(width > 0) || !(height > 0)) return null;
  const f = Math.max(0, Math.min(1, offset));
  const key = `${type}|${Math.round(width)}|${Math.round(height)}|${side}|${Math.round(f * 200)}`;
  if (cache.has(key)) return cache.get(key)!;

  const pkey = `${type}|${Math.round(width)}|${Math.round(height)}`;
  let path = paths.get(pkey);
  if (!path) {
    path = new Path2D(shapePath(type, width, height, 0).d);
    paths.set(pkey, path);
  }

  const horizontal = side === 'left' || side === 'right';
  const along = horizontal ? height * f : width * f; // fixed coordinate of the ray
  const len = horizontal ? width : height;
  const fromStart = side === 'left' || side === 'top';
  // Position of the ray at parameter t (0 at the box edge it enters from).
  const at = (t: number) => {
    const d = fromStart ? t * len : len - t * len;
    return horizontal ? { x: d, y: along } : { x: along, y: d };
  };
  const inside = (t: number) => {
    const p = at(t);
    return c.isPointInPath(path!, p.x, p.y);
  };

  const STEPS = 64;
  let result: { x: number; y: number } | null = null;
  let prev = 0;
  if (inside(0)) {
    result = at(0);
  } else {
    for (let i = 1; i <= STEPS; i++) {
      const t = i / STEPS;
      if (inside(t)) {
        let lo = prev, hi = t;
        for (let k = 0; k < 10; k++) {
          const mid = (lo + hi) / 2;
          if (inside(mid)) hi = mid; else lo = mid;
        }
        result = at(hi);
        break;
      }
      prev = t;
    }
  }
  if (cache.size > 800) cache.clear();
  cache.set(key, result);
  return result;
}
