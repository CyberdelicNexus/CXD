'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/supabase/client';
import { resolveCanvasAccess, type CanvasAccess } from '@/lib/canvas-permissions';

/**
 * Client-side canvas permission hook. Queries the same resolver as the server
 * to present consistent UI (hide edit tools, show lock badges, etc.). Server
 * remains the source of truth — this is presentation, not enforcement.
 */
export function useCanvasPermissions(canvasId: string | null | undefined): {
  access: CanvasAccess | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
} {
  const [access, setAccess] = useState<CanvasAccess | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = async () => {
    if (!canvasId) {
      setAccess(null);
      setIsLoading(false);
      return;
    }
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setAccess(null);
      setIsLoading(false);
      return;
    }
    const result = await resolveCanvasAccess({
      supabase,
      canvasId,
      viewerUserId: user.id,
    });
    setAccess(result);
    setIsLoading(false);
  };

  useEffect(() => {
    setIsLoading(true);
    fetch();
    // canvasId is the only dep — refetch happens via returned refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId]);

  return { access, isLoading, refetch: fetch };
}
