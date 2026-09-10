// Run: npx tsx src/lib/ai/__verify__/canvas-operations-executor.verify.ts
import { translateForApply } from "../canvas-operations-executor";
import type { SanitizedProposal } from "@/types/ai-operations";
import type { CanvasElement, CanvasEdge } from "@/types/canvas-elements";

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
}

const live: CanvasElement[] = [
  { id: "e1", type: "text", x: 100, y: 100, width: 300, height: 100, zIndex: 1, content: "A", locked: false, boardId: null, surface: "canvas", style: {} } as CanvasElement,
  { id: "e2", type: "text", x: 100, y: 260, width: 300, height: 100, zIndex: 1, content: "B", locked: false, boardId: null, surface: "canvas", style: {}, hypercubeTags: ["Presence Types"] } as CanvasElement,
  { id: "cont", type: "container", x: 600, y: 80, width: 400, height: 400, zIndex: 0, label: "Sec", locked: false, boardId: null, surface: "canvas", style: {} } as CanvasElement,
  { id: "child", type: "text", x: 640, y: 160, width: 200, height: 80, zIndex: 1, content: "C", locked: false, boardId: null, surface: "canvas", style: {}, containerId: "cont" } as CanvasElement,
];
const liveEdges: CanvasEdge[] = [
  { id: "edge1", fromNodeId: "e1", toNodeId: "cont", fromAnchor: "right", toAnchor: "left", fromAutoAnchor: true, toAutoAnchor: true, fromAnchorOffset: 0.5, toAnchorOffset: 0.5, boardId: null, surface: "canvas", style: { thickness: 2, lineStyle: "solid", gradientName: "violet", arrowStyle: "end" } } as CanvasEdge,
];

const proposal: SanitizedProposal = {
  reply: "ok",
  droppedCount: 0,
  rows: [
    { rowId: "row-1", kind: "delete", summary: "Delete container", destructive: true },
    { rowId: "row-2", kind: "tag", summary: "Tag e2", destructive: false },
    { rowId: "row-3", kind: "group", summary: "Group e1+e2", destructive: false },
    { rowId: "row-4", kind: "update", summary: "Rename ghost", destructive: false },
  ],
  creates: null,
  ops: [
    { rowId: "row-1", kind: "delete", ids: ["cont"] },
    { rowId: "row-2", kind: "tag", ids: ["e2"], add: ["Sensory Domains"], remove: ["Presence Types"] },
    { rowId: "row-3", kind: "group", ids: ["e1", "e2"], title: "Pair" },
    { rowId: "row-4", kind: "update", id: "ghost", patch: { content: "x" } },
  ],
};

const all = new Set(["row-1", "row-2", "row-3", "row-4"]);
const r = translateForApply(proposal, all, live, liveEdges);

check("deleting container orphan-heals child containerId",
  r.batch.updates.some(u => u.id === "child" && "containerId" in u.updates && (u.updates as { containerId?: string }).containerId === undefined));
check("dangling edge removed with its element", r.batch.removeEdgeIds.includes("edge1"));
check("tag merge respects live tags",
  r.batch.updates.some(u => u.id === "e2" && JSON.stringify((u.updates as { hypercubeTags?: string[] }).hypercubeTags) === JSON.stringify(["Sensory Domains"])));
check("group creates container + reparents members",
  r.batch.addElements.length === 1 && r.batch.updates.filter(u => ["e1", "e2"].includes(u.id)).length === 2);
check("group repositions its members into the cluster",
  r.batch.updates.filter(u => ["e1", "e2"].includes(u.id) && "x" in u.updates && "y" in u.updates).length === 2);
check("grouped members end up inside the container", (() => {
  const c = r.batch.addElements[0];
  return ["e1", "e2"].every((id) => {
    const pos = r.batch.updates.find(u => u.id === id)!.updates as { x: number; y: number };
    const src = live.find(e => e.id === id)!;
    return pos.x >= c.x && pos.y >= c.y
      && pos.x + src.width <= c.x + c.width
      && pos.y + src.height <= c.y + c.height;
  });
})());

// Gather-then-wrap exists so an unrelated element sitting between far-apart
// members is NOT swallowed by the new zone — the failure the layout eval found.
{
  const mk = (id: string, x: number, y: number): CanvasElement =>
    ({ id, type: "text", x, y, width: 300, height: 100, zIndex: 1, content: id, locked: false, boardId: null, surface: "canvas", style: {} }) as CanvasElement;
  const spread = [mk("m1", 0, 0), mk("bystander", 400, 400), mk("m2", 900, 900)];
  const gp: SanitizedProposal = {
    reply: "", droppedCount: 0,
    rows: [{ rowId: "g", kind: "group", summary: "Group far-apart", destructive: false }],
    creates: null,
    ops: [{ rowId: "g", kind: "group", ids: ["m1", "m2"], title: "Far" }],
  };
  const gr = translateForApply(gp, new Set(["g"]), spread, []);
  const c = gr.batch.addElements[0];
  const by = spread[1];
  const enclosed = by.x >= c.x && by.y >= c.y
    && by.x + by.width <= c.x + c.width && by.y + by.height <= c.y + c.height;
  check("bystander between far-apart members is not enclosed", !enclosed);
  check("far-apart members are gathered, not wrapped in place",
    gr.batch.updates.filter(u => ["m1", "m2"].includes(u.id)).length === 2);
}
check("stale id op is skipped, not applied",
  r.skippedRowIds.includes("row-4") && !r.batch.updates.some(u => u.id === "ghost"));

// Unchecked rows are excluded entirely
const only2 = translateForApply(proposal, new Set(["row-2"]), live, liveEdges);
check("unchecked rows excluded",
  only2.batch.removeElementIds.length === 0 && only2.batch.addElements.length === 0 && only2.batch.updates.length === 1);

// A delete must win over an update queued for the same element in the same batch.
const conflict: SanitizedProposal = {
  reply: "", droppedCount: 0,
  rows: [
    { rowId: "r1", kind: "update", summary: "Edit e1", destructive: false },
    { rowId: "r2", kind: "delete", summary: "Delete e1", destructive: true },
  ],
  creates: null,
  ops: [
    { rowId: "r1", kind: "update", id: "e1", patch: { content: "changed" } },
    { rowId: "r2", kind: "delete", ids: ["e1"] },
  ],
};
const c = translateForApply(conflict, new Set(["r1", "r2"]), live, liveEdges);
check("delete wins over same-batch update",
  c.batch.removeElementIds.includes("e1") && !c.batch.updates.some(u => u.id === "e1"));

// Creates ride along only when their row is checked.
const withCreates: SanitizedProposal = {
  reply: "", droppedCount: 0,
  rows: [{ rowId: "cr", kind: "create", summary: "Create 1", destructive: false }],
  creates: { rowId: "cr", elements: [live[0]], edges: [] },
  ops: [],
};
check("creates included when checked", translateForApply(withCreates, new Set(["cr"]), live, liveEdges).batch.addElements.length === 1);
check("creates excluded when unchecked", translateForApply(withCreates, new Set<string>(), live, liveEdges).batch.addElements.length === 0);

// Connect referencing a vanished element is skipped, not emitted.
const badConnect: SanitizedProposal = {
  reply: "", droppedCount: 0,
  rows: [{ rowId: "cn", kind: "connect", summary: "Link", destructive: false }],
  creates: null,
  ops: [{ rowId: "cn", kind: "connect", fromId: "e1", toId: "ghost" }],
};
const bc = translateForApply(badConnect, new Set(["cn"]), live, liveEdges);
check("connect to missing element skipped", bc.batch.addEdges.length === 0 && bc.skippedRowIds.includes("cn"));

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log("\nALL PASS");
