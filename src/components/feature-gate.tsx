'use client';

import { useState, ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useSubscription } from '@/hooks/use-subscription';
import { UpgradeModal } from './upgrade-modal';

type FeatureType = 'ai' | 'planView' | 'templates' | 'unlimitedCanvases' | 'collaboration';

interface FeatureGateProps {
  feature: FeatureType;
  children: ReactNode;
  fallback?: ReactNode;
  showLockIcon?: boolean;
}

/**
 * Wraps a feature that requires a paid plan.
 * Shows the upgrade modal when user tries to access a locked feature.
 */
export function FeatureGate({
  feature,
  children,
  fallback,
  showLockIcon = true,
}: FeatureGateProps) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { hasAI, hasPlanView, hasTemplates, hasUnlimitedCanvases, hasCollaboration, isLoading } = useSubscription();

  // Check if user has access to this feature
  const hasAccess = (() => {
    switch (feature) {
      case 'ai':
        return hasAI;
      case 'planView':
        return hasPlanView;
      case 'templates':
        return hasTemplates;
      case 'unlimitedCanvases':
        return hasUnlimitedCanvases;
      case 'collaboration':
        return hasCollaboration;
      default:
        return false;
    }
  })();

  // While loading, show children (optimistic)
  if (isLoading) {
    return <>{children}</>;
  }

  // User has access - render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // User doesn't have access - show fallback or locked state
  return (
    <>
      {fallback ? (
        <div onClick={() => setShowUpgradeModal(true)} className="cursor-pointer">
          {fallback}
        </div>
      ) : (
        <div
          onClick={() => setShowUpgradeModal(true)}
          className="relative cursor-pointer group"
        >
          <div className="opacity-50 pointer-events-none select-none">
            {children}
          </div>
          {showLockIcon && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
              <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900/90 rounded-lg border border-white/10">
                <Lock className="w-4 h-4 text-violet-400" />
                <span className="text-sm text-white">Upgrade to unlock</span>
              </div>
            </div>
          )}
        </div>
      )}

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature={feature}
      />
    </>
  );
}

interface RequireProProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Shorthand for requiring any Pro feature.
 * Blocks access if user is on Free plan.
 */
export function RequirePro({ children, fallback }: RequireProProps) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { isFree, isLoading } = useSubscription();

  if (isLoading) {
    return <>{children}</>;
  }

  if (!isFree) {
    return <>{children}</>;
  }

  return (
    <>
      {fallback ? (
        <div onClick={() => setShowUpgradeModal(true)} className="cursor-pointer">
          {fallback}
        </div>
      ) : (
        <div
          onClick={() => setShowUpgradeModal(true)}
          className="relative cursor-pointer group"
        >
          <div className="opacity-50 pointer-events-none select-none">
            {children}
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900/90 rounded-lg border border-white/10">
              <Lock className="w-4 h-4 text-violet-400" />
              <span className="text-sm text-white">Pro feature</span>
            </div>
          </div>
        </div>
      )}

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </>
  );
}
