"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Milestone } from "lucide-react";
import { cn } from "@/lib/utils";
import { VersionTaskList } from "@/components/cxd/plan/version-task-list";
import { TYPE_LABEL_COLORS, calculateOKRProgress } from "@/types/version-types";
import type { OKR } from "@/types/version-types";
import type { MasterPlanVersionItem } from "@/app/api/master-plan/versions/route";
import { projectColor, type MasterPlanTaskItem } from "./shared";

interface MasterPlanRoadmapViewProps {
  versionItems: MasterPlanVersionItem[];
  okrs: (OKR & { projectId: string })[];
  items: MasterPlanTaskItem[];
  hiddenProjectIds: Set<string>;
  onTaskClick: (item: MasterPlanTaskItem) => void;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "text-white/40 border-white/10",
  active: "text-blue-300 border-blue-500/30",
  testing: "text-amber-300 border-amber-500/30",
  complete: "text-emerald-300 border-emerald-500/30",
};

/**
 * Cross-project counterpart to the single-project Roadmap tab (versions-view.tsx).
 * Scope note: read-only for version fields themselves (status/dates/OKRs) — the
 * single-project VersionDetailPanel that edits those calls useCXDStore directly
 * (updateVersion/deleteVersion/setVersionStatus, all bound to whatever project
 * happens to be loaded in the live store), which has no safe cross-project
 * equivalent yet without a dedicated version-patch API mirroring the task one.
 * Tasks linked to a version ARE fully editable here (VersionTaskList → the same
 * task detail panel + write path every other Master Plan view uses).
 */
export function MasterPlanRoadmapView({ versionItems, okrs, items, hiddenProjectIds, onTaskClick }: MasterPlanRoadmapViewProps) {
  const router = useRouter();
  const visibleVersionItems = useMemo(
    () => versionItems.filter((v) => !hiddenProjectIds.has(v.projectId)),
    [versionItems, hiddenProjectIds]
  );

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: MasterPlanVersionItem[] }>();
    for (const v of visibleVersionItems) {
      if (!map.has(v.projectId)) map.set(v.projectId, { name: v.projectName, items: [] });
      map.get(v.projectId)!.items.push(v);
    }
    Array.from(map.values()).forEach((group) => {
      group.items.sort((a, b) => a.version.order - b.version.order);
    });
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
  }, [visibleVersionItems]);

  const [selected, setSelected] = useState<{ projectId: string; versionId: string } | null>(null);
  const selectedEntry = useMemo(
    () => (selected ? visibleVersionItems.find((v) => v.projectId === selected.projectId && v.version.id === selected.versionId) || null : null),
    [selected, visibleVersionItems]
  );

  const versionTasks = useMemo(() => {
    if (!selectedEntry) return [];
    return items
      .filter((it) => it.projectId === selectedEntry.projectId && it.task.taskMetadata?.versionId === selectedEntry.version.id)
      .map((it) => it.task);
  }, [items, selectedEntry]);

  const versionOKRs = useMemo(() => {
    if (!selectedEntry) return [];
    return okrs.filter((okr) => okr.projectId === selectedEntry.projectId && okr.versionId === selectedEntry.version.id);
  }, [okrs, selectedEntry]);

  if (visibleVersionItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-[600px] text-center">
        <div className="space-y-2">
          <Milestone className="w-10 h-10 text-white/20 mx-auto" />
          <p className="text-white/40">No versions yet</p>
          <p className="text-white/30 text-sm max-w-sm">Create a version in any project's Roadmap tab to start planning releases here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[720px]">
      <div className="w-[30%] border-r border-white/10 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.id}>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] sticky top-0">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: projectColor(group.id) }} />
              <span className="text-sm font-semibold text-white/80">{group.name}</span>
              <button
                onClick={() => router.push(`/cxd/overview/${group.id}`)}
                className="ml-auto text-white/20 hover:text-white/50 transition-colors"
                title="Open project"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
            {group.items.map(({ version, projectId }) => {
              const isSelected = selected?.projectId === projectId && selected?.versionId === version.id;
              return (
                <div
                  key={version.id}
                  onClick={() => setSelected({ projectId, versionId: version.id })}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 pl-8 cursor-pointer border-l-2 transition-colors",
                    isSelected ? "bg-violet-500/10 border-violet-400" : "border-transparent hover:bg-white/5"
                  )}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: version.color }} />
                  <span className="text-sm text-white/85 truncate flex-1">{version.name}</span>
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded border flex-shrink-0"
                    style={{ borderColor: TYPE_LABEL_COLORS[version.type_label], color: TYPE_LABEL_COLORS[version.type_label] }}
                  >
                    {version.type_label}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {selectedEntry ? (
          <div className="flex flex-col h-full">
            <div className="px-4 py-3 border-b border-white/10 bg-black/40 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: selectedEntry.version.color }} />
                <h2 className="text-white/90 font-medium">{selectedEntry.version.name}</h2>
                <span className={cn("text-[10px] uppercase px-2 py-0.5 rounded-full border", STATUS_STYLES[selectedEntry.version.status])}>
                  {selectedEntry.version.status}
                </span>
              </div>
              {selectedEntry.version.description && <p className="text-xs text-white/50 line-clamp-2">{selectedEntry.version.description}</p>}
              <div className="flex items-center gap-3 text-xs text-white/40">
                {selectedEntry.version.targetDate && <span>Target {new Date(selectedEntry.version.targetDate).toLocaleDateString()}</span>}
                {versionOKRs.length > 0 && (
                  <span>{versionOKRs.length} OKR{versionOKRs.length === 1 ? "" : "s"}, avg {Math.round(versionOKRs.reduce((sum, o) => sum + calculateOKRProgress(o), 0) / versionOKRs.length)}% complete</span>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <VersionTaskList
                version={selectedEntry.version}
                tasks={versionTasks}
                onTaskClick={(taskId) => {
                  const item = items.find((it) => it.projectId === selectedEntry.projectId && it.task.id === taskId);
                  if (item) onTaskClick(item);
                }}
                onTaskNavigate={() => router.push(`/cxd/overview/${selectedEntry.projectId}`)}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-white/40 text-sm">Select a version to view its tasks</div>
        )}
      </div>
    </div>
  );
}
