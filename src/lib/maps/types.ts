// The typed graph a model emits for a thinking map. Deliberately contains no
// coordinates: the model owns structure, wording and element choice; layout
// engines own geometry.

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

/** Which canvas element renders a node. The guide gives each a content trigger; none is a default. */
export const NODE_KINDS = [
  "card", "task", "bubble", "waypoint", "shape", "portal", "anchor",
  "table", "frame", "link", "heading", "caption", "zone",
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

/** The canvas tint families, in TINT_COLORS order (schema.verify checks they match). */
export const TINTS = ["violet", "ocean", "emerald", "sunset", "rose", "glacier"] as const;
export type Tint = (typeof TINTS)[number];
/**
 * A node's tint: a colour whose meaning is in the legend, or "none" to let the
 * engine rotate decorative tints. "none" (not "") because Gemini's structured
 * output rejects a JSON Schema enum with an empty-string member outright
 * ("enum[0]: cannot be empty") while Anthropic's accepts it — an empty string
 * must never be a member of this or any other enum.
 */
export const NODE_TINTS = ["none", ...TINTS] as const;
export type NodeTint = (typeof NODE_TINTS)[number];

export const EMPHASES = ["normal", "strong"] as const;
export type Emphasis = (typeof EMPHASES)[number];

export const RELATION_STYLES = ["solid", "dashed", "dotted"] as const;
export type RelationStyle = (typeof RELATION_STYLES)[number];
export const RELATION_WEIGHTS = ["normal", "strong"] as const;
export type RelationWeight = (typeof RELATION_WEIGHTS)[number];
export const RELATION_DIRECTIONS = ["forward", "both", "none"] as const;
export type RelationDirection = (typeof RELATION_DIRECTIONS)[number];

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
  /** Legend colour, or "none" for none. */
  tint: NodeTint;
  /** "strong" draws the node about 25% larger. */
  emphasis: Emphasis;
}

export interface MapRelation {
  from: string;
  to: string;
  /** "" when none; required for conceptMap. */
  label: string;
  style: RelationStyle;
  weight: RelationWeight;
  direction: RelationDirection;
}

export interface LegendEntry {
  tint: Tint;
  /** What the colour means; at most 30 characters. */
  meaning: string;
}

export interface MapGraph {
  mapType: MapType;
  title: string;
  /** One entry per tint used on a node; [] when colour carries no meaning. */
  legend: LegendEntry[];
  nodes: MapNode[];
  relations: MapRelation[];
}
