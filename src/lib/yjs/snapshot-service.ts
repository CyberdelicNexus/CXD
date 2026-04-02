'use client';

import { createClient } from '@/supabase/client';

export interface SnapshotMeta {
  id: string;
  project_id: string;
  label: string;
  created_by: string | null;
  created_at: string;
}

const MAX_SNAPSHOTS_PER_PROJECT = 20;

export async function createSnapshot(
  projectId: string,
  label: string,
  userId?: string
): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data: project, error: fetchError } = await supabase
      .from('cxd_projects')
      .select('yjs_state')
      .eq('id', projectId)
      .single();

    if (fetchError || !project?.yjs_state) {
      console.warn('[Snapshot] No yjs_state to snapshot for project:', projectId);
      return false;
    }

    const { error: insertError } = await supabase
      .from('cxd_project_snapshots')
      .insert({
        project_id: projectId,
        yjs_state: project.yjs_state,
        label,
        created_by: userId || null,
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
      .select('id, project_id, label, created_by, created_at')
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
      .select('yjs_state')
      .eq('id', snapshotId)
      .single();

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

async function pruneSnapshots(projectId: string): Promise<void> {
  try {
    const supabase = createClient();
    const { data: all, error } = await supabase
      .from('cxd_project_snapshots')
      .select('id')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error || !all) return;

    const toDelete = all.slice(MAX_SNAPSHOTS_PER_PROJECT);
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
