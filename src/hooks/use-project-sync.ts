'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useCXDStore } from '@/store/cxd-store';
import { saveProject } from '@/lib/supabase-projects';

export function useProjectSync() {
  const { projects, currentProjectId } = useCXDStore();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedRef = useRef<string | null>(null);
  const isSavingRef = useRef(false);

  // Save function with deduplication
  const performSave = useCallback(async (project: typeof projects[0]) => {
    if (isSavingRef.current) return;
    
    const projectHash = JSON.stringify(project);
    if (projectHash === lastSyncedRef.current) return;
    
    isSavingRef.current = true;
    try {
      const success = await saveProject(project);
      if (success) {
        lastSyncedRef.current = projectHash;
      }
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const currentProject = projects.find(p => p.id === currentProjectId);
    if (!currentProject) return;

    // Skip if nothing changed
    const projectHash = JSON.stringify(currentProject);
    if (projectHash === lastSyncedRef.current) return;

    // Debounce save - 1.5 second delay after last change
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSave(currentProject);
    }, 1500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [projects, currentProjectId, performSave]);

  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentProject = projects.find(p => p.id === currentProjectId);
      if (currentProject) {
        // Synchronous save attempt via navigator.sendBeacon
        const projectHash = JSON.stringify(currentProject);
        if (projectHash !== lastSyncedRef.current) {
          // Note: sendBeacon won't work with Supabase client
          // But we clear debounce to ensure pending save executes
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            saveProject(currentProject);
          }
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [projects, currentProjectId]);
}
