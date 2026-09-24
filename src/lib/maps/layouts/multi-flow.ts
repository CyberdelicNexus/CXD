// Multi-flow: causes column -> event -> effects column, arrows pointing right.
import { centeredColumn, columnSize, relationLabel, ZONE_GAP, type LayoutEdge, type LayoutEngine } from "./shared";

export const multiFlowLayout: LayoutEngine = (g) => {
  const causes = g.nodes.filter((x) => x.role === "cause");
  const event = g.nodes.find((x) => x.role === "event")!;
  const effects = g.nodes.filter((x) => x.role === "effect");

  const eventX = columnSize(causes).w + ZONE_GAP;
  const effectsX = eventX + columnSize([event]).w + ZONE_GAP;
  const placed = [
    ...centeredColumn(causes, 0),
    ...centeredColumn([event], eventX),
    ...centeredColumn(effects, effectsX),
  ];
  const edges: LayoutEdge[] = [
    ...causes.map((c): LayoutEdge => ({ from: c.id, to: event.id, label: relationLabel(g, c.id, event.id), gradient: "violet", bend: 0, arrow: "end" })),
    ...effects.map((e): LayoutEdge => ({ from: event.id, to: e.id, label: relationLabel(g, event.id, e.id), gradient: "emerald", bend: 0, arrow: "end" })),
  ];
  return { placed, edges, lines: [] };
};
