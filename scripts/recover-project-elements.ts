/**
 * Recovery CLI — re-insert canvas elements that exist in an older copy of a
 * project (e.g. a row extracted from a Supabase daily backup) but are missing
 * from the live row. Additive only: never deletes or overwrites anything the
 * live project currently has.
 *
 * Usage:
 *   npx tsx scripts/recover-project-elements.ts --project <id> --source <file.json>          # dry-run (default)
 *   npx tsx scripts/recover-project-elements.ts --project <id> --source <file.json> --apply  # write
 *
 * --source accepts either a full cxd_projects row export (with .project_data)
 * or a bare project_data object. Get it from a Supabase backup via the
 * dashboard (Database → Backups → restore to a branch/project, then:
 *   select project_data from cxd_projects where id = '<id>';
 * and save the JSON to a file).
 *
 * On --apply, in order:
 *   1. Full safety snapshot of the CURRENT row into cxd_project_snapshots
 *   2. Missing elements/edges seeded into a server-side Y.Doc rebuilt from the
 *      live yjs_state (same pattern as the bridge/master-plan writers)
 *   3. Atomic dual-write of yjs_state + re-derived project_data
 * Ask any open tabs to reload afterwards — no realtime broadcast is sent.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as Y from 'yjs';
import { createClient } from '@supabase/supabase-js';
import { createProjectYDoc, yDocToProject } from '../src/lib/yjs/y-doc-factory';
import { YDOC_KEYS } from '../src/lib/yjs/y-doc-types';
import { canvasElementToYMap, canvasEdgeToYMap } from '../src/lib/yjs/element-serializers';
import type { CXDProject } from '../src/types/cxd-schema';
import type { CanvasElement, CanvasEdge } from '../src/types/canvas-elements';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const projectId = arg('project');
const sourceFile = arg('source');
const apply = process.argv.includes('--apply');
if (!projectId || !sourceFile) {
  console.error('usage: npx tsx scripts/recover-project-elements.ts --project <id> --source <file.json> [--apply]');
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, '..');
const env: Record<string, string> = {};
for (const line of fs.readFileSync(path.join(repoRoot, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function flatten(project: CXDProject | null | undefined): { elements: CanvasElement[]; edges: CanvasEdge[] } {
  return {
    elements: project?.canvasLayout?.elements ?? [],
    edges: project?.canvasLayout?.edges ?? [],
  };
}

(async () => {
  const raw = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  const oldProject: CXDProject = (raw.project_data ?? raw) as CXDProject;
  const old = flatten(oldProject);
  if (old.elements.length === 0) {
    console.error('Source contains no elements — wrong file?');
    process.exit(1);
  }

  const { data: row, error } = await admin
    .from('cxd_projects')
    .select('yjs_state, project_data, name')
    .eq('id', projectId)
    .maybeSingle();
  if (error || !row) {
    console.error('Failed to load live project:', error?.message ?? 'not found');
    process.exit(1);
  }

  const doc = createProjectYDoc();
  if (row.yjs_state) {
    Y.applyUpdate(doc, new Uint8Array(Buffer.from(row.yjs_state as string, 'base64')), 'persistence');
  }
  const yElements = doc.getMap(YDOC_KEYS.ELEMENTS);
  const yEdges = doc.getMap(YDOC_KEYS.EDGES);
  const liveJson = flatten(row.project_data as CXDProject);
  const liveJsonIds = new Set(liveJson.elements.map((e) => e.id));

  const missingElements = old.elements.filter((e) => e?.id && !yElements.has(e.id) && !liveJsonIds.has(e.id));
  const missingEdges = old.edges.filter(
    (e) => e?.id && !yEdges.has(e.id) && !liveJson.edges.some((le) => le.id === e.id)
  );

  console.log(`Live "${row.name}": doc=${yElements.size} elements / json=${liveJson.elements.length}`);
  console.log(`Source: ${old.elements.length} elements, ${old.edges.length} edges`);
  console.log(`\nMissing from live (recoverable): ${missingElements.length} elements, ${missingEdges.length} edges`);
  for (const e of missingElements) {
    const preview = String((e as { content?: string }).content || (e as { title?: string }).title || '').slice(0, 60).replace(/\n/g, ' ');
    console.log(`  + ${String(e.id).slice(0, 8)} ${e.type} board=${((e as { boardId?: string }).boardId || 'root').slice(0, 8)} "${preview}"`);
  }

  if (missingElements.length === 0 && missingEdges.length === 0) {
    console.log('\nNothing to recover.');
    doc.destroy();
    return;
  }
  if (!apply) {
    console.log('\nDRY RUN — re-run with --apply to write.');
    doc.destroy();
    return;
  }

  // 1. Safety snapshot of the CURRENT state
  const { error: snapErr } = await admin.from('cxd_project_snapshots').insert({
    project_id: projectId,
    yjs_state: row.yjs_state,
    project_data: row.project_data,
    label: `Pre-recovery backup (before re-inserting ${missingElements.length} elements)`,
    element_count: liveJson.elements.length,
    edge_count: liveJson.edges.length,
  });
  if (snapErr) {
    console.error('ABORT: safety snapshot failed:', snapErr.message);
    process.exit(1);
  }

  // 2. Additive seed into the server-side doc
  doc.transact(() => {
    for (const el of missingElements) yElements.set(el.id, canvasElementToYMap(el));
    for (const edge of missingEdges) yEdges.set(edge.id, canvasEdgeToYMap(edge));
  }, 'recovery');

  // 3. Atomic dual-write, project_data derived from the SAME doc snapshot
  const nowIso = new Date().toISOString();
  const fromDoc = yDocToProject(doc);
  const base = (row.project_data ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(fromDoc as unknown as Record<string, unknown>)) {
    if (k === 'canvasLayout' || v === undefined) continue;
    merged[k] = v;
  }
  merged.canvasLayout = {
    ...((base.canvasLayout ?? {}) as Record<string, unknown>),
    ...Object.fromEntries(
      Object.entries((fromDoc.canvasLayout ?? {}) as unknown as Record<string, unknown>).filter(([, v]) => v !== undefined)
    ),
  };
  merged.updatedAt = nowIso;

  const base64 = Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64');
  doc.destroy();

  const { error: saveErr } = await admin
    .from('cxd_projects')
    .update({ yjs_state: base64, project_data: merged, updated_at: nowIso })
    .eq('id', projectId);
  if (saveErr) {
    console.error('WRITE FAILED (safety snapshot exists, live row untouched):', saveErr.message);
    process.exit(1);
  }
  console.log(`\n✓ Recovered ${missingElements.length} elements, ${missingEdges.length} edges.`);
  console.log('✓ Pre-recovery snapshot saved. Ask open tabs to reload the project.');
})();
