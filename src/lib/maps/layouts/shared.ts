// Geometry vocabulary shared by every layout engine. All footprints are
// multiples of the 20px grid, so cumulative placements stay on-grid and
// "correct by construction" arguments hold exactly.
import { GRID_PX } from "@/lib/canvas-layout-rules";
import type { CanvasElement, LineElement } from "@/types/canvas-elements";
import { autoEdge, connectorHull, connectorPath, linePath } from "../connector-geometry";
import { TINT_COLORS, INSPECTOR_SECTION_IDS } from "@/lib/ai/element-generation";
import type { MapGraph, MapNode, NodeKind } from "../types";

export const GAP = 40;          // between siblings in a stack
export const LEVEL_GAP = 120;   // between hierarchy levels / columns
export const ZONE_GAP = 160;    // between major columns
export const RING_SLACK = 80;   // ring spacing margin; covers grid-snap drift

export type Tint = (typeof TINT_COLORS)[number];
export const tintAt = (i: number): Tint => TINT_COLORS[((i % TINT_COLORS.length) + TINT_COLORS.length) % TINT_COLORS.length];

export const snap = (v: number) => Math.round(v / GRID_PX) * GRID_PX;
export const snapUp = (v: number) => Math.ceil(v / GRID_PX) * GRID_PX;
export const snapDown = (v: number) => Math.floor(v / GRID_PX) * GRID_PX;

export interface Footprint { w: number; h: number }
export interface PlacedNode { node: MapNode; x: number; y: number; w: number; h: number }
export interface LayoutEdge { from: string; to: string; label: string; gradient: Tint; bend: number; arrow: "none" | "end" }
export interface Point { x: number; y: number }
export interface LayoutLine {
  start: Point; end: Point; bend: Point | null; gradient: Tint;
  /** Arrowhead at `end`; lines render caps, connectors render arrowStyle. */
  endCap?: "arrow";
}
export interface LayoutResult { placed: PlacedNode[]; edges: LayoutEdge[]; lines: LayoutLine[] }
export type LayoutEngine = (graph: MapGraph) => LayoutResult;

export function parseProps(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const TABLE_MAX_ROWS = 10;
export const TABLE_MAX_COLS = 6;

/** Table size as rendered — mirrors how generatedToCanvas reads table props. */
export function tableDims(props: Record<string, unknown>): { rows: number; cols: number } {
  const cells = Array.isArray(props.cells) ? (props.cells as unknown[]).filter(Array.isArray) as unknown[][] : [];
  const rows = cells.length || (typeof props.rows === "number" ? props.rows : 3);
  const cols = cells[0]?.length || (typeof props.cols === "number" ? props.cols : 3);
  return {
    rows: Math.min(Math.max(Math.round(rows), 1), TABLE_MAX_ROWS),
    cols: Math.min(Math.max(Math.round(cols), 1), TABLE_MAX_COLS),
  };
}

/**
 * The kind actually rendered. Kinds that need data fall back to a card when
 * the data is missing: generatedToCanvas drops an experienceBlock without a
 * valid componentKey and a link without a url, which would silently lose the
 * node and every edge touching it.
 */
export function effectiveKind(node: MapNode): NodeKind {
  const p = parseProps(node.props);
  if (node.kind === "anchor") {
    const key = p.componentKey;
    return typeof key === "string" && (INSPECTOR_SECTION_IDS as readonly string[]).includes(key) ? "anchor" : "card";
  }
  if (node.kind === "link") return typeof p.url === "string" && p.url.trim() ? "link" : "card";
  return node.kind;
}

/** Rendered size per kind (≥ the canvas render floors in canvas-layout-rules). */
export function footprint(node: MapNode): Footprint {
  switch (effectiveKind(node)) {
    case "card": return { w: 260, h: 300 };
    case "bubble": return { w: 140, h: 140 };
    case "waypoint": return { w: 80, h: 80 };
    case "portal": return { w: 180, h: 240 };
    case "anchor": return { w: 280, h: 160 };
    case "table": {
      const { rows, cols } = tableDims(parseProps(node.props));
      return { w: cols * 160, h: snapUp(rows * 48) };
    }
    case "frame": return { w: 320, h: 260 };
    case "link": return { w: 320, h: 120 };
    case "caption": return { w: 280, h: 60 };
    case "zone": return { w: 340, h: 420 };
  }
}

export const placeAt = (node: MapNode, x: number, y: number): PlacedNode => {
  const f = footprint(node);
  return { node, x, y, w: f.w, h: f.h };
};

/** Top-left snapped so the box is centred on (cx, cy) to within 10px. */
export const placeCentered = (node: MapNode, cx: number, cy: number): PlacedNode => {
  const f = footprint(node);
  return { node, x: snap(cx - f.w / 2), y: snap(cy - f.h / 2), w: f.w, h: f.h };
};

export function columnSize(nodes: MapNode[]): Footprint {
  if (nodes.length === 0) return { w: 0, h: 0 };
  const fps = nodes.map(footprint);
  return {
    w: Math.max(...fps.map((f) => f.w)),
    h: fps.reduce((s, f) => s + f.h, 0) + GAP * (nodes.length - 1),
  };
}

/** Left-aligned vertical stack starting at (x, top). */
export function stackColumn(nodes: MapNode[], x: number, top: number): PlacedNode[] {
  const out: PlacedNode[] = [];
  let y = top;
  for (const node of nodes) {
    const p = placeAt(node, x, y);
    out.push(p);
    y += p.h + GAP;
  }
  return out;
}

/** Vertical stack centred on y = axisY. */
export function centeredColumn(nodes: MapNode[], x: number, axisY = 0): PlacedNode[] {
  const { h } = columnSize(nodes);
  return stackColumn(nodes, x, snapDown(axisY - h / 2));
}

/**
 * Centres of `items` on a ring around a centre box, spaced so that no two
 * boxes (compared by circumscribed circles) can overlap even after each
 * top-left is snapped to the grid.
 */
export function ringCenters(center: Footprint, items: Footprint[]): Point[] {
  const count = items.length;
  if (count === 0) return [];
  const diag = (f: Footprint) => Math.hypot(f.w, f.h);
  const maxD = Math.max(...items.map(diag));
  let radius = diag(center) / 2 + maxD / 2 + RING_SLACK;
  if (count >= 2) radius = Math.max(radius, (maxD + RING_SLACK) / (2 * Math.sin(Math.PI / count)));
  return items.map((_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / count;
    return { x: radius * Math.cos(a), y: radius * Math.sin(a) };
  });
}

export function relationLabel(g: MapGraph, a: string, b: string): string {
  const rel = g.relations.find((r) => (r.from === a && r.to === b) || (r.from === b && r.to === a));
  return rel?.label ?? "";
}

export function boundsOf(placed: PlacedNode[]): { minX: number; minY: number; maxX: number; maxY: number } {
  return {
    minX: Math.min(...placed.map((p) => p.x)),
    minY: Math.min(...placed.map((p) => p.y)),
    maxX: Math.max(...placed.map((p) => p.x + p.w)),
    maxY: Math.max(...placed.map((p) => p.y + p.h)),
  };
}

// ─── Connector legibility ───────────────────────────────────────────
// The canvas draws every connector ABOVE all elements from auto anchors: the
// sides facing each other along the dominant axis between the two centres
// (horizontal when |dx| > |dy|). Engines keep each connector's hull clear of
// unrelated boxes, so no connector paints over a card.

/** Slack by which one axis must dominate the other, so grid snapping can never flip an anchor side. */
export const DOMINANCE = 40;

export interface Box { x0: number; y0: number; x1: number; y1: number }

export const centerOf = (p: { x: number; y: number; w: number; h: number }): Point => ({ x: p.x + p.w / 2, y: p.y + p.h / 2 });
export const boxOf = (p: { x: number; y: number; w: number; h: number }): Box => ({ x0: p.x, y0: p.y, x1: p.x + p.w, y1: p.y + p.h });

/** Strict interior overlap of two boxes, each grown by `margin`. */
export const boxesMeet = (a: Box, b: Box, margin = 0): boolean =>
  a.x0 - margin < b.x1 && b.x0 - margin < a.x1 && a.y0 - margin < b.y1 && b.y0 - margin < a.y1;

export function unionBox(boxes: Box[]): Box {
  return {
    x0: Math.min(...boxes.map((b) => b.x0)), y0: Math.min(...boxes.map((b) => b.y0)),
    x1: Math.max(...boxes.map((b) => b.x1)), y1: Math.max(...boxes.map((b) => b.y1)),
  };
}

/** Just enough of a canvas element for anchor geometry; portals render as boards (hexagon anchors). */
function anchorElement(p: PlacedNode): CanvasElement {
  return {
    id: p.node.id, type: effectiveKind(p.node) === "portal" ? "board" : "freeform",
    x: p.x, y: p.y, width: p.w, height: p.h,
  } as unknown as CanvasElement;
}

/** Box containing the whole drawn connector from `a` to `b`. */
export function hullOf(a: PlacedNode, b: PlacedNode): Box {
  const fa = anchorElement(a);
  const fb = anchorElement(b);
  return connectorHull(autoEdge(fa, fb), fa, fb);
}

/** The connector from `a` to `b`, drawn exactly as the canvas draws it, sampled at 200 points. */
export function connectorSamples(a: PlacedNode, b: PlacedNode): Point[] {
  const fa = anchorElement(a);
  const fb = anchorElement(b);
  return connectorPath(autoEdge(fa, fb), fa, fb).sample(200);
}

/**
 * Every (edge, unrelated placed box) pair where the connector, drawn exactly
 * as the canvas draws it (sampled), enters the box shrunk by 4px, or where a
 * layout line does. The same test the property harness applies to the
 * rendered map, run on the engine's own boxes.
 */
export function pathConflicts(r: LayoutResult): { edge: number; node: string }[] {
  const byId = new Map(r.placed.map((p) => [p.node.id, p]));
  const out: { edge: number; node: string }[] = [];
  const test = (i: number, pts: Point[], skip: (p: PlacedNode) => boolean) => {
    for (const p of r.placed) {
      if (skip(p)) continue;
      if (pts.some((q) => q.x > p.x + 4 && q.x < p.x + p.w - 4 && q.y > p.y + 4 && q.y < p.y + p.h - 4)) out.push({ edge: i, node: p.node.id });
    }
  };
  r.edges.forEach((e, i) => {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) return;
    test(i, connectorSamples(a, b), (p) => p === a || p === b);
  });
  r.lines.forEach((l, i) => {
    const line = { start: l.start, end: l.end, bend: l.bend ?? undefined } as LineElement;
    test(r.edges.length + i, linePath(line).sample(200), () => false);
  });
  return out;
}

/**
 * The aspect the rendered map will have: renderMap adds a title band
 * (60px gap + 60px title, as wide as the map up to 1200px) above it.
 */
export function renderedAspect(placed: PlacedNode[]): number {
  const b = boundsOf(placed);
  const w = Math.max(b.maxX - b.minX, 280);
  const h = b.maxY - b.minY + 120;
  return Math.max(w / h, h / w);
}

export type FootprintFn = (node: MapNode) => Footprint;

/**
 * Run a layout written for one orientation in the other: the engine lays out
 * with every footprint's width and height swapped, and the result is mirrored
 * across the diagonal (x <-> y). Auto anchors pick sides by the dominant axis,
 * which the mirror swaps too, so every clearance argument carries over.
 */
export function transposed(run: (fp: FootprintFn) => LayoutResult): LayoutResult {
  const out = run((node) => { const f = footprint(node); return { w: f.h, h: f.w }; });
  const flip = (p: Point): Point => ({ x: p.y, y: p.x });
  return {
    placed: out.placed.map((p) => ({ node: p.node, x: p.y, y: p.x, w: p.h, h: p.w })),
    edges: out.edges,
    lines: out.lines.map((l) => ({ ...l, start: flip(l.start), end: flip(l.end), bend: l.bend && flip(l.bend) })),
  };
}

/**
 * True when no two boxes come within `margin` of each other and no connector
 * or line crosses an unrelated box: the drawn map is overlap- and crossing-free.
 */
export function isClean(r: LayoutResult, margin = GAP): boolean {
  const p = r.placed;
  for (let a = 0; a < p.length; a++) {
    for (let b = a + 1; b < p.length; b++) if (boxesMeet(boxOf(p[a]), boxOf(p[b]), margin / 2)) return false;
  }
  return pathConflicts(r).length === 0;
}

/**
 * The first candidate whose rendered aspect is at most `limit`, else the
 * squarest. Candidates after the first must pass isClean to be considered;
 * the first is the engine's by-construction layout and always qualifies.
 */
export function squarest(candidates: (() => LayoutResult)[], limit: number): LayoutResult {
  let best: { r: LayoutResult; a: number } | null = null;
  for (let i = 0; i < candidates.length; i++) {
    const r = candidates[i]();
    if (i > 0 && !isClean(r)) continue;
    const a = renderedAspect(r.placed);
    if (a <= limit) return r;
    if (!best || a < best.a - 0.01) best = { r, a };
  }
  return best!.r;
}
