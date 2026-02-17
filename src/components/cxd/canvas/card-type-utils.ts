import type { FreeformElement } from "@/types/canvas-elements";

export type CanvasCardType = "note" | "task";

export function getFreeformCardType(element: FreeformElement): CanvasCardType {
  if (element.cardType) {
    return element.cardType;
  }

  if (element.taskMetadata?.isActionable || element.taskMetadata) {
    return "task";
  }

  return "note";
}

export function isNoteCard(element: FreeformElement): boolean {
  return getFreeformCardType(element) === "note";
}

export function isTaskCard(element: FreeformElement): boolean {
  return getFreeformCardType(element) === "task";
}

export function canResizeFreeformCard(element: FreeformElement): boolean {
  if (element.cardType !== "note" && getFreeformCardType(element) !== "note") {
    return false;
  }
  return true;
}

export function sanitizeFreeformResizeUpdate(
  element: FreeformElement,
  updates: Partial<FreeformElement>,
): Partial<FreeformElement> {
  if (!canResizeFreeformCard(element)) {
    const { width, height, ...rest } = updates;
    return rest;
  }
  return updates;
}
