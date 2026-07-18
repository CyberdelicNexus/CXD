"use client";

import React, { useState } from "react";
import { Sparkles, X, Loader2, Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuestionChip } from "./question-chip";
import { useCXDStore } from "@/store/cxd-store";
import { requestExperienceQuestions } from "@/lib/ai/experience-questions-service";

interface AIQuestionGeneratorProps {
  // Fallback generator supplied by the parent. Used only if the AI request
  // fails, so the panel never dead-ends. External interface is unchanged.
  onGenerateQuestions: () => Promise<string[]>;
  onQuestionClick: (question: string) => void;
  className?: string;
}

export function AIQuestionGenerator({
  onGenerateQuestions,
  onQuestionClick,
  className
}: AIQuestionGeneratorProps) {
  const project = useCXDStore(state => state.getCurrentProject());
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<string[]>([]);
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [askedQuestions, setAskedQuestions] = useState<Set<string>>(new Set());

  const handleGenerate = async () => {
    setIsGenerating(true);
    setNotice(null);
    try {
      // Primary path: AI-analyzed questions grounded in the WHOLE experience.
      if (project) {
        const result = await requestExperienceQuestions({ project });
        if (result.success && result.questions.length > 0) {
          setGeneratedQuestions(result.questions);
          setFocusAreas(result.focusAreas);
          setAskedQuestions(new Set());
          return;
        }
      }
      // Fallback: parent-supplied questions so the panel never dead-ends.
      const fallback = await onGenerateQuestions();
      setGeneratedQuestions(fallback);
      setFocusAreas([]);
      setAskedQuestions(new Set());
      if (project) {
        setNotice("Showing baseline questions. AI analysis was unavailable just now.");
      }
    } catch (error) {
      console.error("Failed to generate questions:", error);
      setNotice("Could not generate questions. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQuestionClick = (question: string) => {
    setAskedQuestions(prev => new Set(prev).add(question));
    onQuestionClick(question);
  };

  const handleClear = () => {
    setGeneratedQuestions([]);
    setFocusAreas([]);
    setNotice(null);
    setAskedQuestions(new Set());
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Generate button */}
      {generatedQuestions.length === 0 ? (
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg",
            "bg-gradient-to-r from-violet-500/10 to-purple-500/10",
            "border border-violet-500/30 hover:border-violet-500/50",
            "text-violet-400 hover:text-violet-300",
            "transition-all duration-200",
            "min-h-[44px]",
            isGenerating && "opacity-50 cursor-not-allowed"
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">Reading your whole experience...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Generate Reflective Questions</span>
            </>
          )}
        </button>
      ) : (
        <>
          {/* Header with clear button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <h4 className="text-sm font-semibold text-foreground">Questions for Your Whole Design</h4>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className={cn(
                  "text-xs text-violet-400 hover:text-violet-300 transition-colors",
                  isGenerating && "opacity-50 cursor-not-allowed"
                )}
              >
                {isGenerating ? "Regenerating..." : "Regenerate"}
              </button>
              <button
                onClick={handleClear}
                className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all"
                title="Clear questions"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Generated questions */}
          <div className="space-y-1.5">
            {generatedQuestions.map((question, idx) => (
              <QuestionChip
                key={idx}
                question={question}
                onClick={() => handleQuestionClick(question)}
                isAsked={askedQuestions.has(question)}
              />
            ))}
          </div>

          {/* Focus areas — dimensions the AI flagged as underdeveloped */}
          {focusAreas.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                <Compass className="w-3 h-3" />
                Worth attention
              </span>
              {focusAreas.map((area, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-full text-[11px] bg-amber-500/10 border border-amber-500/25 text-amber-300/90"
                >
                  {area}
                </span>
              ))}
            </div>
          )}

          {/* Hint */}
          <p className="text-[10px] text-muted-foreground/60 italic">
            {notice ??
              "These questions read across every face of your experience. Click one to explore it in chat."}
          </p>
        </>
      )}
    </div>
  );
}
