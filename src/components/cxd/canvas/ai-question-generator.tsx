"use client";

import React, { useState } from "react";
import { Sparkles, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuestionChip } from "./question-chip";

interface AIQuestionGeneratorProps {
  onGenerateQuestions: () => Promise<string[]>;
  onQuestionClick: (question: string) => void;
  className?: string;
}

export function AIQuestionGenerator({
  onGenerateQuestions,
  onQuestionClick,
  className
}: AIQuestionGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<string[]>([]);
  const [askedQuestions, setAskedQuestions] = useState<Set<string>>(new Set());

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const questions = await onGenerateQuestions();
      setGeneratedQuestions(questions);
      setAskedQuestions(new Set()); // Reset asked state
    } catch (error) {
      console.error("Failed to generate questions:", error);
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
              <span className="text-sm font-medium">Generating questions...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Generate Contextual Questions</span>
            </>
          )}
        </button>
      ) : (
        <>
          {/* Header with clear button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <h4 className="text-sm font-semibold text-foreground">AI-Generated Questions</h4>
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

          {/* Hint */}
          <p className="text-[10px] text-muted-foreground/60 italic">
            These questions are tailored to your current project context across all faces.
          </p>
        </>
      )}
    </div>
  );
}
