'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { DatePicker } from '@/components/ui/date-picker';
import { FaceTagSelector } from './face-tag-selector';
import { AssigneeMultiSelect } from './assignee-multi-select';
import { parseAssignees, serializeAssignees } from './assignee-utils';
import { useCXDStore } from '@/store/cxd-store';
import type { HypercubeFaceTag, TaskMetadata } from '@/types/canvas-elements';
import type { TaskProjection, TaskStatus, TaskPriority, TaskType } from '@/types/plan-types';
import { HYPERCUBE_FACE_COLORS } from '@/types/plan-types';
import { X, Calendar, User, Clock, Tag, ExternalLink, CheckCircle2, Circle, Plus, Trash2, Archive, RotateCcw, Milestone } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface TaskDetailPanelProps {
  task: TaskProjection;
  onClose: () => void;
  onUpdate: (updates: Partial<TaskProjection>) => void;
  onNavigate: () => void;
  onDelete?: (taskId: string) => void;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'completed', label: 'Completed' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'Design', label: 'Design' },
  { value: 'Dev', label: 'Dev' },
  { value: 'Admin', label: 'Admin' },
  { value: 'Research', label: 'Research' },
  { value: 'Custom', label: 'Custom' },
];

export function TaskDetailPanel({ task, onClose, onUpdate, onNavigate, onDelete }: TaskDetailPanelProps) {
  const [newPropertyKey, setNewPropertyKey] = useState('');
  const [newPropertyValue, setNewPropertyValue] = useState('');
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [draggedSubtaskIndex, setDraggedSubtaskIndex] = useState<number | null>(null);

  const versions = useCXDStore((state) => state.getVersions());

  // Memoize the selected version to avoid recomputing on every render
  const selectedVersion = useMemo(() => {
    if (!task.taskMetadata?.versionId) return null;
    return versions.find(v => v.id === task.taskMetadata?.versionId) || null;
  }, [task.taskMetadata?.versionId, versions]);

  const handleStatusChange = (status: TaskStatus) => {
    onUpdate({ status });
  };

  const handlePriorityChange = (priority: TaskPriority | undefined) => {
    onUpdate({ priority });
  };

  const handleDueDateChange = (date: Date | undefined) => {
    onUpdate({ dueDate: date ? date.toISOString() : undefined });
  };

  const handleStartDateChange = (date: Date | undefined) => {
    onUpdate({ startDate: date ? date.toISOString() : undefined });
  };

  const handleAssigneeChange = (assignees: string[]) => {
    onUpdate({ assignee: serializeAssignees(assignees) });
  };

  const handleEstimatedHoursChange = (hours: string) => {
    const value = hours ? parseFloat(hours) : undefined;
    onUpdate({ estimatedHours: value });
  };

  const handleTaskTypeChange = (taskType: TaskType | undefined) => {
    onUpdate({ taskType });
  };

  const handleFaceTagsChange = (faces: HypercubeFaceTag[]) => {
    onUpdate({ hypercubeTags: faces });
  };

  const handleVersionChange = (versionId: string) => {
    const updatedTaskMetadata: TaskMetadata = {
      ...(task.taskMetadata || {}),
      versionId: versionId || undefined,
    };
    onUpdate({ taskMetadata: updatedTaskMetadata });
  };

  const handleSubtaskToggle = (subtaskId: string, isCompleted: boolean) => {
    const updatedSubtasks = task.subtasks.map(st =>
      st.id === subtaskId ? { ...st, isCompleted } : st
    );
    onUpdate({ subtasks: updatedSubtasks });
  };

  const handleAddCustomProperty = () => {
    if (!newPropertyKey.trim()) return;
    
    const customProperties = { ...(task.customProperties || {}) };
    customProperties[newPropertyKey] = newPropertyValue;
    
    onUpdate({ customProperties });
    setNewPropertyKey('');
    setNewPropertyValue('');
    setShowAddProperty(false);
  };

  const handleRemoveCustomProperty = (key: string) => {
    const customProperties = { ...(task.customProperties || {}) };
    delete customProperties[key];
    onUpdate({ customProperties });
  };

  const handleTitleSave = () => {
    if (editedTitle.trim() && editedTitle !== task.title) {
      onUpdate({ title: editedTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleDescriptionSave = () => {
    onUpdate({ description: description.trim() });
  };

  const handleSubtaskEdit = (subtaskId: string, newText: string) => {
    const updatedSubtasks = task.subtasks.map(st =>
      st.id === subtaskId ? { ...st, text: newText } : st
    );
    onUpdate({ subtasks: updatedSubtasks });
    setEditingSubtaskId(null);
  };

  const handleSubtaskDragStart = (index: number) => {
    setDraggedSubtaskIndex(index);
  };

  const handleSubtaskDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedSubtaskIndex === null || draggedSubtaskIndex === index) return;

    const newSubtasks = [...task.subtasks];
    const draggedItem = newSubtasks[draggedSubtaskIndex];
    newSubtasks.splice(draggedSubtaskIndex, 1);
    newSubtasks.splice(index, 0, draggedItem);

    onUpdate({ subtasks: newSubtasks });
    setDraggedSubtaskIndex(index);
  };

  const handleSubtaskDragEnd = () => {
    setDraggedSubtaskIndex(null);
  };

  const handleAddSubtask = () => {
    const newSubtask = {
      id: `temp-${Date.now()}`,
      text: 'New Subtask',
      isCompleted: false,
      lineIndex: task.subtasks.length + 1
    };
    onUpdate({ subtasks: [...task.subtasks, newSubtask] });
  };

  const handleRemoveSubtask = (subtaskId: string) => {
    const updatedSubtasks = task.subtasks.filter(st => st.id !== subtaskId);
    onUpdate({ subtasks: updatedSubtasks });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h3 className="text-lg font-semibold">Task Details</h3>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onUpdate({ isArchived: !task.isArchived })}
            title={task.isArchived ? 'Restore task' : 'Archive task'}
          >
            {task.isArchived ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
          </Button>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              title="Delete task"
              className="hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 gantt-scrollbar">
        {/* Title - Editable */}
        <div>
          {isEditingTitle ? (
            <div className="flex items-center gap-2 mb-2">
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSave();
                  if (e.key === 'Escape') {
                    setEditedTitle(task.title);
                    setIsEditingTitle(false);
                  }
                }}
                className="text-xl font-semibold bg-black/40 border-white/10"
                autoFocus
              />
              <Button size="sm" variant="ghost" onClick={handleTitleSave}>
                <CheckCircle2 className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => {
                setEditedTitle(task.title);
                setIsEditingTitle(false);
              }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div
              className="text-xl font-semibold mb-2 cursor-pointer bg-gradient-to-r from-[#C4B5FD] to-[#8B5CF6] bg-clip-text text-transparent hover:from-[#DDD6FE] hover:to-[#A78BFA] transition-colors"
              onClick={() => setIsEditingTitle(true)}
              title="Click to edit title"
            >
              {task.title}
            </div>
          )}
        </div>

        {/* Description/Notes */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Description / Notes</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionSave}
            placeholder="Add a description or notes about this task..."
            className="min-h-[120px] bg-black/40 border-white/10 hover:border-purple-500/50 transition-colors resize-none"
          />
        </div>

        <Separator />

        {/* Start Date */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-2">
            <Calendar className="w-3 h-3" />
            Start Date
          </Label>
          <DatePicker
            date={task.startDate ? new Date(task.startDate) : undefined}
            onSelect={handleStartDateChange}
            placeholder="Set start date"
          />
        </div>

        {/* Due Date */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-2">
            <Calendar className="w-3 h-3" />
            Due Date
          </Label>
          <DatePicker
            date={task.dueDate ? new Date(task.dueDate) : undefined}
            onSelect={handleDueDateChange}
            placeholder="Set due date"
          />
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <select
            value={task.status}
            onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
            className="w-full px-3 py-2 rounded-md bg-black/40 border border-white/10 text-sm hover:border-purple-500/50 transition-colors"
            style={{ colorScheme: 'dark' }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Priority</Label>
          <select
            value={task.priority || ''}
            onChange={(e) => handlePriorityChange(e.target.value as TaskPriority || undefined)}
            className="w-full px-3 py-2 rounded-md bg-black/40 border border-white/10 text-sm hover:border-purple-500/50 transition-colors"
            style={{ colorScheme: 'dark' }}
          >
            <option value="">None</option>
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Task Type */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Task Type</Label>
          <select
            value={task.taskType || ''}
            onChange={(e) => handleTaskTypeChange(e.target.value as TaskType || undefined)}
            className="w-full px-3 py-2 rounded-md bg-black/40 border border-white/10 text-sm hover:border-purple-500/50 transition-colors"
            style={{ colorScheme: 'dark' }}
          >
            <option value="">None</option>
            {TASK_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Version */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-2">
            <Milestone className="w-3 h-3" />
            Version / Release
          </Label>
          <select
            value={task.taskMetadata?.versionId || ''}
            onChange={(e) => handleVersionChange(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-black/40 border border-white/10 text-sm hover:border-purple-500/50 transition-colors"
            style={{ colorScheme: 'dark' }}
          >
            <option value="">Unversioned</option>
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                {version.name} - {version.type_label}
              </option>
            ))}
          </select>
          {selectedVersion && (
            <div className="flex items-center gap-2 mt-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: selectedVersion.color }}
              />
              <span className="text-xs text-white/70">{selectedVersion.name}</span>
              <Badge
                variant="outline"
                className="text-[9px] px-1.5 py-0 border-white/20"
                style={{ borderColor: selectedVersion.color, color: selectedVersion.color }}
              >
                {selectedVersion.type_label}
              </Badge>
              <span className="text-[10px] text-white/50 uppercase">{selectedVersion.status}</span>
            </div>
          )}
        </div>

        {/* Assignee */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-2">
            <User className="w-3 h-3" />
            Assignee
          </Label>
          <AssigneeMultiSelect value={parseAssignees(task.assignee)} onChange={handleAssigneeChange} />
        </div>

        {/* Estimated Hours */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-2">
            <Clock className="w-3 h-3" />
            Estimated Hours
          </Label>
          <Input
            type="number"
            value={task.estimatedHours || ''}
            onChange={(e) => handleEstimatedHoursChange(e.target.value)}
            placeholder="0"
            className="bg-black/40 border-white/10 hover:border-purple-500/50 transition-colors"
          />
        </div>

        <Separator />

        {/* Hypercube Tags */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-2">
            <Tag className="w-3 h-3" />
            Hypercube Faces
          </Label>
          <FaceTagSelector value={task.hypercubeTags} onChange={handleFaceTagsChange} />
          {task.hypercubeTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {task.hypercubeTags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  style={{
                    borderColor: HYPERCUBE_FACE_COLORS[tag],
                    color: HYPERCUBE_FACE_COLORS[tag],
                  }}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Subtasks */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Subtasks</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {task.completedSubtasks}/{task.totalSubtasks}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddSubtask}
                className="h-7 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add
              </Button>
            </div>
          </div>
          {task.subtasks.length > 0 && (
            <>
              <Progress value={task.completionPercent} className="h-2" />
              <div className="space-y-2">
                {task.subtasks.map((subtask, index) => (
                  <div
                    key={subtask.id}
                    draggable
                    onDragStart={() => handleSubtaskDragStart(index)}
                    onDragOver={(e) => handleSubtaskDragOver(e, index)}
                    onDragEnd={handleSubtaskDragEnd}
                    className={cn(
                      "flex items-center gap-2 text-sm w-full text-left hover:bg-white/5 p-2 rounded transition-colors group cursor-move",
                      draggedSubtaskIndex === index && "opacity-50"
                    )}
                  >
                    <button
                      onClick={() => handleSubtaskToggle(subtask.id, !subtask.isCompleted)}
                      className="flex-shrink-0"
                    >
                      {subtask.isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>

                    {editingSubtaskId === subtask.id ? (
                      <Input
                        defaultValue={subtask.text}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSubtaskEdit(subtask.id, e.currentTarget.value);
                          }
                          if (e.key === 'Escape') {
                            setEditingSubtaskId(null);
                          }
                        }}
                        onBlur={(e) => handleSubtaskEdit(subtask.id, e.currentTarget.value)}
                        className="flex-1 text-sm bg-black/40 border-white/10 h-7"
                        autoFocus
                      />
                    ) : (
                      <span
                        className={cn(
                          "flex-1",
                          subtask.isCompleted && 'line-through text-muted-foreground'
                        )}
                        onClick={() => setEditingSubtaskId(subtask.id)}
                      >
                        {subtask.text}
                      </span>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSubtask(subtask.id)}
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
          {task.subtasks.length === 0 && (
            <p className="text-xs text-muted-foreground">No subtasks yet</p>
          )}
        </div>

        <Separator />

        {/* Custom Properties */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Custom Properties</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddProperty(!showAddProperty)}
              className="h-7 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>

          {/* Add Property Form */}
          {showAddProperty && (
            <div className="space-y-2 p-3 rounded-md bg-black/40 border border-white/10">
              <Input
                placeholder="Property name"
                value={newPropertyKey}
                onChange={(e) => setNewPropertyKey(e.target.value)}
                className="bg-black/40 border-white/10"
              />
              <Input
                placeholder="Property value"
                value={newPropertyValue}
                onChange={(e) => setNewPropertyValue(e.target.value)}
                className="bg-black/40 border-white/10"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddCustomProperty} className="flex-1">
                  Add Property
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowAddProperty(false);
                    setNewPropertyKey('');
                    setNewPropertyValue('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Existing Properties */}
          {task.customProperties && Object.keys(task.customProperties).length > 0 && (
            <div className="space-y-2">
              {Object.entries(task.customProperties).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-2 rounded-md bg-black/40 border border-white/10"
                >
                  <div className="flex-1">
                    <div className="text-xs font-medium text-purple-400">{key}</div>
                    <div className="text-xs text-muted-foreground">{String(value)}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveCustomProperty(key)}
                    className="h-7 w-7 p-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {!task.customProperties || Object.keys(task.customProperties).length === 0 && !showAddProperty && (
            <p className="text-xs text-muted-foreground">No custom properties</p>
          )}
        </div>

        <Separator />

        {/* Source Info */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Source</Label>
          <div className="text-xs text-muted-foreground">
            {task.sourceElementType} card on {task.sourceBoardId ? 'board' : 'canvas'}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-white/10">
        <Button onClick={onNavigate} variant="outline" className="w-full">
          <ExternalLink className="w-4 h-4 mr-2" />
          View in Canvas
        </Button>
      </div>

      {/* Delete/Archive Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-black/95 border-purple-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-purple-400">What would you like to do with this task?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              Choose how to handle <span className="font-semibold text-white">"{task.title}"</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="bg-white/10 border-white/20 hover:bg-white/20 mt-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onUpdate({ isArchived: true });
                setShowDeleteDialog(false);
                onClose();
              }}
              className="bg-purple-500 hover:bg-purple-600 text-white mt-0"
            >
              Archive
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                if (onDelete) {
                  onDelete(task.id);
                  setShowDeleteDialog(false);
                  onClose();
                }
              }}
              className="bg-red-500 hover:bg-red-600 text-white mt-0"
            >
              Permanently Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
