'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useCXDStore } from '@/store/cxd-store';
import { saveProject } from '@/lib/supabase-projects';
import { CXDProject } from '@/types/cxd-schema';

// Global state for sync status - accessible from other components
let pendingSavePromise: Promise<boolean> | null = null;
let lastSavedHash: string | null = null;

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
  const { projects, currentProjectId } = useCXDStore.getState();
  const currentProject = projects.find(p => p.id === currentProjectId);

  if (!currentProject) return true;

  const projectHash = JSON.stringify(currentProject);
  if (projectHash === lastSavedHash) return true;

  // Backup to localStorage first (synchronous)
  backupToLocalStorage(currentProject);

  // If there's already a save in progress, wait for it
  if (pendingSavePromise) {
    await pendingSavePromise;
  }

  // Then save to database
  console.log('[Sync] Flushing pending save...');
  const success = await saveProject(currentProject);
  if (success) {
    lastSavedHash = projectHash;
    clearLocalBackup();
    console.log('[Sync] Flush successful');
  } else {
    console.warn('[Sync] Flush failed, localStorage backup retained');
  }
  return success;
}

// Check if there are unsaved changes
export function hasUnsavedChanges(): boolean {
  const { projects, currentProjectId } = useCXDStore.getState();
  const currentProject = projects.find(p => p.id === currentProjectId);

  if (!currentProject) return false;

  const projectHash = JSON.stringify(currentProject);
  return projectHash !== lastSavedHash;
}

// Synchronous save for beforeunload - uses localStorage as reliable backup
function syncSaveOnUnload(project: CXDProject) {
  // Backup to localStorage (synchronous, reliable)
  backupToLocalStorage(project);

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
    if (isSavingRef.current) return;

    const projectHash = JSON.stringify(project);
    if (projectHash === lastSavedHash) return;

    isSavingRef.current = true;

    // Backup to localStorage first (synchronous safety net)
    backupToLocalStorage(project);

    try {
      pendingSavePromise = saveProject(project);
      const success = await pendingSavePromise;
      if (success) {
        lastSavedHash = projectHash;
        clearLocalBackup(); // Clear backup on successful save
        console.log('[Sync] Project saved successfully');
      } else {
        console.warn('[Sync] Project save failed, localStorage backup retained');
      }
    } catch (error) {
      console.error('[Sync] Error saving project:', error);
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

      // If backup exists and is less than 1 hour old, consider restoring it
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      if (backup.timestamp > oneHourAgo) {
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

  // Auto-save effect with debounce
  useEffect(() => {
    const currentProject = projects.find(p => p.id === currentProjectId);
    if (!currentProject) return;

    // Skip if nothing changed
    const projectHash = JSON.stringify(currentProject);
    if (projectHash === lastSavedHash) return;

    // Debounce save - 1 second delay after last change
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSave(currentProject);
    }, 1000);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [projects, currentProjectId, performSave]);

  // Save on page unload with synchronous backup
  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentProject = projects.find(p => p.id === currentProjectId);
      if (!currentProject) return;

      const projectHash = JSON.stringify(currentProject);
      if (projectHash === lastSavedHash) return;

      // Cancel pending debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Synchronous save (localStorage backup + async save attempt)
      syncSaveOnUnload(currentProject);
    };

    // Handle visibility change (tab switch, minimize) - save immediately
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const currentProject = projects.find(p => p.id === currentProjectId);
        if (currentProject) {
          const projectHash = JSON.stringify(currentProject);
          if (projectHash !== lastSavedHash) {
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
