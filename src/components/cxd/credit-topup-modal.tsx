"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Zap, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CREDIT_PACKS } from "@/lib/credit-packs";
import type { CreditPack } from "@/lib/credit-packs";

interface CreditTopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreditTopUpModal({ isOpen, onClose }: CreditTopUpModalProps) {
  const [selectedPack, setSelectedPack] = useState<CreditPack>(
    CREDIT_PACKS.find((p) => p.popular) || CREDIT_PACKS[0],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const handlePurchase = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/stripe/create-credit-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: selectedPack.id }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create checkout session");
      }
    } catch (error) {
      console.error("Credit purchase error:", error);
      alert("Failed to start checkout. Please try again.");
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only close if clicking the backdrop itself, not the modal content
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-lg bg-zinc-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors z-10"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="px-8 pt-8 pb-6 text-center border-b border-white/10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-violet-500/20 mb-4">
            <Zap className="w-6 h-6 text-violet-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">
            Get More AI Credits
          </h2>
          <p className="text-sm text-white/50">
            Select a credit pack to top up your balance
          </p>
        </div>

        {/* Pack grid */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-3">
            {CREDIT_PACKS.map((pack) => (
              <button
                key={pack.id}
                onClick={() => setSelectedPack(pack)}
                className={cn(
                  "relative p-4 rounded-xl border text-left transition-all",
                  selectedPack.id === pack.id
                    ? "border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/10"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]",
                )}
              >
                {pack.popular && (
                  <span className="absolute -top-2 right-3 px-2 py-0.5 bg-violet-500 text-white text-[10px] font-semibold rounded-full uppercase tracking-wider">
                    Popular
                  </span>
                )}

                <div className="text-lg font-bold text-white">
                  ${(pack.price / 100).toFixed(0)}
                </div>

                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-sm text-white/80">
                    {pack.credits.toLocaleString()} credits
                  </span>
                  {pack.bonusLabel && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-400 rounded">
                      {pack.bonusLabel}
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-white/30 mt-1">
                  ${((pack.price / 100) / pack.credits).toFixed(3)}/credit
                </div>
              </button>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-5 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center">
            <span className="text-sm text-white/50">You&apos;ll receive </span>
            <span className="text-sm font-semibold text-violet-300">
              {selectedPack.credits.toLocaleString()} credits
            </span>
          </div>

          {/* Purchase button */}
          <button
            onClick={handlePurchase}
            disabled={isLoading}
            className="w-full mt-4 py-3 px-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Redirecting to checkout...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Purchase Credits - ${(selectedPack.price / 100).toFixed(0)}
              </>
            )}
          </button>

          <p className="text-center text-[11px] text-white/30 mt-3">
            Secure payment powered by Stripe
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
