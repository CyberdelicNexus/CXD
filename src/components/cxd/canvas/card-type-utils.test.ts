import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { FreeformElement } from "@/types/canvas-elements";
import {
  canResizeFreeformCard,
  getFreeformCardType,
  sanitizeFreeformResizeUpdate,
} from "@/components/cxd/canvas/card-type-utils";

function baseFreeform(partial: Partial<FreeformElement>): FreeformElement {
  return {
    id: "card-1",
    type: "freeform",
    x: 0,
    y: 0,
    width: 300,
    height: 180,
    zIndex: 1,
    content: "",
    ...partial,
  };
}

describe("card type guards", () => {
  it("returns task type for actionable cards", () => {
    const task = baseFreeform({
      taskMetadata: { isActionable: true },
    });
    assert.equal(getFreeformCardType(task), "task");
  });

  it("returns note type for plain note cards", () => {
    const note = baseFreeform({ cardType: "note" });
    assert.equal(getFreeformCardType(note), "note");
  });

  it("prevents resize updates for task cards", () => {
    const task = baseFreeform({
      cardType: "task",
      taskMetadata: { isActionable: true },
    });
    assert.equal(canResizeFreeformCard(task), false);
    assert.deepEqual(
      sanitizeFreeformResizeUpdate(task, { width: 900, height: 600, x: 40 }),
      { x: 40 },
    );
  });

  it("keeps resize updates for note cards", () => {
    const note = baseFreeform({ cardType: "note" });
    assert.equal(canResizeFreeformCard(note), true);
    assert.deepEqual(
      sanitizeFreeformResizeUpdate(note, { width: 420, height: 220 }),
      { width: 420, height: 220 },
    );
  });
});

