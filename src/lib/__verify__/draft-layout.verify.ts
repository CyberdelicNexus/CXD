/**
 * Verification for draft-layout.ts (the "Draft on Canvas" layout pass).
 * Run: npx tsx src/lib/__verify__/draft-layout.verify.ts
 *
 * Asserts: no pairwise overlaps using the real minimum sizes this module
 * enforces (containers/text/shapes have no CSS floor like freeform notes,
 * so "real minimum" here is the sane size this module itself computes —
 * see file header), children land fully inside their parent container's
 * padded bounds with containerId intact, top-level groups are shelf-packed
 * with generous gaps, and findClearGroupOrigin offsets a group clear of a
 * provided obstacle box (and is a no-op when nothing is in the way).
 */
import { layoutDraftElements, findClearGroupOrigin } from '../ai/draft-layout';
import type { CanvasElement, ContainerElement, TextElement, ShapeElement, CanvasEdge } from '@/types/canvas-elements';

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) { failures++; console.error(`  ✗ ${msg}`); }
  else console.log(`  ✓ ${msg}`);
}

function overlaps(a: CanvasElement, b: CanvasElement): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
function isContainment(a: CanvasElement, b: CanvasElement): boolean {
  return a.containerId === b.id || b.containerId === a.id;
}
function checkNoOverlaps(elements: CanvasElement[], label: string) {
  let bad = 0;
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const a = elements[i], b = elements[j];
      if (isContainment(a, b)) continue;
      if (overlaps(a, b)) {
        bad++;
        console.error(`    overlap: ${a.type}:${a.id} vs ${b.type}:${b.id}`);
      }
    }
  }
  check(bad === 0, `${label}: no pairwise overlaps (${elements.length} elements)`);
}

// ─── Fixtures ────────────────────────────────────────────────────────
let ref = 0;
const id = () => `el-${ref++}`;

function makeContainer(x: number, y: number, w: number, h: number, label: string): ContainerElement {
  return {
    id: id(), type: 'container', x, y, width: w, height: h, zIndex: 0, locked: false,
    boardId: null, surface: 'canvas', label, tintColor: 'violet', collapsed: false,
  };
}
function makeText(x: number, y: number, w: number, h: number, content: string, containerId?: string): TextElement {
  return {
    id: id(), type: 'text', x, y, width: w, height: h, zIndex: 1, locked: false,
    boardId: null, surface: 'canvas', content, textAlign: 'left', containerId,
  };
}
function makeShape(x: number, y: number, w: number, h: number, containerId?: string): ShapeElement {
  return {
    id: id(), type: 'shape', x, y, width: w, height: h, zIndex: 1, locked: false,
    boardId: null, surface: 'canvas', shapeType: 'circle', content: '✨', containerId,
  };
}
function makeEdge(fromId: string, toId: string): CanvasEdge {
  return {
    id: id(), fromNodeId: fromId, toNodeId: toId, fromAnchor: 'right', toAnchor: 'left',
    boardId: null, surface: 'canvas',
  };
}

// ── Scenario 1: overlapping-pile input (the actual bug report) — several
// containers whose model-suggested coordinates all land on top of each
// other, each with children stacked at the same x/y (worst case for
// overlap: exactly reproduces the screenshot). ──
console.log('Overlapping-pile input (the reported bug):');
{
  ref = 0;
  const c1 = makeContainer(100, 100, 400, 300, 'Section A');
  const c2 = makeContainer(105, 105, 420, 320, 'Section B'); // deliberately overlapping c1
  const c3 = makeContainer(110, 110, 380, 280, 'Section C'); // deliberately overlapping c1+c2
  const elements: CanvasElement[] = [
    c1,
    makeText(120, 150, 300, 40, 'First insight for section A', c1.id),
    makeText(120, 150, 300, 40, 'Second insight, same stacked coords', c1.id), // same coords as sibling
    c2,
    makeText(125, 155, 300, 40, 'A very long piece of body copy that should wrap across several lines once real width is applied, to make sure the height estimate actually grows instead of clipping the content silently', c2.id),
    makeShape(125, 155, 60, 60, c2.id),
    makeShape(125, 155, 60, 60, c2.id), // shapes also stacked on top of each other in the raw model output
    makeShape(125, 155, 60, 60, c2.id),
    c3,
    makeText(130, 160, 300, 40, 'Loose top-level note with no container', undefined),
  ];

  const laidOut = layoutDraftElements(elements);
  check(laidOut.length === elements.length, `element count preserved (${laidOut.length}/${elements.length})`);
  check(new Set(laidOut.map((e) => e.id)).size === laidOut.length, 'no duplicate ids introduced');
  checkNoOverlaps(laidOut, 'Overlapping-pile');

  // Containers preserved with real min sizes (this module's own floor,
  // since container/text/shape have no CSS floor to measure against).
  const containers = laidOut.filter((e): e is ContainerElement => e.type === 'container');
  check(containers.length === 3, 'all 3 containers preserved');
  check(containers.every((c) => c.width >= 340 && c.width <= 480), 'every container within the 340-480 real width range');
  check(containers.every((c) => c.height >= 260), 'every container at least the 260 real min height');

  // Children fully inside their parent's bounds with padding, containerId intact.
  const byId = new Map(laidOut.map((e) => [e.id, e]));
  const children = laidOut.filter((e) => e.containerId);
  check(children.length === 6, `6 children carried through (got ${children.length})`);
  for (const child of children) {
    const parent = byId.get(child.containerId!) as ContainerElement | undefined;
    check(!!parent, `child ${child.id} references a real parent id`);
    if (!parent) continue;
    check(
      child.x >= parent.x && child.y >= parent.y &&
      child.x + child.width <= parent.x + parent.width &&
      child.y + child.height <= parent.y + parent.height,
      `child inside "${parent.label}" fits fully within its parent's bounds`
    );
    check(child.x > parent.x, `child inside "${parent.label}" has left padding from the parent edge`);
  }

  // The long text child got a real height estimate, not left clipped at the tiny stored 40px.
  const longText = laidOut.find((e) => e.type === 'text' && (e as TextElement).content.startsWith('A very long')) as TextElement;
  check(!!longText && longText.height > 40, `long text content estimated a taller real height (got ${longText?.height})`);

  // Loose top-level element got its own slot, not left at the stacked raw coords.
  const loose = laidOut.find((e) => e.type === 'text' && (e as TextElement).content.startsWith('Loose'))!;
  check(!loose.containerId, 'loose element stayed top-level (no containerId)');
}

// ── Scenario 2: many groups — shelf-packing wraps rows with real gaps. ──
console.log('Many groups (shelf-pack wrapping):');
{
  ref = 0;
  const elements: CanvasElement[] = [];
  for (let i = 0; i < 8; i++) {
    const c = makeContainer(i * 50, i * 10, 400, 280, `Group ${i}`);
    elements.push(c, makeText(i * 50 + 10, i * 10 + 10, 300, 60, `Content for group ${i}`, c.id));
  }
  const laidOut = layoutDraftElements(elements);
  checkNoOverlaps(laidOut, 'Many groups');
  const containers = laidOut.filter((e) => e.type === 'container');
  const rows = new Set(containers.map((c) => c.y));
  check(rows.size > 1, `8 wide containers wrap into more than one row (got ${rows.size} distinct rows)`);
  // Gap between horizontally-adjacent containers in the same row is within the requested 40-90px range.
  const sameRow = containers.filter((c) => c.y === containers[0].y).sort((a, b) => a.x - b.x);
  for (let i = 1; i < sameRow.length; i++) {
    const gap = sameRow[i].x - (sameRow[i - 1].x + sameRow[i - 1].width);
    check(gap >= 40 && gap <= 90, `horizontal gap between groups is 40-90px (got ${gap})`);
  }
}

// ── Scenario 3: empty input ──
console.log('Empty input:');
check(layoutDraftElements([]).length === 0, 'empty array in, empty array out');

// ── Scenario 4: mind map — edges present → radial layout, no overlaps. A
// central hub with six branches, two of which have two sub-branches (a
// three-ring tree). ──
console.log('Mind map (radial hub-and-branch):');
{
  ref = 0;
  const hub = makeText(0, 0, 300, 60, 'Central idea');
  const branches: TextElement[] = [];
  for (let i = 0; i < 6; i++) branches.push(makeText(0, 0, 280, 50, `Branch ${i}`));
  const sub: TextElement[] = [];
  for (let i = 0; i < 4; i++) sub.push(makeText(0, 0, 260, 50, `Sub ${i}`));
  const elements: CanvasElement[] = [hub, ...branches, ...sub];
  const edges: CanvasEdge[] = [
    ...branches.map((b) => makeEdge(hub.id, b.id)),
    makeEdge(branches[0].id, sub[0].id),
    makeEdge(branches[0].id, sub[1].id),
    makeEdge(branches[1].id, sub[2].id),
    makeEdge(branches[1].id, sub[3].id),
  ];

  const laidOut = layoutDraftElements(elements, edges);
  check(laidOut.length === elements.length, `element count preserved (${laidOut.length}/${elements.length})`);
  check(new Set(laidOut.map((e) => e.id)).size === laidOut.length, 'no duplicate ids introduced');
  checkNoOverlaps(laidOut, 'Mind map (radial)');

  // Edges reference valid ids that survive into the laid-out batch.
  const ids = new Set(laidOut.map((e) => e.id));
  check(
    edges.every((e) => ids.has(e.fromNodeId) && ids.has(e.toNodeId)),
    'every edge references two laid-out element ids'
  );

  // Radially fanned — every node lands at a distinct position (nothing stacked).
  const positions = new Set(laidOut.map((e) => `${Math.round(e.x)},${Math.round(e.y)}`));
  check(positions.size === laidOut.length, 'all nodes at distinct radial positions');

  // Hub sits at the centre of the bounding box (branches surround it).
  const minX = Math.min(...laidOut.map((e) => e.x));
  const maxX = Math.max(...laidOut.map((e) => e.x + e.width));
  const minY = Math.min(...laidOut.map((e) => e.y));
  const maxY = Math.max(...laidOut.map((e) => e.y + e.height));
  const placedHub = laidOut.find((e) => e.id === hub.id)!;
  const hubCx = placedHub.x + placedHub.width / 2;
  const hubCy = placedHub.y + placedHub.height / 2;
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  check(
    Math.abs(hubCx - (minX + maxX) / 2) < spanX * 0.15 &&
      Math.abs(hubCy - (minY + maxY) / 2) < spanY * 0.15,
    'hub is centered within the mind map'
  );
}

// ── Scenario 5: edges present but reference missing ids → no connectivity,
// falls back to the shelf-packed grid without crashing. ──
console.log('Mind map fallback (edges reference nothing):');
{
  ref = 0;
  const a = makeText(0, 0, 300, 60, 'Island A');
  const b = makeText(0, 0, 300, 60, 'Island B');
  const edges: CanvasEdge[] = [makeEdge('missing-1', 'missing-2')];
  const laidOut = layoutDraftElements([a, b], edges);
  check(laidOut.length === 2, 'both elements preserved on grid fallback');
  checkNoOverlaps(laidOut, 'Fallback grid');
}

// ── findClearGroupOrigin ────────────────────────────────────────────
console.log('findClearGroupOrigin:');
{
  const groupSize = { width: 400, height: 300 };
  const center = { x: 1000, y: 800 };

  // No obstacles: centers exactly on the viewport center.
  const clear = findClearGroupOrigin(groupSize, center, []);
  check(clear.x === center.x - 200 && clear.y === center.y - 150, 'no obstacles → group centered on viewport center');

  // One obstacle sitting exactly where the centered group would land: the
  // result must NOT intersect it.
  const obstacle = { minX: center.x - 250, minY: center.y - 200, maxX: center.x + 250, maxY: center.y + 200 };
  const offset = findClearGroupOrigin(groupSize, center, [obstacle]);
  const intersects =
    offset.x < obstacle.maxX && obstacle.minX < offset.x + groupSize.width &&
    offset.y < obstacle.maxY && obstacle.minY < offset.y + groupSize.height;
  check(!intersects, 'offsets clear of a provided obstacle box directly under the viewport center');

  // Obstacle far away: centered position already clear, returned unchanged.
  const farObstacle = { minX: 5000, minY: 5000, maxX: 5400, maxY: 5300 };
  const unaffected = findClearGroupOrigin(groupSize, center, [farObstacle]);
  check(unaffected.x === center.x - 200 && unaffected.y === center.y - 150, 'far-away obstacle does not shift placement');
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
