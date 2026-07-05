'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useCXDStore } from '@/store/cxd-store';
import { saveProject } from '@/lib/supabase-projects';
import { flushYjsPersistence } from '@/contexts/yjs-project-context';
import { CXDProject } from '@/types/cxd-schema';
import { emitSaveStatus } from '@/lib/save-status';

// Global state for sync status - accessible from other components
let pendingSavePromise: Promise<boolean> | null = null;
// Marker of the last successfully saved state — always the project's updatedAt
// (bumped by the store on every mutation). Never store a JSON hash here: the
// two representations previously got mixed, so the unsaved-changes check and
// the beforeunload warning could never match after a normal autosave.
let lastSavedHash: string | null = null;
let consecutiveSaveFailures = 0;

// Backup to localStorage for disaster recovery
const BACKUP_KEY = 'cxd_project_backup';

function backupToLocalStorage(project: CXDProject) {
  try {
    const backup = {
      project,
      timestamp: Date.now(),
    };
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
  } catch (e) {
    console.warn('[Sync] Failed to backup to localStorage:', e);
  }
}

export function getLocalBackup(): { project: CXDProject; timestamp: number } | null {
  try {
    const backup = localStorage.getItem(BACKUP_KEY);
    if (backup) {
      return JSON.parse(backup);
    }
  } catch (e) {
    console.warn('[Sync] Failed to read localStorage backup:', e);
  }
  return null;
}

export function clearLocalBackup() {
  try {
    localStorage.removeItem(BACKUP_KEY);
  } catch (e) {
    console.warn('[Sync] Failed to clear localStorage backup:', e);
  }
}

// Immediately save current project - call before navigation
export async function flushPendingSave(): Promise<boolean> {
  // Re-read the LATEST state from the store (Yjs bridge may have updated it)
  // Small delay to let any pending RAF bridge flushes complete
  await new Promise(resolve => requestAnimationFrame(resolve));

  const { projects, currentProjectId } = useCXDStore.getState();
  const currentProject = projects.find(p => p.id === currentProjectId);

  if (!currentProject) return true;

  // Never flush a listing-only stub — it would overwrite full project_data
  if ((currentProject as any)._listingOnly) return true;

  if (currentProject.updatedAt === lastSavedHash) return true;

  // Backup to localStorage first (synchronous)
  backupToLocalStorage(currentProject);

  // CRDT mode: the unified Yjs writer persists yjs_state + project_data
  // atomically from the same snapshot — flush it instead of a parallel
  // JSON write that could diverge.
  if (useCXDStore.getState().yDoc) {
    const flushed = await flushYjsPersistence();
    if (flushed) {
      lastSavedHash = currentProject.updatedAt;
      clearLocalBackup();
    }
    return flushed;
  }

  // If there's already a save in progress, wait for it
  if (pendingSavePromise) {
    await pendingSavePromise;
  }

  // Then save to database (JSON project_data)
  console.log('[Sync] Flushing pending save before navigation...');
  const success = await saveProject(currentProject);
  if (success) {
    lastSavedHash = currentProject.updatedAt;
    clearLocalBackup();
    emitSaveStatus({ status: 'saved', source: 'project' });
    console.log('[Sync] Flush successful');
  } else {
    emitSaveStatus({ status: 'error', source: 'project', message: 'Changes may not be saved. Check your connection.' });
    console.warn('[Sync] Flush failed, localStorage backup retained');
  }
  return success;
}

// Check if there are unsaved changes (lightweight check)
export function hasUnsavedChanges(): boolean {
  const { projects, currentProjectId } = useCXDStore.getState();
  const currentProject = projects.find(p => p.id === currentProjectId);
  if (!currentProject) return false;
  // Check if updatedAt changed since last save (set by store on every mutation)
  return currentProject.updatedAt !== lastSavedHash;
}

// Synchronous save for beforeunload - uses localStorage as reliable backup
function syncSaveOnUnload(project: CXDProject) {
  // Backup to localStorage (synchronous, reliable)
  backupToLocalStorage(project);

  if (useCXDStore.getState().yDoc) {
    // CRDT mode: the Yjs provider's own beforeunload handler flushes the
    // unified writer; a parallel JSON save here would race it.
    return;
  }

  // Also attempt async save (may complete before page fully unloads)
  saveProject(project).catch(() => {
    // Ignore errors, localStorage backup is the safety net
  });
}

export function useProjectSync() {
  const { projects, currentProjectId, setProjects } = useCXDStore();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const hasRestoredBackup = useRef(false);

  // Save function with deduplication and backup
  const performSave = useCallback(async (project: CXDProject) => {
    // Never save listing-only stubs
    if ((project as any)._listingOnly) return;

    // CRDT mode: delegate to the unified Yjs writer. It derives project_data
    // from the same Y.Doc snapshot as the binary and writes both atomically —
    // a parallel JSON save here would race it with divergent content. This
    // flush also captures Zustand-only fields (tour state, share settings)
    // via the merge base.
    if (useCXDStore.getState().yDoc) {
      backupToLocalStorage(project);
      const flushed = await flushYjsPersistence();
      if (flushed) {
        lastSavedHash = project.updatedAt;
        clearLocalBackup();
      }
      return;
    }

    // If already saving, wait for it then save fresh state
    if (isSavingRef.current) {
      if (pendingSavePromise) {
        await pendingSavePromise;
      }
      // Re-read current state after waiting
      const freshProject = useCXDStore.getState().projects.find(p => p.id === project.id);
      if (!freshProject) return;
      project = freshProject;
    }

    isSavingRef.current = true;

    // Backup to localStorage first (synchronous safety net)
    backupToLocalStorage(project);
    emitSaveStatus({ status: 'saving', source: 'project' });

    try {
      pendingSavePromise = saveProject(project);
      const success = await pendingSavePromise;
      if (success) {
        lastSavedHash = project.updatedAt;
        consecutiveSaveFailures = 0;
        clearLocalBackup(); // Clear backup on successful save
        emitSaveStatus({ status: 'saved', source: 'project' });
        console.log('[Sync] Project saved successfully');
      } else {
        consecutiveSaveFailures++;
        console.warn(`[Sync] Project save failed (${consecutiveSaveFailures} consecutive), localStorage backup retained`);
        emitSaveStatus({
          status: 'error',
          source: 'project',
          failures: consecutiveSaveFailures,
          message: 'Changes may not be saved. Check your connection.',
        });
      }
    } catch (error) {
      consecutiveSaveFailures++;
      console.error('[Sync] Error saving project:', error);
      emitSaveStatus({
        status: 'error',
        source: 'project',
        failures: consecutiveSaveFailures,
        message: 'Save error. Your changes are backed up locally.',
      });
    } finally {
      isSavingRef.current = false;
      pendingSavePromise = null;
    }
  }, []);

  // Restore from localStorage backup on mount if needed
  useEffect(() => {
    if (hasRestoredBackup.current) return;
    hasRestoredBackup.current = true;

    const backup = getLocalBackup();
    if (backup && backup.project && backup.project.id) {
      const existingProject = projects.find(p => p.id === backup.project.id);

      // If backup exists and is less than 24 hours old, consider restoring it
      // (a crash last night should still be recoverable this morning)
      const retentionCutoff = Date.now() - (24 * 60 * 60 * 1000);
      if (backup.timestamp > retentionCutoff) {
        if (existingProject) {
          const existingUpdated = new Date(existingProject.updatedAt).getTime();
          // If backup is newer than what we have, restore it
          if (backup.timestamp > existingUpdated) {
            console.log('[Sync] Restoring from localStorage backup (newer than current)');
            const updatedProjects = projects.map(p =>
              p.id === backup.project.id ? { ...backup.project, updatedAt: new Date().toISOString() } : p
            );
            setProjects(updatedProjects);
            // Try to save the restored backup to database
            saveProject(backup.project).then(success => {
              if (success) {
                console.log('[Sync] Backup restored and saved to database');
                clearLocalBackup();
              }
            });
          } else {
            // Database version is newer, clear stale backup
            clearLocalBackup();
          }
        } else if (projects.length > 0) {
          // Project not found in current list but backup exists
          // This could mean the project was deleted, so don't restore
          clearLocalBackup();
        }
      } else {
        // Backup is too old, clear it
        clearLocalBackup();
      }
    }
  }, [projects, setProjects]);

  // Auto-save effect with debounce.
  // Uses a lightweight fingerprint instead of JSON.stringify to avoid
  // blocking the main thread for 30-100ms on every change.
  const lastFingerprintRef = useRef<string | null>(null);
  useEffect(() => {
    const currentProject = projects.find(p => p.id === currentProjectId);
    if (!currentProject) return;

    // Never auto-save listing-only project stubs (missing project_data).
    if ((currentProject as any)._listingOnly) return;

    // Lightweight fingerprint: updatedAt + element/edge counts + name
    // Catches all meaningful changes without expensive full serialization.
    const elementCount = currentProject.canvasLayout?.elements?.length ?? 0;
    const edgeCount = currentProject.canvasLayout?.edges?.length ?? 0;
    const fingerprint = `${currentProject.updatedAt}|${elementCount}|${edgeCount}|${currentProject.name}`;
    if (fingerprint === lastFingerprintRef.current) return;
    lastFingerprintRef.current = fingerprint;

    // Debounce save - 2s delay to batch rapid changes
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSave(currentProject);
    }, 2000);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [projects, currentProjectId, performSave]);

  // Save on page unload with synchronous backup
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const currentProject = projects.find(p => p.id === currentProjectId);
      if (!currentProject) return;

      if (currentProject.updatedAt === lastSavedHash) return;

      // Cancel pending debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Synchronous save (localStorage backup + async save attempt)
      syncSaveOnUnload(currentProject);

      // Warn user about unsaved changes (browser shows generic message)
      e.preventDefault();
      e.returnValue = '';
    };

    // Handle visibility change (tab switch, minimize) - save immediately
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const currentProject = projects.find(p => p.id === currentProjectId);
        if (currentProject) {
          if (currentProject.updatedAt !== lastSavedHash) {
            // Cancel debounce and save immediately
            if (debounceRef.current) {
              clearTimeout(debounceRef.current);
            }
            performSave(currentProject);
          }
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [projects, currentProjectId, performSave]);
}
