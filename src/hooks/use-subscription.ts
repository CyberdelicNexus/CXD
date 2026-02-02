'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/supabase/client';
import { getPlan, hasFeatureAccess, canCreateCanvas, canAddCollaborator, getMaxCollaborators, type Plan } from '@/lib/plans';

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
  maxCollaborators: number;
  canCreateCanvas: (currentCount: number) => boolean;
  canAddCollaborator: (currentCount: number) => boolean;
  refetch: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSubscription = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchSubscription();

    // Listen for auth changes
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
  const maxCollaborators = getMaxCollaborators(planId);

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
    maxCollaborators,
    canCreateCanvas: checkCanCreateCanvas,
    canAddCollaborator: checkCanAddCollaborator,
    refetch: fetchSubscription,
  };
}
