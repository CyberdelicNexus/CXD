"use client";

import React, { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionChipProps {
  question: string;
  onClick: () => void;
  isAsked?: boolean;
  className?: string;
}

export function QuestionChip({ question, onClick, isAsked = false, className }: QuestionChipProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={isAsked}
      className={cn(
        "w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg",
        "border transition-all duration-200",
        "text-left text-sm leading-relaxed",
        "min-h-[44px]",
        !isAsked && [
          "bg-white/[0.04] hover:bg-white/[0.08]",
          "border-white/8 hover:border-white/12",
          "text-white/75 hover:text-white",
          "active:scale-[0.98]"
        ],
        isAsked && [
          "bg-primary/5 border-primary/20",
          "text-primary cursor-default"
        ],
        className
      )}
    >
      <span className="flex-1">
        {isAsked && <Check className="w-3 h-3 inline mr-2" />}
        {question}
      </span>
      {!isAsked && (
        <ArrowRight
          className={cn(
            "w-3.5 h-3.5 text-white/40 transition-all flex-shrink-0",
            isHovered && "translate-x-1 text-white/60"
          )}
        />
      )}
    </button>
  );
}
