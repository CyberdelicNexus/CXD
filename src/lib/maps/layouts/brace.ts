// Brace: whole on the left, a brace opening onto the parts column, and a
// smaller brace per part opening onto its subparts. CXD has no brace element,
// so each brace is two bent line segments meeting at a point (spec §4).
import {
  columnSize, footprint, GAP, placeAt, snap, snapDown, stackColumn, tintAt, ZONE_GAP,
  type LayoutEngine, type LayoutLine, type PlacedNode, type Tint,
} from "./shared";

function braceLines(pointX: number, armX: number, top: number, bottom: number, gradient: Tint): LayoutLine[] {
  const mid = snap((top + bottom) / 2);
  return [
    { start: { x: armX, y: top }, end: { x: pointX, y: mid }, bend: { x: pointX, y: top }, gradient },
    { start: { x: pointX, y: mid }, end: { x: armX, y: bottom }, bend: { x: pointX, y: bottom }, gradient },
  ];
}

export const braceLayout: LayoutEngine = (g) => {
  const whole = g.nodes.find((x) => x.role === "whole")!;
  const parts = g.nodes.filter((x) => x.role === "part");
  const wholeFp = footprint(whole);
  const partsX = wholeFp.w + ZONE_GAP;
  const subsX = partsX + Math.max(...parts.map((p) => footprint(p).w)) + ZONE_GAP;

  const groups = parts.map((part) => {
    const subs = g.nodes.filter((x) => x.role === "subpart" && x.parent === part.id);
    const pf = footprint(part);
    const sc = columnSize(subs);
    return { part, subs, pf, sc, h: Math.max(pf.h, sc.h) };
  });
  const totalH = groups.reduce((s, gr) => s + gr.h, 0) + GAP * (groups.length - 1);
  const top = snapDown(-totalH / 2);

  const placed: PlacedNode[] = [placeAt(whole, 0, snapDown(-wholeFp.h / 2))];
  const lines: LayoutLine[] = [];
  let y = top;
  groups.forEach((gr, i) => {
    placed.push(placeAt(gr.part, partsX, y + snapDown((gr.h - gr.pf.h) / 2)));
    if (gr.subs.length > 0) {
      const subTop = y + snapDown((gr.h - gr.sc.h) / 2);
      placed.push(...stackColumn(gr.subs, subsX, subTop));
      lines.push(...braceLines(partsX + gr.pf.w + 40, subsX - 40, subTop, subTop + gr.sc.h, tintAt(i + 1)));
    }
    y += gr.h + GAP;
  });
  lines.push(...braceLines(wholeFp.w + 40, partsX - 40, top, top + totalH, "violet"));
  return { placed, edges: [], lines };
};
