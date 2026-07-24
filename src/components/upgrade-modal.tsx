'use client';

import { useState } from 'react';
import { X, Check, Sparkles, Crown, Zap } from 'lucide-react';
import { PLANS } from '@/lib/plans';
import { useSubscription } from '@/hooks/use-subscription';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: 'ai' | 'planView' | 'templates' | 'unlimitedCanvases' | 'collaboration' | 'objects' | 'calendarSync';
}

const featureMessages: Record<string, { title: string; description: string }> = {
  ai: {
    title: 'AI Design Assistant',
    description: 'Get intelligent suggestions and automate repetitive tasks with AI.',
  },
  planView: {
    title: 'Plan View',
    description: 'Visualize your entire project timeline and dependencies.',
  },
  templates: {
    title: 'Smart Templates',
    description: 'Start faster with professionally designed templates.',
  },
  unlimitedCanvases: {
    title: 'Unlimited Canvases',
    description: 'Create as many canvases as you need for all your projects.',
  },
  collaboration: {
    title: 'Team Collaboration',
    description: 'Work together with up to 3 team members on the same canvas in real-time.',
  },
  objects: {
    title: 'Your canvas is full',
    description: 'You’ve used all 100 free objects on this canvas — everything you’ve built stays yours. Upgrade to keep adding cards, images, links and tables without limits, or delete a few to free up room.',
  },
  calendarSync: {
    title: 'Calendar Sync',
    description: 'Subscribe to your plan from Google Calendar, Apple Calendar or Outlook — deadlines land in the calendar you already live in, and stay up to date automatically.',
  },
};

export function UpgradeModal({ isOpen, onClose, feature }: UpgradeModalProps) {
  const [isLoading, setIsLoading] = useState<'pro' | 'lifetime' | null>(null);
  const { plan: currentPlan, isTrialing, trialDaysRemaining } = useSubscription();

  if (!isOpen) return null;

  const handleUpgrade = async (planType: 'pro' | 'lifetime') => {
    setIsLoading(planType);

    try {
      const priceId = planType === 'pro'
        ? process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
        : process.env.NEXT_PUBLIC_STRIPE_LIFETIME_PRICE_ID;

      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, planType }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  const featureInfo = feature ? featureMessages[feature] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal — capped to the viewport with internal scroll. Without this,
          `items-center` on the fixed backdrop centers overflowing content by
          pushing it equally above AND below the viewport with no way to
          scroll to the clipped part (looked like the modal rendered outside
          the browser on short/zoomed viewports). */}
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-zinc-900/95 border border-white/10 rounded-2xl shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors z-10"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="px-8 pt-8 pb-6 text-center border-b border-white/10">
          {featureInfo ? (
            <>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-violet-500/20 mb-4">
                <Sparkles className="w-6 h-6 text-violet-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Unlock {featureInfo.title}
              </h2>
              <p className="text-white/60">{featureInfo.description}</p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white mb-2">
                Upgrade Your Plan
              </h2>
              <p className="text-white/60">
                Get access to all features and supercharge your design workflow.
              </p>
            </>
          )}

          {isTrialing && trialDaysRemaining !== null && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-violet-500/20 rounded-full">
              <Zap className="w-4 h-4 text-violet-400" />
              <span className="text-sm text-violet-300">
                {trialDaysRemaining} days left in trial
              </span>
            </div>
          )}
        </div>

        {/* Plans */}
        <div className="p-8">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Pro Plan */}
            <div className="relative p-6 bg-white/5 border border-white/10 rounded-xl hover:border-violet-500/50 transition-colors">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-violet-400" />
                  {PLANS.PRO.name}
                </h3>
                <p className="text-sm text-white/60 mt-1">{PLANS.PRO.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-3xl font-bold text-white">${PLANS.PRO.price}</span>
                <span className="text-white/60">/month</span>
                <p className="text-sm text-violet-400 mt-1">14-day free trial</p>
              </div>

              <ul className="space-y-3 mb-6">
                {PLANS.PRO.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-white/80">
                    <Check className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade('pro')}
                disabled={isLoading !== null}
                className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {isLoading === 'pro' ? 'Loading...' : 'Start Free Trial'}
              </button>
            </div>

            {/* Lifetime Plan */}
            <div className="relative p-6 bg-gradient-to-b from-violet-500/10 to-transparent border-2 border-violet-500/50 rounded-xl">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 bg-violet-500 text-white text-xs font-medium rounded-full">
                  BEST VALUE
                </span>
              </div>

              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  {PLANS.LIFETIME.name}
                </h3>
                <p className="text-sm text-white/60 mt-1">{PLANS.LIFETIME.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-3xl font-bold text-white">${PLANS.LIFETIME.price}</span>
                <span className="text-white/60"> one-time</span>
                <p className="text-sm text-emerald-400 mt-1">Pay once, own forever</p>
              </div>

              <ul className="space-y-3 mb-6">
                {PLANS.LIFETIME.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-white/80">
                    <Check className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade('lifetime')}
                disabled={isLoading !== null}
                className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all shadow-lg shadow-violet-500/25"
              >
                {isLoading === 'lifetime' ? 'Loading...' : 'Get Lifetime Access'}
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-white/40 mt-6">
            Secure payment powered by Stripe. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
