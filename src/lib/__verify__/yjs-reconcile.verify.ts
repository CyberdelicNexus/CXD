/**
 * Logic verification for reconcileCanvasIntoYDoc — the July 2026 data-loss fix.
 * Run: npx tsx src/lib/__verify__/yjs-reconcile.verify.ts
 *
 * Scenario under test: a project's yjs_state is STALE relative to project_data
 * (elements exist only in the JSON column). Before the fix, load trusted the
 * doc unconditionally and the first save persisted the loss to both columns.
 * The reconciler must seed exactly the missing elements without disturbing
 * anything the doc already knows.
 */
import * as Y from 'yjs';
import {
  createProjectYDoc,
  initializeYDoc,
  reconcileCanvasIntoYDoc,
  getYDocElements,
  getYDocEdges,
} from '../yjs/y-doc-factory';
import { YDOC_KEYS } from '../yjs/y-doc-types';
import type { CXDProject } from '@/types/cxd-schema';
import type { CanvasElement, CanvasEdge } from '@/types/canvas-elements';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; console.error('  ✗', name); }
}

function el(id: string, content: string): CanvasElement {
  return {
    id, type: 'freeform', x: 0, y: 0, width: 200, height: 150,
    zIndex: 1, content,
  } as unknown as CanvasElement;
}
function edge(id: string, from: string, to: string): CanvasEdge {
  return { id, from, to } as unknown as CanvasEdge;
}
function project(elements: CanvasElement[], edges: CanvasEdge[], name = 'Test'): CXDProject {
  return {
    id: 'p1', name, description: 'desc',
    canvasLayout: { elements, edges, boards: [] },
  } as unknown as CXDProject;
}

console.log('— stale doc gains project_data-only elements —');
{
  // Doc universe: only elements A, B (the stale yjs_state)
  const doc = createProjectYDoc();
  initializeYDoc(doc, project([el('A', 'a'), el('B', 'b')], [edge('E1', 'A', 'B')]));

  // project_data universe: A, B + C, D (written via a legacy/LWW path)
  const pd = project(
    [el('A', 'a'), el('B', 'b'), el('C', 'c'), el('D', 'd')],
    [edge('E1', 'A', 'B'), edge('E2', 'C', 'D')]
  );

  const { seededElements, seededEdges } = reconcileCanvasIntoYDoc(doc, pd);
  check('seeds exactly the 2 missing elements', seededElements === 2);
  check('seeds exactly the 1 missing edge', seededEdges === 1);
  check('doc now holds the union (4 elements)', getYDocElements(doc).length === 4);
  check('doc now holds the union (2 edges)', getYDocEdges(doc).length === 2);
  const ids = new Set(getYDocElements(doc).map((e) => e.id));
  check('C and D present by id', ids.has('C') && ids.has('D'));
  doc.destroy();
}

console.log('— doc wins for elements it already knows (no overwrite) —');
{
  const doc = createProjectYDoc();
  initializeYDoc(doc, project([el('A', 'doc-version')], []));

  // project_data has a DIFFERENT (older) content for A — must NOT clobber the doc
  const { seededElements } = reconcileCanvasIntoYDoc(doc, project([el('A', 'stale-json-version')], []));
  check('nothing seeded for known id', seededElements === 0);
  const a = getYDocElements(doc).find((e) => e.id === 'A') as { content?: string };
  check('doc content untouched', a?.content === 'doc-version');
  doc.destroy();
}

console.log('— idempotency: second run seeds nothing —');
{
  const doc = createProjectYDoc();
  initializeYDoc(doc, project([el('A', 'a')], []));
  const pd = project([el('A', 'a'), el('B', 'b')], []);
  const first = reconcileCanvasIntoYDoc(doc, pd);
  const second = reconcileCanvasIntoYDoc(doc, pd);
  check('first run seeds 1', first.seededElements === 1);
  check('second run seeds 0', second.seededElements === 0);
  check('no duplicates (2 total)', getYDocElements(doc).length === 2);
  doc.destroy();
}

console.log('— empty project_data seeds nothing, wipes nothing —');
{
  const doc = createProjectYDoc();
  initializeYDoc(doc, project([el('A', 'a')], [edge('E1', 'A', 'A')]));
  const { seededElements, seededEdges } = reconcileCanvasIntoYDoc(doc, project([], []));
  check('no seeds from empty json', seededElements === 0 && seededEdges === 0);
  check('doc elements survive', getYDocElements(doc).length === 1);
  check('doc edges survive', getYDocEdges(doc).length === 1);
  doc.destroy();
}

console.log('— meta name/description reconcile from project_data —');
{
  const doc = createProjectYDoc();
  initializeYDoc(doc, project([], [], 'Old Name'));
  reconcileCanvasIntoYDoc(doc, project([], [], 'Renamed On Dashboard'));
  const meta = doc.getMap(YDOC_KEYS.META);
  check('doc meta name updated to project_data name', meta.get('name') === 'Renamed On Dashboard');
  doc.destroy();
}

console.log('— tombstone caveat is bounded: deleted-in-doc element resurrects only if json still has it —');
{
  const doc = createProjectYDoc();
  initializeYDoc(doc, project([el('A', 'a'), el('B', 'b')], []));
  // Simulate a live-session delete of B (dual-writer would also remove it from
  // project_data within the same save — so a FRESH project_data lacks B)
  doc.transact(() => { doc.getMap(YDOC_KEYS.ELEMENTS).delete('B'); }, 'local');
  const fresh = project([el('A', 'a')], []);
  const { seededElements } = reconcileCanvasIntoYDoc(doc, fresh);
  check('fresh json does not resurrect deleted element', seededElements === 0);
  check('doc has 1 element after delete + reconcile', getYDocElements(doc).length === 1);
  doc.destroy();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
