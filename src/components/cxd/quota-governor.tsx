'use client';

// Headless controller for the free-tier canvas quota (src/lib/quota.ts).
//
// Arms the store's objectQuota/uploadMaxBytes ONLY when the signed-in user
// owns the current project on the free plan — a free collaborator on a Pro
// user's canvas is never capped (the owner's plan governs the canvas), and
// paid plans never see a quota at all.
//
// Also renders the upgrade wall: the store opens `quotaWallOpen` when an
// add is blocked at the cap (addCanvasElement / addCanvasElements /
// duplicateCanvasElement), and this component shows the endowment-framed
// UpgradeModal in response. Nothing existing is ever locked or deleted.

import { useEffect, useState } from 'react';
import { createClient } from '@/supabase/client';
import { useCXDStore } from '@/store/cxd-store';
import { useSubscription } from '@/hooks/use-subscription';
import { UpgradeModal } from '@/components/upgrade-modal';

export function QuotaGovernor() {
  const { isFree, maxCanvasObjects, maxUploadBytes, isLoading } = useSubscription();
  const setQuotaConfig = useCXDStore((s) => s.setQuotaConfig);
  const quotaWallOpen = useCXDStore((s) => s.quotaWallOpen);
  const setQuotaWallOpen = useCXDStore((s) => s.setQuotaWallOpen);
  // Primitive selector — stable string | undefined, no re-render churn
  const ownerId = useCXDStore((s) => s.projects.find((p) => p.id === s.currentProjectId)?.ownerId);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    createClient().auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id ?? null);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // Only arm once subscription is resolved (optimistically uncapped while
    // loading — better to briefly under-enforce than flash a false wall).
    const arm = !isLoading && isFree && !!userId && !!ownerId && ownerId === userId;
    setQuotaConfig({
      objectQuota: arm && Number.isFinite(maxCanvasObjects) ? maxCanvasObjects : null,
      uploadMaxBytes: arm && Number.isFinite(maxUploadBytes) ? maxUploadBytes : null,
    });
    return () => setQuotaConfig({ objectQuota: null, uploadMaxBytes: null });
  }, [isLoading, isFree, userId, ownerId, maxCanvasObjects, maxUploadBytes, setQuotaConfig]);

  return (
    <UpgradeModal
      isOpen={quotaWallOpen}
      onClose={() => setQuotaWallOpen(false)}
      feature="objects"
    />
  );
}
