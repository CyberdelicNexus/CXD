"use client";

import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";
import type { AIProviderKey } from "@/types/ai-types";

interface AICreditMeterProps {
  remaining: number;
  total: number;
  selectedModel: AIProviderKey;
  isLow: boolean;
  isDepleted: boolean;
}

const MODEL_LABELS: Record<AIProviderKey, string> = {
  claude: "Claude",
  gemini: "Gemini",
  kimi: "Kimi",
};

export function AICreditMeter({
  remaining,
  total,
  selectedModel,
  isLow,
  isDepleted,
}: AICreditMeterProps) {
  const percentage = total > 0 ? Math.round((remaining / total) * 100) : 0;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium",
        isDepleted
          ? "bg-red-500/10 text-red-400 border border-red-500/20"
          : isLow
            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
            : "bg-white/5 text-muted-foreground border border-border/30",
      )}
      title={`${remaining} / ${total} credits remaining | Model: ${MODEL_LABELS[selectedModel]}`}
    >
      <Zap className={cn(
        "w-3 h-3",
        isDepleted ? "text-red-400" : isLow ? "text-amber-400" : "text-primary/60",
      )} />
      <span>{remaining}</span>
      <span className="text-muted-foreground/50">|</span>
      <span className="text-muted-foreground/70">{MODEL_LABELS[selectedModel]}</span>
    </div>
  );
}
