/**
 * Verify: same-user multi-tab first-save DB re-merge produces the UNION.
 *
 * Reproduces the P0 multi-tab clobber and proves the fix in SupabasePersistence:
 * on the first save after markReady (needsDbRemerge), the tab re-reads the live
 * yjs_state and union-merges it into its local doc BEFORE encoding, so it can no
 * longer overwrite ops another same-user tab persisted while it was idle.
 *
 * Pure Yjs simulation (no Supabase). Mirrors supabase-persistence._executeSave:
 *   merged = encode( lastLoadedState ∪ encode(localDoc) )
 * with the re-merge step applying the live DB state into localDoc first.
 *
 * Run: npx tsx src/lib/__verify__/multi-tab-merge.verify.ts
 */

import * as Y from 'yjs';

type Db = { yjs_state: Uint8Array | null };

/** encodeStateAsUpdate helper. */
function encode(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}

/** Simulate a save exactly like SupabasePersistence._executeSave. */
function simulateSave(opts: {
  localDoc: Y.Doc;
  lastLoadedState: Uint8Array | null;
  db: Db;
  reMerge: boolean; // true => first-save-after-ready path (the fix)
}): { merged: Uint8Array } {
  const { localDoc, db, reMerge } = opts;
  let lastLoadedState = opts.lastLoadedState;

  // ── First-save DB re-merge (the fix) ──────────────────────────────────────
  if (reMerge && db.yjs_state) {
    // Apply the live DB state into the LOCAL doc so both the encoded binary and
    // any derived projection reflect merged reality.
    Y.applyUpdate(localDoc, db.yjs_state, 'persistence');
  }

  // ── Cache-merge + encode (unchanged existing path) ────────────────────────
  const mergeDoc = new Y.Doc();
  if (lastLoadedState) Y.applyUpdate(mergeDoc, lastLoadedState);
  const localState = encode(localDoc);
  Y.applyUpdate(mergeDoc, localState);
  const merged = encode(mergeDoc);
  mergeDoc.destroy();

  // Persist + refresh cache (as the real code does on success)
  db.yjs_state = merged;
  lastLoadedState = merged;
  return { merged };
}

function elementIds(state: Uint8Array): string[] {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, state);
  const ids = Array.from(doc.getMap('elements').keys()).sort();
  doc.destroy();
  return ids;
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('  ok:', msg);
}

// ── Setup: both tabs load the same base state ────────────────────────────────
const base = new Y.Doc();
base.getMap('elements').set('base', { id: 'base' });
const baseState = encode(base);

const db: Db = { yjs_state: baseState };

// Tab A and Tab B both loaded `base`; their cached merge base is `base`.
const docA = new Y.Doc();
Y.applyUpdate(docA, baseState);
const docB = new Y.Doc();
Y.applyUpdate(docB, baseState);
let lastLoadedA: Uint8Array | null = baseState;
let lastLoadedB: Uint8Array | null = baseState;

console.log('\n[1] Tab A edits (adds elA) and saves — DB gains elA');
docA.getMap('elements').set('elA', { id: 'elA' });
const savedA = simulateSave({ localDoc: docA, lastLoadedState: lastLoadedA, db, reMerge: true });
lastLoadedA = savedA.merged;
assert(elementIds(db.yjs_state!).join(',') === 'base,elA', 'DB has base + elA after Tab A save');

console.log('\n[2] Tab B never received elA (same-user echo suppression + no live IndexedDB sync).');
console.log('    Tab B edits (adds elB). Its lastLoadedState is still `base`.');
docB.getMap('elements').set('elB', { id: 'elB' });

console.log('\n[3a] WITHOUT the fix: Tab B saves with reMerge=false → clobbers elA');
{
  // Clone the pre-save world so we can also run the WITH-fix branch cleanly.
  const dbNoFix: Db = { yjs_state: db.yjs_state };
  const docBNoFix = new Y.Doc();
  Y.applyUpdate(docBNoFix, encode(docB));
  simulateSave({ localDoc: docBNoFix, lastLoadedState: lastLoadedB, db: dbNoFix, reMerge: false });
  const ids = elementIds(dbNoFix.yjs_state!);
  assert(!ids.includes('elA'), 'reproduced clobber: DB lost elA (' + ids.join(',') + ')');
  docBNoFix.destroy();
}

console.log('\n[3b] WITH the fix: Tab B first-save re-merges live DB → UNION, elA preserved');
{
  const savedB = simulateSave({ localDoc: docB, lastLoadedState: lastLoadedB, db, reMerge: true });
  lastLoadedB = savedB.merged;
  const ids = elementIds(db.yjs_state!);
  assert(ids.join(',') === 'base,elA,elB', 'DB is the union base + elA + elB (' + ids.join(',') + ')');
  // The local doc itself now also reflects the union (project_data derivation is consistent).
  assert(
    Array.from(docB.getMap('elements').keys()).sort().join(',') === 'base,elA,elB',
    'Tab B local doc reflects the union after re-merge',
  );
}

console.log('\nALL CHECKS PASSED — first-save re-merge yields the union, no clobber.\n');
