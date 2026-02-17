"use client";

import React from "react";
import { Sparkles, Zap, Crown, TrendingUp, ExternalLink, Key, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAICredits } from "@/hooks/use-ai-credits";
import { useSubscription } from "@/hooks/use-subscription";
import { AI_MODELS, type ModelId, TIER_CREDIT_ALLOWANCES, getModelCreditWeight, estimateConversationsRemaining } from "@/lib/ai-credit-config";

export function AISettings() {
  const { credits, isLoading, selectedModel, setSelectedModel, remainingCredits, totalCredits } = useAICredits();
  const { subscription, plan } = useSubscription();

  const [showBYOK, setShowBYOK] = React.useState(false);
  const planId = subscription?.plan_id || 'free';
  const tierConfig = TIER_CREDIT_ALLOWANCES[planId as keyof typeof TIER_CREDIT_ALLOWANCES] || TIER_CREDIT_ALLOWANCES.free;
  const canBYOK = tierConfig.canBYOK;
  const allowedModels = tierConfig.allowedModels;

  const creditPercentage = totalCredits > 0 ? (remainingCredits / totalCredits) * 100 : 0;

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'anthropic': return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
      case 'openai': return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
      case 'google': return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
      case 'moonshot': return 'text-purple-400 border-purple-500/30 bg-purple-500/10';
      default: return 'text-gray-400 border-gray-500/30 bg-gray-500/10';
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'budget': return { label: 'Budget', color: 'bg-green-500/20 text-green-400 border-green-500/30' };
      case 'standard': return { label: 'Standard', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
      case 'premium': return { label: 'Premium', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
      case 'flagship': return { label: 'Flagship', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
      default: return { label: 'Standard', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">AI Settings</h3>
        <p className="text-sm text-muted-foreground">
          Manage AI models, credits, and API keys
        </p>
      </div>

      {/* Credit Balance */}
      <div className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-400" />
            <h4 className="text-sm font-semibold text-foreground">Credit Balance</h4>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-foreground">{remainingCredits}</div>
            <div className="text-xs text-muted-foreground">of {totalCredits} credits</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative h-2 bg-black/20 rounded-full overflow-hidden">
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-all",
              creditPercentage > 20 ? "bg-purple-500" : "bg-red-500"
            )}
            style={{ width: `${creditPercentage}%` }}
          />
        </div>

        {credits?.periodEnd && (
          <div className="text-xs text-muted-foreground mt-2">
            Resets on {new Date(credits.periodEnd).toLocaleDateString()}
          </div>
        )}

        {/* View Ledger Link */}
        <button
          className="text-xs text-purple-400 hover:text-purple-300 mt-3 flex items-center gap-1"
        >
          <TrendingUp className="w-3 h-3" />
          View usage history
        </button>
      </div>

      {/* Model Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">AI Model</h4>
          {canBYOK && (
            <button
              onClick={() => setShowBYOK(!showBYOK)}
              className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-purple-500/20"
            >
              <Key className="w-3 h-3" />
              Manage API Keys
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Choose the AI model for your design assistant
        </p>

        <div className="grid grid-cols-1 gap-3">
          {Object.values(AI_MODELS).map((model) => {
            const isSelected = selectedModel === model.id;
            const isAllowed = allowedModels.includes(model.id as ModelId);
            const providerColor = getProviderColor(model.provider);
            const tierBadge = getTierBadge(model.tier);
            const conversationsLeft = estimateConversationsRemaining(remainingCredits, model.id as ModelId);

            return (
              <button
                key={model.id}
                onClick={() => isAllowed && setSelectedModel(model.id as ModelId)}
                disabled={!isAllowed}
                className={cn(
                  "relative p-4 rounded-lg border transition-all text-left",
                  isSelected
                    ? "bg-purple-500/20 border-purple-500/30 ring-2 ring-purple-500/30"
                    : isAllowed
                      ? "border-border hover:bg-white/5"
                      : "border-border/50 opacity-60 cursor-not-allowed"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className="text-sm font-semibold text-foreground">{model.name}</h5>
                      <span className={cn("px-2 py-0.5 text-[10px] font-medium rounded-full border", tierBadge.color)}>
                        {tierBadge.label}
                      </span>
                    </div>

                    <div className={cn("text-[10px] font-medium px-2 py-0.5 rounded border inline-block mb-2", providerColor)}>
                      {model.provider.toUpperCase()}
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {model.features.map((feature) => (
                        <span
                          key={feature}
                          className="text-[10px] px-1.5 py-0.5 bg-white/5 text-muted-foreground rounded"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {model.creditWeight} {model.creditWeight === 1 ? 'credit' : 'credits'} per conversation
                      {conversationsLeft > 0 && (
                        <span className="text-purple-400 ml-1">
                          · ~{conversationsLeft} left
                        </span>
                      )}
                    </div>
                  </div>

                  {!isAllowed ? (
                    <div className="flex-shrink-0">
                      <div className="w-5 h-5 rounded-full bg-gray-500/50 flex items-center justify-center">
                        <Lock className="w-3 h-3 text-white/70" />
                      </div>
                    </div>
                  ) : isSelected ? (
                    <div className="flex-shrink-0">
                      <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                        <Sparkles className="w-3 h-3 text-white" />
                      </div>
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        {planId === 'free' && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg mt-3">
            <div className="text-xs text-blue-300 flex items-start gap-2">
              <Crown className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Upgrade to Pro or Lifetime</strong> to unlock all premium AI models including Claude Sonnet 4.5, GPT-4o, and more.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BYOK Section (only for Lifetime users) */}
      {canBYOK && showBYOK && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-5 h-5 text-amber-400" />
            <h4 className="text-sm font-semibold text-foreground">Bring Your Own Keys (BYOK)</h4>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500 text-black rounded">LIFETIME ONLY</span>
          </div>

          <p className="text-xs text-muted-foreground">
            Use your own API keys for unlimited usage without consuming platform credits.
          </p>

          {/* API Key Inputs */}
          <div className="space-y-3">
            {[
              { provider: 'Anthropic', placeholder: 'sk-ant-...', link: 'https://console.anthropic.com' },
              { provider: 'OpenAI', placeholder: 'sk-...', link: 'https://platform.openai.com' },
              { provider: 'Google', placeholder: 'AIza...', link: 'https://aistudio.google.com' },
              { provider: 'Moonshot', placeholder: 'sk-...', link: 'https://platform.moonshot.ai' },
            ].map(({ provider, placeholder, link }) => (
              <div key={provider} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground">{provider} API Key</label>
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    Get key <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="password"
                  placeholder={placeholder}
                  className="w-full px-3 py-2 bg-background/50 border border-border rounded text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            ))}
          </div>

          <button className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium text-sm rounded-lg transition-colors">
            Save API Keys
          </button>

          <p className="text-[10px] text-muted-foreground">
            🔒 Keys are encrypted and stored securely. We never see or log your keys.
          </p>
        </div>
      )}

      {/* Purchase Credits */}
      {!canBYOK && (
        <div className="p-4 border border-border rounded-lg space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Need More Credits?</h4>
          <p className="text-xs text-muted-foreground">
            Purchase addon credits or upgrade your plan for higher monthly allowances.
          </p>
          <div className="flex gap-2">
            <button className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors">
              Buy 500 Credits - $10
            </button>
            <button className="flex-1 px-4 py-2 border border-purple-500 text-purple-400 hover:bg-purple-500/10 text-sm font-medium rounded-lg transition-colors">
              Upgrade Plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
