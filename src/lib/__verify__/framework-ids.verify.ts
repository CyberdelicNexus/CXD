/**
 * Logic verification for project frameworkIds (Frameworks Library, Task 3).
 * Run: npx tsx src/lib/__verify__/framework-ids.verify.ts
 *
 * frameworkIds is an array riding in the Y.Doc meta map (the Y.Doc is the
 * authoritative save source), so it must survive initializeYDoc -> yDocToProject,
 * and a project without it must read back as undefined.
 */
import {
  createProjectYDoc,
  initializeYDoc,
  yDocToProject,
} from '../yjs/y-doc-factory';
import {
  createDefaultProject,
  normalizeFrameworkIds,
  MAX_PROJECT_FRAMEWORKS,
} from '@/types/cxd-schema';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; console.error('  ✗', name); }
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

console.log('normalizeFrameworkIds');
check('cap is 5', MAX_PROJECT_FRAMEWORKS === 5);
check('undefined -> undefined', normalizeFrameworkIds(undefined) === undefined);
check('empty -> undefined', normalizeFrameworkIds([]) === undefined);
check('only blanks -> undefined', normalizeFrameworkIds(['', ''] as string[]) === undefined);
check('dedupes', same(normalizeFrameworkIds(['a', 'b', 'a']), ['a', 'b']));
check('keeps insertion order', same(normalizeFrameworkIds(['c', 'a', 'b']), ['c', 'a', 'b']));
check(
  'keeps most recent 5',
  same(normalizeFrameworkIds(['1', '2', '3', '4', '5', '6', '7']), ['3', '4', '5', '6', '7']),
);

console.log('createDefaultProject');
const withFw = createDefaultProject('p1', 'With', 'u1', undefined, undefined, {
  frameworkIds: ['iceberg-model', 'iceberg-model', 'causal-loop-map'],
});
check('carries normalized option', same(withFw.frameworkIds, ['iceberg-model', 'causal-loop-map']));
const withoutFw = createDefaultProject('p2', 'Without', 'u1');
check('absent option -> undefined', withoutFw.frameworkIds === undefined);

console.log('Y.Doc round trip');
const doc1 = createProjectYDoc();
initializeYDoc(doc1, withFw);
check('ids round-trip', same(yDocToProject(doc1).frameworkIds, ['iceberg-model', 'causal-loop-map']));
const doc2 = createProjectYDoc();
initializeYDoc(doc2, withoutFw);
check('no ids -> undefined', yDocToProject(doc2).frameworkIds === undefined);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
