// The nine thinking-map types: when to use each, which roles it accepts, and
// the structural rules a graph must satisfy before it is laid out. The rules
// double as judge input and as the critique checklist.
import type { MapGraph, MapNode, MapRelation, MapRole, MapType, NodeKind } from "./types";
import { upgradeGraph, type LegacyMapGraph } from "./legacy";

export const MAX_NODES = 40;
export const MAX_ZONES = 8;
export const MAX_LABEL = 60;
export const MAX_LEGEND_MEANING = 30;

/** Map types whose hierarchy has groups a heading can label. */
export const HEADING_MAP_TYPES: readonly MapType[] = ["spider", "tree", "brace"];

/** Kinds whose canvas element can show a tint (card gradient, board hex, container tint, shape or table accent). */
export const TINTABLE_KINDS: readonly NodeKind[] = ["card", "task", "bubble", "waypoint", "shape", "portal", "table", "zone"];

export interface CatalogEntry {
  type: MapType;
  name: string;
  useWhen: string;
  roles: readonly MapRole[];
  /** Kind used when the model does not pick one deliberately. */
  defaultKind: NodeKind;
  /** Human-readable rules, also shown to the model. */
  rules: string[];
  check: (g: MapGraph) => string[];
}

const byRole = (g: MapGraph, role: MapRole) => g.nodes.filter((x) => x.role === role);
const childrenOf = (g: MapGraph, id: string) => g.nodes.filter((x) => x.parent === id);

function countBetween(label: string, count: number, min: number, max: number): string[] {
  if (count < min) return [`needs at least ${min} ${label} (has ${count})`];
  if (count > max) return [`allows at most ${max} ${label} (has ${count})`];
  return [];
}

function exactlyOne(g: MapGraph, role: MapRole): string[] {
  const c = byRole(g, role).length;
  return c === 1 ? [] : [`needs exactly one ${role} (has ${c})`];
}

export const CATALOG: Record<MapType, CatalogEntry> = {
  radial: {
    type: "radial", name: "Radial", defaultKind: "card",
    useWhen: "Brainstorming ideas around one central idea, with no hierarchy among them.",
    roles: ["center", "branch"],
    rules: ["exactly 1 center", "3–8 branches"],
    check: (g) => {
      const v = [...exactlyOne(g, "center"), ...countBetween("branches", byRole(g, "branch").length, 3, 8)];
      const center = byRole(g, "center")[0];
      if (center && center.parent !== "") v.push("center must not have a parent");
      return v;
    },
  },
  spider: {
    type: "spider", name: "Spider", defaultKind: "card",
    useWhen: "One central idea whose branches each have their own sub-points.",
    roles: ["center", "branch", "leaf"],
    rules: ["exactly 1 center", "2–8 branches whose parent is the center (or empty)", "each leaf's parent is a branch", "at most 5 leaves per branch"],
    check: (g) => {
      const v = [...exactlyOne(g, "center"), ...countBetween("branches", byRole(g, "branch").length, 2, 8)];
      const center = byRole(g, "center")[0];
      if (center && center.parent !== "") v.push("center must not have a parent");
      const branchIds = new Set(byRole(g, "branch").map((b) => b.id));
      for (const b of byRole(g, "branch")) {
        if (b.parent !== "" && b.parent !== center?.id) v.push(`branch ${b.id} must hang off the center`);
      }
      for (const l of byRole(g, "leaf")) {
        if (!branchIds.has(l.parent)) v.push(`leaf ${l.id} must hang off a branch`);
      }
      for (const id of Array.from(branchIds)) {
        const c = g.nodes.filter((x) => x.parent === id && x.role === "leaf").length;
        if (c > 5) v.push(`branch ${id} has ${c} leaves; at most 5`);
      }
      return v;
    },
  },
  tree: {
    type: "tree", name: "Tree", defaultKind: "card",
    useWhen: "Classifying or grouping things into categories and sub-categories.",
    roles: ["root", "branch", "leaf"],
    rules: ["exactly 1 root with no parent", "every other node has a parent", "depth at most 3 below the root", "at most 7 children per node"],
    check: (g) => {
      const v = exactlyOne(g, "root");
      const byId = new Map(g.nodes.map((x) => [x.id, x]));
      for (const x of g.nodes) {
        if (x.role === "root") {
          if (x.parent !== "") v.push(`root ${x.id} must not have a parent`);
          continue;
        }
        if (x.parent === "") { v.push(`node ${x.id} needs a parent`); continue; }
        let depth = 0;
        let cur: MapNode | undefined = x;
        const seen = new Set<string>();
        while (cur && cur.parent !== "" && !seen.has(cur.id)) {
          seen.add(cur.id);
          depth++;
          cur = byId.get(cur.parent);
        }
        if (cur && seen.has(cur.id)) v.push(`node ${x.id} is part of a parent cycle`);
        else if (depth > 3) v.push(`node ${x.id} is at depth ${depth}; maximum depth is 3`);
      }
      for (const x of g.nodes) {
        const c = childrenOf(g, x.id).length;
        if (c > 7) v.push(`node ${x.id} has ${c} children; at most 7`);
      }
      return v;
    },
  },
  bubble: {
    type: "bubble", name: "Bubble", defaultKind: "bubble",
    useWhen: "Describing one thing through its qualities, traits or adjectives.",
    roles: ["center", "quality"],
    rules: ["exactly 1 center", "3–8 qualities"],
    check: (g) => {
      const v = [...exactlyOne(g, "center"), ...countBetween("qualities", byRole(g, "quality").length, 3, 8)];
      const center = byRole(g, "center")[0];
      if (center && center.parent !== "") v.push("center must not have a parent");
      return v;
    },
  },
  doubleBubble: {
    type: "doubleBubble", name: "Double Bubble", defaultKind: "bubble",
    useWhen: "Comparing and contrasting exactly two things.",
    roles: ["leftTopic", "rightTopic", "shared", "leftOnly", "rightOnly"],
    rules: ["exactly 1 leftTopic and 1 rightTopic", "at least 1 shared quality", "leftOnly/rightOnly optional"],
    check: (g) => {
      const v = [...exactlyOne(g, "leftTopic"), ...exactlyOne(g, "rightTopic")];
      if (byRole(g, "shared").length < 1) v.push("needs at least 1 shared quality");
      return v;
    },
  },
  flow: {
    type: "flow", name: "Flow", defaultKind: "card",
    useWhen: "A sequence, process, journey or timeline.",
    roles: ["step"],
    rules: ["at least 3 steps", "relations connect the steps into a single path in order", "at most one extra relation, pointing backwards (a loop)"],
    check: (g) => {
      const v = countBetween("steps", byRole(g, "step").length, 3, MAX_NODES);
      if (v.length === 0 && orderFlowSteps(g) === null) v.push("steps must form a single path (with at most one loop-back)");
      return v;
    },
  },
  multiFlow: {
    type: "multiFlow", name: "Multi-Flow", defaultKind: "card",
    useWhen: "The causes and effects of one event or decision.",
    roles: ["cause", "event", "effect"],
    rules: ["exactly 1 event", "at least 1 cause", "at least 1 effect"],
    check: (g) => {
      const v = exactlyOne(g, "event");
      if (byRole(g, "cause").length < 1) v.push("needs at least 1 cause");
      if (byRole(g, "effect").length < 1) v.push("needs at least 1 effect");
      return v;
    },
  },
  brace: {
    type: "brace", name: "Brace", defaultKind: "card",
    useWhen: "Breaking a whole down into its parts (and sub-parts).",
    roles: ["whole", "part", "subpart"],
    rules: ["exactly 1 whole", "2–7 parts whose parent is the whole (or empty)", "each subpart's parent is a part", "at most 5 subparts per part"],
    check: (g) => {
      const v = [...exactlyOne(g, "whole"), ...countBetween("parts", byRole(g, "part").length, 2, 7)];
      const whole = byRole(g, "whole")[0];
      if (whole && whole.parent !== "") v.push("whole must not have a parent");
      const partIds = new Set(byRole(g, "part").map((p) => p.id));
      for (const p of byRole(g, "part")) {
        if (p.parent !== "" && p.parent !== whole?.id) v.push(`part ${p.id} must hang off the whole`);
      }
      for (const s of byRole(g, "subpart")) {
        if (!partIds.has(s.parent)) v.push(`subpart ${s.id} must hang off a part`);
      }
      for (const id of Array.from(partIds)) {
        const c = g.nodes.filter((x) => x.parent === id && x.role === "subpart").length;
        if (c > 5) v.push(`part ${id} has ${c} subparts; at most 5`);
      }
      return v;
    },
  },
  conceptMap: {
    type: "conceptMap", name: "Concept Map", defaultKind: "card",
    useWhen: "Showing how several ideas relate to each other, with named relationships.",
    roles: ["concept"],
    rules: ["at least 4 concepts", "every relation has a label", "all concepts are connected"],
    check: (g) => {
      const v = countBetween("concepts", byRole(g, "concept").length, 4, MAX_NODES);
      if (g.relations.length === 0) v.push("needs labelled relations between concepts");
      for (const rel of g.relations) {
        if (!rel.label.trim()) v.push(`relation ${rel.from}→${rel.to} needs a label`);
      }
      if (g.nodes.length > 0 && !isConnected(g)) v.push("all concepts must be connected");
      return v;
    },
  },
};

function isConnected(g: MapGraph): boolean {
  const adj = new Map<string, string[]>(g.nodes.map((x) => [x.id, []]));
  for (const rel of g.relations) {
    adj.get(rel.from)?.push(rel.to);
    adj.get(rel.to)?.push(rel.from);
  }
  const start = g.nodes[0].id;
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const nb of adj.get(cur) || []) if (!seen.has(nb)) { seen.add(nb); queue.push(nb); }
  }
  return seen.size === g.nodes.length;
}

/**
 * The nodes a node labels as a group: its hierarchy children. A spider centre
 * or brace whole also owns the branches or parts written with parent "".
 */
export function groupOf(g: MapGraph, x: MapNode): MapNode[] {
  const hub = (g.mapType === "spider" && x.role === "center") || (g.mapType === "brace" && x.role === "whole");
  return g.nodes.filter((m) => m.id !== x.id &&
    (m.parent === x.id || (hub && m.parent === "" && (m.role === "branch" || m.role === "part"))));
}

/** Why a heading node is misplaced, or null when it labels a group. */
export function headingProblem(g: MapGraph, x: MapNode): string | null {
  if (x.kind !== "heading") return null;
  if (!HEADING_MAP_TYPES.includes(g.mapType)) {
    return `node ${x.id}: a heading labels a group, and only spider, tree and brace maps have groups (use a caption)`;
  }
  if (groupOf(g, x).length === 0) return `heading ${x.id} labels no group: give it children or use a caption`;
  return null;
}

/** Legend rule (spec §3.4): every tint on a node has an entry, every entry is used, meanings are short. */
export function checkLegend(g: MapGraph): string[] {
  const v: string[] = [];
  const listed = new Set<string>();
  for (const e of g.legend) {
    if (listed.has(e.tint)) v.push(`legend lists tint "${e.tint}" twice`);
    listed.add(e.tint);
    const meaning = (e.meaning ?? "").trim();
    if (!meaning) v.push(`legend entry "${e.tint}" has no meaning`);
    else if (meaning.length > MAX_LEGEND_MEANING) v.push(`legend meaning for "${e.tint}" is longer than ${MAX_LEGEND_MEANING} characters`);
  }
  const used = new Set<string>();
  for (const x of g.nodes) {
    if (!x.tint) continue;
    used.add(x.tint);
    if (!listed.has(x.tint)) v.push(`node ${x.id} uses tint "${x.tint}" but the legend has no entry for it`);
    if (!TINTABLE_KINDS.includes(x.kind)) v.push(`node ${x.id}: a ${x.kind} cannot show a tint (use "")`);
  }
  for (const e of g.legend) {
    if (!used.has(e.tint)) v.push(`legend entry "${e.tint}" (${e.meaning}) is not used by any node`);
  }
  return v;
}

export interface FlowOrder {
  order: string[];
  backEdge: MapRelation | null;
}

/**
 * Orders flow steps along their single path. Returns null when the relations
 * do not form one path (branching, disconnected, or more than one extra edge).
 * Shared by the structure check and the flow layout engine.
 */
export function orderFlowSteps(g: MapGraph): FlowOrder | null {
  const steps = g.nodes.filter((x) => x.role === "step").map((x) => x.id);
  const stepSet = new Set(steps);
  // Dedupe identical from→to relations (keep the first) so a repeated edge
  // does not look like a branch during path-walking below.
  const seenPairs = new Set<string>();
  const rels: MapRelation[] = [];
  for (const rel of g.relations) {
    if (!stepSet.has(rel.from) || !stepSet.has(rel.to) || rel.from === rel.to) continue;
    const pairKey = `${rel.from}→${rel.to}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    rels.push(rel);
  }
  const indeg = new Map(steps.map((s) => [s, 0]));
  for (const rel of rels) indeg.set(rel.to, (indeg.get(rel.to) || 0) + 1);
  const sources = steps.filter((s) => indeg.get(s) === 0);
  if (sources.length > 1) return null;
  // With a loop-back into the first step there is no zero-indegree step.
  const candidates = sources.length === 1 ? sources : steps;

  for (const start of candidates) {
    const order = [start];
    const visited = new Set([start]);
    const used = new Set<number>();
    let cur = start;
    let branched = false;
    for (;;) {
      const outs = rels
        .map((rel, i) => ({ rel, i }))
        .filter(({ rel, i }) => rel.from === cur && !used.has(i) && !visited.has(rel.to));
      if (outs.length === 0) break;
      if (outs.length > 1) { branched = true; break; }
      used.add(outs[0].i);
      cur = outs[0].rel.to;
      visited.add(cur);
      order.push(cur);
    }
    if (branched || order.length !== steps.length) continue;
    const leftover = rels.filter((_, i) => !used.has(i));
    if (leftover.length > 1) continue;
    if (leftover.length === 1) {
      const back = leftover[0];
      if (order.indexOf(back.to) >= order.indexOf(back.from)) continue;
      return { order, backEdge: back };
    }
    return { order, backEdge: null };
  }
  return null;
}

/** All structural violations; empty means the graph may be laid out. */
export function checkMapStructure(input: LegacyMapGraph): string[] {
  // Stored graphs from before the element vocabulary are read with defaults.
  const g = upgradeGraph(input);
  // CATALOG[g.mapType] is truthy-but-wrong for keys like "toString" that
  // exist only via Object.prototype — check ownership, not truthiness, so an
  // unrecognized mapType is reported instead of crashing below.
  if (!Object.prototype.hasOwnProperty.call(CATALOG, g.mapType)) {
    return [`unknown mapType ${String(g.mapType)}`];
  }
  const entry = CATALOG[g.mapType];
  const v: string[] = [];
  if (typeof g.title !== "string" || !g.title.trim()) v.push("map title is empty");
  if (g.nodes.length === 0) return [...v, "graph has no nodes"];
  if (g.nodes.length > MAX_NODES) v.push(`at most ${MAX_NODES} nodes allowed (has ${g.nodes.length})`);
  const zones = g.nodes.filter((x) => x.kind === "zone").length;
  if (zones > MAX_ZONES) v.push(`at most ${MAX_ZONES} zone nodes allowed (has ${zones})`);

  const ids = new Set<string>();
  for (const x of g.nodes) {
    if (ids.has(x.id)) v.push(`duplicate id ${x.id}`);
    ids.add(x.id);
  }
  for (const x of g.nodes) {
    if (!x.id.trim()) v.push(`node with label "${x.label}" has an empty id`);
    if (!x.label.trim()) v.push(`node ${x.id} has an empty label`);
    else if (x.label.length > MAX_LABEL) v.push(`node ${x.id} label is longer than ${MAX_LABEL} characters`);
    if (!entry.roles.includes(x.role)) v.push(`node ${x.id}: role "${x.role}" is not valid for ${g.mapType}`);
    if (x.parent !== "" && !ids.has(x.parent)) v.push(`node ${x.id} has unknown parent ${x.parent}`);
    if (x.parent === x.id) v.push(`node ${x.id} is its own parent`);
    const heading = headingProblem(g, x);
    if (heading) v.push(heading);
  }
  v.push(...checkLegend(g));
  for (const rel of g.relations) {
    if (!ids.has(rel.from) || !ids.has(rel.to)) v.push(`relation ${rel.from}→${rel.to} references an unknown node`);
    else if (rel.from === rel.to) v.push(`relation on ${rel.from} points at itself`);
  }
  const siblingLabels = new Map<string, Set<string>>();
  for (const x of g.nodes) {
    const key = siblingKey(g, x);
    const label = x.label.trim().toLowerCase();
    if (!siblingLabels.has(key)) siblingLabels.set(key, new Set());
    const set = siblingLabels.get(key)!;
    if (label && set.has(label)) v.push(`duplicate label "${x.label}" among siblings`);
    set.add(label);
  }
  return [...v, ...entry.check(g)];
}

/**
 * Groups nodes into the "sibling" set duplicate labels are compared against.
 * What counts as a sibling differs by map type: doubleBubble groups by
 * topic-vs-quality; multiFlow keeps cause and effect separate (they may
 * legitimately share wording, e.g. a "Delay" that is both a cause and an
 * effect elsewhere); the remaining flat maps require every label in the
 * whole graph to be distinct.
 *
 * Tree, spider and brace group by parent, with one wrinkle: a spider branch
 * (or brace part) may be written with parent "" OR the center/whole's id —
 * both mean "hangs off the hub" and are drawn identically, so they must land
 * in the same sibling group. The center/whole itself is put in its own
 * "__root__" group so it is never treated as a sibling of its own
 * branches/parts (a branch may legitimately echo the center's label).
 */
function siblingKey(g: MapGraph, x: MapNode): string {
  switch (g.mapType) {
    case "tree":
      return x.parent;
    case "spider": {
      if (x.role === "center") return "__root__";
      if (x.role === "branch") {
        const center = byRole(g, "center")[0];
        return x.parent === "" ? (center?.id ?? "") : x.parent;
      }
      return x.parent; // leaf: keyed by its branch
    }
    case "brace": {
      if (x.role === "whole") return "__root__";
      if (x.role === "part") {
        const whole = byRole(g, "whole")[0];
        return x.parent === "" ? (whole?.id ?? "") : x.parent;
      }
      return x.parent; // subpart: keyed by its part
    }
    case "doubleBubble":
      return x.role === "leftTopic" || x.role === "rightTopic" ? "topics" : "qualities";
    case "multiFlow":
      return x.role;
    default:
      return "";
  }
}
