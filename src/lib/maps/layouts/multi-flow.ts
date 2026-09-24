// Multi-flow: causes column -> event -> effects column, arrows pointing right.
//
// Connectors are drawn from auto anchors, so every cause/effect is kept
// horizontal-dominant from the event (centre dx beats centre dy by
// DOMINANCE): the gap to each column grows with the column's height. Each
// column aligns the edge facing the event (causes right-aligned, effects
// left-aligned), so every connector stays in the empty gap and no member of
// a column reaches into it.
import type { MapNode } from "../types";
import {
  DOMINANCE, footprint, GAP, relationLabel, snapDown, snapUp, ZONE_GAP,
  type Footprint, type LayoutEdge, type LayoutEngine, type PlacedNode,
} from "./shared";

/** Tops of a vertical stack centred on y = 0. */
function centredTops(fps: Footprint[]): number[] {
  const h = fps.reduce((s, f) => s + f.h, 0) + GAP * (fps.length - 1);
  let y = snapDown(-h / 2);
  return fps.map((f) => { const t = y; y += f.h + GAP; return t; });
}

export const multiFlowLayout: LayoutEngine = (g) => {
  const causes = g.nodes.filter((x) => x.role === "cause");
  const event = g.nodes.find((x) => x.role === "event")!;
  const effects = g.nodes.filter((x) => x.role === "effect");

  const ef = footprint(event);
  const eventY = snapDown(-ef.h / 2);
  const eventCy = eventY + ef.h / 2;
  const gapTo = (fps: Footprint[], tops: number[]) =>
    Math.max(ZONE_GAP, snapUp(Math.max(...fps.map((f, i) => Math.abs(tops[i] + f.h / 2 - eventCy) + DOMINANCE - ef.w / 2 - f.w / 2))));

  const cFps = causes.map(footprint);
  const cTops = centredTops(cFps);
  const fFps = effects.map(footprint);
  const fTops = centredTops(fFps);

  const placed: PlacedNode[] = [];
  const put = (node: MapNode, x: number, y: number, f: Footprint) => placed.push({ node, x, y, w: f.w, h: f.h });
  causes.forEach((c, i) => put(c, -cFps[i].w, cTops[i], cFps[i]));
  const eventX = gapTo(cFps, cTops);
  put(event, eventX, eventY, ef);
  const effectsX = eventX + ef.w + gapTo(fFps, fTops);
  effects.forEach((e, i) => put(e, effectsX, fTops[i], fFps[i]));

  const edges: LayoutEdge[] = [
    ...causes.map((c): LayoutEdge => ({ from: c.id, to: event.id, label: relationLabel(g, c.id, event.id), gradient: "violet", bend: 0, arrow: "end" })),
    ...effects.map((e): LayoutEdge => ({ from: event.id, to: e.id, label: relationLabel(g, event.id, e.id), gradient: "emerald", bend: 0, arrow: "end" })),
  ];
  return { placed, edges, lines: [] };
};
