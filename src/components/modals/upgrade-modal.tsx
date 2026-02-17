"use client";

import React from "react";
import { X, Check, Sparkles, Zap, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/use-subscription";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: 'plan-view' | 'tasks' | 'premium-ai' | 'templates' | 'collaboration' | 'canvases';
  onUpgrade?: () => void;
}

const PRO_FEATURES = [
  'Unlimited Canvases',
  'Premium AI Models (GPT-4o, Claude Sonnet, Kimi)',
  '500 AI Credits/month',
  'Plan View with Kanban Boards',
  'Smart Templates Library',
  'Team Collaboration (3 members)',
  'Priority Support',
];

const LIFETIME_FEATURES = [
  'Everything in Pro',
  'All AI Models (Including Claude Opus)',
  '1000 Credits One-Time + BYOK',
  'Bring Your Own API Keys',
  'Lifetime Access - Pay Once',
  'All Future Updates Forever',
  'Founding Member Badge',
  'Priority Feature Requests',
];

export function UpgradeModal({ isOpen, onClose, feature, onUpgrade }: UpgradeModalProps) {
  const { plan, isTrialing, trialDaysRemaining } = useSubscription();

  // Upgrade context based on feature
  const getUpgradeContext = (feature: string) => {
    const contexts = {
      'plan-view': {
        title: 'Plan View is a Pro Feature',
        description: 'Organize your experience design with Kanban boards, timelines, and task management.',
        benefits: [
          'Kanban task boards',
          'Timeline visualization',
          'Task dependencies',
          'Progress tracking',
        ],
        cta: isTrialing
          ? `Upgrade now (${trialDaysRemaining} days left in trial)`
          : 'Start Pro Trial',
      },
      'tasks': {
        title: 'Task Management is Pro Only',
        description: 'Create, organize, and track tasks with AI-powered assistance.',
        benefits: [
          'AI task generation',
          'Smart task cards',
          'Priority management',
          'Due dates & tracking',
        ],
        cta: isTrialing
          ? `Upgrade now (${trialDaysRemaining} days left in trial)`
          : 'Start Pro Trial',
      },
      'premium-ai': {
        title: 'Premium AI Models',
        description: 'Get faster, more accurate responses with Claude Sonnet 4 and GPT-4.',
        benefits: [
          'Faster response times',
          'Higher quality insights',
          'Advanced reasoning',
          'Multiple model options',
        ],
        cta: 'Upgrade to Pro',
      },
      'templates': {
        title: 'Smart Templates',
        description: 'Jumpstart your designs with industry-specific templates.',
        benefits: [
          'Pre-built frameworks',
          'Best practice patterns',
          'Time-saving shortcuts',
          'Customizable starting points',
        ],
        cta: 'Unlock Templates',
      },
      'collaboration': {
        title: 'Team Collaboration',
        description: 'Work together in real-time with your team.',
        benefits: [
          'Real-time co-editing',
          'Team cursors & presence',
          'Shared project access',
          'Comment & feedback tools',
        ],
        cta: 'Enable Collaboration',
      },
      'canvases': {
        title: 'Canvas Limit Reached',
        description: 'Free accounts are limited to 3 canvases. Upgrade for unlimited canvases.',
        benefits: [
          'Unlimited canvases',
          'Organize by project',
          'Archive old work',
          'Never delete progress',
        ],
        cta: 'Get Unlimited Canvases',
      },
    };
    return contexts[feature as keyof typeof contexts];
  };

  const context = getUpgradeContext(feature);

  const handleUpgrade = async (planType: 'pro' | 'lifetime') => {
    try {
      const priceId = planType === 'pro'
        ? process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
        : process.env.NEXT_PUBLIC_STRIPE_LIFETIME_PRICE_ID;

      if (!priceId) {
        console.error('Missing Stripe price ID');
        return;
      }

      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, planType }),
      });

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
    }
    onUpgrade?.();
  };

  const handleStartTrial = () => handleUpgrade('pro');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-400" />
            {context.title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-base mt-2">
            {context.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Feature Benefits */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {context.benefits.map((benefit, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg"
              >
                <Check className="w-5 h-5 text-purple-400 flex-shrink-0" />
                <span className="text-sm text-foreground">{benefit}</span>
              </div>
            ))}
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-border">
            {/* Pro Plan */}
            <div className="relative p-6 bg-gradient-to-b from-purple-500/10 to-purple-500/5 border border-purple-500/30 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Zap className="w-5 h-5 text-purple-400" />
                    Pro Plan
                  </h3>
                  <p className="text-2xl font-bold text-foreground mt-2">
                    $20
                    <span className="text-sm font-normal text-muted-foreground">/month</span>
                  </p>
                </div>
              </div>

              <ul className="space-y-2 mb-6">
                {PRO_FEATURES.map((feat, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                    {feat}
                  </li>
                ))}
              </ul>

              {plan === 'free' ? (
                <button
                  onClick={handleStartTrial}
                  className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all"
                >
                  Start 14-Day Free Trial
                </button>
              ) : (
                <button
                  onClick={() => handleUpgrade('pro')}
                  className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all"
                >
                  {context.cta}
                </button>
              )}
            </div>

            {/* Lifetime Plan */}
            <div className="relative p-6 bg-gradient-to-b from-amber-500/10 to-amber-500/5 border-2 border-amber-500/50 rounded-xl">
              {/* Limited Badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-500 text-black text-xs font-bold rounded-full shadow-lg">
                LIMITED: 250 SEATS ONLY
              </div>

              <div className="flex items-center justify-between mb-4 mt-2">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-400" />
                    Lifetime Access
                  </h3>
                  <p className="text-2xl font-bold text-foreground mt-2">
                    $399
                    <span className="text-sm font-normal text-muted-foreground"> one-time</span>
                  </p>
                  <p className="text-xs text-amber-400 mt-1">
                    Save $240/year vs Pro ($20×12 = $240)
                  </p>
                </div>
              </div>

              <ul className="space-y-2 mb-6">
                {LIFETIME_FEATURES.map((feat, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    {feat}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade('lifetime')}
                className="w-full px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold rounded-lg transition-all shadow-lg"
              >
                Claim Lifetime Access
              </button>

              <p className="text-center text-xs text-muted-foreground mt-3">
                🔥 <strong className="text-amber-400">Limited to first 250 members</strong>
              </p>
            </div>
          </div>

          {/* Trial Info */}
          {isTrialing && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm text-blue-300">
                💡 You're currently on a Pro trial with{' '}
                <strong>{trialDaysRemaining} days remaining</strong>.
                Upgrade now to keep all Pro features after your trial ends.
              </p>
            </div>
          )}

          {/* FAQ */}
          <div className="pt-6 border-t border-border space-y-3">
            <h4 className="text-sm font-semibold text-foreground mb-3">Frequently Asked Questions</h4>

            <details className="group">
              <summary className="cursor-pointer text-sm text-foreground hover:text-purple-400 transition-colors">
                What happens to my Lifetime API usage?
              </summary>
              <p className="mt-2 text-sm text-muted-foreground pl-4">
                Lifetime members can bring their own API keys (OpenAI, Anthropic) and use any model without consuming platform credits.
                This gives you full control and unlimited usage with your preferred models.
              </p>
            </details>

            <details className="group">
              <summary className="cursor-pointer text-sm text-foreground hover:text-purple-400 transition-colors">
                Can I upgrade from Pro to Lifetime later?
              </summary>
              <p className="mt-2 text-sm text-muted-foreground pl-4">
                Yes, but only while seats are available. Once all 250 Lifetime seats are claimed, this offer will be permanently closed.
                Pro members can upgrade by paying the difference.
              </p>
            </details>

            <details className="group">
              <summary className="cursor-pointer text-sm text-foreground hover:text-purple-400 transition-colors">
                What if I don't want to manage API keys?
              </summary>
              <p className="mt-2 text-sm text-muted-foreground pl-4">
                Pro plan is perfect for you! We handle all the AI infrastructure and you get 100 monthly credits included,
                with the option to purchase more as needed.
              </p>
            </details>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
