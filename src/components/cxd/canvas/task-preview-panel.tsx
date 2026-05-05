"use client";

import React, { useState, useMemo } from "react";
import { X, ChevronDown, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFaceDisplayName } from "@/lib/display-utils";
import type { ExtractedTask } from "@/lib/ai/ai-response-classifier";
import type { TaskStatus, TaskPriority } from "@/types/plan-types";

export interface TaskPreviewPanelProps {
  tasks: ExtractedTask[];
  sourceFaces: string[];
  chatMessageId: string;
  sourceInsightId?: string;
  onClose: () => void;
  onConfirm: (selectedTasks: ExtractedTask[]) => void;
}

interface TaskState extends ExtractedTask {
  id: string;
  selected: boolean;
  expanded: boolean;
  status: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date;
  startDate?: Date;
  assignee?: string;
}


export function TaskPreviewPanel({
  tasks,
  sourceFaces,
  chatMessageId,
  sourceInsightId,
  onClose,
  onConfirm
}: TaskPreviewPanelProps) {
  // Initialize task states
  const [taskStates, setTaskStates] = useState<TaskState[]>(() =>
    tasks.map((task, index) => ({
      ...task,
      id: `task-${chatMessageId}-${index}`,
      selected: true,
      expanded: false,
      status: 'not_started' as TaskStatus,
      priority: undefined,
      dueDate: undefined,
      startDate: undefined,
      assignee: undefined,
    }))
  );

  const selectedCount = useMemo(
    () => taskStates.filter(t => t.selected).length,
    [taskStates]
  );

  const handleToggleSelected = (id: string) => {
    setTaskStates(prev =>
      prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t)
    );
  };

  const handleToggleExpanded = (id: string) => {
    setTaskStates(prev =>
      prev.map(t => t.id === id ? { ...t, expanded: !t.expanded } : t)
    );
  };

  const handleUpdateTask = (id: string, updates: Partial<TaskState>) => {
    setTaskStates(prev =>
      prev.map(t => t.id === id ? { ...t, ...updates } : t)
    );
  };

  const handleToggleFace = (taskId: string, faceKey: string) => {
    setTaskStates(prev =>
      prev.map(t => {
        if (t.id !== taskId) return t;
        const hasFace = t.suggestedFaces.includes(faceKey);
        return {
          ...t,
          suggestedFaces: hasFace
            ? t.suggestedFaces.filter(f => f !== faceKey)
            : [...t.suggestedFaces, faceKey]
        };
      })
    );
  };

  const handleConfirm = () => {
    const selectedTasks = taskStates
      .filter(t => t.selected)
      .map(({ id, selected, expanded, status, priority, dueDate, startDate, assignee, ...task }) => ({
        ...task,
        // Add the new properties to the extracted task
        metadata: {
          status,
          priority,
          dueDate: dueDate?.toISOString(),
          startDate: startDate?.toISOString(),
          assignee,
        },
      }));
    onConfirm(selectedTasks as any);
  };

  // Show max 10 tasks, with expand option for more
  const displayTasks = taskStates.slice(0, 10);
  const hasMore = taskStates.length > 10;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-end">
      {/* Panel */}
      <div
        className="h-full w-full max-w-2xl bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Add Tasks to Plan</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Review and edit tasks before adding them to your Plan tab
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {displayTasks.map((task, index) => (
            <TaskPreviewCard
              key={task.id}
              task={task}
              index={index}
              onToggleSelected={handleToggleSelected}
              onToggleExpanded={handleToggleExpanded}
              onUpdateTask={handleUpdateTask}
              onToggleFace={handleToggleFace}
            />
          ))}

          {hasMore && (
            <div className="text-center text-sm text-muted-foreground py-2">
              + {taskStates.length - 10} more tasks (showing first 10)
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedCount} of {taskStates.length} selected
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors min-h-[44px]"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedCount === 0}
              className={cn(
                "px-4 py-2.5 rounded-lg text-sm text-white transition-colors min-h-[44px]",
                selectedCount > 0
                  ? "bg-violet-500 hover:bg-violet-600"
                  : "bg-violet-500/50 cursor-not-allowed"
              )}
            >
              Add Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TaskPreviewCardProps {
  task: TaskState;
  index: number;
  onToggleSelected: (id: string) => void;
  onToggleExpanded: (id: string) => void;
  onUpdateTask: (id: string, updates: Partial<TaskState>) => void;
  onToggleFace: (taskId: string, faceKey: string) => void;
}

function TaskPreviewCard({
  task,
  index,
  onToggleSelected,
  onToggleExpanded,
  onUpdateTask,
  onToggleFace
}: TaskPreviewCardProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);

  return (
    <div
      className={cn(
        "rounded-lg border transition-all",
        task.selected
          ? "border-violet-500/30 bg-violet-500/5"
          : "border-white/10 bg-white/5 opacity-60"
      )}
    >
      <div className="p-4">
        {/* Checkbox + Title */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={task.selected}
            onChange={() => onToggleSelected(task.id)}
            className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 checked:bg-violet-500 transition-colors cursor-pointer"
          />
          <div className="flex-1 min-w-0">
            {isEditingTitle ? (
              <input
                type="text"
                value={task.title}
                onChange={(e) => onUpdateTask(task.id, { title: e.target.value })}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                autoFocus
                className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-sm"
              />
            ) : (
              <div
                onClick={() => setIsEditingTitle(true)}
                className="font-medium text-sm cursor-text hover:bg-white/5 px-2 py-1 rounded transition-colors"
              >
                {task.title}
              </div>
            )}

            {/* Properties Grid */}
            <div className="mt-3 space-y-2">
              {/* Row 1: Status + Priority */}
              <div className="grid grid-cols-2 gap-2">
                {/* Status */}
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Status</label>
                  <select
                    value={task.status}
                    onChange={(e) => onUpdateTask(task.id, { status: e.target.value as TaskStatus })}
                    className="w-full px-2 py-1 rounded text-xs text-foreground bg-background border border-border hover:bg-white/10 transition-colors cursor-pointer [&>option]:bg-background [&>option]:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Priority</label>
                  <select
                    value={task.priority || ''}
                    onChange={(e) => onUpdateTask(task.id, { priority: e.target.value ? e.target.value as TaskPriority : undefined })}
                    className="w-full px-2 py-1 rounded text-xs text-foreground bg-background border border-border hover:bg-white/10 transition-colors cursor-pointer [&>option]:bg-background [&>option]:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="">None</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Dates */}
              <div className="grid grid-cols-2 gap-2">
                {/* Start Date */}
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={task.startDate ? task.startDate.toISOString().split('T')[0] : ''}
                    onChange={(e) => onUpdateTask(task.id, { startDate: e.target.value ? new Date(e.target.value) : undefined })}
                    className="w-full px-2 py-1 rounded text-xs bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Due Date */}
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={task.dueDate ? task.dueDate.toISOString().split('T')[0] : ''}
                    onChange={(e) => onUpdateTask(task.id, { dueDate: e.target.value ? new Date(e.target.value) : undefined })}
                    className="w-full px-2 py-1 rounded text-xs bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>

              {/* Row 3: Assignee */}
              <div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Assignee</label>
                  <input
                    type="text"
                    value={task.assignee || ''}
                    onChange={(e) => onUpdateTask(task.id, { assignee: e.target.value || undefined })}
                    placeholder="Assign to..."
                    className="w-full px-2 py-1 rounded text-xs bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>

              {/* Row 4: Face Tags */}
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">Hypercube Faces</label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Face Pills */}
                  {task.suggestedFaces.map(faceKey => (
                    <button
                      key={faceKey}
                      onClick={() => onToggleFace(task.id, faceKey)}
                      className="px-2 py-0.5 rounded text-xs bg-white/10 hover:bg-white/15 border border-white/20 transition-colors"
                      title="Click to remove"
                    >
                      {getFaceDisplayName(faceKey)}
                    </button>
                  ))}

                  {/* Add Face Button */}
                  <select
                    value=""
                    onChange={(e) => e.target.value && onToggleFace(task.id, e.target.value)}
                    className="px-2 py-0.5 rounded text-xs text-foreground bg-background border border-border hover:bg-white/10 transition-colors cursor-pointer [&>option]:bg-background [&>option]:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="">+ Add Face</option>
                    <option value="realityPlanes">Reality Planes</option>
                    <option value="sensoryDomains">Sensory Domains</option>
                    <option value="presence">Presence Types</option>
                    <option value="stateMapping">State Mapping</option>
                    <option value="traitMapping">Trait Mapping</option>
                    <option value="contextAndMeaning">Meaning Architecture</option>
                  </select>
                </div>
              </div>

              {/* Expand/Collapse Button */}
              <button
                onClick={() => onToggleExpanded(task.id)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                aria-label={task.expanded ? "Collapse" : "Expand"}
              >
                {task.expanded ? (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Hide Description
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-3 h-3" />
                    {task.description && task.description !== task.title ? 'Show Description' : 'Add Description'}
                  </>
                )}
              </button>
            </div>

            {/* Expanded Description */}
            {task.expanded && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <label className="text-[10px] text-muted-foreground mb-1 block">Description</label>
                {isEditingDescription ? (
                  <textarea
                    value={task.description === task.title ? '' : task.description}
                    onChange={(e) => onUpdateTask(task.id, { description: e.target.value })}
                    onBlur={() => setIsEditingDescription(false)}
                    rows={3}
                    autoFocus
                    placeholder="Add a detailed description..."
                    className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-sm resize-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div
                    onClick={() => setIsEditingDescription(true)}
                    className={cn(
                      "text-sm cursor-text hover:bg-white/5 px-2 py-1 rounded transition-colors min-h-[60px]",
                      task.description && task.description !== task.title
                        ? "text-foreground/80"
                        : "text-muted-foreground italic"
                    )}
                  >
                    {task.description && task.description !== task.title
                      ? task.description
                      : "Click to add description..."}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
