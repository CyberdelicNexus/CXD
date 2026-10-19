/**
 * Master Plan write path — mutates a task that lives inside a DIFFERENT
 * project's canvas data, from a page with no live Yjs connection to that
 * project.
 *
 * Mirrors the bridge's `apply-task-writeback.ts` (the only existing
 * precedent for "mutate a project from outside a live browser session"):
 * load `yjs_state` → reconstruct a server-side Y.Doc → mutate inside a
 * dedicated-origin transaction → re-derive `project_data` from the SAME
 * doc snapshot → atomic dual-write → best-effort realtime broadcast so any
 * open tab for that project picks up the change immediately. Patching
 * `project_data` alone (without touching `yjs_state`) would be silently
 * discarded by that project's next 2s-debounced Yjs autosave flush if it's
 * open live elsewhere — see SupabasePersistence in supabase-persistence.ts.
 *
 * Unlike the bridge, auth here is a real end-user session (checked by the
 * caller via resolveCanvasAccess before this module is invoked — this
 * function does not re-check ownership/collaborator access itself).
 */

import { YJS_FINGERPRINT_FIELD, fingerprintYjsState } from '@/lib/yjs/state-fingerprint';
import * as Y from 'yjs';
import { getSupabaseAdmin } from '@/supabase/admin';
import {
  createProjectYDoc,
  getYDocElement,
  getYDocElements,
  yDocToProject,
} from '@/lib/yjs/y-doc-factory';
import { YDOC_KEYS } from '@/lib/yjs/y-doc-types';
import { applyElementUpdates, canvasElementToYMap } from '@/lib/yjs/element-serializers';
import { randomUUID } from 'crypto';
import { uint8ArrayToBase64, base64ToUint8Array } from '@/lib/yjs/encoding-utils';
import { parseMarkdownTasks, updateSubtaskInContent } from '@/utils/task-engine';
import type { CXDProject } from '@/types/cxd-schema';
import type { CanvasElement, FreeformElement, TaskMetadata } from '@/types/canvas-elements';
import { buildTaskMetadataPatch, type MasterPlanTaskPatch } from '@/lib/master-plan/task-metadata-patch';

const ORIGIN = 'master-plan';
const SENDER_ID = 'master-plan';
const YJS_SYNC_EVENT = 'yjs_sync';

export type { MasterPlanTaskPatch };

export type ApplyOutcome = 'applied' | 'rejected' | 'error' | 'not_found' | 'unsupported';

export interface ApplyResult {
  outcome: ApplyOutcome;
  reason?: string;
}

/**
 * Task ids from the aggregator are either a raw element id, or — for cards
 * with multiple markdown checkboxes and no explicit taskMetadata.subtasks —
 * a synthetic `${elementId}-task-${index}` id (see task-engine.ts
 * projectElementAsTasks). Reverse that split here.
 */
function parseTaskId(taskId: string): { elementId: string; taskKey: string | null } {
  const match = taskId.match(/^(.*)-task-(\d+)$/);
  if (match) return { elementId: match[1], taskKey: `task-${match[2]}` };
  return { elementId: taskId, taskKey: null };
}

const updateContentTitle = (content: string, title: string): string => {
  const trimmed = title.trim();
  if (!trimmed) return content;
  const lines = (content || '').split('\n');
  lines[0] = trimmed;
  return lines.join('\n');
};

export async function applyMasterPlanTaskPatch(params: {
  projectId: string;
  taskId: string;
  patch: MasterPlanTaskPatch;
}): Promise<ApplyResult> {
  const { projectId, taskId, patch } = params;
  const { elementId, taskKey } = parseTaskId(taskId);
  const loaded = await loadProjectDoc(projectId);
  if ('outcome' in loaded) return loaded;
  const { doc, row } = loaded;

  const targetElement = getYDocElement(doc, elementId);
  const yElements = doc.getMap(YDOC_KEYS.ELEMENTS);
  const yEl = yElements.get(elementId);
  if (!targetElement || !(yEl instanceof Y.Map)) {
    doc.destroy();
    return { outcome: 'not_found', reason: `Element ${elementId} not found on project ${projectId}` };
  }

  // A markdown-checkbox subtask row only supports a status toggle — everything
  // else about it (title text, due date, etc.) belongs to the parent card.
  if (taskKey !== null) {
    const otherFields = Object.keys(patch).filter((k) => k !== 'status');
    if (otherFields.length > 0) {
      doc.destroy();
      return {
        outcome: 'unsupported',
        reason: `This task is a checklist item inside a card — only its status can be changed here. Open the card in the canvas to edit ${otherFields.join(', ')}.`,
      };
    }
    const contentField = yEl.get('content');
    const currentContent =
      contentField instanceof Y.Text ? contentField.toString() : typeof contentField === 'string' ? contentField : '';
    const subtasks = parseMarkdownTasks(currentContent);
    const index = parseInt(taskKey.replace('task-', ''), 10);
    const subtask = subtasks[index];
    if (!subtask) {
      doc.destroy();
      return { outcome: 'not_found', reason: `taskKey ${taskKey} no longer resolves to a checkbox line — the card may have been edited.` };
    }
  }

  let capturedUpdate: Uint8Array | null = null;
  const captureHandler = (update: Uint8Array, origin: unknown) => {
    if (origin === ORIGIN) {
      capturedUpdate = capturedUpdate ? Y.mergeUpdates([capturedUpdate, update]) : update;
    }
  };
  doc.on('update', captureHandler);

  try {
    doc.transact(() => {
      if (taskKey !== null) {
        const contentField = yEl.get('content');
        const currentContent =
          contentField instanceof Y.Text ? contentField.toString() : typeof contentField === 'string' ? contentField : '';
        const subtasks = parseMarkdownTasks(currentContent);
        const index = parseInt(taskKey.replace('task-', ''), 10);
        const subtask = subtasks[index];
        if (subtask && patch.status !== undefined) {
          const newContent = updateSubtaskInContent(currentContent, subtask.lineIndex, patch.status === 'completed');
          applyElementUpdates(yEl, { content: newContent } as Partial<CanvasElement>);
        }
        return;
      }

      const elementUpdates: Partial<CanvasElement> = {};

      if (patch.title !== undefined && 'content' in targetElement && typeof (targetElement as any).content === 'string') {
        (elementUpdates as any).content = updateContentTitle((targetElement as any).content, patch.title);
      }
      if (patch.hypercubeTags !== undefined) {
        (elementUpdates as any).hypercubeTags = patch.hypercubeTags;
      }

      const metadataPatch = buildTaskMetadataPatch(patch);
      if (Object.keys(metadataPatch.set).length > 0) {
        (elementUpdates as any).taskMetadata = metadataPatch.set;
      }

      if (Object.keys(elementUpdates).length > 0) {
        applyElementUpdates(yEl, elementUpdates);
      }

      // applyElementUpdates skips undefined values, so clearing a field has
      // to delete its key from the nested taskMetadata map directly.
      const yMeta = yEl.get('taskMetadata');
      if (metadataPatch.clear.length > 0 && yMeta instanceof Y.Map) {
        for (const key of metadataPatch.clear) yMeta.delete(key);
      }
    }, ORIGIN);
  } finally {
    doc.off('update', captureHandler);
  }

  return persistProjectDoc(projectId, row, doc, capturedUpdate);
}

type ProjectRow = { yjs_state: string | null; project_data: CXDProject | null };

/** Load a project's row and decode its yjs_state into a fresh server-side Y.Doc. */
async function loadProjectDoc(projectId: string): Promise<{ doc: Y.Doc; row: ProjectRow } | ApplyResult> {
  const admin = getSupabaseAdmin();
  const { data: row, error: loadError } = await admin
    .from('cxd_projects')
    .select('yjs_state, project_data')
    .eq('id', projectId)
    .maybeSingle();

  if (loadError) return { outcome: 'error', reason: `Failed to load project: ${loadError.message}` };
  if (!row) return { outcome: 'not_found', reason: `Project ${projectId} not found` };

  const doc = createProjectYDoc();
  if (row.yjs_state) {
    try {
      Y.applyUpdate(doc, base64ToUint8Array(row.yjs_state as string), 'persistence');
    } catch (err) {
      doc.destroy();
      return { outcome: 'error', reason: `Corrupt yjs_state, failed to decode: ${String(err)}` };
    }
  }
  return { doc, row: row as ProjectRow };
}

/**
 * Persist a mutated doc: wipe guard, atomic dual-write of yjs_state +
 * project_data from the same snapshot, then a best-effort realtime
 * broadcast of just the captured update. Destroys the doc.
 */
async function persistProjectDoc(
  projectId: string,
  row: ProjectRow,
  doc: Y.Doc,
  capturedUpdate: Uint8Array | null
): Promise<ApplyResult> {
  const admin = getSupabaseAdmin();

  // Wipe guard — mirrors SupabasePersistence/bridge: refuse to persist if the
  // doc we just decoded looks empty relative to what was last saved.
  const baseElementCount = row.project_data?.canvasLayout?.elements?.length ?? 0;
  const docElementCount = getYDocElements(doc).length;
  if (baseElementCount > 0 && docElementCount === 0) {
    doc.destroy();
    return {
      outcome: 'rejected',
      reason: `Wipe guard: project_data had ${baseElementCount} element(s) but decoded yjs_state has 0 — refusing to persist.`,
    };
  }

  const merged = Y.encodeStateAsUpdate(doc);
  const base64State = uint8ArrayToBase64(merged);
  const nowIso = new Date().toISOString();
  const fromDoc = yDocToProject(doc);
  const projectData = {
    ...mergeProjectionOverBase(row.project_data, fromDoc, nowIso),
    [YJS_FINGERPRINT_FIELD]: fingerprintYjsState(base64State),
  } as CXDProject;
  doc.destroy();

  const { error: saveError } = await admin
    .from('cxd_projects')
    .update({ yjs_state: base64State, project_data: projectData, updated_at: nowIso })
    .eq('id', projectId);

  if (saveError) return { outcome: 'error', reason: `Failed to persist: ${saveError.message}` };

  if (capturedUpdate) {
    await broadcastUpdate(projectId, capturedUpdate);
  }

  return { outcome: 'applied' };
}

/**
 * Create a task card in a project's Task Inbox — the same shape the canvas
 * Plan tab creates (an actionable freeform task card, unplaced), so the task
 * shows up in the canvas inbox for the user to place later.
 *
 * Refuses projects with no yjs_state: persisting a doc that holds only the
 * new card would make it the project's entire live canvas.
 */
export async function createMasterPlanTask(params: {
  projectId: string;
  title: string;
  metadata: Partial<TaskMetadata>;
}): Promise<ApplyResult & { taskId?: string }> {
  const { projectId, title, metadata } = params;

  const loaded = await loadProjectDoc(projectId);
  if ('outcome' in loaded) return loaded;
  const { doc, row } = loaded;

  if (!row.yjs_state) {
    doc.destroy();
    return {
      outcome: 'unsupported',
      reason: 'Open this project in the canvas once before adding tasks to it from the Master Plan.',
    };
  }
  const baseElementCount = row.project_data?.canvasLayout?.elements?.length ?? 0;
  if (baseElementCount > 0 && getYDocElements(doc).length === 0) {
    doc.destroy();
    return { outcome: 'rejected', reason: 'Wipe guard: decoded yjs_state has no elements — refusing to add to it.' };
  }

  const element: FreeformElement = {
    id: randomUUID(),
    type: 'freeform',
    cardType: 'task',
    content: title,
    emoji: '📌',
    x: 0,
    y: 0,
    width: 300,
    height: 100,
    zIndex: Date.now(),
    hypercubeTags: [],
    inInbox: true,
    taskMetadata: { isActionable: true, status: 'not_started', ...metadata },
  };

  let capturedUpdate: Uint8Array | null = null;
  const captureHandler = (update: Uint8Array, origin: unknown) => {
    if (origin === ORIGIN) {
      capturedUpdate = capturedUpdate ? Y.mergeUpdates([capturedUpdate, update]) : update;
    }
  };
  doc.on('update', captureHandler);
  try {
    doc.transact(() => {
      doc.getMap(YDOC_KEYS.ELEMENTS).set(element.id, canvasElementToYMap(element));
    }, ORIGIN);
  } finally {
    doc.off('update', captureHandler);
  }

  const result = await persistProjectDoc(projectId, row, doc, capturedUpdate);
  return result.outcome === 'applied' ? { ...result, taskId: element.id } : result;
}

async function broadcastUpdate(projectId: string, update: Uint8Array): Promise<void> {
  const admin = getSupabaseAdmin();
  const channel = admin.channel(`yjs:${projectId}`);
  try {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 3000);
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
      payload: { msgType: 'update', data: uint8ArrayToBase64(update), sender: SENDER_ID },
    });
  } catch (err) {
    console.error('[master-plan] Broadcast failed (non-fatal — DB write already committed):', err);
  } finally {
    try {
      await admin.removeChannel(channel);
    } catch {
      // best-effort cleanup
    }
  }
}

// Mirrors mergeProjectionOverBase in bridge/apply-task-writeback.ts — same
// shape, independently maintained per that module's own note about not
// sharing the private mergeProjectWithDoc in supabase-persistence.ts.
const PROTECTED_META_FIELDS = new Set(['id', 'name', 'ownerId', 'createdAt', 'schemaVersion']);

function mergeProjectionOverBase(base: CXDProject | null, fromDoc: CXDProject, savedAt: string): CXDProject {
  const merged: Record<string, unknown> = { ...((base ?? {}) as unknown as Record<string, unknown>) };

  for (const [key, value] of Object.entries(fromDoc as unknown as Record<string, unknown>)) {
    if (key === 'canvasLayout') continue;
    if (value === undefined) continue;
    if (PROTECTED_META_FIELDS.has(key) && !value) continue;
    merged[key] = value;
  }

  const canvasLayout: Record<string, unknown> = { ...((base?.canvasLayout ?? {}) as unknown as Record<string, unknown>) };
  for (const [key, value] of Object.entries((fromDoc.canvasLayout ?? {}) as unknown as Record<string, unknown>)) {
    if (value === undefined) continue;
    canvasLayout[key] = value;
  }
  merged.canvasLayout = canvasLayout;
  merged.updatedAt = savedAt;

  return merged as unknown as CXDProject;
}
