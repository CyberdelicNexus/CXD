"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  TrendingUp,
  Link2,
  Scale,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles
} from "lucide-react";
import { cn, extractCenterColor, hexToRgba } from "@/lib/utils";
import { useCXDStore } from "@/store/cxd-store";
import { EnrichedDiagnostic, DiagnosticCategory, ProjectPhase } from "@/types/diagnostics";
import { getFaceDisplayName } from "@/lib/display-utils";
import { DesignOverviewCard } from "./design-overview-card";
import { QuestionChip } from "./question-chip";
import { AIQuestionGenerator } from "./ai-question-generator";

// Face visual identity mapping
const FACE_IDENTITY: Record<string, {
  label: string;
  hue: number;
  glyph: string;
}> = {
  realityPlanes: {
    label: "Reality Planes",
    hue: 280,
    glyph: "M15,8 L25,8 L25,18 L15,18 Z M18,11 L28,11 L28,21 L18,21 Z"
  },
  sensoryDomains: {
    label: "Sensory Domains",
    hue: 45,
    glyph: "M10,20 Q15,15 20,20 T30,20 M10,24 Q15,19 20,24 T30,24"
  },
  presence: {
    label: "Presence Types",
    hue: 195,
    glyph: "M20,15 Q12,20 20,25 Q28,20 20,15 M20,20 m-2,0 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0"
  },
  stateMapping: {
    label: "State Mapping",
    hue: 160,
    glyph: "M20,20 m-8,0 a8,8 0 1,0 16,0 a8,8 0 1,0 -16,0"
  },
  traitMapping: {
    label: "Trait Mapping",
    hue: 260,
    glyph: "M20,12 L28,20 L20,28 L12,20 Z M16,20 L20,16 L24,20 L20,24 Z"
  },
  contextAndMeaning: {
    label: "Meaning Architecture",
    hue: 320,
    glyph: "M20,20 Q20,15 23,15 Q26,15 26,18 Q26,22 22,22 Q17,22 17,18"
  }
};

interface DiagnosticPanelProps {
  diagnostics: EnrichedDiagnostic[];
  faceCompletions: Record<string, number>;
  onFaceReference?: (faceId: string) => void;
  onSendQuestionToChat?: (question: string, diagnostic: EnrichedDiagnostic) => void;
  onGenerateQuestions?: () => Promise<string[]>;
  onGeneratedQuestionClick?: (question: string) => void;
  onRefresh: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

const CATEGORY_CONFIG: Record<DiagnosticCategory, {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  color: string;
}> = {
  balance: {
    icon: Scale,
    label: "Balance",
    color: "hsl(280 40% 60%)"
  },
  coverage: {
    icon: CheckCircle2,
    label: "Coverage",
    color: "hsl(195 45% 60%)"
  },
  coherence: {
    icon: Link2,
    label: "Coherence",
    color: "hsl(160 40% 60%)"
  },
  risk: {
    icon: AlertCircle,
    label: "Risk",
    color: "hsl(45 60% 60%)"
  },
  opportunity: {
    icon: TrendingUp,
    label: "Opportunity",
    color: "hsl(260 40% 60%)"
  },
  integration: {
    icon: Info,
    label: "Integration",
    color: "hsl(320 40% 60%)"
  }
};

const SEVERITY_CONFIG = {
  info: {
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30"
  },
  caution: {
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30"
  },
  concern: {
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30"
  }
};

const PHASE_CONFIG: Record<ProjectPhase, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  exploring: {
    label: "Exploring",
    color: "hsl(195 60% 60%)",
    icon: Sparkles
  },
  shaping: {
    label: "Shaping",
    color: "hsl(260 50% 65%)",
    icon: TrendingUp
  },
  refining: {
    label: "Refining",
    color: "hsl(160 50% 60%)",
    icon: CheckCircle2
  }
};

type CardState = 'new' | 'seen' | 'asked' | 'resolved';

interface CardLifecycleState {
  state: CardState;
  askedQuestions: Set<string>;
}

/**
 * Calculate progress for a diagnostic based on its category
 */
function calculateDiagnosticProgress(diagnostic: EnrichedDiagnostic): {
  progress: number;
  label: string;
} {
  const data = diagnostic.chatContext?.dataPoints || {};

  switch (diagnostic.category) {
    case 'balance': {
      const maxComp = data.maxCompletion as number || 0;
      const minComp = data.minCompletion as number || 0;
      const progress = 1 - (maxComp - minComp);
      return {
        progress: Math.max(0, Math.min(1, progress)),
        label: `${Math.round(progress * 100)}% balanced`
      };
    }
    case 'coverage': {
      const tagged = data.taggedElementCount as number || 0;
      const target = 3;
      const progress = tagged / target;
      return {
        progress: Math.max(0, Math.min(1, progress)),
        label: `${tagged}/${target} elements`
      };
    }
    case 'coherence': {
      const weak = data.weakFaceCompletion as number || 0;
      const strong = data.strongFaceCompletion as number || 1;
      const progress = strong > 0 ? Math.min(weak / strong, 1) : 0;
      return {
        progress,
        label: `${Math.round(progress * 100)}% aligned`
      };
    }
    case 'risk': {
      const meaning = data.meaningCompletion as number || 0;
      const planes = data.activePlanesCount as number || 1;
      const progress = meaning / (planes * 0.15);
      return {
        progress: Math.max(0, Math.min(1, progress)),
        label: `${Math.round(progress * 100)}% contained`
      };
    }
    case 'opportunity': {
      return {
        progress: 0.5,
        label: 'Opportunity'
      };
    }
    case 'integration': {
      const connections = data.crossFaceConnectionCount as number || 0;
      const faces = data.activeFaceCount as number || 1;
      const maxConnections = faces * (faces - 1) / 2;
      const progress = maxConnections > 0 ? connections / maxConnections : 0;
      return {
        progress: Math.max(0, Math.min(1, progress)),
        label: `${Math.round(progress * 100)}% connected`
      };
    }
    default:
      return { progress: 0, label: '' };
  }
}

export function DiagnosticPanelRedesign({
  diagnostics,
  faceCompletions,
  onFaceReference,
  onSendQuestionToChat,
  onGenerateQuestions,
  onGeneratedQuestionClick,
  onRefresh,
  isOpen,
  onToggle
}: DiagnosticPanelProps) {
  const project = useCXDStore(state => state.getCurrentProject());
  const canvasBackground = project?.canvasBackground || 'radial-gradient(circle at center, #1a0b2e 0%, #000000 100%)';
  const centerColor = extractCenterColor(canvasBackground);
  const panelBgColor = hexToRgba(centerColor, 0.8);
  const scrollbarThumbColor = 'rgba(255, 255, 255, 0.3)';
  const scrollbarTrackColor = hexToRgba(centerColor, 0.3);

  // State
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());
  const [cardStates, setCardStates] = useState<Map<string, CardLifecycleState>>(new Map());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<DiagnosticCategory>>(new Set());
  const [selectedFaceFilter, setSelectedFaceFilter] = useState<string | null>(null);
  const [dismissedCards, setDismissedCards] = useState<Set<string>>(new Set());
  const [showDismissed, setShowDismissed] = useState(false);
  const [prevDiagnosticIds, setPrevDiagnosticIds] = useState<Set<string>>(new Set());

  // Track new diagnostics and resolved ones
  useEffect(() => {
    const currentIds = new Set(diagnostics.map(d => d.id));
    const newStates = new Map(cardStates);

    // Mark new diagnostics
    diagnostics.forEach(d => {
      if (!prevDiagnosticIds.has(d.id) && !newStates.has(d.id)) {
        newStates.set(d.id, { state: 'new', askedQuestions: new Set() });
        // Auto-transition to 'seen' after 2 seconds
        setTimeout(() => {
          setCardStates(prev => {
            const updated = new Map(prev);
            const cardState = updated.get(d.id);
            if (cardState && cardState.state === 'new') {
              updated.set(d.id, { ...cardState, state: 'seen' });
            }
            return updated;
          });
        }, 2000);
      }
    });

    setCardStates(newStates);
    setPrevDiagnosticIds(currentIds);
  }, [diagnostics]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setLastRefreshTime(Date.now());
    onRefresh();
  }, [onRefresh]);

  // Group diagnostics by category
  const groupedDiagnostics = useMemo(() => {
    const groups: Record<DiagnosticCategory, EnrichedDiagnostic[]> = {
      balance: [],
      coverage: [],
      coherence: [],
      risk: [],
      opportunity: [],
      integration: []
    };

    diagnostics.forEach(d => {
      if (!dismissedCards.has(d.id)) {
        groups[d.category].push(d);
      }
    });

    return groups;
  }, [diagnostics, dismissedCards]);

  // Filter by selected face
  const filteredGroups = useMemo(() => {
    if (!selectedFaceFilter) return groupedDiagnostics;

    const filtered: Record<DiagnosticCategory, EnrichedDiagnostic[]> = {
      balance: [],
      coverage: [],
      coherence: [],
      risk: [],
      opportunity: [],
      integration: []
    };

    Object.entries(groupedDiagnostics).forEach(([category, items]) => {
      filtered[category as DiagnosticCategory] = items.filter(d =>
        d.relatedFaces.includes(selectedFaceFilter)
      );
    });

    return filtered;
  }, [groupedDiagnostics, selectedFaceFilter]);

  // Get unique faces from diagnostics
  const availableFaces = useMemo(() => {
    const faces = new Set<string>();
    diagnostics.forEach(d => {
      d.relatedFaces.forEach(f => faces.add(f));
    });
    return Array.from(faces);
  }, [diagnostics]);

  // Detect phase
  const currentPhase: ProjectPhase = useMemo(() => {
    if (diagnostics.length === 0) return 'exploring';
    return diagnostics[0].phase;
  }, [diagnostics]);

  // Handle question chip click
  const handleQuestionClick = useCallback((diagnostic: EnrichedDiagnostic, question: string) => {
    if (!onSendQuestionToChat) return;

    // Send question to chat
    onSendQuestionToChat(question, diagnostic);

    // Update card state
    setCardStates(prev => {
      const updated = new Map(prev);
      const cardState = updated.get(diagnostic.id) || { state: 'seen', askedQuestions: new Set() };
      cardState.askedQuestions.add(question);
      cardState.state = 'asked';
      updated.set(diagnostic.id, cardState);
      return updated;
    });
  }, [onSendQuestionToChat]);

  // Handle dismiss
  const handleDismiss = useCallback((diagnosticId: string) => {
    setDismissedCards(prev => new Set(prev).add(diagnosticId));
  }, []);

  // Handle restore
  const handleRestore = useCallback((diagnosticId: string) => {
    setDismissedCards(prev => {
      const updated = new Set(prev);
      updated.delete(diagnosticId);
      return updated;
    });
  }, []);

  const hasAnyDiagnostics = diagnostics.length > 0;
  const dismissedDiagnostics = diagnostics.filter(d => dismissedCards.has(d.id));

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className={cn(
          "fixed left-0 top-20 z-50 p-2 rounded-r-lg backdrop-blur-xl border border-l-0 border-border shadow-lg transition-all duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
          isOpen && "left-80"
        )}
        style={{ backgroundColor: panelBgColor }}
        title={isOpen ? "Hide diagnostics" : "Show diagnostics"}
      >
        {isOpen ? (
          <ChevronLeft className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>

      {/* Panel */}
      <div
        className={cn(
          "fixed left-0 top-16 h-[calc(100vh-4rem)] w-80 backdrop-blur-xl border-r border-border shadow-2xl overflow-hidden flex flex-col z-40 transition-transform duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
          !isOpen && "-translate-x-full"
        )}
        style={{ backgroundColor: panelBgColor }}
        data-tour-id="map-insights-panel"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              System Insights
            </h2>
            {hasAnyDiagnostics && (() => {
              const phaseConfig = PHASE_CONFIG[currentPhase];
              const PhaseIcon = phaseConfig.icon;
              return (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
                  <div style={{ color: phaseConfig.color }}>
                    <PhaseIcon className="w-3 h-3" />
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: phaseConfig.color }}>
                    {phaseConfig.label}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-y-auto px-4 py-3 space-y-4"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: `${scrollbarThumbColor} ${scrollbarTrackColor}`,
          } as React.CSSProperties}
        >
          {/* Overview Card */}
          {hasAnyDiagnostics && (
            <DesignOverviewCard
              faceCompletions={faceCompletions}
              onRefresh={handleRefresh}
              lastRefreshTime={lastRefreshTime}
            />
          )}

          {/* AI Question Generator */}
          {onGenerateQuestions && onGeneratedQuestionClick && (
            <AIQuestionGenerator
              onGenerateQuestions={onGenerateQuestions}
              onQuestionClick={onGeneratedQuestionClick}
            />
          )}

          {/* Face Filter Bar */}
          {availableFaces.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedFaceFilter(null)}
                className={cn(
                  "px-2 py-1 text-xs rounded-md transition-all",
                  !selectedFaceFilter
                    ? "bg-white/20 text-white font-medium"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                )}
              >
                All
              </button>
              {availableFaces.map(faceId => {
                const faceInfo = FACE_IDENTITY[faceId];
                if (!faceInfo) return null;
                const hasHighSeverity = diagnostics.some(d =>
                  d.relatedFaces.includes(faceId) &&
                  (d.severity === 'concern' || d.severity === 'caution')
                );
                return (
                  <button
                    key={faceId}
                    onClick={() => setSelectedFaceFilter(faceId === selectedFaceFilter ? null : faceId)}
                    className={cn(
                      "px-2 py-1 text-xs rounded-md transition-all flex items-center gap-1",
                      selectedFaceFilter === faceId
                        ? "font-medium text-white"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    )}
                    style={{
                      backgroundColor: selectedFaceFilter === faceId ? `hsl(${faceInfo.hue} 40% 60%)` : undefined
                    }}
                  >
                    {getFaceDisplayName(faceId).replace('Types', '').replace('Mapping', '').replace('Architecture', '').trim()}
                    {hasHighSeverity && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                  </button>
                );
              })}
            </div>
          )}

          {!hasAnyDiagnostics && (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-primary/50" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your design is looking cohesive. Keep building!
              </p>
            </div>
          )}

          {/* Categories */}
          {Object.entries(filteredGroups).map(([category, items]) => {
            if (items.length === 0) return null;

            const config = CATEGORY_CONFIG[category as DiagnosticCategory];
            const Icon = config.icon;
            const isCollapsed = collapsedCategories.has(category as DiagnosticCategory);

            // Auto-expand high severity categories
            const hasHighSeverity = items.some(d => d.severity === 'concern' || d.severity === 'caution');
            const shouldBeExpanded = hasHighSeverity || items.some(d => d.severity === 'concern');

            return (
              <div key={category} className="space-y-2">
                {/* Category header - collapsible */}
                <button
                  onClick={() => {
                    setCollapsedCategories(prev => {
                      const updated = new Set(prev);
                      if (updated.has(category as DiagnosticCategory)) {
                        updated.delete(category as DiagnosticCategory);
                      } else {
                        updated.add(category as DiagnosticCategory);
                      }
                      return updated;
                    });
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  )}
                  <Icon
                    className="w-4 h-4"
                    style={{ color: config.color }}
                  />
                  <span
                    className="text-xs font-medium uppercase tracking-wider"
                    style={{ color: config.color }}
                  >
                    {config.label}
                  </span>
                  <span className="text-xs text-muted-foreground/60">
                    ({items.length})
                  </span>
                </button>

                {/* Diagnostic items - only if not collapsed */}
                {!isCollapsed && (
                  <div className="space-y-2 pl-6">
                    {items.map(diagnostic => {
                      const severityConfig = SEVERITY_CONFIG[diagnostic.severity];
                      const cardState = cardStates.get(diagnostic.id) || { state: 'seen', askedQuestions: new Set() };
                      const progress = calculateDiagnosticProgress(diagnostic);
                      const questions = diagnostic.chatContext?.suggestedQuestions || [];

                      return (
                        <div
                          key={diagnostic.id}
                          className={cn(
                            "group relative rounded-lg p-3 border transition-all",
                            severityConfig.bg,
                            severityConfig.border,
                            cardState.state === 'new' && "animate-pulse",
                            cardState.state === 'asked' && "border-primary/30"
                          )}
                        >
                          {/* Progress micro-indicator */}
                          {progress.label && (
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex-1 h-0.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-400",
                                    diagnostic.category === 'opportunity'
                                      ? "bg-gradient-to-r from-purple-400/50 to-transparent animate-pulse"
                                      : "bg-gradient-to-r from-current to-transparent"
                                  )}
                                  style={{
                                    width: `${progress.progress * 100}%`,
                                    color: config.color
                                  }}
                                />
                              </div>
                              <span className="ml-2 text-[10px] text-muted-foreground">
                                {progress.label}
                              </span>
                            </div>
                          )}

                          {/* Message */}
                          <p className={cn(
                            "text-sm leading-relaxed mb-3",
                            severityConfig.color
                          )}>
                            {diagnostic.message}
                          </p>

                          {/* Question chips */}
                          {questions.length > 0 && (
                            <div className="space-y-1.5 mb-3">
                              {questions.map((question, idx) => (
                                <QuestionChip
                                  key={idx}
                                  question={question}
                                  onClick={() => handleQuestionClick(diagnostic, question)}
                                  isAsked={cardState.askedQuestions.has(question)}
                                />
                              ))}
                            </div>
                          )}

                          {/* Related faces */}
                          <div className="flex items-center justify-between">
                            {diagnostic.relatedFaces.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {diagnostic.relatedFaces.map(faceId => {
                                  const faceInfo = FACE_IDENTITY[faceId];
                                  if (!faceInfo) return null;

                                  const faceColor = `hsl(${faceInfo.hue} 40% 60%)`;

                                  return (
                                    <button
                                      key={faceId}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (onFaceReference) {
                                          onFaceReference(faceId);
                                        } else {
                                          setSelectedFaceFilter(faceId);
                                        }
                                      }}
                                      className={cn(
                                        "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]",
                                        "bg-white/5 hover:bg-white/10 border transition-all"
                                      )}
                                      style={{
                                        borderColor: `${faceColor}30`,
                                        color: faceColor
                                      }}
                                      title={`Filter by ${faceInfo.label}`}
                                    >
                                      {faceInfo.label.replace('Types', '').replace('Mapping', '').replace('Architecture', '').trim()}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {/* Dismiss button */}
                            <button
                              onClick={() => handleDismiss(diagnostic.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
                              title="Dismiss"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Asked state indicator */}
                          {cardState.state === 'asked' && (
                            <div className="mt-2 text-xs text-primary italic">
                              Exploring in chat...
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Dismissed section */}
          {dismissedDiagnostics.length > 0 && (
            <div className="pt-4 border-t border-white/10">
              <button
                onClick={() => setShowDismissed(!showDismissed)}
                className="w-full flex items-center justify-between px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>Dismissed ({dismissedDiagnostics.length})</span>
                <span className="text-primary cursor-pointer">{showDismissed ? 'hide' : 'show'}</span>
              </button>
              {showDismissed && (
                <div className="mt-2 space-y-2 opacity-60">
                  {dismissedDiagnostics.map(diagnostic => (
                    <div
                      key={diagnostic.id}
                      className="p-2 rounded bg-white/5 border border-white/5 text-xs flex items-start justify-between gap-2"
                    >
                      <p className="flex-1 text-white/60">{diagnostic.message}</p>
                      <button
                        onClick={() => handleRestore(diagnostic.id)}
                        className="text-primary hover:underline flex-shrink-0"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
