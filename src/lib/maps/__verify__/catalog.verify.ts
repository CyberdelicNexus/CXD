// Run: npx tsx src/lib/maps/__verify__/catalog.verify.ts
import { checkMapStructure, orderFlowSteps, CATALOG } from "../catalog";
import { MAP_TYPES } from "../types";
import type { MapGraph, MapType } from "../types";
import { VALID, clone, n, r } from "./fixtures";

let failures = 0;
const check = (name: string, cond: boolean) => {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
};
const violates = (g: Parameters<typeof checkMapStructure>[0], fragment: string) =>
  checkMapStructure(g).some((v) => v.includes(fragment));

// Every type has an entry and its minimal fixture is valid.
for (const t of MAP_TYPES) {
  check(`catalog has ${t}`, !!CATALOG[t]);
  const v = checkMapStructure(VALID[t]);
  check(`${t} fixture is valid${v.length ? ` (got: ${v.join("; ")})` : ""}`, v.length === 0);
}

// Global rules
{ const g = clone(VALID.radial); g.nodes[1].label = ""; check("empty label rejected", violates(g, "empty label")); }
{ const g = clone(VALID.radial); g.nodes[1].label = "x".repeat(61); check("label over 60 chars rejected", violates(g, "longer than")); }
{ const g = clone(VALID.radial); g.nodes[2].id = g.nodes[1].id; check("duplicate id rejected", violates(g, "duplicate id")); }
{ const g = clone(VALID.radial); g.nodes[1].role = "cause"; check("role invalid for type rejected", violates(g, "not valid for")); }
{ const g = clone(VALID.spider); g.nodes[1].parent = "ghost"; check("unknown parent rejected", violates(g, "unknown parent")); }
{ const g = clone(VALID.flow); g.relations.push(r("s1", "nope")); check("dangling relation rejected", violates(g, "unknown node")); }
{ const g = clone(VALID.radial); g.nodes[2].label = g.nodes[1].label; check("duplicate sibling label rejected", violates(g, "duplicate label")); }
{ const g = clone(VALID.radial); g.title = " "; check("empty title rejected", violates(g, "title")); }
{ const g = clone(VALID.conceptMap);
  for (let i = 0; i < 40; i++) g.nodes.push(n(`x${i}`, "concept"));
  check("more than 40 nodes rejected", violates(g, "at most 40")); }

// Per-type rules
{ const g = clone(VALID.radial); g.nodes = g.nodes.slice(0, 3); check("radial needs 3+ branches", violates(g, "branch")); }
{ const g = clone(VALID.bubble); g.nodes.push(n("c2", "center")); check("bubble needs exactly one center", violates(g, "center")); }
{ const g = clone(VALID.tree);
  g.nodes.push(n("d2", "leaf", "l1"), n("d3", "leaf", "d2"));
  check("tree depth over 3 rejected", violates(g, "depth")); }
{ const g = clone(VALID.tree);
  for (let i = 0; i < 8; i++) g.nodes.push(n(`k${i}`, "leaf", "b2"));
  check("tree over 7 children rejected", violates(g, "children")); }
{ const g = clone(VALID.doubleBubble); g.nodes = g.nodes.filter((x) => x.role !== "shared");
  check("doubleBubble needs a shared quality", violates(g, "shared")); }
{ const g = clone(VALID.multiFlow); g.nodes = g.nodes.filter((x) => x.role !== "cause");
  check("multiFlow needs a cause", violates(g, "cause")); }
{ const g = clone(VALID.brace); g.nodes = g.nodes.filter((x) => x.id !== "p2" );
  check("brace needs 2+ parts", violates(g, "part")); }
{ const g = clone(VALID.conceptMap); g.relations[0].label = ""; check("conceptMap relations need labels", violates(g, "label")); }
{ const g = clone(VALID.conceptMap); g.relations = [r("a", "b", "x")]; check("conceptMap must be connected", violates(g, "connected")); }
{ const g = clone(VALID.spider);
  for (let i = 0; i < 6; i++) g.nodes.push(n(`lf${i}`, "leaf", "b2"));
  check("spider over 5 leaves per branch rejected", violates(g, "leaves")); }

// Flow ordering
{ const o = orderFlowSteps(VALID.flow); check("flow path orders s1,s2,s3", !!o && o.order.join(",") === "s1,s2,s3" && o.backEdge === null); }
{ const g = clone(VALID.flow); g.relations.push(r("s3", "s1"));
  const o = orderFlowSteps(g); check("one loop-back is allowed and detected", !!o && o.order.join(",") === "s1,s2,s3" && o.backEdge?.from === "s3"); }
{ const g = clone(VALID.flow); g.nodes.push(n("s4", "step")); g.relations.push(r("s1", "s4"));
  check("branching flow rejected", orderFlowSteps(g) === null && violates(g, "single path")); }

// ── Adversarial review hardening (Task 3/4 follow-up) ───────────────

// C1: an empty node id must be rejected — "" is the no-parent sentinel, so an
// empty id would make the tree layout engine recurse forever.
{
  const g: MapGraph = { mapType: "tree", title: "T", relations: [],
    nodes: [n("r", "root"), n("", "branch", "r", "card", "{}", "B"), n("b2", "branch", "r")] };
  check("tree: empty node id rejected", violates(g, "empty id"));
}

// I1: roots must be roots — center/whole must not themselves have a parent —
// and per-branch/per-part child counts must only count the expected role.
{
  const g: MapGraph = { mapType: "spider", title: "Spider2", relations: [],
    nodes: [n("c", "center", "b1"), n("b1", "branch", "c"), n("b2", "branch", "c")] };
  check("spider: center parented to a branch rejected", violates(g, "center must not have a parent"));
}
{ const g = clone(VALID.radial); g.nodes[0].parent = "b1";
  check("radial: center with a parent rejected", violates(g, "center must not have a parent")); }
{ const g = clone(VALID.bubble); g.nodes[0].parent = "q1";
  check("bubble: center with a parent rejected", violates(g, "center must not have a parent")); }
{ const g = clone(VALID.brace); g.nodes[0].parent = "p1";
  check("brace: whole with a parent rejected", violates(g, "whole must not have a parent")); }

// I2: rule text must match what's actually enforced (parent may be "" or the hub/whole).
check("spider rule text is truthful about the empty-parent allowance",
  CATALOG.spider.rules.some((x) => x.includes("or empty")));
check("brace rule text is truthful about the empty-parent allowance",
  CATALOG.brace.rules.some((x) => x.includes("or empty")));

// I3: sibling duplicate-label grouping must match what users perceive as siblings.
{ const g = clone(VALID.tree);
  g.nodes.push(n("dup", "leaf", "root", "card", "{}", g.nodes.find((x) => x.id === "b1")!.label));
  check("tree: branch and leaf sharing a parent with the same label rejected", violates(g, "duplicate label")); }
{ const g = clone(VALID.doubleBubble);
  g.nodes.find((x) => x.id === "lt")!.label = "Cat";
  g.nodes.find((x) => x.id === "rt")!.label = "Cat";
  check("doubleBubble: leftTopic and rightTopic sharing a label rejected", violates(g, "duplicate label")); }
{ const g = clone(VALID.radial);
  g.nodes.find((x) => x.id === "b1")!.label = g.nodes.find((x) => x.id === "c")!.label;
  check("radial: center and branch sharing a label rejected", violates(g, "duplicate label")); }
{ const g = clone(VALID.multiFlow);
  g.nodes.find((x) => x.id === "c1")!.label = "Delay";
  g.nodes.find((x) => x.id === "f1")!.label = "Delay";
  check("multiFlow: cause and effect sharing a label stays valid", checkMapStructure(g).length === 0); }

// M1: duplicate relations must not break flow ordering.
{ const g = clone(VALID.flow); g.relations.push(r("s1", "s2"));
  const o = orderFlowSteps(g);
  check("duplicate relation does not break flow ordering", !!o && o.order.join(",") === "s1,s2,s3" && o.backEdge === null);
  check("duplicate relation flow is structurally valid", checkMapStructure(g).length === 0); }

// M2: an unrecognized mapType must produce a violation, never throw.
{ const g: MapGraph = { mapType: "toString" as unknown as MapType, title: "T", relations: [], nodes: [n("a", "concept")] };
  check("unrecognized mapType is rejected without throwing", violates(g, "unknown mapType")); }

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log("\nALL PASS");
