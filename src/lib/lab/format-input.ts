// Turns a lab input into prompt text, and its loose cards into the canvas state
// the baseline arm sees (it edits a canvas; graph arms produce a new map).
import type { CanvasElement } from "@/types/canvas-elements";
import type { CanvasInventory } from "@/types/ai-operations";
import type { LabCard, LabInput } from "./types";

export function formatInput(input: LabInput): string {
  const parts = [`Title: ${input.title}`, input.text.trim()];
  if (input.cards.length > 0) {
    parts.push("Existing canvas cards:\n" + input.cards.map((c, i) => `${i + 1}. ${c.title}${c.body ? ` — ${c.body}` : ""}`).join("\n"));
  }
  return parts.filter(Boolean).join("\n\n");
}

const CARD_W = 260;
const CARD_H = 300;
const CARD_STEP = 300;

export function cardsAsElements(cards: LabCard[]): CanvasElement[] {
  return cards.map((c, i) => ({
    id: `card-${i}`, type: "freeform", x: i * CARD_STEP, y: 0, width: CARD_W, height: CARD_H,
    zIndex: 1, locked: false, boardId: null, surface: "canvas",
    cardType: "note", content: "", noteTitle: c.title, noteBody: c.body, style: {},
  }) as CanvasElement);
}

export function cardsAsInventory(cards: LabCard[]): CanvasInventory {
  return {
    totalCount: cards.length,
    truncated: false,
    selectedIds: [],
    elements: cards.map((c, i) => ({
      id: `card-${i}`, type: "freeform", title: c.title, x: i * CARD_STEP, y: 0, width: CARD_W, height: CARD_H,
    })),
  };
}
