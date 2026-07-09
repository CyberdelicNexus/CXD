"use client";

import React, { useMemo, useState } from "react";
import { Sparkles, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HypercubeFaceTag } from "@/types/canvas-elements";
import type { EnrichedSuggestion } from "@/lib/ai/tag-suggestion-service";

export interface TagSuggestionPanelProps {
  suggestions: EnrichedSuggestion[];
  considered: number;
  onApply: (accepted: Array<{ id: string; tags: HypercubeFaceTag[] }>) => void;
  onClose: () => void;
}

// key = `${elementId}::${tag}` for a toggled-on chip
const chipKey = (id: string, tag: string) => `${id}::${tag}`;

/**
 * Propose-only review UI for AI-suggested hypercube tags.
 * Every suggested tag renders as a chip, selected by default. The user
 * toggles chips off to reject, then applies. Nothing is written until Apply.
 */
export function TagSuggestionPanel({
  suggestions,
  considered,
  onApply,
  onClose,
}: TagSuggestionPanelProps) {
  // All suggested chips start selected.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(suggestions.flatMap((s) => s.tags.map((t) => chipKey(s.id, t))))
  );

  const toggle = (id: string, tag: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const k = chipKey(id, tag);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const acceptedCount = selected.size;

  const accepted = useMemo(
    () =>
      suggestions
        .map((s) => ({
          id: s.id,
          tags: s.tags.filter((t) => selected.has(chipKey(s.id, t))) as HypercubeFaceTag[],
        }))
        .filter((a) => a.tags.length > 0),
    [suggestions, selected]
  );

  const allOn = () =>
    setSelected(new Set(suggestions.flatMap((s) => s.tags.map((t) => chipKey(s.id, t)))));
  const allOff = () => setSelected(new Set());

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl mx-4">
      <div className="bg-card/95 backdrop-blur-xl rounded-xl border border-fuchsia-500/30 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-fuchsia-400" />
            <span className="text-sm font-semibold text-foreground">Suggested tags</span>
            <span className="px-2 py-0.5 text-xs bg-fuchsia-500/20 text-fuchsia-300 rounded-full">
              {suggestions.length} of {considered} element{considered !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={allOn}
              className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-md transition-colors"
            >
              Select all
            </button>
            <button
              onClick={allOff}
              className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-md transition-colors"
            >
              Clear
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded-md text-muted-foreground hover:text-foreground transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Suggestions list */}
        <div className="px-4 py-3 max-h-64 overflow-y-auto space-y-2.5">
          {suggestions.map((s) => (
            <div key={s.id} className="flex items-start gap-3">
              <span className="text-sm text-foreground/90 leading-snug flex-1 min-w-0 truncate" title={s.preview}>
                {s.preview}
              </span>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {s.tags.map((tag) => {
                  const on = selected.has(chipKey(s.id, tag));
                  return (
                    <button
                      key={tag}
                      onClick={() => toggle(s.id, tag)}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-all",
                        on
                          ? "bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-300"
                          : "bg-transparent border-border text-muted-foreground/60 line-through"
                      )}
                    >
                      {on && <Check className="w-3 h-3" />}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Review the suggestions, then apply. Nothing changes until you do.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onApply(accepted)}
              disabled={acceptedCount === 0}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                acceptedCount > 0
                  ? "bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/40 text-fuchsia-300"
                  : "bg-white/5 border border-border text-muted-foreground/50 cursor-not-allowed"
              )}
            >
              <Check className="w-4 h-4" />
              Apply {acceptedCount > 0 ? `${acceptedCount} tag${acceptedCount !== 1 ? "s" : ""}` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
