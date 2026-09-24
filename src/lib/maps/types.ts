// The typed graph a model emits for a thinking map. Deliberately contains no
// coordinates: the model owns structure and wording, layout engines own geometry.

export const MAP_TYPES = [
  "radial", "spider", "tree", "bubble", "doubleBubble",
  "flow", "multiFlow", "brace", "conceptMap",
] as const;
export type MapType = (typeof MAP_TYPES)[number];

export const MAP_ROLES = [
  "center", "branch", "leaf", "root", "quality",
  "leftTopic", "rightTopic", "shared", "leftOnly", "rightOnly",
  "step", "cause", "event", "effect",
  "whole", "part", "subpart", "concept",
] as const;
export type MapRole = (typeof MAP_ROLES)[number];

/** Which canvas element renders a node. */
export const NODE_KINDS = [
  "card", "bubble", "waypoint", "portal", "anchor",
  "table", "frame", "link", "caption", "zone",
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export interface MapNode {
  id: string;
  label: string;
  /** Body text for cards; "" when none. */
  detail: string;
  role: MapRole;
  kind: NodeKind;
  /** Hierarchy parent (tree, spider, brace); "" for roots. Not a container. */
  parent: string;
  /** JSON object string of kind-specific extras; "{}" when none. */
  props: string;
}

export interface MapRelation {
  from: string;
  to: string;
  /** "" when none; required for conceptMap. */
  label: string;
}

export interface MapGraph {
  mapType: MapType;
  title: string;
  nodes: MapNode[];
  relations: MapRelation[];
}
