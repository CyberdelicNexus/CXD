"use client";

import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  TrendingUp,
  Link2,
  Scale,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Diagnostic, DiagnosticCategory } from "@/types/diagnostics";

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
  diagnostics: Diagnostic[];
  onFaceReference?: (faceId: string) => void;
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

export function DiagnosticPanel({ diagnostics, onFaceReference, isOpen, onToggle }: DiagnosticPanelProps) {
  // Group diagnostics by category
  const groupedDiagnostics = React.useMemo(() => {
    const groups: Record<DiagnosticCategory, Diagnostic[]> = {
      balance: [],
      coverage: [],
      coherence: [],
      risk: [],
      opportunity: [],
      integration: []
    };
    
    diagnostics.forEach(d => {
      groups[d.category].push(d);
    });
    
    return groups;
  }, [diagnostics]);

  const hasAnyDiagnostics = diagnostics.length > 0;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className={cn(
          "fixed left-0 top-20 z-50 p-2 rounded-r-lg bg-card/95 backdrop-blur-xl border border-l-0 border-border shadow-lg transition-all duration-300",
          isOpen && "left-80"
        )}
        title={isOpen ? "Hide diagnostics" : "Show diagnostics"}
      >
        {isOpen ? (
          <ChevronLeft className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>

      {/* Panel */}
      <div className={cn(
        "fixed left-0 top-16 h-[calc(100vh-4rem)] w-80 bg-card/95 backdrop-blur-xl border-r border-border shadow-2xl overflow-hidden flex flex-col z-40 transition-transform duration-300",
        !isOpen && "-translate-x-full"
      )}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          System Insights
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Interpretive guidance for your experience design
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {!hasAnyDiagnostics && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-primary/50" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your experience structure shows coherent balance.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-2 leading-relaxed">
              As your design evolves, insights will appear here to guide your sensemaking.
            </p>
          </div>
        )}

        {Object.entries(groupedDiagnostics).map(([category, items]) => {
          if (items.length === 0) return null;
          
          const config = CATEGORY_CONFIG[category as DiagnosticCategory];
          const Icon = config.icon;

          return (
            <div key={category} className="space-y-2">
              {/* Category header */}
              <div className="flex items-center gap-2 px-2">
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
              </div>

              {/* Diagnostic items */}
              <div className="space-y-2">
                {items.map(diagnostic => {
                  const severityConfig = SEVERITY_CONFIG[diagnostic.severity];

                  return (
                    <div
                      key={diagnostic.id}
                      className={cn(
                        "rounded-lg p-3 border transition-all",
                        severityConfig.bg,
                        severityConfig.border,
                        "hover:bg-opacity-20"
                      )}
                    >
                      <p className={cn(
                        "text-sm leading-relaxed",
                        severityConfig.color
                      )}>
                        {diagnostic.message}
                      </p>

                      {/* Related faces with glyphs */}
                      {diagnostic.relatedFaces.length > 0 && onFaceReference && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {diagnostic.relatedFaces.map(faceId => {
                            const faceInfo = FACE_IDENTITY[faceId];
                            if (!faceInfo) return null;

                            const faceColor = `hsl(${faceInfo.hue} 40% 60%)`;

                            return (
                              <button
                                key={faceId}
                                onClick={() => onFaceReference(faceId)}
                                className={cn(
                                  "flex items-center gap-1.5 px-2 py-1 rounded-md",
                                  "bg-white/5 hover:bg-white/10 border transition-all",
                                  "group"
                                )}
                                style={{
                                  borderColor: `${faceColor}30`
                                }}
                                title={`Focus on ${faceInfo.label}`}
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 40 40"
                                  className="flex-shrink-0"
                                >
                                  <path
                                    d={faceInfo.glyph}
                                    fill="none"
                                    stroke={faceColor}
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                                <span
                                  className="text-[10px] font-medium uppercase tracking-wide group-hover:opacity-100 opacity-80 transition-opacity"
                                  style={{ color: faceColor }}
                                >
                                  {faceInfo.label.replace('Types', '').replace('Mapping', '').replace('Architecture', '').trim()}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      {hasAnyDiagnostics && (
        <div className="px-4 py-2 border-t border-border">
          <p className="text-[10px] text-muted-foreground/60 italic leading-relaxed">
            These interpretations shift as your design evolves. They guide, not judge.
          </p>
        </div>
      )}
    </div>
    </>
  );
}
