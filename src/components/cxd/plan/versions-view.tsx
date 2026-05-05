'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useCXDStore } from '@/store/cxd-store';
import { VersionTimeline } from './version-timeline';
import { VersionDetailPanel } from './version-detail-panel';
import { VersionTaskList } from './version-task-list';
import type { Version } from '@/types/version-types';
import type { TaskProjection } from '@/types/plan-types';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface VersionsViewProps {
  tasks: TaskProjection[];
  onTaskClick: (taskId: string) => void;
  onTaskNavigate: (taskId: string) => void;
  onTaskUpdate: (taskId: string, updates: Partial<TaskProjection>) => void;
  onVersionSelect?: (versionId: string | null) => void;
}

export function VersionsView({
  tasks,
  onTaskClick,
  onTaskNavigate,
  onTaskUpdate,
  onVersionSelect,
}: VersionsViewProps) {
  const versions = useCXDStore((state) => state.getVersions());
  const addVersion = useCXDStore((state) => state.addVersion);

  const [selectedVersionId, setSelectedVersionIdInternal] = useState<string | null>(
    versions[0]?.id || null
  );

  const setSelectedVersionId = (id: string | null) => {
    setSelectedVersionIdInternal(id);
    onVersionSelect?.(id);
  };

  // Notify parent of initial selection on mount
  useEffect(() => {
    if (selectedVersionId) {
      onVersionSelect?.(selectedVersionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) || null,
    [versions, selectedVersionId]
  );

  const versionTasks = useMemo(
    () => {
      if (!selectedVersionId) return [];
      return tasks.filter((t) => t.taskMetadata?.versionId === selectedVersionId);
    },
    [tasks, selectedVersionId]
  );

  const handleAddVersion = () => {
    const newVersionId = addVersion(`v${versions.length + 1}.0`);
    setSelectedVersionId(newVersionId);
  };

  // Empty state
  if (versions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="text-white/40 text-lg">No versions yet</div>
          <p className="text-white/30 text-sm max-w-md">
            Create your first product version to start planning releases, tracking progress through stages,
            and aligning work with strategic objectives.
          </p>
          <Button onClick={handleAddVersion} className="gap-2">
            <Plus className="w-4 h-4" />
            Create First Version
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-black/20">
      {/* LEFT: Vertical Timeline (20% width) */}
      <div className="w-[20%] border-r border-white/10 flex flex-col bg-black/30">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40">
          <h2 className="text-white/90 font-medium text-sm">Releases</h2>
          <Button onClick={handleAddVersion} size="sm" variant="ghost" className="gap-1 h-7 px-2">
            <Plus className="w-3 h-3" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <VersionTimeline
            versions={versions}
            selectedVersionId={selectedVersionId}
            onVersionSelect={setSelectedVersionId}
          />
        </div>
      </div>

      {/* CENTER: Detail Panel (50% width) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {selectedVersion ? (
          <VersionDetailPanel version={selectedVersion} />
        ) : (
          <div className="flex items-center justify-center h-full text-white/40">
            Select a version to view details
          </div>
        )}
      </div>

      {/* RIGHT: Task List (30% width) */}
      <div className="w-[30%] border-l border-white/10 overflow-y-auto custom-scrollbar bg-black/20">
        {selectedVersion ? (
          <VersionTaskList
            version={selectedVersion}
            tasks={versionTasks}
            onTaskClick={onTaskClick}
            onTaskNavigate={onTaskNavigate}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-white/40">
            Select a version to view tasks
          </div>
        )}
      </div>
    </div>
  );
}
