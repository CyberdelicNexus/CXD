"use client";

import { useState, useRef, useEffect } from "react";
import { Zap, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAICredits } from "@/hooks/use-ai-credits";
import { useSubscription } from "@/hooks/use-subscription";
import { CreditTopUpModal } from "@/components/cxd/credit-topup-modal";
import { AIProviderIcon } from "@/components/cxd/ai-provider-icons";
import { AI_MODELS, type ModelId, getAllowedModels, getModelCreditWeight } from "@/lib/ai-credit-config";

// Helper to get short model label for display
function getShortModelLabel(modelId: ModelId): string {
  const labels: Record<ModelId, string> = {
    'gemini-2.0-flash': 'Gemini Flash',
    'kimi': 'Kimi',
    'claude-haiku-4.5': 'Haiku',
    'gemini-2.5-pro': 'Gemini Pro',
    'claude-sonnet-4.5': 'Sonnet',
    'claude-opus-4.6': 'Opus',
  };
  return labels[modelId] || AI_MODELS[modelId]?.name || modelId;
}

export function NavCreditMeter() {
  const { hasAI, subscription, plan } = useSubscription();
  const {
    remainingCredits,
    totalCredits,
    isLow,
    isDepleted,
    selectedModel,
    isLoading,
    refetch,
    setSelectedModel,
  } = useAICredits();

  const [isOpen, setIsOpen] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Get allowed models for user's tier
  const planId = subscription?.plan_id || 'free';
  const allowedModels = getAllowedModels(planId as any) || [];

  // Refetch on AI credit change events (fired after streaming completes)
  useEffect(() => {
    const handler = () => refetch();
    window.addEventListener("ai-credits-changed", handler);
    return () => window.removeEventListener("ai-credits-changed", handler);
  }, [refetch]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [isOpen]);

  // Don't render for free users without AI
  if (!hasAI) return null;
  if (isLoading) return null;

  const percentage = totalCredits > 0 ? Math.round((remainingCredits / totalCredits) * 100) : 0;
  const shortLabel = getShortModelLabel(selectedModel);

  return (
    <div className="relative" ref={ref}>
      {/* Circular trigger - matches other nav buttons */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-10 w-10 flex items-center justify-center rounded-full transition-all active:scale-95 group",
          isDepleted
            ? "bg-red-500/10 border border-red-500/20 hover:bg-red-500/15"
            : isLow
              ? "bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15"
              : "bg-white/[0.05] border border-white/10 hover:bg-violet-600/20 hover:border-violet-500/50 hover:shadow-[0_0_15px_rgba(139,92,246,0.3)]",
        )}
        title={`${remainingCredits} / ${totalCredits} credits remaining`}
      >
        <Zap
          className={cn(
            "w-4 h-4 transition-colors",
            isDepleted
              ? "text-red-400"
              : isLow
                ? "text-amber-400"
                : "text-violet-400 group-hover:text-violet-300",
          )}
        />
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-[fadeIn_150ms_ease-out]">
          {/* Credit summary */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
                AI Credits
              </span>
              <span className="text-xs text-white/70">
                {remainingCredits}
                <span className="text-white/30"> / {totalCredits}</span>
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  isDepleted
                    ? "bg-red-500"
                    : isLow
                      ? "bg-amber-500"
                      : percentage > 50
                        ? "bg-emerald-500"
                        : "bg-violet-500",
                )}
                style={{ width: `${Math.max(percentage, 1)}%` }}
              />
            </div>

            {isDepleted && (
              <p className="text-[10px] text-red-400/80 mt-1.5">
                Credits depleted. Messages won&apos;t send.
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-white/[0.06]" />

          {/* Model selector */}
          <div className="px-4 pt-3 pb-2">
            <span className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
              Active Model
            </span>
          </div>
          <div
            className="max-h-64 overflow-y-auto"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.08) transparent",
            }}
          >
            {allowedModels.map((modelId) => {
              const model = AI_MODELS[modelId];
              if (!model) return null;

              const creditWeight = getModelCreditWeight(modelId);
              const isSelected = selectedModel === modelId;

              return (
                <button
                  key={modelId}
                  onClick={() => setSelectedModel(modelId)}
                  className={cn(
                    "w-full px-4 py-2.5 text-left flex items-center justify-between transition-colors",
                    isSelected
                      ? "bg-violet-500/10"
                      : "hover:bg-white/[0.04]",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      "flex items-center justify-center w-6 h-6 rounded-md border",
                      isSelected
                        ? "bg-violet-500/10 border-violet-500/20"
                        : "bg-white/[0.03] border-white/[0.06]",
                    )}>
                      <AIProviderIcon provider={modelId} className={cn(
                        "w-3.5 h-3.5 shrink-0",
                        isSelected ? "text-violet-300" : "text-white/40",
                      )} />
                    </div>
                    <div className="flex flex-col">
                      <span className={cn(
                        "text-[13px] leading-tight",
                        isSelected ? "text-white font-medium" : "text-white/80",
                      )}>
                        {model.name}
                      </span>
                      <span className="text-[10px] text-white/25 leading-tight">
                        {creditWeight} credit{creditWeight !== 1 ? "s" : ""} per message
                      </span>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-white/[0.06]" />

          {/* Get more */}
          <div className="p-2">
            <button
              className="w-full px-3 py-2 rounded-lg text-xs font-medium text-violet-300 hover:bg-violet-500/10 transition-colors text-center"
              onClick={() => {
                setIsOpen(false);
                setShowTopUp(true);
              }}
            >
              Get more credits
            </button>
          </div>
        </div>
      )}

      <CreditTopUpModal
        isOpen={showTopUp}
        onClose={() => setShowTopUp(false)}
      />
    </div>
  );
}
