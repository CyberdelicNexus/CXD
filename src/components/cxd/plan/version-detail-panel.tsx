'use client';

import React, { useState, useEffect } from 'react';
import { useCXDStore } from '@/store/cxd-store';
import type { Version, VersionStatus, VersionTypeLabel } from '@/types/version-types';
import type { FreeformElement } from '@/types/canvas-elements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DeleteConfirmDialog } from '@/components/cxd/delete-confirm-dialog';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  Calendar as CalendarIcon,
  Trash2,
  FileText,
  Target,
  Lightbulb,
  CheckSquare,
  Circle,
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';
import { DEFAULT_TYPE_LABELS, TYPE_LABEL_COLORS } from '@/types/version-types';
import { OKRManager } from './okr-manager';

interface VersionDetailPanelProps {
  version: Version;
}

export function VersionDetailPanel({ version }: VersionDetailPanelProps) {
  const updateVersion = useCXDStore((state) => state.updateVersion);
  const deleteVersion = useCXDStore((state) => state.deleteVersion);
  const setVersionStatus = useCXDStore((state) => state.setVersionStatus);
  const project = useCXDStore((state) => state.getCurrentProject());

  // Get all tasks for this version
  const versionTasks = (project?.canvasLayout?.elements || [])
    .filter((el) => el.type === 'freeform' && el.cardType === 'task' && el.taskMetadata?.versionId === version.id)
    .map((el) => {
      const freeform = el as FreeformElement;
      return {
        id: freeform.id,
        title: freeform.content?.split('\n')[0] || 'Untitled Task',
        status: freeform.taskMetadata?.status || 'not_started',
      };
    });

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(version.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Local state for text areas to allow typing without cursor jump
  const [scopeContent, setScopeContent] = useState(version.description);
  const [learningsContent, setLearningsContent] = useState(version.learnings_content);

  // Sync local state when version prop changes (different version selected)
  useEffect(() => {
    setEditedName(version.name);
    setScopeContent(version.description);
    setLearningsContent(version.learnings_content);
  }, [version.id, version.name, version.description, version.learnings_content]);

  // Collapsible sections state
  const [expandedSection, setExpandedSection] = useState<'scope' | 'okrs' | 'learnings' | 'tasks' | null>('okrs');

  const handleNameSave = () => {
    if (editedName.trim() && editedName !== version.name) {
      updateVersion(version.id, { name: editedName.trim() });
    }
    setIsEditingName(false);
  };

  const handleColorChange = (color: string) => {
    updateVersion(version.id, { color });
  };

  const handleStatusChange = (status: VersionStatus) => {
    setVersionStatus(version.id, status);
  };

  const handleTypeLabelChange = (type_label: VersionTypeLabel) => {
    updateVersion(version.id, { type_label });
  };

  const handleScopeBlur = () => {
    if (scopeContent !== version.description) {
      updateVersion(version.id, { description: scopeContent });
    }
  };

  const handleLearningsBlur = () => {
    if (learningsContent !== version.learnings_content) {
      updateVersion(version.id, { learnings_content: learningsContent });
    }
  };

  const handleStartDateChange = (date: Date | undefined) => {
    updateVersion(version.id, { started_at: date?.toISOString() });
  };

  const handleTargetDateChange = (date: Date | undefined) => {
    updateVersion(version.id, { targetDate: date?.toISOString() });
  };

  const handleDelete = () => {
    deleteVersion(version.id);
  };

  const toggleSection = (section: 'scope' | 'okrs' | 'learnings' | 'tasks') => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Show learnings only when version is testing or complete
  const showLearnings = version.status === 'testing' || version.status === 'complete';

  // Color palette with radial gradient pairs [base, highlight]
  const colorPalette: { base: string; label: string }[] = [
    { base: '#8B5CF6', label: 'Purple' },
    { base: '#3B82F6', label: 'Blue' },
    { base: '#10B981', label: 'Green' },
    { base: '#F59E0B', label: 'Amber' },
    { base: '#EF4444', label: 'Red' },
    { base: '#EC4899', label: 'Pink' },
    { base: '#6366F1', label: 'Indigo' },
    { base: '#14B8A6', label: 'Teal' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        {/* Version Name */}
        <div className="flex items-center gap-3">
          {/* Color dot */}
          <div
            className="w-5 h-5 rounded-full flex-shrink-0 ring-2 ring-white/10"
            style={{
              background: `radial-gradient(circle at 35% 35%, ${version.color}ff, ${version.color}60 60%, ${version.color}20)`,
              boxShadow: `0 0 10px ${version.color}50`,
            }}
          />
          {isEditingName ? (
            <Input
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSave();
                if (e.key === 'Escape') {
                  setEditedName(version.name);
                  setIsEditingName(false);
                }
              }}
              className="text-2xl font-semibold bg-white/5 border-white/20 flex-1"
              autoFocus
            />
          ) : (
            <h1
              className="text-2xl font-semibold text-white/90 cursor-pointer hover:text-white flex-1"
              onClick={() => setIsEditingName(true)}
            >
              {version.name}
            </h1>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Color Picker — radial gradient dots */}
        <div className="space-y-2">
          <Label className="text-white/70 text-sm">Version Color</Label>
          <div className="flex gap-2">
            {colorPalette.map(({ base, label }) => (
              <button
                key={base}
                onClick={() => handleColorChange(base)}
                title={label}
                className={cn(
                  'w-8 h-8 rounded-full border-2 transition-all',
                  version.color === base
                    ? 'border-white scale-110 shadow-lg'
                    : 'border-transparent hover:scale-105'
                )}
                style={{
                  background: `radial-gradient(circle at 35% 35%, ${base}ff, ${base}80 55%, ${base}30)`,
                  boxShadow: version.color === base ? `0 0 12px ${base}80` : undefined,
                }}
              />
            ))}
          </div>
        </div>

        {/* Type Label */}
        <div className="space-y-2">
          <Label className="text-white/70 text-sm">Type Label</Label>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_TYPE_LABELS.map((label) => (
              <button
                key={label}
                onClick={() => handleTypeLabelChange(label)}
                className={cn(
                  'px-3 py-1.5 rounded text-xs font-medium transition-all border',
                  version.type_label === label
                    ? 'border-white/40 shadow-lg scale-105'
                    : 'border-white/10 hover:border-white/20 hover:scale-105'
                )}
                style={{
                  backgroundColor: version.type_label === label
                    ? TYPE_LABEL_COLORS[label]
                    : `${TYPE_LABEL_COLORS[label]}20`,
                  color: version.type_label === label ? 'white' : 'rgba(255, 255, 255, 0.7)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Version Status */}
        <div className="space-y-2">
          <Label className="text-white/70 text-sm">Version Status</Label>
          <div className="flex gap-2">
            {(['draft', 'active', 'testing', 'complete'] as const).map((status) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                className={cn(
                  'flex-1 px-3 py-2 rounded text-xs font-medium transition-all border capitalize',
                  version.status === status
                    ? 'border-white/40 bg-white/10 text-white shadow-lg'
                    : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/10'
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Date Fields */}
        <div className="flex gap-3">
          {/* Start Date */}
          <div className="flex-1">
            <Label className="text-white/50 text-xs uppercase tracking-wider mb-2 block">Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left h-auto px-4 py-3 bg-white/5 hover:bg-white/10 border-white/10 hover:border-blue-400/40',
                    !version.started_at && 'text-white/40'
                  )}
                >
                  <CalendarIcon className="mr-3 h-5 w-5 text-blue-400" />
                  <div className="flex flex-col items-start">
                    {version.started_at ? (
                      <>
                        <span className="text-xs text-white/40 uppercase tracking-wider">Starts</span>
                        <span className="text-sm font-medium text-white/90">{format(new Date(version.started_at), 'MMM d, yyyy')}</span>
                      </>
                    ) : (
                      <span className="text-sm">Set start date</span>
                    )}
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={version.started_at ? new Date(version.started_at) : undefined}
                  onSelect={handleStartDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Target Date */}
          <div className="flex-1">
            <Label className="text-white/50 text-xs uppercase tracking-wider mb-2 block">Target Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left h-auto px-4 py-3 bg-white/5 hover:bg-white/10 border-white/10 hover:border-amber-400/40',
                    !version.targetDate && 'text-white/40'
                  )}
                >
                  <CalendarIcon className="mr-3 h-5 w-5 text-amber-400" />
                  <div className="flex flex-col items-start">
                    {version.targetDate ? (
                      <>
                        <span className="text-xs text-white/40 uppercase tracking-wider">Due</span>
                        <span className="text-sm font-medium text-white/90">{format(new Date(version.targetDate), 'MMM d, yyyy')}</span>
                      </>
                    ) : (
                      <span className="text-sm">Set target date</span>
                    )}
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={version.targetDate ? new Date(version.targetDate) : undefined}
                  onSelect={handleTargetDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Collapsible Sections */}
      <div className="space-y-2">
        {/* OKRs Section - PRIMARY SECTION */}
        <CollapsibleSection
          title="OKRs (Objectives & Key Results)"
          icon={<Target className="w-4 h-4" />}
          isExpanded={expandedSection === 'okrs'}
          onToggle={() => toggleSection('okrs')}
          isPrimary={true}
        >
          <OKRManager versionId={version.id} />
        </CollapsibleSection>

        {/* Scope / PRD Section */}
        <CollapsibleSection
          title="Scope & PRD"
          icon={<FileText className="w-4 h-4" />}
          isExpanded={expandedSection === 'scope'}
          onToggle={() => toggleSection('scope')}
        >
          <Textarea
            value={scopeContent}
            onChange={(e) => setScopeContent(e.target.value)}
            onBlur={handleScopeBlur}
            placeholder="Document the goals, features, and requirements for this version..."
            className="min-h-[200px] bg-white/5 border-white/20 font-mono text-sm"
          />
        </CollapsibleSection>

        {/* Learnings & Retrospective — only shown when testing or complete */}
        {showLearnings && (
          <CollapsibleSection
            title="Learnings & Retrospective"
            icon={<Lightbulb className="w-4 h-4" />}
            isExpanded={expandedSection === 'learnings'}
            onToggle={() => toggleSection('learnings')}
          >
            <Textarea
              value={learningsContent}
              onChange={(e) => setLearningsContent(e.target.value)}
              onBlur={handleLearningsBlur}
              placeholder="What did we learn from this version?&#10;&#10;- What went well?&#10;- What could be improved?&#10;- Key insights for next iteration..."
              className="min-h-[200px] bg-white/5 border-white/20 font-mono text-sm"
            />
          </CollapsibleSection>
        )}

        {/* Related Tasks */}
        <CollapsibleSection
          title={`Related Tasks (${versionTasks.length})`}
          icon={<CheckSquare className="w-4 h-4" />}
          isExpanded={expandedSection === 'tasks'}
          onToggle={() => toggleSection('tasks')}
        >
          <div className="space-y-2">
            {versionTasks.length === 0 ? (
              <div className="text-white/40 text-sm text-center py-4">
                No tasks tagged with this version yet
              </div>
            ) : (
              versionTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  {task.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-white/40 shrink-0" />
                  )}
                  <span className={cn(
                    "text-sm flex-1",
                    task.status === 'completed' ? "text-white/60 line-through" : "text-white/90"
                  )}>
                    {task.title}
                  </span>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded",
                    task.status === 'completed' && "bg-green-500/20 text-green-400",
                    task.status === 'in_progress' && "bg-blue-500/20 text-blue-400",
                    task.status === 'blocked' && "bg-red-500/20 text-red-400",
                    task.status === 'not_started' && "bg-gray-500/20 text-gray-400"
                  )}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
              ))
            )}
          </div>
        </CollapsibleSection>
      </div>

      <DeleteConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Version"
        description={`Are you sure you want to delete "${version.name}"? All tagged tasks will become unversioned. This action cannot be undone.`}
      />
    </div>
  );
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  isPrimary?: boolean;
}

function CollapsibleSection({ title, icon, isExpanded, onToggle, children, isPrimary = false }: CollapsibleSectionProps) {
  return (
    <div
      className={cn(
        'rounded-lg overflow-hidden transition-all',
        isPrimary
          ? 'border-2 border-blue-500/30 bg-blue-950/20 shadow-lg shadow-blue-500/10'
          : 'border border-white/10 bg-black/20'
      )}
    >
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 transition-colors',
          isPrimary
            ? 'hover:bg-blue-500/10 bg-blue-950/30'
            : 'hover:bg-white/5'
        )}
      >
        {isExpanded ? (
          <ChevronDown className={cn('w-4 h-4', isPrimary ? 'text-blue-400' : 'text-white/60')} />
        ) : (
          <ChevronRight className={cn('w-4 h-4', isPrimary ? 'text-blue-400' : 'text-white/60')} />
        )}
        {icon}
        <span className={cn('font-medium text-sm', isPrimary ? 'text-blue-300' : 'text-white/90')}>
          {title}
        </span>
        {isPrimary && (
          <span className="ml-auto px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300">
            Primary
          </span>
        )}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}
