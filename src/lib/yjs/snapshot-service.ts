'use client';

import { createClient } from '@/supabase/client';

export interface SnapshotMeta {
  id: string;
  project_id: string;
  label: string;
  created_by: string | null;
  created_at: string;
  element_count: number | null;
  edge_count: number | null;
}

// Listing cap for the restore UI — must cover the full retention set
// (MAX_RECENT + dailies + protected manual/server-guard rows; see pruneSnapshots).
const MAX_SNAPSHOTS_PER_PROJECT = 80;

// Labels that mark high-value snapshots: kept for PROTECTED_DAYS regardless of
// the age tiers, and never deduped away.
const PROTECTED_PREFIXES = ['Manual', 'Server guard', 'Pre-restore', 'Pre-reconcile'];
const PROTECTED_DAYS = 90;

function isProtectedLabel(label: string): boolean {
  return PROTECTED_PREFIXES.some((p) => label.startsWith(p));
}

/**
 * FNV-1a over the base64 yjs_state. Cheap (single pass, no allocation) even on
 * multi-MB strings — this is what lets every snapshot call site stay in place
 * while identical-content snapshots become no-ops instead of DB spam.
 */
function contentHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16) + ':' + s.length.toString(16);
}

export async function createSnapshot(
  projectId: string,
  label: string,
  userId?: string
): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data: project, error: fetchError } = await supabase
      .from('cxd_projects')
      .select('yjs_state, project_data')
      .eq('id', projectId)
      .single();

    if (fetchError || !project?.yjs_state) {
      console.warn('[Snapshot] No yjs_state to snapshot for project:', projectId);
      return false;
    }

    const hash = contentHash(project.yjs_state as string);

    // Dedup: identical content to the newest snapshot → skip. Manual
    // checkpoints are exempt (the user explicitly asked for a marker, and the
    // label itself carries meaning even over identical content).
    if (!label.startsWith('Manual')) {
      const { data: latest } = await supabase
        .from('cxd_project_snapshots')
        .select('content_hash')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest?.content_hash === hash) {
        return true; // already captured — nothing changed since
      }
    }

    const layout = (project.project_data as { canvasLayout?: { elements?: unknown[]; edges?: unknown[] } } | null)
      ?.canvasLayout;

    const { error: insertError } = await supabase
      .from('cxd_project_snapshots')
      .insert({
        project_id: projectId,
        yjs_state: project.yjs_state,
        label,
        created_by: userId || null,
        content_hash: hash,
        element_count: layout?.elements?.length ?? null,
        edge_count: layout?.edges?.length ?? null,
      });

    if (insertError) {
      console.error('[Snapshot] Failed to create snapshot:', insertError);
      return false;
    }

    await pruneSnapshots(projectId);
    console.log('[Snapshot] Created:', label, 'for project:', projectId);
    return true;
  } catch (err) {
    console.error('[Snapshot] Error creating snapshot:', err);
    return false;
  }
}

export async function listSnapshots(projectId: string): Promise<SnapshotMeta[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('cxd_project_snapshots')
      .select('id, project_id, label, created_by, created_at, element_count, edge_count')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(MAX_SNAPSHOTS_PER_PROJECT);

    if (error) {
      console.error('[Snapshot] Failed to list snapshots:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[Snapshot] Error listing snapshots:', err);
    return [];
  }
}

export async function restoreSnapshot(
  snapshotId: string,
  doc: import('yjs').Doc
): Promise<boolean> {
  try {
    const Y = await import('yjs');
    const supabase = createClient();

    const { data, error } = await supabase
      .from('cxd_project_snapshots')
      .select('yjs_state, project_id')
      .eq('id', snapshotId)
      .single();

    // Restoring must never itself be a data-loss event: capture the current
    // state first, so a wrong-snapshot restore is always one more restore away
    // from undone. Best-effort — a failed backup shouldn't block a restore the
    // user explicitly confirmed.
    if (data?.project_id) {
      await createSnapshot(data.project_id, 'Pre-restore backup').catch(() => {});
    }

    if (error || !data?.yjs_state) {
      console.error('[Snapshot] Failed to load snapshot:', error);
      return false;
    }

    const binary = Uint8Array.from(atob(data.yjs_state), (c) => c.charCodeAt(0));
    const snapshotDoc = new Y.Doc();
    Y.applyUpdate(snapshotDoc, binary);

    doc.transact(() => {
      const yElements = doc.getMap('elements');
      yElements.forEach((_, key) => yElements.delete(key));

      const yEdges = doc.getMap('edges');
      yEdges.forEach((_, key) => yEdges.delete(key));

      const snapElements = snapshotDoc.getMap('elements');
      snapElements.forEach((value, key) => {
        yElements.set(key, value instanceof Y.Map ? value.clone() : value);
      });

      const snapEdges = snapshotDoc.getMap('edges');
      snapEdges.forEach((value, key) => {
        yEdges.set(key, value instanceof Y.Map ? value.clone() : value);
      });

      const snapMeta = snapshotDoc.getMap('meta');
      const yMeta = doc.getMap('meta');
      snapMeta.forEach((value, key) => {
        yMeta.set(key, value);
      });

      const snapRP = snapshotDoc.getArray('realityPlanesV2');
      const yRP = doc.getArray('realityPlanesV2');
      if (snapRP.length > 0) {
        yRP.delete(0, yRP.length);
        for (let i = 0; i < snapRP.length; i++) {
          const item = snapRP.get(i);
          yRP.push([item instanceof Y.Map ? item.clone() : item]);
        }
      }

      const snapStages = snapshotDoc.getArray('experienceFlowStages');
      const yStages = doc.getArray('experienceFlowStages');
      if (snapStages.length > 0) {
        yStages.delete(0, yStages.length);
        for (let i = 0; i < snapStages.length; i++) {
          const item = snapStages.get(i);
          yStages.push([item instanceof Y.Map ? item.clone() : item]);
        }
      }
    }, 'snapshot-restore');

    snapshotDoc.destroy();
    console.log('[Snapshot] Restored snapshot:', snapshotId);
    return true;
  } catch (err) {
    console.error('[Snapshot] Error restoring snapshot:', err);
    return false;
  }
}

export async function deleteSnapshot(snapshotId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('cxd_project_snapshots')
      .delete()
      .eq('id', snapshotId);

    if (error) {
      console.error('[Snapshot] Failed to delete snapshot:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Snapshot] Error deleting snapshot:', err);
    return false;
  }
}

/**
 * Age-tiered retention. The old policy (keep newest 20, ~30-min cadence) gave
 * only a ~7-hour recovery window — during the July 2026 data-loss incident
 * every retained snapshot postdated the loss, so nothing was recoverable.
 * New policy:
 *   - keep all snapshots from the last 24h (capped at MAX_RECENT)
 *   - keep the newest snapshot per UTC day for KEEP_DAILY_DAYS days back
 */
const MAX_RECENT = 30;
const KEEP_DAILY_DAYS = 14;

async function pruneSnapshots(projectId: string): Promise<void> {
  try {
    const supabase = createClient();
    const { data: all, error } = await supabase
      .from('cxd_project_snapshots')
      .select('id, created_at, label')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error || !all) return;

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const keep = new Set<string>();
    const dailyKept = new Set<string>();
    let recentKept = 0;

    for (const s of all) {
      const age = now - new Date(s.created_at).getTime();
      // High-value snapshots (manual checkpoints, server-guard archives,
      // pre-restore/pre-reconcile backups) survive the age tiers entirely.
      if (isProtectedLabel(s.label) && age <= PROTECTED_DAYS * dayMs) {
        keep.add(s.id);
        continue;
      }
      if (age <= dayMs && recentKept < MAX_RECENT) {
        keep.add(s.id);
        recentKept++;
        continue;
      }
      if (age <= KEEP_DAILY_DAYS * dayMs) {
        // list is newest-first, so the first snapshot seen for a given UTC day
        // is that day's newest — keep it, drop the rest of that day
        const dayKey = new Date(s.created_at).toISOString().slice(0, 10);
        if (!dailyKept.has(dayKey)) {
          dailyKept.add(dayKey);
          keep.add(s.id);
        }
      }
    }

    const toDelete = all.filter((s) => !keep.has(s.id));
    if (toDelete.length === 0) return;

    const ids = toDelete.map((s) => s.id);
    await supabase
      .from('cxd_project_snapshots')
      .delete()
      .in('id', ids);

    console.log('[Snapshot] Pruned', ids.length, 'old snapshots');
  } catch (err) {
    console.error('[Snapshot] Error pruning snapshots:', err);
  }
}
