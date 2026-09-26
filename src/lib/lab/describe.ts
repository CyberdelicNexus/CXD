// Text description of a rendered map, built only from the canvas elements and
// edges a user would see. The LLM judges read every arm through this one view,
// so no arm is advantaged by metadata the others lack (a graph's JSON states
// its mapType; a baseline has none). It shows what the drawing shows: the
// legend, each element's tint and its meaning, elements drawn larger than
// their peers, and each connection's arrow, dash and weight. Pure: no I/O.
import type { CanvasEdge, CanvasElement, LineElement } from "@/types/canvas-elements";
import { HEADING_FONT_PX, isTitleElement, readLegend, tintOf } from "@/lib/maps/element-style";

const MAX_TEXT = 160;
/** A line end this close to an element's box counts as attached to it. */
const LINE_SNAP = 24;
/** An element whose area is at least this multiple of its kind's lower median reads as emphasised. */
const EMPHASIS_AREA = 1.4;
/** Kinds whose size carries emphasis (tables, text and containers size to their content instead). */
const SIZED_KINDS = new Set(["card", "task", "board", "experienceBlock", "link", "image"]);
const ARROWS: Record<string, string> = { end: "->", start: "<-", both: "<->", none: "--" };

const clean = (s: unknown) => (typeof s === "string" ? s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "");
const clip = (s: string) => (s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT - 1)}…` : s);

/** The visible text of an element, whatever its kind. */
export function elementText(el: CanvasElement): string {
  const e = el as unknown as Record<string, unknown>;
  const join = (...parts: unknown[]) => clip(parts.map(clean).filter(Boolean).join(" — "));
  switch (el.type) {
    case "freeform": {
      // render.ts overwrites content with the task's own label for tasks,
      // duplicating noteTitle (which already carries that label): only show
      // it when it actually differs. taskMetadata.assignee (render.ts's
      // styleNodes) is the only place a task's owner reaches the element, so
      // it must be surfaced here for elementFit's "owned actions in tasks".
      const meta = e.taskMetadata as { assignee?: unknown } | undefined;
      const content = e.content === e.noteTitle ? undefined : e.content;
      return join(e.noteTitle, content, e.noteBody, meta?.assignee);
    }
    case "text":
    case "shape":
      return join(e.content);
    case "board":
    case "experienceBlock":
      return join(e.title);
    case "container":
      return join(e.label, e.title);
    case "link":
      return join(e.title, e.url);
    case "image":
      return join(e.description, e.alt);
    case "table": {
      const cells = Array.isArray(e.cells) ? (e.cells as { text?: string }[][]) : [];
      return clip(cells.map((row) => (Array.isArray(row) ? row.map((c) => clean(c?.text)).join(" | ") : "")).join(" / "));
    }
    default:
      return join(e.content, e.title, e.label);
  }
}

/** Element kind as a user would name it: tasks and headings by name, shapes with their shape. */
export function elementKind(el: CanvasElement): string {
  if (el.type === "shape") return `shape:${el.shapeType}`;
  if (el.type === "freeform") return el.cardType === "task" ? "task" : "card";
  if (el.type === "text") return (el.style?.fontSize ?? 14) >= HEADING_FONT_PX ? "heading" : "text";
  return el.type;
}

/** Distinct element kinds on the canvas and the share of plain note cards (legend swatches, labels and the map's own title excluded). */
export function elementUsage(elements: CanvasElement[]): { distinctKinds: number; plainCardShare: number } {
  const legendIds = new Set<string>();
  readLegend(elements).forEach((l) => { legendIds.add(l.swatchId); legendIds.add(l.labelId); });
  const content = elements.filter((e) => e.type !== "line" && e.type !== "connector" && !legendIds.has(e.id) && !isTitleElement(e));
  if (content.length === 0) return { distinctKinds: 0, plainCardShare: 0 };
  const kinds = new Set<string>(content.map(elementKind));
  const cards = content.filter((e) => elementKind(e) === "card").length;
  return { distinctKinds: kinds.size, plainCardShare: cards / content.length };
}

const inside = (inner: CanvasElement, outer: CanvasElement) =>
  inner.x >= outer.x && inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;

function distanceToBox(p: { x: number; y: number }, el: CanvasElement): number {
  const dx = Math.max(el.x - p.x, 0, p.x - (el.x + el.width));
  const dy = Math.max(el.y - p.y, 0, p.y - (el.y + el.height));
  return Math.hypot(dx, dy);
}

/** Ids of elements drawn clearly larger than others of their kind. */
function emphasisedIds(boxes: CanvasElement[]): Set<string> {
  const groups = new Map<string, CanvasElement[]>();
  for (const el of boxes) {
    const k = elementKind(el);
    if (!SIZED_KINDS.has(k) && !k.startsWith("shape:")) continue;
    groups.set(k, [...(groups.get(k) ?? []), el]);
  }
  const out = new Set<string>();
  groups.forEach((els) => {
    if (els.length < 2) return;
    const areas = els.map((e) => e.width * e.height).sort((a, b) => a - b);
    const lowerMedian = areas[Math.floor((areas.length - 1) / 2)];
    els.forEach((e) => { if (e.width * e.height >= EMPHASIS_AREA * lowerMedian) out.add(e.id); });
  });
  return out;
}

/**
 * The legend (when there is one), then elements in reading order with kind,
 * text, tint meaning, emphasis and position; which container each sits in
 * (declared containerId, else the smallest container enclosing it); and every
 * connection as "#a -> #b [label] (dashed, strong)". Line elements attached at
 * both ends are listed as undirected connections ("#a -- #b"). renderMap's own
 * synthetic title element is excluded, the same as legend swatches and labels:
 * it is not a node the graph asked for, so it must not read as a phantom
 * heading.
 */
export function describeRendered(elements: CanvasElement[], edges: CanvasEdge[]): string {
  const legend = readLegend(elements);
  const legendIds = new Set<string>();
  legend.forEach((l) => { legendIds.add(l.swatchId); legendIds.add(l.labelId); });
  const meaningOf = new Map<string, string>(legend.map((l): [string, string] => [l.tint, l.meaning]));

  const lines = elements.filter((e): e is LineElement => e.type === "line");
  const boxes = elements
    .filter((e) => e.type !== "line" && !legendIds.has(e.id) && !isTitleElement(e))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const ref = new Map(boxes.map((e, i) => [e.id, `#${i + 1}`]));
  const containers = boxes.filter((e) => e.type === "container");
  const emphasised = emphasisedIds(boxes);

  const parentOf = (el: CanvasElement): CanvasElement | undefined => {
    if (el.containerId) {
      const declared = boxes.find((b) => b.id === el.containerId);
      if (declared) return declared;
    }
    return containers
      .filter((c) => c.id !== el.id && inside(el, c))
      .sort((a, b) => a.width * a.height - b.width * b.height)[0];
  };

  const elementLines = boxes.map((el) => {
    const parent = parentOf(el);
    const text = elementText(el);
    const tint = tintOf(el);
    const meaning = tint ? meaningOf.get(tint) : undefined;
    return `${ref.get(el.id)} ${elementKind(el)}${text ? ` "${text}"` : ""}` +
      `${meaning !== undefined ? ` [${tint} = ${meaning}]` : ""}${emphasised.has(el.id) ? " emphasised" : ""} ` +
      `at (${Math.round(el.x)}, ${Math.round(el.y)}) ${Math.round(el.width)}x${Math.round(el.height)}${parent ? ` in ${ref.get(parent.id)}` : ""}`;
  });

  const connections: string[] = [];
  for (const edge of edges) {
    const a = ref.get(edge.fromNodeId);
    const b = ref.get(edge.toNodeId);
    if (!a || !b) continue;
    const label = clean(edge.label?.text);
    const arrow = ARROWS[edge.style?.arrowStyle ?? "end"] ?? "->";
    const traits = [
      edge.style?.lineStyle && edge.style.lineStyle !== "solid" ? edge.style.lineStyle : "",
      (edge.style?.thickness ?? 2) >= 4 ? "strong" : "",
    ].filter(Boolean);
    connections.push(`${a} ${arrow} ${b}${label ? ` [${clip(label)}]` : ""}${traits.length ? ` (${traits.join(", ")})` : ""}`);
  }
  let loose = 0;
  for (const line of lines) {
    const nearest = (p: { x: number; y: number }) => {
      let best: CanvasElement | undefined;
      let bestD = LINE_SNAP;
      for (const el of boxes) {
        const d = distanceToBox(p, el);
        if (d <= bestD) { best = el; bestD = d; }
      }
      return best;
    };
    const a = nearest(line.start);
    const b = nearest(line.end);
    if (a && b && a.id !== b.id) connections.push(`${ref.get(a.id)} -- ${ref.get(b.id)}`);
    else loose++;
  }

  return [
    ...(legend.length ? [`Legend: ${legend.map((l) => `${l.tint} = ${l.meaning}`).join("; ")}`] : []),
    `Elements (${boxes.length}), top to bottom:`,
    ...elementLines,
    `Connections (${connections.length}):`,
    ...(connections.length ? connections : ["(none)"]),
    ...(connections.length ? ["Key: -> one way, <- one way back, <-> both ways, -- no arrow; (dashed) or (dotted) line, (strong) thick line."] : []),
    ...(loose ? [`Unattached decorative lines: ${loose}`] : []),
  ].join("\n");
}
