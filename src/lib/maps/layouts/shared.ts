// Geometry vocabulary shared by every layout engine. All footprints are
// multiples of the 20px grid, so cumulative placements stay on-grid and
// "correct by construction" arguments hold exactly.
import { GRID_PX } from "@/lib/canvas-layout-rules";
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
export interface LayoutLine { start: Point; end: Point; bend: Point | null; gradient: Tint }
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
