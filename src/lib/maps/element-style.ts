// How a map's colour and emphasis reach canvas elements, and how to read them
// back from rendered elements (the judges' description and element-usage
// stats read maps only through what is drawn). Pure: server and lab UI.
import type { CanvasElement, ElementStyle, TextElement } from "@/types/canvas-elements";
import { BOARD_HEX_COLORS, TINT_COLORS, TINT_GRADIENTS } from "@/lib/ai/element-generation";
import type { Tint } from "./types";

/** Bright accent per tint: shape outlines, table borders and legend swatches. */
export const TINT_ACCENTS: Record<Tint, string> = {
  violet: "#a78bfa",
  ocean: "#38bdf8",
  emerald: "#34d399",
  sunset: "#fb923c",
  rose: "#fb7185",
  glacier: "#67e8f9",
};

/** Fill for untinted cards when the map has a legend, so no card borrows a colour that means something. */
export const NEUTRAL_CARD_BG = "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)";
/** Hexagon fill for untinted portals when the map has a legend. */
export const NEUTRAL_HEX = "#2d2d2d";
/** Heading text size (captions stay at the generator's 14px). */
export const HEADING_FONT_PX = 24;
/**
 * Heading weight. TextCard passes style.fontWeight straight to inline CSS, so
 * it must be a CSS keyword or number: "semibold" and "medium" are dropped by
 * the browser. "bold" is what the canvas's own heading tool stores.
 */
export const HEADING_FONT_WEIGHT = "bold" as const;
/** Map title size: clearly the largest text on the map, bigger than a heading's 24px. */
export const TITLE_FONT_PX = 28;
export const TITLE_FONT_WEIGHT = "bold" as const;

/**
 * Untinted shapes, bubbles and waypoints beside a legend: white-on-glass, so
 * no uncoloured node borrows the generator's violet fill and colour-meaning
 * stays with the legend.
 */
export const NEUTRAL_SHAPE_STYLE: ElementStyle = {
  bgColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.35)", borderWidth: 2, textColor: "#ffffff",
};

/** Legend row geometry, all on the 20px grid: swatch, gap, label; rows wrap at max(title width, minRowW). */
export const LEGEND = {
  swatch: 20, labelGap: 20, entryGap: 20, rowH: 20, rowGap: 20, gapAboveRow: 20,
  charW: 8, labelMinW: 60, labelMaxW: 260, minRowW: 600,
} as const;

const rgba = (hex: string, a: number) =>
  `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;

/** Shape styling for a tinted node. */
export function shapeTintStyle(tint: Tint): ElementStyle {
  return { bgColor: rgba(TINT_ACCENTS[tint], 0.22), borderColor: TINT_ACCENTS[tint], borderWidth: 2, textColor: "#ffffff" };
}

/**
 * Legend swatch: an opaque disc in the tint's card colour (the midpoint of its
 * card gradient, which is also the portal hex fill) ringed in its accent (the
 * outline of tinted shapes and tables), so it reads as the same colour as
 * every element that uses the tint. ShapeCard strokes in a 100-unit viewBox
 * stretched to the element, so on a 20px swatch borderWidth 12 is a 2.4px ring.
 */
export function swatchStyle(tint: Tint): ElementStyle {
  return { bgColor: BOARD_HEX_COLORS[tint], borderColor: TINT_ACCENTS[tint], borderWidth: 12, textColor: "#ffffff" };
}

/** Characters in a legend meaning, counted as the legend rule counts them (code points, not UTF-16 units). */
export const meaningLength = (meaning: string): number => Array.from(meaning.trim()).length;

/** Width of a legend label: about 8px per character plus padding, on the grid, within [60, 260]. */
export function legendLabelWidth(meaning: string): number {
  const w = Math.ceil((meaningLength(meaning) * LEGEND.charW + 20) / 20) * 20;
  return Math.min(LEGEND.labelMaxW, Math.max(LEGEND.labelMinW, w));
}

function tintByValue(table: Record<Tint, string>, value: unknown): Tint | null {
  return TINT_COLORS.find((t) => table[t] === value) ?? null;
}

/** The tint a rendered element carries, recovered from its styling; null when it has none. */
export function tintOf(el: CanvasElement): Tint | null {
  switch (el.type) {
    case "container": return el.tintColor ?? null;
    case "freeform": return tintByValue(TINT_GRADIENTS, el.style?.bgColor);
    case "board": return tintByValue(BOARD_HEX_COLORS, el.hexColor);
    case "shape": return tintByValue(TINT_ACCENTS, el.style?.borderColor);
    case "table": return tintByValue(TINT_ACCENTS, el.lineColor);
    default: return null;
  }
}

/**
 * True for the map's own title element (renderMap's synthetic `__title`, never
 * a real graph node): the only text element a rendered map ever draws at
 * TITLE_FONT_PX. A real heading node is drawn at the strictly smaller
 * HEADING_FONT_PX (styleNodes), and no other text element's size is driven by
 * anything but that or the generator's fixed 14px default, so this fontSize
 * alone identifies it without threading an id through RenderedMap.
 */
export function isTitleElement(el: CanvasElement): boolean {
  return el.type === "text" && el.style?.fontSize === TITLE_FONT_PX;
}

export interface DrawnLegendEntry { tint: Tint; meaning: string; swatchId: string; labelId: string }

/**
 * Legend entries as renderMap draws them: a 20px tinted circle and, 40px to
 * its right on the same row, its label. The label is matched by position
 * only: TextCard auto-grows text heights, so a canvas snapshot's label is
 * rarely still 20px tall.
 */
export function readLegend(elements: CanvasElement[]): DrawnLegendEntry[] {
  const out: DrawnLegendEntry[] = [];
  for (const el of elements) {
    if (el.type !== "shape" || el.shapeType !== "circle" || el.width !== LEGEND.swatch || el.height !== LEGEND.swatch) continue;
    const tint = tintOf(el);
    if (!tint) continue;
    const label = elements.find((t): t is TextElement =>
      t.type === "text" && t.y === el.y && t.x === el.x + LEGEND.swatch + LEGEND.labelGap);
    if (label) out.push({ tint, meaning: label.content, swatchId: el.id, labelId: label.id });
  }
  return out;
}
