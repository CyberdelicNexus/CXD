// Run: npx tsx src/lib/ai/__verify__/edge-bend.verify.ts
import { generatedToCanvas, type GeneratedElement } from "../element-generation";
import { translateForApply } from "../canvas-operations-executor";
import type { CanvasElement } from "@/types/canvas-elements";
import type { SanitizedProposal } from "@/types/ai-operations";

let failures = 0;
const check = (name: string, cond: boolean) => {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
};

const text = (ref: string, x: number, y: number): GeneratedElement => ({
  kind: "text", ref, parentRef: null, label: null, content: ref, tint: null, shapeType: null,
  hypercubeTags: null, x, y, width: 280, height: 60, props: null,
});

// Two elements far from the origin, connected with a requested bend of 40.
const out = generatedToCanvas(
  [text("a", 1000, 1000), text("b", 1600, 1000)],
  [{ from: "a", to: "b", label: null, props: JSON.stringify({ bend: 40 }) }],
);
const edge = out.edges[0];
const midX = (1000 + 140 + 1600 + 140) / 2;
const midY = 1000 + 30;
check("bent edge has a control point", !!edge?.bend);
check("control point sits near the edge, not the canvas origin", !!edge?.bend && edge.bend.x > 900);
check("control point is 40px off the midpoint", !!edge?.bend && Math.abs(Math.hypot(edge.bend.x - midX, edge.bend.y - midY) - 40) < 0.5);

const straight = generatedToCanvas([text("a", 0, 0), text("b", 600, 0)], [{ from: "a", to: "b", label: null, props: null }]);
check("unbent edge has no control point", !!straight.edges[0] && straight.edges[0].bend === undefined);

// When an applied batch is slid clear of existing work, its internal bends move with it.
const live: CanvasElement[] = [
  { id: "live", type: "text", x: 1000, y: 1000, width: 900, height: 400, zIndex: 1, content: "x", locked: false, boardId: null, surface: "canvas", style: {} } as CanvasElement,
];
const proposal: SanitizedProposal = {
  reply: "", droppedCount: 0,
  rows: [{ rowId: "c", kind: "create", summary: "Create", destructive: false }],
  creates: { rowId: "c", elements: out.elements, edges: out.edges },
  ops: [],
};
const originalBend = { ...edge.bend! };
const plan = translateForApply(proposal, new Set(["c"]), live, []);
const movedA = plan.batch.addElements.find((e) => e.id === out.elements[0].id)!;
const dx = movedA.x - out.elements[0].x;
const dy = movedA.y - out.elements[0].y;
check("batch was relocated (collided with live work)", dx !== 0);
const movedEdge = plan.batch.addEdges[0];
check("relocated edge bend moved by the same delta",
  !!movedEdge.bend && movedEdge.bend.x - originalBend.x === dx && movedEdge.bend.y - originalBend.y === dy);
check("proposal edge was not mutated", out.edges[0].bend?.x === originalBend.x && out.edges[0].bend?.y === originalBend.y);

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log("\nALL PASS");
