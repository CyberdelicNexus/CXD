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
import type { CanvasElement, ContainerElement, TextElement, ShapeElement } from '@/types/canvas-elements';

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
