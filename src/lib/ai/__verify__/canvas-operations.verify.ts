// Run: npx tsx src/lib/ai/__verify__/canvas-operations.verify.ts
//
// Schema fields are OPTIONAL (Anthropic caps union-typed params at 16, so
// `.nullable()` everywhere failed the whole request) — rows below therefore
// list only the fields an op actually uses.
import { sanitizeCanvasOperations, isActionableMessage, canvasOperationsSchema } from "../canvas-operations";
import { generateElementsSchema } from "../element-generation";
import type { CanvasInventory } from "@/types/ai-operations";
import type { z } from "zod";

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
}

type Raw = z.infer<typeof canvasOperationsSchema>;
type Row = Raw["operations"][number];

// Every schema field is required (Anthropic grammar-complexity constraint), so
// fill the sentinels here and let each test state only what it exercises.
const row = (partial: Partial<Row> & Pick<Row, "op" | "summary">): Row => ({
  kind: "none",
  ref: "",
  parentRef: "",
  targetIds: [],
  label: "",
  content: "",
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  fromRef: "",
  toRef: "",
  props: "{}",
  ...partial,
});

const run = (operations: Array<Partial<Row> & Pick<Row, "op" | "summary">>, inv: CanvasInventory) =>
  sanitizeCanvasOperations({ reply: "ok", operations: operations.map(row) }, inv);

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
const p1 = run([{ op: "delete", summary: "Delete two cards", targetIds: ["e1", "ghost"] }], inventory);
const del = p1.ops.find((o) => o.kind === "delete");
check("delete keeps only known ids", !!del && del.kind === "delete" && del.ids.length === 1 && del.ids[0] === "e1");
check("delete row flagged destructive", p1.rows.some((r) => r.kind === "delete" && r.destructive));

// 2. Create rows convert into real elements with fresh UUIDs
const p2 = run([{ op: "create", summary: "Add a text card", kind: "text", ref: "t1", content: "Hello", x: 50, y: 50, width: 300, height: 100 }], inventory);
check("create converts to one element", p2.creates !== null && p2.creates.elements.length === 1);
check("created element got a real uuid", p2.creates!.elements[0].id.length > 20);

// 3. Tag ops keep only canonical face tags (now carried in the props bag)
const p3 = run([{ op: "tag", summary: "Tag cards", targetIds: ["e1"], props: JSON.stringify({ addTags: ["Sensory Domains", "Not A Real Face"] }) }], inventory);
const tag = p3.ops.find((o) => o.kind === "tag");
check("tag op survives with valid tag", !!tag && tag.kind === "tag" && tag.add.includes("Sensory Domains"));
check("bogus face tag is filtered out", !!tag && tag.kind === "tag" && tag.add.length === 1);

// 4. Connect between two existing ids (label doubles as the edge label)
const p4 = run([{ op: "connect", summary: "Link A to B", fromRef: "e1", toRef: "e2", label: "flows" }], inventory);
check("connect between existing ids survives", p4.ops.some((o) => o.kind === "connect" && o.fromId === "e1" && o.toId === "e2"));

// 5. Routing heuristic
check("imperative is actionable", isActionableMessage("add three stages for onboarding"));
check("question is not actionable", !isActionableMessage("What should I focus on next?"));
check("'can you add' is actionable", isActionableMessage("can you add a summary card"));
check("empty is not actionable", !isActionableMessage(""));

// ── Negative / hardening coverage ───────────────────────────────────

// 6a. Long edge label on an existing-id connect is capped to 40 chars
const p6a = run([{ op: "connect", summary: "Link A to B", fromRef: "e1", toRef: "e2", label: "x".repeat(5000) }], inventory);
const connect6a = p6a.ops.find((o) => o.kind === "connect");
check("long edge label on existing-id connect is capped to <=40 chars", !!connect6a && connect6a.kind === "connect" && (connect6a.label?.length ?? 0) <= 40);

// 6b. Multi-target update applies to ALL known ids under ONE rowId, summary suffixed
const p6b = run([{ op: "update", summary: "Rename cards", targetIds: ["e1", "e2"], content: "Updated" }], inventory);
// 6b-2. Update geometry travels in props; an omitted key leaves the field alone
const p6b2 = run([{ op: "update", summary: "Move card", targetIds: ["e1"], props: JSON.stringify({ x: 0, width: 500 }) }], inventory);
const upd6b2 = p6b2.ops.find((o) => o.kind === "update");
check("update geometry from props applies x=0 explicitly", !!upd6b2 && upd6b2.kind === "update" && upd6b2.patch.x === 0);
check("omitted geometry key leaves the field untouched", !!upd6b2 && upd6b2.kind === "update" && upd6b2.patch.y === undefined && upd6b2.patch.width === 500);
const updateOps6b = p6b.ops.filter((o) => o.kind === "update");
const updateRow6b = p6b.rows.find((r) => r.kind === "update");
check("multi-target update produces TWO ops sharing one rowId", updateOps6b.length === 2 && updateOps6b[0].rowId === updateOps6b[1].rowId);
check("multi-target update row summary suffixed with element count", !!updateRow6b && updateRow6b.summary.endsWith("(2 elements)"));

// 6c. Create row whose ref collides with an inventory id is dropped
const p6c = run([{ op: "create", summary: "Sneaky create", kind: "text", ref: "e1", content: "Hi", x: 10, y: 10, width: 200, height: 80 }], inventory);
check("create row with ref colliding with inventory id is dropped", p6c.creates === null);
check("droppedCount reflects the collided create row", p6c.droppedCount === 1);

// 6d. Invalid dueDate is dropped from metadata while the task itself survives
const p6d = run([{ op: "task", summary: "Add a task", label: "Follow up", props: JSON.stringify({ dueDate: "next tuesday-ish", priority: "high" }) }], inventory);
const taskOp6d = p6d.ops.find((o) => o.kind === "task");
check("task survives despite malformed dueDate", !!taskOp6d && taskOp6d.kind === "task" && taskOp6d.task.title === "Follow up");
check("malformed dueDate is dropped from metadata", !!taskOp6d && taskOp6d.kind === "task" && taskOp6d.task.metadata?.dueDate === undefined);
check("valid priority from props survives", !!taskOp6d && taskOp6d.kind === "task" && taskOp6d.task.metadata?.priority === "high");

// ── New element kinds + props bag ───────────────────────────────────

// 7a. A freeform note card is created with its emoji/title/body from props
const p7a = run([{
  op: "create", summary: "Add a note card", kind: "freeform", ref: "n1",
  x: 100, y: 900, width: 300, height: 300,
  props: JSON.stringify({ emoji: "💡", noteTitle: "Antivision", noteBody: "What this must never become", cardType: "note" }),
}], inventory);
const note7a = p7a.creates?.elements[0] as { type?: string; emoji?: string; noteTitle?: string; noteBody?: string; cardType?: string } | undefined;
check("freeform note card is created", note7a?.type === "freeform" && note7a?.cardType === "note");
check("freeform carries emoji + title + body from props", note7a?.emoji === "💡" && note7a?.noteTitle === "Antivision" && !!note7a?.noteBody);

// 7b. Malformed props JSON must not cost us the element
const p7b = run([{ op: "create", summary: "Add card", kind: "freeform", ref: "n2", x: 0, y: 0, width: 300, height: 300, props: "{not valid json" }], inventory);
check("malformed props JSON still yields the element", p7b.creates !== null && p7b.creates.elements.length === 1);

// 7c. image + line kinds
const p7c = run([
  { op: "create", summary: "Storyboard frame", kind: "image", ref: "i1", x: 0, y: 0, width: 320, height: 260, props: JSON.stringify({ storyboard: true, description: "Opening shot" }) },
  { op: "create", summary: "Divider", kind: "line", ref: "l1", x: 0, y: 400, width: 300, height: 2, props: JSON.stringify({ gradientName: "violet", widthPx: 2 }) },
], inventory);
const kinds7c = (p7c.creates?.elements || []).map((e) => e.type);
check("image and line kinds are supported", kinds7c.includes("image") && kinds7c.includes("line"));
const line7c = p7c.creates?.elements.find((e) => e.type === "line") as { start?: { x: number }; end?: { x: number } } | undefined;
check("line spans x..x+width", line7c?.start?.x === 0 && line7c?.end?.x === 300);

// 7c-2. A connect between a NEW ref and an EXISTING id resolves after conversion
const p7c2 = run([
  { op: "create", summary: "New zone", kind: "container", ref: "c9", label: "Peak Moment", x: 1200, y: 0, width: 400, height: 300 },
  { op: "connect", summary: "Link new zone to existing card", fromRef: "c9", toRef: "e1" },
], inventory);
check("mixed new-ref -> existing-id connect produces an edge", (p7c2.creates?.edges.length ?? 0) === 1);
const mixedEdge = p7c2.creates?.edges[0];
check("mixed connect points at the real existing id", mixedEdge?.toNodeId === "e1" && !!mixedEdge?.fromNodeId && mixedEdge.fromNodeId !== "c9");

// 7d. Presentation edits flow through update via props
const p7d = run([{ op: "update", summary: "Restyle", targetIds: ["e1"], props: JSON.stringify({ emoji: "🔥", noteTitle: "Renamed" }) }], inventory);
const upd7d = p7d.ops.find((o) => o.kind === "update");
check("update can change emoji + noteTitle via props", !!upd7d && upd7d.kind === "update" && upd7d.patch.emoji === "🔥" && upd7d.patch.noteTitle === "Renamed");

// 6e. Polite "could you ..." imperative is actionable; plain questions still are not
check("'could you delete' is actionable", isActionableMessage("could you delete the empty cards"));
check("'What should I focus on next?' remains not actionable", !isActionableMessage("What should I focus on next?"));

// ── Provider-compatibility guards ───────────────────────────────────
// Anthropic's structured output rejects minItems/maxItems on arrays and caps
// union-typed (anyOf) parameters at 16. Both limits silently broke EVERY
// generateObject feature for Claude users, so assert the JSON Schema directly
// rather than trusting that nobody re-adds .max()/.nullable() later.

type JsonSchemaNode = { type?: string; anyOf?: unknown[]; oneOf?: unknown[]; properties?: Record<string, JsonSchemaNode>; required?: string[]; items?: JsonSchemaNode; maxItems?: number; minItems?: number };

function walk(node: JsonSchemaNode | undefined, visit: (n: JsonSchemaNode) => void) {
  if (!node || typeof node !== "object") return;
  visit(node);
  if (node.properties) for (const child of Object.values(node.properties)) walk(child, visit);
  if (node.items) walk(node.items, visit);
  for (const key of ["anyOf", "oneOf"] as const) {
    for (const child of node[key] || []) walk(child as JsonSchemaNode, visit);
  }
}

// zod v4 exposes toJSONSchema; fall back to skipping if unavailable.
const toJson = (schema: unknown): JsonSchemaNode | null => {
  const z4 = require("zod") as { toJSONSchema?: (s: unknown, o?: unknown) => JsonSchemaNode };
  if (typeof z4.toJSONSchema !== "function") return null;
  try { return z4.toJSONSchema(schema, { io: "input" }); } catch { return null; }
};

for (const [name, schema] of [["canvasOperations", canvasOperationsSchema], ["generateElements", generateElementsSchema]] as const) {
  const json = toJson(schema);
  if (!json) { console.log(`  SKIP ${name} JSON Schema guards (zod.toJSONSchema unavailable)`); continue; }
  let arrayBounds = 0;
  let unions = 0;
  let optionals = 0;
  walk(json, (n) => {
    if (n.maxItems !== undefined || n.minItems !== undefined) arrayBounds++;
    if (Array.isArray(n.anyOf) || Array.isArray(n.oneOf)) unions++;
    if (n.properties) {
      const required = new Set(n.required || []);
      optionals += Object.keys(n.properties).filter((k) => !required.has(k)).length;
    }
  });
  check(`${name}: no minItems/maxItems (Anthropic rejects them)`, arrayBounds === 0);
  check(`${name}: union-typed params within Anthropic's limit of 16 (found ${unions})`, unions <= 16);
  check(`${name}: optional params within Anthropic's limit of 24 (found ${optionals})`, optionals <= 24);
}

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log("\nALL PASS");
