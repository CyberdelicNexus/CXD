import type { MapGraph, MapNode, MapRelation, MapRole, MapType, NodeKind } from "../types";

export const n = (
  id: string, role: MapRole, parent = "", kind: NodeKind = "card", props = "{}", label = id,
): MapNode => ({ id, label, detail: "", role, kind, parent, props, tint: "", emphasis: "normal" });

export const r = (from: string, to: string, label = ""): MapRelation =>
  ({ from, to, label, style: "solid", weight: "normal", direction: "forward" });

/** One minimal valid graph per map type. */
export const VALID: Record<MapType, MapGraph> = {
  radial: { mapType: "radial", title: "Radial", legend: [], relations: [],
    nodes: [n("c", "center"), n("b1", "branch"), n("b2", "branch"), n("b3", "branch")] },
  spider: { mapType: "spider", title: "Spider", legend: [], relations: [],
    nodes: [n("c", "center"), n("b1", "branch", "c"), n("l1", "leaf", "b1"), n("b2", "branch", "c"), n("b3", "branch", "c")] },
  tree: { mapType: "tree", title: "Tree", legend: [], relations: [],
    nodes: [n("root", "root"), n("b1", "branch", "root"), n("b2", "branch", "root"), n("l1", "leaf", "b1")] },
  bubble: { mapType: "bubble", title: "Bubble", legend: [], relations: [],
    nodes: [n("c", "center", "", "bubble"), n("q1", "quality", "", "bubble"), n("q2", "quality", "", "bubble"), n("q3", "quality", "", "bubble")] },
  doubleBubble: { mapType: "doubleBubble", title: "Double", legend: [], relations: [],
    nodes: [n("lt", "leftTopic"), n("rt", "rightTopic"), n("s1", "shared"), n("lo1", "leftOnly"), n("ro1", "rightOnly")] },
  flow: { mapType: "flow", title: "Flow", legend: [],
    nodes: [n("s1", "step"), n("s2", "step"), n("s3", "step")],
    relations: [r("s1", "s2"), r("s2", "s3")] },
  multiFlow: { mapType: "multiFlow", title: "Multi", legend: [], relations: [],
    nodes: [n("c1", "cause"), n("e", "event"), n("f1", "effect")] },
  brace: { mapType: "brace", title: "Brace", legend: [], relations: [],
    nodes: [n("w", "whole"), n("p1", "part", "w"), n("p2", "part", "w"), n("sp1", "subpart", "p1")] },
  conceptMap: { mapType: "conceptMap", title: "Concepts", legend: [],
    nodes: [n("a", "concept"), n("b", "concept"), n("c", "concept"), n("d", "concept")],
    relations: [r("a", "b", "causes"), r("b", "c", "enables"), r("c", "d", "needs")] },
};

export const clone = (g: MapGraph): MapGraph => JSON.parse(JSON.stringify(g)) as MapGraph;
