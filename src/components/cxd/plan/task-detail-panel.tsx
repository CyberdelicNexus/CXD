'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { DatePicker } from '@/components/ui/date-picker';
import type { TaskProjection, TaskStatus, TaskPriority, TaskType } from '@/types/plan-types';
import { HYPERCUBE_FACE_COLORS } from '@/types/plan-types';
import { X, Calendar, User, Clock, Tag, ExternalLink, CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';

interface TaskDetailPanelProps {
  task: TaskProjection;
  onClose: () => void;
  onUpdate: (updates: Partial<TaskProjection>) => void;
  onNavigate: () => void;
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

export function TaskDetailPanel({ task, onClose, onUpdate, onNavigate }: TaskDetailPanelProps) {
  const [newPropertyKey, setNewPropertyKey] = useState('');
  const [newPropertyValue, setNewPropertyValue] = useState('');
  const [showAddProperty, setShowAddProperty] = useState(false);
  const handleStatusChange = (status: TaskStatus) => {
    onUpdate({ status });
  };

  const handlePriorityChange = (priority: TaskPriority | undefined) => {
    onUpdate({ priority });
  };

  const handleDueDateChange = (date: Date | undefined) => {
    onUpdate({ dueDate: date?.toISOString() });
  };

  const handleStartDateChange = (date: Date | undefined) => {
    onUpdate({ startDate: date?.toISOString() });
  };

  const handleAssigneeChange = (assignee: string) => {
    onUpdate({ assignee: assignee || undefined });
  };

  const handleEstimatedHoursChange = (hours: string) => {
    const value = hours ? parseFloat(hours) : undefined;
    onUpdate({ estimatedHours: value });
  };

  const handleTaskTypeChange = (taskType: TaskType | undefined) => {
    onUpdate({ taskType });
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h3 className="text-lg font-semibold">Task Details</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Title */}
        <div>
          <h2 className="text-xl font-semibold mb-2">{task.title}</h2>
          <p className="text-sm text-muted-foreground">{task.description}</p>
        </div>

        <Separator />

        {/* Status */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <select
            value={task.status}
            onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
            className="w-full px-3 py-2 rounded-md bg-black/40 border border-white/10 text-sm hover:border-purple-500/50 transition-colors"
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
          >
            <option value="">None</option>
            {TASK_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
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

        {/* Assignee */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-2">
            <User className="w-3 h-3" />
            Assignee
          </Label>
          <Input
            value={task.assignee || ''}
            onChange={(e) => handleAssigneeChange(e.target.value)}
            placeholder="Enter assignee name"
            className="bg-black/40 border-white/10 hover:border-purple-500/50 transition-colors"
          />
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
        {task.hypercubeTags.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <Tag className="w-3 h-3" />
              Hypercube Faces
            </Label>
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
          </div>
        )}

        {/* Subtasks */}
        {task.totalSubtasks > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Subtasks</Label>
              <span className="text-xs text-muted-foreground">
                {task.completedSubtasks}/{task.totalSubtasks}
              </span>
            </div>
            <Progress value={task.completionPercent} className="h-2" />
            <div className="space-y-2">
              {task.subtasks.map((subtask) => (
                <button
                  key={subtask.id}
                  onClick={() => handleSubtaskToggle(subtask.id, !subtask.isCompleted)}
                  className="flex items-center gap-2 text-sm w-full text-left hover:bg-white/5 p-2 rounded transition-colors"
                >
                  {subtask.isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className={subtask.isCompleted ? 'line-through text-muted-foreground' : ''}>
                    {subtask.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

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
    </div>
  );
}
