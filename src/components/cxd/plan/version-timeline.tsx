'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { Version } from '@/types/version-types';
import { TYPE_LABEL_COLORS } from '@/types/version-types';

interface VersionTimelineProps {
  versions: Version[];
  selectedVersionId: string | null;
  onVersionSelect: (versionId: string) => void;
}

export function VersionTimeline({
  versions,
  selectedVersionId,
  onVersionSelect,
}: VersionTimelineProps) {
  // Sort versions by order to display as sequential chain
  const sortedVersions = [...versions].sort((a, b) => a.order - b.order);

  return (
    <div className="p-4 space-y-0">
      {sortedVersions.map((version, index) => (
        <React.Fragment key={version.id}>
          <VersionBlock
            version={version}
            isSelected={version.id === selectedVersionId}
            onClick={() => onVersionSelect(version.id)}
          />
          {index < sortedVersions.length - 1 && (
            <ProgressConnector
              currentVersion={version}
              nextVersion={sortedVersions[index + 1]}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

interface VersionBlockProps {
  version: Version;
  isSelected: boolean;
  onClick: () => void;
}

function VersionBlock({ version, isSelected, onClick }: VersionBlockProps) {
  // Ghost gradients - subtle and blend with UI
  const statusGradients = {
    draft: 'linear-gradient(135deg, rgba(75, 85, 99, 0.15) 0%, rgba(107, 114, 128, 0.08) 100%)',
    active: 'linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(59, 130, 246, 0.12) 100%)',
    testing: 'linear-gradient(135deg, rgba(217, 119, 6, 0.2) 0%, rgba(245, 158, 11, 0.12) 100%)',
    complete: 'linear-gradient(135deg, rgba(5, 150, 105, 0.2) 0%, rgba(16, 185, 129, 0.12) 100%)',
  };

  const statusBorderColors = {
    draft: 'rgba(107, 114, 128, 0.25)',
    active: 'rgba(59, 130, 246, 0.3)',
    testing: 'rgba(245, 158, 11, 0.3)',
    complete: 'rgba(16, 185, 129, 0.3)',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-lg transition-all duration-200 overflow-hidden',
        'hover:scale-[1.02] hover:shadow-lg',
        isSelected && 'scale-[1.02] shadow-xl ring-2 ring-white/30'
      )}
      style={{
        background: statusGradients[version.status],
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: statusBorderColors[version.status],
      }}
    >
      <div className="p-3 space-y-2">
        {/* Version Name + Color Dot */}
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-white/10"
            style={{
              background: `radial-gradient(circle at 35% 35%, ${version.color}ff, ${version.color}70 55%, ${version.color}20)`,
              boxShadow: `0 0 6px ${version.color}60`,
            }}
          />
          <div className="text-white font-semibold text-sm text-left leading-tight">
            {version.name}
          </div>
        </div>

        {/* Type Label */}
        <div className="flex items-center gap-2">
          <div
            className="px-2 py-0.5 rounded text-[9px] font-bold text-white uppercase tracking-wider"
            style={{
              backgroundColor: TYPE_LABEL_COLORS[version.type_label],
              boxShadow: `0 0 8px ${TYPE_LABEL_COLORS[version.type_label]}40`,
            }}
          >
            {version.type_label}
          </div>
        </div>

        {/* Status Badge */}
        <div className="text-[10px] font-medium text-white/80 uppercase tracking-wide text-left">
          {version.status}
        </div>

        {/* Target Date */}
        {version.targetDate && (
          <div className="text-white/60 text-[10px] text-left">
            {new Date(version.targetDate).toLocaleDateString()}
          </div>
        )}
      </div>
    </button>
  );
}

interface ProgressConnectorProps {
  currentVersion: Version;
  nextVersion: Version;
}

function ProgressConnector({ currentVersion, nextVersion }: ProgressConnectorProps) {
  // Determine gradient based on status progression
  const getProgressGradient = () => {
    const statusColors = {
      draft: '#6B7280',
      active: '#3B82F6',
      testing: '#F59E0B',
      complete: '#10B981',
    };

    const currentColor = statusColors[currentVersion.status];
    const nextColor = statusColors[nextVersion.status];

    // If current is complete and next is not started, show progression
    if (currentVersion.status === 'complete') {
      return `linear-gradient(180deg, ${currentColor} 0%, ${nextColor} 100%)`;
    }

    // If current is in progress, fade out
    if (currentVersion.status === 'active' || currentVersion.status === 'testing') {
      return `linear-gradient(180deg, ${currentColor} 0%, ${currentColor}40 50%, ${nextColor}20 100%)`;
    }

    // Default: subtle connection
    return `linear-gradient(180deg, ${currentColor}40 0%, ${nextColor}20 100%)`;
  };

  return (
    <div className="flex justify-center py-1">
      <div
        className="w-1 h-8 rounded-full relative"
        style={{
          background: getProgressGradient(),
        }}
      >
        {/* Progress dot in the middle */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
          style={{
            background: currentVersion.status === 'complete'
              ? '#10B981'
              : 'rgba(255, 255, 255, 0.3)',
            boxShadow: currentVersion.status === 'complete'
              ? '0 0 8px rgba(16, 185, 129, 0.6)'
              : 'none',
          }}
        />
      </div>
    </div>
  );
}
