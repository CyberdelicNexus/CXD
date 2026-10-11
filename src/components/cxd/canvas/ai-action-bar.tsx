"use client";

import React, { useState } from "react";
import { AlertCircle, Check, ListChecks, Loader2, StickyNote, Wand2, Workflow, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExtractedTask } from "@/lib/ai/ai-response-classifier";
import { TaskPreviewPanel } from "./task-preview-panel";
import { createTasksFromAI } from "@/lib/ai/task-creation-service";
import { createNoteFromAI } from "@/lib/ai/note-creation-service";
import { generateElementsFromPrompt } from "@/lib/ai/element-generation-service";
import { useCollaborationContext } from "@/contexts/collaboration-context";

export interface AIActionBarProps {
  tasks: ExtractedTask[];
  noteContent: string;
  sourceFaces: string[];
  chatMessageId: string;
  sourceInsightId?: string;
  /** Full assistant message text — enables the "Draft diagram" action */
  messageContent?: string;
  /** AI provider/model key forwarded to element generation */
  provider?: string;
  onTasksAdded?: () => void;
  onNoteCreated?: () => void;
  onElementsPlaced?: (count: number) => void;
  /** Canvas assistant: propose concrete canvas changes grounded on this reply */
  onProposeChanges?: (content: string) => void;
  /** Credits "Apply to canvas" will use, shown before the click. */
  proposeCost?: number;
}

type ButtonState = 'idle' | 'loading' | 'success' | 'error';

export function AIActionBar({
  tasks,
  noteContent,
  sourceFaces,
  chatMessageId,
  sourceInsightId,
  messageContent,
  provider,
  onTasksAdded,
  onNoteCreated,
  onElementsPlaced,
  onProposeChanges,
  proposeCost,
}: AIActionBarProps) {
  const { syncAddElement } = useCollaborationContext();
  const [taskButtonState, setTaskButtonState] = useState<ButtonState>('idle');
  const [noteButtonState, setNoteButtonState] = useState<ButtonState>('idle');
  const [draftButtonState, setDraftButtonState] = useState<ButtonState>('idle');
  const [showTaskPreview, setShowTaskPreview] = useState(false);

  const hasTasks = tasks.length > 0;
  const hasNote = noteContent.length > 0;
  const hasDraftable = !!messageContent && messageContent.trim().length > 0;

  // Don't render if no actionable content
  if (!hasTasks && !hasNote && !hasDraftable) {
    return null;
  }

  const handleAddTasks = () => {
    if (taskButtonState !== 'idle') return;
    setShowTaskPreview(true);
  };

  const handlePlaceNote = async () => {
    if (noteButtonState !== 'idle') return;

    try {
      // Create note using the note creation service
      const result = await createNoteFromAI(
        noteContent,
        {
          chatMessageId,
          sourceInsightId,
          sourceFaces,
        },
        syncAddElement
      );

      // Show success or error state
      if (result.success) {
        console.log(`[AIActionBar] Successfully created note: ${result.noteId}`);
        setNoteButtonState('success');
        setTimeout(() => setNoteButtonState('idle'), 2000);
        onNoteCreated?.();
      } else {
        console.error(`[AIActionBar] Failed to create note:`, result.error);
        setNoteButtonState('error');
        setTimeout(() => setNoteButtonState('idle'), 3000);
      }
    } catch (error) {
      console.error('[AIActionBar] Failed to create note:', error);
      setNoteButtonState('error');
      setTimeout(() => setNoteButtonState('idle'), 3000);
    }
  };

  const handleDraftOnCanvas = async () => {
    if (draftButtonState !== 'idle' || !messageContent) return;
    setDraftButtonState('loading');

    try {
      const result = await generateElementsFromPrompt(
        `Turn the following AI chat answer into a diagram on the canvas. Pick the form its content calls for (flow, loop, spine, mind map, table, quadrants or frames) and keep its specifics:\n\n${messageContent}`,
        { provider, sourceFaces }
      );

      if (result.success) {
        console.log(`[AIActionBar] Placed ${result.count} generated elements on canvas`);
        setDraftButtonState('success');
        setTimeout(() => setDraftButtonState('idle'), 2000);
        onElementsPlaced?.(result.count);
      } else {
        console.error('[AIActionBar] Element generation failed:', result.error);
        setDraftButtonState('error');
        setTimeout(() => setDraftButtonState('idle'), 3000);
      }
    } catch (error) {
      console.error('[AIActionBar] Element generation failed:', error);
      setDraftButtonState('error');
      setTimeout(() => setDraftButtonState('idle'), 3000);
    }
  };

  const taskLabel = tasks.length === 1 ? 'Add 1 task' : `Add ${tasks.length} tasks`;

  return (
    <>
      {/* Chips wrap onto further rows instead of shrinking: the bar lives in a
          narrow chat column, and four fixed-height buttons on one line is what
          squeezed every label into a single-word stack. */}
      <div
        className="mt-2.5 flex flex-wrap items-center gap-1.5 animate-in slide-in-from-bottom-2 duration-200"
        style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}
      >
        {onProposeChanges && messageContent && (
          <ActionChip
            primary
            icon={Wand2}
            label="Apply to canvas"
            title={`Draw this answer on the canvas. You see a preview before anything is applied.${proposeCost ? ` Uses ${proposeCost} credits.` : ""}`}
            suffix={proposeCost ? `${proposeCost} cr` : undefined}
            onClick={() => onProposeChanges(messageContent)}
          />
        )}

        {/* One way to draw per surface. Where the review pipeline exists
            ("Apply to canvas") it also draws diagrams, so offering the direct
            draft beside it gave two buttons that produced different layouts
            of the same answer. The direct draft remains for chats without it. */}
        {hasDraftable && !onProposeChanges && (
          <ActionChip
            icon={Workflow}
            state={draftButtonState}
            label="Draft diagram"
            labels={{ loading: 'Drafting…', success: 'On canvas', error: 'Failed, retry' }}
            title="Lay this answer out as a diagram on the canvas"
            onClick={handleDraftOnCanvas}
          />
        )}

        {hasTasks && (
          <ActionChip
            icon={ListChecks}
            state={taskButtonState}
            label={taskLabel}
            labels={{ success: 'Added to Plan', error: 'Failed, retry' }}
            title="Review these tasks and add them to the Plan tab"
            onClick={handleAddTasks}
          />
        )}

        {hasNote && (
          <ActionChip
            icon={StickyNote}
            state={noteButtonState}
            label="Save as note"
            labels={{ success: 'In Inbox', error: 'Failed, retry' }}
            title="Save this answer as a note in your canvas Inbox"
            onClick={handlePlaceNote}
          />
        )}
      </div>
      {/* Task Preview Panel */}
      {showTaskPreview && (
        <TaskPreviewPanel
          tasks={tasks}
          sourceFaces={sourceFaces}
          chatMessageId={chatMessageId}
          sourceInsightId={sourceInsightId}
          onClose={() => setShowTaskPreview(false)}
          onConfirm={async (selectedTasks) => {
            try {
              // Create tasks using the task creation service
              const result = await createTasksFromAI(
                selectedTasks,
                {
                  chatMessageId,
                  sourceInsightId,
                },
                syncAddElement
              );

              // Show success or error state
              if (result.success) {
                console.log(`[AIActionBar] Successfully created ${result.createdCount} tasks`);
                setTaskButtonState('success');
                setShowTaskPreview(false);
                setTimeout(() => setTaskButtonState('idle'), 2000);
                onTasksAdded?.();
              } else {
                console.error(`[AIActionBar] Created ${result.createdCount} tasks with ${result.errorCount} errors:`, result.errors);
                setTaskButtonState('error');
                setTimeout(() => setTaskButtonState('idle'), 3000);
              }
            } catch (error) {
              console.error('[AIActionBar] Failed to create tasks:', error);
              setTaskButtonState('error');
              setTimeout(() => setTaskButtonState('idle'), 3000);
            }
          }}
        />
      )}
    </>
  );
}

interface ActionChipProps {
  icon: LucideIcon;
  label: string;
  title: string;
  onClick: () => void;
  state?: ButtonState;
  /** Label overrides per non-idle state. */
  labels?: Partial<Record<Exclude<ButtonState, 'idle'>, string>>;
  /** The one action that changes the canvas through review; visually leads. */
  primary?: boolean;
  /** Quiet trailing detail, e.g. what the action costs. */
  suffix?: string;
}

function ActionChip({ icon: Icon, label, title, onClick, state = 'idle', labels, primary, suffix }: ActionChipProps) {
  const StateIcon = state === 'loading' ? Loader2 : state === 'success' ? Check : state === 'error' ? AlertCircle : Icon;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={state === 'loading' || state === 'success'}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3",
        "text-xs font-medium leading-none transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50",
        state === 'idle' && !primary &&
          "border-white/10 bg-white/[0.04] text-foreground/75 hover:border-white/20 hover:bg-white/[0.08] hover:text-foreground",
        state === 'idle' && primary &&
          "border-violet-400/40 bg-violet-500/15 text-violet-100 hover:border-violet-300/60 hover:bg-violet-500/25",
        state === 'loading' && "cursor-wait border-white/10 bg-white/[0.04] text-foreground/60",
        state === 'success' && "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
        state === 'error' && "border-red-400/30 bg-red-500/10 text-red-300 hover:bg-red-500/15",
      )}
    >
      <StateIcon
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          state === 'loading' && "animate-spin",
          state === 'idle' && !primary && "text-violet-300/80",
        )}
      />
      <span>{state === 'idle' ? label : labels?.[state] ?? label}</span>
      {suffix && state === 'idle' && <span className="opacity-55">· {suffix}</span>}
    </button>
  );
}