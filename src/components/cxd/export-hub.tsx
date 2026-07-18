"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Download,
  Lock,
  FileText,
  FileSpreadsheet,
  Presentation,
  Users,
  Clapperboard,
  Share2,
  CalendarDays,
  GanttChartSquare,
  ImagePlus,
  Printer,
  Sparkles,
  Eye,
  Settings2,
  Loader2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCXDStore } from "@/store/cxd-store";
import { queryTasks } from "@/utils/task-engine";
import { ERDGenerator } from "./canvas/erd-generator";
import { CalendarSyncDialog } from "@/components/calendar-sync-dialog";
import { ROLE_BUNDLES, buildRoleBriefMarkdown } from "@/lib/exports/role-briefs";
import { buildFacilitationMarkdown } from "@/lib/exports/facilitation-sheet";
import { buildPitchHTML, buildPitchDeckHTML } from "@/lib/exports/pitch-one-pager";
import { buildHtmlDoc, markdownToHtml } from "@/lib/exports/html-doc";
import { buildExperienceFlowTimelineHTML } from "@/lib/exports/experience-flow-timeline";
import { generatePitch } from "@/lib/ai/pitch-generation-service";
import {
  PITCH_MAX_PROMPT_LEN,
  type PitchSectionKind,
  type PitchSection,
  type PitchBuilderOptions,
} from "@/lib/ai/pitch-generation";
import type { CXDProject } from "@/types/cxd-schema";
import { HYPERCUBE_FACE_TAGS, type HypercubeFaceTag } from "@/types/canvas-elements";
import type { CanvasElement } from "@/types/canvas-elements";
import type { TaskQuery, TaskProjection } from "@/types/plan-types";
import type { ExperienceFlowStageV2, EngagementDistribution } from "@/types/cxd-schema";

// ---------------------------------------------------------------------------
// Download helpers (client-side Blob + anchor)
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

/** Render a markdown artifact through the shared styled-HTML doc wrapper and download it. */
function downloadMarkdownAsHtmlDoc(
  md: string,
  projectName: string,
  artifactTitle: string,
  filename: string,
) {
  const html = buildHtmlDoc({
    projectName,
    artifactTitle,
    bodyHtml: markdownToHtml(md),
  });
  downloadTextFile(html, filename, "text/html");
}

/** Open a generated HTML document in a new window and trigger the print dialog. */
function openAndPrintHtml(html: string, fallbackFilename: string) {
  const win = window.open("", "_blank");
  if (!win) {
    // Popup blocked: fall back to downloading the file so nothing is lost.
    downloadTextFile(html, fallbackFilename, "text/html");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  // Give the new document a beat to lay out before printing.
  setTimeout(() => {
    try {
      win.print();
    } catch {
      // The user can still print from the opened page.
    }
  }, 600);
}

/** Open a generated HTML document in a new window for preview (no auto-print). */
function openHtmlInNewWindow(html: string, fallbackFilename: string) {
  const win = window.open("", "_blank");
  if (!win) {
    downloadTextFile(html, fallbackFilename, "text/html");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
}

function slug(name: string): string {
  return (name || "Untitled").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// Data gathering: every task element, boards included (mirrors use-plan-tasks)
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
// Experience Flow Timeline (markdown fallback for power users)
// ---------------------------------------------------------------------------
const ENGAGEMENT_LABELS: Record<keyof EngagementDistribution, string> = {
  observer: "Observer",
  engager: "Engager",
  coCreator: "Co-Creator",
  architect: "Architect",
};

function dominantEngagement(dist?: EngagementDistribution): string {
  if (!dist) return "Not set";
  const entries = Object.entries(dist) as [keyof EngagementDistribution, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const [key, val] = entries[0];
  if (!val) return "Not set";
  return `${ENGAGEMENT_LABELS[key]} (${val}%)`;
}

function buildExperienceFlowMarkdown(
  project: CXDProject,
  stages: ExperienceFlowStageV2[],
): string {
  const projectName = project.name || project.intentionCore?.projectName || "Untitled";
  const lines: string[] = [];

  const totalMinutes = stages.reduce((sum, s) => sum + (s.estimatedMinutes || 0), 0);

  lines.push(`# Experience Flow Timeline: ${projectName}`);
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
      `- **Duration:** ${stage.estimatedMinutes != null ? `${stage.estimatedMinutes} min` : "Not set"}`,
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
// Production Pack: Task CSV
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
// Production Pack: Versions / Milestones summary (markdown source)
// ---------------------------------------------------------------------------
interface VersionsMarkdownOptions {
  /** Include OKRs (objectives + key results) per version. Defaults to true. */
  includeOKRs?: boolean;
}

function buildVersionsMarkdown(
  project: CXDProject,
  tasks: TaskProjection[],
  options: VersionsMarkdownOptions = {},
): string {
  const includeOKRs = options.includeOKRs !== false;
  const projectName = project.name || project.intentionCore?.projectName || "Untitled";
  const versions = [...(project.versions || [])].sort((a, b) => a.order - b.order);
  const okrs = includeOKRs ? project.okrs || [] : [];

  const lines: string[] = [];
  lines.push(`# Versions & Milestones: ${projectName}`);
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
type CardAction = {
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  /** "ghost" renders a subdued secondary action (e.g. the Markdown fallback). */
  variant?: "primary" | "ghost";
};

interface ArtifactCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accent: string; // tailwind text color class for icon
  actions?: CardAction[];
  comingSoon?: boolean;
  children?: React.ReactNode; // expanded content below the actions row
}

function ArtifactCard({
  icon: Icon,
  title,
  description,
  accent,
  actions,
  comingSoon,
  children,
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
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {actions.map((action) => {
            const ActionIcon = action.icon || Download;
            const ghost = action.variant === "ghost";
            return (
              <button
                key={action.label}
                onClick={action.onClick}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  ghost
                    ? "bg-white/[0.04] text-white/45 hover:bg-white/[0.08] hover:text-white/70"
                    : "bg-violet-500/15 text-violet-200 hover:bg-violet-500/25",
                )}
              >
                <ActionIcon className="h-3 w-3" />
                {action.label}
              </button>
            );
          })}
        </div>
      )}

      {!comingSoon && children}
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
// Pitch personalization
// ---------------------------------------------------------------------------
const PITCH_ACCENT_PRESETS: { hex: string; name: string }[] = [
  { hex: "#8b5cf6", name: "Violet" },
  { hex: "#f43f5e", name: "Rose" },
  { hex: "#06b6d4", name: "Cyan" },
  { hex: "#10b981", name: "Emerald" },
  { hex: "#f59e0b", name: "Amber" },
];

// Sections the builder lets the author toggle (hero is always generated).
const PITCH_SECTION_TOGGLES: { kind: PitchSectionKind; label: string }[] = [
  { kind: "concept", label: "Concept" },
  { kind: "personas", label: "Personas" },
  { kind: "sensory", label: "Sensory signature" },
  { kind: "stats", label: "Stats" },
  { kind: "roadmap", label: "Roadmap / milestones" },
  { kind: "cta", label: "Call to action" },
];

interface ProjectImage {
  id: string;
  src: string;
}

/** Every image element across the root canvas and all boards, with a usable src. */
function gatherImageElements(project: CXDProject): ProjectImage[] {
  const out: ProjectImage[] = [];
  const push = (els: CanvasElement[]) => {
    for (const el of els) {
      if (el.type === "image" && el.src && el.src.trim()) out.push({ id: el.id, src: el.src });
    }
  };
  push(project.canvasLayout?.elements || []);
  for (const board of project.canvasLayout?.boards || []) push(board.nodes || []);
  return out;
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
  const project = getCurrentProject();

  const [erdOpen, setErdOpen] = useState(false);
  const [calSyncOpen, setCalSyncOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Customize popups
  const [pitchBuilderOpen, setPitchBuilderOpen] = useState(false);
  const [timelineCustomizeOpen, setTimelineCustomizeOpen] = useState(false);
  const [roleBriefsCustomizeOpen, setRoleBriefsCustomizeOpen] = useState(false);
  const [facilitationCustomizeOpen, setFacilitationCustomizeOpen] = useState(false);
  const [versionsCustomizeOpen, setVersionsCustomizeOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const projectName = project?.name || project?.intentionCore?.projectName || "Untitled";

  const handleFlowTimelineHTML = useCallback(() => {
    const proj = useCXDStore.getState().getCurrentProject();
    if (!proj) return;
    const stages = useCXDStore.getState().getExperienceFlowStages();
    const html = buildExperienceFlowTimelineHTML(proj, stages);
    downloadTextFile(html, `Experience-Flow-Timeline-${slug(proj.name)}.html`, "text/html");
  }, []);

  const handleFlowTimelineMD = useCallback(() => {
    const proj = useCXDStore.getState().getCurrentProject();
    if (!proj) return;
    const stages = useCXDStore.getState().getExperienceFlowStages();
    const md = buildExperienceFlowMarkdown(proj, stages);
    downloadTextFile(md, `Experience-Flow-Timeline-${slug(proj.name)}.md`, "text/markdown");
  }, []);

  const handleTasksCSV = useCallback(() => {
    const proj = useCXDStore.getState().getCurrentProject();
    if (!proj) return;
    const tasks = getProjectTasks(proj);
    const csv = buildTasksCSV(proj, tasks);
    downloadTextFile(csv, `Production-Pack-Tasks-${slug(proj.name)}.csv`, "text/csv");
  }, []);

  const handleVersionsHTML = useCallback(() => {
    const proj = useCXDStore.getState().getCurrentProject();
    if (!proj) return;
    const tasks = getProjectTasks(proj);
    const md = buildVersionsMarkdown(proj, tasks);
    const name = proj.name || proj.intentionCore?.projectName || "Untitled";
    downloadMarkdownAsHtmlDoc(
      md,
      name,
      "Versions & Milestones",
      `Production-Pack-Versions-${slug(proj.name)}.html`,
    );
  }, []);

  const handleVersionsMD = useCallback(() => {
    const proj = useCXDStore.getState().getCurrentProject();
    if (!proj) return;
    const tasks = getProjectTasks(proj);
    const md = buildVersionsMarkdown(proj, tasks);
    downloadTextFile(md, `Production-Pack-Versions-${slug(proj.name)}.md`, "text/markdown");
  }, []);

  const handleFacilitationHTML = useCallback(() => {
    const proj = useCXDStore.getState().getCurrentProject();
    if (!proj) return;
    const stages = useCXDStore.getState().getExperienceFlowStages();
    const md = buildFacilitationMarkdown(proj, stages);
    const name = proj.name || proj.intentionCore?.projectName || "Untitled";
    downloadMarkdownAsHtmlDoc(
      md,
      name,
      "Facilitation & State-Care Sheet",
      `Facilitation-State-Care-${slug(proj.name)}.html`,
    );
  }, []);

  const handleFacilitationMD = useCallback(() => {
    const proj = useCXDStore.getState().getCurrentProject();
    if (!proj) return;
    const stages = useCXDStore.getState().getExperienceFlowStages();
    const md = buildFacilitationMarkdown(proj, stages);
    downloadTextFile(md, `Facilitation-State-Care-${slug(proj.name)}.md`, "text/markdown");
  }, []);

  // --- Experience Flow Timeline: one-click default download ----------------
  // Close on Escape while open
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
        aria-modal="true"
        role="dialog"
        aria-label="Export & Deliverables"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* Panel: frosted glass */}
        <div
          className="relative mx-4 flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
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
              <div className="grid grid-cols-1 gap-3">
                <ArtifactCard
                  icon={Presentation}
                  title="Pitch One-Pager"
                  description="An AI-built pitch tuned to what you want to emphasize: theme, sections, project images and length. Preview, download or save it as a PDF."
                  accent="text-rose-300"
                  actions={[
                    {
                      label: "Customize my pitch",
                      icon: Sparkles,
                      onClick: () => setPitchBuilderOpen(true),
                    },
                  ]}
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
                  description="Full ERD across all six dimensions. The authoritative spec for whoever builds this."
                  accent="text-violet-300"
                  actions={[{ label: "Open generator", onClick: () => setErdOpen(true) }]}
                />
                <ArtifactCard
                  icon={FileSpreadsheet}
                  title="Production Pack"
                  description="Every task as a spreadsheet plus a versions and milestones summary: the plan, ready to work."
                  accent="text-violet-300"
                  actions={[
                    { label: "Tasks .csv", onClick: handleTasksCSV },
                    { label: "Versions summary", onClick: handleVersionsHTML },
                    { label: "Customize versions", icon: Settings2, onClick: () => setVersionsCustomizeOpen(true) },
                    { label: "Markdown", onClick: handleVersionsMD, variant: "ghost" },
                  ]}
                />
                <ArtifactCard
                  icon={Users}
                  title="Role-Scoped Briefs"
                  description="Per-discipline exports filtered by hypercube face. Each collaborator gets only what they own."
                  accent="text-violet-300"
                  actions={[
                    {
                      label: "Customize & choose role",
                      icon: Settings2,
                      onClick: () => setRoleBriefsCustomizeOpen(true),
                    },
                  ]}
                />
              </div>
            </section>

            {/* Run */}
            <section className="mb-6">
              <GroupHeader group="Run" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ArtifactCard
                  icon={GanttChartSquare}
                  title="Experience Flow Timeline"
                  description="A visual timeline of the flow stages with timing, engagement and notes: the minute-by-minute for the day."
                  accent="text-cyan-300"
                  actions={[
                    { label: "Download timeline", onClick: handleFlowTimelineHTML },
                    { label: "Customize", icon: Settings2, onClick: () => setTimelineCustomizeOpen(true) },
                    { label: "Markdown", onClick: handleFlowTimelineMD, variant: "ghost" },
                  ]}
                />
                <ArtifactCard
                  icon={Clapperboard}
                  title="Facilitation & State-Care Sheet"
                  description="State/trait intensity curve with consent and integration notes for the facilitator."
                  accent="text-cyan-300"
                  actions={[
                    { label: "Download sheet", onClick: handleFacilitationHTML },
                    { label: "Customize", icon: Settings2, onClick: () => setFacilitationCustomizeOpen(true) },
                    { label: "Markdown", onClick: handleFacilitationMD, variant: "ghost" },
                  ]}
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
                  description="A read-only live view of this canvas. It always reflects the latest state."
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
                  actions={[
                    { label: "Sync to calendar", icon: CalendarDays, onClick: () => setCalSyncOpen(true) },
                  ]}
                />
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* ERD generator, relocated here as an additional door (Map view keeps its own) */}
      <ERDGenerator
        projectId={project?.id || ""}
        isOpen={erdOpen}
        onClose={() => setErdOpen(false)}
      />

      {/* Calendar sync: shared dialog, also used by Master Plan and Profile */}
      <CalendarSyncDialog open={calSyncOpen} onClose={() => setCalSyncOpen(false)} />

      {/* Pitch builder popup (Gamma-style) */}
      {pitchBuilderOpen && project && (
        <PitchBuilderModal project={project} onClose={() => setPitchBuilderOpen(false)} />
      )}

      {/* Experience Flow Timeline customization popup */}
      {timelineCustomizeOpen && (
        <TimelineCustomizeModal onClose={() => setTimelineCustomizeOpen(false)} />
      )}

      {/* Role-Scoped Briefs customization popup (also hosts the role/bundle picker) */}
      {roleBriefsCustomizeOpen && (
        <RoleBriefsCustomizeModal onClose={() => setRoleBriefsCustomizeOpen(false)} />
      )}

      {/* Facilitation & State-Care Sheet customization popup */}
      {facilitationCustomizeOpen && (
        <FacilitationCustomizeModal onClose={() => setFacilitationCustomizeOpen(false)} />
      )}

      {/* Production Pack versions summary customization popup */}
      {versionsCustomizeOpen && (
        <VersionsCustomizeModal onClose={() => setVersionsCustomizeOpen(false)} />
      )}
    </>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Shared popup shell + control styles
// ---------------------------------------------------------------------------
const chip = (active: boolean) =>
  cn(
    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
    active
      ? "border-violet-400/50 bg-violet-500/20 text-violet-100"
      : "border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white/80",
  );

const primaryBtn =
  "flex items-center gap-1.5 rounded-lg bg-violet-500/20 px-3.5 py-2 text-xs font-medium text-violet-100 transition-colors hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50";
const ghostBtn =
  "flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-3.5 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.1] hover:text-white";

const FIELD_LABEL = "mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-white/40";

/** Backdrop + centered panel shell shared by both builder popups. Uses the
 *  hub's portal idiom at z-[10000] so it stacks above the Export Hub. Escape is
 *  intercepted in the capture phase so it does not also close the hub. */
function PopupShell({
  title,
  subtitle,
  icon: Icon,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      aria-modal="true"
      role="dialog"
      aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative mx-4 flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/85 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="flex flex-shrink-0 items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/15">
              <Icon className="h-4 w-4 text-violet-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">{title}</h2>
              {subtitle && <p className="text-xs text-white/45">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: "thin" }}>
          {children}
        </div>

        {footer && (
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-t border-white/10 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pitch builder popup (Gamma-AI style)
// ---------------------------------------------------------------------------
const PITCH_SECTION_ORDER: PitchSectionKind[] = [
  "hero", "concept", "personas", "sensory", "stats", "roadmap", "cta",
];

function PitchBuilderModal({ project, onClose }: { project: CXDProject; onClose: () => void }) {
  const projectName = project.name || project.intentionCore?.projectName || "Untitled Experience";

  const [prompt, setPrompt] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [accent, setAccent] = useState(PITCH_ACCENT_PRESETS[0].hex);
  const [includeImages, setIncludeImages] = useState(true);
  const [length, setLength] = useState<"single" | "deck">("deck");
  const [sectionOn, setSectionOn] = useState<Record<PitchSectionKind, boolean>>({
    hero: true, concept: true, personas: true, sensory: true, stats: true, roadmap: false, cta: true,
  });

  const images = useMemo(() => gatherImageElements(project), [project]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(images.map((i) => i.id)));

  const [phase, setPhase] = useState<"config" | "generating" | "ready" | "error">("config");
  const [sections, setSections] = useState<PitchSection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [insufficient, setInsufficient] = useState(false);

  const selectedSrcs = (): string[] =>
    includeImages ? images.filter((i) => selectedIds.has(i.id)).map((i) => i.src) : [];

  const chosenSections = (): PitchSectionKind[] =>
    PITCH_SECTION_ORDER.filter((k) => k === "hero" || sectionOn[k]);

  const currentOptions = (): PitchBuilderOptions => ({
    theme, accent, includeImages, sections: chosenSections(), length,
  });

  const buildHTML = (secs: PitchSection[]): string =>
    buildPitchDeckHTML(secs, { projectName, theme, accent, length, images: selectedSrcs() });

  const handleGenerate = async () => {
    setPhase("generating");
    setError(null);
    setInsufficient(false);
    const res = await generatePitch(project, currentOptions(), prompt);
    if (res.success && res.sections) {
      setSections(res.sections);
      setPhase("ready");
    } else {
      setError(res.error || "Generation failed.");
      setInsufficient(!!res.insufficientCredits);
      setPhase("error");
    }
  };

  const handlePreview = () => {
    if (sections) openHtmlInNewWindow(buildHTML(sections), `Pitch-${slug(projectName)}.html`);
  };
  const handleDownload = () => {
    if (sections) downloadTextFile(buildHTML(sections), `Pitch-${slug(projectName)}.html`, "text/html");
  };
  const handlePDF = () => {
    if (sections) openAndPrintHtml(buildHTML(sections), `Pitch-${slug(projectName)}.html`);
  };

  // Graceful fallback: the previous template-based one-pager, so the card never
  // dead-ends when the AI call fails.
  const handleFallback = (mode: "download" | "pdf") => {
    const html = buildPitchHTML(project, { accent, imageDataUri: selectedSrcs()[0] || null });
    const file = `Pitch-One-Pager-${slug(projectName)}.html`;
    if (mode === "pdf") openAndPrintHtml(html, file);
    else downloadTextFile(html, file, "text/html");
  };

  const toggleImage = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generating = phase === "generating";

  const footer =
    phase === "ready" ? (
      <>
        <button onClick={handlePreview} className={primaryBtn}><Eye className="h-3.5 w-3.5" />Preview</button>
        <button onClick={handleDownload} className={primaryBtn}><Download className="h-3.5 w-3.5" />Download HTML</button>
        <button onClick={handlePDF} className={primaryBtn}><Printer className="h-3.5 w-3.5" />Save as PDF</button>
        <button onClick={() => setPhase("config")} className={ghostBtn}>Edit options</button>
        <button onClick={handleGenerate} className={ghostBtn}><Sparkles className="h-3.5 w-3.5" />Regenerate</button>
      </>
    ) : (
      <>
        <button onClick={handleGenerate} disabled={generating} className={primaryBtn}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {generating ? "Generating..." : "Generate"}
        </button>
        {phase === "error" && (
          <>
            <button onClick={() => handleFallback("download")} className={ghostBtn}>
              <Download className="h-3.5 w-3.5" />Use template instead
            </button>
            <button onClick={() => handleFallback("pdf")} className={ghostBtn}>
              <Printer className="h-3.5 w-3.5" />Template PDF
            </button>
          </>
        )}
      </>
    );

  return (
    <PopupShell
      title="Customize my pitch"
      subtitle={projectName}
      icon={Sparkles}
      onClose={onClose}
      footer={footer}
    >
      {phase === "ready" && sections ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            <Check className="h-4 w-4 flex-shrink-0" />
            Pitch ready with {sections.length} section{sections.length === 1 ? "" : "s"}. Preview it, download the HTML, or save it as a PDF from the buttons below.
          </div>
          <div className="space-y-2">
            {sections.map((s, i) => (
              <div key={i} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                <div className="text-[10px] font-medium uppercase tracking-wide text-violet-300">{s.kind}</div>
                <div className="mt-0.5 text-sm font-semibold text-white">{s.title}</div>
                {s.body && <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-white/55">{s.body}</p>}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Emphasis prompt */}
          <div>
            <label className={FIELD_LABEL}>Describe what you want this pitch to emphasize</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, PITCH_MAX_PROMPT_LEN))}
              rows={3}
              placeholder="e.g. Lead with the transformation for first-time visitors and the sensory peak moment."
              className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white placeholder:text-white/25 outline-none transition-colors focus:border-violet-400/50"
            />
            <div className="mt-1 text-right text-[10px] text-white/30">{prompt.length}/{PITCH_MAX_PROMPT_LEN}</div>
          </div>

          {/* Theme + accent */}
          <div className="flex flex-wrap items-start gap-6">
            <div>
              <label className={FIELD_LABEL}>Theme</label>
              <div className="flex gap-1.5">
                <button className={chip(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
                <button className={chip(theme === "light")} onClick={() => setTheme("light")}>Light</button>
              </div>
            </div>
            <div>
              <label className={FIELD_LABEL}>Accent color</label>
              <div className="flex items-center gap-1.5">
                {PITCH_ACCENT_PRESETS.map((preset) => (
                  <button
                    key={preset.hex}
                    type="button"
                    title={preset.name}
                    onClick={() => setAccent(preset.hex)}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                      accent === preset.hex ? "border-white" : "border-transparent",
                    )}
                    style={{ backgroundColor: preset.hex }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className={FIELD_LABEL}>Length</label>
              <div className="flex gap-1.5">
                <button className={chip(length === "single")} onClick={() => setLength("single")}>Single page</button>
                <button className={chip(length === "deck")} onClick={() => setLength("deck")}>Short deck</button>
              </div>
            </div>
          </div>

          {/* Sections */}
          <div>
            <label className={FIELD_LABEL}>Sections to include</label>
            <div className="flex flex-wrap gap-1.5">
              {PITCH_SECTION_TOGGLES.map((s) => (
                <button
                  key={s.kind}
                  className={chip(sectionOn[s.kind])}
                  onClick={() => setSectionOn((prev) => ({ ...prev, [s.kind]: !prev[s.kind] }))}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-white/30">A hero opening is always included.</p>
          </div>

          {/* Images */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[10px] font-medium uppercase tracking-wide text-white/40">Include images</label>
              <div className="flex gap-1.5">
                <button className={chip(includeImages)} onClick={() => setIncludeImages(true)}>Yes</button>
                <button className={chip(!includeImages)} onClick={() => setIncludeImages(false)}>No</button>
              </div>
            </div>
            {includeImages && (
              images.length > 0 ? (
                <>
                  <p className="mb-2 text-[11px] text-white/40">Would you like to include these? Selected images are embedded in the pitch.</p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {images.map((img) => {
                      const on = selectedIds.has(img.id);
                      return (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => toggleImage(img.id)}
                          className={cn(
                            "relative aspect-square overflow-hidden rounded-lg border-2 transition-colors",
                            on ? "border-violet-400" : "border-white/10 hover:border-white/25",
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.src} alt="Project asset" className="h-full w-full object-cover" />
                          {on && (
                            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-white">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="flex items-center gap-1.5 text-[11px] text-white/35">
                  <ImagePlus className="h-3.5 w-3.5" />
                  No image elements on this canvas yet.
                </p>
              )
            )}
          </div>

          {phase === "error" && error && (
            <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
              {insufficient
                ? " You can still use the template-based one-pager below."
                : " Try again, or use the template-based one-pager below."}
            </div>
          )}
        </div>
      )}
    </PopupShell>
  );
}

// ---------------------------------------------------------------------------
// Experience Flow Timeline customization popup
// ---------------------------------------------------------------------------
function TimelineCustomizeModal({ onClose }: { onClose: () => void }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [accent, setAccent] = useState(PITCH_ACCENT_PRESETS[0].hex);
  const [showDetails, setShowDetails] = useState(true);

  const build = (): { html: string; name: string } | null => {
    const proj = useCXDStore.getState().getCurrentProject();
    if (!proj) return null;
    const stages = useCXDStore.getState().getExperienceFlowStages();
    return {
      html: buildExperienceFlowTimelineHTML(proj, stages, { theme, accent, showStageDetails: showDetails }),
      name: `Experience-Flow-Timeline-${slug(proj.name)}.html`,
    };
  };

  const doPreview = () => { const r = build(); if (r) openHtmlInNewWindow(r.html, r.name); };
  const doDownload = () => { const r = build(); if (r) downloadTextFile(r.html, r.name, "text/html"); };
  const doPDF = () => { const r = build(); if (r) openAndPrintHtml(r.html, r.name); };

  return (
    <PopupShell
      title="Customize timeline"
      subtitle="Experience Flow Timeline"
      icon={Settings2}
      onClose={onClose}
      footer={
        <>
          <button onClick={doPreview} className={primaryBtn}><Eye className="h-3.5 w-3.5" />Preview</button>
          <button onClick={doDownload} className={primaryBtn}><Download className="h-3.5 w-3.5" />Download</button>
          <button onClick={doPDF} className={primaryBtn}><Printer className="h-3.5 w-3.5" />Save as PDF</button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={FIELD_LABEL}>Theme</label>
          <div className="flex gap-1.5">
            <button className={chip(theme === "light")} onClick={() => setTheme("light")}>Light</button>
            <button className={chip(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
          </div>
        </div>
        <div>
          <label className={FIELD_LABEL}>Accent color</label>
          <div className="flex items-center gap-1.5">
            {PITCH_ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.hex}
                type="button"
                title={preset.name}
                onClick={() => setAccent(preset.hex)}
                className={cn(
                  "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                  accent === preset.hex ? "border-white" : "border-transparent",
                )}
                style={{ backgroundColor: preset.hex }}
              />
            ))}
          </div>
        </div>
        <div>
          <label className={FIELD_LABEL}>Sections</label>
          <div className="flex gap-1.5">
            <button className={chip(!showDetails)} onClick={() => setShowDetails(false)}>Timeline only</button>
            <button className={chip(showDetails)} onClick={() => setShowDetails(true)}>Timeline + stage details</button>
          </div>
        </div>
      </div>
    </PopupShell>
  );
}

// ---------------------------------------------------------------------------
// Role-Scoped Briefs customization popup — also hosts the bundle/face picker
// that previously lived inline on the card, plus theme, accent and content
// toggles. Each bundle/face button triggers its own download immediately,
// using whatever options are currently set above it.
// ---------------------------------------------------------------------------
function RoleBriefsCustomizeModal({ onClose }: { onClose: () => void }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [accent, setAccent] = useState(PITCH_ACCENT_PRESETS[0].hex);
  const [includeFraming, setIncludeFraming] = useState(true);
  const [includeElements, setIncludeElements] = useState(true);
  const [groupBy, setGroupBy] = useState<"container" | "flat">("container");
  const [asMarkdown, setAsMarkdown] = useState(false);

  const downloadBrief = (faces: HypercubeFaceTag[], label: string) => {
    const proj = useCXDStore.getState().getCurrentProject();
    if (!proj) return;
    const md = buildRoleBriefMarkdown(proj, faces, label, { includeFraming, includeElements, groupBy });
    if (asMarkdown) {
      downloadTextFile(md, `Brief-${slug(label)}-${slug(proj.name)}.md`, "text/markdown");
      return;
    }
    const name = proj.name || proj.intentionCore?.projectName || "Untitled";
    const html = buildHtmlDoc({
      projectName: name,
      artifactTitle: `Role Brief: ${label}`,
      bodyHtml: markdownToHtml(md),
      theme,
      accent,
    });
    downloadTextFile(html, `Brief-${slug(label)}-${slug(proj.name)}.html`, "text/html");
  };

  return (
    <PopupShell title="Customize role brief" subtitle="Role-Scoped Briefs" icon={Users} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start gap-6">
          <div>
            <label className={FIELD_LABEL}>Theme</label>
            <div className="flex gap-1.5">
              <button className={chip(theme === "light")} onClick={() => setTheme("light")}>Light</button>
              <button className={chip(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
            </div>
          </div>
          <div>
            <label className={FIELD_LABEL}>Accent color</label>
            <div className="flex items-center gap-1.5">
              {PITCH_ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  title={preset.name}
                  onClick={() => setAccent(preset.hex)}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                    accent === preset.hex ? "border-white" : "border-transparent",
                  )}
                  style={{ backgroundColor: preset.hex }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-6">
          <div>
            <label className={FIELD_LABEL}>Wizard framing</label>
            <div className="flex gap-1.5">
              <button className={chip(includeFraming)} onClick={() => setIncludeFraming(true)}>Include</button>
              <button className={chip(!includeFraming)} onClick={() => setIncludeFraming(false)}>Skip</button>
            </div>
          </div>
          <div>
            <label className={FIELD_LABEL}>Canvas elements</label>
            <div className="flex gap-1.5">
              <button className={chip(includeElements)} onClick={() => setIncludeElements(true)}>Include</button>
              <button className={chip(!includeElements)} onClick={() => setIncludeElements(false)}>Skip</button>
            </div>
          </div>
          <div>
            <label className={FIELD_LABEL}>Group by</label>
            <div className="flex gap-1.5">
              <button className={chip(groupBy === "container")} onClick={() => setGroupBy("container")}>Container / board</button>
              <button className={chip(groupBy === "flat")} onClick={() => setGroupBy("flat")}>Flat list</button>
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-3">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-white/35">
            Role bundles
          </p>
          <div className="flex flex-wrap gap-2">
            {ROLE_BUNDLES.map((bundle) => (
              <button
                key={bundle.id}
                onClick={() => downloadBrief(bundle.faces, bundle.label)}
                title={bundle.faces.join(" + ")}
                className="flex items-center gap-1.5 rounded-lg bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-500/25"
              >
                <Download className="h-3 w-3" />
                {bundle.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-white/35">
            Single face
          </p>
          <div className="flex flex-wrap gap-1.5">
            {HYPERCUBE_FACE_TAGS.map((face) => (
              <button
                key={face}
                onClick={() => downloadBrief([face], face)}
                className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/60 transition-colors hover:border-violet-400/40 hover:bg-violet-500/15 hover:text-violet-200"
              >
                {face}
              </button>
            ))}
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-white/40">
          <input
            type="checkbox"
            checked={asMarkdown}
            onChange={(e) => setAsMarkdown(e.target.checked)}
            className="h-3 w-3 accent-violet-500"
          />
          Download as Markdown (for power users)
        </label>
      </div>
    </PopupShell>
  );
}

// ---------------------------------------------------------------------------
// Facilitation & State-Care Sheet customization popup
// ---------------------------------------------------------------------------
function FacilitationCustomizeModal({ onClose }: { onClose: () => void }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [accent, setAccent] = useState(PITCH_ACCENT_PRESETS[0].hex);
  const [includeStatesTraits, setIncludeStatesTraits] = useState(true);
  const [includeIntensityCurve, setIncludeIntensityCurve] = useState(true);
  const [includePresenceProfile, setIncludePresenceProfile] = useState(true);
  const [includeCare, setIncludeCare] = useState(true);

  const build = (): { html: string; name: string } | null => {
    const proj = useCXDStore.getState().getCurrentProject();
    if (!proj) return null;
    const stages = useCXDStore.getState().getExperienceFlowStages();
    const md = buildFacilitationMarkdown(proj, stages, {
      includeStatesTraits,
      includeIntensityCurve,
      includePresenceProfile,
      includeConsentGroundingIntegration: includeCare,
    });
    const name = proj.name || proj.intentionCore?.projectName || "Untitled";
    const html = buildHtmlDoc({
      projectName: name,
      artifactTitle: "Facilitation & State-Care Sheet",
      bodyHtml: markdownToHtml(md),
      theme,
      accent,
    });
    return { html, name: `Facilitation-State-Care-${slug(proj.name)}.html` };
  };

  const doPreview = () => { const r = build(); if (r) openHtmlInNewWindow(r.html, r.name); };
  const doDownload = () => { const r = build(); if (r) downloadTextFile(r.html, r.name, "text/html"); };
  const doPDF = () => { const r = build(); if (r) openAndPrintHtml(r.html, r.name); };

  return (
    <PopupShell
      title="Customize sheet"
      subtitle="Facilitation & State-Care Sheet"
      icon={Settings2}
      onClose={onClose}
      footer={
        <>
          <button onClick={doPreview} className={primaryBtn}><Eye className="h-3.5 w-3.5" />Preview</button>
          <button onClick={doDownload} className={primaryBtn}><Download className="h-3.5 w-3.5" />Download</button>
          <button onClick={doPDF} className={primaryBtn}><Printer className="h-3.5 w-3.5" />Save as PDF</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-start gap-6">
          <div>
            <label className={FIELD_LABEL}>Theme</label>
            <div className="flex gap-1.5">
              <button className={chip(theme === "light")} onClick={() => setTheme("light")}>Light</button>
              <button className={chip(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
            </div>
          </div>
          <div>
            <label className={FIELD_LABEL}>Accent color</label>
            <div className="flex items-center gap-1.5">
              {PITCH_ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  title={preset.name}
                  onClick={() => setAccent(preset.hex)}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                    accent === preset.hex ? "border-white" : "border-transparent",
                  )}
                  style={{ backgroundColor: preset.hex }}
                />
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className={FIELD_LABEL}>Sections to include</label>
          <div className="flex flex-wrap gap-1.5">
            <button className={chip(includeStatesTraits)} onClick={() => setIncludeStatesTraits((v) => !v)}>
              States & traits quadrants
            </button>
            <button className={chip(includeIntensityCurve)} onClick={() => setIncludeIntensityCurve((v) => !v)}>
              Intensity curve
            </button>
            <button className={chip(includePresenceProfile)} onClick={() => setIncludePresenceProfile((v) => !v)}>
              Presence profile
            </button>
            <button className={chip(includeCare)} onClick={() => setIncludeCare((v) => !v)}>
              Consent / grounding / integration
            </button>
          </div>
        </div>
      </div>
    </PopupShell>
  );
}

// ---------------------------------------------------------------------------
// Production Pack: versions & milestones summary customization popup
// ---------------------------------------------------------------------------
function VersionsCustomizeModal({ onClose }: { onClose: () => void }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [accent, setAccent] = useState(PITCH_ACCENT_PRESETS[0].hex);
  const [includeOKRs, setIncludeOKRs] = useState(true);

  const build = (): { html: string; name: string } | null => {
    const proj = useCXDStore.getState().getCurrentProject();
    if (!proj) return null;
    const tasks = getProjectTasks(proj);
    const md = buildVersionsMarkdown(proj, tasks, { includeOKRs });
    const name = proj.name || proj.intentionCore?.projectName || "Untitled";
    const html = buildHtmlDoc({
      projectName: name,
      artifactTitle: "Versions & Milestones",
      bodyHtml: markdownToHtml(md),
      theme,
      accent,
    });
    return { html, name: `Production-Pack-Versions-${slug(proj.name)}.html` };
  };

  const doPreview = () => { const r = build(); if (r) openHtmlInNewWindow(r.html, r.name); };
  const doDownload = () => { const r = build(); if (r) downloadTextFile(r.html, r.name, "text/html"); };
  const doPDF = () => { const r = build(); if (r) openAndPrintHtml(r.html, r.name); };

  return (
    <PopupShell
      title="Customize versions summary"
      subtitle="Production Pack"
      icon={Settings2}
      onClose={onClose}
      footer={
        <>
          <button onClick={doPreview} className={primaryBtn}><Eye className="h-3.5 w-3.5" />Preview</button>
          <button onClick={doDownload} className={primaryBtn}><Download className="h-3.5 w-3.5" />Download</button>
          <button onClick={doPDF} className={primaryBtn}><Printer className="h-3.5 w-3.5" />Save as PDF</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-start gap-6">
          <div>
            <label className={FIELD_LABEL}>Theme</label>
            <div className="flex gap-1.5">
              <button className={chip(theme === "light")} onClick={() => setTheme("light")}>Light</button>
              <button className={chip(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
            </div>
          </div>
          <div>
            <label className={FIELD_LABEL}>Accent color</label>
            <div className="flex items-center gap-1.5">
              {PITCH_ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  title={preset.name}
                  onClick={() => setAccent(preset.hex)}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                    accent === preset.hex ? "border-white" : "border-transparent",
                  )}
                  style={{ backgroundColor: preset.hex }}
                />
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className={FIELD_LABEL}>Objectives & key results</label>
          <div className="flex gap-1.5">
            <button className={chip(includeOKRs)} onClick={() => setIncludeOKRs(true)}>Include OKRs</button>
            <button className={chip(!includeOKRs)} onClick={() => setIncludeOKRs(false)}>Skip OKRs</button>
          </div>
        </div>
      </div>
    </PopupShell>
  );
}
