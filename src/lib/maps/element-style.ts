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

/** Legend row geometry, all on the 20px grid: swatch, gap, label; rows wrap at max(title width, minRowW). */
export const LEGEND = {
  swatch: 20, labelGap: 20, entryGap: 20, rowH: 20, rowGap: 20, gapAboveRow: 20,
  charW: 8, labelMinW: 60, labelMaxW: 260, minRowW: 600,
} as const;

const rgba = (hex: string, a: number) =>
  `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;

/** Shape styling for a tinted node or a legend swatch. */
export function shapeTintStyle(tint: Tint): ElementStyle {
  return { bgColor: rgba(TINT_ACCENTS[tint], 0.22), borderColor: TINT_ACCENTS[tint], borderWidth: 2, textColor: "#ffffff" };
}

/** Width of a legend label: about 8px per character plus padding, on the grid, within [60, 260]. */
export function legendLabelWidth(meaning: string): number {
  const w = Math.ceil((meaning.trim().length * LEGEND.charW + 20) / 20) * 20;
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

export interface DrawnLegendEntry { tint: Tint; meaning: string; swatchId: string; labelId: string }

/** Legend entries as renderMap draws them: a 20px tinted circle and, 40px to its right on the same row, its label. */
export function readLegend(elements: CanvasElement[]): DrawnLegendEntry[] {
  const out: DrawnLegendEntry[] = [];
  for (const el of elements) {
    if (el.type !== "shape" || el.shapeType !== "circle" || el.width !== LEGEND.swatch || el.height !== LEGEND.swatch) continue;
    const tint = tintOf(el);
    if (!tint) continue;
    const label = elements.find((t): t is TextElement =>
      t.type === "text" && t.y === el.y && t.x === el.x + LEGEND.swatch + LEGEND.labelGap && t.height === LEGEND.rowH);
    if (label) out.push({ tint, meaning: label.content, swatchId: el.id, labelId: label.id });
  }
  return out;
}
