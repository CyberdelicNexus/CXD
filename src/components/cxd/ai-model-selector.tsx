"use client";

import { useState, useRef, useEffect } from "react";
import { Settings2, Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { AIProviderIcon } from "@/components/cxd/ai-provider-icons";
import type { AIProviderKey } from "@/types/ai-types";
import { useSubscription } from "@/hooks/use-subscription";
import { useRouter } from "next/navigation";

interface AIModelSelectorProps {
  selectedModel: AIProviderKey;
  onSelect: (model: AIProviderKey) => void;
  accentHue?: number;
}

const MODEL_OPTIONS: {
  key: AIProviderKey;
  label: string;
  costLabel: string;
  requiredTier: "free" | "pro" | "lifetime";
}[] = [
  { key: "kimi", label: "Kimi K2.5", costLabel: "Free", requiredTier: "free" },
  { key: "gpt", label: "GPT-4.1", costLabel: "1x cost", requiredTier: "pro" },
  { key: "claude", label: "Claude Sonnet 4.5", costLabel: "2x cost", requiredTier: "pro" },
  { key: "gemini", label: "Gemini 2.5 Pro", costLabel: "1x cost", requiredTier: "pro" },
];

export function AIModelSelector({
  selectedModel,
  onSelect,
  accentHue = 220,
}: AIModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { plan, isPro, isLifetime } = useSubscription();
  const router = useRouter();

  // Determine if a model is available based on subscription tier
  const isModelAvailable = (requiredTier: "free" | "pro" | "lifetime") => {
    if (isLifetime) return true;
    if (isPro && (requiredTier === "pro" || requiredTier === "free")) return true;
    if (requiredTier === "free") return true;
    return false;
  };

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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 hover:bg-white/10 rounded-md text-muted-foreground hover:text-foreground transition-colors"
        title="Select AI model"
      >
        <Settings2 className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-lg shadow-xl overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-border/50">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              AI Model
            </p>
          </div>
          {MODEL_OPTIONS.map((option) => {
            const available = isModelAvailable(option.requiredTier);
            return (
              <button
                key={option.key}
                onClick={() => {
                  if (available) {
                    onSelect(option.key);
                    setIsOpen(false);
                  } else {
                    // Redirect to dashboard pricing section
                    router.push('/dashboard?tab=billing');
                    setIsOpen(false);
                  }
                }}
                className={cn(
                  "w-full px-3 py-2 text-left flex items-center justify-between hover:bg-white/5 transition-colors",
                  selectedModel === option.key && "bg-white/5",
                  !available && "opacity-60",
                )}
              >
                <div className="flex items-center gap-2">
                  <AIProviderIcon provider={option.key} className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-sm text-foreground">{option.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {option.costLabel}
                  </span>
                  {!available && (
                    <Lock className="w-3 h-3 text-orange-400 ml-auto" />
                  )}
                </div>
                {selectedModel === option.key && available && (
                  <Check
                    className="w-3.5 h-3.5"
                    style={{ color: `hsl(${accentHue} 50% 60%)` }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
