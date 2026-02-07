"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { CanvasElement, FreeformElement, Subtask } from "@/types/canvas-elements";
import { cn } from "@/lib/utils";
import { Inbox, GripVertical, X, ArrowRight, CheckSquare, ChevronDown, Circle, CheckCircle2, Archive, Calendar, Tag, ListTodo, Clock, AlertCircle } from "lucide-react";
import { useCXDStore } from "@/store/cxd-store";

interface TaskInboxProps {
  inboxItems: CanvasElement[];
  onPlaceOnCanvas: (elementId: string, x: number, y: number) => void;
  onRemoveFromInbox: (elementId: string) => void;
  onStartDrag: (elementId: string, e: React.MouseEvent) => void;
  onGoToPlanTab?: () => void;
  canvasZoom: number;
}

export function TaskInbox({
  inboxItems: _inboxItems,
  onPlaceOnCanvas,
  onRemoveFromInbox,
  onStartDrag,
  onGoToPlanTab,
  canvasZoom,
}: TaskInboxProps) {
  // Subscribe to all elements and filter for inbox items
  const allElements = useCXDStore(state => {
    const currentProject = state.getCurrentProject();
    return currentProject?.canvasLayout?.elements || [];
  });

  // Filter inbox items with useMemo to prevent unnecessary re-renders
  const inboxItems = useMemo(() => {
    return allElements.filter((el) => el.inInbox === true);
  }, [allElements]);

  const [isOpen, setIsOpen] = useState(false);
  const [isGlowing, setIsGlowing] = useState(false);
  const [prevCount, setPrevCount] = useState(inboxItems.length);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDragOverInbox, setIsDragOverInbox] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Filter items by status
  const filteredItems = inboxItems.filter(item => {
    if (statusFilter === 'all') return true;
    const freeform = item as FreeformElement;
    const status = freeform.taskMetadata?.status || 'not_started';
    return status === statusFilter;
  });

  // Glow effect when new tasks are added
  useEffect(() => {
    if (inboxItems.length > prevCount) {
      setIsGlowing(true);
      // Auto-fade glow after 3 seconds
      const timeout = setTimeout(() => setIsGlowing(false), 3000);
      return () => clearTimeout(timeout);
    }
    setPrevCount(inboxItems.length);
  }, [inboxItems.length, prevCount]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Check if click is on the button
        const button = document.getElementById('task-inbox-button');
        if (button && button.contains(e.target as Node)) return;
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Get the task title from the content (extract from "- [ ] Title")
  const getTaskTitle = (element: CanvasElement): string => {
    if (element.type === "freeform") {
      const content = (element as FreeformElement).content || "";
      // Extract title from checkbox syntax
      const match = content.match(/^-\s*\[.\]\s*(.+?)(?:\n|$)/);
      if (match) return match[1];
      // Return first line if no checkbox
      return content.split("\n")[0] || "Untitled Task";
    }
    return "Task";
  };

  // Get task description (lines after title)
  const getTaskDescription = (element: CanvasElement): string | null => {
    if (element.type === "freeform") {
      const content = (element as FreeformElement).content || "";
      const lines = content.split("\n");
      if (lines.length > 1) {
        return lines.slice(1).join("\n").trim().substring(0, 100);
      }
    }
    return null;
  };

  return (
    <>
      {/* Circular Inbox Button */}
      <button
        id="task-inbox-button"
        onClick={() => {
          setIsOpen(!isOpen);
          setIsGlowing(false);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOverInbox(true);
          setIsGlowing(true);
        }}
        onDragLeave={() => {
          setIsDragOverInbox(false);
          setIsGlowing(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOverInbox(false);
          setIsGlowing(false);

          // Get the dragged element ID from dataTransfer
          const elementId = e.dataTransfer.getData('elementId');
          if (elementId) {
            // Add element to inbox
            const { updateCanvasElement } = useCXDStore.getState();
            updateCanvasElement(elementId, { inInbox: true });
          }
        }}
        className={cn(
          "absolute left-4 top-6 z-50 w-12 h-12 rounded-full",
          "flex items-center justify-center",
          "bg-card/90 backdrop-blur-xl border border-border/50",
          "shadow-lg hover:shadow-xl transition-all duration-300",
          "hover:scale-105 active:scale-95",
          isOpen && "ring-2 ring-primary/50",
          (isGlowing || isDragOverInbox) && "animate-pulse ring-2 ring-purple-400/70 shadow-[0_0_20px_rgba(192,132,252,0.5)]"
        )}
      >
        <Inbox className={cn(
          "w-5 h-5 transition-colors",
          isGlowing ? "text-purple-400" : "text-primary"
        )} />
        {/* Badge for item count */}
        {inboxItems.length > 0 && (
          <span className={cn(
            "absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5",
            "flex items-center justify-center",
            "text-[10px] font-bold rounded-full",
            "transition-all duration-300",
            isGlowing
              ? "bg-purple-400 text-black animate-bounce"
              : "bg-primary text-primary-foreground"
          )}>
            {inboxItems.length}
          </span>
        )}
      </button>

      {/* Slide-out Panel */}
      <div
        ref={panelRef}
        data-prevent-canvas-wheel="true"
        className={cn(
          "absolute left-0 top-0 h-full z-40",
          "bg-card/95 backdrop-blur-xl border-r border-border/50",
          "shadow-2xl transition-all duration-300 ease-out",
          "flex flex-col",
          isOpen ? "w-80 translate-x-0" : "w-80 -translate-x-full pointer-events-none"
        )}
      >
        {/* Panel Header */}
        <div className="px-4 py-4 border-b border-border/30 mt-16">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Inbox className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Task Inbox</h2>
                <p className="text-xs text-muted-foreground">
                  {filteredItems.length} {filteredItems.length === 1 ? 'task' : 'tasks'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Status Filter Tags */}
          <div className="flex gap-1.5">
            {[
              { value: 'all', label: 'All' },
              { value: 'not_started', label: 'Not Started' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'blocked', label: 'Blocked' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={cn(
                  "px-2 py-1 text-[10px] rounded-md transition-all",
                  statusFilter === value
                    ? "bg-primary/20 text-primary font-medium"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Panel Content - Custom styled scrollbar */}
        <div
          className="flex-1 overflow-y-auto p-3 space-y-3 pb-24"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(139, 92, 246, 0.3) transparent',
          }}
        >
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                <CheckSquare className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">No tasks in inbox</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Create tasks in the Plan tab to see them here
              </p>
              {onGoToPlanTab && (
                <button
                  onClick={onGoToPlanTab}
                  className="mt-4 px-4 py-2 text-xs bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-colors flex items-center gap-2"
                >
                  Go to Plan Tab
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : (
            filteredItems.map((item) => (
              <TaskInboxCard
                key={item.id}
                element={item}
                title={getTaskTitle(item)}
                description={getTaskDescription(item)}
                onStartDrag={onStartDrag}
                onRemove={() => onRemoveFromInbox(item.id)}
                onGoToPlanTab={onGoToPlanTab}
              />
            ))
          )}
        </div>

        {/* Panel Footer */}
        {filteredItems.length > 0 && (
          <div className="px-4 py-3 border-t border-border/30 bg-muted/10">
            <p className="text-[10px] text-muted-foreground text-center">
              Drag tasks onto the canvas or click <ListTodo className="w-3 h-3 inline" /> to manage in Plan
            </p>
          </div>
        )}
      </div>

      {/* Backdrop overlay when panel is open */}
      {isOpen && (
        <div
          className="absolute inset-0 bg-black/20 z-30 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

// Task card in inbox
function TaskInboxCard({
  element,
  title,
  description,
  onStartDrag,
  onRemove,
  onGoToPlanTab,
}: {
  element: CanvasElement;
  title: string;
  description: string | null;
  onStartDrag: (elementId: string, e: React.MouseEvent) => void;
  onRemove: () => void;
  onGoToPlanTab?: () => void;
}) {
  const { updateCanvasElement } = useCXDStore();
  const [showSubtasks, setShowSubtasks] = useState(true);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTag, setNewTag] = useState('');
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const priorityMenuRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onStartDrag(element.id, e);
    },
    [element.id, onStartDrag]
  );

  // Close status menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
    };

    if (showStatusMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showStatusMenu]);

  // Get task data
  const freeformElement = element as FreeformElement;
  const status = freeformElement.taskMetadata?.status || 'not_started';
  const subtasks = freeformElement.taskMetadata?.subtasks || [];

  const statusColors: Record<string, string> = {
    not_started: "bg-zinc-500/20 text-zinc-400",
    in_progress: "bg-blue-500/20 text-blue-400",
    completed: "bg-green-500/20 text-green-400",
    blocked: "bg-red-500/20 text-red-400",
  };

  const statusOptions: Array<{ value: string; label: string; icon: any }> = [
    { value: 'not_started', label: 'Not Started', icon: Circle },
    { value: 'in_progress', label: 'In Progress', icon: Circle },
    { value: 'completed', label: 'Completed', icon: CheckCircle2 },
    { value: 'blocked', label: 'Blocked', icon: Circle },
  ];

  // Toggle subtask completion
  const handleToggleSubtask = useCallback((subtaskId: string) => {
    const updatedSubtasks = subtasks.map((st: Subtask) =>
      st.id === subtaskId ? { ...st, isCompleted: !st.isCompleted } : st
    );
    updateCanvasElement(element.id, {
      taskMetadata: {
        ...(freeformElement.taskMetadata || {}),
        subtasks: updatedSubtasks,
      }
    } as Partial<FreeformElement>);
  }, [element.id, subtasks, freeformElement.taskMetadata, updateCanvasElement]);

  // Change task status
  const handleStatusChange = useCallback((newStatus: string) => {
    updateCanvasElement(element.id, {
      taskMetadata: {
        ...(freeformElement.taskMetadata || {}),
        status: newStatus as any,
      }
    } as Partial<FreeformElement>);
    setShowStatusMenu(false);
  }, [element.id, freeformElement.taskMetadata, updateCanvasElement]);

  // Handle title edit
  const handleTitleSave = useCallback(() => {
    if (editedTitle.trim() && editedTitle !== title) {
      // Update the content with the new title
      const content = (freeformElement as FreeformElement).content || "";
      const lines = content.split("\n");
      lines[0] = editedTitle;
      updateCanvasElement(element.id, {
        content: lines.join("\n"),
      } as Partial<FreeformElement>);
    }
    setIsEditingTitle(false);
  }, [element.id, editedTitle, title, freeformElement, updateCanvasElement]);

  // Handle archive
  const handleArchive = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Remove inInbox flag to archive the task
    updateCanvasElement(element.id, {
      inInbox: false,
    });
  }, [element.id, updateCanvasElement]);

  // Handle priority change
  const handlePriorityChange = useCallback((newPriority: string) => {
    updateCanvasElement(element.id, {
      taskMetadata: {
        ...(freeformElement.taskMetadata || {}),
        priority: newPriority as any,
      }
    } as Partial<FreeformElement>);
    setShowPriorityMenu(false);
  }, [element.id, freeformElement.taskMetadata, updateCanvasElement]);

  // Handle due date change
  const handleDueDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value ? new Date(e.target.value).toISOString() : undefined;
    updateCanvasElement(element.id, {
      taskMetadata: {
        ...(freeformElement.taskMetadata || {}),
        dueDate: dateValue,
      }
    } as Partial<FreeformElement>);
    setIsEditingDueDate(false);
  }, [element.id, freeformElement.taskMetadata, updateCanvasElement]);

  // Handle add tag
  const handleAddTag = useCallback(() => {
    if (newTag.trim()) {
      const currentTags = freeformElement.taskMetadata?.customTags || [];
      updateCanvasElement(element.id, {
        taskMetadata: {
          ...(freeformElement.taskMetadata || {}),
          customTags: [...currentTags, newTag.trim()],
        }
      } as Partial<FreeformElement>);
      setNewTag('');
      setIsAddingTag(false);
    }
  }, [element.id, newTag, freeformElement.taskMetadata, updateCanvasElement]);

  // Handle remove tag
  const handleRemoveTag = useCallback((tagToRemove: string) => {
    const currentTags = freeformElement.taskMetadata?.customTags || [];
    updateCanvasElement(element.id, {
      taskMetadata: {
        ...(freeformElement.taskMetadata || {}),
        customTags: currentTags.filter(tag => tag !== tagToRemove),
      }
    } as Partial<FreeformElement>);
  }, [element.id, freeformElement.taskMetadata, updateCanvasElement]);

  // Close priority menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (priorityMenuRef.current && !priorityMenuRef.current.contains(e.target as Node)) {
        setShowPriorityMenu(false);
      }
    };

    if (showPriorityMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPriorityMenu]);

  // Get task properties
  const priority = freeformElement.taskMetadata?.priority;
  const dueDate = freeformElement.taskMetadata?.dueDate;
  const customTags = freeformElement.taskMetadata?.customTags || [];

  const priorityOptions: Array<{ value: string; label: string; color: string }> = [
    { value: 'urgent', label: 'Urgent', color: 'bg-red-500/20 text-red-400' },
    { value: 'high', label: 'High', color: 'bg-orange-500/20 text-orange-400' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-500/20 text-yellow-400' },
    { value: 'low', label: 'Low', color: 'bg-green-500/20 text-green-400' },
  ];

  return (
    <div
      className="group relative bg-gradient-to-br from-white/[0.08] to-white/[0.02] rounded-xl border border-white/10 hover:border-white/20 transition-all cursor-grab active:cursor-grabbing"
      onMouseDown={handleDragStart}
    >
      {/* Card gradient accent */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500/50 via-purple-500/50 to-pink-500/50 pointer-events-none rounded-t-xl" />

      <div className="p-3">
        {/* Header with drag handle */}
        <div className="flex items-start gap-2">
          {/* Drag handle icon (visual indicator) */}
          <div className="mt-0.5 text-muted-foreground/50 group-hover:text-primary transition-colors pointer-events-none">
            <GripVertical className="w-4 h-4" />
          </div>

          {/* Title and description */}
          <div className="flex-1 min-w-0">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') handleTitleSave();
                  if (e.key === 'Escape') {
                    setEditedTitle(title);
                    setIsEditingTitle(false);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full text-sm font-medium text-white/90 bg-white/10 border border-primary/50 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
            ) : (
              <p
                className="text-sm font-medium text-white/90 line-clamp-2 cursor-text pointer-events-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingTitle(true);
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {title}
              </p>
            )}
            {description && !isEditingTitle && (
              <p className="text-xs text-white/50 mt-1 line-clamp-2 pointer-events-none">{description}</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-start gap-1">
            {/* Archive button */}
            <button
              onClick={handleArchive}
              onMouseDown={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all"
              title="Archive task"
            >
              <Archive className="w-3 h-3" />
            </button>
            {/* Remove button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
              title="Delete task"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Task Properties */}
        <div className="flex flex-wrap gap-1.5 mt-2 pointer-events-auto">
          {/* Priority Dropdown */}
          <div ref={priorityMenuRef} className="relative">
            {priority ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPriorityMenu(!showPriorityMenu);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-1 hover:ring-1 hover:ring-white/20 transition-all",
                  priority === 'urgent' ? "bg-red-500/20 text-red-400" :
                    priority === 'high' ? "bg-orange-500/20 text-orange-400" :
                      priority === 'medium' ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-green-500/20 text-green-400"
                )}
              >
                <AlertCircle className="w-2.5 h-2.5" />
                {priority}
                <ChevronDown className="w-2.5 h-2.5" />
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPriorityMenu(!showPriorityMenu);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 flex items-center gap-1 transition-all"
              >
                <AlertCircle className="w-2.5 h-2.5" />
                Set Priority
              </button>
            )}

            {/* Priority dropdown menu */}
            {showPriorityMenu && (
              <div className="absolute top-full left-0 mt-1 bg-card/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl z-50 min-w-[100px]">
                {priorityOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePriorityChange(opt.value);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/5 transition-colors first:rounded-t-lg last:rounded-b-lg",
                      priority === opt.value ? "text-primary" : "text-white/70"
                    )}
                  >
                    <div className={cn("w-2 h-2 rounded-full", opt.color)} />
                    {opt.label}
                  </button>
                ))}
                {priority && (
                  <>
                    <div className="h-px bg-white/10 my-1" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePriorityChange('');
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-white/50 hover:bg-white/5 transition-colors rounded-b-lg"
                    >
                      <X className="w-2.5 h-2.5" />
                      Clear
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Due Date Picker */}
          {isEditingDueDate ? (
            <input
              type="date"
              value={dueDate ? new Date(dueDate).toISOString().split('T')[0] : ''}
              onChange={handleDueDateChange}
              onBlur={() => setIsEditingDueDate(false)}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-400/50 focus:outline-none focus:ring-1 focus:ring-blue-400"
              autoFocus
            />
          ) : dueDate ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingDueDate(true);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-400 flex items-center gap-1 hover:ring-1 hover:ring-white/20 transition-all group/date"
            >
              <Calendar className="w-2.5 h-2.5" />
              {new Date(dueDate).toLocaleDateString()}
              <X
                className="w-2.5 h-2.5 opacity-0 group-hover/date:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  updateCanvasElement(element.id, {
                    taskMetadata: {
                      ...(freeformElement.taskMetadata || {}),
                      dueDate: undefined,
                    }
                  } as Partial<FreeformElement>);
                }}
              />
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingDueDate(true);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 flex items-center gap-1 transition-all"
            >
              <Calendar className="w-2.5 h-2.5" />
              Set Due Date
            </button>
          )}

          {/* Custom Tags */}
          {customTags.map((tag, idx) => (
            <span
              key={idx}
              className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-400 flex items-center gap-1 group/tag hover:ring-1 hover:ring-white/20 transition-all"
            >
              <Tag className="w-2.5 h-2.5" />
              {tag}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveTag(tag);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="opacity-0 group-hover/tag:opacity-100 transition-opacity"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}

          {/* Add Tag */}
          {isAddingTag ? (
            <input
              ref={tagInputRef}
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onBlur={handleAddTag}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') handleAddTag();
                if (e.key === 'Escape') {
                  setNewTag('');
                  setIsAddingTag(false);
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              placeholder="Tag name"
              className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-400 border border-purple-400/50 focus:outline-none focus:ring-1 focus:ring-purple-400 w-20"
              autoFocus
            />
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsAddingTag(true);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 flex items-center gap-1 transition-all"
            >
              <Tag className="w-2.5 h-2.5" />
              Add Tag
            </button>
          )}
        </div>

        {/* Subtasks */}
        {subtasks.length > 0 && (
          <div className="mt-3 space-y-1.5 pointer-events-auto">
            {subtasks.slice(0, showSubtasks ? undefined : 3).map((subtask) => (
              <button
                key={subtask.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleSubtask(subtask.id);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="flex items-start gap-2 w-full text-left group/subtask hover:bg-white/5 rounded px-2 py-1 transition-colors"
              >
                <div className={cn(
                  "w-3.5 h-3.5 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center transition-all",
                  subtask.isCompleted
                    ? "bg-primary border-primary"
                    : "border-white/30 group-hover/subtask:border-primary"
                )}>
                  {subtask.isCompleted && (
                    <CheckCircle2 className="w-2.5 h-2.5 text-primary-foreground" />
                  )}
                </div>
                <span className={cn(
                  "text-xs flex-1 break-words",
                  subtask.isCompleted ? "text-white/40 line-through" : "text-white/70"
                )}>
                  {subtask.text}
                </span>
              </button>
            ))}
            {subtasks.length > 3 && !showSubtasks && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSubtasks(true);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="text-[10px] text-primary hover:underline px-2"
              >
                +{subtasks.length - 3} more
              </button>
            )}
          </div>
        )}

        {/* Footer with status and actions */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
          {/* Status badge with dropdown */}
          <div ref={statusMenuRef} className="relative pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowStatusMenu(!showStatusMenu);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={cn(
                "flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full capitalize transition-all",
                statusColors[status] || "bg-muted text-muted-foreground",
                "hover:ring-1 hover:ring-white/20"
              )}
            >
              {status.replace("_", " ")}
              <ChevronDown className="w-2.5 h-2.5" />
            </button>

            {/* Status dropdown menu */}
            {showStatusMenu && (
              <div className="absolute bottom-full left-0 mb-1 bg-card/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl z-50 min-w-[120px]">
                {statusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusChange(opt.value);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/5 transition-colors first:rounded-t-lg last:rounded-b-lg",
                      status === opt.value ? "text-primary" : "text-white/70"
                    )}
                  >
                    <opt.icon className="w-3 h-3" />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Go to Plan tab button */}
          {onGoToPlanTab && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onGoToPlanTab();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
              title="View in Plan tab"
            >
              <ListTodo className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
