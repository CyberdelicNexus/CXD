// Text description of a rendered map, built only from the canvas elements and
// edges a user would see. The LLM judges read every arm through this one view,
// so no arm is advantaged by metadata the others lack (a graph's JSON states
// its mapType; a baseline has none). Pure: no I/O.
import type { CanvasEdge, CanvasElement, LineElement } from "@/types/canvas-elements";

const MAX_TEXT = 160;
/** A line end this close to an element's box counts as attached to it. */
const LINE_SNAP = 24;

const clean = (s: unknown) => (typeof s === "string" ? s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "");
const clip = (s: string) => (s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT - 1)}…` : s);

/** The visible text of an element, whatever its kind. */
export function elementText(el: CanvasElement): string {
  const e = el as unknown as Record<string, unknown>;
  const join = (...parts: unknown[]) => clip(parts.map(clean).filter(Boolean).join(" — "));
  switch (el.type) {
    case "freeform":
      return join(e.noteTitle, e.content, e.noteBody);
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

/** Element kind as a user would name it: the element type, plus the shape for shapes. */
function kindOf(el: CanvasElement): string {
  const e = el as unknown as Record<string, unknown>;
  if (el.type === "shape" && typeof e.shapeType === "string") return `shape:${e.shapeType}`;
  if (el.type === "freeform") return "card";
  return el.type;
}

const inside = (inner: CanvasElement, outer: CanvasElement) =>
  inner.x >= outer.x && inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;

function distanceToBox(p: { x: number; y: number }, el: CanvasElement): number {
  const dx = Math.max(el.x - p.x, 0, p.x - (el.x + el.width));
  const dy = Math.max(el.y - p.y, 0, p.y - (el.y + el.height));
  return Math.hypot(dx, dy);
}

/**
 * Elements (in reading order) with kind, text and position; which container
 * each sits in (declared containerId, else the smallest container enclosing
 * it); and every connection as "#a -> #b [label]". Line elements attached at
 * both ends are listed as undirected connections ("#a -- #b").
 */
export function describeRendered(elements: CanvasElement[], edges: CanvasEdge[]): string {
  const lines = elements.filter((e): e is LineElement => e.type === "line");
  const boxes = elements
    .filter((e) => e.type !== "line")
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const ref = new Map(boxes.map((e, i) => [e.id, `#${i + 1}`]));
  const containers = boxes.filter((e) => e.type === "container");

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
    return `${ref.get(el.id)} ${kindOf(el)}${text ? ` "${text}"` : ""} at (${Math.round(el.x)}, ${Math.round(el.y)}) ` +
      `${Math.round(el.width)}x${Math.round(el.height)}${parent ? ` in ${ref.get(parent.id)}` : ""}`;
  });

  const connections: string[] = [];
  for (const edge of edges) {
    const a = ref.get(edge.fromNodeId);
    const b = ref.get(edge.toNodeId);
    if (!a || !b) continue;
    const label = clean(edge.label?.text);
    connections.push(`${a} -> ${b}${label ? ` [${clip(label)}]` : ""}`);
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
    `Elements (${boxes.length}), top to bottom:`,
    ...elementLines,
    `Connections (${connections.length}):`,
    ...(connections.length ? connections : ["(none)"]),
    ...(loose ? [`Unattached decorative lines: ${loose}`] : []),
  ].join("\n");
}
