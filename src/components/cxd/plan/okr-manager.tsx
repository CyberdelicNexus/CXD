'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useCXDStore } from '@/store/cxd-store';
import type { OKR, OKRStatus, Objective, KeyResult } from '@/types/version-types';
import { OKR_STATUS_CONFIG, calculateKeyResultProgress, calculateObjectiveProgress, calculateOKRProgress } from '@/types/version-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DeleteConfirmDialog } from '@/components/cxd/delete-confirm-dialog';
import { cn } from '@/lib/utils';
import {
  Target,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  LayoutGrid,
  List,
  Calendar,
  User,
} from 'lucide-react';
import { format } from 'date-fns';

interface OKRManagerProps {
  versionId: string;
}

const OKR_STATUSES: OKRStatus[] = ['on_track', 'at_risk', 'behind', 'complete'];

export function OKRManager({ versionId }: OKRManagerProps) {
  const allOKRs = useCXDStore((state) => state.getCurrentProject()?.okrs || []);
  const addOKR = useCXDStore((state) => state.addOKR);
  const updateOKR = useCXDStore((state) => state.updateOKR);

  const [isGrouped, setIsGrouped] = useState(false);
  const [draggedOKRId, setDraggedOKRId] = useState<string | null>(null);

  const okrs = useMemo(
    () => allOKRs.filter((okr) => okr.versionId === versionId),
    [allOKRs, versionId]
  );

  const handleAddOKR = () => addOKR(versionId);

  const handleDragStart = (okrId: string) => {
    setDraggedOKRId(okrId);
  };

  const handleDragEnd = () => {
    setDraggedOKRId(null);
  };

  const handleDrop = (targetStatus: OKRStatus) => {
    if (draggedOKRId) {
      updateOKR(draggedOKRId, { status: targetStatus });
      setDraggedOKRId(null);
    }
  };

  if (okrs.length === 0) {
    return (
      <div className="space-y-3">
        <div className="text-white/60 text-sm">
          Create OKR cards to define objectives and track key results for this version.
        </div>
        <Button onClick={handleAddOKR} size="sm" variant="outline" className="w-full gap-2">
          <Plus className="w-4 h-4" />
          Create First OKR
        </Button>
      </div>
    );
  }

  if (isGrouped) {
    return (
      <div className="space-y-3">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50">{okrs.length} OKR{okrs.length !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-white/15 bg-white/5 p-0.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsGrouped(false)}
                className="h-7 px-3 gap-1.5 text-xs text-white/50 hover:text-white hover:bg-transparent"
              >
                <List className="w-3.5 h-3.5" />
                List
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsGrouped(true)}
                className="h-7 px-3 gap-1.5 text-xs rounded-md bg-white/15 text-white hover:bg-white/20"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Board
              </Button>
            </div>
            <Button onClick={handleAddOKR} size="sm" variant="ghost" className="h-7 w-7 p-0 text-white/60 hover:text-white">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Board columns */}
        <div className="grid grid-cols-2 gap-3">
          {OKR_STATUSES.map((status) => {
            const cfg = OKR_STATUS_CONFIG[status];
            const columnOKRs = okrs.filter((o) => o.status === status);
            const isDragOver = draggedOKRId !== null;
            return (
              <div
                key={status}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add('ring-2', 'ring-white/20');
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove('ring-2', 'ring-white/20');
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('ring-2', 'ring-white/20');
                  handleDrop(status);
                }}
                className="rounded-lg border border-white/10 bg-black/20 overflow-hidden transition-all"
              >
                {/* Column Header */}
                <div
                  className="flex items-center gap-2 px-3 py-2 border-b border-white/10"
                  style={{ backgroundColor: cfg.bg }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                  <span className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
                  <span className="ml-auto text-[10px] text-white/40">{columnOKRs.length}</span>
                </div>

                {/* OKR Cards */}
                <div className="p-2 space-y-2 min-h-[60px]">
                  {columnOKRs.map((okr) => (
                    <OKRCard
                      key={okr.id}
                      okr={okr}
                      compact
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      isDragging={draggedOKRId === okr.id}
                    />
                  ))}
                  {columnOKRs.length === 0 && (
                    <div className="text-[10px] text-white/20 text-center py-3">
                      {isDragOver ? 'Drop here' : 'No OKRs'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">{okrs.length} OKR{okrs.length !== 1 ? 's' : ''}</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-white/15 bg-white/5 p-0.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsGrouped(false)}
              className="h-7 px-3 gap-1.5 text-xs rounded-md bg-white/15 text-white hover:bg-white/20"
            >
              <List className="w-3.5 h-3.5" />
              List
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsGrouped(true)}
              className="h-7 px-3 gap-1.5 text-xs text-white/50 hover:text-white hover:bg-transparent"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Board
            </Button>
          </div>
          <Button onClick={handleAddOKR} size="sm" variant="ghost" className="h-7 w-7 p-0 text-white/60 hover:text-white">
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* OKR Cards */}
      {okrs.map((okr) => (
        <OKRCard key={okr.id} okr={okr} />
      ))}

      {/* Add New OKR Block */}
      <button
        onClick={handleAddOKR}
        className="w-full px-4 py-6 rounded-lg border border-dashed border-white/20 hover:border-white/40 transition-all group"
        style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)',
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 group-hover:bg-white/20 transition-all">
            <Plus className="w-5 h-5 text-white/60 group-hover:text-white/90" />
          </div>
          <span className="text-sm font-medium text-white/60 group-hover:text-white/90">Add New OKR</span>
          <span className="text-xs text-white/40">Define objectives and key results for this version</span>
        </div>
      </button>
    </div>
  );
}

interface OKRCardProps {
  okr: OKR;
  compact?: boolean;
  onDragStart?: (okrId: string) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}

function OKRCard({ okr, compact = false, onDragStart, onDragEnd, isDragging = false }: OKRCardProps) {
  const updateOKR = useCXDStore((state) => state.updateOKR);
  const deleteOKR = useCXDStore((state) => state.deleteOKR);
  const addObjective = useCXDStore((state) => state.addObjective);
  const addKeyResult = useCXDStore((state) => state.addKeyResult);

  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(okr.name || 'New OKR');
  const [editedDescription, setEditedDescription] = useState(okr.description || '');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setEditedName(okr.name || 'New OKR');
    setEditedDescription(okr.description || '');
  }, [okr.name, okr.description]);

  const cfg = OKR_STATUS_CONFIG[okr.status || 'on_track'];
  const overallProgress = calculateOKRProgress(okr);

  // Get all key results across all objectives for flat display
  const allKeyResults = useMemo(
    () => okr.objectives.flatMap((obj) => obj.keyResults.map((kr) => ({ kr, objId: obj.id }))),
    [okr.objectives]
  );

  const handleNameSave = () => {
    if (editedName.trim() && editedName !== okr.name) {
      updateOKR(okr.id, { name: editedName.trim() });
    }
    setIsEditingName(false);
  };

  const handleDescriptionBlur = () => {
    if (editedDescription !== (okr.description || '')) {
      updateOKR(okr.id, { description: editedDescription });
    }
  };

  const handleStatusChange = (status: OKRStatus) => {
    updateOKR(okr.id, { status });
    setShowStatusMenu(false);
  };

  const handleDelete = () => {
    deleteOKR(okr.id);
  };

  const handleAddKeyResult = () => {
    if (okr.objectives.length === 0) {
      addObjective(okr.id, 'Key Results');
    } else {
      addKeyResult(okr.id, okr.objectives[0].id);
    }
  };

  return (
    <div
      draggable={compact}
      onDragStart={() => onDragStart?.(okr.id)}
      onDragEnd={onDragEnd}
      className={cn(
        'rounded-lg border overflow-hidden transition-all',
        'bg-black/40 hover:bg-black/50',
        compact && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50 scale-95',
      )}
      style={{ borderColor: `${cfg.color}30` }}
    >
      {/* Color stripe at top */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}50)` }} />

      {/* Card Header */}
      <div className="px-3 pt-2.5 pb-2">
        <div className="flex items-start gap-2">
          <Target className="w-3.5 h-3.5 text-white/40 mt-0.5 flex-shrink-0" />

          {/* Name */}
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameSave();
                  if (e.key === 'Escape') { setEditedName(okr.name || 'New OKR'); setIsEditingName(false); }
                }}
                className="h-6 text-sm font-semibold bg-white/5 border-white/20 px-1"
                autoFocus
              />
            ) : (
              <div
                onClick={() => setIsEditingName(true)}
                className="text-sm font-semibold text-white/90 cursor-pointer hover:text-white leading-tight"
              >
                {okr.name || 'New OKR'}
              </div>
            )}
          </div>

          {/* Status badge */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all hover:opacity-80"
              style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }}
            >
              {cfg.label}
            </button>
            {showStatusMenu && (
              <div className="absolute right-0 top-6 z-50 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl overflow-hidden w-28">
                {OKR_STATUSES.map((s) => {
                  const c = OKR_STATUS_CONFIG[s];
                  return (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition-colors text-left"
                      style={{ color: c.color }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Expand / Delete */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-center w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 transition-all active:scale-95"
          >
            {isExpanded ? (
              <ChevronDown className="w-4.5 h-4.5 text-white/80" />
            ) : (
              <ChevronRight className="w-4.5 h-4.5 text-white/80" />
            )}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-white/30 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1 bg-black/40 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300 rounded-full"
              style={{
                width: `${overallProgress}%`,
                background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}80)`,
              }}
            />
          </div>
          <span className="text-[9px] text-white/40 min-w-[3ch]">{overallProgress}%</span>
        </div>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-white/5">
          {/* Description */}
          <Textarea
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            placeholder="Describe this OKR goal..."
            className="mt-2 min-h-[60px] text-xs bg-white/5 border-white/10 resize-none"
          />

          {/* Meta row: due date + assignees */}
          <OKRMeta okr={okr} onUpdate={(updates) => updateOKR(okr.id, updates)} />

          {/* Key Results */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Key Results</div>
            {allKeyResults.map(({ kr, objId }) => (
              <FlatKeyResultRow
                key={kr.id}
                okrId={okr.id}
                objectiveId={objId}
                keyResult={kr}
              />
            ))}
            <Button
              onClick={handleAddKeyResult}
              size="sm"
              variant="ghost"
              className="w-full gap-1 text-white/40 hover:text-white/70 text-xs h-7 border border-dashed border-white/10 hover:border-white/20"
            >
              <Plus className="w-3 h-3" />
              Add Key Result
            </Button>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete OKR"
        description="Are you sure you want to delete this OKR and all its objectives? This action cannot be undone."
      />
    </div>
  );
}

interface OKRMetaProps {
  okr: OKR;
  onUpdate: (updates: Partial<OKR>) => void;
}

function OKRMeta({ okr, onUpdate }: OKRMetaProps) {
  const [isEditingStartDate, setIsEditingStartDate] = useState(false);
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [isEditingAssignees, setIsEditingAssignees] = useState(false);
  const [startDateInput, setStartDateInput] = useState(
    okr.startDate ? new Date(okr.startDate).toISOString().split('T')[0] : ''
  );
  const [dueDateInput, setDueDateInput] = useState(
    okr.dueDate ? new Date(okr.dueDate).toISOString().split('T')[0] : ''
  );
  const [assigneeInput, setAssigneeInput] = useState((okr.assignees || []).join(', '));

  useEffect(() => {
    setStartDateInput(okr.startDate ? new Date(okr.startDate).toISOString().split('T')[0] : '');
    setDueDateInput(okr.dueDate ? new Date(okr.dueDate).toISOString().split('T')[0] : '');
    setAssigneeInput((okr.assignees || []).join(', '));
  }, [okr.startDate, okr.dueDate, okr.assignees]);

  const handleStartDateSave = () => {
    const d = startDateInput ? new Date(startDateInput).toISOString() : undefined;
    onUpdate({ startDate: d });
    setIsEditingStartDate(false);
  };

  const handleDueDateSave = () => {
    const d = dueDateInput ? new Date(dueDateInput).toISOString() : undefined;
    onUpdate({ dueDate: d });
    setIsEditingDueDate(false);
  };

  const handleAssigneesSave = () => {
    const assignees = assigneeInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    onUpdate({ assignees });
    setIsEditingAssignees(false);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Start Date */}
      {isEditingStartDate ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/20">
          <Calendar className="w-4 h-4 text-blue-400" />
          <input
            type="date"
            value={startDateInput}
            onChange={(e) => setStartDateInput(e.target.value)}
            onBlur={handleStartDateSave}
            className="text-sm bg-transparent border-none outline-none text-white min-w-[140px]"
            style={{ colorScheme: 'dark' }}
            autoFocus
          />
        </div>
      ) : (
        <button
          onClick={() => setIsEditingStartDate(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-400/40 transition-all"
        >
          <Calendar className="w-4 h-4 text-blue-400" />
          <div className="flex flex-col items-start">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">Start</span>
            <span className="text-sm text-white/90 font-medium">
              {okr.startDate ? format(new Date(okr.startDate), 'MMM d, yyyy') : 'Set date'}
            </span>
          </div>
        </button>
      )}

      {/* Due Date */}
      {isEditingDueDate ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/20">
          <Calendar className="w-4 h-4 text-amber-400" />
          <input
            type="date"
            value={dueDateInput}
            onChange={(e) => setDueDateInput(e.target.value)}
            onBlur={handleDueDateSave}
            className="text-sm bg-transparent border-none outline-none text-white min-w-[140px]"
            style={{ colorScheme: 'dark' }}
            autoFocus
          />
        </div>
      ) : (
        <button
          onClick={() => setIsEditingDueDate(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-400/40 transition-all"
        >
          <Calendar className="w-4 h-4 text-amber-400" />
          <div className="flex flex-col items-start">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">Due</span>
            <span className="text-sm text-white/90 font-medium">
              {okr.dueDate ? format(new Date(okr.dueDate), 'MMM d, yyyy') : 'Set date'}
            </span>
          </div>
        </button>
      )}

      {/* Assignees */}
      {isEditingAssignees ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/20">
          <User className="w-4 h-4 text-purple-400" />
          <input
            value={assigneeInput}
            onChange={(e) => setAssigneeInput(e.target.value)}
            onBlur={handleAssigneesSave}
            placeholder="John, Jane..."
            className="text-sm bg-transparent border-none outline-none text-white min-w-[140px]"
            autoFocus
          />
        </div>
      ) : (
        <button
          onClick={() => setIsEditingAssignees(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-400/40 transition-all"
        >
          <User className="w-4 h-4 text-purple-400" />
          {(okr.assignees || []).length > 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center -space-x-2">
                {(okr.assignees || []).slice(0, 3).map((a, idx) => (
                  <div
                    key={a}
                    className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 text-[10px] font-bold text-white flex items-center justify-center border-2 border-black/20 ring-1 ring-white/10"
                    title={a}
                    style={{ zIndex: 10 - idx }}
                  >
                    {a.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[10px] text-white/40 uppercase tracking-wider">Assigned</span>
                <span className="text-sm text-white/90 font-medium">
                  {(okr.assignees || []).length} {(okr.assignees || []).length === 1 ? 'person' : 'people'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-start">
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Assignees</span>
              <span className="text-sm text-white/60">Add people</span>
            </div>
          )}
        </button>
      )}
    </div>
  );
}

interface FlatKeyResultRowProps {
  okrId: string;
  objectiveId: string;
  keyResult: KeyResult;
}

function FlatKeyResultRow({ okrId, objectiveId, keyResult }: FlatKeyResultRowProps) {
  const updateKeyResult = useCXDStore((state) => state.updateKeyResult);
  const deleteKeyResult = useCXDStore((state) => state.deleteKeyResult);

  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(keyResult.description);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setDescription(keyResult.description);
  }, [keyResult.description]);

  const isComplete = keyResult.completed ?? false;

  const handleSave = () => {
    if (description !== keyResult.description) {
      updateKeyResult(okrId, objectiveId, keyResult.id, { description });
    }
    setIsEditing(false);
  };

  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateKeyResult(okrId, objectiveId, keyResult.id, { completed: !isComplete });
  };

  if (isEditing) {
    return (
      <div
        className="flex items-start gap-2 p-2.5 rounded-lg border transition-all"
        style={{
          background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(217, 119, 6, 0.04) 100%)',
          borderColor: 'rgba(251, 191, 36, 0.2)',
        }}
      >
        <div className="flex-1 flex gap-1.5 items-center">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Key result description"
            className="h-6 text-xs bg-black/20 border-white/10 flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') setIsEditing(false);
            }}
          />
          <Button size="sm" onClick={handleSave} className="h-6 px-2 text-xs">Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="h-6 px-2 text-xs">✕</Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group flex items-start gap-2 px-2.5 py-2 rounded-lg border transition-all hover:border-amber-500/30"
      style={{
        background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.06) 0%, rgba(217, 119, 6, 0.02) 100%)',
        borderColor: 'rgba(251, 191, 36, 0.15)',
      }}
    >
      <button
        onClick={handleToggleComplete}
        className="flex-shrink-0 transition-colors mt-0.5"
      >
        {isComplete ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
        ) : (
          <Circle className="w-3.5 h-3.5 text-amber-400/50 hover:text-amber-400/80" />
        )}
      </button>

      <div
        onClick={() => setIsEditing(true)}
        className="flex-1 min-w-0 cursor-pointer"
      >
        <div className={cn(
          "text-xs transition-colors leading-relaxed",
          isComplete ? "text-white/40 line-through" : "text-white/80 group-hover:text-white/95"
        )}>
          {keyResult.description || 'Untitled Key Result'}
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowDeleteConfirm(true);
        }}
        className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all flex-shrink-0 mt-0.5"
      >
        <Trash2 className="w-3 h-3" />
      </button>

      <DeleteConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => deleteKeyResult(okrId, objectiveId, keyResult.id)}
        title="Delete Key Result"
        description="Are you sure you want to delete this key result? This action cannot be undone."
      />
    </div>
  );
}
