/**
 * Geometry + integrity verification for the quickstart templates.
 * Run: npx tsx src/lib/__verify__/templates.verify.ts
 *
 * Checks use REAL rendered footprints, not stored dimensions, mirroring
 * framing-to-canvas.verify.ts: note cards have a 300px CSS height floor,
 * board hexes need their full 170x230, docs render ~100x130.
 */
import { QUICKSTART_TEMPLATES } from '../templates-quickstart';
import { CLASSIC_TEMPLATES } from '../templates-classics';
import { EXPERIENCE_TEMPLATES } from '../templates-experience';
import { TEMPLATES, instantiateTemplate } from '../templates';
import { checkLayout } from '../canvas-layout-rules';
import type { CanvasElement } from '../../types/canvas-elements';

const ALL_VERIFIED = [...QUICKSTART_TEMPLATES, ...EXPERIENCE_TEMPLATES, ...CLASSIC_TEMPLATES];

let pass = 0;
let fail = 0;
const check = (cond: boolean, msg: string) => {
  if (cond) { pass++; } else { fail++; console.error(`  ✗ ${msg}`); }
};

// Geometry rules live in canvas-layout-rules.ts so AI-generated layouts are
// audited against the exact same rubric as these hand-authored templates.

for (const tpl of ALL_VERIFIED) {
  console.log(`\n▶ ${tpl.name} (${tpl.elements.length} elements, ${tpl.edges?.length ?? 0} edges)`);

  // 1-4. Shared rubric: unique ids, edge endpoints, container refs + bounds,
  //      and same-scope overlaps, all on real rendered footprints.
  const violations = checkLayout(tpl.elements, tpl.edges ?? []);
  for (const x of violations) check(false, `[${x.rule}] ${x.message}`);
  if (violations.length === 0) pass++;

  const ids = new Set<string>();
  for (const el of tpl.elements) {
    ids.add(el.id);
    const cb = (el as any).childBoardId;
    if (cb) ids.add(cb);
  }

  // 2b. Interior elements/edges reference a real board's childBoardId
  const childBoardIds = new Set(
    tpl.elements.filter((e) => e.type === 'board').map((e) => (e as any).childBoardId as string),
  );
  for (const el of tpl.elements) {
    if (el.boardId) check(childBoardIds.has(el.boardId), `${el.id}: boardId ${el.boardId} is not any template board's childBoardId`);
  }
  for (const e of tpl.edges ?? []) {
    if (e.boardId) check(childBoardIds.has(e.boardId), `edge ${e.id}: boardId ${e.boardId} is not any template board's childBoardId`);
  }

  // 5. instantiateTemplate: fresh ids, endpoints remapped, nothing dropped
  const inst = instantiateTemplate(tpl);
  check(inst.elements.length === tpl.elements.length, 'instantiate dropped elements');
  check(inst.edges.length === (tpl.edges?.length ?? 0), 'instantiate dropped edges');
  const newIds = new Set(inst.elements.map((e) => e.id));
  check(inst.elements.every((e) => !ids.has(e.id)), 'instantiate reused an old element id');
  check(inst.edges.every((e) => newIds.has(e.fromNodeId) && newIds.has(e.toNodeId)), 'instantiated edge endpoints not remapped');
  const oldContainers = tpl.elements.filter((e) => e.containerId).length;
  const newContainers = inst.elements.filter((e) => e.containerId && newIds.has(e.containerId)).length;
  check(newContainers === oldContainers, `containerId remap lost refs (${newContainers}/${oldContainers})`);
}

// 6. Registry sanity: all templates unique ids, quickstart listed first
const regIds = TEMPLATES.map((t) => t.id);
check(new Set(regIds).size === regIds.length, 'duplicate template ids in TEMPLATES');
check(regIds[0] === 'qs-intention-core', 'quickstart templates not leading the registry');

console.log(`\n${fail === 0 ? '✅' : '❌'} templates.verify: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
