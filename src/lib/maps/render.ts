// Graph -> real canvas elements. Layout engines decide geometry; the existing
// generatedToCanvas builds the elements (fresh ids, kind builders, render
// floors, repairLayout) so maps and every other AI path share one
// element-construction route. What generatedToCanvas cannot express (task
// cards, heading type, shape and table accents, a portal tint that beats a
// props hexColor, neutral fills beside a legend) is applied to its output
// here, by ref. The legend is a row of tinted swatches with labels under the
// title and above the divider: part of the title band.
import type { CanvasEdge, CanvasElement, LineElement } from "@/types/canvas-elements";
import {
  BOARD_HEX_COLORS, generatedToCanvas, TINT_COLORS,
  type GeneratedEdge, type GeneratedElement,
} from "@/lib/ai/element-generation";
import { TINTABLE_KINDS } from "./catalog";
import {
  HEADING_FONT_PX, LEGEND, legendLabelWidth, NEUTRAL_CARD_BG, NEUTRAL_HEX, shapeTintStyle, TINT_ACCENTS,
} from "./element-style";
import { upgradeGraph, type LegacyMapGraph } from "./legacy";
import type { LegendEntry, MapGraph } from "./types";
import { LAYOUTS } from "./layouts";
import {
  boundsOf, effectiveKind, parseProps, shapeTypeOf, snap, snapUp, styleEdges,
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
 * Fill defaults for graphs stored before the element vocabulary, clamp table
 * data so the rendered grid matches the footprint engines assumed, and drop
 * duplicate relations (the same from→to twice would draw two overlapping
 * connectors).
 */
export function normalizeGraph(input: LegacyMapGraph): MapGraph {
  const graph = upgradeGraph(input);
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
    ref: node.id, parentRef: null, tint: node.tint || null, hypercubeTags: null,
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
    case "bubble":
      return [{ ...base, kind: "shape", label: null, content: node.label, shapeType: "circle" }];
    case "waypoint":
      return [{ ...base, kind: "shape", label: null, content: node.label, shapeType: parseProps(node.props).shapeType === "circle" ? "circle" : "diamond" }];
    case "shape":
      return [{ ...base, kind: "shape", label: null, content: node.label, shapeType: shapeTypeOf(node) }];
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
    case "heading":
      return [{ ...base, kind: "text", label: null, content: node.label, shapeType: null }];
    case "caption":
      return [{ ...base, kind: "text", label: null, content: node.label, shapeType: null }];
    case "zone":
      // Seeds, never blanks (templates.design.md §4): every zone ships a card.
      return [
        { ...base, kind: "container", label: node.label, content: null, shapeType: null, props: null },
        {
          ...base, ref: `${node.id}__seed`, parentRef: node.id, kind: "freeform", tint: null,
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
    style: {
      kind: l.kind ?? "solid", widthPx: l.widthPx ?? 2, gradientName: l.gradient,
      ...(l.endCap ? { endCap: l.endCap } : {}),
      ...(l.startCap ? { startCap: l.startCap } : {}),
    },
  };
}

export interface RenderedMap {
  elements: CanvasElement[];
  edges: CanvasEdge[];
}

export interface LegendSlot { entry: LegendEntry; x: number; y: number; labelW: number }

/** Legend entries in rows no wider than maxW from (x0, y0). Height is 0 for an empty legend. */
export function layoutLegend(legend: LegendEntry[], x0: number, y0: number, maxW: number): { slots: LegendSlot[]; height: number } {
  const slots: LegendSlot[] = [];
  let x = x0;
  let y = y0;
  for (const entry of legend) {
    const labelW = legendLabelWidth(entry.meaning);
    const w = LEGEND.swatch + LEGEND.labelGap + labelW;
    if (x > x0 && x + w - x0 > maxW) { x = x0; y += LEGEND.rowH + LEGEND.rowGap; }
    slots.push({ entry, x, y, labelW });
    x += w + LEGEND.entryGap;
  }
  return { slots, height: legend.length ? y - y0 + LEGEND.rowH : 0 };
}

/** Styling generatedToCanvas cannot express, applied to its output by ref. */
function styleNodes(g: MapGraph, at: (ref: string) => CanvasElement | undefined): void {
  const legendTints = new Set<string>(g.legend.map((e) => e.tint));
  const hasLegend = g.legend.length > 0;
  // Beside a legend, untinted zones rotate only through tints that mean nothing here.
  const spare = TINT_COLORS.filter((t) => !legendTints.has(t));
  let spareIdx = 0;
  for (const node of g.nodes) {
    const el = at(node.id);
    if (!el) continue;
    const kind = effectiveKind(node);
    const tint = node.tint && TINTABLE_KINDS.includes(node.kind) ? node.tint : null;
    if (kind === "task" && el.type === "freeform") {
      const p = parseProps(node.props);
      const owner = typeof p.owner === "string" && p.owner.trim() ? p.owner.trim().slice(0, 60) : undefined;
      el.content = node.label;
      el.taskMetadata = {
        isActionable: true,
        subtasks: [],
        ...(node.detail ? { description: node.detail } : {}),
        ...(owner ? { assignee: owner } : {}),
      };
      if (!el.emoji) el.emoji = "✅";
    }
    if (kind === "heading" && el.type === "text") {
      el.style = { ...el.style, fontSize: HEADING_FONT_PX, fontWeight: "semibold" };
    }
    if (tint) {
      if (el.type === "shape") el.style = shapeTintStyle(tint);
      else if (el.type === "table") el.lineColor = TINT_ACCENTS[tint];
      else if (el.type === "board") el.hexColor = BOARD_HEX_COLORS[tint];
    } else if (hasLegend) {
      if (el.type === "freeform") el.style = { ...el.style, bgColor: NEUTRAL_CARD_BG };
      else if (el.type === "board") el.hexColor = NEUTRAL_HEX;
      else if (el.type === "container" && spare.length) el.tintColor = spare[spareIdx++ % spare.length];
    }
    if (kind === "zone" && hasLegend) {
      const seed = at(`${node.id}__seed`);
      if (seed && seed.type === "freeform") seed.style = { ...seed.style, bgColor: NEUTRAL_CARD_BG };
    }
  }
}

/**
 * Render a structurally valid graph (checkMapStructure returned no violations)
 * with its title's top-left at `origin`.
 */
export function renderMap(graph: LegacyMapGraph, origin: Point = { x: 0, y: 0 }): RenderedMap {
  const g = normalizeGraph(graph);
  const engine = LAYOUTS[g.mapType];
  if (!engine) throw new Error(`No layout engine for ${g.mapType}`);
  const layout = engine(g);

  const b = boundsOf(layout.placed);
  const titleW = Math.min(1200, Math.max(280, snapUp(b.maxX - b.minX)));
  // The legend sits under the title and above the divider, inside the title band.
  const legendMaxW = Math.max(titleW, LEGEND.minRowW);
  const legendH = layoutLegend(g.legend, 0, 0, legendMaxW).height;
  const legendBand = legendH ? LEGEND.gapAboveRow + legendH : 0;
  const titleY = b.minY - TITLE_GAP - legendBand - TITLE_H;
  const legend = layoutLegend(g.legend, b.minX, titleY + TITLE_H + LEGEND.gapAboveRow, legendMaxW);
  const dx = snap(origin.x) - b.minX;
  const dy = snap(origin.y) - titleY;

  const generated: GeneratedElement[] = [
    {
      kind: "text", ref: "__title", parentRef: null, label: null, content: g.title,
      tint: null, shapeType: null, hypercubeTags: null,
      x: b.minX, y: titleY, width: titleW, height: TITLE_H, props: null,
    } as GeneratedElement,
    ...legend.slots.flatMap((s, i): GeneratedElement[] => [
      {
        kind: "shape", ref: `__legend${i}`, parentRef: null, label: null, content: null,
        tint: null, shapeType: "circle", hypercubeTags: null,
        x: s.x, y: s.y, width: LEGEND.swatch, height: LEGEND.swatch, props: null,
      },
      {
        kind: "text", ref: `__legend${i}_label`, parentRef: null, label: null, content: s.entry.meaning.trim(),
        tint: null, shapeType: null, hypercubeTags: null,
        x: s.x + LEGEND.swatch + LEGEND.labelGap, y: s.y, width: s.labelW, height: LEGEND.rowH, props: null,
      },
    ]),
    ...layout.placed.flatMap(toGenerated),
  ].map((e) => ({ ...e, x: e.x + dx, y: e.y + dy }));

  const genEdges: GeneratedEdge[] = styleEdges(g, layout.edges).map((e) => ({
    from: e.from,
    to: e.to,
    label: e.label.trim() || null,
    props: JSON.stringify({
      gradientName: e.gradient, bend: e.bend, arrowStyle: e.arrow,
      thickness: e.thickness ?? 2, lineStyle: e.lineStyle ?? "solid",
    }),
  }));

  const converted = generatedToCanvas(generated, genEdges);
  const byId = new Map(converted.elements.map((el) => [el.id, el]));
  const at = (ref: string) => {
    const id = converted.idByRef.get(ref);
    return id ? byId.get(id) : undefined;
  };
  styleNodes(g, at);
  legend.slots.forEach((s, i) => {
    const swatch = at(`__legend${i}`);
    if (swatch && swatch.type === "shape") swatch.style = shapeTintStyle(s.entry.tint);
  });

  const divider: LayoutLine = {
    start: { x: b.minX, y: b.minY - TITLE_GAP / 2 },
    end: { x: b.minX + titleW, y: b.minY - TITLE_GAP / 2 },
    bend: null,
    gradient: "violet",
  };
  const lines = [...layout.lines, divider].map((l) => toLine(l, dx, dy));
  return { elements: [...converted.elements, ...lines], edges: converted.edges };
}
