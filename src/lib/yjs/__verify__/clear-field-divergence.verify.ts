// Run: npx tsx src/lib/yjs/__verify__/clear-field-divergence.verify.ts
//
// Guards the Zustand/Y.Doc divergence class: a patch that CLEARS a field
// (containerId orphan-healing) applies to a Zustand object spread but is
// skipped by applyElementUpdates, which ignores undefined values. If the two
// paths disagree, the stale value wins on reload — the July 2026 failure mode.

import * as Y from "yjs";
import { canvasElementToYMap, applyElementUpdates, splitPatchForYDoc } from "../element-serializers";
import type { CanvasElement } from "@/types/canvas-elements";

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
}

const child = {
  id: "child", type: "text", x: 640, y: 160, width: 200, height: 80, zIndex: 1,
  content: "C", locked: false, boardId: null, surface: "canvas", style: {},
  containerId: "cont",
} as unknown as CanvasElement;

const patch = { containerId: undefined, x: 700 } as Partial<CanvasElement>;

// 1. The split classifies cleared vs written fields.
const { defined, cleared } = splitPatchForYDoc(patch);
check("cleared field detected", cleared.includes("containerId"));
check("defined field retained", (defined as { x?: number }).x === 700);
check("cleared field absent from defined", !("containerId" in defined));

// 2. The naive path (what the bug did): applyElementUpdates alone LEAVES the
//    stale containerId behind. This asserts the hazard still exists, so the
//    guard below is meaningful rather than testing a no-op.
{
  const doc = new Y.Doc();
  const yElements = doc.getMap("elements");
  yElements.set("child", canvasElementToYMap(child));
  const yEl = yElements.get("child") as Y.Map<unknown>;
  applyElementUpdates(yEl, patch);
  check("naive applyElementUpdates leaves a dangling containerId (hazard exists)",
    yEl.get("containerId") === "cont");
}

// 3. The store's path: split, then delete cleared keys explicitly.
{
  const doc = new Y.Doc();
  const yElements = doc.getMap("elements");
  yElements.set("child", canvasElementToYMap(child));
  const yEl = yElements.get("child") as Y.Map<unknown>;

  applyElementUpdates(yEl, defined);
  cleared.forEach((field) => yEl.delete(field));

  check("containerId is gone from the Y.Map", !yEl.has("containerId"));
  check("other patched fields still applied", yEl.get("x") === 700);
  check("untouched fields preserved", yEl.get("height") === 80);
}

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log("\nALL PASS");
