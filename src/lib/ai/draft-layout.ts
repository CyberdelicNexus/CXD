/**
 * Deterministic layout pass for AI-generated canvas elements ("Draft on
 * Canvas"). The model (element-generation.ts / generateElementsSchema)
 * returns container/text/shape elements with x/y coordinates it invented
 * while reasoning about structure in a JSON response — those coordinates
 * are not spatially trustworthy (the model has no notion of real pixel
 * geometry), so inserting them as-is produces an overlapping pile. This
 * module throws the model's coordinates away and recomputes real,
 * non-overlapping positions from the *structure* it expressed instead:
 * which elements are containers, and which elements reference them via
 * `containerId` (see generatedToCanvasElements in element-generation.ts).
 *
 * Unlike the wizard's freeform notes and boards (see framing-to-canvas.ts),
 * container/text/shape elements have NO hard CSS floor in canvas-element.tsx
 * — stored width/height render as-is (see the `style={{ width, height }}`
 * block: only `type === 'freeform'` gets `minHeight`/`minWidth`). So instead
 * of measuring a rendered DOM floor, "real minimum size" here means the
 * sane ranges CANVAS_GENERATION_GUIDE already asks the model for (containers
 * 340-480w, text 280-440w, shapes 40-80px) — and, for text, a height
 * estimated from actual content length so a long note isn't clipped by a
 * too-short stored height.
 *
 * Shape: each container + its children becomes one GROUP (a stacked column
 * inside the frame); every other top-level element is a single-element group.
 * Groups joined by connectors are arranged by the shape of their graph (see
 * layoutConnected: loop, radial mind map, or left-to-right flow); the rest are
 * shelf-packed left-to-right with generous gaps, wrapping into new rows.
 */
import type { CanvasElement, ContainerElement, TextElement, CanvasEdge } from '@/types/canvas-elements';
import { realBounds } from '@/lib/canvas-layout-rules';

// ─── Tunables ──────────────────────────────────────────────────────────
// Kept in the ranges CANVAS_GENERATION_GUIDE (element-generation.ts) already
// asks the model for, so a well-behaved generation is left looking close to
// its own intent — only spacing/overlap is corrected, not the vocabulary.
const CONTAINER_PAD_X = 24;
const CONTAINER_HEADER_H = 56; // guide: "first 56px below a container's top edge is reserved for its header"
const CONTAINER_PAD_BOTTOM = 24;
const CHILD_GAP = 20; // vertical gap between stacked rows inside a container
const SHAPE_ROW_GAP = 12; // horizontal gap between shapes sharing a row

const MIN_CONTAINER_W = 340;
const MAX_CONTAINER_W = 480;
const MIN_CONTAINER_CONTENT_W = MIN_CONTAINER_W - 2 * CONTAINER_PAD_X;
const MAX_CONTAINER_CONTENT_W = MAX_CONTAINER_W - 2 * CONTAINER_PAD_X;
const MIN_CONTAINER_H = 260;
const MAX_EMPTY_CONTAINER_H = 340;

const MIN_TEXT_W = 280;
const MAX_TEXT_W = 440;
const MIN_TEXT_H = 40;
const MAX_TEXT_H = 400; // sanity cap so one runaway block can't blow out the whole layout

// Shapes are diagram nodes (pills, detail rectangles, decision diamonds), not
// just 40-80px accents, so the model's stated size is kept within node range.
const SHAPE_W_MIN = 40;
const SHAPE_W_MAX = 480;
const SHAPE_H_MIN = 40;
const SHAPE_H_MAX = 300;
// Tables, note cards and portals keep their rendered footprint; a frame may
// grow past the usual 480px to hold one.
const MAX_WIDE_CONTENT_W = 900;
const FRAME_PAD_TOP = 24; // an untitled frame has no header band to clear

const FLOW_COL_GAP = 120; // room for a connector and its label between stages
const FLOW_ROW_GAP = 60;
const FLOW_WRAP_AFTER = 6; // columns in a row before a long flow snakes onto the next
const FLOW_WRAP_GAP = 140; // between the rows of a snaked flow
const LOOP_COL_GAP = 140;
const LOOP_ROW_GAP_MIN = 120;
const HEADER_GAP = 48; // between the floating title block and the structure

const GROUP_GAP = 64; // between top-level groups — within the requested 40-90px range
const MAX_ROW_WIDTH = 1700; // wrap point for the shelf-packed flow-grid (~3 containers wide)

const MINDMAP_GAP = 90; // clearance between mind-map node bounding circles

const clamp = (v: number, min: number, max: number) =>
  Number.isFinite(v) ? Math.min(Math.max(v, min), max) : min;

/**
 * Rough rendered line count for pre-wrap text at a given pixel width and
 * fontSize (element-generation.ts always uses 14), so a text element is
 * tall enough to actually show its content instead of getting clipped
 * (canvas-element.tsx text rendering has no auto-grow — stored height IS
 * the rendered height).
 */
function estimateTextHeight(content: string, width: number, fontSize = 14): number {
  if (fontSize !== 14) return estimateStyledTextHeight(content, width, fontSize);
  const avgCharW = fontSize * 0.55;
  const charsPerLine = Math.max(10, Math.floor(width / avgCharW));
  const rawLines = (content || '').split('\n');
  let lines = 0;
  for (const line of rawLines) {
    lines += Math.max(1, Math.ceil(line.length / charsPerLine));
  }
  const lineHeight = fontSize * 1.3;
  return Math.ceil(Math.max(1, lines) * lineHeight + 16);
}

/** Styled (role) text: mirrors estimateTextHeight in element-generation.ts. */
function estimateStyledTextHeight(content: string, width: number, fontSize: number): number {
  const perLine = Math.max(4, Math.floor((width - 8) / (fontSize * 0.62)));
  let lines = 0;
  for (const line of (content || '').split('\n')) lines += Math.max(1, Math.ceil(line.length / perLine));
  return Math.ceil(Math.max(1, lines) * fontSize * 1.3) + 8;
}

const fontSizeOf = (el: CanvasElement): number =>
  (el as unknown as { style?: { fontSize?: number } }).style?.fontSize || 14;

/** Role-styled text (title/heading/label/caption) keeps the box the model sized for it. */
const isStyledText = (el: CanvasElement): boolean => {
  if (el.type !== 'text') return false;
  const s = (el as TextElement).style;
  return !!s && (fontSizeOf(el) !== 14 || s.fontWeight === 'bold');
};

/** The size an element should occupy in the layout, by kind. */
function naturalSize(el: CanvasElement, maxTextW = MAX_TEXT_W): { width: number; height: number } {
  if (el.type === 'shape') {
    return {
      width: clamp(el.width, SHAPE_W_MIN, SHAPE_W_MAX),
      height: clamp(el.height, SHAPE_H_MIN, SHAPE_H_MAX),
    };
  }
  if (el.type === 'text') {
    const width = isStyledText(el) ? clamp(el.width, 60, 900) : clamp(el.width, MIN_TEXT_W, maxTextW);
    const content = (el as TextElement).content || '';
    const estimated = estimateTextHeight(content, width, fontSizeOf(el));
    return { width, height: isStyledText(el) ? estimated : Math.max(clamp(el.height, MIN_TEXT_H, MAX_TEXT_H), estimated) };
  }
  const b = realBounds(el);
  return b ? { width: b.w, height: b.h } : { width: el.width, height: el.height };
}

interface LayoutGroup {
  /** Members with LOCAL coordinates relative to the group's own (0,0) top-left. */
  members: CanvasElement[];
  width: number;
  height: number;
  /** Element id that represents this group (container id, or the loose element's id). */
  repId: string;
  /** Ids of every element in this group (used to map edge endpoints to groups). */
  memberIds: string[];
}

/** Container + its children, laid out as one stacked column inside the container. */
function layoutContainerGroup(container: ContainerElement, children: CanvasElement[]): LayoutGroup {
  if (children.length === 0) {
    const width = clamp(container.width, MIN_CONTAINER_W, MAX_CONTAINER_W);
    const height = clamp(container.height, MIN_CONTAINER_H, MAX_EMPTY_CONTAINER_H);
    return {
      members: [{ ...container, x: 0, y: 0, width, height }],
      width,
      height,
      repId: container.id,
      memberIds: [container.id],
    };
  }

  // Content width: wide enough for the widest child, within the container's sane range.
  let naturalMax = MIN_CONTAINER_CONTENT_W;
  let wideMax = 0;
  for (const child of children) {
    const natural = naturalSize(child).width;
    if (child.type === 'text') naturalMax = Math.max(naturalMax, Math.min(natural, MAX_TEXT_W));
    else wideMax = Math.max(wideMax, natural);
  }
  const contentW = Math.max(
    clamp(naturalMax, MIN_CONTAINER_CONTENT_W, MAX_CONTAINER_CONTENT_W),
    Math.min(wideMax, MAX_WIDE_CONTENT_W),
  );

  // Row-build: consecutive shapes share a wrapping horizontal row (small
  // accents shouldn't each eat a full row); any other kind (text) gets its
  // own full-width row so its content has room to breathe.
  type RowItem = { el: CanvasElement; width: number; height: number };
  const rows: RowItem[][] = [];
  let pendingShapeRow: RowItem[] = [];

  const flushShapeRow = () => {
    if (pendingShapeRow.length > 0) {
      rows.push(pendingShapeRow);
      pendingShapeRow = [];
    }
  };
  const pendingRowWidth = () =>
    pendingShapeRow.reduce((sum, it, i) => sum + it.width + (i > 0 ? SHAPE_ROW_GAP : 0), 0);

  for (const child of children) {
    if (child.type === 'shape') {
      const { width: w, height: h } = naturalSize(child);
      if (pendingShapeRow.length > 0 && pendingRowWidth() + SHAPE_ROW_GAP + w > contentW) {
        flushShapeRow();
      }
      pendingShapeRow.push({ el: child, width: w, height: h });
    } else if (child.type === 'text') {
      flushShapeRow();
      const w = contentW;
      const content = (child as TextElement).content || '';
      const estimated = estimateTextHeight(content, w, fontSizeOf(child));
      const h = isStyledText(child) ? estimated : Math.max(clamp(child.height, MIN_TEXT_H, MAX_TEXT_H), estimated);
      rows.push([{ el: child, width: w, height: h }]);
    } else {
      flushShapeRow();
      const { width: w, height: h } = naturalSize(child);
      rows.push([{ el: child, width: Math.min(w, contentW), height: h }]);
    }
  }
  flushShapeRow();

  const localMembers: CanvasElement[] = [];
  let cursorY = container.hideLabel ? FRAME_PAD_TOP : CONTAINER_HEADER_H;
  for (const row of rows) {
    const rowHeight = Math.max(...row.map((it) => it.height));
    let cursorX = CONTAINER_PAD_X;
    for (const it of row) {
      localMembers.push({ ...it.el, x: cursorX, y: cursorY, width: it.width, height: it.height });
      cursorX += it.width + SHAPE_ROW_GAP;
    }
    cursorY += rowHeight + CHILD_GAP;
  }
  const contentHeight = cursorY - CHILD_GAP + CONTAINER_PAD_BOTTOM;

  const width = contentW + 2 * CONTAINER_PAD_X;
  const height = Math.max(MIN_CONTAINER_H, contentHeight);
  const localContainer: ContainerElement = { ...container, x: 0, y: 0, width, height };

  return {
    members: [localContainer, ...localMembers],
    width,
    height,
    repId: container.id,
    memberIds: [container.id, ...localMembers.map((m) => m.id)],
  };
}

/** A top-level text/shape with no container — its own single-element group. */
function layoutLooseElement(el: CanvasElement): LayoutGroup {
  const { width, height } = naturalSize(el);
  // Elements with a CSS floor (note cards, portals) keep their stored size and
  // simply occupy their rendered footprint in the layout.
  const sized = el.type === 'shape' || el.type === 'text' ? { ...el, width, height } : { ...el };
  return { members: [{ ...sized, x: 0, y: 0 } as CanvasElement], width, height, repId: el.id, memberIds: [el.id] };
}

/** Radius of the circle that circumscribes a w×h box (box is inscribed). */
function boundingRadius(w: number, h: number): number {
  return 0.5 * Math.sqrt(w * w + h * h);
}

/**
 * Lay a connected batch out as a radial mind map: the most-connected group is
 * the hub at the origin, and every other group is placed on a ring by its BFS
 * depth from the hub, ordered so children fan out near their parent's angle.
 *
 * Non-overlap is guaranteed geometrically: each group is modeled as the circle
 * that circumscribes its bounding box, and both the ring radii (radial
 * clearance from the previous ring) and the angular spacing within a ring are
 * sized so those circles are always disjoint — disjoint circles ⇒ disjoint
 * boxes. Container groups keep their internal stacked layout untouched (real
 * size rules from layoutContainerGroup); only the whole group is translated.
 *
 * Returns null when the edges express no usable connectivity, so the caller
 * can fall back to the shelf-packed grid.
 */
function layoutMindMap(
  groups: LayoutGroup[],
  edges: CanvasEdge[],
  groupIdByElementId: Map<string, string>,
): CanvasElement[] | null {
  const groupByRep = new Map(groups.map((g) => [g.repId, g]));

  // Group-level adjacency (undirected structure; out-degree breaks hub ties).
  const adj = new Map<string, Set<string>>();
  for (const g of groups) adj.set(g.repId, new Set());
  const outDeg = new Map<string, number>();
  for (const e of edges) {
    const fr = groupIdByElementId.get(e.fromNodeId);
    const to = groupIdByElementId.get(e.toNodeId);
    if (!fr || !to || fr === to) continue;
    adj.get(fr)!.add(to);
    adj.get(to)!.add(fr);
    outDeg.set(fr, (outDeg.get(fr) || 0) + 1);
  }

  // Hub = most-connected group (tie → highest out-degree, then first seen).
  let hub = groups[0].repId;
  let bestDeg = -1;
  let bestOut = -1;
  for (const g of groups) {
    const deg = adj.get(g.repId)!.size;
    const out = outDeg.get(g.repId) || 0;
    if (deg > bestDeg || (deg === bestDeg && out > bestOut)) {
      bestDeg = deg;
      bestOut = out;
      hub = g.repId;
    }
  }
  if (bestDeg <= 0) return null; // no connectivity → let the grid handle it

  // BFS depth from the hub.
  const depth = new Map<string, number>([[hub, 0]]);
  const queue = [hub];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const nb of Array.from(adj.get(cur)!)) {
      if (!depth.has(nb)) {
        depth.set(nb, depth.get(cur)! + 1);
        queue.push(nb);
      }
    }
  }
  // Attach any disconnected groups as extra depth-1 branches so none are lost.
  for (const g of groups) {
    if (!depth.has(g.repId)) {
      depth.set(g.repId, 1);
      adj.get(hub)!.add(g.repId);
      adj.get(g.repId)!.add(hub);
    }
  }

  const maxDepth = Math.max(...Array.from(depth.values()));
  const byDepth: string[][] = Array.from({ length: maxDepth + 1 }, () => []);
  for (const [rep, d] of Array.from(depth.entries())) byDepth[d].push(rep);

  const maxRadiusAt = (reps: string[]) =>
    reps.reduce((m, r) => {
      const g = groupByRep.get(r)!;
      return Math.max(m, boundingRadius(g.width, g.height));
    }, 0);

  const angleOf = new Map<string, number>([[hub, 0]]);
  // Angle of the shallowest already-placed neighbor, so a node sits near its parent.
  const parentAngle = (rep: string): number => {
    const d = depth.get(rep)!;
    if (d === 0) return 0;
    let best = 0;
    let bestD = Infinity;
    for (const nb of Array.from(adj.get(rep)!)) {
      const nd = depth.get(nb) ?? Infinity;
      if (nd < d && nd < bestD && angleOf.has(nb)) {
        bestD = nd;
        best = angleOf.get(nb)!;
      }
    }
    return best;
  };

  const ringR: number[] = [0];
  for (let d = 1; d <= maxDepth; d++) {
    const reps = byDepth[d];
    const n = reps.length;
    const maxRThis = maxRadiusAt(reps);
    const maxRPrev = maxRadiusAt(byDepth[d - 1]);
    // Radial clearance from the previous ring.
    const rRadial = ringR[d - 1] + maxRPrev + maxRThis + MINDMAP_GAP;
    // Angular clearance so same-ring neighbors' circles never touch.
    const rWithin = n > 1 ? (2 * maxRThis + MINDMAP_GAP) / (2 * Math.sin(Math.PI / n)) : 0;
    ringR[d] = Math.max(rRadial, rWithin);
    // Cluster children near their parent, then spread evenly around the ring.
    reps.sort((a, b) => parentAngle(a) - parentAngle(b));
    for (let i = 0; i < n; i++) {
      angleOf.set(reps[i], (2 * Math.PI * i) / n);
    }
  }

  const placed: CanvasElement[] = [];
  for (const g of groups) {
    const d = depth.get(g.repId)!;
    const theta = angleOf.get(g.repId) ?? 0;
    const cx = ringR[d] * Math.cos(theta);
    const cy = ringR[d] * Math.sin(theta);
    const offX = cx - g.width / 2;
    const offY = cy - g.height / 2;
    for (const m of g.members) {
      placed.push({ ...m, x: m.x + offX, y: m.y + offY });
    }
  }
  return placed;
}

// ─── Connected structures: loop, flow, mind map ─────────────────────────

interface Structure {
  elements: CanvasElement[];
  width: number;
  height: number;
  /** Free groups this structure placed itself (a loop's centre text). */
  consumed: Set<string>;
}

interface Link { from: string; to: string }

const placeGroup = (g: LayoutGroup, x: number, y: number): CanvasElement[] =>
  g.members.map((m) => ({ ...m, x: m.x + x, y: m.y + y }));

const isFloatingText = (g: LayoutGroup): boolean => g.members.length === 1 && g.members[0].type === 'text';

/**
 * A closed ring (every node has exactly two neighbours, one component) laid
 * out clockwise in two rows: the first half left to right along the top, the
 * rest right to left along the bottom. Unconnected floating text is centred in
 * the middle of the ring, where a loop's name belongs.
 */
function layoutLoop(nodes: LayoutGroup[], links: Link[], freeTexts: LayoutGroup[]): Structure | null {
  const n = nodes.length;
  if (n < 3) return null;
  const neighbours = new Map<string, Set<string>>(nodes.map((g) => [g.repId, new Set<string>()]));
  const next = new Map<string, string[]>(nodes.map((g) => [g.repId, []]));
  for (const l of links) {
    neighbours.get(l.from)!.add(l.to);
    neighbours.get(l.to)!.add(l.from);
    next.get(l.from)!.push(l.to);
  }
  if (nodes.some((g) => neighbours.get(g.repId)!.size !== 2)) return null;

  // Walk the ring in connector direction so the layout reads clockwise.
  const order: string[] = [nodes[0].repId];
  const seen = new Set(order);
  for (let cur = order[0]; ; ) {
    const step =
      next.get(cur)!.find((id) => !seen.has(id)) ??
      Array.from(neighbours.get(cur)!).find((id) => !seen.has(id));
    if (!step) break;
    order.push(step);
    seen.add(step);
    cur = step;
  }
  if (order.length !== n) return null; // several separate rings: not one loop

  const byRep = new Map(nodes.map((g) => [g.repId, g]));
  const cols = Math.ceil(n / 2);
  const bottom = n - cols;
  const colW = Math.max(...nodes.map((g) => g.width));
  const rowH = Math.max(...nodes.map((g) => g.height));
  const pitch = colW + LOOP_COL_GAP;
  const totalW = cols * colW + (cols - 1) * LOOP_COL_GAP;

  // Centre block only when the ring has an open middle (a full bottom row).
  const centre = bottom === cols && n >= 4 ? freeTexts : [];
  const centreW = Math.min(totalW - 80, 640);
  const centred = centre.map((g) => {
    const el = g.members[0] as TextElement;
    return { g, el, height: estimateTextHeight(el.content || '', centreW, fontSizeOf(el)) };
  });
  const centreH = centred.reduce((sum, c, i) => sum + c.height + (i > 0 ? 8 : 0), 0);
  const rowGap = Math.max(LOOP_ROW_GAP_MIN, centreH > 0 ? centreH + 80 : 0);

  const elements: CanvasElement[] = [];
  order.forEach((rep, i) => {
    const g = byRep.get(rep)!;
    if (i < cols) {
      elements.push(...placeGroup(g, i * pitch + (colW - g.width) / 2, (rowH - g.height) / 2));
    } else {
      const j = i - cols;
      const startX = (totalW - (bottom * colW + (bottom - 1) * LOOP_COL_GAP)) / 2;
      elements.push(
        ...placeGroup(g, startX + (bottom - 1 - j) * pitch + (colW - g.width) / 2, rowH + rowGap + (rowH - g.height) / 2),
      );
    }
  });

  let cursor = rowH + (rowGap - centreH) / 2;
  for (const c of centred) {
    elements.push({ ...c.el, x: (totalW - centreW) / 2, y: cursor, width: centreW, height: c.height, textAlign: 'center' });
    cursor += c.height + 8;
  }

  return { elements, width: totalW, height: rowH * 2 + rowGap, consumed: new Set(centre.map((g) => g.repId)) };
}

/**
 * Layered flow in connector direction, built so every connector stays short:
 *
 * - Cycles are broken first (a depth-first pass drops the connector that
 *   closes each one from the LAYERING only; it is still drawn). Without this a
 *   single "not ready -> try again" loop stalls the layering and strands
 *   every later stage in the first column.
 * - The longest path is the SPINE and sits on one straight axis. Everything
 *   else hangs off it: other nodes in a column alternate below and above, and
 *   a leaf (a stage's detail, a dead-end outcome, a retry step) sits with its
 *   parent as a SATELLITE instead of taking a column of its own.
 * - Past FLOW_WRAP_AFTER columns the flow snakes: rows alternate direction so
 *   the step from one row to the next is a short vertical connector, not a
 *   line dragged back across the whole diagram.
 */
function layoutFlow(nodes: LayoutGroup[], links: Link[]): Structure {
  const byRep = new Map(nodes.map((g) => [g.repId, g]));
  const ids = nodes.map((g) => g.repId);
  const rawSucc = new Map<string, string[]>(ids.map((id) => [id, []]));
  const rawPred = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const l of links) {
    rawSucc.get(l.from)!.push(l.to);
    rawPred.get(l.to)!.push(l.from);
  }

  // 1. Break cycles: keep every connector except the ones that point back at a
  //    node still on the depth-first stack.
  const succ = new Map<string, string[]>(ids.map((id) => [id, []]));
  const pred = new Map<string, string[]>(ids.map((id) => [id, []]));
  const state = new Map<string, 1 | 2>();
  const visit = (id: string) => {
    state.set(id, 1);
    for (const s of rawSucc.get(id)!) {
      if (state.get(s) === 1) continue; // closes a cycle
      succ.get(id)!.push(s);
      pred.get(s)!.push(id);
      if (!state.has(s)) visit(s);
    }
    state.set(id, 2);
  };
  for (const id of ids) if (rawPred.get(id)!.length === 0 && !state.has(id)) visit(id);
  for (const id of ids) if (!state.has(id)) visit(id);

  // 2. Satellites: leaves whose parent carries on without them.
  const isLeaf = (id: string) => succ.get(id)!.length === 0 && pred.get(id)!.length === 1;
  const satelliteOf = new Map<string, string>();
  for (const id of ids) {
    const kids = succ.get(id)!;
    if (!kids.some((k) => succ.get(k)!.length > 0)) continue; // the chain does not continue past here
    for (const k of kids) if (isLeaf(k)) satelliteOf.set(k, id);
  }
  if (satelliteOf.size > 0) {
    // The chain's last stage has only its detail to point at; keep it consistent.
    for (const id of ids) {
      const kids = succ.get(id)!;
      if (kids.length === 1 && isLeaf(kids[0]) && pred.get(id)!.length > 0) satelliteOf.set(kids[0], id);
    }
  }
  const satellites = (id: string) => nodes.filter((g) => satelliteOf.get(g.repId) === id);

  // 3. Longest-path layering over the main nodes (the graph is now acyclic).
  const main = ids.filter((id) => !satelliteOf.has(id));
  const mainSet = new Set(main);
  const mainSucc = (id: string) => succ.get(id)!.filter((s) => mainSet.has(s));
  const mainPred = (id: string) => pred.get(id)!.filter((p) => mainSet.has(p));
  const indeg = new Map(main.map((id) => [id, mainPred(id).length]));
  const layer = new Map<string, number>();
  const topo: string[] = [];
  const queue = main.filter((id) => indeg.get(id) === 0);
  for (const id of queue) layer.set(id, 0);
  while (queue.length) {
    const cur = queue.shift()!;
    topo.push(cur);
    for (const s of mainSucc(cur)) {
      layer.set(s, Math.max(layer.get(s) ?? 0, layer.get(cur)! + 1));
      indeg.set(s, indeg.get(s)! - 1);
      if (indeg.get(s) === 0) queue.push(s);
    }
  }

  // 4. Spine: the longest path, followed from the start that reaches furthest.
  const reach = new Map<string, number>();
  for (const id of [...topo].reverse()) {
    reach.set(id, 1 + Math.max(0, ...mainSucc(id).map((s) => reach.get(s) ?? 0)));
  }
  const spine = new Set<string>();
  const furthest = (candidates: string[]) =>
    candidates.reduce<string | undefined>((best, id) => (!best || reach.get(id)! > reach.get(best)! ? id : best), undefined);
  for (let cur = furthest(main.filter((id) => layer.get(id) === 0)); cur; cur = furthest(mainSucc(cur))) spine.add(cur);

  const layerCount = Math.max(...main.map((id) => layer.get(id)!)) + 1;
  const layers: string[][] = Array.from({ length: layerCount }, () => []);
  for (const id of main) layers[layer.get(id)!].push(id);
  // Order each layer by where its predecessors sit, so connectors cross less.
  const slot = new Map<string, number>();
  layers.forEach((layerIds, li) => {
    if (li > 0) {
      const bary = (id: string) => {
        const ps = mainPred(id).filter((p) => slot.has(p));
        return ps.length ? ps.reduce((s, p) => s + slot.get(p)!, 0) / ps.length : Number.MAX_SAFE_INTEGER;
      };
      const original = new Map(layerIds.map((id, i) => [id, i]));
      layerIds.sort((a, b) => bary(a) - bary(b) || original.get(a)! - original.get(b)!);
    }
    layerIds.forEach((id, i) => slot.set(id, i));
  });

  // 5. Columns, measured from the axis (y = 0 is the spine's centre line).
  const columns = layers.map((layerIds) => {
    const axisId = layerIds.find((id) => spine.has(id)) ?? layerIds[0];
    const axis = byRep.get(axisId)!;
    const items: { g: LayoutGroup; y: number }[] = [{ g: axis, y: -axis.height / 2 }];
    let below = axis.height / 2 + FLOW_ROW_GAP;
    let above = -(axis.height / 2 + FLOW_ROW_GAP);
    const stack = (g: LayoutGroup, down: boolean) => {
      if (down) {
        items.push({ g, y: below });
        below += g.height + FLOW_ROW_GAP;
      } else {
        items.push({ g, y: above - g.height });
        above -= g.height + FLOW_ROW_GAP;
      }
    };
    const axisSatellites = satellites(axisId);
    for (const s of axisSatellites) stack(s, true);
    // Branches alternate sides, starting opposite the axis node's own satellites.
    let down = axisSatellites.length === 0;
    for (const id of layerIds) {
      if (id === axisId) continue;
      stack(byRep.get(id)!, down);
      for (const s of satellites(id)) stack(s, down);
      down = !down;
    }
    return {
      items,
      width: Math.max(...items.map((it) => it.g.width)),
      up: -Math.min(...items.map((it) => it.y)),
      down: Math.max(...items.map((it) => it.y + it.g.height)),
    };
  });

  // 6. Place columns, snaking into rows when the flow is long.
  //    The connector that turns from one row to the next runs vertically
  //    through the turn columns, so a branch stacked there would sit on top of
  //    it: among the nearby row lengths, pick the one whose turns land on
  //    plain single-node columns.
  let perRow = layerCount;
  if (layerCount > FLOW_WRAP_AFTER) {
    const turnCost = (n: number) => {
      let cost = 0;
      for (let end = n; end < layerCount; end += n) {
        cost += (columns[end - 1].items.length > 1 ? 1 : 0) + (columns[end].items.length > 1 ? 1 : 0);
      }
      return cost;
    };
    const balanced = Math.ceil(layerCount / Math.ceil(layerCount / FLOW_WRAP_AFTER));
    perRow = [balanced, balanced - 1, balanced + 1, balanced - 2]
      .filter((n) => n >= 3)
      .reduce((best, n) => (turnCost(n) < turnCost(best) ? n : best));
  }
  const rowCount = Math.ceil(layerCount / perRow);
  // At a turn the connector leaves downward (row end) or arrives from above
  // (row start), so that column's branches are mirrored to the free side.
  columns.forEach((col, i) => {
    const leavesDown = (i + 1) % perRow === 0 && i < layerCount - 1;
    const arrivesFromAbove = i % perRow === 0 && i > 0;
    const hasBelow = col.items.some((it) => it.y > 0);
    const hasAbove = col.items.some((it) => it.y + it.g.height < 0);
    if ((leavesDown && hasBelow && !hasAbove) || (arrivesFromAbove && hasAbove && !hasBelow)) {
      for (const it of col.items) it.y = -(it.y + it.g.height);
      [col.up, col.down] = [col.down, col.up];
    }
  });
  const slotW = Math.max(...columns.map((c) => c.width));
  const elements: CanvasElement[] = [];
  let axisY = 0;
  let width = 0;
  let height = 0;
  let cursorX = 0;
  for (let r = 0; r < rowCount; r++) {
    const row = columns.slice(r * perRow, (r + 1) * perRow);
    const up = Math.max(...row.map((c) => c.up));
    const down = Math.max(...row.map((c) => c.down));
    axisY = r === 0 ? up : height + FLOW_WRAP_GAP + up;
    row.forEach((col, k) => {
      // A single row packs columns by their own width; a snake needs uniform
      // slots so each row's columns line up under the previous row's.
      const colX = rowCount === 1 ? cursorX : (r % 2 === 0 ? k : perRow - 1 - k) * (slotW + FLOW_COL_GAP);
      const colW = rowCount === 1 ? col.width : slotW;
      for (const it of col.items) {
        elements.push(...placeGroup(it.g, colX + (colW - it.g.width) / 2, axisY + it.y));
      }
      cursorX += col.width + FLOW_COL_GAP;
      width = Math.max(width, colX + colW);
    });
    height = axisY + down;
  }
  return { elements, width, height, consumed: new Set() };
}
/**
 * Arrange everything the connectors touch by the shape of the graph, then put
 * the rest around it: floating text becomes the title block above the
 * structure, anything else (frames, tables, notes) shelf-packs beneath it.
 * Returns null when the connectors join fewer than two groups.
 */
function layoutConnected(
  groups: LayoutGroup[],
  edges: CanvasEdge[],
  groupIdByElementId: Map<string, string>,
): CanvasElement[] | null {
  const links: Link[] = [];
  const seenLink = new Set<string>();
  for (const e of edges) {
    const from = groupIdByElementId.get(e.fromNodeId);
    const to = groupIdByElementId.get(e.toNodeId);
    if (!from || !to || from === to || seenLink.has(`${from}>${to}`)) continue;
    seenLink.add(`${from}>${to}`);
    links.push({ from, to });
  }
  const touched = new Set(links.flatMap((l) => [l.from, l.to]));
  const connected = groups.filter((g) => touched.has(g.repId));
  if (connected.length < 2) return null;
  const free = groups.filter((g) => !touched.has(g.repId));

  const degree = new Map<string, Set<string>>(connected.map((g) => [g.repId, new Set<string>()]));
  for (const l of links) {
    degree.get(l.from)!.add(l.to);
    degree.get(l.to)!.add(l.from);
  }
  const maxDegree = Math.max(...connected.map((g) => degree.get(g.repId)!.size));

  let structure: Structure | null = null;
  // One node carrying at least half the others is a hub: radial mind map.
  if (maxDegree >= 3 && maxDegree >= (connected.length - 1) / 2) {
    const radial = layoutMindMap(connected, edges, groupIdByElementId);
    if (radial) {
      const minX = Math.min(...radial.map((el) => el.x));
      const minY = Math.min(...radial.map((el) => el.y));
      structure = {
        elements: radial.map((el) => ({ ...el, x: el.x - minX, y: el.y - minY })),
        width: Math.max(...radial.map((el) => el.x + el.width)) - minX,
        height: Math.max(...radial.map((el) => el.y + el.height)) - minY,
        consumed: new Set(),
      };
    }
  }
  structure ??= layoutLoop(connected, links, free.filter(isFloatingText));
  structure ??= layoutFlow(connected, links);

  const placed: CanvasElement[] = [];
  const rest = free.filter((g) => !structure!.consumed.has(g.repId));

  // Title block: floating text stacked above the structure, in list order.
  let headerH = 0;
  for (const g of rest.filter(isFloatingText)) {
    placed.push(...placeGroup(g, 0, headerH));
    headerH += g.height + 8;
  }
  const structureY = headerH > 0 ? headerH - 8 + HEADER_GAP : 0;
  placed.push(...structure.elements.map((el) => ({ ...el, y: el.y + structureY })));

  // Everything else flows in rows beneath the structure.
  let cursorX = 0;
  let cursorY = structureY + structure.height + GROUP_GAP;
  let rowHeight = 0;
  for (const g of rest.filter((r) => !isFloatingText(r))) {
    if (cursorX > 0 && cursorX + g.width > MAX_ROW_WIDTH) {
      cursorX = 0;
      cursorY += rowHeight + GROUP_GAP;
      rowHeight = 0;
    }
    placed.push(...placeGroup(g, cursorX, cursorY));
    cursorX += g.width + GROUP_GAP;
    rowHeight = Math.max(rowHeight, g.height);
  }
  return placed.map((el) => ({ ...el, x: Math.round(el.x), y: Math.round(el.y) }));
}

/**
 * Recompute non-overlapping positions/sizes for a batch of AI-generated
 * elements, ignoring the model's own x/y (see file header). Every other
 * field (id, containerId, label, content, style, hypercubeTags, ...) is
 * left untouched — children keep their real containerId and land fully
 * inside their parent's padded bounds with absolute coordinates.
 *
 * The returned batch's own top-left is anchored near (0,0); callers
 * translate the whole thing to its final canvas position (see
 * elementsBoundingBox + findClearGroupOrigin below and
 * element-generation-service.ts).
 */
export function layoutDraftElements(elements: CanvasElement[], edges?: CanvasEdge[]): CanvasElement[] {
  if (elements.length === 0) return [];

  const containerIds = new Set(elements.filter((e) => e.type === 'container').map((e) => e.id));
  const childrenByContainer = new Map<string, CanvasElement[]>();
  const consumed = new Set<string>();
  for (const el of elements) {
    if (el.type === 'container') continue;
    if (el.containerId && containerIds.has(el.containerId)) {
      const list = childrenByContainer.get(el.containerId) || [];
      list.push(el);
      childrenByContainer.set(el.containerId, list);
      consumed.add(el.id);
    }
  }

  const groups: LayoutGroup[] = [];
  for (const el of elements) {
    if (el.type === 'container') {
      groups.push(layoutContainerGroup(el as ContainerElement, childrenByContainer.get(el.id) || []));
    } else if (!consumed.has(el.id)) {
      groups.push(layoutLooseElement(el));
    }
  }

  // Connected content is arranged by the shape of its graph: a closed ring
  // becomes a loop, a hub a radial mind map, anything else a left-to-right
  // flow. Falls back to the shelf-packed flow-grid below when the connectors
  // express no usable connectivity (returns null).
  if (edges && edges.length > 0 && groups.length >= 2) {
    const groupIdByElementId = new Map<string, string>();
    for (const g of groups) for (const mid of g.memberIds) groupIdByElementId.set(mid, g.repId);
    const arranged = layoutConnected(groups, edges, groupIdByElementId);
    if (arranged) return arranged;
  }

  // Shelf-pack groups into a flow-grid: left to right, wrapping to a new row
  // once MAX_ROW_WIDTH would be exceeded. Handles arbitrary group sizes
  // (variable content) without any pair ever overlapping.
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  const placed: CanvasElement[] = [];
  for (const group of groups) {
    if (cursorX > 0 && cursorX + group.width > MAX_ROW_WIDTH) {
      cursorX = 0;
      cursorY += rowHeight + GROUP_GAP;
      rowHeight = 0;
    }
    for (const member of group.members) {
      placed.push({ ...member, x: member.x + cursorX, y: member.y + cursorY });
    }
    cursorX += group.width + GROUP_GAP;
    rowHeight = Math.max(rowHeight, group.height);
  }

  return placed;
}

/**
 * Connectors whose straight run would cut through `minHits` or more unrelated
 * elements. The canvas draws a connector as one direct stroke between its two
 * ends (it cannot route around things), so a relation that reaches back across
 * a laid-out diagram, typically "last stage returns to the first", becomes a
 * line scored through every node in between. Callers drop these rather than
 * draw them.
 */
export function connectorsThroughNodes(elements: CanvasElement[], edges: CanvasEdge[], minHits = 2): Set<string> {
  const byId = new Map(elements.map((el) => [el.id, el]));
  const solid = elements.filter((el) => el.type !== 'text' && el.type !== 'container' && el.type !== 'line');
  const through = new Set<string>();
  for (const e of edges) {
    const a = byId.get(e.fromNodeId);
    const b = byId.get(e.toNodeId);
    if (!a || !b) continue;
    const ax = a.x + a.width / 2, ay = a.y + a.height / 2;
    const bx = b.x + b.width / 2, by = b.y + b.height / 2;
    const steps = Math.max(8, Math.ceil(Math.hypot(bx - ax, by - ay) / 20));
    let hits = 0;
    for (const el of solid) {
      if (el.id === a.id || el.id === b.id || el.id === a.containerId || el.id === b.containerId) continue;
      for (let i = 1; i < steps; i++) {
        const px = ax + ((bx - ax) * i) / steps;
        const py = ay + ((by - ay) * i) / steps;
        if (px > el.x && px < el.x + el.width && py > el.y && py < el.y + el.height) { hits++; break; }
      }
      if (hits >= minHits) break;
    }
    if (hits >= minHits) through.add(e.id);
  }
  return through;
}

// ─── Insertion point ────────────────────────────────────────────────────

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Find a top-left origin for a group of the given size, centered on
 * `center` (the current viewport center in world coordinates) when that
 * doesn't collide with any obstacle, otherwise the nearest clear spot found
 * by an expanding ring search around the centered position. Falls back to
 * placing the group below every obstacle if the ring search exhausts
 * (pathological case: a huge number of scattered obstacles).
 */
export function findClearGroupOrigin(
  groupSize: { width: number; height: number },
  center: { x: number; y: number },
  obstacles: BoundingBox[]
): { x: number; y: number } {
  const desiredX = center.x - groupSize.width / 2;
  const desiredY = center.y - groupSize.height / 2;
  if (obstacles.length === 0) return { x: desiredX, y: desiredY };

  const intersectsAny = (x: number, y: number) =>
    obstacles.some(
      (o) => x < o.maxX && o.minX < x + groupSize.width && y < o.maxY && o.minY < y + groupSize.height
    );

  if (!intersectsAny(desiredX, desiredY)) return { x: desiredX, y: desiredY };

  const STEP = 140;
  const MAX_RING = 40;
  for (let ring = 1; ring <= MAX_RING; ring++) {
    const candidates = [
      { x: desiredX + ring * STEP, y: desiredY },
      { x: desiredX - ring * STEP, y: desiredY },
      { x: desiredX, y: desiredY + ring * STEP },
      { x: desiredX, y: desiredY - ring * STEP },
      { x: desiredX + ring * STEP, y: desiredY + ring * STEP },
      { x: desiredX - ring * STEP, y: desiredY - ring * STEP },
      { x: desiredX + ring * STEP, y: desiredY - ring * STEP },
      { x: desiredX - ring * STEP, y: desiredY + ring * STEP },
    ];
    for (const c of candidates) {
      if (!intersectsAny(c.x, c.y)) return c;
    }
  }

  const maxBottom = Math.max(...obstacles.map((o) => o.maxY));
  return { x: desiredX, y: maxBottom + 160 };
}
