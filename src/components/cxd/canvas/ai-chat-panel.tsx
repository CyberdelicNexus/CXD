"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  MessageSquare,
  Send,
  Sparkles,
  ExternalLink,
  X,
  Star,
  Loader2,
  FileText,
  Plus,
  Clock,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAIChat } from "@/hooks/use-ai-chat";
import { useAICredits } from "@/hooks/use-ai-credits";
import { AIChatHistory } from "./ai-chat-history";
import { ChatMarkdown } from "./ai-chat-markdown";
import type { AIProviderKey } from "@/types/ai-types";
import type { ModelId } from "@/lib/ai-credit-config";
import { formatCompletion, clampToUnit } from "@/lib/display-utils";
import { classifyResponse } from "@/lib/ai/ai-response-classifier";
import { AIActionBar } from "./ai-action-bar";

// Expanded pool of prompt suggestions for each hypercube face (9 per face for dynamic rotation)
function getAllPromptSuggestions(faceKey: string): string[] {
  const suggestions: Record<string, string[]> = {
    realityPlanes: [
      "What technologies would best support this experience?",
      "How should physical and digital elements integrate?",
      "What platform choices align with this vision?",
      "Which reality planes should dominate this experience?",
      "How can AR/VR enhance the physical experience?",
      "What hybrid experiences bridge digital and physical?",
      "How do we balance screen time with real-world interaction?",
      "What platforms enable the richest engagement?",
      "Should this be mobile-first, web-based, or physical-first?",
    ],
    sensoryDomains: [
      "Which senses should this experience prioritize?",
      "How can we create multisensory engagement?",
      "What sensory patterns evoke the desired feeling?",
      "How can sound design amplify the experience?",
      "What role does scent play in memory formation?",
      "How do we design for tactile feedback?",
      "What visual motifs reinforce the core message?",
      "How can taste be incorporated meaningfully?",
      "What sensory contrasts create impact?",
    ],
    presence: [
      "What presence should users feel in this space?",
      "How do we foster authentic connection?",
      "What creates meaningful presence here?",
      "How do we balance solitude and community?",
      "What makes someone feel 'seen' in this experience?",
      "How can asynchronous presence feel meaningful?",
      "What spatial metaphors enhance belonging?",
      "How do we design for psychological safety?",
      "What rituals strengthen presence over time?",
    ],
    stateMapping: [
      "What emotional states should users flow through?",
      "How do we guide transitions between states?",
      "What triggers each state change?",
      "How long should each emotional state last?",
      "What's the ideal opening emotional state?",
      "How do we create cathartic moments?",
      "What prevents emotional whiplash?",
      "How can we design for emotional resilience?",
      "What recovery paths exist after negative states?",
    ],
    traitMapping: [
      "What lasting impressions should this create?",
      "Which traits define the experience character?",
      "How do traits compound over time?",
      "What makes this experience memorable?",
      "How do we build trust through repeated interactions?",
      "What personality does this experience embody?",
      "How can curiosity be sustained long-term?",
      "What habits should this experience cultivate?",
      "How do we measure trait development?",
    ],
    contextAndMeaning: [
      "What story framework shapes this experience?",
      "How does meaning emerge through context?",
      "What narrative threads connect the elements?",
      "What metaphors anchor the experience?",
      "How do we layer meaning for different audiences?",
      "What cultural context should we consider?",
      "How can symbolism enhance understanding?",
      "What's the hero's journey in this experience?",
      "How do we make abstract concepts tangible?",
    ],
    core: [
      "How do all dimensions integrate into one coherent experience?",
      "What's the unifying principle across all faces?",
      "Where are the strongest synergies between dimensions?",
      "What's the one thing that makes this unique?",
      "How do the parts create a greater whole?",
      "Where are potential conflicts between dimensions?",
      "What's the simplest expression of this experience?",
      "How can we test the core hypothesis?",
      "What would be lost if we removed each dimension?",
    ],
    general: [
      "Help me clarify the core intention of this experience",
      "What's missing from my current design approach?",
      "How can I make this more cohesive?",
      "What assumptions am I making that need testing?",
      "How can I simplify without losing essence?",
      "What would delight users most?",
      "Where should I focus my energy first?",
      "What similar experiences can I learn from?",
      "How do I measure success for this experience?",
    ],
  };

  return suggestions[faceKey] || suggestions.general;
}

interface AIChatPanelProps {
  faceKey: string;
  projectId: string;
  accentHue: number;
  faceName: string;
  semanticRole: string;
  faceGlyph: string | null;
  faceSummary?: string;
  onClose: () => void;
  onConfigure?: () => void;
  onGenerateERD?: () => void;
  /** Layer 2: Enriched diagnostic context with structured data */
  insightContext?: {
    issueSummary: string;
    dataPoints: Record<string, number | string>;
    suggestedQuestions: string[];
    relatedFaceIds: string[];
    userQuestion?: string; // If present, use only this question instead of full diagnostic
  };
  onInsightConsumed?: () => void;
  provider?: AIProviderKey | ModelId;
  sizeVariant?: "default" | "assistant";
  /** Called when a history entry from a different face is clicked */
  onNavigateToFace?: (faceKey: string) => void;
}

export function AIChatPanel({
  faceKey,
  projectId,
  accentHue,
  faceName,
  semanticRole,
  faceGlyph,
  faceSummary,
  onClose,
  onConfigure,
  onGenerateERD,
  insightContext,
  onInsightConsumed,
  provider: providerProp,
  sizeVariant = "default",
  onNavigateToFace,
}: AIChatPanelProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showNewSessionConfirm, setShowNewSessionConfirm] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Track used questions per face to avoid repetition
  const [usedQuestionsByFace, setUsedQuestionsByFace] = useState<Record<string, Set<string>>>({});

  // Get 3 unused questions for the current face (memoized to avoid recalculation)
  const availableQuestions = useMemo((): string[] => {
    const allQuestions = getAllPromptSuggestions(faceKey);
    const usedQuestions = usedQuestionsByFace[faceKey] || new Set();

    // Filter out used questions
    const unusedQuestions = allQuestions.filter(q => !usedQuestions.has(q));

    // If all questions have been used, show first 3 (will reset on next click)
    if (unusedQuestions.length === 0) {
      return allQuestions.slice(0, 3);
    }

    // Return up to 3 unused questions
    return unusedQuestions.slice(0, 3);
  }, [faceKey, usedQuestionsByFace]);

  // Mark a question as used, with auto-reset when all questions exhausted
  const markQuestionAsUsed = useCallback((question: string) => {
    setUsedQuestionsByFace(prev => {
      const allQuestions = getAllPromptSuggestions(faceKey);
      const currentUsed = prev[faceKey] || new Set();
      const newUsed = new Set(currentUsed);
      newUsed.add(question);

      // If we just used the last question, reset for next time
      if (newUsed.size >= allQuestions.length) {
        return {
          ...prev,
          [faceKey]: new Set(),
        };
      }

      return {
        ...prev,
        [faceKey]: newUsed,
      };
    });
  }, [faceKey]);

  // Use the globally selected model from the credit meter, falling back to prop/default
  const { selectedModel } = useAICredits();
  const provider = providerProp || selectedModel || "gemini";

  const {
    messages,
    sendMessage,
    isStreaming,
    error,
    input,
    setInput,
    handleSubmit,
    starMessage,
    newSession,
    isLoadingHistory,
  } = useAIChat({ faceKey, projectId, provider, enabled: true, faceLabel: faceName, faceHue: accentHue });

  // Auto-scroll when new messages arrive or streaming
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Layer 2: Populate input from enriched insight context
  useEffect(() => {
    if (insightContext) {
      let userMessage: string;

      // If this is a direct question from a question chip, use only that question
      if (insightContext.userQuestion) {
        userMessage = insightContext.userQuestion;
      } else {
        // Otherwise, build the full diagnostic message
        // Format completion as percentage if present
        const completionValue = insightContext.dataPoints.completion ??
                                insightContext.dataPoints.stateCompletion ??
                                insightContext.dataPoints.traitCompletion ??
                                insightContext.dataPoints.meaningCompletion ??
                                insightContext.dataPoints.sensoryCompletion ??
                                insightContext.dataPoints.presenceCompletion ??
                                insightContext.dataPoints.realityCompletion;

        userMessage = insightContext.issueSummary;

        // If we have a completion value, append it in a user-friendly way
        if (typeof completionValue === 'number') {
          const pct = formatCompletion(clampToUnit(completionValue, 'insightContext'));
          userMessage += ` (${pct} complete)`;
        }

        // Add suggested questions as helpful prompts
        if (insightContext.suggestedQuestions && insightContext.suggestedQuestions.length > 0) {
          userMessage += '\n\nSome questions to consider:\n' +
            insightContext.suggestedQuestions.map(q => `• ${q}`).join('\n');
        }
      }

      setInput(userMessage);
      onInsightConsumed?.();
    }
  }, [insightContext, setInput, onInsightConsumed]);

  // Close expand on Escape
  useEffect(() => {
    if (!isExpanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsExpanded(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isExpanded]);

  const onSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      handleSubmit(e);
    },
    [handleSubmit],
  );

  const handleNewSession = useCallback(async () => {
    setShowNewSessionConfirm(false);
    setShowHistory(false);
    // Don't reset questions - let them rotate through all 9 across sessions
    await newSession();
  }, [newSession]);

  const isGeneral = faceKey === "general";
  const isAssistantInline = sizeVariant === "assistant" && !isExpanded;

  // ─── Panel content (shared between normal + expanded) ─────────────

  const panelContent = (
    <>
      {/* Header */}
      <div
        className="px-4 py-2.5 border-b border-border flex items-center justify-between flex-shrink-0"
        style={{
          background:
            isAssistantInline
              ? "radial-gradient(140% 120% at 0% 0%, rgba(167,139,250,0.25) 0%, rgba(0,0,0,0) 45%), radial-gradient(130% 110% at 100% 0%, rgba(45,212,191,0.22) 0%, rgba(0,0,0,0) 42%), linear-gradient(180deg, rgba(38,28,60,0.92) 0%, rgba(18,15,30,0.88) 100%)"
              : `hsl(${accentHue} 30% 15% / 0.5)`,
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {faceGlyph ? (
            <svg width="24" height="24" viewBox="0 0 40 40" className="flex-shrink-0">
              <path
                d={faceGlyph}
                fill="none"
                stroke={`hsl(${accentHue} 50% 65%)`}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <Sparkles
              className="w-5 h-5 flex-shrink-0"
              style={{ color: `hsl(${accentHue} 60% 65%)` }}
            />
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5 truncate">
              {faceName}
              <MessageSquare className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            </h2>
            <p className="text-[10px] text-muted-foreground truncate">
              {semanticRole}
            </p>
          </div>
        </div>

        {/* Right-side buttons */}
        <div className="flex items-center gap-1">
          {/* Session toolbar */}
          <button
            onClick={() => {
              if (messages.length === 0) {
                handleNewSession();
              } else {
                setShowNewSessionConfirm(true);
              }
            }}
            className="p-1.5 hover:bg-white/10 rounded-md text-muted-foreground/60 hover:text-foreground transition-colors"
            title="New session"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              showHistory
                ? "bg-white/10 text-foreground"
                : "hover:bg-white/10 text-muted-foreground/60 hover:text-foreground",
            )}
            title="Session history"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-white/10 rounded-md text-muted-foreground/60 hover:text-foreground transition-colors"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Divider */}
          <div className="w-px h-4 bg-border/50 mx-0.5" />

          {onGenerateERD && (
            <button
              onClick={onGenerateERD}
              className="px-2.5 py-1 text-[11px] font-medium rounded-md transition-all flex items-center gap-1.5 text-white/90 hover:text-white active:scale-95"
              style={{
                background: "linear-gradient(135deg, hsl(270 60% 40%), hsl(200 70% 40%))",
                boxShadow: "0 0 8px rgba(139,92,246,0.25), inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
              title="Generate Experience Requirement Document"
            >
              <FileText className="w-3 h-3" />
              ERD
            </button>
          )}
          {onConfigure && (
            <button
              onClick={onConfigure}
              className="px-2.5 py-1 text-xs bg-primary/20 hover:bg-primary/30 text-primary rounded-md transition-colors flex items-center gap-1"
            >
              Configure
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={isExpanded ? () => setIsExpanded(false) : onClose}
            className="p-1.5 hover:bg-white/10 rounded-md text-muted-foreground hover:text-foreground transition-colors"
            title={isExpanded ? "Collapse" : "Close"}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* New Session Confirmation */}
      {showNewSessionConfirm && (
        <div className="px-4 py-2.5 border-b border-border bg-amber-500/5 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-300/80">
            Archive current session and start fresh?
          </p>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={handleNewSession}
              className="px-2.5 py-1 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-md transition-colors"
            >
              Archive & New
            </button>
            <button
              onClick={() => setShowNewSessionConfirm(false)}
              className="px-2.5 py-1 text-xs hover:bg-white/10 text-muted-foreground rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* History Panel (replaces chat body) */}
      {showHistory ? (
        <div className="flex-1 overflow-hidden">
          <AIChatHistory
            projectId={projectId}
            faceKey={faceKey}
            accentHue={accentHue}
            onClose={() => setShowHistory(false)}
            onNavigateToFace={onNavigateToFace}
          />
        </div>
      ) : (
        <>
          {/* Chat Thread */}
          <div
            className="chat-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 min-h-[120px]"
          >
            {isLoadingHistory ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/50" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-6">
                <MessageSquare
                  className="w-10 h-10 mb-3"
                  style={{ color: `hsl(${accentHue} 30% 45%)` }}
                />
                <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                  {isGeneral
                    ? "Ask anything about your experience design. Click a System Insight to start a conversation."
                    : faceKey === "core"
                      ? "Ask me about your experience\u2019s core integration\u2026"
                      : `Ask questions about your ${faceName.toLowerCase()} design, or click a System Insight to start a conversation.`}
                </p>
                {faceSummary && (
                  <p className="text-xs text-muted-foreground/60 mt-3 leading-relaxed max-w-sm italic">
                    {faceSummary}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3 overflow-x-hidden">
                {messages.map((msg) => {
                  // Classify assistant responses for actionable content
                  const actionableContent = msg.role === "assistant"
                    ? classifyResponse(msg.content, {
                        sourceFaces: faceKey !== 'general' ? [faceKey] : [],
                      })
                    : null;

                  return (
                    <div key={msg.id}>
                      <div
                        className={cn(
                          "flex group",
                          msg.role === "user" ? "justify-end" : "justify-start",
                        )}
                      >
                        <div className="relative">
                          <div
                            className={cn(
                              "max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed break-words [overflow-wrap:anywhere]",
                              msg.role === "user"
                                ? "text-foreground rounded-br-sm border"
                                : "text-foreground/90 border rounded-bl-sm",
                            )}
                            style={
                              msg.role === "user"
                                ? {
                                  borderColor: `hsl(${accentHue} 42% 42% / 0.38)`,
                                  background:
                                    "linear-gradient(155deg, rgba(56,44,92,0.88) 0%, rgba(30,24,54,0.92) 55%, rgba(16,14,30,0.95) 100%)",
                                  boxShadow: `inset 0 0 0 1px hsl(${accentHue} 55% 60% / 0.12)`,
                                }
                                : {
                                  borderColor: "rgba(148,163,184,0.20)",
                                  background:
                                    "linear-gradient(160deg, rgba(17, 7, 23, 0.94) 0%, rgba(14, 18, 34, 0.95) 52%, rgba(23, 10, 26, 0.96) 100%)",
                                }
                            }
                          >
                            {msg.role === "assistant" ? (
                              <ChatMarkdown content={msg.content} />
                            ) : (
                              msg.content
                            )}
                          </div>
                          {msg.role === "assistant" && (
                            <button
                              onClick={() => starMessage(msg.id)}
                              className="absolute -right-6 top-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                              title={msg.isStarred ? "Unstar message" : "Star message"}
                            >
                              <Star
                                className={cn(
                                  "w-3.5 h-3.5",
                                  msg.isStarred
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-muted-foreground/40 hover:text-yellow-400/70",
                                )}
                              />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* AI Action Bar for assistant messages with actionable content */}
                      {msg.role === "assistant" && actionableContent && (actionableContent.tasks.length > 0 || actionableContent.noteContent.length > 0) && (
                        <div className="flex justify-start">
                          <div className="max-w-[80%]">
                            <AIActionBar
                              tasks={actionableContent.tasks}
                              noteContent={actionableContent.noteContent}
                              sourceFaces={actionableContent.sourceFaces}
                              chatMessageId={msg.id}
                              onTasksAdded={() => {
                                // Optional: Could add toast notification here
                                console.log('[AIChatPanel] Tasks added to Plan tab');
                              }}
                              onNoteCreated={() => {
                                // Phase 2: Note creation
                                console.log('[AIChatPanel] Note added to Canvas Inbox');
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {isStreaming && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 border border-border/40 rounded-xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2">
                      <Loader2
                        className="w-3.5 h-3.5 animate-spin"
                        style={{ color: `hsl(${accentHue} 50% 60%)` }}
                      />
                      <span className="text-xs text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* Error display */}
          {error && (
            <div className="px-4 py-2 border-t border-red-500/20 bg-red-500/5 text-xs text-red-400">
              {error.message || "Something went wrong. Please try again."}
            </div>
          )}

          {/* Prompt Suggestions - Dynamic (shows 3 unused questions) */}
          {messages.length === 0 && (
            <div className="px-4 py-2 border-t border-border/50 flex-shrink-0">
              <div className="flex flex-wrap gap-1.5 justify-center">
                {availableQuestions.map((suggestion, index) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      // Mark this question as used
                      markQuestionAsUsed(suggestion);
                      setInput(suggestion);
                      // Auto-send the prompt
                      setTimeout(() => {
                        handleSubmit();
                      }, 50);
                    }}
                    disabled={isStreaming}
                    className="px-3 py-1.5 text-xs rounded-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-center"
                    style={{
                      background: `linear-gradient(135deg, hsl(${accentHue} 35% 20% / 0.8) 0%, hsl(${accentHue} 30% 15% / 0.4) 50%, transparent 100%)`,
                      border: `1px solid hsl(${accentHue} 45% 40% / 0.25)`,
                      color: `hsl(${accentHue} 60% 85%)`,
                      boxShadow: `inset 0 1px 0 hsl(${accentHue} 50% 70% / 0.08)`,
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat Input */}
          <div className="px-4 py-2.5 border-t border-border flex-shrink-0">
            <form onSubmit={onSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit();
                  }
                }}
                placeholder={
                  isGeneral
                    ? "Ask about your experience design..."
                    : faceKey === "core"
                      ? "Ask about core integration..."
                      : `Ask about ${faceName.toLowerCase()}...`
                }
                disabled={isStreaming}
                className="flex-1 bg-white/5 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-transparent transition-all disabled:opacity-50"
                style={{
                  "--tw-ring-color": `hsl(${accentHue} 40% 50%)`,
                } as React.CSSProperties}
              />
              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                className={cn(
                  "p-2 rounded-lg transition-all flex-shrink-0",
                  input.trim() && !isStreaming
                    ? "bg-primary/20 hover:bg-primary/30 text-primary"
                    : "bg-white/5 text-muted-foreground/30 cursor-not-allowed",
                )}
                style={
                  input.trim() && !isStreaming
                    ? {
                      backgroundColor: `hsl(${accentHue} 30% 25% / 0.5)`,
                      color: `hsl(${accentHue} 50% 70%)`,
                    }
                    : undefined
                }
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </>
      )}
    </>
  );

  // ─── Expanded (focus) mode ─────────────────────────────────────────

  if (isExpanded) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-x-0 bottom-0 top-[76px] z-[120] bg-black/60 backdrop-blur-sm animate-[fadeIn_300ms_ease_forwards]"
          onClick={() => setIsExpanded(false)}
        />

        {/* Expanded panel */}
        <div className="fixed inset-x-0 bottom-0 top-[76px] z-[121] flex items-center justify-center pointer-events-none animate-[scaleIn_300ms_cubic-bezier(0.16,1,0.3,1)_forwards] px-4 py-4">
          <div
            className="pointer-events-auto backdrop-blur-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
            style={{
              "--chat-scrollbar-hue": accentHue,
              borderColor: `hsl(${accentHue} 40% 40% / 0.5)`,
              width: "min(75vw, 800px)",
              height: "min(calc(100vh - 140px), 900px)",
              background: "hsl(var(--card) / 0.98)",
              boxShadow: `0 40px 80px -20px rgba(0,0,0,0.8), 0 0 0 1px hsl(${accentHue} 60% 60% / 0.3), 0 0 30px 8px hsl(${accentHue} 70% 58% / 0.15)`,
            } as React.CSSProperties}
          >
            {panelContent}
          </div>
        </div>
      </>
    );
  }

  // ─── Normal (inline) mode ─────────────────────────────────────────

  return (
    <div
      className="bg-card/95 backdrop-blur-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
      style={{
        "--chat-scrollbar-hue": accentHue,
        borderColor: `hsl(${accentHue} 40% 40% / 0.5)`,
        height: "64vh",
        transition: "box-shadow 260ms ease, border-color 260ms ease",
        boxShadow: isFocused
          ? `0 24px 50px -24px rgba(0,0,0,0.9), 0 0 0 1px hsl(${accentHue} 60% 60% / 0.35), 0 0 14px 3px hsl(${accentHue} 70% 58% / 0.45)`
          : undefined,
      } as React.CSSProperties}
    >
      {panelContent}
    </div>
  );
}
