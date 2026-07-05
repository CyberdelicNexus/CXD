/**
 * Bridge write-back apply logic.
 *
 * Implements C2_CANVAS_BRIDGE.md §1 Direction 2 steps 3-7 / PS2_CANVAS_BRIDGE.md
 * B2(i)-B8. This module is only ever called AFTER the route has already
 * verified the token, checked the project allowlist, and asserted
 * `cxd_projects.owner_id === BRIDGE_OWNER_UID` — this function itself does
 * NOT re-check ownership; callers own that gate.
 *
 * Steps:
 *   1. Load `yjs_state` (+ `project_data`, used only as the wipe-guard baseline)
 *   2. Reconstruct the Y.Doc via the same factory the app uses
 *   3. Locate the element (+ sub-checkbox line via taskKey)
 *   4. Apply ONLY status/dueDate inside `doc.transact(fn, 'bridge')`
 *   5. Wipe guard — refuse to persist if the doc looks empty/corrupt
 *   6. Re-encode + re-derive project_data (same shape as SupabasePersistence),
 *      atomic dual-write
 *   7. Broadcast the incremental update on the `yjs_sync` channel with the
 *      same message shape live clients already expect from a remote peer
 */

import * as Y from 'yjs';
import { getSupabaseAdmin } from '@/supabase/admin';
import {
  createProjectYDoc,
  getYDocElement,
  getYDocElements,
  yDocToProject,
} from '@/lib/yjs/y-doc-factory';
import { YDOC_KEYS } from '@/lib/yjs/y-doc-types';
import { applyElementUpdates } from '@/lib/yjs/element-serializers';
import { uint8ArrayToBase64, base64ToUint8Array } from '@/lib/yjs/encoding-utils';
import { parseMarkdownTasks, updateSubtaskInContent } from '@/utils/task-engine';
import type { CXDProject } from '@/types/cxd-schema';
import type { CanvasElement } from '@/types/canvas-elements';
import type { WritebackPatch } from './bridge-validate';

// Origin tag for our transact() calls. The client-side updateHandler in
// supabase-yjs-provider.ts only skips broadcasting local updates for origins
// 'remote' | 'initialization' | 'persistence' | (object instances, e.g.
// y-indexeddb's provider-as-origin) — but that logic runs in the BROWSER's
// own doc, not this server-side one, so it's irrelevant here. What matters
// on this side is that we broadcast with `sender: BRIDGE_SENDER_ID`, a value
// that will never equal any live client's `userId` — the provider's
// `msg.sender === this.userId` self-echo guard (supabase-yjs-provider.ts)
// only filters a peer's OWN messages, so a distinct sender id guarantees
// every live tab actually applies (never ignores) the bridge's update.
const BRIDGE_ORIGIN = 'bridge';
const BRIDGE_SENDER_ID = 'bridge';
const YJS_SYNC_EVENT = 'yjs_sync';

export type ApplyOutcome = 'applied' | 'rejected' | 'error' | 'not_found';

export interface ApplyResult {
  outcome: ApplyOutcome;
  reason?: string;
  newUpdatedAt?: string;
}

export async function applyTaskWriteback(params: {
  projectId: string;
  elementId: string;
  taskKey: string | null;
  patch: WritebackPatch;
}): Promise<ApplyResult> {
  const { projectId, elementId, taskKey, patch } = params;
  const admin = getSupabaseAdmin();

  // ── 1. Load current state ──
  const { data: row, error: loadError } = await admin
    .from('cxd_projects')
    .select('yjs_state, project_data')
    .eq('id', projectId)
    .maybeSingle();

  if (loadError) {
    return { outcome: 'error', reason: `Failed to load project: ${loadError.message}` };
  }
  if (!row) {
    return { outcome: 'not_found', reason: `Project ${projectId} not found` };
  }

  // ── 2. Reconstruct the Y.Doc ──
  const doc = createProjectYDoc();
  if (row.yjs_state) {
    try {
      Y.applyUpdate(doc, base64ToUint8Array(row.yjs_state as string), 'persistence');
    } catch (err) {
      doc.destroy();
      return { outcome: 'error', reason: `Corrupt yjs_state, failed to decode: ${String(err)}` };
    }
  }

  // ── 3. Locate the element ──
  const targetElement = getYDocElement(doc, elementId);
  const yElements = doc.getMap(YDOC_KEYS.ELEMENTS);
  const yEl = yElements.get(elementId);
  if (!targetElement || !(yEl instanceof Y.Map)) {
    doc.destroy();
    return { outcome: 'not_found', reason: `Element ${elementId} not found on project ${projectId}` };
  }

  if (taskKey !== null) {
    const check = resolveSubCheckboxTarget(yEl, taskKey);
    if (!check.ok) {
      doc.destroy();
      return { outcome: 'not_found', reason: check.reason };
    }
  }

  // ── 4. Apply inside a single 'bridge'-origin transaction, capturing the
  //         incremental update it produces for broadcast in step 7 ──
  let capturedUpdate: Uint8Array | null = null;
  const captureHandler = (update: Uint8Array, origin: unknown) => {
    if (origin === BRIDGE_ORIGIN) {
      capturedUpdate = capturedUpdate ? Y.mergeUpdates([capturedUpdate, update]) : update;
    }
  };
  doc.on('update', captureHandler);

  try {
    doc.transact(() => {
      if (taskKey === null) {
        // Whole-element patch: status/dueDate live under taskMetadata.
        const taskMetadataPatch: Record<string, unknown> = {};
        if (patch.status !== undefined) taskMetadataPatch.status = patch.status;
        if (patch.dueDate !== undefined) taskMetadataPatch.dueDate = patch.dueDate;
        applyElementUpdates(yEl, { taskMetadata: taskMetadataPatch } as Partial<CanvasElement>);
      } else {
        // Sub-checkbox: rewrite the matching markdown line's checkbox state.
        // (Validated + prepared above in applySubCheckboxPatch; only status
        // is meaningful here — bridge-validate.ts already rejects a dueDate
        // patch when taskKey is set.)
        const contentField = yEl.get('content');
        const currentContent =
          contentField instanceof Y.Text ? contentField.toString() : typeof contentField === 'string' ? contentField : '';
        const subtasks = parseMarkdownTasks(currentContent);
        const index = parseInt(taskKey.replace('task-', ''), 10);
        const subtask = subtasks[index];
        if (subtask && patch.status !== undefined) {
          const isCompleted = patch.status === 'completed';
          const newContent = updateSubtaskInContent(currentContent, subtask.lineIndex, isCompleted);
          applyElementUpdates(yEl, { content: newContent } as Partial<CanvasElement>);
        }
      }
    }, BRIDGE_ORIGIN);
  } finally {
    doc.off('update', captureHandler);
  }

  // ── 5. Wipe guard (PS2 B8) ──
  // Mirrors SupabasePersistence's check in src/lib/yjs/supabase-persistence.ts
  // (`baseElementCount > 0 && docElementCount === 0` → skip save): if the
  // last-persisted project_data shows this project HAD elements, but the
  // yjs_state we just decoded now projects zero, the state we loaded is
  // suspect (corrupt/partial read) — refuse to persist over real data rather
  // than silently wiping the canvas.
  const baseElementCount = (row.project_data as CXDProject | null)?.canvasLayout?.elements?.length ?? 0;
  const docElementCount = getYDocElements(doc).length;
  if (baseElementCount > 0 && docElementCount === 0) {
    doc.destroy();
    return {
      outcome: 'rejected',
      reason: `Wipe guard: project_data had ${baseElementCount} element(s) but decoded yjs_state has 0 — refusing to persist (likely corrupt/partial yjs_state read).`,
    };
  }

  // ── 6. Re-encode + re-derive project_data, atomic dual-write ──
  const merged = Y.encodeStateAsUpdate(doc);
  const base64State = uint8ArrayToBase64(merged);
  const nowIso = new Date().toISOString();
  const fromDoc = yDocToProject(doc);
  const projectData = mergeProjectionOverBase(row.project_data as CXDProject | null, fromDoc, nowIso);
  doc.destroy();

  const { error: saveError } = await admin
    .from('cxd_projects')
    .update({
      yjs_state: base64State,
      project_data: projectData,
      updated_at: nowIso,
    })
    .eq('id', projectId);

  if (saveError) {
    return { outcome: 'error', reason: `Failed to persist: ${saveError.message}` };
  }

  // ── 7. Broadcast (best-effort — DB write above is the source of truth) ──
  if (capturedUpdate) {
    await broadcastUpdate(projectId, capturedUpdate);
  }

  return { outcome: 'applied', newUpdatedAt: nowIso };
}

/**
 * Pre-flight check for a sub-checkbox patch: confirms the taskKey's index
 * resolves to an actual markdown checkbox line in the element's current
 * content. Returns ok:false (caller maps to 404) if it doesn't — e.g. the
 * card was edited since LifeOS last read it and that checkbox no longer
 * exists at that index. (bridge-validate.ts already guarantees `patch.status`
 * is present whenever taskKey is set — dueDate-only patches on a sub-checkbox
 * are rejected before this module is ever called.)
 */
function resolveSubCheckboxTarget(yEl: Y.Map<unknown>, taskKey: string): { ok: true } | { ok: false; reason: string } {
  const contentField = yEl.get('content');
  const currentContent =
    contentField instanceof Y.Text ? contentField.toString() : typeof contentField === 'string' ? contentField : '';
  const subtasks = parseMarkdownTasks(currentContent);
  const index = parseInt(taskKey.replace('task-', ''), 10);
  if (!Number.isInteger(index) || !subtasks[index]) {
    return { ok: false, reason: `taskKey ${taskKey} does not resolve to a checkbox line on the current element content` };
  }
  return { ok: true };
}

async function broadcastUpdate(projectId: string, update: Uint8Array): Promise<void> {
  const admin = getSupabaseAdmin();
  const channel = admin.channel(`yjs:${projectId}`);
  try {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 3000); // don't hang if realtime is unavailable
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    await channel.send({
      type: 'broadcast',
      event: YJS_SYNC_EVENT,
      payload: {
        msgType: 'update',
        data: uint8ArrayToBase64(update),
        sender: BRIDGE_SENDER_ID,
      },
    });
  } catch (err) {
    // Broadcast is best-effort. The DB write (source of truth) already
    // committed above — a live tab that misses this will still converge on
    // its own next poll/reload. Only the sub-second stale-flush race window
    // (C2 §2) is uncovered when broadcast fails; the periodic reconciliation
    // poller (Phase A) closes any longer-lived drift.
    console.error('[bridge] Broadcast failed (non-fatal — DB write already committed):', err);
  } finally {
    try {
      await admin.removeChannel(channel);
    } catch {
      // best-effort cleanup
    }
  }
}

// ─── project_data derivation ────────────────────────────────────────────────

/**
 * Mirrors `mergeProjectWithDoc` in src/lib/yjs/supabase-persistence.ts (not
 * exported there — re-implemented here rather than modifying that shared
 * file, since C2 §5 restricts this workstream to its own designated bridge
 * files). Keep in sync if that logic changes.
 *
 * The Y.Doc is authoritative for everything it stores; fields that live only
 * in the base project_data JSON (comments/versions/okrs already round-trip
 * through the doc via yDocToProject, but anything schema-future not yet
 * mirrored into the doc rides along from base) are preserved.
 */
const PROTECTED_META_FIELDS = new Set(['id', 'name', 'ownerId', 'createdAt', 'schemaVersion']);

function mergeProjectionOverBase(base: CXDProject | null, fromDoc: CXDProject, savedAt: string): CXDProject {
  const merged: Record<string, unknown> = { ...((base ?? {}) as unknown as Record<string, unknown>) };

  for (const [key, value] of Object.entries(fromDoc as unknown as Record<string, unknown>)) {
    if (key === 'canvasLayout') continue; // merged separately below
    if (value === undefined) continue;
    if (PROTECTED_META_FIELDS.has(key) && !value) continue;
    merged[key] = value;
  }

  const canvasLayout: Record<string, unknown> = {
    ...((base?.canvasLayout ?? {}) as unknown as Record<string, unknown>),
  };
  for (const [key, value] of Object.entries((fromDoc.canvasLayout ?? {}) as unknown as Record<string, unknown>)) {
    if (value === undefined) continue;
    canvasLayout[key] = value;
  }
  merged.canvasLayout = canvasLayout;
  merged.updatedAt = savedAt;

  return merged as unknown as CXDProject;
}
