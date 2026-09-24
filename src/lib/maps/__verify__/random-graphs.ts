// Seeded generator of VALID graphs per map type, exercising every node kind
// and wide label/size ranges. The layout property test asserts every one of
// these renders with zero rubric errors.
import { MAX_NODES } from "../catalog";
import { NODE_KINDS, type MapGraph, type MapNode, type MapRelation, type MapRole, type MapType, type NodeKind } from "../types";

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

const KIND_PROPS: Record<NodeKind, (rng: Rng) => string> = {
  card: () => JSON.stringify({ emoji: "💡" }),
  bubble: () => "{}",
  waypoint: () => "{}",
  portal: () => JSON.stringify({ icon: "grid" }),
  anchor: () => JSON.stringify({ componentKey: "intentionCore" }),
  table: (rng) => {
    const rows = int(rng, 1, 4);
    const cols = int(rng, 1, 4);
    return JSON.stringify({ cells: Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => `r${r}c${c}`)) });
  },
  frame: () => JSON.stringify({ storyboard: true }),
  link: () => JSON.stringify({ url: "https://example.com" }),
  caption: () => "{}",
  zone: () => "{}",
};

class Builder {
  nodes: MapNode[] = [];
  private zones = 0;
  constructor(private rng: Rng) {}
  full(): boolean {
    return this.nodes.length >= MAX_NODES;
  }
  add(role: MapRole, parent = ""): MapNode {
    const i = this.nodes.length;
    let kind = NODE_KINDS[int(this.rng, 0, NODE_KINDS.length - 1)];
    if (kind === "zone" && this.zones >= 3) kind = "card";
    if (kind === "zone") this.zones++;
    const filler = " lorem".repeat(int(this.rng, 0, 9));
    const node: MapNode = {
      id: `n${i}`,
      label: `${role} ${i}${filler}`.slice(0, 60),
      detail: this.rng() < 0.5 ? "Some supporting detail for this node." : "",
      role,
      kind,
      parent,
      props: KIND_PROPS[kind](this.rng),
    };
    this.nodes.push(node);
    return node;
  }
}

export function randomGraph(type: MapType, rng: Rng): MapGraph {
  const b = new Builder(rng);
  const relations: MapRelation[] = [];
  switch (type) {
    case "radial": {
      b.add("center");
      for (let i = 0, k = int(rng, 3, 8); i < k; i++) b.add("branch");
      break;
    }
    case "bubble": {
      b.add("center");
      for (let i = 0, k = int(rng, 3, 8); i < k; i++) b.add("quality");
      break;
    }
    case "spider": {
      const c = b.add("center");
      const k = int(rng, 2, 8);
      const maxLeaves = Math.min(5, Math.floor((MAX_NODES - 1 - k) / k));
      for (let i = 0; i < k; i++) {
        const br = b.add("branch", c.id);
        for (let j = 0, m = int(rng, 0, maxLeaves); j < m; j++) b.add("leaf", br.id);
      }
      break;
    }
    case "tree": {
      const root = b.add("root");
      for (let i = 0, k = int(rng, 1, 4); i < k && !b.full(); i++) {
        const br = b.add("branch", root.id);
        for (let j = 0, m = int(rng, 0, 4); j < m && !b.full(); j++) {
          const sub = b.add("branch", br.id);
          for (let l = 0, q = int(rng, 0, 3); l < q && !b.full(); l++) b.add("leaf", sub.id);
        }
      }
      break;
    }
    case "doubleBubble": {
      b.add("leftTopic");
      b.add("rightTopic");
      for (let i = 0, k = int(rng, 1, 4); i < k; i++) b.add("shared");
      for (let i = 0, k = int(rng, 0, 4); i < k; i++) b.add("leftOnly");
      for (let i = 0, k = int(rng, 0, 4); i < k; i++) b.add("rightOnly");
      break;
    }
    case "flow": {
      const k = int(rng, 3, 8);
      const steps = Array.from({ length: k }, () => b.add("step"));
      for (let i = 1; i < k; i++) relations.push({ from: steps[i - 1].id, to: steps[i].id, label: "" });
      if (rng() < 0.5) relations.push({ from: steps[k - 1].id, to: steps[int(rng, 0, k - 2)].id, label: "again" });
      break;
    }
    case "multiFlow": {
      for (let i = 0, k = int(rng, 1, 5); i < k; i++) b.add("cause");
      b.add("event");
      for (let i = 0, k = int(rng, 1, 5); i < k; i++) b.add("effect");
      break;
    }
    case "brace": {
      const w = b.add("whole");
      const k = int(rng, 2, 7);
      const maxSubs = Math.min(5, Math.floor((MAX_NODES - 1 - k) / k));
      for (let i = 0; i < k; i++) {
        const p = b.add("part", w.id);
        for (let j = 0, m = int(rng, 0, maxSubs); j < m; j++) b.add("subpart", p.id);
      }
      break;
    }
    case "conceptMap": {
      const k = int(rng, 4, 10);
      const cs = Array.from({ length: k }, () => b.add("concept"));
      for (let i = 1; i < k; i++) relations.push({ from: cs[int(rng, 0, i - 1)].id, to: cs[i].id, label: "relates to" });
      for (let e = 0, extra = int(rng, 0, 3); e < extra; e++) {
        const a = int(rng, 0, k - 1);
        const c = int(rng, 0, k - 1);
        if (a !== c) relations.push({ from: cs[a].id, to: cs[c].id, label: "influences" });
      }
      break;
    }
  }
  return { mapType: type, title: `${type} map`, nodes: b.nodes, relations };
}
