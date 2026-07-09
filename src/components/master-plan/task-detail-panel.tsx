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
import { FaceTagSelector } from '@/components/cxd/plan/face-tag-selector';
import { AssigneeMultiSelect } from '@/components/cxd/plan/assignee-multi-select';
import { parseAssignees, serializeAssignees } from '@/components/cxd/plan/assignee-utils';
import type { HypercubeFaceTag, TaskMetadata } from '@/types/canvas-elements';
import type { TaskProjection, TaskStatus, TaskPriority, TaskType } from '@/types/plan-types';
import { HYPERCUBE_FACE_COLORS } from '@/types/plan-types';
import type { Version } from '@/types/version-types';
import { X, Calendar, User, Clock, Tag, ExternalLink, CheckCircle2, Circle, Plus, Trash2, Archive, RotateCcw, Milestone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { projectColor } from './shared';

interface MasterPlanTaskDetailPanelProps {
  task: TaskProjection;
  projectId: string;
  projectName: string;
  versions: Version[];
  onClose: () => void;
  onUpdate: (updates: Partial<TaskProjection>) => void;
  onOpenInCanvas: () => void;
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

/**
 * Cross-project counterpart to cxd/plan/task-detail-panel.tsx. Same field
 * set, minus two things that panel has and this one deliberately doesn't:
 * subtask drag-to-reorder (would fire onUpdate once per drag tick — fine
 * against a local Y.Doc, too chatty against a network PATCH) and permanent
 * delete (no cross-project element-delete endpoint exists yet — archive
 * only). versions comes in as a prop instead of a useCXDStore read, since
 * this page has no live single-project store to read from.
 */
export function MasterPlanTaskDetailPanel({
  task,
  projectId,
  projectName,
  versions,
  onClose,
  onUpdate,
  onOpenInCanvas,
}: MasterPlanTaskDetailPanelProps) {
  const [newPropertyKey, setNewPropertyKey] = useState('');
  const [newPropertyValue, setNewPropertyValue] = useState('');
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);

  const selectedVersion = task.taskMetadata?.versionId
    ? versions.find((v) => v.id === task.taskMetadata?.versionId) || null
    : null;

  const handleStatusChange = (status: TaskStatus) => onUpdate({ status });
  const handlePriorityChange = (priority: TaskPriority | undefined) => onUpdate({ priority });
  const handleDueDateChange = (date: Date | undefined) => onUpdate({ dueDate: date ? date.toISOString() : undefined });
  const handleStartDateChange = (date: Date | undefined) => onUpdate({ startDate: date ? date.toISOString() : undefined });
  const handleAssigneeChange = (assignees: string[]) => onUpdate({ assignee: serializeAssignees(assignees) });
  const handleEstimatedHoursChange = (hours: string) => onUpdate({ estimatedHours: hours ? parseFloat(hours) : undefined });
  const handleTaskTypeChange = (taskType: TaskType | undefined) => onUpdate({ taskType });
  const handleFaceTagsChange = (faces: HypercubeFaceTag[]) => onUpdate({ hypercubeTags: faces });

  const handleVersionChange = (versionId: string) => {
    const updatedTaskMetadata: TaskMetadata = { ...(task.taskMetadata || {}), versionId: versionId || undefined };
    onUpdate({ taskMetadata: updatedTaskMetadata });
  };

  const handleSubtaskToggle = (subtaskId: string, isCompleted: boolean) => {
    onUpdate({ subtasks: task.subtasks.map((st) => (st.id === subtaskId ? { ...st, isCompleted } : st)) });
  };
  const handleAddCustomProperty = () => {
    if (!newPropertyKey.trim()) return;
    onUpdate({ customProperties: { ...(task.customProperties || {}), [newPropertyKey]: newPropertyValue } });
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
    if (editedTitle.trim() && editedTitle !== task.title) onUpdate({ title: editedTitle.trim() });
    setIsEditingTitle(false);
  };
  const handleDescriptionSave = () => onUpdate({ description: description.trim() });
  const handleSubtaskEdit = (subtaskId: string, newText: string) => {
    onUpdate({ subtasks: task.subtasks.map((st) => (st.id === subtaskId ? { ...st, text: newText } : st)) });
    setEditingSubtaskId(null);
  };
  const handleAddSubtask = () => {
    onUpdate({
      subtasks: [...task.subtasks, { id: `temp-${Date.now()}`, text: 'New Subtask', isCompleted: false, lineIndex: task.subtasks.length + 1 }],
    });
  };
  const handleRemoveSubtask = (subtaskId: string) => {
    onUpdate({ subtasks: task.subtasks.filter((st) => st.id !== subtaskId) });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: projectColor(projectId) }} />
          <h3 className="text-sm font-semibold text-white/60 truncate">{projectName}</h3>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => onUpdate({ isArchived: !task.isArchived })} title={task.isArchived ? 'Restore task' : 'Archive task'}>
            {task.isArchived ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 gantt-scrollbar">
        <div>
          {isEditingTitle ? (
            <div className="flex items-center gap-2 mb-2">
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSave();
                  if (e.key === 'Escape') { setEditedTitle(task.title); setIsEditingTitle(false); }
                }}
                className="text-xl font-semibold bg-black/40 border-white/10"
                autoFocus
              />
              <Button size="sm" variant="ghost" onClick={handleTitleSave}><CheckCircle2 className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditedTitle(task.title); setIsEditingTitle(false); }}><X className="w-4 h-4" /></Button>
            </div>
          ) : (
            <div
              className="text-xl font-semibold mb-2 cursor-pointer bg-gradient-to-r from-[#C4B5FD] to-[#8B5CF6] bg-clip-text text-transparent hover:from-[#DDD6FE] hover:to-[#A78BFA] transition-colors"
              onClick={() => setIsEditingTitle(true)}
              title="Click to edit title"
            >
              {task.title || 'Untitled task'}
            </div>
          )}
        </div>

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

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-2"><Calendar className="w-3 h-3" />Start Date</Label>
          <DatePicker date={task.startDate ? new Date(task.startDate) : undefined} onSelect={handleStartDateChange} placeholder="Set start date" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-2"><Calendar className="w-3 h-3" />Due Date</Label>
          <DatePicker date={task.dueDate ? new Date(task.dueDate) : undefined} onSelect={handleDueDateChange} placeholder="Set due date" />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <select
            value={task.status}
            onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
            className="w-full px-3 py-2 rounded-md bg-black/40 border border-white/10 text-sm hover:border-purple-500/50 transition-colors"
            style={{ colorScheme: 'dark' }}
          >
            {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Priority</Label>
          <select
            value={task.priority || ''}
            onChange={(e) => handlePriorityChange((e.target.value as TaskPriority) || undefined)}
            className="w-full px-3 py-2 rounded-md bg-black/40 border border-white/10 text-sm hover:border-purple-500/50 transition-colors"
            style={{ colorScheme: 'dark' }}
          >
            <option value="">None</option>
            {PRIORITY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Task Type</Label>
          <select
            value={task.taskType || ''}
            onChange={(e) => handleTaskTypeChange((e.target.value as TaskType) || undefined)}
            className="w-full px-3 py-2 rounded-md bg-black/40 border border-white/10 text-sm hover:border-purple-500/50 transition-colors"
            style={{ colorScheme: 'dark' }}
          >
            <option value="">None</option>
            {TASK_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-2"><Milestone className="w-3 h-3" />Version / Release</Label>
          <select
            value={task.taskMetadata?.versionId || ''}
            onChange={(e) => handleVersionChange(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-black/40 border border-white/10 text-sm hover:border-purple-500/50 transition-colors"
            style={{ colorScheme: 'dark' }}
          >
            <option value="">Unversioned</option>
            {versions.map((version) => <option key={version.id} value={version.id}>{version.name} - {version.type_label}</option>)}
          </select>
          {selectedVersion && (
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedVersion.color }} />
              <span className="text-xs text-white/70">{selectedVersion.name}</span>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-white/20" style={{ borderColor: selectedVersion.color, color: selectedVersion.color }}>
                {selectedVersion.type_label}
              </Badge>
              <span className="text-[10px] text-white/50 uppercase">{selectedVersion.status}</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-2"><User className="w-3 h-3" />Assignee</Label>
          <AssigneeMultiSelect value={parseAssignees(task.assignee)} onChange={handleAssigneeChange} />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-2"><Clock className="w-3 h-3" />Estimated Hours</Label>
          <Input type="number" value={task.estimatedHours || ''} onChange={(e) => handleEstimatedHoursChange(e.target.value)} placeholder="0" className="bg-black/40 border-white/10 hover:border-purple-500/50 transition-colors" />
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-2"><Tag className="w-3 h-3" />Hypercube Faces</Label>
          <FaceTagSelector value={task.hypercubeTags} onChange={handleFaceTagsChange} />
          {task.hypercubeTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {task.hypercubeTags.map((tag) => (
                <Badge key={tag} variant="outline" style={{ borderColor: HYPERCUBE_FACE_COLORS[tag], color: HYPERCUBE_FACE_COLORS[tag] }}>{tag}</Badge>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Subtasks</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{task.completedSubtasks}/{task.totalSubtasks}</span>
              <Button variant="ghost" size="sm" onClick={handleAddSubtask} className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" />Add</Button>
            </div>
          </div>
          {task.subtasks.length > 0 && (
            <>
              <Progress value={task.completionPercent} className="h-2" />
              <div className="space-y-2">
                {task.subtasks.map((subtask) => (
                  <div key={subtask.id} className="flex items-center gap-2 text-sm w-full text-left hover:bg-white/5 p-2 rounded transition-colors group">
                    <button onClick={() => handleSubtaskToggle(subtask.id, !subtask.isCompleted)} className="flex-shrink-0">
                      {subtask.isCompleted ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    {editingSubtaskId === subtask.id ? (
                      <Input
                        defaultValue={subtask.text}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSubtaskEdit(subtask.id, e.currentTarget.value); if (e.key === 'Escape') setEditingSubtaskId(null); }}
                        onBlur={(e) => handleSubtaskEdit(subtask.id, e.currentTarget.value)}
                        className="flex-1 text-sm bg-black/40 border-white/10 h-7"
                        autoFocus
                      />
                    ) : (
                      <span className={cn('flex-1', subtask.isCompleted && 'line-through text-muted-foreground')} onClick={() => setEditingSubtaskId(subtask.id)}>
                        {subtask.text}
                      </span>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveSubtask(subtask.id)} className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
          {task.subtasks.length === 0 && <p className="text-xs text-muted-foreground">No subtasks yet</p>}
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Custom Properties</Label>
            <Button variant="ghost" size="sm" onClick={() => setShowAddProperty(!showAddProperty)} className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" />Add</Button>
          </div>
          {showAddProperty && (
            <div className="space-y-2 p-3 rounded-md bg-black/40 border border-white/10">
              <Input placeholder="Property name" value={newPropertyKey} onChange={(e) => setNewPropertyKey(e.target.value)} className="bg-black/40 border-white/10" />
              <Input placeholder="Property value" value={newPropertyValue} onChange={(e) => setNewPropertyValue(e.target.value)} className="bg-black/40 border-white/10" />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddCustomProperty} className="flex-1">Add Property</Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowAddProperty(false); setNewPropertyKey(''); setNewPropertyValue(''); }}>Cancel</Button>
              </div>
            </div>
          )}
          {task.customProperties && Object.keys(task.customProperties).length > 0 && (
            <div className="space-y-2">
              {Object.entries(task.customProperties).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-2 rounded-md bg-black/40 border border-white/10">
                  <div className="flex-1">
                    <div className="text-xs font-medium text-purple-400">{key}</div>
                    <div className="text-xs text-muted-foreground">{String(value)}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveCustomProperty(key)} className="h-7 w-7 p-0"><Trash2 className="w-3 h-3" /></Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-white/10">
        <Button onClick={onOpenInCanvas} variant="outline" className="w-full">
          <ExternalLink className="w-4 h-4 mr-2" />
          Open Project
        </Button>
      </div>
    </div>
  );
}
