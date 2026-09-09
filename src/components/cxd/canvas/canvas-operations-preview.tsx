"use client";

// Preview-then-confirm card for a Canvas Assistant proposal.
// Every row is a checkbox (checked by default); destructive rows are red so a
// delete can never be approved by reflex along with additive changes.

import { useState } from "react";
import type { ComponentType } from "react";
import {
  Check, X, Loader2, Trash2, Plus, Pencil, Tag, FolderPlus, Link2, CheckSquare, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProposalEntry } from "@/hooks/use-canvas-operations";

const KIND_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  tag: Tag,
  group: FolderPlus,
  connect: Link2,
  task: CheckSquare,
  note: FileText,
};

interface CanvasOperationsPreviewProps {
  entry: ProposalEntry;
  onApply: (entryId: string, selectedRowIds: Set<string>) => void;
  onDiscard: (entryId: string) => void;
}

export function CanvasOperationsPreview({ entry, onApply, onDiscard }: CanvasOperationsPreviewProps) {
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(entry.proposal.rows.map((r) => r.rowId)),
  );

  const toggle = (rowId: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });

  const settled =
    entry.status === "applied" || entry.status === "discarded" || entry.status === "error";

  return (
    <div className="my-2 rounded-xl border border-violet-500/25 bg-violet-500/[0.04] overflow-hidden animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div className="px-3.5 py-2 border-b border-white/8">
        <p className="text-[11px] text-muted-foreground/70 truncate">You asked: {entry.instruction}</p>
        {entry.proposal.reply && (
          <p className="text-xs text-foreground/85 mt-1 leading-relaxed">{entry.proposal.reply}</p>
        )}
      </div>

      {settled ? (
        <div
          className={cn(
            "px-3.5 py-2 text-xs",
            entry.status === "applied" && "text-emerald-400",
            entry.status === "discarded" && "text-muted-foreground/60",
            entry.status === "error" && "text-red-400",
          )}
        >
          {entry.status === "applied" && (entry.resultNote || "Applied.")}
          {entry.status === "discarded" && "Discarded."}
          {entry.status === "error" && (entry.resultNote || "Failed to apply.")}
        </div>
      ) : (
        <>
          <div className="px-2 py-1.5 max-h-56 overflow-y-auto">
            {entry.proposal.rows.map((row) => {
              const Icon = KIND_ICONS[row.kind] || Pencil;
              const isChecked = checked.has(row.rowId);
              return (
                <button
                  key={row.rowId}
                  onClick={() => toggle(row.rowId)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors hover:bg-white/5",
                    !isChecked && "opacity-45",
                  )}
                >
                  <span
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                      isChecked
                        ? row.destructive
                          ? "bg-red-500/25 border-red-500/60"
                          : "bg-violet-500/25 border-violet-500/60"
                        : "border-white/25",
                    )}
                  >
                    {isChecked && <Check className="w-3 h-3" />}
                  </span>
                  <Icon
                    className={cn(
                      "w-3.5 h-3.5 flex-shrink-0",
                      row.destructive ? "text-red-400" : "text-violet-300/80",
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs leading-snug",
                      row.destructive ? "text-red-300/90" : "text-foreground/85",
                    )}
                  >
                    {row.summary}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="px-3.5 py-2 border-t border-white/8 flex items-center justify-end gap-2">
            <button
              onClick={() => onDiscard(entry.id)}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/10 rounded-md transition-colors flex items-center gap-1.5"
            >
              <X className="w-3 h-3" /> Discard
            </button>
            <button
              onClick={() => onApply(entry.id, checked)}
              disabled={checked.size === 0 || entry.status === "applying"}
              className="px-3.5 py-1.5 text-xs font-medium rounded-md transition-all text-white/95 flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
              style={{
                background: "linear-gradient(135deg, hsl(270 60% 45%), hsl(190 70% 40%))",
                boxShadow: "0 0 10px rgba(139,92,246,0.3)",
              }}
            >
              {entry.status === "applying" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Apply {checked.size} change{checked.size === 1 ? "" : "s"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
