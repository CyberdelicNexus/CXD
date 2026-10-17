"use client";

// Review card for a Canvas Assistant proposal. The proposal is DRAWN, not
// listed: the card shows the diagram as it will land (and existing elements as
// they will look after their edits), so approving is a judgement about the
// result rather than a read-through of a checklist. Changes beyond the drawing
// itself appear as toggle chips; destructive ones are red and never hide
// inside the picture, so a delete cannot be approved by reflex.
//
// Once applied, the same card offers follow-ups that revise what was built in
// place, instead of the user asking again and getting a second diagram.

import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import {
  Check, X, Loader2, Trash2, Shapes, Pencil, Tag, FolderPlus, Link2, CheckSquare, FileText,
  MessageSquare, RefreshCw, ThumbsUp, ThumbsDown,
} from "lucide-react";
import { NOT_RIGHT_REASONS } from "@/lib/ai/assistant-feedback";
import { FORMS } from "@/lib/ai/assistant-forms";
import { cn } from "@/lib/utils";
import { useCXDStore } from "@/store/cxd-store";
import { translateForApply } from "@/lib/ai/canvas-operations-executor";
import type { CanvasElement } from "@/types/canvas-elements";
import type { ProposalEntry } from "@/hooks/use-canvas-operations";
import { MapPreview } from "./map-preview";

const KIND_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  create: Shapes,
  update: Pencil,
  delete: Trash2,
  tag: Tag,
  group: FolderPlus,
  connect: Link2,
  task: CheckSquare,
  note: FileText,
  comment: MessageSquare,
};

/** Follow-ups offered on a diagram the assistant just built. */
const REFINEMENTS: { label: string; instruction: string }[] = [
  { label: "Make it vertical", instruction: "Redraw it top to bottom as a vertical layout." },
  { label: "Add descriptions", instruction: "Add a short description to each stage, as a detail node connected to it." },
  { label: "Shorter labels", instruction: "Shorten every label to at most three words; keep the structure." },
  { label: "Simplify", instruction: "Simplify it: keep only the essential nodes and merge or drop the rest." },
  { label: "Change colour", instruction: "Use a different colour family that suits the content; keep everything else." },
];

interface CanvasOperationsPreviewProps {
  entry: ProposalEntry;
  onApply: (entryId: string, selectedRowIds: Set<string>) => void;
  onDiscard: (entryId: string) => void;
  /** Revise what this entry built. Absent while another request is running. */
  onRefine?: (entry: ProposalEntry, label: string, instruction: string) => void;
  /** Offer the form chooser again for the same request. */
  onChangeForm?: (entry: ProposalEntry) => void;
  /** Rate a built result (beta training signal). Resolves true when it was recorded. */
  onRate?: (entry: ProposalEntry, rating: 1 | -1, reason?: string) => Promise<{ credited: boolean }>;
}

export function CanvasOperationsPreview({
  entry, onApply, onDiscard, onRefine, onChangeForm, onRate,
}: CanvasOperationsPreviewProps) {
  const { proposal } = entry;
  const [checked, setChecked] = useState<Set<string>>(() => new Set(proposal.rows.map((r) => r.rowId)));
  const [rated, setRated] = useState<"none" | "up" | "choosing" | "down">("none");
  const [credited, setCredited] = useState(false);
  const rate = (rating: 1 | -1, reason?: string) => {
    setRated(rating === 1 ? "up" : "down");
    void onRate?.(entry, rating, reason).then((r) => setCredited(!!r?.credited));
  };

  const toggle = (rowId: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });

  const pending = entry.status === "pending" || entry.status === "applying";

  // What the checked rows would do to the canvas right now. Read through
  // getState(): the card only needs the canvas as it is when the proposal (or
  // a toggle) is rendered, and a subscription here would redraw on every drag.
  const preview = useMemo(() => {
    if (!pending) return null;
    const project = useCXDStore.getState().getCurrentProject();
    const live = project?.canvasLayout?.elements || [];
    const liveEdges = project?.canvasLayout?.edges || [];
    const plan = translateForApply(proposal, checked, live, liveEdges);
    const patched = new Map(plan.batch.updates.map((u) => [u.id, u.updates]));
    // The drawing: everything new, plus existing elements as they will look.
    const elements: CanvasElement[] = [
      ...plan.batch.addElements,
      ...live.filter((el) => patched.has(el.id)).map((el) => ({ ...el, ...patched.get(el.id) }) as CanvasElement),
    ];
    const ids = new Set(elements.map((el) => el.id));
    const edges = [
      ...plan.batch.addEdges,
      ...liveEdges.filter((e) => ids.has(e.fromNodeId) && ids.has(e.toNodeId)),
    ];
    return {
      elements,
      edges,
      added: plan.batch.addElements.length,
      connectors: plan.batch.addEdges.length,
      edited: plan.batch.updates.length,
      removed: plan.batch.removeElementIds.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal, checked, pending]);

  // A locally applied tool (tidy, connect) has no proposal: one quiet line.
  if (proposal.rows.length === 0) {
    return (
      <div className="my-1.5 flex items-center gap-2 px-1 text-xs">
        <span className="truncate text-muted-foreground/70">{entry.instruction}</span>
        <span
          className={cn(
            "flex-shrink-0",
            entry.status === "applied" && "text-emerald-400",
            entry.status === "discarded" && "text-muted-foreground/60",
            entry.status === "error" && "text-red-400",
          )}
        >
          {entry.resultNote}
        </span>
      </div>
    );
  }

  const summary = preview
    ? [
        preview.added > 0 && `${preview.added} element${preview.added === 1 ? "" : "s"}`,
        preview.connectors > 0 && `${preview.connectors} connector${preview.connectors === 1 ? "" : "s"}`,
        preview.edited > 0 && `${preview.edited} edited`,
        preview.removed > 0 && `${preview.removed} removed`,
      ].filter(Boolean).join(" · ")
    : "";
  // One row needs no toggles: Build or Discard already says everything.
  const showChips = proposal.rows.length > 1 || proposal.rows.some((r) => r.destructive);
  const draws = !!proposal.creates && checked.has(proposal.creates.rowId);
  const canRefine = entry.status === "applied" && !!entry.builtIds?.length && !!onRefine;

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-violet-500/25 bg-violet-500/[0.04] animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div className="px-3.5 py-2">
        <p className="truncate text-[11px] text-muted-foreground/70">You asked: {entry.instruction}</p>
        {entry.form && (
          <p className="mt-0.5 text-[11px] text-violet-200/80">Drawn as: {FORMS[entry.form].label}</p>
        )}
        {proposal.reply && <p className="mt-1 text-xs leading-relaxed text-foreground/85">{proposal.reply}</p>}
      </div>

      {pending && preview && (
        <>
          {preview.elements.length > 0 && (
            <div className="px-2">
              <MapPreview elements={preview.elements} edges={preview.edges} height={220} label="Proposed changes" />
            </div>
          )}
          {summary && <p className="px-3.5 pt-1.5 text-[11px] text-muted-foreground/70">{summary}</p>}

          {showChips && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-2">
              {proposal.rows.map((row) => {
                const Icon = KIND_ICONS[row.kind] || Pencil;
                const on = checked.has(row.rowId);
                return (
                  <button
                    key={row.rowId}
                    type="button"
                    onClick={() => toggle(row.rowId)}
                    aria-pressed={on}
                    title={on ? "Included. Click to leave this out" : "Left out. Click to include"}
                    className={cn(
                      "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] leading-none transition-colors",
                      on && !row.destructive && "border-violet-400/40 bg-violet-500/15 text-violet-100",
                      on && row.destructive && "border-red-400/50 bg-red-500/15 text-red-200",
                      !on && "border-white/10 text-muted-foreground/50 line-through",
                    )}
                  >
                    <Icon className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{row.summary}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-white/8 px-3.5 py-2">
            <button
              type="button"
              onClick={() => onDiscard(entry.id)}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/10"
            >
              <X className="h-3 w-3" /> Discard
            </button>
            <button
              type="button"
              onClick={() => onApply(entry.id, checked)}
              disabled={checked.size === 0 || entry.status === "applying"}
              className="flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium text-white/95 transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, hsl(270 60% 45%), hsl(190 70% 40%))",
                boxShadow: "0 0 10px rgba(139,92,246,0.3)",
              }}
            >
              {entry.status === "applying" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              {draws ? "Build on canvas" : `Apply ${checked.size} change${checked.size === 1 ? "" : "s"}`}
            </button>
          </div>
        </>
      )}

      {!pending && (
        <div className="border-t border-white/8 px-3.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <p
              className={cn(
                "text-xs",
                entry.status === "applied" && "text-emerald-400",
                entry.status === "discarded" && "text-muted-foreground/60",
                entry.status === "error" && "text-red-400",
              )}
            >
              {entry.status === "applied" && (entry.resultNote || "On the canvas.")}
              {entry.status === "discarded" && "Discarded."}
              {entry.status === "error" && (entry.resultNote || "Failed to apply.")}
            </p>
            {onRate && entry.status === "applied" && rated === "none" && (
              <div className="flex flex-shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => rate(1)}
                  title="This is right"
                  aria-label="This is right"
                  className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-white/10 hover:text-emerald-300"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setRated("choosing")}
                  title="This is not right"
                  aria-label="This is not right"
                  className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-white/10 hover:text-red-300"
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {(rated === "up" || rated === "down") && (
              <span className="flex-shrink-0 text-[11px] text-muted-foreground/60">
                Thanks, that helps train it{credited && <span className="text-emerald-300/80"> · 1 credit back</span>}
              </span>
            )}
          </div>

          {/* One tap says what was wrong; the reason is what makes a thumbs-down usable. */}
          {rated === "choosing" && (
            <div className="mt-2">
              <p className="mb-1.5 text-[11px] text-muted-foreground/70">What was off?</p>
              <div className="flex flex-wrap gap-1.5">
                {NOT_RIGHT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => rate(-1, reason)}
                    className="rounded-full border border-red-400/25 bg-red-500/[0.06] px-2.5 py-1 text-[11px] leading-none text-red-100/90 transition-colors hover:border-red-400/50 hover:bg-red-500/15"
                  >
                    {reason}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => rate(-1)}
                  className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] leading-none text-muted-foreground transition-colors hover:bg-white/10"
                >
                  Something else
                </button>
              </div>
            </div>
          )}
          {canRefine && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {REFINEMENTS.map((r) => (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => onRefine!(entry, r.label, r.instruction)}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] leading-none text-foreground/75 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-foreground"
                >
                  {r.label}
                </button>
              ))}
              {onChangeForm && (
                <button
                  type="button"
                  onClick={() => onChangeForm(entry)}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] leading-none text-foreground/75 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-foreground"
                >
                  <RefreshCw className="h-3 w-3" /> Another form
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
