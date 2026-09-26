// Graph -> real canvas elements. Layout engines decide geometry; the existing
// generatedToCanvas builds the elements (fresh ids, kind builders, render
// floors, repairLayout) so maps and every other AI path share one
// element-construction route.
import type { CanvasElement, CanvasEdge, LineElement } from "@/types/canvas-elements";
import { generatedToCanvas, type GeneratedEdge, type GeneratedElement } from "@/lib/ai/element-generation";
import type { MapGraph } from "./types";
import { LAYOUTS } from "./layouts";
import {
  boundsOf, effectiveKind, parseProps, shapeTypeOf, snap, snapUp,
  TABLE_MAX_COLS, TABLE_MAX_ROWS,
  type LayoutLine, type PlacedNode, type Point,
} from "./layouts/shared";

const TITLE_H = 60;
const TITLE_GAP = 60;
/** Seed card inside a zone: inside the container, below its 56px header band. */
const ZONE_SEED = { dx: 40, dy: 80, w: 260, h: 300 };
/** Longest title that fits the fixed 60px title box without spilling onto the divider. */
const TITLE_MAX = 80;

function clampTitle(raw: string): string {
  const t = raw.trim() || "Map";
  return t.length <= TITLE_MAX ? t : `${t.slice(0, TITLE_MAX - 1).trimEnd()}…`;
}

/**
 * Clamp table data so the rendered grid matches the footprint engines assumed,
 * and drop duplicate relations (the same from→to twice would draw two
 * overlapping connectors).
 */
export function normalizeGraph(graph: MapGraph): MapGraph {
  const seen = new Set<string>();
  const relations = graph.relations.filter((r) => {
    const key = `${r.from}->${r.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    ...graph,
    relations,
    title: clampTitle(graph.title),
    nodes: graph.nodes.map((node) => {
      if (node.kind !== "table") return node;
      const p = parseProps(node.props);
      if (Array.isArray(p.cells)) {
        p.cells = (p.cells as unknown[])
          .filter(Array.isArray)
          .slice(0, TABLE_MAX_ROWS)
          .map((row) => (row as unknown[]).slice(0, TABLE_MAX_COLS));
      }
      // Round before clamping: {"rows": 2.5} would otherwise give a table whose
      // rows field disagrees with its cell grid.
      if (typeof p.rows === "number") p.rows = Math.min(Math.max(Math.round(p.rows), 1), TABLE_MAX_ROWS);
      if (typeof p.cols === "number") p.cols = Math.min(Math.max(Math.round(p.cols), 1), TABLE_MAX_COLS);
      return { ...node, props: JSON.stringify(p) };
    }),
  };
}

function toGenerated(p: PlacedNode): GeneratedElement[] {
  const node = p.node;
  const base = {
    ref: node.id, parentRef: null, tint: null, hypercubeTags: null,
    x: p.x, y: p.y, width: p.w, height: p.h, props: node.props,
  };
  switch (effectiveKind(node)) {
    case "card":
      return [{ ...base, kind: "freeform", label: node.label, content: node.detail || null, shapeType: null }];
    case "task":
      return [{
        ...base, kind: "freeform", label: node.label, content: node.detail || null, shapeType: null,
        props: JSON.stringify({ ...parseProps(node.props), cardType: "task" }),
      }];
    case "shape":
      return [{ ...base, kind: "shape", label: null, content: node.label, shapeType: shapeTypeOf(node) }];
    case "heading":
      return [{ ...base, kind: "text", label: null, content: node.label, shapeType: null }];
    case "bubble":
      return [{ ...base, kind: "shape", label: null, content: node.label, shapeType: "circle" }];
    case "waypoint":
      return [{ ...base, kind: "shape", label: null, content: node.label, shapeType: parseProps(node.props).shapeType === "circle" ? "circle" : "diamond" }];
    case "portal":
      return [{ ...base, kind: "board", label: node.label, content: node.detail || null, shapeType: null }];
    case "anchor":
      return [{ ...base, kind: "experienceBlock", label: node.label, content: null, shapeType: null }];
    case "table":
      return [{ ...base, kind: "table", label: node.label, content: null, shapeType: null }];
    case "frame":
      return [{ ...base, kind: "image", label: node.label, content: node.detail || node.label, shapeType: null }];
    case "link":
      return [{ ...base, kind: "link", label: node.label, content: node.detail || null, shapeType: null }];
    case "caption":
      return [{ ...base, kind: "text", label: null, content: node.label, shapeType: null }];
    case "zone":
      // Seeds, never blanks (templates.design.md §4): every zone ships a card.
      return [
        { ...base, kind: "container", label: node.label, content: null, shapeType: null, props: null },
        {
          ...base, ref: `${node.id}__seed`, parentRef: node.id, kind: "freeform",
          label: "Start here", content: node.detail || "Add your thinking here", shapeType: null, props: null,
          x: p.x + ZONE_SEED.dx, y: p.y + ZONE_SEED.dy, width: ZONE_SEED.w, height: ZONE_SEED.h,
        },
      ];
  }
}

function toLine(l: LayoutLine, dx: number, dy: number): LineElement {
  const start = { x: l.start.x + dx, y: l.start.y + dy };
  const end = { x: l.end.x + dx, y: l.end.y + dy };
  return {
    id: crypto.randomUUID(),
    type: "line",
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.max(1, Math.abs(end.x - start.x)),
    height: Math.max(1, Math.abs(end.y - start.y)),
    zIndex: 1,
    locked: false,
    boardId: null,
    surface: "canvas",
    start,
    end,
    ...(l.bend ? { bend: { x: l.bend.x + dx, y: l.bend.y + dy } } : {}),
    style: { kind: "solid", widthPx: 2, gradientName: l.gradient, ...(l.endCap ? { endCap: l.endCap } : {}) },
  };
}

export interface RenderedMap {
  elements: CanvasElement[];
  edges: CanvasEdge[];
}

/**
 * Render a structurally valid graph (checkMapStructure returned no violations)
 * with its title's top-left at `origin`.
 */
export function renderMap(graph: MapGraph, origin: Point = { x: 0, y: 0 }): RenderedMap {
  const g = normalizeGraph(graph);
  const engine = LAYOUTS[g.mapType];
  if (!engine) throw new Error(`No layout engine for ${g.mapType}`);
  const layout = engine(g);

  const b = boundsOf(layout.placed);
  const titleY = b.minY - TITLE_GAP - TITLE_H;
  const titleW = Math.min(1200, Math.max(280, snapUp(b.maxX - b.minX)));
  const dx = snap(origin.x) - b.minX;
  const dy = snap(origin.y) - titleY;

  const generated: GeneratedElement[] = [
    {
      kind: "text", ref: "__title", parentRef: null, label: null, content: g.title,
      tint: null, shapeType: null, hypercubeTags: null,
      x: b.minX, y: titleY, width: titleW, height: TITLE_H, props: null,
    } as GeneratedElement,
    ...layout.placed.flatMap(toGenerated),
  ].map((e) => ({ ...e, x: e.x + dx, y: e.y + dy }));

  const genEdges: GeneratedEdge[] = layout.edges.map((e) => ({
    from: e.from,
    to: e.to,
    label: e.label.trim() || null,
    props: JSON.stringify({ gradientName: e.gradient, bend: e.bend, arrowStyle: e.arrow, thickness: 2 }),
  }));

  const converted = generatedToCanvas(generated, genEdges);

  const divider: LayoutLine = {
    start: { x: b.minX, y: b.minY - TITLE_GAP / 2 },
    end: { x: b.minX + titleW, y: b.minY - TITLE_GAP / 2 },
    bend: null,
    gradient: "violet",
  };
  const lines = [...layout.lines, divider].map((l) => toLine(l, dx, dy));
  return { elements: [...converted.elements, ...lines], edges: converted.edges };
}
