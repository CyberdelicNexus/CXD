"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Loader2, X, LogIn, ListTodo, Calendar, Sparkles,
  ImagePlus, UserPlus, BarChart3, Pencil, Trash2, Map as MapIcon, Target, Lightbulb, RefreshCw,
} from "lucide-react";
import { fetchProjectById } from "@/lib/supabase-projects";
import { queryTasks } from "@/utils/task-engine";
import { SENSORY_DOMAINS } from "@/types/cxd-schema";
import { calculateOKRProgress, OKR_STATUS_CONFIG } from "@/types/version-types";
import type { CanvasElement } from "@/types/canvas-elements";
import type { CXDProject } from "@/types/cxd-schema";
import type { ExperienceInsights } from "@/lib/ai/experience-insights";

interface ProjectDetailPanelProps {
  projectId: string;
  onClose: () => void;
  onEnterProject: (projectId: string) => void;
  /** Owner-gated actions, wired from the dashboard so the moved square buttons work here. */
  isOwner?: boolean;
  canDelete?: boolean;
  onAddCover?: () => void;
  onInvite?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}

const insightsCacheKey = (id: string) => `cxd-exp-insights:${id}`;

/**
 * Overview snapshot for a selected project card — lives INSIDE the same grid
 * as the project tiles (col-span-2 row-span-2). Fetched via fetchProjectById
 * (single project, RLS-respecting), NOT the full canvas renderer.
 *
 * Surfaces: core concept, task status breakdown, roadmap + OKR progress, an
 * on-demand AI summary + prioritization (credit-spending, behind a button and
 * cached in localStorage per project version), plus the same quick actions the
 * project tile exposes.
 */
export function ProjectDetailPanel({
  projectId,
  onClose,
  onEnterProject,
  isOwner,
  canDelete,
  onAddCover,
  onInvite,
  onRename,
  onDelete,
}: ProjectDetailPanelProps) {
  const router = useRouter();
  const [project, setProject] = useState<CXDProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [insights, setInsights] = useState<ExperienceInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setProject(null);
    setInsights(null);
    setInsightsError(null);
    fetchProjectById(projectId).then((p) => {
      if (cancelled) return;
      if (p) setProject(p);
      else setNotFound(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Load any cached AI insights for THIS project version (regenerate after edits).
  useEffect(() => {
    if (!project) return;
    try {
      const raw = localStorage.getItem(insightsCacheKey(project.id));
      if (!raw) return;
      const parsed = JSON.parse(raw) as { updatedAt?: string; insights?: ExperienceInsights };
      if (parsed?.updatedAt === project.updatedAt && parsed.insights) {
        setInsights(parsed.insights);
      }
    } catch {
      /* ignore malformed cache */
    }
  }, [project]);

  // ─── Derived data (must run every render, before any early return, to keep hooks stable) ───
  const elements: CanvasElement[] = useMemo(
    () => [
      ...(project?.canvasLayout?.elements || []),
      ...((project?.canvasLayout?.boards || []).flatMap((b) => b.nodes || [])),
    ],
    [project],
  );

  const taskStats = useMemo(() => {
    const { tasks } = queryTasks(elements, {
      filter: { showCompleted: true, includeImplicitTasks: true, includeExplicitTasks: true, includeTaggedCards: true },
      sort: [],
    });
    const by = (s: string) => tasks.filter((t) => t.status === s).length;
    return {
      total: tasks.length,
      notStarted: by("not_started"),
      inProgress: by("in_progress"),
      blocked: by("blocked"),
      done: by("completed"),
    };
  }, [elements]);

  const taggedCount = useMemo(
    () => elements.filter((e) => e.hypercubeTags && e.hypercubeTags.length > 0).length,
    [elements],
  );

  const versions = project?.versions || [];
  const okrs = project?.okrs || [];
  const completedVersions = versions.filter((v) => v.status === "complete").length;
  const roadmapPercent = versions.length > 0 ? Math.round((completedVersions / versions.length) * 100) : 0;
  const okrRows = useMemo(
    () =>
      okrs.slice(0, 4).map((o) => ({
        name: o.name || "Untitled OKR",
        status: o.status || "on_track",
        progress: calculateOKRProgress(o),
      })),
    [okrs],
  );

  const concept = project?.intentionCore?.mainConcept || project?.intentionCore?.coreMessage;

  const sensoryBars = useMemo(
    () =>
      SENSORY_DOMAINS
        .map((s) => ({ label: s.label, value: project?.sensoryDomains?.[s.code] ?? 0 }))
        .filter((s) => s.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
    [project],
  );

  const taskDone = taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0;

  const generateInsights = async () => {
    if (!project || insightsLoading) return;
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const inputPayload = {
        name: project.name,
        concept: concept || "",
        description: project.description || "",
        elementCount: elements.length,
        taggedCount,
        tasks: taskStats,
        sensory: sensoryBars,
        roadmap: versions.map((v) => ({ name: v.name, status: v.status, type: v.type_label })),
        okrs: okrRows,
      };
      const res = await fetch("/api/ai/experience-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: inputPayload, provider: "gemini" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInsightsError(data?.error || "Couldn't generate insights. Try again.");
        return;
      }
      const next = data.insights as ExperienceInsights;
      setInsights(next);
      try {
        localStorage.setItem(
          insightsCacheKey(project.id),
          JSON.stringify({ updatedAt: project.updatedAt, insights: next }),
        );
      } catch {
        /* storage full / disabled — non-fatal */
      }
    } catch {
      setInsightsError("Network error. Try again.");
    } finally {
      setInsightsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="col-span-2 row-span-2 self-start aspect-square rounded-xl bg-black/20 border border-white/10 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="col-span-2 row-span-2 self-start aspect-square rounded-xl bg-black/20 border border-white/10 flex flex-col items-center justify-center gap-3 text-white/50 text-sm">
        Couldn&apos;t load this project.
        <button onClick={onClose} className="text-violet-400 hover:text-violet-300 transition-colors">
          Close
        </button>
      </div>
    );
  }

  const coverImage = (project as { coverImage?: string }).coverImage;

  const iconAction = (
    key: string,
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    hoverClass: string,
  ) => (
    <button
      key={key}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`w-7 h-7 flex items-center justify-center rounded-lg bg-black/50 text-white/80 border border-white/10 backdrop-blur-sm transition-colors ${hoverClass}`}
      title={label}
    >
      {icon}
    </button>
  );

  return (
    // aspect-square + self-start gives the panel a DEFINITE height equal to its
    // own width — which, spanning 2 columns, matches the 2-square-tall area — so
    // its (possibly long) content can never stretch the grid rows and push the
    // tile grid down. self-start stops the grid from stretching it past that.
    // The cover header is a flex-shrink-0 sibling of the scroll body, so it stays
    // pinned while only the body scrolls (global dark-purple scrollbar).
    <div className="col-span-2 row-span-2 self-start aspect-square rounded-xl overflow-hidden bg-black/20 border border-white/10 flex flex-col">
      <div className="relative h-24 flex-shrink-0">
        {coverImage && coverImage.startsWith("http") ? (
          <Image src={coverImage} alt={project.name} fill className="object-cover opacity-70" unoptimized />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-900/60 via-purple-800/50 to-indigo-900/60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white/70 hover:text-white transition-colors z-10"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
        {/* Quick actions — overlaid on the cover image (top-left) */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
          {onAddCover &&
            iconAction("cover", "Add Cover Image", <ImagePlus className="w-4 h-4" />, onAddCover, "hover:bg-emerald-500/40 hover:text-white")}
          {isOwner && onInvite &&
            iconAction("invite", "Invite Collaborators", <UserPlus className="w-4 h-4" />, onInvite, "hover:bg-violet-500/40 hover:text-white")}
          {iconAction("overview", "Project Overview", <BarChart3 className="w-4 h-4" />, () => router.push(`/cxd/overview/${project.id}`), "hover:bg-purple-500/40 hover:text-white")}
          {onRename &&
            iconAction("rename", "Rename", <Pencil className="w-4 h-4" />, onRename, "hover:bg-blue-500/40 hover:text-white")}
          {isOwner && canDelete && onDelete &&
            iconAction("delete", "Delete", <Trash2 className="w-4 h-4" />, onDelete, "hover:bg-red-500/40 hover:text-red-300")}
        </div>
        <div className="absolute bottom-3 left-4 right-36">
          <h3 className="font-bold text-white text-xl truncate">{project.name}</h3>
        </div>
        {/* Primary action lives in the pinned header so it never scrolls away */}
        <button
          onClick={() => onEnterProject(project.id)}
          className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium shadow-lg shadow-violet-900/40 transition-colors"
          title="Open this canvas"
        >
          <LogIn className="w-4 h-4" />
          Enter Canvas
        </button>
      </div>

      <div className="p-3 flex-1 min-h-0 overflow-y-auto grid grid-cols-2 gap-2.5 content-start">
        {(concept || project.description) && (
          <p className="col-span-2 text-sm text-white/65 line-clamp-2">{concept || project.description}</p>
        )}

        {/* At a glance: tasks and roadmap in one card */}
        <div className="col-span-2 p-3 rounded-lg bg-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/70 flex items-center gap-1.5">
              <ListTodo className="w-3.5 h-3.5 text-cyan-400" /> Tasks
            </span>
            <span className="text-xs text-white/50">
              {taskStats.done}/{taskStats.total} done
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all"
              style={{ width: `${taskDone}%` }}
            />
          </div>
          <p className="text-[11px] text-white/45">
            {taskStats.notStarted} to do · <span className="text-amber-300/80">{taskStats.inProgress} in progress</span>
            {taskStats.blocked > 0 && <> · <span className="text-rose-300/80">{taskStats.blocked} blocked</span></>}
          </p>
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <span className="text-xs font-medium text-white/70 flex items-center gap-1.5">
              <MapIcon className="w-3.5 h-3.5 text-violet-400" /> Roadmap
            </span>
            <span className="text-xs text-white/50">
              {versions.length > 0 ? `${completedVersions}/${versions.length} versions` : "No versions yet"}
            </span>
          </div>
          {versions.length > 0 && (
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all"
                style={{ width: `${roadmapPercent}%` }}
              />
            </div>
          )}
        </div>

        {/* OKRs: collapsed by default */}
        {okrRows.length > 0 && (
          <details className="col-span-2 group rounded-lg bg-white/5">
            <summary className="flex items-center justify-between cursor-pointer list-none p-3 text-xs font-medium text-white/70">
              <span className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-emerald-400" /> OKRs
                <span className="text-white/40 font-normal">({okrRows.length})</span>
              </span>
              <span className="text-white/30 group-open:rotate-90 transition-transform">›</span>
            </summary>
            <div className="space-y-2 px-3 pb-3">
              {okrRows.map((o, i) => {
                const cfg = OKR_STATUS_CONFIG[o.status as keyof typeof OKR_STATUS_CONFIG] || OKR_STATUS_CONFIG.on_track;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-white/70 truncate">{o.name}</span>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ color: cfg.color, backgroundColor: cfg.bg }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${o.progress}%`, backgroundColor: cfg.color }} />
                      </div>
                      <span className="text-[9px] text-white/40 w-8 text-right">{o.progress}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        {/* AI insights: on-demand (spends credits), collapsed by default */}
        <details className="col-span-2 group rounded-lg bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 border border-violet-500/20">
          <summary className="flex items-center justify-between cursor-pointer list-none p-3 text-xs font-medium text-white/70">
            <span className="flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-300" /> AI Insights
            </span>
            <span className="text-white/30 group-open:rotate-90 transition-transform">›</span>
          </summary>
          <div className="px-3 pb-3">
            {insights ? (
              <div className="space-y-2.5">
                <div className="flex justify-end">
                  <button
                    onClick={generateInsights}
                    disabled={insightsLoading}
                    className="text-[10px] text-violet-300 hover:text-violet-200 flex items-center gap-1 disabled:opacity-50"
                    title="Regenerate (uses AI credits)"
                  >
                    <RefreshCw className={`w-3 h-3 ${insightsLoading ? "animate-spin" : ""}`} /> Refresh
                  </button>
                </div>
                <p className="text-xs text-white/75 leading-relaxed">{insights.summary}</p>
                {insights.recommendations.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-violet-300/70 mb-1">Prioritize</p>
                    <ol className="space-y-1">
                      {insights.recommendations.map((r, i) => (
                        <li key={i} className="text-[11px] text-white/70 flex gap-1.5">
                          <span className="text-violet-400 font-semibold flex-shrink-0">{i + 1}.</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-white/40">
                  A summary of this experience plus prioritized recommendations. Uses AI credits.
                </p>
                {insightsError && <p className="text-[11px] text-rose-300">{insightsError}</p>}
                <button
                  onClick={generateInsights}
                  disabled={insightsLoading}
                  className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-violet-600/80 hover:bg-violet-500 text-white text-xs font-medium transition-colors disabled:opacity-60"
                >
                  {insightsLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" /> Generate AI insights
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </details>

        <div className="col-span-2 flex items-center gap-1.5 text-[11px] text-white/35">
          <Calendar className="w-3 h-3" />
          Updated {new Date(project.updatedAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
