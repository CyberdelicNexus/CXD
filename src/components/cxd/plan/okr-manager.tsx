'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useCXDStore } from '@/store/cxd-store';
import type { OKR, OKRStatus, Objective, KeyResult } from '@/types/version-types';
import { OKR_STATUS_CONFIG, calculateKeyResultProgress, calculateObjectiveProgress, calculateOKRProgress } from '@/types/version-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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

  const okrs = useMemo(
    () => allOKRs.filter((okr) => okr.versionId === versionId),
    [allOKRs, versionId]
  );

  const handleAddOKR = () => addOKR(versionId);

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
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsGrouped(false)}
              className="h-7 px-2 gap-1 text-xs text-white/60 hover:text-white"
            >
              <List className="w-3 h-3" />
              List
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsGrouped(true)}
              className="h-7 px-2 gap-1 text-xs bg-white/10 text-white"
            >
              <LayoutGrid className="w-3 h-3" />
              Board
            </Button>
            <Button onClick={handleAddOKR} size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs text-white/60 hover:text-white">
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Board columns */}
        <div className="grid grid-cols-2 gap-3">
          {OKR_STATUSES.map((status) => {
            const cfg = OKR_STATUS_CONFIG[status];
            const columnOKRs = okrs.filter((o) => o.status === status);
            return (
              <div key={status} className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
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
                    <OKRCard key={okr.id} okr={okr} compact />
                  ))}
                  {columnOKRs.length === 0 && (
                    <div className="text-[10px] text-white/20 text-center py-3">No OKRs</div>
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
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsGrouped(false)}
            className="h-7 px-2 gap-1 text-xs bg-white/10 text-white"
          >
            <List className="w-3 h-3" />
            List
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsGrouped(true)}
            className="h-7 px-2 gap-1 text-xs text-white/60 hover:text-white"
          >
            <LayoutGrid className="w-3 h-3" />
            Board
          </Button>
          <Button onClick={handleAddOKR} size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs text-white/60 hover:text-white">
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* OKR Cards */}
      {okrs.map((okr) => (
        <OKRCard key={okr.id} okr={okr} />
      ))}
    </div>
  );
}

interface OKRCardProps {
  okr: OKR;
  compact?: boolean;
}

function OKRCard({ okr, compact = false }: OKRCardProps) {
  const updateOKR = useCXDStore((state) => state.updateOKR);
  const deleteOKR = useCXDStore((state) => state.deleteOKR);
  const addObjective = useCXDStore((state) => state.addObjective);
  const addKeyResult = useCXDStore((state) => state.addKeyResult);

  const [isExpanded, setIsExpanded] = useState(!compact);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(okr.name || 'New OKR');
  const [editedDescription, setEditedDescription] = useState(okr.description || '');
  const [showStatusMenu, setShowStatusMenu] = useState(false);

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
    if (confirm('Delete this OKR and all its objectives?')) {
      deleteOKR(okr.id);
    }
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
      className={cn(
        'rounded-lg border overflow-hidden transition-all',
        'bg-black/40 hover:bg-black/50',
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
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleDelete}
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
    </div>
  );
}

interface OKRMetaProps {
  okr: OKR;
  onUpdate: (updates: Partial<OKR>) => void;
}

function OKRMeta({ okr, onUpdate }: OKRMetaProps) {
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [isEditingAssignees, setIsEditingAssignees] = useState(false);
  const [dateInput, setDateInput] = useState(
    okr.dueDate ? new Date(okr.dueDate).toISOString().split('T')[0] : ''
  );
  const [assigneeInput, setAssigneeInput] = useState((okr.assignees || []).join(', '));

  useEffect(() => {
    setDateInput(okr.dueDate ? new Date(okr.dueDate).toISOString().split('T')[0] : '');
    setAssigneeInput((okr.assignees || []).join(', '));
  }, [okr.dueDate, okr.assignees]);

  const handleDateSave = () => {
    const d = dateInput ? new Date(dateInput).toISOString() : undefined;
    onUpdate({ dueDate: d });
    setIsEditingDate(false);
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
    <div className="flex items-center gap-3 flex-wrap">
      {/* Due Date */}
      {isEditingDate ? (
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            onBlur={handleDateSave}
            className="text-xs bg-black/40 border border-white/20 rounded px-2 py-1 text-white"
            style={{ colorScheme: 'dark' }}
            autoFocus
          />
        </div>
      ) : (
        <button
          onClick={() => setIsEditingDate(true)}
          className="flex items-center gap-1 text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          <Calendar className="w-3 h-3" />
          {okr.dueDate
            ? format(new Date(okr.dueDate), 'MMM d')
            : <span className="text-white/30">Set due date</span>}
        </button>
      )}

      {/* Assignees */}
      {isEditingAssignees ? (
        <div className="flex items-center gap-1">
          <input
            value={assigneeInput}
            onChange={(e) => setAssigneeInput(e.target.value)}
            onBlur={handleAssigneesSave}
            placeholder="John, Jane..."
            className="text-xs bg-black/40 border border-white/20 rounded px-2 py-1 text-white w-32"
            autoFocus
          />
        </div>
      ) : (
        <button
          onClick={() => setIsEditingAssignees(true)}
          className="flex items-center gap-1 text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          <User className="w-3 h-3" />
          {(okr.assignees || []).length > 0 ? (
            <div className="flex items-center gap-1">
              {(okr.assignees || []).slice(0, 3).map((a) => (
                <div
                  key={a}
                  className="w-5 h-5 rounded-full bg-purple-600/60 text-[8px] font-bold text-white flex items-center justify-center"
                  title={a}
                >
                  {a.charAt(0).toUpperCase()}
                </div>
              ))}
              {(okr.assignees || []).length > 3 && (
                <span className="text-[10px] text-white/40">+{(okr.assignees || []).length - 3}</span>
              )}
            </div>
          ) : (
            <span className="text-white/30">Assign</span>
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
  const [currentValue, setCurrentValue] = useState(keyResult.currentValue.toString());
  const [targetValue, setTargetValue] = useState(keyResult.targetValue.toString());
  const [unit, setUnit] = useState(keyResult.unit);

  useEffect(() => {
    setDescription(keyResult.description);
    setCurrentValue(keyResult.currentValue.toString());
    setTargetValue(keyResult.targetValue.toString());
    setUnit(keyResult.unit);
  }, [keyResult.description, keyResult.currentValue, keyResult.targetValue, keyResult.unit]);

  const progress = calculateKeyResultProgress(keyResult);
  const isComplete = progress >= 100;

  const handleSave = () => {
    const updates: Partial<KeyResult> = {};
    if (description !== keyResult.description) updates.description = description;
    if (parseFloat(currentValue) !== keyResult.currentValue) updates.currentValue = parseFloat(currentValue) || 0;
    if (parseFloat(targetValue) !== keyResult.targetValue) updates.targetValue = parseFloat(targetValue) || 100;
    if (unit !== keyResult.unit) updates.unit = unit;
    if (Object.keys(updates).length > 0) {
      updateKeyResult(okrId, objectiveId, keyResult.id, updates);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-start gap-2 p-2 bg-white/5 rounded border border-white/20">
        <div className="flex-1 space-y-1.5">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Key result description"
            className="h-6 text-xs bg-black/20 border-white/10"
          />
          <div className="flex gap-1.5 items-center">
            <Input
              type="number"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              placeholder="Current"
              className="h-6 text-xs bg-black/20 border-white/10 w-16"
            />
            <span className="text-white/30 text-xs">/</span>
            <Input
              type="number"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="Target"
              className="h-6 text-xs bg-black/20 border-white/10 w-16"
            />
            <Input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="%"
              className="h-6 text-xs bg-black/20 border-white/10 w-14"
            />
            <Button size="sm" onClick={handleSave} className="h-6 px-2 text-xs">Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="h-6 px-2 text-xs">✕</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="group flex items-center gap-2 px-1.5 py-1 rounded hover:bg-white/5 cursor-pointer transition-colors"
    >
      {isComplete ? (
        <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
      ) : (
        <Circle className="w-3 h-3 text-white/20 flex-shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className="text-xs text-white/70 truncate group-hover:text-white/90">
          {keyResult.description || 'Untitled Key Result'}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="w-20 h-0.5 bg-black/40 rounded-full overflow-hidden">
            <div
              className={cn('h-full transition-all duration-300', isComplete ? 'bg-green-400' : 'bg-blue-400')}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <span className="text-[9px] text-white/30">
            {keyResult.currentValue}/{keyResult.targetValue} {keyResult.unit}
          </span>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm('Delete this key result?')) deleteKeyResult(okrId, objectiveId, keyResult.id);
        }}
        className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}
