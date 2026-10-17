// The named pairings the library must show (spec §4.3), each with a detector
// over the graph so an example's pairing tags are derived, never claimed.
import { headingProblem, orderFlowSteps } from "../catalog";
import { effectiveKind, parseProps, shapeTypeOf } from "../layouts/shared";
import type { MapGraph, MapNode } from "../types";

export const PAIRING_IDS = [
  "zoneTableCards", "waypointBranches", "framesToTask", "treePortal", "doubleBubbleLegend",
  "conceptMapDashedTwoWay", "linksSupportIdeas", "headingsRegions", "strongMainPath", "starGoal", "twoAnchors",
] as const;
export type PairingId = (typeof PAIRING_IDS)[number];

export interface Pairing {
  id: PairingId;
  label: string;
  detect: (g: MapGraph) => boolean;
}

const childrenOf = (g: MapGraph, id: string) => g.nodes.filter((x) => x.parent === id);
const HUB_ROLES: readonly string[] = ["center", "root", "whole", "event"];

/** Is a link node joined, by a relation or the hierarchy, to a node that is not itself a link? */
function attachedToIdea(g: MapGraph, link: MapNode): boolean {
  const byId = new Map(g.nodes.map((x) => [x.id, x]));
  const isIdea = (id: string) => { const x = byId.get(id); return !!x && effectiveKind(x) !== "link"; };
  return g.relations.some((r) => (r.from === link.id && isIdea(r.to)) || (r.to === link.id && isIdea(r.from))) ||
    (link.parent !== "" && isIdea(link.parent)) ||
    childrenOf(g, link.id).some((c) => effectiveKind(c) !== "link");
}

export const PAIRINGS: Pairing[] = [
  {
    id: "zoneTableCards",
    label: "A zone holding a table and cards",
    detect: (g) => g.nodes.some((z) => effectiveKind(z) === "zone" &&
      childrenOf(g, z.id).some((c) => effectiveKind(c) === "table") &&
      childrenOf(g, z.id).some((c) => effectiveKind(c) === "card")),
  },
  {
    id: "waypointBranches",
    label: "A waypoint with two labelled branches",
    detect: (g) => g.nodes.some((w) => effectiveKind(w) === "waypoint" &&
      g.relations.filter((r) => r.from === w.id && r.label.trim() !== "").length >= 2),
  },
  {
    id: "framesToTask",
    label: "A sequence of frames that ends in a task",
    detect: (g) => {
      if (g.mapType !== "flow") return false;
      const order = orderFlowSteps(g);
      if (!order) return false;
      const byId = new Map(g.nodes.map((x) => [x.id, x]));
      const kinds = order.order.map((id) => effectiveKind(byId.get(id)!));
      return kinds.filter((k) => k === "frame").length >= 2 && kinds[kinds.length - 1] === "task";
    },
  },
  {
    id: "treePortal",
    label: "A tree with a portal drill-down",
    detect: (g) => g.mapType === "tree" && g.nodes.some((x) => effectiveKind(x) === "portal" && x.parent !== ""),
  },
  {
    id: "doubleBubbleLegend",
    label: "A two-way comparison coloured by meaning, with a legend",
    detect: (g) => g.mapType === "doubleBubble" && g.legend.length >= 1 && g.nodes.filter((x) => x.tint !== "none").length >= 2,
  },
  {
    id: "conceptMapDashedTwoWay",
    label: "A concept map with dashed and two-way relations",
    detect: (g) => g.mapType === "conceptMap" && g.relations.some((r) => r.style === "dashed") && g.relations.some((r) => r.direction === "both"),
  },
  {
    id: "linksSupportIdeas",
    label: "Links attached to the ideas they support",
    detect: (g) => g.nodes.filter((x) => effectiveKind(x) === "link" && attachedToIdea(g, x)).length >= 2,
  },
  {
    id: "headingsRegions",
    label: "Headings labelling regions",
    detect: (g) => g.nodes.filter((x) => x.kind === "heading" && headingProblem(g, x) === null).length >= 2,
  },
  {
    id: "strongMainPath",
    label: "A strong main path through a sequence",
    detect: (g) => {
      if (g.mapType !== "flow") return false;
      const order = orderFlowSteps(g);
      if (!order) return false;
      const path = new Set(order.order.slice(1).map((id, i) => `${order.order[i]}->${id}`));
      return g.relations.filter((r) => r.weight === "strong" && path.has(`${r.from}->${r.to}`)).length >= 2;
    },
  },
  {
    id: "starGoal",
    label: "A star shape as the goal",
    detect: (g) => {
      const order = g.mapType === "flow" ? orderFlowSteps(g) : null;
      const last = order ? order.order[order.order.length - 1] : null;
      return g.nodes.some((x) => effectiveKind(x) === "shape" && shapeTypeOf(x) === "star" &&
        (HUB_ROLES.includes(x.role) || x.id === last || g.relations.some((r) => r.to === x.id)));
    },
  },
  {
    id: "twoAnchors",
    label: "Two anchors to different framing sections",
    detect: (g) => {
      const keys = new Set<string>();
      g.nodes.forEach((x) => { if (effectiveKind(x) === "anchor") keys.add(String(parseProps(x.props).componentKey)); });
      return keys.size >= 2;
    },
  },
];
