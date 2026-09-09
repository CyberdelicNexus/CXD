// Run: npx tsx src/lib/ai/__verify__/canvas-operations.verify.ts
import { sanitizeCanvasOperations, isActionableMessage } from "../canvas-operations";
import type { CanvasInventory } from "@/types/ai-operations";

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
}

const inventory: CanvasInventory = {
  totalCount: 3,
  truncated: false,
  selectedIds: ["e1", "e2"],
  elements: [
    { id: "e1", type: "freeform", title: "Card A", x: 100, y: 100, width: 300, height: 120 },
    { id: "e2", type: "freeform", title: "Card B", x: 100, y: 260, width: 300, height: 120 },
    { id: "e3", type: "container", title: "Section", x: 600, y: 80, width: 400, height: 400 },
  ],
};

// 1. Unknown target ids are dropped; known ones survive
const p1 = sanitizeCanvasOperations({
  reply: "ok",
  operations: [
    { op: "delete", summary: "Delete two cards", targetIds: ["e1", "ghost"], kind: null, ref: null, parentRef: null, label: null, content: null, tint: null, shapeType: null, hypercubeTags: null, x: null, y: null, width: null, height: null, newContent: null, newLabel: null, newX: null, newY: null, newWidth: null, newHeight: null, addTags: null, removeTags: null, groupTitle: null, fromRef: null, toRef: null, edgeLabel: null, taskTitle: null, taskDescription: null, taskPriority: null, taskDueDate: null },
  ],
}, inventory);
const del = p1.ops.find((o) => o.kind === "delete");
check("delete keeps only known ids", !!del && del.kind === "delete" && del.ids.length === 1 && del.ids[0] === "e1");
check("delete row flagged destructive", p1.rows.some((r) => r.kind === "delete" && r.destructive));

// 2. Create rows convert into real elements with fresh UUIDs
const p2 = sanitizeCanvasOperations({
  reply: "ok",
  operations: [
    { op: "create", summary: "Add a text card", kind: "text", ref: "t1", parentRef: null, label: null, content: "Hello", tint: null, shapeType: null, hypercubeTags: null, x: 50, y: 50, width: 300, height: 100, targetIds: null, newContent: null, newLabel: null, newX: null, newY: null, newWidth: null, newHeight: null, addTags: null, removeTags: null, groupTitle: null, fromRef: null, toRef: null, edgeLabel: null, taskTitle: null, taskDescription: null, taskPriority: null, taskDueDate: null },
  ],
}, inventory);
check("create converts to one element", p2.creates !== null && p2.creates.elements.length === 1);
check("created element got a real uuid", p2.creates!.elements[0].id.length > 20);

// 3. Tag ops keep only canonical face tags
const p3 = sanitizeCanvasOperations({
  reply: "ok",
  operations: [
    { op: "tag", summary: "Tag cards", targetIds: ["e1"], addTags: ["Sensory Domains"], removeTags: null, kind: null, ref: null, parentRef: null, label: null, content: null, tint: null, shapeType: null, hypercubeTags: null, x: null, y: null, width: null, height: null, newContent: null, newLabel: null, newX: null, newY: null, newWidth: null, newHeight: null, groupTitle: null, fromRef: null, toRef: null, edgeLabel: null, taskTitle: null, taskDescription: null, taskPriority: null, taskDueDate: null },
  ],
}, inventory);
const tag = p3.ops.find((o) => o.kind === "tag");
check("tag op survives with valid tag", !!tag && tag.kind === "tag" && tag.add.includes("Sensory Domains"));

// 4. Connect between two existing ids
const p4 = sanitizeCanvasOperations({
  reply: "ok",
  operations: [
    { op: "connect", summary: "Link A to B", fromRef: "e1", toRef: "e2", edgeLabel: "flows", kind: null, ref: null, parentRef: null, label: null, content: null, tint: null, shapeType: null, hypercubeTags: null, x: null, y: null, width: null, height: null, targetIds: null, newContent: null, newLabel: null, newX: null, newY: null, newWidth: null, newHeight: null, addTags: null, removeTags: null, groupTitle: null, taskTitle: null, taskDescription: null, taskPriority: null, taskDueDate: null },
  ],
}, inventory);
check("connect between existing ids survives", p4.ops.some((o) => o.kind === "connect" && o.fromId === "e1" && o.toId === "e2"));

// 5. Routing heuristic
check("imperative is actionable", isActionableMessage("add three stages for onboarding"));
check("question is not actionable", !isActionableMessage("What should I focus on next?"));
check("'can you add' is actionable", isActionableMessage("can you add a summary card"));
check("empty is not actionable", !isActionableMessage(""));

// ── Negative / hardening coverage (review round 2) ──────────────────

// 6a. Long edgeLabel on an existing-id connect is capped to 40 chars
const p6a = sanitizeCanvasOperations({
  reply: "ok",
  operations: [
    { op: "connect", summary: "Link A to B", fromRef: "e1", toRef: "e2", edgeLabel: "x".repeat(5000), kind: null, ref: null, parentRef: null, label: null, content: null, tint: null, shapeType: null, hypercubeTags: null, x: null, y: null, width: null, height: null, targetIds: null, newContent: null, newLabel: null, newX: null, newY: null, newWidth: null, newHeight: null, addTags: null, removeTags: null, groupTitle: null, taskTitle: null, taskDescription: null, taskPriority: null, taskDueDate: null },
  ],
}, inventory);
const connect6a = p6a.ops.find((o) => o.kind === "connect");
check("long edgeLabel on existing-id connect is capped to <=40 chars", !!connect6a && connect6a.kind === "connect" && (connect6a.label?.length ?? 0) <= 40);

// 6b. Multi-target update applies to ALL known ids under ONE rowId, summary suffixed
const p6b = sanitizeCanvasOperations({
  reply: "ok",
  operations: [
    { op: "update", summary: "Rename cards", targetIds: ["e1", "e2"], newContent: "Updated", kind: null, ref: null, parentRef: null, label: null, content: null, tint: null, shapeType: null, hypercubeTags: null, x: null, y: null, width: null, height: null, newLabel: null, newX: null, newY: null, newWidth: null, newHeight: null, addTags: null, removeTags: null, groupTitle: null, fromRef: null, toRef: null, edgeLabel: null, taskTitle: null, taskDescription: null, taskPriority: null, taskDueDate: null },
  ],
}, inventory);
const updateOps6b = p6b.ops.filter((o) => o.kind === "update");
const updateRow6b = p6b.rows.find((r) => r.kind === "update");
check("multi-target update produces TWO ops sharing one rowId", updateOps6b.length === 2 && updateOps6b[0].rowId === updateOps6b[1].rowId);
check("multi-target update row summary suffixed with element count", !!updateRow6b && updateRow6b.summary.endsWith("(2 elements)"));

// 6c. Create row whose ref collides with an inventory id is dropped; droppedCount reflects it
const p6c = sanitizeCanvasOperations({
  reply: "ok",
  operations: [
    { op: "create", summary: "Sneaky create", kind: "text", ref: "e1", parentRef: null, label: null, content: "Hi", tint: null, shapeType: null, hypercubeTags: null, x: 10, y: 10, width: 200, height: 80, targetIds: null, newContent: null, newLabel: null, newX: null, newY: null, newWidth: null, newHeight: null, addTags: null, removeTags: null, groupTitle: null, fromRef: null, toRef: null, edgeLabel: null, taskTitle: null, taskDescription: null, taskPriority: null, taskDueDate: null },
  ],
}, inventory);
check("create row with ref colliding with inventory id is dropped", p6c.creates === null);
check("droppedCount reflects the collided create row", p6c.droppedCount === 1);

// 6d. Invalid taskDueDate is dropped from metadata while the task itself survives
const p6d = sanitizeCanvasOperations({
  reply: "ok",
  operations: [
    { op: "task", summary: "Add a task", taskTitle: "Follow up", taskDescription: null, taskPriority: null, taskDueDate: "next tuesday-ish", kind: null, ref: null, parentRef: null, label: null, content: null, tint: null, shapeType: null, hypercubeTags: null, x: null, y: null, width: null, height: null, targetIds: null, newContent: null, newLabel: null, newX: null, newY: null, newWidth: null, newHeight: null, addTags: null, removeTags: null, groupTitle: null, fromRef: null, toRef: null, edgeLabel: null },
  ],
}, inventory);
const taskOp6d = p6d.ops.find((o) => o.kind === "task");
check("task survives despite malformed taskDueDate", !!taskOp6d && taskOp6d.kind === "task" && taskOp6d.task.title === "Follow up");
check("malformed taskDueDate is dropped from metadata", !!taskOp6d && taskOp6d.kind === "task" && taskOp6d.task.metadata?.dueDate === undefined);

// 6e. Polite "could you ..." imperative is actionable; plain questions still are not
check("'could you delete' is actionable", isActionableMessage("could you delete the empty cards"));
check("'What should I focus on next?' remains not actionable", !isActionableMessage("What should I focus on next?"));

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log("\nALL PASS");
