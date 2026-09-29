// Shape geometry for canvas shapes, drawn at the element's real pixel size.
//
// Shapes used to be drawn in a fixed 100×100 viewBox stretched to the element
// with preserveAspectRatio="none", which distorted strokes and corner radii on
// anything not square. Paths here are built for the actual width/height, and
// every polygon gets rounded corners so shapes read as soft/premium.

import type { ShapeType } from '@/types/canvas-elements';

type Pt = [number, number];

export const SHAPE_DEFS: { type: ShapeType; label: string }[] = [
  { type: 'rectangle', label: 'Rectangle' },
  { type: 'circle', label: 'Circle' },
  { type: 'pill', label: 'Start / End' },
  { type: 'diamond', label: 'Decision' },
  { type: 'parallelogram', label: 'Input / Output' },
  { type: 'hexagon', label: 'Hexagon' },
  { type: 'triangle', label: 'Triangle' },
  { type: 'star', label: 'Star' },
  { type: 'cylinder', label: 'Database' },
  { type: 'document', label: 'Document' },
  { type: 'arrow', label: 'Arrow' },
  { type: 'callout', label: 'Callout' },
];

/** Default size for a freshly placed shape of each type (w × h). */
export const SHAPE_DEFAULT_SIZES: Partial<Record<ShapeType, { width: number; height: number }>> = {
  rectangle: { width: 160, height: 100 },
  circle: { width: 120, height: 120 },
  triangle: { width: 130, height: 115 },
  star: { width: 130, height: 125 },
  pill: { width: 170, height: 70 },
  parallelogram: { width: 170, height: 90 },
  hexagon: { width: 160, height: 110 },
  cylinder: { width: 120, height: 140 },
  document: { width: 160, height: 110 },
  arrow: { width: 170, height: 90 },
  callout: { width: 170, height: 120 },
  diamond: { width: 140, height: 120 },
};

const f = (n: number) => Math.round(n * 100) / 100;

/** Closed path through `pts` with each corner rounded by up to `r`. */
function roundedPolygon(pts: Pt[], r: number): string {
  const n = pts.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const inLen = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    const outLen = Math.hypot(next[0] - cur[0], next[1] - cur[1]);
    // Never eat more than 45% of an edge, so adjacent corners can't overlap.
    const rr = Math.min(r, inLen * 0.45, outLen * 0.45);
    const a: Pt = [cur[0] + ((prev[0] - cur[0]) / inLen) * rr, cur[1] + ((prev[1] - cur[1]) / inLen) * rr];
    const b: Pt = [cur[0] + ((next[0] - cur[0]) / outLen) * rr, cur[1] + ((next[1] - cur[1]) / outLen) * rr];
    d += `${i === 0 ? 'M' : 'L'}${f(a[0])},${f(a[1])} Q${f(cur[0])},${f(cur[1])} ${f(b[0])},${f(b[1])} `;
  }
  return d + 'Z';
}

function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return (
    `M${f(x + rr)},${f(y)} H${f(x + w - rr)} A${f(rr)},${f(rr)} 0 0 1 ${f(x + w)},${f(y + rr)} ` +
    `V${f(y + h - rr)} A${f(rr)},${f(rr)} 0 0 1 ${f(x + w - rr)},${f(y + h)} ` +
    `H${f(x + rr)} A${f(rr)},${f(rr)} 0 0 1 ${f(x)},${f(y + h - rr)} ` +
    `V${f(y + rr)} A${f(rr)},${f(rr)} 0 0 1 ${f(x + rr)},${f(y)} Z`
  );
}

/**
 * SVG path(s) for a shape filling a w×h box, inset by `inset` on every side
 * (half the stroke width, so the stroke isn't clipped). `detail` is an extra
 * stroke-only path (e.g. the cylinder's front rim).
 */
export function shapePath(type: ShapeType | undefined, w: number, h: number, inset = 1): { d: string; detail?: string } {
  const x0 = inset;
  const y0 = inset;
  const W = Math.max(1, w - inset * 2);
  const H = Math.max(1, h - inset * 2);
  const x1 = x0 + W;
  const y1 = y0 + H;
  const cx = x0 + W / 2;
  const cy = y0 + H / 2;
  const m = Math.min(W, H);
  const soft = Math.max(4, m * 0.12); // corner radius used by most polygons

  switch (type) {
    case 'circle':
      return {
        d: `M${f(x0)},${f(cy)} A${f(W / 2)},${f(H / 2)} 0 1 0 ${f(x1)},${f(cy)} A${f(W / 2)},${f(H / 2)} 0 1 0 ${f(x0)},${f(cy)} Z`,
      };
    case 'pill':
      return { d: roundedRect(x0, y0, W, H, H / 2) };
    case 'diamond':
      return { d: roundedPolygon([[cx, y0], [x1, cy], [cx, y1], [x0, cy]], soft) };
    case 'triangle':
      return { d: roundedPolygon([[cx, y0], [x1, y1], [x0, y1]], soft * 1.6) };
    case 'hexagon': {
      // Flow-chart hexagon: flat top/bottom, points left/right. The inset is
      // tied to the height so wide hexagons keep their proportions.
      const k = Math.min(W * 0.25, H * 0.5);
      return { d: roundedPolygon([[x0 + k, y0], [x1 - k, y0], [x1, cy], [x1 - k, y1], [x0 + k, y1], [x0, cy]], soft * 0.8) };
    }
    case 'parallelogram': {
      const k = Math.min(W * 0.2, H * 0.6);
      return { d: roundedPolygon([[x0 + k, y0], [x1, y0], [x1 - k, y1], [x0, y1]], soft * 0.8) };
    }
    case 'star': {
      // Five points, a fuller inner radius (0.5 vs the classic 0.38) and
      // rounded tips so it reads soft rather than spiky.
      const pts: Pt[] = [];
      const rxO = W / 2;
      const ryO = H / 2;
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5;
        const k = i % 2 === 0 ? 1 : 0.5;
        pts.push([cx + Math.cos(ang) * rxO * k, cy + 0.06 * H + Math.sin(ang) * ryO * k]);
      }
      return { d: roundedPolygon(pts, Math.max(3, m * 0.06)) };
    }
    case 'cylinder': {
      const ry = Math.min(H * 0.14, W * 0.25);
      const top = y0 + ry;
      const bot = y1 - ry;
      return {
        d:
          `M${f(x0)},${f(top)} A${f(W / 2)},${f(ry)} 0 0 1 ${f(x1)},${f(top)} ` +
          `V${f(bot)} A${f(W / 2)},${f(ry)} 0 0 1 ${f(x0)},${f(bot)} Z`,
        detail: `M${f(x0)},${f(top)} A${f(W / 2)},${f(ry)} 0 0 0 ${f(x1)},${f(top)}`,
      };
    }
    case 'document': {
      const wave = Math.min(H * 0.12, 18);
      const r = Math.min(soft, 10);
      const yb = y1 - wave;
      return {
        d:
          `M${f(x0 + r)},${f(y0)} H${f(x1 - r)} Q${f(x1)},${f(y0)} ${f(x1)},${f(y0 + r)} ` +
          `V${f(yb)} C${f(x1 - W * 0.25)},${f(yb - wave * 1.6)} ${f(x0 + W * 0.45)},${f(y1 + wave * 0.6)} ${f(x0)},${f(yb)} ` +
          `V${f(y0 + r)} Q${f(x0)},${f(y0)} ${f(x0 + r)},${f(y0)} Z`,
      };
    }
    case 'arrow': {
      const head = Math.min(W * 0.35, H * 0.9);
      const shaft = H * 0.28;
      return {
        d: roundedPolygon(
          [
            [x0, cy - shaft], [x1 - head, cy - shaft], [x1 - head, y0], [x1, cy],
            [x1 - head, y1], [x1 - head, cy + shaft], [x0, cy + shaft],
          ],
          Math.max(3, m * 0.07),
        ),
      };
    }
    case 'callout': {
      const tail = Math.min(H * 0.22, 26);
      const yb = y1 - tail;
      const r = Math.min(soft * 1.2, 18);
      const tx = x0 + W * 0.22;
      return {
        d:
          `M${f(x0 + r)},${f(y0)} H${f(x1 - r)} Q${f(x1)},${f(y0)} ${f(x1)},${f(y0 + r)} ` +
          `V${f(yb - r)} Q${f(x1)},${f(yb)} ${f(x1 - r)},${f(yb)} ` +
          `H${f(tx + tail * 1.2)} L${f(tx - tail * 0.2)},${f(y1)} L${f(tx)},${f(yb)} ` +
          `H${f(x0 + r)} Q${f(x0)},${f(yb)} ${f(x0)},${f(yb - r)} V${f(y0 + r)} Q${f(x0)},${f(y0)} ${f(x0 + r)},${f(y0)} Z`,
      };
    }
    case 'rectangle':
    default:
      return { d: roundedRect(x0, y0, W, H, Math.min(14, m * 0.14)) };
  }
}

/** Where text sits inside a shape, as fractions of the box (top, right, bottom, left). */
export function shapeTextInsets(type: ShapeType | undefined): [number, number, number, number] {
  switch (type) {
    case 'diamond': return [0.22, 0.2, 0.22, 0.2];
    case 'triangle': return [0.42, 0.22, 0.08, 0.22];
    case 'star': return [0.3, 0.28, 0.22, 0.28];
    case 'hexagon': return [0.1, 0.18, 0.1, 0.18];
    case 'parallelogram': return [0.1, 0.18, 0.1, 0.18];
    case 'cylinder': return [0.26, 0.08, 0.12, 0.08];
    case 'document': return [0.08, 0.08, 0.2, 0.08];
    case 'arrow': return [0.22, 0.3, 0.22, 0.06];
    case 'callout': return [0.08, 0.08, 0.26, 0.08];
    case 'pill': return [0.08, 0.14, 0.08, 0.14];
    case 'circle': return [0.16, 0.16, 0.16, 0.16];
    default: return [0.08, 0.08, 0.08, 0.08];
  }
}
