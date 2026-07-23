'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/supabase/client';
import { getPlan, hasFeatureAccess, canCreateCanvas, canAddCollaborator, getMaxCollaborators, getTemplateAccess, getMaxCanvasObjects, getMaxUploadBytes, type Plan, type TemplateAccess } from '@/lib/plans';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'past_due'
  | 'unpaid'
  | 'paused';

export type PlanId = 'free' | 'pro' | 'lifetime' | 'beta_tester';

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_id: PlanId;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_start: string | null;
  trial_end: string | null;
  free_primary_canvas_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UseSubscriptionReturn {
  subscription: Subscription | null;
  plan: Plan;
  isLoading: boolean;
  error: Error | null;
  isPro: boolean;
  isLifetime: boolean;
  isBetaTester: boolean;
  isFree: boolean;
  isTrialing: boolean;
  isActive: boolean;
  trialDaysRemaining: number | null;
  hasAI: boolean;
  hasPlanView: boolean;
  hasTemplates: boolean;
  hasUnlimitedCanvases: boolean;
  hasCollaboration: boolean;
  hasMasterPlan: boolean;
  maxCollaborators: number;
  /** 'quickstart' = free tier (Quickstart templates only); 'full' = whole catalog + AI Composer */
  templateAccess: TemplateAccess;
  /** Counted-object cap per owned canvas (Infinity = uncapped). See src/lib/quota.ts */
  maxCanvasObjects: number;
  /** Per-file upload size cap in bytes (Infinity = uncapped) */
  maxUploadBytes: number;
  canCreateCanvas: (currentCount: number) => boolean;
  canAddCollaborator: (currentCount: number) => boolean;
  freePrimaryCanvasId: string | null;
  /**
   * True when the dashboard should block with the Pick-Free-Canvas modal.
   * Computed as: isFree && free_primary_canvas_id == null && userCanvasCount > 1.
   * The hook cannot compute userCanvasCount on its own, so this helper returns
   * a *predicate* the caller combines with their own canvas count.
   */
  needsPickFreeCanvas: (canvasCount: number) => boolean;
  refetch: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Prevent hammering Supabase when it's down — track last fetch time
  const lastFetchRef = { current: 0 };

  const fetchSubscription = useCallback(async () => {
    // Debounce: skip if fetched within the last 5 seconds
    const now = Date.now();
    if (now - lastFetchRef.current < 5000) return;
    lastFetchRef.current = now;

    try {
      setIsLoading(true);
      setError(null);

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setSubscription(null);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // No subscription found - user is on free plan
          setSubscription(null);
        } else {
          throw fetchError;
        }
      } else {
        setSubscription(data as Subscription);
      }
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch subscription'));
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchSubscription();

    // Listen for auth changes — debounced by fetchSubscription to avoid storms
    const supabase = createClient();
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(() => {
      fetchSubscription();
    });

    return () => {
      authSubscription.unsubscribe();
    };
  }, [fetchSubscription]);

  // Derived state
  const planId = subscription?.plan_id || 'free';
  const plan = getPlan(planId);
  const status = subscription?.status || 'active';

  const isPro = planId === 'pro';
  const isLifetime = planId === 'lifetime';
  const isBetaTester = planId === 'beta_tester';
  const isFree = planId === 'free';
  const isTrialing = status === 'trialing';
  const isActive = status === 'active' || status === 'trialing';

  // Calculate trial days remaining
  let trialDaysRemaining: number | null = null;
  if (isTrialing && subscription?.trial_end) {
    const trialEnd = new Date(subscription.trial_end);
    const now = new Date();
    const diffTime = trialEnd.getTime() - now.getTime();
    trialDaysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  // Feature access
  const hasAI = hasFeatureAccess(planId, 'ai');
  const hasPlanView = hasFeatureAccess(planId, 'planView');
  const hasTemplates = hasFeatureAccess(planId, 'templates');
  const hasUnlimitedCanvases = hasFeatureAccess(planId, 'unlimitedCanvases');
  const hasCollaboration = hasFeatureAccess(planId, 'collaboration');
  const hasMasterPlan = hasFeatureAccess(planId, 'masterPlan');
  const maxCollaborators = getMaxCollaborators(planId);
  const templateAccess = getTemplateAccess(planId);
  const maxCanvasObjects = getMaxCanvasObjects(planId);
  const maxUploadBytes = getMaxUploadBytes(planId);

  const checkCanCreateCanvas = useCallback(
    (currentCount: number) => canCreateCanvas(planId, currentCount),
    [planId]
  );

  const checkCanAddCollaborator = useCallback(
    (currentCount: number) => canAddCollaborator(planId, currentCount),
    [planId]
  );

  return {
    subscription,
    plan,
    isLoading,
    error,
    isPro,
    isLifetime,
    isBetaTester,
    isFree,
    isTrialing,
    isActive,
    trialDaysRemaining,
    hasAI,
    hasPlanView,
    hasTemplates,
    hasUnlimitedCanvases,
    hasCollaboration,
    hasMasterPlan,
    maxCollaborators,
    templateAccess,
    maxCanvasObjects,
    maxUploadBytes,
    canCreateCanvas: checkCanCreateCanvas,
    canAddCollaborator: checkCanAddCollaborator,
    freePrimaryCanvasId: subscription?.free_primary_canvas_id ?? null,
    needsPickFreeCanvas: (canvasCount: number) =>
      (subscription?.plan_id === 'free')
      && (subscription?.free_primary_canvas_id == null)
      && canvasCount > 1,
    refetch: fetchSubscription,
  };
}
