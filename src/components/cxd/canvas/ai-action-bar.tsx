"use client";

import React, { useState } from "react";
import { CheckSquare, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExtractedTask } from "@/lib/ai/ai-response-classifier";
import { TaskPreviewPanel } from "./task-preview-panel";
import { createTasksFromAI } from "@/lib/ai/task-creation-service";
import { createNoteFromAI } from "@/lib/ai/note-creation-service";
import { useCollaborationContext } from "@/contexts/collaboration-context";

export interface AIActionBarProps {
  tasks: ExtractedTask[];
  noteContent: string;
  sourceFaces: string[];
  chatMessageId: string;
  sourceInsightId?: string;
  onTasksAdded?: () => void;
  onNoteCreated?: () => void;
}

type ButtonState = 'idle' | 'success' | 'error';

export function AIActionBar({
  tasks,
  noteContent,
  sourceFaces,
  chatMessageId,
  sourceInsightId,
  onTasksAdded,
  onNoteCreated
}: AIActionBarProps) {
  const { syncAddElement } = useCollaborationContext();
  const [taskButtonState, setTaskButtonState] = useState<ButtonState>('idle');
  const [noteButtonState, setNoteButtonState] = useState<ButtonState>('idle');
  const [showTaskPreview, setShowTaskPreview] = useState(false);

  const hasTasks = tasks.length > 0;
  const hasNote = noteContent.length > 0;

  // Don't render if no actionable content
  if (!hasTasks && !hasNote) {
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

  const taskLabel = tasks.length === 1 ? 'Add 1 task to Plan' : `Add ${tasks.length} tasks to Plan`;

  return (
    <>
      <div
        className="mt-3 pt-3 border-t border-white/8 flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-200"
        style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}
      >
        {/* Add Tasks Button */}
        {hasTasks && (
          <button
            onClick={handleAddTasks}
            disabled={taskButtonState === 'success'}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              "min-h-[44px] min-w-[44px]",
              taskButtonState === 'idle' && [
                "bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30",
                "text-violet-400 hover:text-violet-300 hover:scale-[1.02]",
                "active:scale-95"
              ],
              taskButtonState === 'success' && [
                "bg-emerald-500/10 border border-emerald-500/30",
                "text-emerald-400"
              ],
              taskButtonState === 'error' && [
                "bg-red-500/10 border border-red-500/30",
                "text-red-400 hover:bg-red-500/20"
              ]
            )}
          >
            <CheckSquare className="w-4 h-4" />
            <span>
              {taskButtonState === 'idle' && taskLabel}
              {taskButtonState === 'success' && '✓ Added to Plan'}
              {taskButtonState === 'error' && '✗ Failed — try again'}
            </span>
          </button>
        )}

        {/* Place Note Button */}
        {hasNote && (
          <button
            onClick={handlePlaceNote}
            disabled={noteButtonState === 'success'}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              "min-h-[44px] min-w-[44px]",
              noteButtonState === 'idle' && [
                "bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30",
                "text-cyan-400 hover:text-cyan-300 hover:scale-[1.02]",
                "active:scale-95"
              ],
              noteButtonState === 'success' && [
                "bg-emerald-500/10 border border-emerald-500/30",
                "text-emerald-400"
              ],
              noteButtonState === 'error' && [
                "bg-red-500/10 border border-red-500/30",
                "text-red-400 hover:bg-red-500/20"
              ]
            )}
          >
            <FileText className="w-4 h-4" />
            <span>
              {noteButtonState === 'idle' && 'Place note on Canvas'}
              {noteButtonState === 'success' && '✓ Saved to Inbox'}
              {noteButtonState === 'error' && '✗ Failed — try again'}
            </span>
          </button>
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
