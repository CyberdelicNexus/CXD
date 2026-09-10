"use client";

// Proposal state machine for the Canvas Assistant:
// propose(text) -> pending card -> apply(selected rows) / discard.
// Apply revalidates against the LIVE store rather than the proposal's snapshot
// and commits through store.applyCanvasBatch as one undoable batch.

import { useCallback, useState } from "react";
import { useCXDStore } from "@/store/cxd-store";
import { useCollaborationContext } from "@/contexts/collaboration-context";
import { proposeCanvasOperations } from "@/lib/ai/canvas-operations-service";
import { translateForApply } from "@/lib/ai/canvas-operations-executor";
import { createTasksFromAI } from "@/lib/ai/task-creation-service";
import { createNoteFromAI } from "@/lib/ai/note-creation-service";
import type { SanitizedProposal } from "@/types/ai-operations";

export type ProposalStatus = "pending" | "applying" | "applied" | "discarded" | "error";

export interface ProposalEntry {
  id: string;
  instruction: string;
  proposal: SanitizedProposal;
  status: ProposalStatus;
  resultNote?: string;
}

interface UseCanvasOperationsOptions {
  provider?: string;
  selectedElementIds: string[];
}

export function useCanvasOperations({ provider, selectedElementIds }: UseCanvasOperationsOptions) {
  const [proposals, setProposals] = useState<ProposalEntry[]>([]);
  const [isProposing, setIsProposing] = useState(false);
  const [proposeError, setProposeError] = useState<string | null>(null);
  const { syncAddElement } = useCollaborationContext();

  /** "proposed" — an approval card is showing.
   *  "empty" — the model read this as conversation; caller should answer in chat.
   *  "failed" — the request errored; caller should still answer in chat, and
   *  proposeError explains why no change set appeared. */
  const propose = useCallback(
    async (instruction: string, groundingText?: string): Promise<"proposed" | "empty" | "failed"> => {
      setIsProposing(true);
      setProposeError(null);
      try {
        const result = await proposeCanvasOperations(instruction, {
          provider,
          selectedElementIds,
          groundingText,
        });
        if (!result.success || !result.proposal) {
          setProposeError(result.error || "Couldn't build a change set.");
          return "failed";
        }
        if (result.proposal.rows.length === 0) return "empty";
        setProposals((prev) => [
          ...prev,
          { id: crypto.randomUUID(), instruction, proposal: result.proposal!, status: "pending" },
        ]);
        return "proposed";
      } finally {
        setIsProposing(false);
      }
    },
    [provider, selectedElementIds],
  );

  /** Clear a stale failure notice — it must not outlive the turn it belongs to. */
  const clearProposeError = useCallback(() => setProposeError(null), []);

  const apply = useCallback(
    async (entryId: string, selectedRowIds: Set<string>) => {
      let entry: ProposalEntry | undefined;
      setProposals((prev) => {
        entry = prev.find((p) => p.id === entryId);
        return prev.map((p) => (p.id === entryId ? { ...p, status: "applying" as const } : p));
      });
      if (!entry) return;

      const state = useCXDStore.getState();
      const project = state.getCurrentProject();
      const liveElements = project?.canvasLayout?.elements || [];
      const liveEdges = project?.canvasLayout?.edges || [];

      const plan = translateForApply(entry.proposal, selectedRowIds, liveElements, liveEdges);

      const hasCanvasWork =
        plan.batch.addElements.length > 0 ||
        plan.batch.addEdges.length > 0 ||
        plan.batch.updates.length > 0 ||
        plan.batch.removeElementIds.length > 0 ||
        plan.batch.removeEdgeIds.length > 0;

      // Blocked by the object quota: nothing is applied, so don't run the
      // task/note side effects either.
      const canvasOk = hasCanvasWork ? state.applyCanvasBatch(plan.batch) : true;

      let sideNotes = "";
      if (canvasOk && plan.tasks.length > 0) {
        const r = await createTasksFromAI(plan.tasks, { chatMessageId: entryId }, syncAddElement);
        sideNotes += r.success
          ? ` ${plan.tasks.length} task(s) added to Plan.`
          : " Task creation failed.";
      }
      if (canvasOk && plan.notes.length > 0) {
        let noteOk = 0;
        for (const note of plan.notes) {
          const r = await createNoteFromAI(note, { chatMessageId: entryId, sourceFaces: [] }, syncAddElement);
          if (r.success) noteOk++;
        }
        sideNotes += noteOk === plan.notes.length
          ? ` ${noteOk} note(s) added to Inbox.`
          : ` ${noteOk}/${plan.notes.length} note(s) added to Inbox (some failed).`;
      }
      if (canvasOk && plan.comments.length > 0) {
        for (const c of plan.comments) state.addComment(c.content, c.position);
        sideNotes += ` ${plan.comments.length} comment(s) pinned.`;
      }
      if (canvasOk && plan.skippedRowIds.length > 0) {
        sideNotes += ` ${plan.skippedRowIds.length} change(s) skipped (elements changed since the proposal).`;
      }

      setProposals((prev) =>
        prev.map((p) =>
          p.id === entryId
            ? canvasOk
              ? { ...p, status: "applied" as const, resultNote: `Applied.${sideNotes}`.trim() }
              : { ...p, status: "error" as const, resultNote: "Blocked by the free-tier object limit." }
            : p,
        ),
      );
    },
    [syncAddElement],
  );

  const discard = useCallback((entryId: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === entryId ? { ...p, status: "discarded" as const } : p)),
    );
  }, []);

  return { proposals, isProposing, proposeError, propose, apply, discard, clearProposeError };
}
