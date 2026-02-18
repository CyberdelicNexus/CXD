'use client';

import React, { useState, useEffect } from 'react';
import { useCXDStore } from '@/store/cxd-store';
import type { Version, VersionStatus, VersionTypeLabel } from '@/types/version-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  Calendar as CalendarIcon,
  Trash2,
  FileText,
  Target,
  Lightbulb,
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

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(version.name);

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
  const [expandedSection, setExpandedSection] = useState<'scope' | 'okrs' | 'learnings' | null>('okrs');

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

  const handleTargetDateChange = (date: Date | undefined) => {
    updateVersion(version.id, { targetDate: date?.toISOString() });
  };

  const handleDelete = () => {
    if (confirm(`Delete version "${version.name}"? All tagged tasks will become unversioned.`)) {
      deleteVersion(version.id);
    }
  };

  const toggleSection = (section: 'scope' | 'okrs' | 'learnings') => {
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
            onClick={handleDelete}
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

        {/* Target Date */}
        <div className="space-y-2">
          <Label className="text-white/70 text-sm">Target Release Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !version.targetDate && 'text-white/40'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {version.targetDate ? (
                  format(new Date(version.targetDate), 'PPP')
                ) : (
                  <span>Set target date</span>
                )}
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
      </div>
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
