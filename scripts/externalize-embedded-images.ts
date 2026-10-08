/**
 * One-off migration: move base64 data:image URIs embedded in cxd_projects out
 * to Supabase Storage and replace them with public URLs, in BOTH project_data
 * and yjs_state (they must stay in step, see CLAUDE.md "Save architecture").
 *
 * Usage:
 *   npx tsx scripts/externalize-embedded-images.ts                       # dry-run, all projects
 *   npx tsx scripts/externalize-embedded-images.ts --project <id>        # dry-run, one project
 *   npx tsx scripts/externalize-embedded-images.ts --project <id> --apply
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 *
 * Before running with --apply: close every tab/session that has the project
 * open (an open tab would autosave its old base64 state back over the result),
 * and ideally take a Supabase backup. The script also:
 *   1. Inserts a full snapshot of the current row into cxd_project_snapshots
 *      and writes a JSON copy under ./migration-backups/ (aborts if either fails).
 *   2. Uploads each distinct image (content-addressed, so re-runs are idempotent).
 *   3. Rewrites yjs_state and project_data from the same pass and refuses to
 *      write if any data URI would remain or the element/edge counts changed.
 * updated_at is left untouched so dashboard ordering does not move.
 */
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import * as Y from 'yjs';
import { createClient } from '@supabase/supabase-js';
import { createProjectYDoc, yDocToProject } from '../src/lib/yjs/y-doc-factory';
import { fingerprintYjsState, YJS_FINGERPRINT_FIELD } from '../src/lib/yjs/state-fingerprint';
import {
  collectDataUris,
  collectDocDataUris,
  replaceDataUris,
  rewriteDoc,
  mimeToExt,
} from '../src/lib/embedded-image-rewrite';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const onlyProject = arg('project');
const apply = process.argv.includes('--apply');

const repoRoot = path.resolve(__dirname, '..');
const env: Record<string, string> = {};
for (const line of fs.readFileSync(path.join(repoRoot, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BUCKET = 'canvas-uploads';

const mb = (n: number) => `${(n / 1048576).toFixed(2)} MB`;
const countOf = (p: any) => [p?.canvasLayout?.elements?.length ?? 0, p?.canvasLayout?.edges?.length ?? 0];

async function uploadOne(projectId: string, uri: string): Promise<string> {
  const { ext, contentType } = mimeToExt(uri);
  const buf = Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64');
  const hash = createHash('sha1').update(buf).digest('hex');
  const objectPath = `canvas-images/migrated/${projectId}/${hash}.${ext}`;
  const { error } = await admin.storage.from(BUCKET).upload(objectPath, buf, {
    contentType,
    cacheControl: '31536000',
    upsert: true,
  });
  if (error) throw new Error(`upload failed (${objectPath}): ${error.message}`);
  return admin.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
}

async function processProject(id: string): Promise<void> {
  const { data: row, error } = await admin
    .from('cxd_projects')
    .select('id, name, yjs_state, project_data, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error || !row) throw new Error(`load failed: ${error?.message ?? 'not found'}`);

  const doc = createProjectYDoc();
  if (row.yjs_state) Y.applyUpdate(doc, new Uint8Array(Buffer.from(row.yjs_state as string, 'base64')), 'persistence');

  const uris = new Set<string>(Array.from(collectDataUris(row.project_data)).concat(Array.from(collectDocDataUris(doc))));
  const jsonBytes = JSON.stringify(row.project_data ?? {}).length;
  const stateBytes = (row.yjs_state as string | null)?.length ?? 0;
  console.log(`\n"${row.name}" (${id})`);
  console.log(`  project_data ${mb(jsonBytes)}, yjs_state ${mb(stateBytes)}, ${uris.size} embedded image(s)`);
  if (uris.size === 0) {
    console.log('  nothing to do');
    doc.destroy();
    return;
  }
  const embeddedBytes = Array.from(uris).reduce((s, u) => s + u.length, 0);
  console.log(`  embedded payload: ${mb(embeddedBytes)} (distinct)`);
  if (!apply) {
    doc.destroy();
    return;
  }

  // 1. Backups first. Abort on any failure.
  const backupDir = path.join(repoRoot, 'migration-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `${id}-${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(row));
  const [beforeEls, beforeEdges] = countOf(row.project_data);
  const { error: snapErr } = await admin.from('cxd_project_snapshots').insert({
    project_id: id,
    yjs_state: row.yjs_state,
    project_data: row.project_data,
    label: `Pre-externalize-images backup (${uris.size} embedded images)`,
    element_count: beforeEls,
    edge_count: beforeEdges,
  });
  if (snapErr) throw new Error(`ABORT: snapshot failed: ${snapErr.message}`);
  console.log(`  backup: ${backupFile} + cxd_project_snapshots row`);

  // 2. Upload
  const map = new Map<string, string>();
  for (const uri of Array.from(uris)) map.set(uri, await uploadOne(id, uri));
  console.log(`  uploaded ${map.size} image(s)`);

  // 3. Rewrite both stores from the same map
  const docElsBefore = yDocToProject(doc).canvasLayout?.elements?.length ?? 0;
  rewriteDoc(doc, map);
  const newProjectData = replaceDataUris(row.project_data ?? {}, map) as Record<string, unknown>;
  const base64 = Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64');
  newProjectData[YJS_FINGERPRINT_FIELD] = fingerprintYjsState(base64);

  // Safety checks before writing anything
  const leftover = new Set<string>(Array.from(collectDataUris(newProjectData)).concat(Array.from(collectDocDataUris(doc))));
  if (leftover.size > 0) throw new Error(`ABORT: ${leftover.size} data URI(s) would remain; nothing written`);
  const [afterEls, afterEdges] = countOf(newProjectData);
  const docElsAfter = yDocToProject(doc).canvasLayout?.elements?.length ?? 0;
  if (afterEls !== beforeEls || afterEdges !== beforeEdges || docElsAfter !== docElsBefore) {
    throw new Error(`ABORT: element/edge counts changed (${beforeEls}/${beforeEdges} -> ${afterEls}/${afterEdges}); nothing written`);
  }
  doc.destroy();

  const { error: saveErr } = await admin
    .from('cxd_projects')
    .update({ yjs_state: base64, project_data: newProjectData })
    .eq('id', id)
    .eq('updated_at', row.updated_at as string); // fail if a tab saved in the meantime
  if (saveErr) throw new Error(`WRITE FAILED (row untouched, backup exists): ${saveErr.message}`);
  console.log(`  ✓ rewritten: project_data ${mb(JSON.stringify(newProjectData).length)}, yjs_state ${mb(base64.length)}`);
}

(async () => {
  console.log(apply ? 'APPLY MODE' : 'DRY RUN (add --apply to write)');
  let ids: string[];
  if (onlyProject) ids = [onlyProject];
  else {
    const { data, error } = await admin.from('cxd_projects').select('id');
    if (error) throw new Error(error.message);
    ids = (data ?? []).map((r: { id: string }) => r.id);
  }
  let failures = 0;
  for (const id of ids) {
    try {
      await processProject(id);
    } catch (e) {
      failures++;
      console.error(`  ✗ ${id}: ${(e as Error).message}`);
    }
  }
  console.log(failures ? `\nDone with ${failures} failure(s).` : '\nDone.');
  process.exit(failures ? 1 : 0);
})();
