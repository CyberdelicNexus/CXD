// Run: npx tsx src/lib/maps/__verify__/pairings.verify.ts
// Each named pairing (spec §4.3) has a detector that fires on a graph showing
// it and stays silent on a near miss, so tags cannot lie.
import { EXEMPLARS } from "../exemplars";
import { libraryHash, pairingsOf } from "../exemplars/derive";
import { PAIRING_IDS, PAIRINGS, type PairingId } from "../exemplars/pairings";
import { exemplarProblems } from "../exemplars/validate";
import type { MapGraph } from "../types";
import { clone, n, r, VALID } from "./fixtures";

let failures = 0;
const check = (name: string, cond: boolean) => {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
};
const has = (g: MapGraph, id: PairingId) => pairingsOf(g).includes(id);
const pair = (id: PairingId, yes: MapGraph, no: MapGraph) => {
  check(`${id}: detected`, has(yes, id));
  check(`${id}: near miss not detected`, !has(no, id));
};

check("eleven pairings, one detector each", PAIRINGS.length === 11 && PAIRINGS.map((p) => p.id).join(",") === PAIRING_IDS.join(","));

{
  const yes: MapGraph = { mapType: "tree", title: "T", legend: [], relations: [], nodes: [
    n("r", "root"), n("z", "branch", "r", "zone"),
    n("t", "leaf", "z", "table", '{"cells":[["A","B"],["1","2"]]}'), n("c", "leaf", "z")] };
  const no = { ...yes, nodes: yes.nodes.filter((x) => x.id !== "c") };
  pair("zoneTableCards", yes, no);
}
{
  const yes: MapGraph = { mapType: "tree", title: "T", legend: [], nodes: [
    n("w", "root", "", "waypoint"), n("a", "branch", "w"), n("b", "branch", "w")],
    relations: [r("w", "a", "yes"), r("w", "b", "no")] };
  const no = { ...yes, relations: [r("w", "a", "yes"), r("w", "b", "")] };
  pair("waypointBranches", yes, no);
}
{
  const yes: MapGraph = { mapType: "flow", title: "T", legend: [], nodes: [
    n("f1", "step", "", "frame"), n("f2", "step", "", "frame"), n("t", "step", "", "task")],
    relations: [r("f1", "f2"), r("f2", "t")] };
  const no = { ...yes, nodes: [yes.nodes[0], yes.nodes[1], n("t", "step")] };
  pair("framesToTask", yes, no);
}
{
  const yes: MapGraph = { mapType: "tree", title: "T", legend: [], relations: [], nodes: [
    n("r", "root"), n("p", "branch", "r", "portal"), n("b", "branch", "r")] };
  const no: MapGraph = { ...yes, nodes: [n("r", "root", "", "portal"), n("p", "branch", "r"), n("b", "branch", "r")] };
  pair("treePortal", yes, no);
}
{
  const yes = clone(VALID.doubleBubble);
  yes.nodes.find((x) => x.id === "s1")!.tint = "rose";
  yes.nodes.find((x) => x.id === "lo1")!.tint = "emerald";
  yes.legend = [{ tint: "rose", meaning: "Risk" }, { tint: "emerald", meaning: "Opportunity" }];
  pair("doubleBubbleLegend", yes, clone(VALID.doubleBubble));
}
{
  const yes = clone(VALID.conceptMap);
  yes.relations[0].style = "dashed";
  yes.relations[1].direction = "both";
  const no = clone(VALID.conceptMap);
  no.relations[0].style = "dashed";
  pair("conceptMapDashedTwoWay", yes, no);
}
{
  const url = (u: string) => JSON.stringify({ url: u });
  const yes: MapGraph = { mapType: "conceptMap", title: "T", legend: [], nodes: [
    n("a", "concept"), n("b", "concept"),
    n("l1", "concept", "", "link", url("https://example.com/a")), n("l2", "concept", "", "link", url("https://example.com/b"))],
    relations: [r("l1", "a", "supports"), r("l2", "b", "supports"), r("a", "b", "leads to")] };
  const no = { ...yes, nodes: [yes.nodes[0], yes.nodes[1], yes.nodes[2], n("l2", "concept")] };
  pair("linksSupportIdeas", yes, no);
}
{
  const yes: MapGraph = { mapType: "tree", title: "T", legend: [], relations: [], nodes: [
    n("r", "root"), n("h1", "branch", "r", "heading"), n("a", "leaf", "h1"), n("h2", "branch", "r", "heading"), n("b", "leaf", "h2")] };
  const no = { ...yes, nodes: yes.nodes.map((x) => (x.id === "h2" ? { ...x, kind: "card" as const } : x)) };
  pair("headingsRegions", yes, no);
}
{
  const yes: MapGraph = { mapType: "flow", title: "T", legend: [], nodes: [n("s1", "step"), n("s2", "step"), n("s3", "step")],
    relations: [{ ...r("s1", "s2"), weight: "strong" }, { ...r("s2", "s3"), weight: "strong" }] };
  const no = { ...yes, relations: [{ ...r("s1", "s2"), weight: "strong" as const }, r("s2", "s3")] };
  pair("strongMainPath", yes, no);
}
{
  const yes: MapGraph = { mapType: "radial", title: "T", legend: [], relations: [], nodes: [
    n("c", "center", "", "shape", '{"shapeType":"star"}'), n("a", "branch"), n("b", "branch"), n("d", "branch")] };
  const no: MapGraph = { ...yes, nodes: [n("c", "center"), n("a", "branch", "", "shape", '{"shapeType":"star"}'), n("b", "branch"), n("d", "branch")] };
  pair("starGoal", yes, no);
}
{
  const anchor = (key: string) => JSON.stringify({ componentKey: key });
  const yes: MapGraph = { mapType: "tree", title: "T", legend: [], relations: [], nodes: [
    n("r", "root", "", "anchor", anchor("intentionCore")), n("a", "branch", "r", "anchor", anchor("desiredChange"))] };
  const no: MapGraph = { ...yes, nodes: [n("r", "root", "", "anchor", anchor("intentionCore")), n("a", "branch", "r", "anchor", anchor("intentionCore"))] };
  pair("twoAnchors", yes, no);
}

// The migrated exemplars load through the index with derived tags.
check(`index loads the first 3 exemplars (${EXEMPLARS.length})`, EXEMPLARS.length >= 3);
for (const ex of EXEMPLARS) {
  const problems = exemplarProblems(ex.graph);
  check(`${ex.id} passes the library checks${problems.length ? `: ${problems.join("; ")}` : ""}`, problems.length === 0);
  check(`${ex.id} tags are derived from its graph`, ex.tags.mapType === ex.graph.mapType && ex.tags.kinds.length > 0);
}
check("library hash is deterministic and order-free", libraryHash(EXEMPLARS) === libraryHash([...EXEMPLARS].reverse()));
check("library hash changes when a note changes",
  libraryHash(EXEMPLARS) !== libraryHash(EXEMPLARS.map((e, i) => (i === 0 ? { ...e, note: `${e.note}!` } : e))));

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log("\nALL PASS");
