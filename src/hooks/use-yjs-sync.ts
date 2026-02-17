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

    // Subscribe to channel, then create provider
    console.log('[useYjsSync] Subscribing to channel:', channelName);
    channel.subscribe((status) => {
      console.log('[useYjsSync] Channel status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('[useYjsSync] Creating YjsProvider for user:', userId);
        const provider = new SupabaseYjsProvider(yDoc, channel, userId);
        providerRef.current = provider;

        // Mark synced after a short delay (enough for SyncStep1/2 exchange)
        const timer = setTimeout(() => {
          setIsSynced(true);
        }, 500);

        return () => clearTimeout(timer);
      }
    });

    return () => {
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
