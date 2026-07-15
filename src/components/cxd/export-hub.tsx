"use client";

import { useState, useCallback } from "react";
import {
  X,
  Download,
  Lock,
  FileText,
  FileSpreadsheet,
  Layers,
  ScrollText,
  Presentation,
  Users,
  Clapperboard,
  Share2,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCXDStore } from "@/store/cxd-store";
import { queryTasks } from "@/utils/task-engine";
import { ERDGenerator } from "./canvas/erd-generator";
import type { CXDProject } from "@/types/cxd-schema";
import type { CanvasElement } from "@/types/canvas-elements";
import type { TaskQuery, TaskProjection } from "@/types/plan-types";
import type { ExperienceFlowStageV2, EngagementDistribution } from "@/types/cxd-schema";

// ---------------------------------------------------------------------------
// Download helper — client-side Blob + anchor
// ---------------------------------------------------------------------------
function downloadTextFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slug(name: string): string {
  return (name || "Untitled").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// Data gathering — every task element, boards included (mirrors use-plan-tasks)
// ---------------------------------------------------------------------------
function gatherAllElements(project: CXDProject): CanvasElement[] {
  const elements: CanvasElement[] = [...(project.canvasLayout?.elements || [])];
  for (const board of project.canvasLayout?.boards || []) {
    elements.push(...(board.nodes || []));
  }
  return elements;
}

const TASK_QUERY: TaskQuery = {
  filter: {
    showCompleted: true,
    includeImplicitTasks: true,
    includeExplicitTasks: true,
    includeTaggedCards: true,
  },
  sort: [
    { field: "priority", direction: "desc" },
    { field: "dueDate", direction: "asc" },
  ],
};

function getProjectTasks(project: CXDProject): TaskProjection[] {
  const elements = gatherAllElements(project);
  return queryTasks(elements, TASK_QUERY).tasks;
}

// ---------------------------------------------------------------------------
// Run-of-Show Script (.md)
// ---------------------------------------------------------------------------
const ENGAGEMENT_LABELS: Record<keyof EngagementDistribution, string> = {
  observer: "Observer",
  engager: "Engager",
  coCreator: "Co-Creator",
  architect: "Architect",
};

function dominantEngagement(dist?: EngagementDistribution): string {
  if (!dist) return "—";
  const entries = Object.entries(dist) as [keyof EngagementDistribution, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const [key, val] = entries[0];
  if (!val) return "—";
  return `${ENGAGEMENT_LABELS[key]} (${val}%)`;
}

function buildRunOfShowMarkdown(project: CXDProject, stages: ExperienceFlowStageV2[]): string {
  const projectName = project.name || project.intentionCore?.projectName || "Untitled";
  const lines: string[] = [];

  const totalMinutes = stages.reduce((sum, s) => sum + (s.estimatedMinutes || 0), 0);

  lines.push(`# Run-of-Show — ${projectName}`);
  lines.push("");
  lines.push(`_Generated ${todayISO()}_`);
  lines.push("");
  if (totalMinutes > 0) {
    lines.push(`**Total estimated runtime:** ${totalMinutes} min`);
    lines.push("");
  }
  lines.push(`**Stages:** ${stages.length}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  stages.forEach((stage, i) => {
    lines.push(`## ${i + 1}. ${stage.name || `Stage ${i + 1}`}`);
    lines.push("");
    lines.push(
      `- **Duration:** ${stage.estimatedMinutes != null ? `${stage.estimatedMinutes} min` : "—"}`,
    );
    lines.push(`- **Engagement:** ${dominantEngagement(stage.engagementDistribution)}`);
    lines.push("");
    lines.push("**Narrative notes**");
    lines.push("");
    lines.push(stage.narrativeNotes?.trim() ? stage.narrativeNotes.trim() : "_None_");
    lines.push("");
    lines.push("**Design intent**");
    lines.push("");
    lines.push(stage.designIntent?.trim() ? stage.designIntent.trim() : "_None_");
    lines.push("");
    lines.push("---");
    lines.push("");
  });

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Production Pack — Task CSV
// ---------------------------------------------------------------------------
function escapeCSV(value: string | number | undefined | null): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Completed",
};

function fmtDate(iso?: string): string {
  if (!iso) return "";
  return iso.split("T")[0];
}

function buildTasksCSV(project: CXDProject, tasks: TaskProjection[]): string {
  const versionNameById = new Map<string, string>();
  for (const v of project.versions || []) versionNameById.set(v.id, v.name);

  const headers = [
    "Title",
    "Status",
    "Priority",
    "Due date",
    "Start date",
    "Assignee",
    "Estimated hours",
    "Version",
    "Subtask progress",
  ];

  const rows = tasks.map((t) => {
    const versionId = t.taskMetadata?.versionId;
    const versionName = versionId ? versionNameById.get(versionId) || "" : "";
    const progress =
      t.totalSubtasks > 0
        ? `${t.completedSubtasks}/${t.totalSubtasks} (${t.completionPercent}%)`
        : "";
    return [
      escapeCSV(t.title),
      escapeCSV(STATUS_LABELS[t.status] || t.status),
      escapeCSV(t.priority || ""),
      escapeCSV(fmtDate(t.dueDate)),
      escapeCSV(fmtDate(t.startDate)),
      escapeCSV(t.assignee || ""),
      escapeCSV(t.estimatedHours ?? ""),
      escapeCSV(versionName),
      escapeCSV(progress),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\r\n");
}

// ---------------------------------------------------------------------------
// Production Pack — Versions / Milestones summary (.md)
// ---------------------------------------------------------------------------
function buildVersionsMarkdown(project: CXDProject, tasks: TaskProjection[]): string {
  const projectName = project.name || project.intentionCore?.projectName || "Untitled";
  const versions = [...(project.versions || [])].sort((a, b) => a.order - b.order);
  const okrs = project.okrs || [];

  const lines: string[] = [];
  lines.push(`# Versions & Milestones — ${projectName}`);
  lines.push("");
  lines.push(`_Generated ${todayISO()}_`);
  lines.push("");

  if (versions.length === 0) {
    lines.push("_No versions defined yet._");
    return lines.join("\n");
  }

  // Task counts per version
  const countsByVersion = new Map<string, { total: number; done: number }>();
  for (const t of tasks) {
    const vid = t.taskMetadata?.versionId;
    if (!vid) continue;
    const c = countsByVersion.get(vid) || { total: 0, done: 0 };
    c.total += 1;
    if (t.status === "completed") c.done += 1;
    countsByVersion.set(vid, c);
  }

  versions.forEach((v) => {
    lines.push(`## ${v.name}`);
    lines.push("");
    lines.push(`- **Type:** ${v.type_label}`);
    lines.push(`- **Status:** ${v.status}`);
    if (v.targetDate) lines.push(`- **Target date:** ${fmtDate(v.targetDate)}`);

    const counts = countsByVersion.get(v.id);
    if (counts) {
      const pct = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;
      lines.push(`- **Tasks:** ${counts.done}/${counts.total} complete (${pct}%)`);
    }

    const versionOkrs = okrs.filter((o) => o.versionId === v.id);
    if (versionOkrs.length > 0) {
      lines.push(`- **OKRs:** ${versionOkrs.length}`);
    }

    if (v.description?.trim()) {
      lines.push("");
      lines.push("**Scope**");
      lines.push("");
      lines.push(v.description.trim());
    }

    if (versionOkrs.length > 0) {
      lines.push("");
      lines.push("**Objectives**");
      lines.push("");
      versionOkrs.forEach((okr) => {
        okr.objectives.forEach((obj) => {
          lines.push(`- ${obj.title}`);
          obj.keyResults.forEach((kr) => {
            lines.push(`  - [${kr.completed ? "x" : " "}] ${kr.description}`);
          });
        });
      });
    }

    lines.push("");
    lines.push("---");
    lines.push("");
  });

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Card + group presentation
// ---------------------------------------------------------------------------
type CardAction = { label: string; onClick: () => void };

interface ArtifactCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accent: string; // tailwind text color class for icon
  actions?: CardAction[];
  comingSoon?: boolean;
}

function ArtifactCard({
  icon: Icon,
  title,
  description,
  accent,
  actions,
  comingSoon,
}: ArtifactCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border p-4 transition-all",
        comingSoon
          ? "border-white/[0.06] bg-white/[0.015] opacity-60"
          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/20",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.04] border border-white/10",
          )}
        >
          <Icon className={cn("h-4 w-4", comingSoon ? "text-white/30" : accent)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-white truncate">{title}</h4>
            {comingSoon && (
              <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/40">
                <Lock className="h-2.5 w-2.5" />
                Soon
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-white/50">{description}</p>
        </div>
      </div>

      {actions && actions.length > 0 && !comingSoon && (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className="flex items-center gap-1.5 rounded-lg bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-500/25"
            >
              <Download className="h-3 w-3" />
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const GROUP_STYLES: Record<string, { label: string; dot: string; hint: string }> = {
  Sell: { label: "Sell", dot: "bg-rose-400", hint: "Win buy-in and align stakeholders" },
  Build: { label: "Build", dot: "bg-violet-400", hint: "Hand off to the people making it" },
  Run: { label: "Run", dot: "bg-cyan-400", hint: "Deliver the experience on the day" },
  Living: { label: "Living", dot: "bg-emerald-400", hint: "Always-current links & feeds" },
};

function GroupHeader({ group }: { group: keyof typeof GROUP_STYLES }) {
  const s = GROUP_STYLES[group];
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className={cn("h-2 w-2 rounded-full", s.dot)} />
      <h3 className="text-sm font-semibold text-white">{s.label}</h3>
      <span className="text-xs text-white/35">{s.hint}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export Hub
// ---------------------------------------------------------------------------
interface ExportHubProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenShare?: () => void;
}

export function ExportHub({ isOpen, onClose, onOpenShare }: ExportHubProps) {
  const getCurrentProject = useCXDStore((s) => s.getCurrentProject);
  const getExperienceFlowStages = useCXDStore((s) => s.getExperienceFlowStages);
  const project = getCurrentProject();

  const [erdOpen, setErdOpen] = useState(false);

  const projectName = project?.name || project?.intentionCore?.projectName || "Untitled";

  const handleRunOfShow = useCallback(() => {
    const proj = useCXDStore.getState().getCurrentProject();
    if (!proj) return;
    const stages = useCXDStore.getState().getExperienceFlowStages();
    const md = buildRunOfShowMarkdown(proj, stages);
    downloadTextFile(md, `Run-of-Show-${slug(proj.name)}.md`, "text/markdown");
  }, []);

  const handleTasksCSV = useCallback(() => {
    const proj = useCXDStore.getState().getCurrentProject();
    if (!proj) return;
    const tasks = getProjectTasks(proj);
    const csv = buildTasksCSV(proj, tasks);
    downloadTextFile(csv, `Production-Pack-Tasks-${slug(proj.name)}.csv`, "text/csv");
  }, []);

  const handleVersionsMD = useCallback(() => {
    const proj = useCXDStore.getState().getCurrentProject();
    if (!proj) return;
    const tasks = getProjectTasks(proj);
    const md = buildVersionsMarkdown(proj, tasks);
    downloadTextFile(md, `Production-Pack-Versions-${slug(proj.name)}.md`, "text/markdown");
  }, []);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center pt-20">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        {/* Panel */}
        <div className="relative mx-4 flex max-h-[calc(88vh-5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/95 shadow-2xl backdrop-blur-xl">
          {/* Glass top hairline */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* Header */}
          <div className="flex flex-shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-500/20">
                <Download className="h-4 w-4 text-violet-300" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Export &amp; Deliverables</h2>
                <p className="text-xs text-white/45">{projectName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5" style={{ scrollbarWidth: "thin" }}>
            {/* Sell */}
            <section className="mb-6">
              <GroupHeader group="Sell" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ArtifactCard
                  icon={Presentation}
                  title="Pitch One-Pager"
                  description="A concise concept sell: intention, desired change, personas and imagery on a single page."
                  accent="text-rose-300"
                  comingSoon
                />
              </div>
            </section>

            {/* Build */}
            <section className="mb-6">
              <GroupHeader group="Build" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ArtifactCard
                  icon={FileText}
                  title="Experience Requirement Document"
                  description="Full ERD across all six dimensions — the authoritative spec for whoever builds this."
                  accent="text-violet-300"
                  actions={[{ label: "Open generator", onClick: () => setErdOpen(true) }]}
                />
                <ArtifactCard
                  icon={FileSpreadsheet}
                  title="Production Pack"
                  description="Every task as a spreadsheet plus a versions & milestones summary — the plan, ready to work."
                  accent="text-violet-300"
                  actions={[
                    { label: "Tasks .csv", onClick: handleTasksCSV },
                    { label: "Versions .md", onClick: handleVersionsMD },
                  ]}
                />
                <ArtifactCard
                  icon={Users}
                  title="Role-Scoped Briefs"
                  description="Per-discipline exports filtered by hypercube face — each collaborator gets only what they own."
                  accent="text-violet-300"
                  comingSoon
                />
              </div>
            </section>

            {/* Run */}
            <section className="mb-6">
              <GroupHeader group="Run" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ArtifactCard
                  icon={ScrollText}
                  title="Run-of-Show Script"
                  description="Ordered flow stages with timing, engagement and notes — the minute-by-minute for the day."
                  accent="text-cyan-300"
                  actions={[{ label: "Download .md", onClick: handleRunOfShow }]}
                />
                <ArtifactCard
                  icon={Clapperboard}
                  title="Facilitation & State-Care Sheet"
                  description="State/trait intensity curve with consent and integration notes for the facilitator."
                  accent="text-cyan-300"
                  comingSoon
                />
              </div>
            </section>

            {/* Living */}
            <section>
              <GroupHeader group="Living" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ArtifactCard
                  icon={Share2}
                  title="Share Link"
                  description="A read-only live view of this canvas — always reflects the latest state."
                  accent="text-emerald-300"
                  actions={
                    onOpenShare
                      ? [{ label: "Share settings", onClick: onOpenShare }]
                      : undefined
                  }
                />
                <ArtifactCard
                  icon={CalendarDays}
                  title="Calendar Feed"
                  description="Subscribe to task due dates and milestones as an ICS feed in your calendar."
                  accent="text-emerald-300"
                  comingSoon
                />
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* ERD generator — relocated here as an additional door (Map view keeps its own) */}
      <ERDGenerator
        projectId={project?.id || ""}
        isOpen={erdOpen}
        onClose={() => setErdOpen(false)}
      />
    </>
  );
}
