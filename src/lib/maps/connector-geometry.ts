// Pure mirror of how the canvas draws connectors and line elements, so layout
// engines, the property harness and previews can reason about the exact path
// a user will see. Keep in lock-step with:
//   - cxd-canvas.tsx getResolvedEdgePoints + the per-edge SVG path (connectors)
//   - canvas/line-layer.tsx renderLine (line elements)
// Connectors are drawn ABOVE every element, so a path that passes through an
// unrelated box paints over its content: connectorCrossings finds those.
import { realBounds } from "@/lib/canvas-layout-rules";
import {
  getAnchorPosition, getClosestAnchors,
  type CanvasEdge, type CanvasElement, type LineElement,
} from "@/types/canvas-elements";

export interface Pt { x: number; y: number }
type Side = "top" | "right" | "bottom" | "left";

export interface PathGeometry {
  /** SVG path data in world coordinates. */
  d: string;
  /** The point the canvas uses as the path midpoint (t = 0.5). */
  mid: Pt;
  /** The point at parameter t in [0, 1]. */
  at(t: number): Pt;
  /** n points evenly spaced in t from start to end (inclusive). */
  sample(n: number): Pt[];
}

/** Outset applied along the anchor side's normal (cxd-canvas OUTSET). */
const OUTSET = 2;
/** Either-axis delta under which the canvas draws a straight segment. */
const STRAIGHT_PX = 20;

const outward = (side: Side, o: number): Pt => {
  switch (side) {
    case "right": return { x: o, y: 0 };
    case "left": return { x: -o, y: 0 };
    case "bottom": return { x: 0, y: o };
    case "top": return { x: 0, y: -o };
  }
};

const cubicAt = (a: Pt, c1: Pt, c2: Pt, b: Pt, t: number): Pt => {
  const u = 1 - t;
  const k0 = u * u * u, k1 = 3 * u * u * t, k2 = 3 * u * t * t, k3 = t * t * t;
  return { x: k0 * a.x + k1 * c1.x + k2 * c2.x + k3 * b.x, y: k0 * a.y + k1 * c1.y + k2 * c2.y + k3 * b.y };
};

const quadAt = (a: Pt, c: Pt, b: Pt, t: number): Pt => {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
};

const ts = (n: number): number[] => {
  const k = Math.max(2, Math.floor(n));
  return Array.from({ length: k }, (_, i) => i / (k - 1));
};

/** Resolved anchor points (after outset) and sides, exactly as the canvas resolves them. */
export function resolveEdgePoints(edge: CanvasEdge, from: CanvasElement, to: CanvasElement): { a: Pt; b: Pt; fromSide: Side; toSide: Side } {
  let fromSide: Side = edge.fromAnchor;
  let toSide: Side = edge.toAnchor;
  if (edge.fromAutoAnchor || edge.toAutoAnchor) {
    const closest = getClosestAnchors(from, to);
    if (edge.fromAutoAnchor) fromSide = closest.from;
    if (edge.toAutoAnchor) toSide = closest.to;
  }
  const fromRaw = getAnchorPosition(from, fromSide, edge.fromAutoAnchor ? 0.5 : edge.fromAnchorOffset);
  const toRaw = getAnchorPosition(to, toSide, edge.toAutoAnchor ? 0.5 : edge.toAnchorOffset);
  const fo = outward(fromSide, OUTSET);
  const to_ = outward(toSide, OUTSET);
  return {
    a: { x: fromRaw.x + fo.x, y: fromRaw.y + fo.y },
    b: { x: toRaw.x + to_.x, y: toRaw.y + to_.y },
    fromSide, toSide,
  };
}

/** Anchor points and, for a curve, the two cubic control points (null when the canvas draws a straight segment). */
function controlPolygon(edge: CanvasEdge, from: CanvasElement, to: CanvasElement): { a: Pt; b: Pt; c: [Pt, Pt] | null } {
  const { a, b, fromSide, toSide } = resolveEdgePoints(edge, from, to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < STRAIGHT_PX || Math.abs(dy) < STRAIGHT_PX) return { a, b, c: null };
  const offset = Math.max(60, Math.min(Math.abs(dx), Math.abs(dy)) * 0.4);
  const fc = outward(fromSide, offset);
  const tc = outward(toSide, offset);
  return { a, b, c: [{ x: a.x + fc.x, y: a.y + fc.y }, { x: b.x + tc.x, y: b.y + tc.y }] };
}

/** The connector exactly as the canvas draws it. edge.bend is ignored, as on the canvas. */
export function connectorPath(edge: CanvasEdge, from: CanvasElement, to: CanvasElement): PathGeometry {
  const { a, b, c } = controlPolygon(edge, from, to);
  if (!c) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return {
      d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`,
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      at: (t) => ({ x: a.x + dx * t, y: a.y + dy * t }),
      sample: (n) => ts(n).map((t) => ({ x: a.x + dx * t, y: a.y + dy * t })),
    };
  }
  const [c1, c2] = c;
  return {
    d: `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`,
    mid: cubicAt(a, c1, c2, b, 0.5),
    at: (t) => cubicAt(a, c1, c2, b, t),
    sample: (n) => ts(n).map((t) => cubicAt(a, c1, c2, b, t)),
  };
}

/** A line element exactly as line-layer draws it: quadratic through `bend`, midpoint when absent. */
export function linePath(line: LineElement): PathGeometry {
  const a = line.start;
  const b = line.end;
  const c = line.bend ?? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return {
    d: `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`,
    mid: quadAt(a, c, b, 0.5),
    at: (t) => quadAt(a, c, b, t),
    sample: (n) => ts(n).map((t) => quadAt(a, c, b, t)),
  };
}

/** Auto-anchored connector between two elements, as generatedToCanvas builds them. */
export const autoEdge = (from: CanvasElement, to: CanvasElement): CanvasEdge => ({
  id: `${from.id}->${to.id}`, fromNodeId: from.id, toNodeId: to.id,
  fromAnchor: "right", toAnchor: "left", fromAutoAnchor: true, toAutoAnchor: true,
  fromAnchorOffset: 0.5, toAnchorOffset: 0.5,
});

/**
 * Axis-aligned box that contains the whole drawn connector: a cubic never
 * leaves the hull of its control polygon. Layout engines keep this box clear
 * of unrelated boxes, which makes the drawn path clear by construction.
 */
export function connectorHull(edge: CanvasEdge, from: CanvasElement, to: CanvasElement): { x0: number; y0: number; x1: number; y1: number } {
  const { a, b, c } = controlPolygon(edge, from, to);
  const pts = c ? [a, b, ...c] : [a, b];
  return {
    x0: Math.min(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)),
    x1: Math.max(...pts.map((p) => p.x)), y1: Math.max(...pts.map((p) => p.y)),
  };
}

export interface Crossing {
  /** Edge id, or the line element's id. */
  edgeId: string;
  /** The unrelated element the path (or the edge's label pill) paints over. */
  throughId: string;
  /** What paints over it: the stroke, or the edge's opaque label pill. */
  by: "path" | "label";
}

/** Points each drawn path is sampled at; consecutive samples are joined into segments. */
export const SAMPLES = 200;
/** A box is shrunk by this much before testing, so paths that merely graze an edge pass. */
export const SHRINK = 4;
/** The canvas draws an edge label as an opaque 60x20 pill centred on the path at label.position. */
export const LABEL_PILL = { w: 60, h: 20 };

export interface Rect { x: number; y: number; w: number; h: number }

/** Liang–Barsky: does segment p-q enter the open box (x0,y0)-(x1,y1)? */
function segmentEnters(p: Pt, q: Pt, x0: number, y0: number, x1: number, y1: number): boolean {
  if (x1 <= x0 || y1 <= y0) return false;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  let t0 = 0;
  let t1 = 1;
  const clip = (den: number, num: number): boolean => {
    // Inside when den * t <= num (strictly inside the open box handled by the final check).
    if (den === 0) return num > 0;
    const t = num / den;
    if (den < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    return true;
  };
  if (!clip(-dx, p.x - x0) || !clip(dx, x1 - p.x) || !clip(-dy, p.y - y0) || !clip(dy, y1 - p.y)) return false;
  return t0 < t1;
}

/** Bounding boxes of runs of CHUNK segments, cached per sampled path: most boxes are rejected per run, not per segment. */
const CHUNK = 16;
const chunkCache = new WeakMap<Pt[], { i0: number; i1: number; x0: number; y0: number; x1: number; y1: number }[]>();
function chunksOf(pts: Pt[]) {
  let chunks = chunkCache.get(pts);
  if (chunks) return chunks;
  chunks = [];
  for (let i0 = 0; i0 < pts.length - 1; i0 += CHUNK) {
    const i1 = Math.min(i0 + CHUNK, pts.length - 1);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = i0; i <= i1; i++) {
      const p = pts[i];
      if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
    }
    chunks.push({ i0, i1, x0, y0, x1, y1 });
  }
  chunkCache.set(pts, chunks);
  return chunks;
}

/**
 * Does the polyline through `pts` enter `box` shrunk by `shrink`? Segments
 * between consecutive samples are clipped against the box, so a small box on
 * a long curve cannot slip between two samples.
 */
export function pathEntersBox(pts: Pt[], box: Rect, shrink = SHRINK): boolean {
  const x0 = box.x + shrink, y0 = box.y + shrink, x1 = box.x + box.w - shrink, y1 = box.y + box.h - shrink;
  if (pts.length === 1) return pts[0].x > x0 && pts[0].x < x1 && pts[0].y > y0 && pts[0].y < y1;
  for (const c of chunksOf(pts)) {
    if (c.x1 <= x0 || c.x0 >= x1 || c.y1 <= y0 || c.y0 >= y1) continue;
    for (let i = c.i0 + 1; i <= c.i1; i++) if (segmentEnters(pts[i - 1], pts[i], x0, y0, x1, y1)) return true;
  }
  return false;
}

/** The label pill's rect for a path, at label.position (default 0.5). */
export function labelRect(path: PathGeometry, position = 0.5): Rect {
  const c = path.at(position);
  return { x: c.x - LABEL_PILL.w / 2, y: c.y - LABEL_PILL.h / 2, w: LABEL_PILL.w, h: LABEL_PILL.h };
}

/** Does `r` overlap `box` shrunk by `shrink` (open intervals)? */
export function rectEntersBox(r: Rect, box: Rect, shrink = SHRINK): boolean {
  return r.x < box.x + box.w - shrink && r.x + r.w > box.x + shrink && r.y < box.y + box.h - shrink && r.y + r.h > box.y + shrink;
}

/**
 * Every (connector or line, unrelated element) pair where the drawn path, or
 * a connector's opaque label pill, enters the element's box shrunk by 4px.
 *
 * Candidates are every non-line element. A connector ignores its own
 * endpoints and everything nested in or around them: an edge ending at a
 * zone may run over the zone's seed card, and an edge ending at a seed card
 * may run through its zone. Any other zone counts whole — a connector drawn
 * across a zone it does not belong to paints over it.
 */
export function connectorCrossings(elements: CanvasElement[], edges: CanvasEdge[]): Crossing[] {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const candidates: { el: CanvasElement; box: Rect }[] = [];
  for (const el of elements) {
    if (el.type === "line" || el.type === "connector") continue;
    const b = realBounds(el);
    if (b) candidates.push({ el, box: b });
  }

  const ancestors = (id: string): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    let cur = byId.get(id)?.containerId;
    while (cur && !seen.has(cur)) { seen.add(cur); out.push(cur); cur = byId.get(cur)?.containerId; }
    return out;
  };
  /** Endpoints plus their container chains; an element is related if it or any ancestor is in here. */
  const relatedTo = (endpointIds: string[]): ((el: CanvasElement) => boolean) => {
    const set = new Set<string>();
    for (const id of endpointIds) { set.add(id); ancestors(id).forEach((a) => set.add(a)); }
    return (el) => set.has(el.id) || ancestors(el.id).some((a) => endpointIds.includes(a));
  };

  const out: Crossing[] = [];
  const check = (id: string, path: PathGeometry, related: (el: CanvasElement) => boolean, pill: Rect | null) => {
    const pts = path.sample(SAMPLES);
    for (const c of candidates) {
      if (related(c.el)) continue;
      if (pathEntersBox(pts, c.box)) out.push({ edgeId: id, throughId: c.el.id, by: "path" });
      else if (pill && rectEntersBox(pill, c.box)) out.push({ edgeId: id, throughId: c.el.id, by: "label" });
    }
  };

  for (const edge of edges) {
    const from = byId.get(edge.fromNodeId);
    const to = byId.get(edge.toNodeId);
    if (!from || !to) continue;
    const path = connectorPath(edge, from, to);
    const pill = edge.label?.text ? labelRect(path, edge.label.position ?? 0.5) : null;
    check(edge.id, path, relatedTo([from.id, to.id]), pill);
  }
  for (const el of elements) {
    if (el.type !== "line") continue;
    const line = el as LineElement;
    if (!line.start || !line.end) continue;
    check(line.id, linePath(line), () => false, null);
  }
  return out;
}
