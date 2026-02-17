'use client';

import { useCallback } from 'react';
import { useCXDStore } from '@/store/cxd-store';
import { useYjsProject } from '@/contexts/yjs-project-context';
import {
  setLocalAwareness,
  type AwarenessUserState,
} from '@/lib/yjs/awareness-provider';

/**
 * Hook for managing Yjs Awareness state (cursors, selections, editing).
 *
 * In CRDT mode, this updates the Yjs Awareness instance.
 * The existing useCollaboration hook still handles presence via Supabase Presence
 * for backward compatibility — this hook provides the CRDT-aware layer on top.
 *
 * Usage:
 * ```tsx
 * const { setEditingElement, setCursor, setSelection } = useYjsAwareness();
 *
 * // Mark an element as being edited by the local user
 * setEditingElement('element-123');
 *
 * // Clear editing state
 * setEditingElement(null);
 * ```
 */
export function useYjsAwareness() {
  const { awareness } = useYjsProject();
  const yDoc = useCXDStore((s) => s.yDoc);

  const setCursor = useCallback(
    (x: number, y: number) => {
      if (!awareness || !yDoc) return;
      setLocalAwareness(awareness, { cursor: { x, y } });
    },
    [awareness, yDoc]
  );

  const clearCursor = useCallback(() => {
    if (!awareness || !yDoc) return;
    setLocalAwareness(awareness, { cursor: null });
  }, [awareness, yDoc]);

  const setSelection = useCallback(
    (elementIds: string[]) => {
      if (!awareness || !yDoc) return;
      setLocalAwareness(awareness, { selection: elementIds });
    },
    [awareness, yDoc]
  );

  const setEditingElement = useCallback(
    (elementId: string | null) => {
      if (!awareness || !yDoc) return;
      setLocalAwareness(awareness, { editingElementId: elementId });
    },
    [awareness, yDoc]
  );

  const setUserInfo = useCallback(
    (info: Pick<AwarenessUserState, 'userId' | 'name' | 'email' | 'color' | 'avatarUrl'>) => {
      if (!awareness || !yDoc) return;
      setLocalAwareness(awareness, info);
    },
    [awareness, yDoc]
  );

  return {
    /** Whether Yjs awareness is active */
    isActive: !!awareness && !!yDoc,
    /** Update cursor position */
    setCursor,
    /** Clear cursor (e.g., mouse left canvas) */
    clearCursor,
    /** Update element selection */
    setSelection,
    /** Mark an element as being edited (or null to clear) */
    setEditingElement,
    /** Set the local user's info (name, color, avatar) */
    setUserInfo,
  };
}
