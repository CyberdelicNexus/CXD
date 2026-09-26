// Graphs stored before the element vocabulary (runs in lab-data, promoted
// files) lack tint, emphasis, relation style/weight/direction and the legend.
// upgradeGraph fills the spec's defaults so every reader sees a full MapGraph.
// Some stored graphs from before the "none" sentinel renaming may also carry
// a literal tint: "" (the old empty-string sentinel) rather than a missing
// field; `|| "none"` maps both cases (undefined and "") to the new sentinel.
import type { LegendEntry, MapGraph, MapNode, MapRelation, MapType } from "./types";

export type LegacyMapNode = Omit<MapNode, "tint" | "emphasis"> & Partial<Pick<MapNode, "tint" | "emphasis">>;
export type LegacyMapRelation = Omit<MapRelation, "style" | "weight" | "direction"> &
  Partial<Pick<MapRelation, "style" | "weight" | "direction">>;

export interface LegacyMapGraph {
  mapType: MapType;
  title: string;
  legend?: LegendEntry[];
  nodes: LegacyMapNode[];
  relations: LegacyMapRelation[];
}

export function upgradeGraph(g: LegacyMapGraph): MapGraph {
  return {
    ...g,
    legend: Array.isArray(g.legend) ? g.legend : [],
    nodes: g.nodes.map((n) => ({ ...n, tint: n.tint || "none", emphasis: n.emphasis ?? "normal" })),
    relations: g.relations.map((r) => ({
      ...r, style: r.style ?? "solid", weight: r.weight ?? "normal", direction: r.direction ?? "forward",
    })),
  };
}
