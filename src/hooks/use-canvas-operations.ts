"use client";

// Proposal state machine for the Canvas Assistant:
// propose(text) -> pending card -> apply(selected rows) / discard.
// Apply revalidates against the LIVE store rather than the proposal's snapshot
// and commits through store.applyCanvasBatch as one undoable batch, then hands
// the new elements to the build reveal (camera glide + staged appearance).

import { useCallback, useEffect, useRef, useState } from "react";
import { useCXDStore } from "@/store/cxd-store";
import { useCollaborationContext } from "@/contexts/collaboration-context";
import { proposeCanvasOperations } from "@/lib/ai/canvas-operations-service";
import { translateForApply } from "@/lib/ai/canvas-operations-executor";
import { createTasksFromAI } from "@/lib/ai/task-creation-service";
import { createNoteFromAI } from "@/lib/ai/note-creation-service";
import { startBuild, requestSelection } from "@/lib/ai/assistant-build";
import { FORMS, type FormId } from "@/lib/ai/assistant-forms";
import { logAssistantEvent, snapshotBuild } from "@/lib/ai/assistant-feedback";
import { realBounds } from "@/lib/canvas-layout-rules";
import type { CanvasElement } from "@/types/canvas-elements";
import type { CanvasBatchMutation, SanitizedProposal } from "@/types/ai-operations";

export type ProposalStatus = "pending" | "applying" | "applied" | "discarded" | "error";

export interface ProposalEntry {
  id: string;
  /** What the user asked, in their words (shown on the card). */
  instruction: string;
  proposal: SanitizedProposal;
  status: ProposalStatus;
  resultNote?: string;
  /** Elements this entry put on the canvas: what "refine" acts on. */
  builtIds?: string[];
  /** Form the user chose, when they were asked. */
  form?: FormId;
}

export interface ProposeOptions {
  /** Assistant answer to ground the changes on. */
  groundingText?: string;
  /** Diagram form the user picked. */
  form?: FormId;
  /** Form that was recommended when the user was asked (null = they let the assistant decide). */
  suggestedForm?: FormId;
  /** Elements the request is about, when not the live selection (refining a build). */
  targetIds?: string[];
  /** Text for the card when the instruction sent to the model is not the user's own words. */
  label?: string;
  /** Elements the new drawing replaces. Their removal is added to the proposal
   *  here, deterministically, as a visible red row: the model is only asked to
   *  draw, never trusted to copy dozens of ids into a delete. */
  replaceIds?: string[];
}

interface UseCanvasOperationsOptions {
  provider?: string;
  selectedElementIds: string[];
  /** Saved "draw it like this" description for this project. */
  styleNote?: string;
  /** For the beta feedback log. */
  projectId?: string;
}

/** How long after a build its disappearance still counts as "taken back". */
const REMOVAL_WATCH_MS = 10 * 60 * 1000;

/** Width the docked assistant panel covers on the right of the canvas. */
const PANEL_INSET_PX = 444;
const NAVBAR_PX = 64;

const EMPTY_PROPOSAL: SanitizedProposal = { reply: "", rows: [], creates: null, ops: [], droppedCount: 0 };

/** World-space centre of the part of the canvas not covered by the assistant. */
function visibleCentre(): { x: number; y: number } {
  const { canvasPosition, canvasZoom } = useCXDStore.getState();
  const w = typeof window !== "undefined" ? window.innerWidth : 1280;
  const h = typeof window !== "undefined" ? window.innerHeight - NAVBAR_PX : 720;
  return {
    x: ((w - PANEL_INSET_PX) / 2 - canvasPosition.x) / canvasZoom,
    y: (h / 2 - canvasPosition.y) / canvasZoom,
  };
}

/** Glide the camera to a batch and reveal it; no-op for an empty batch. */
function showBuild(batch: CanvasBatchMutation): void {
  if (batch.addElements.length === 0) return;
  const boxes = batch.addElements
    .map((el) => realBounds(el))
    .filter((b): b is NonNullable<typeof b> => !!b);
  if (boxes.length > 0) {
    useCXDStore.getState().setPendingCanvasFitBounds({
      minX: Math.min(...boxes.map((b) => b.x)),
      minY: Math.min(...boxes.map((b) => b.y)),
      maxX: Math.max(...boxes.map((b) => b.x + b.w)),
      maxY: Math.max(...boxes.map((b) => b.y + b.h)),
      animate: true,
      insetRight: PANEL_INSET_PX,
    });
  }
  startBuild(batch.addElements, batch.addEdges);
}

export function useCanvasOperations({ provider, selectedElementIds, styleNote, projectId }: UseCanvasOperationsOptions) {
  const [proposals, setProposals] = useState<ProposalEntry[]>([]);
  const [proposingSince, setProposingSince] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [proposeError, setProposeError] = useState<string | null>(null);
  const { syncAddElement } = useCollaborationContext();
  const isProposing = proposingSince !== null;
  // Latest list for callbacks that only need to read it (logging), so they do
  // not have to do side effects inside a state updater.
  const proposalsRef = useRef(proposals);
  proposalsRef.current = proposals;

  // "Removed" signal: a build that is gone from the canvas within a few minutes
  // (undo, or select-all-and-delete) was not what the user wanted, even if
  // they never touched a thumb. Builds replaced on purpose by a refinement are
  // marked superseded and not counted.
  const watchers = useRef(new Map<string, number>());
  const superseded = useRef(new Set<string>());
  useEffect(() => {
    const timers = watchers.current;
    return () => timers.forEach((t) => window.clearInterval(t));
  }, []);
  const markSuperseded = useCallback((entryId: string) => {
    superseded.current.add(entryId);
    const t = watchers.current.get(entryId);
    if (t !== undefined) window.clearInterval(t);
    watchers.current.delete(entryId);
  }, []);
  const watchBuild = useCallback((entryId: string, builtIds: string[], instruction: string) => {
    if (builtIds.length === 0) return;
    const builtAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - builtAt;
      const live = new Set((useCXDStore.getState().getCurrentProject()?.canvasLayout?.elements || []).map((el) => el.id));
      const remaining = builtIds.filter((id) => live.has(id)).length;
      const stop = () => { window.clearInterval(timer); watchers.current.delete(entryId); };
      if (remaining === 0 && !superseded.current.has(entryId)) {
        stop();
        void logAssistantEvent({
          entryId, event: "removed", projectId, model: provider, instruction,
          payload: { secondsAfterBuild: Math.round(elapsed / 1000), built: builtIds.length },
        });
      } else if (elapsed > REMOVAL_WATCH_MS) {
        stop();
      }
    }, 5000);
    watchers.current.set(entryId, timer);
  }, [projectId, provider]);

  // Real elapsed time for the waiting indicator. The request is a single model
  // call with no intermediate stages to report, so the honest signal is the clock.
  useEffect(() => {
    if (proposingSince === null) return;
    setElapsedSeconds(0);
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - proposingSince) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [proposingSince]);

  /** "proposed" — an approval card is showing.
   *  "empty" — the model read this as conversation; caller should answer in chat.
   *  "failed" — the request errored; caller should still answer in chat, and
   *  proposeError explains why no change set appeared. */
  const propose = useCallback(
    async (instruction: string, opts: ProposeOptions = {}): Promise<"proposed" | "empty" | "failed"> => {
      setProposingSince(Date.now());
      setProposeError(null);
      try {
        const directives = [
          opts.replaceIds?.length
            ? "The selected elements are the current version. Draw the new version as fresh elements. Do not delete, move or edit the selected elements yourself: they are removed automatically when the new version is built."
            : "",
          opts.form ? FORMS[opts.form].directive : "",
          styleNote ? `Follow this project's saved style: ${styleNote}` : "",
        ].filter(Boolean);
        const result = await proposeCanvasOperations(
          directives.length ? `${instruction}\n\n${directives.join("\n")}` : instruction,
          {
            provider,
            selectedElementIds: opts.targetIds ?? selectedElementIds,
            groundingText: opts.groundingText,
          },
        );
        if (!result.success || !result.proposal) {
          setProposeError(result.error || "Couldn't build a change set.");
          return "failed";
        }
        if (result.proposal.rows.length === 0) return "empty";
        const proposal = result.proposal;
        if (opts.replaceIds?.length && proposal.creates) {
          const rowId = "row-replace";
          const n = opts.replaceIds.length;
          proposal.rows.push({ rowId, kind: "delete", summary: `Remove the previous version (${n} element${n === 1 ? "" : "s"})`, destructive: true });
          proposal.ops.push({ rowId, kind: "delete", ids: opts.replaceIds });
          // Tags are the user's own classification of an element: a redraw must
          // not lose them. Carried over here by matching what each element
          // says, rather than trusting the model to copy them.
          const replacing = new Set(opts.replaceIds);
          const said = (el: CanvasElement) => {
            const e = el as unknown as { content?: string; label?: string; noteTitle?: string };
            return String(e.content || e.noteTitle || e.label || "").replace(/\s+/g, " ").trim().toLowerCase();
          };
          const tagsBySaid = new Map<string, CanvasElement["hypercubeTags"]>();
          for (const old of useCXDStore.getState().getCurrentProject()?.canvasLayout?.elements || []) {
            if (replacing.has(old.id) && old.hypercubeTags?.length && said(old)) tagsBySaid.set(said(old), old.hypercubeTags);
          }
          for (const el of proposal.creates.elements) {
            const tags = tagsBySaid.get(said(el));
            // Children inherit their frame's tags, so only top-level elements carry their own.
            if (tags && !el.containerId && !el.hypercubeTags?.length) el.hypercubeTags = tags;
          }
        }
        const id = crypto.randomUUID();
        const shown = opts.label ?? instruction;
        setProposals((prev) => [
          ...prev,
          { id, instruction: shown, proposal, status: "pending", ...(opts.form ? { form: opts.form } : {}) },
        ]);
        // Beta log: when the form was offered, what was suggested against what was chosen.
        if (opts.suggestedForm) {
          void logAssistantEvent({
            entryId: id, event: "form_picked", projectId, model: provider, instruction: shown,
            payload: { suggested: opts.suggestedForm, picked: opts.form ?? "assistant-decides" },
          });
        }
        return "proposed";
      } finally {
        setProposingSince(null);
      }
    },
    [provider, selectedElementIds, styleNote],
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

      const plan = translateForApply(entry.proposal, selectedRowIds, liveElements, liveEdges, {
        viewportCenter: visibleCentre(),
        boardId: state.activeBoardId ?? null,
      });

      const hasCanvasWork =
        plan.batch.addElements.length > 0 ||
        plan.batch.addEdges.length > 0 ||
        plan.batch.updates.length > 0 ||
        plan.batch.removeElementIds.length > 0 ||
        plan.batch.removeEdgeIds.length > 0;

      // Blocked by the object quota: nothing is applied, so don't run the
      // task/note side effects either.
      const canvasOk = hasCanvasWork ? state.applyCanvasBatch(plan.batch) : true;
      if (canvasOk && hasCanvasWork) {
        if (plan.batch.addElements.length > 0) showBuild(plan.batch);
        else if (plan.batch.updates.length > 0) requestSelection(plan.batch.updates.map((u) => u.id));
      }

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

      const builtIds = plan.batch.addElements.map((el: CanvasElement) => el.id);
      if (canvasOk) watchBuild(entryId, builtIds, entry.instruction);
      if (canvasOk) {
        void logAssistantEvent({
          entryId, event: "built", projectId, model: provider, instruction: entry.instruction,
          payload: {
            form: entry.form ?? null,
            rows: entry.proposal.rows.map((r) => r.kind),
            rowsLeftOut: entry.proposal.rows.length - selectedRowIds.size,
            added: plan.batch.addElements.length,
            connectors: plan.batch.addEdges.length,
            edited: plan.batch.updates.length,
            removed: plan.batch.removeElementIds.length,
            ...(plan.batch.addElements.length > 0 ? { snapshot: snapshotBuild(plan.batch.addElements, plan.batch.addEdges) } : {}),
          },
        });
      }
      setProposals((prev) =>
        prev.map((p) =>
          p.id === entryId
            ? canvasOk
              ? {
                  ...p,
                  status: "applied" as const,
                  resultNote: `On the canvas.${sideNotes}`.trim(),
                  ...(builtIds.length > 0 ? { builtIds } : {}),
                }
              : { ...p, status: "error" as const, resultNote: "Blocked by the free-tier object limit." }
            : p,
        ),
      );
    },
    [syncAddElement, projectId, provider, watchBuild],
  );

  /**
   * Apply a batch computed locally (tidy, connect in order): no model call, no
   * review step, still one undo. Leaves a settled line in the thread so the
   * action is visible in the conversation.
   */
  const applyLocal = useCallback((label: string, batch: CanvasBatchMutation | null, emptyNote: string) => {
    const id = crypto.randomUUID();
    const settle = (status: ProposalStatus, resultNote: string) =>
      setProposals((prev) => [...prev, { id, instruction: label, proposal: EMPTY_PROPOSAL, status, resultNote }]);
    if (!batch) return settle("discarded", emptyNote);
    const ok = useCXDStore.getState().applyCanvasBatch(batch);
    if (!ok) return settle("error", "Blocked by the free-tier object limit.");
    const touched = batch.updates.length + batch.addEdges.length + batch.addElements.length;
    settle("applied", `Done: ${touched} change${touched === 1 ? "" : "s"}. Undo with Ctrl+Z.`);
  }, []);

  const discard = useCallback((entryId: string) => {
    {
      const entry = proposalsRef.current.find((p) => p.id === entryId);
      // A proposal thrown away unbuilt is the clearest "this was not it" there is.
      if (entry && entry.status === "pending") {
        void logAssistantEvent({
          entryId, event: "discarded", projectId, model: provider, instruction: entry.instruction,
          payload: {
            form: entry.form ?? null,
            rows: entry.proposal.rows.map((r) => r.kind),
            proposed: entry.proposal.creates?.elements.length ?? 0,
            ...(entry.proposal.creates ? { snapshot: snapshotBuild(entry.proposal.creates.elements, entry.proposal.creates.edges) } : {}),
          },
        });
      }
    }
    setProposals((prev) => prev.map((p) => (p.id === entryId ? { ...p, status: "discarded" as const } : p)));
  }, [projectId, provider]);

  return { proposals, isProposing, elapsedSeconds, proposeError, propose, apply, applyLocal, discard, clearProposeError, markSuperseded };
}
