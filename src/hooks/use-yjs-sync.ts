'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/supabase/client';
import { useCXDStore } from '@/store/cxd-store';
import { SupabaseYjsProvider } from '@/lib/yjs/supabase-yjs-provider';

/**
 * Hook that creates a dedicated Supabase Realtime channel for Yjs CRDT sync.
 * Separate from the presence/cursor channel to keep concerns decoupled.
 *
 * Only active when yDoc is available (CRDT mode enabled).
 */
export function useYjsSync(projectId: string | null, userId: string | null) {
  const [isSynced, setIsSynced] = useState(false);
  const providerRef = useRef<SupabaseYjsProvider | null>(null);
  const supabaseRef = useRef(createClient());

  const yDoc = useCXDStore((state) => state.yDoc);

  useEffect(() => {
    if (!projectId || !userId || !yDoc) {
      setIsSynced(false);
      return;
    }

    const supabase = supabaseRef.current;
    const channelName = `yjs:${projectId}`;

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
      },
    });

    // Subscribe to channel, then create provider.
    // The subscribe callback may fire multiple times (e.g. on network reconnect).
    // Always destroy the old provider before creating a new one to prevent
    // duplicate Y.Doc update listeners and double-broadcast of local changes.
    console.log('[useYjsSync] Subscribing to channel:', channelName);
    let syncedTimer: ReturnType<typeof setTimeout> | null = null;
    channel.subscribe((status) => {
      console.log('[useYjsSync] Channel status:', status);
      if (status === 'SUBSCRIBED') {
        // Destroy previous provider if channel reconnected
        if (providerRef.current) {
          console.log('[useYjsSync] Channel reconnected — destroying old provider');
          providerRef.current.destroy();
          providerRef.current = null;
        }
        if (syncedTimer) {
          clearTimeout(syncedTimer);
          syncedTimer = null;
        }

        console.log('[useYjsSync] Creating YjsProvider for user:', userId);
        const provider = new SupabaseYjsProvider(yDoc, channel, userId);
        providerRef.current = provider;

        // Mark synced after a short delay (enough for SyncStep1/2 exchange)
        syncedTimer = setTimeout(() => {
          setIsSynced(true);
        }, 500);
      }
    });

    return () => {
      if (syncedTimer) {
        clearTimeout(syncedTimer);
        syncedTimer = null;
      }
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
      channel.unsubscribe();
      setIsSynced(false);
    };
  }, [projectId, userId, yDoc]);

  return { isSynced };
}
