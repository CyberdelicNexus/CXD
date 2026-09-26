// The bar every exemplar clears (spec §4.3), authored or promoted: catalog
// structure (legend rule included), then a render with 0 layout errors and 0
// connector crossings.
import { checkLayout } from "@/lib/canvas-layout-rules";
import { checkMapStructure } from "../catalog";
import { connectorCrossings } from "../connector-geometry";
import { renderMap, type RenderedMap } from "../render";
import type { MapGraph } from "../types";

export function exemplarProblems(graph: MapGraph): string[] {
  const structure = checkMapStructure(graph);
  if (structure.length) return structure;
  let out: RenderedMap;
  try {
    out = renderMap(graph);
  } catch (e) {
    return [`render failed: ${(e as Error).message}`];
  }
  const errors = checkLayout(out.elements, out.edges, { includeDesignSystemRules: true })
    .filter((v) => v.severity === "error")
    .map((v) => `layout error: [${v.rule}] ${v.message}`);
  const crossings = connectorCrossings(out.elements, out.edges)
    .map((c) => `connector crossing: ${c.edgeId} ${c.by === "label" ? "label covers" : "passes through"} ${c.throughId}`);
  return [...errors, ...crossings];
}
