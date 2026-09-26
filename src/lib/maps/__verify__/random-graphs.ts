// Seeded generator of VALID graphs per map type, exercising every node kind
// and wide label/size ranges. The layout property test asserts every one of
// these renders with zero rubric errors.
import { MAX_NODES, MAX_ZONES } from "../catalog";
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

/** A table up to 12x8 — past the 10x6 clamp — given as cells or as numeric rows/cols (sometimes fractional). */
function tableProps(rng: Rng): string {
  const rows = int(rng, 1, 12);
  const cols = int(rng, 1, 8);
  if (rng() < 0.5) {
    return JSON.stringify({ cells: Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => `r${r}c${c}`)) });
  }
  const frac = () => (rng() < 0.3 ? 0.5 : 0);
  return JSON.stringify({ rows: rows + frac(), cols: cols + frac() });
}

const KIND_PROPS: Record<NodeKind, (rng: Rng) => string> = {
  card: () => JSON.stringify({ emoji: "💡" }),
  bubble: () => "{}",
  // The circle variant is chosen by props.shapeType; the default is a diamond.
  waypoint: (rng) => (rng() < 0.5 ? JSON.stringify({ shapeType: "circle" }) : "{}"),
  portal: () => JSON.stringify({ icon: "grid" }),
  // An invalid componentKey exercises effectiveKind's anchor -> card fallback.
  anchor: (rng) => JSON.stringify({ componentKey: rng() < 0.25 ? "notARealSection" : "intentionCore" }),
  table: tableProps,
  frame: () => JSON.stringify({ storyboard: true }),
  // An empty url exercises effectiveKind's link -> card fallback.
  link: (rng) => JSON.stringify({ url: rng() < 0.25 ? "" : "https://example.com" }),
  caption: () => "{}",
  zone: () => "{}",
  task: (rng) => JSON.stringify(rng() < 0.5 ? { owner: "Sam", emoji: "✅" } : {}),
  // "blob" is not a canvas shape: it exercises the fallback to "rectangle".
  shape: (rng) => JSON.stringify({ shapeType: ["rectangle", "triangle", "hexagon", "star", "circle", "diamond", "blob"][int(rng, 0, 6)] }),
  heading: () => "{}",
};

const rel = (from: string, to: string, label: string): MapRelation =>
  ({ from, to, label, style: "solid", weight: "normal", direction: "forward" });

class Builder {
  nodes: MapNode[] = [];
  private zones = 0;
  /** Some graphs lean heavily on zones so the MAX_ZONES ceiling is reached. */
  private zoneHeavy: boolean;
  constructor(private rng: Rng) {
    this.zoneHeavy = rng() < 0.2;
  }
  full(): boolean {
    return this.nodes.length >= MAX_NODES;
  }
  add(role: MapRole, parent = ""): MapNode {
    const i = this.nodes.length;
    let kind: NodeKind = this.zoneHeavy && this.rng() < 0.6 ? "zone" : NODE_KINDS[int(this.rng, 0, NODE_KINDS.length - 1)];
    if (kind === "zone" && this.zones >= MAX_ZONES) kind = "card";
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
      tint: "",
      emphasis: "normal",
    };
    this.nodes.push(node);
    return node;
  }
}

/** Title of 1–200 chars (an empty title is structurally invalid). */
function randomTitle(type: MapType, rng: Rng): string {
  const len = int(rng, 1, 200);
  return `${type} map${" lorem ipsum".repeat(20)}`.slice(0, len);
}

/** Sometimes label a few center->satellite relations, occasionally duplicating one. */
function hubRelations(center: MapNode, satellites: MapNode[], rng: Rng): MapRelation[] {
  if (rng() < 0.5) return [];
  const out: MapRelation[] = satellites
    .filter(() => rng() < 0.6)
    .map((s, i) => rel(center.id, s.id, `is linked ${i}`));
  if (out.length && rng() < 0.3) out.push({ ...out[0], label: "duplicate" });
  return out;
}

export interface GraphOptions {
  /**
   * "normal" keeps each type's everyday sizes. "stress" widens concept maps
   * to the catalog ceiling: up to MAX_NODES concepts and up to one extra
   * relation per concept (dense, cyclic, long-spanning).
   */
  tier?: "normal" | "stress";
}

export function randomGraph(type: MapType, rng: Rng, opts: GraphOptions = {}): MapGraph {
  const stress = opts.tier === "stress";
  const b = new Builder(rng);
  const relations: MapRelation[] = [];
  switch (type) {
    case "radial": {
      const c = b.add("center");
      const sats = Array.from({ length: int(rng, 3, 8) }, () => b.add("branch"));
      relations.push(...hubRelations(c, sats, rng));
      break;
    }
    case "bubble": {
      const c = b.add("center");
      const sats = Array.from({ length: int(rng, 3, 8) }, () => b.add("quality"));
      relations.push(...hubRelations(c, sats, rng));
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
      for (let i = 1; i < k; i++) relations.push(rel(steps[i - 1].id, steps[i].id, ""));
      if (rng() < 0.5) relations.push(rel(steps[k - 1].id, steps[int(rng, 0, k - 2)].id, "again"));
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
      const k = stress ? int(rng, 4, MAX_NODES) : int(rng, 4, 10);
      const cs = Array.from({ length: k }, () => b.add("concept"));
      for (let i = 1; i < k; i++) relations.push(rel(cs[int(rng, 0, i - 1)].id, cs[i].id, "relates to"));
      for (let e = 0, extra = int(rng, 0, stress ? k : 3); e < extra; e++) {
        const a = int(rng, 0, k - 1);
        const c = int(rng, 0, k - 1);
        if (a !== c) relations.push(rel(cs[a].id, cs[c].id, "influences"));
      }
      break;
    }
  }
  return { mapType: type, title: randomTitle(type, rng), legend: [], nodes: b.nodes, relations };
}
