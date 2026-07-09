"use client";

import { cn } from "@/lib/utils";
import { projectColor, type MasterPlanProject } from "./shared";

interface ProjectFilterBarProps {
  projects: MasterPlanProject[];
  hiddenProjectIds: Set<string>;
  onToggle: (projectId: string) => void;
  counts: Record<string, number>;
}

/**
 * Show/hide-by-project toggle pills. Rendered once at the Master Plan page
 * level (not per-view) so hiding a project applies consistently no matter
 * which view (Table/Kanban/List/Timeline/Calendar) is active.
 */
export function ProjectFilterBar({ projects, hiddenProjectIds, onToggle, counts }: ProjectFilterBarProps) {
  if (projects.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-4">
      <span className="text-xs text-white/40 mr-1">Projects</span>
      {projects.map((p) => {
        const isHidden = hiddenProjectIds.has(p.id);
        return (
          <button
            key={p.id}
            onClick={() => onToggle(p.id)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all",
              isHidden
                ? "opacity-40 border-white/10 bg-white/[0.02] text-white/40"
                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
            )}
            title={isHidden ? `Show ${p.name}` : `Hide ${p.name}`}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: projectColor(p.id) }} />
            {p.name}
            <span className="text-white/30">{counts[p.id] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}
