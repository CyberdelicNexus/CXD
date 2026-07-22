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
import { TEMPLATES, instantiateTemplate } from '../templates';
import type { CanvasElement } from '../../types/canvas-elements';

const ALL_VERIFIED = [...QUICKSTART_TEMPLATES, ...CLASSIC_TEMPLATES];

let pass = 0;
let fail = 0;
const check = (cond: boolean, msg: string) => {
  if (cond) { pass++; } else { fail++; console.error(`  ✗ ${msg}`); }
};

/** Real rendered bounds (note height floor 300, etc.). Lines return null (no box). */
function realBounds(el: CanvasElement): { x: number; y: number; w: number; h: number } | null {
  if (el.type === 'line' || el.type === 'connector') return null;
  let w = el.width;
  let h = el.height;
  if (el.type === 'freeform') {
    const f = el as any;
    if (f.isDocument) { w = Math.max(w, 100); h = Math.max(h, 130); }
    else if (f.cardType === 'note') { w = Math.max(w, 200); h = Math.max(h, 300); }
  }
  return { x: el.x, y: el.y, w, h };
}

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

for (const tpl of ALL_VERIFIED) {
  console.log(`\n▶ ${tpl.name} (${tpl.elements.length} elements, ${tpl.edges?.length ?? 0} edges)`);

  // 1. Unique ids (elements + childBoardIds + edges)
  const ids = new Set<string>();
  let dupes = 0;
  for (const el of tpl.elements) {
    if (ids.has(el.id)) dupes++;
    ids.add(el.id);
    const cb = (el as any).childBoardId;
    if (cb) { if (ids.has(cb)) dupes++; ids.add(cb); }
  }
  check(dupes === 0, `duplicate ids: ${dupes}`);

  // 2. Edge endpoints resolve to element ids
  for (const e of tpl.edges ?? []) {
    check(ids.has(e.fromNodeId), `edge ${e.id}: unknown fromNodeId ${e.fromNodeId}`);
    check(ids.has(e.toNodeId), `edge ${e.id}: unknown toNodeId ${e.toNodeId}`);
  }

  // 3. containerId references exist + children within container bounds
  const byId = new Map(tpl.elements.map((el) => [el.id, el]));
  for (const el of tpl.elements) {
    if (!el.containerId) continue;
    const parent = byId.get(el.containerId);
    check(!!parent && parent.type === 'container', `${el.id}: containerId ${el.containerId} is not a container`);
    if (!parent) continue;
    const rb = realBounds(el);
    if (!rb) continue; // lines: no box containment check
    const inX = rb.x >= parent.x && rb.x + rb.w <= parent.x + parent.width;
    const inY = rb.y >= parent.y && rb.y + rb.h <= parent.y + parent.height;
    check(inX && inY, `${el.id} (${el.type}) escapes container ${parent.id}: child ${JSON.stringify(rb)} vs parent ${parent.x},${parent.y} ${parent.width}x${parent.height}`);
  }

  // 4. Overlaps among siblings (same containment scope), skipping text headers
  //    against their own zone content is NOT allowed either — text is a real box.
  const scopes = new Map<string, CanvasElement[]>();
  for (const el of tpl.elements) {
    const scope = el.containerId ?? '__root__';
    if (!scopes.has(scope)) scopes.set(scope, []);
    scopes.get(scope)!.push(el);
  }
  for (const [scope, els] of Array.from(scopes.entries())) {
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        const a = realBounds(els[i]);
        const b = realBounds(els[j]);
        if (!a || !b) continue;
        // Containers at root scope may legitimately sit near each other; still
        // require zero overlap. A child overlapping its own container is fine
        // (that's containment), so only same-scope pairs are compared here.
        if (overlaps(a, b)) {
          check(false, `[${scope}] ${els[i].id} (${els[i].type}) overlaps ${els[j].id} (${els[j].type})`);
        } else {
          pass++;
        }
      }
    }
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
