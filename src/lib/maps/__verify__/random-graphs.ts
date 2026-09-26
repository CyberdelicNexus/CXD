// Seeded generator of VALID graphs per map type, exercising every node kind,
// tints with a matching legend, strong emphasis, every relation style, weight
// and direction, and wide label/size ranges. The layout property test asserts
// every one of these renders with zero rubric errors and zero crossings.
import { headingProblem, MAX_NODES, MAX_ZONES, TINTABLE_KINDS } from "../catalog";
import {
  NODE_KINDS, RELATION_DIRECTIONS, RELATION_STYLES, RELATION_WEIGHTS, TINTS,
  type LegendEntry, type MapGraph, type MapNode, type MapRelation, type MapRole, type MapType, type NodeKind, type Tint,
} from "../types";

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
const pick = <T,>(rng: Rng, xs: readonly T[]): T => xs[int(rng, 0, xs.length - 1)];

/** A table up to 12x8 (past the 10x6 clamp), given as cells or as numeric rows/cols (sometimes fractional). */
function tableProps(rng: Rng): string {
  const rows = int(rng, 1, 12);
  const cols = int(rng, 1, 8);
  if (rng() < 0.5) {
    return JSON.stringify({ cells: Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => `r${r}c${c}`)) });
  }
  const frac = () => (rng() < 0.3 ? 0.5 : 0);
  return JSON.stringify({ rows: rows + frac(), cols: cols + frac() });
}

/** "blob" is not a canvas shape: it exercises the fallback to "rectangle". */
const SHAPE_CHOICES = ["rectangle", "triangle", "hexagon", "star", "circle", "diamond", "blob"] as const;

const KIND_PROPS: Record<NodeKind, (rng: Rng) => string> = {
  card: () => JSON.stringify({ emoji: "💡" }),
  task: (rng) => JSON.stringify(rng() < 0.5 ? { owner: "Sam", emoji: "✅" } : {}),
  bubble: () => "{}",
  // The circle variant is chosen by props.shapeType; the default is a diamond.
  waypoint: (rng) => (rng() < 0.5 ? JSON.stringify({ shapeType: "circle" }) : "{}"),
  shape: (rng) => JSON.stringify({ shapeType: pick(rng, SHAPE_CHOICES) }),
  portal: () => JSON.stringify({ icon: "grid" }),
  // An invalid componentKey exercises effectiveKind's anchor -> card fallback.
  anchor: (rng) => JSON.stringify({ componentKey: rng() < 0.25 ? "notARealSection" : "intentionCore" }),
  table: tableProps,
  frame: () => JSON.stringify({ storyboard: true }),
  // An empty url exercises effectiveKind's link -> card fallback.
  link: (rng) => JSON.stringify({ url: rng() < 0.25 ? "" : "https://example.com" }),
  heading: () => "{}",
  caption: () => "{}",
  zone: () => "{}",
};

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
      emphasis: this.rng() < 0.2 ? "strong" : "normal",
    };
    this.nodes.push(node);
    return node;
  }
}

/** Title of 1-200 chars (an empty title is structurally invalid). */
function randomTitle(type: MapType, rng: Rng): string {
  const len = int(rng, 1, 200);
  return `${type} map${" lorem ipsum".repeat(20)}`.slice(0, len);
}

/** A relation with a random style, weight and direction. */
function rel(rng: Rng, from: string, to: string, label: string): MapRelation {
  return { from, to, label, style: pick(rng, RELATION_STYLES), weight: pick(rng, RELATION_WEIGHTS), direction: pick(rng, RELATION_DIRECTIONS) };
}

/** Sometimes label a few center<->satellite relations (either direction), occasionally duplicating one. */
function hubRelations(center: MapNode, satellites: MapNode[], rng: Rng): MapRelation[] {
  if (rng() < 0.5) return [];
  const out: MapRelation[] = satellites
    .filter(() => rng() < 0.6)
    .map((s, i) => (rng() < 0.3 ? rel(rng, s.id, center.id, `is linked ${i}`) : rel(rng, center.id, s.id, `is linked ${i}`)));
  if (out.length && rng() < 0.3) out.push({ ...out[0], label: "duplicate" });
  return out;
}

/**
 * Unlabelled relations along structural edges, so styles reach every engine.
 * Unlabelled on purpose: they add no label pills, so no new geometry. With
 * `reversible` some run against the drawn edge (arrowStyle "start").
 */
function structuralRelations(pairs: [string, string][], rng: Rng, reversible: boolean): MapRelation[] {
  if (rng() < 0.4) return [];
  return pairs
    .filter(() => rng() < 0.6)
    .map(([a, b]) => (reversible && rng() < 0.3 ? rel(rng, b, a, "") : rel(rng, a, b, "")));
}

/** Half the graphs: 1-3 tint families on tintable nodes, each used at least once, with a legend entry per family. */
function colour(nodes: MapNode[], rng: Rng): LegendEntry[] {
  const tintable = nodes.filter((x) => TINTABLE_KINDS.includes(x.kind));
  if (tintable.length === 0 || rng() < 0.5) return [];
  const families = Math.min(int(rng, 1, 3), tintable.length);
  const start = int(rng, 0, TINTS.length - 1);
  const tints: Tint[] = Array.from({ length: families }, (_, i) => TINTS[(start + i) % TINTS.length]);
  const shuffled = tintable.map((x) => ({ x, k: rng() })).sort((a, b) => a.k - b.k).map((e) => e.x);
  shuffled.forEach((x, i) => {
    if (i < tints.length) x.tint = tints[i];
    else if (rng() < 0.4) x.tint = pick(rng, tints);
  });
  return tints.map((tint, i) => ({ tint, meaning: `meaning ${i + 1}${" long".repeat(int(rng, 0, 4))}`.slice(0, 30) }));
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
      const pairs: [string, string][] = [];
      for (let i = 0; i < k; i++) {
        const br = b.add("branch", c.id);
        pairs.push([c.id, br.id]);
        for (let j = 0, m = int(rng, 0, maxLeaves); j < m; j++) pairs.push([br.id, b.add("leaf", br.id).id]);
      }
      relations.push(...structuralRelations(pairs, rng, true));
      break;
    }
    case "tree": {
      const root = b.add("root");
      const pairs: [string, string][] = [];
      for (let i = 0, k = int(rng, 1, 4); i < k && !b.full(); i++) {
        const br = b.add("branch", root.id);
        pairs.push([root.id, br.id]);
        for (let j = 0, m = int(rng, 0, 4); j < m && !b.full(); j++) {
          const sub = b.add("branch", br.id);
          pairs.push([br.id, sub.id]);
          for (let l = 0, q = int(rng, 0, 3); l < q && !b.full(); l++) pairs.push([sub.id, b.add("leaf", sub.id).id]);
        }
      }
      relations.push(...structuralRelations(pairs, rng, true));
      break;
    }
    case "doubleBubble": {
      const left = b.add("leftTopic");
      const right = b.add("rightTopic");
      const pairs: [string, string][] = [];
      for (let i = 0, k = int(rng, 1, 4); i < k; i++) {
        const s = b.add("shared");
        pairs.push([left.id, s.id], [right.id, s.id]);
      }
      for (let i = 0, k = int(rng, 0, 4); i < k; i++) pairs.push([left.id, b.add("leftOnly").id]);
      for (let i = 0, k = int(rng, 0, 4); i < k; i++) pairs.push([right.id, b.add("rightOnly").id]);
      relations.push(...structuralRelations(pairs, rng, true));
      break;
    }
    case "flow": {
      const k = int(rng, 3, 8);
      const steps = Array.from({ length: k }, () => b.add("step"));
      for (let i = 1; i < k; i++) relations.push(rel(rng, steps[i - 1].id, steps[i].id, ""));
      if (rng() < 0.5) relations.push(rel(rng, steps[k - 1].id, steps[int(rng, 0, k - 2)].id, "again"));
      break;
    }
    case "multiFlow": {
      const causes = Array.from({ length: int(rng, 1, 5) }, () => b.add("cause"));
      const event = b.add("event");
      const effects = Array.from({ length: int(rng, 1, 5) }, () => b.add("effect"));
      // Never reversed: the harness requires each multiFlow relation drawn in its own direction.
      relations.push(...structuralRelations([
        ...causes.map((c): [string, string] => [c.id, event.id]),
        ...effects.map((e): [string, string] => [event.id, e.id]),
      ], rng, false));
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
      for (let i = 1; i < k; i++) relations.push(rel(rng, cs[int(rng, 0, i - 1)].id, cs[i].id, "relates to"));
      for (let e = 0, extra = int(rng, 0, stress ? k : 3); e < extra; e++) {
        const a = int(rng, 0, k - 1);
        const c = int(rng, 0, k - 1);
        if (a !== c) relations.push(rel(rng, cs[a].id, cs[c].id, "influences"));
      }
      break;
    }
  }
  const graph: MapGraph = { mapType: type, title: randomTitle(type, rng), legend: [], nodes: b.nodes, relations };
  // A heading must label a group; anywhere else the generator's heading becomes a caption.
  for (const x of graph.nodes) if (headingProblem(graph, x)) x.kind = "caption";
  graph.legend = colour(graph.nodes, rng);
  return graph;
}
