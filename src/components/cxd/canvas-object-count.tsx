'use client';

// Compact numeric readout for the free-tier object quota, shown next to the
// save-status indicator in the navbar. Renders nothing unless QuotaGovernor
// has armed a cap (free plan, canvas owned by the current user) — paid plans
// and collaborators never see this. Deliberately just the numbers; the full
// meter with a progress bar lives in the account menu.

import { useCXDStore } from '@/store/cxd-store';
import { countQuotaObjects } from '@/lib/quota';

export function CanvasObjectCount() {
  const quota = useCXDStore((s) => s.objectQuota);
  const used = useCXDStore((s) => {
    if (s.objectQuota == null) return 0;
    const p = s.projects.find((proj) => proj.id === s.currentProjectId);
    return countQuotaObjects(p?.canvasLayout?.elements);
  });

  if (quota == null) return null;

  const atCap = used >= quota;

  return (
    <div
      className="flex items-center flex-shrink-0 px-1"
      title={`${used} of ${quota} canvas objects used (cards, images, links & tables)`}
    >
      <span className={`text-xs tabular-nums whitespace-nowrap ${atCap ? 'text-red-400' : 'text-white/30'}`}>
        {used}/{quota}
      </span>
    </div>
  );
}
