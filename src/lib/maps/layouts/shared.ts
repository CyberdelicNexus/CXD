// Geometry vocabulary shared by every layout engine. All footprints are
// multiples of the 20px grid, so cumulative placements stay on-grid and
// "correct by construction" arguments hold exactly.
import { GRID_PX } from "@/lib/canvas-layout-rules";
import type { CanvasElement, LineElement } from "@/types/canvas-elements";
import {
  autoEdge, connectorHull, connectorPath, labelRect, linePath, pathEntersBox, rectEntersBox, SAMPLES,
  type PathGeometry, type Rect,
} from "../connector-geometry";
import { INSPECTOR_SECTION_IDS, SHAPE_TYPES, TINT_COLORS } from "@/lib/ai/element-generation";
import type { MapGraph, MapNode, MapRelation, NodeKind, RelationDirection, RelationStyle } from "../types";
import { clampTaskDetail, TASK_CARD_W, taskCardHeight, taskOwner } from "../task-card";

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
export type ArrowStyle = "none" | "end" | "start" | "both";
export interface LayoutEdge {
  from: string; to: string; label: string; gradient: Tint; bend: number; arrow: ArrowStyle;
  /** Set from the matching relation by styleEdges (Task 4); solid when absent. */
  lineStyle?: RelationStyle;
  /** 4 for a strong relation; 2 when absent. */
  thickness?: 2 | 4;
}
export interface Point { x: number; y: number }
export interface LayoutLine {
  start: Point; end: Point; bend: Point | null; gradient: Tint;
  /** Arrowhead at `end`; lines render caps, connectors render arrowStyle. */
  endCap?: "arrow";
  /** Arrowhead at `start` (a two-way loop-back). */
  startCap?: "arrow";
  /** Dash pattern; solid when absent. */
  kind?: RelationStyle;
  /** Stroke width; 2 when absent. */
  widthPx?: number;
}
export interface LayoutResult {
  placed: PlacedNode[]; edges: LayoutEdge[]; lines: LayoutLine[];
  /**
   * Connector/line crossings the engine could not remove (pathConflicts
   * count). Absent means the engine guarantees none by construction.
   */
  residualConflicts?: number;
}
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

export type ShapeKindType = (typeof SHAPE_TYPES)[number];

/** props.shapeType when it is a canvas shape, else "rectangle" (the plain step). */
export function shapeTypeOf(node: MapNode): ShapeKindType {
  const t = parseProps(node.props).shapeType;
  return typeof t === "string" && (SHAPE_TYPES as readonly string[]).includes(t) ? (t as ShapeKindType) : "rectangle";
}

/** Size scale for a node with emphasis "strong": size is the one emphasis every kind supports. */
export const EMPHASIS_SCALE = 1.25;

/** Rendered size per kind, with emphasis (≥ the canvas render floors in canvas-layout-rules). */
export function footprint(node: MapNode): Footprint {
  const f = baseFootprint(node);
  return node.emphasis === "strong" ? { w: snapUp(f.w * EMPHASIS_SCALE), h: snapUp(f.h * EMPHASIS_SCALE) } : f;
}

/** Rendered size per kind at normal emphasis. */
function baseFootprint(node: MapNode): Footprint {
  switch (effectiveKind(node)) {
    case "card": return { w: 260, h: 300 };
    // Painted size: 300px wide, as tall as its title, description and owner make it (task-card.ts).
    case "task": return {
      w: TASK_CARD_W,
      h: snapUp(taskCardHeight(node.label, clampTaskDetail(node.detail), taskOwner(parseProps(node.props)))),
    };
    case "bubble": return { w: 140, h: 140 };
    case "shape": return shapeTypeOf(node) === "rectangle" ? { w: 200, h: 120 } : { w: 160, h: 160 };
    case "waypoint": return { w: 80, h: 80 };
    case "portal": return { w: 180, h: 240 };
    case "anchor": return { w: 280, h: 160 };
    case "table": {
      const { rows, cols } = tableDims(parseProps(node.props));
      return { w: cols * 160, h: snapUp(rows * 48) };
    }
    case "frame": return { w: 320, h: 260 };
    case "link": return { w: 320, h: 120 };
    case "heading": return { w: 360, h: 100 };
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

/** The relation joining a and b in either direction, and whether it runs b -> a. */
function relationBetween(g: MapGraph, a: string, b: string): { rel: MapRelation; reversed: boolean } | null {
  const forward = g.relations.find((r) => r.from === a && r.to === b);
  if (forward) return { rel: forward, reversed: false };
  const back = g.relations.find((r) => r.from === b && r.to === a);
  return back ? { rel: back, reversed: true } : null;
}

/** Arrow style for a relation's direction: [drawn from -> to, drawn to -> from]. */
const ARROWS: Record<RelationDirection, [ArrowStyle, ArrowStyle]> = {
  forward: ["end", "start"],
  both: ["both", "both"],
  none: ["none", "none"],
};

/**
 * Connector colour when all six tints carry legend meanings. The connector
 * palette (connector-gradients.ts) has only the six tint gradients and no
 * neutral; glacier's is slate to near-white, the least hue-bearing of them.
 */
export const NEUTRAL_CONNECTOR: Tint = "glacier";

/**
 * The colour for a connector or line that carries no meaning (its source is
 * untinted, or it is structure: brace arms, the title divider). Without a
 * legend, the engine's own rotation colour. Beside a legend, a colour the
 * legend does not use, each engine colour mapping to one spare colour so
 * parallel branches still read apart; NEUTRAL_CONNECTOR when all six are used.
 */
export function decorativeTint(g: MapGraph, engine: Tint): Tint {
  if (g.legend.length === 0) return engine;
  const used = new Set<string>(g.legend.map((e) => e.tint));
  const spare = TINT_COLORS.filter((t) => !used.has(t));
  if (spare.length === 0) return NEUTRAL_CONNECTOR;
  return spare[TINT_COLORS.indexOf(engine) % spare.length];
}

/**
 * Connector styling from the graph: colour from the source node's tint when it
 * has one (otherwise the engine's rotation), and dash, thickness and arrows
 * from the matching relation. Beside a legend, an edge from an untinted source
 * rotates only through tints the legend does not use (as zones do), mapping
 * each engine colour to one spare colour so branches still read apart; when
 * every tint is in the legend it takes NEUTRAL_CONNECTOR. An edge no relation
 * matches keeps the engine's defaults (solid, 2px, the engine's arrow).
 * Geometry is untouched, so the engines' crossing-free guarantees hold; bend
 * stays 0 (the canvas never draws it).
 */
export function styleEdges(g: MapGraph, edges: LayoutEdge[]): LayoutEdge[] {
  const byId = new Map(g.nodes.map((x) => [x.id, x]));
  const untinted = (engine: Tint) => decorativeTint(g, engine);
  return edges.map((e) => {
    const m = relationBetween(g, e.from, e.to);
    const tint = byId.get(m ? m.rel.from : e.from)?.tint;
    const out: LayoutEdge = { ...e, bend: 0, gradient: tint ? tint : untinted(e.gradient) };
    if (!m) return out;
    return {
      ...out,
      lineStyle: m.rel.style,
      thickness: m.rel.weight === "strong" ? 4 : 2,
      arrow: ARROWS[m.rel.direction][m.reversed ? 1 : 0],
    };
  });
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

/** The connector from `a` to `b`, drawn exactly as the canvas draws it. */
export function connectorGeometry(a: PlacedNode, b: PlacedNode): PathGeometry {
  const fa = anchorElement(a);
  const fb = anchorElement(b);
  return connectorPath(autoEdge(fa, fb), fa, fb);
}

const rectOf = (p: PlacedNode): Rect => ({ x: p.x, y: p.y, w: p.w, h: p.h });

/**
 * Every (edge or line, unrelated placed box) pair where the path, drawn
 * exactly as the canvas draws it, or a labelled edge's opaque pill, enters the
 * box shrunk by SHRINK — the property harness's test, run on the engine's own
 * boxes. Line indices follow the edges (edges.length + i).
 */
export function pathConflicts(r: LayoutResult): { edge: number; node: string }[] {
  const byId = new Map(r.placed.map((p) => [p.node.id, p]));
  const out: { edge: number; node: string }[] = [];
  const test = (i: number, pts: Point[], pill: Rect | null, skip: (p: PlacedNode) => boolean) => {
    for (const p of r.placed) {
      if (skip(p)) continue;
      const box = rectOf(p);
      if (pathEntersBox(pts, box) || (pill && rectEntersBox(pill, box))) out.push({ edge: i, node: p.node.id });
    }
  };
  r.edges.forEach((e, i) => {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) return;
    const path = connectorGeometry(a, b);
    test(i, path.sample(SAMPLES), e.label.trim() ? labelRect(path) : null, (p) => p === a || p === b);
  });
  r.lines.forEach((l, i) => {
    const line = { start: l.start, end: l.end, bend: l.bend ?? undefined } as LineElement;
    test(r.edges.length + i, linePath(line).sample(SAMPLES), null, () => false);
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
    ...(out.residualConflicts !== undefined ? { residualConflicts: out.residualConflicts } : {}),
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

/** Hard cap the harness enforces on rendered aspect for compact map types. */
export const ASPECT_MAX = 3;
/** Aspect engines aim for when choosing between layout variants (slack under ASPECT_MAX). */
export const ASPECT_TARGET = 2.5;

/**
 * Among candidates whose rendered aspect is at most `limit`, the one with the
 * smallest bounding-box area (the densest; ties keep the earlier); if none is
 * within the limit, the squarest. Candidates after the first must pass
 * isClean to be considered; the first is the engine's by-construction layout
 * and always qualifies.
 */
export function squarest(candidates: (() => LayoutResult)[], limit: number): LayoutResult {
  let within: { r: LayoutResult; area: number } | null = null;
  let best: { r: LayoutResult; a: number } | null = null;
  for (let i = 0; i < candidates.length; i++) {
    const r = candidates[i]();
    if (i > 0 && !isClean(r)) continue;
    const a = renderedAspect(r.placed);
    if (a <= limit) {
      const b = boundsOf(r.placed);
      const area = (b.maxX - b.minX) * (b.maxY - b.minY);
      if (!within || area < within.area) within = { r, area };
    } else if (!best || a < best.a - 0.01) best = { r, a };
  }
  return (within ?? best)!.r;
}
