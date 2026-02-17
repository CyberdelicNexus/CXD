"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Zap } from "lucide-react";
import { useAICredits } from "@/hooks/use-ai-credits";
import { getCreditPack } from "@/lib/credit-packs";

interface CreditTopUpSuccessProps {
  packId: string | null;
  onDismiss: () => void;
}

export function CreditTopUpSuccess({
  packId,
  onDismiss,
}: CreditTopUpSuccessProps) {
  const { remainingCredits, refetch } = useAICredits();
  const [settled, setSettled] = useState(false);
  const pollCount = useRef(0);

  const pack = packId ? getCreditPack(packId) : null;
  const creditsAdded = pack?.credits ?? 0;

  // Poll for updated credits (webhook may arrive after redirect)
  useEffect(() => {
    // Immediately notify other components
    window.dispatchEvent(new Event("ai-credits-changed"));

    const interval = setInterval(() => {
      pollCount.current += 1;
      refetch();

      if (pollCount.current >= 5) {
        clearInterval(interval);
        setSettled(true);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [refetch]);

  const handleContinue = () => {
    // Clean URL params
    window.history.replaceState({}, "", window.location.pathname);
    onDismiss();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Success card */}
      <div className="relative w-full max-w-sm bg-zinc-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-center">
        <div className="p-8">
          {/* Success icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-5">
            <Check className="w-8 h-8 text-emerald-400" strokeWidth={3} />
          </div>

          <h2 className="text-xl font-bold text-white mb-2">
            Credits Added!
          </h2>

          {creditsAdded > 0 && (
            <p className="text-sm text-white/60 mb-4">
              <span className="font-semibold text-violet-300">
                {creditsAdded.toLocaleString()} credits
              </span>{" "}
              have been added to your account.
            </p>
          )}

          {/* Balance display */}
          <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/[0.05] border border-white/[0.08] rounded-xl mb-6">
            <Zap className="w-4 h-4 text-violet-400" />
            <span className="text-sm text-white/50">Current balance:</span>
            <span className="text-sm font-semibold text-white">
              {remainingCredits.toLocaleString()}
            </span>
            {!settled && (
              <span className="text-[10px] text-white/30 animate-pulse">
                updating...
              </span>
            )}
          </div>

          {/* Continue button */}
          <button
            onClick={handleContinue}
            className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
