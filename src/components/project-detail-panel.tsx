"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Loader2, X, LogIn, Eye, Layers, ListTodo, Tag, Calendar, ArrowRight, Sparkles,
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

const BAR_COLORS = ["#8B5CF6", "#22D3EE", "#F472B6", "#34D399", "#F97316"];

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
      <div className="col-span-2 row-span-2 rounded-xl bg-black/20 border border-white/10 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="col-span-2 row-span-2 rounded-xl bg-black/20 border border-white/10 flex flex-col items-center justify-center gap-3 text-white/50 text-sm">
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
      className={`w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-white/70 border border-white/10 transition-colors ${hoverClass}`}
      title={label}
    >
      {icon}
    </button>
  );

  return (
    <div className="col-span-2 row-span-2 rounded-xl overflow-hidden bg-black/20 border border-white/10 flex flex-col">
      <div className="relative h-28 flex-shrink-0">
        {coverImage && coverImage.startsWith("http") ? (
          <Image src={coverImage} alt={project.name} fill className="object-cover opacity-70" unoptimized />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-900/60 via-purple-800/50 to-indigo-900/60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white/70 hover:text-white transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="absolute bottom-3 left-4 right-12">
          <h3 className="font-bold text-white text-xl truncate">{project.name}</h3>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto grid grid-cols-2 gap-3 content-start">
        {(project.description || concept) && (
          <div className="col-span-2 space-y-2">
            {project.description && <p className="text-sm text-white/60 line-clamp-2">{project.description}</p>}
            {concept && (
              <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                <p className="text-[10px] uppercase tracking-wide text-violet-300/70 mb-1">Core Concept</p>
                <p className="text-sm text-white/80 line-clamp-3">{concept}</p>
              </div>
            )}
          </div>
        )}

        {/* Task progress bar + status breakdown */}
        <div className="col-span-2 p-3 rounded-lg bg-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-white/70 flex items-center gap-1.5">
              <ListTodo className="w-3.5 h-3.5 text-cyan-400" /> Task Progress
            </span>
            <span className="text-xs text-white/50">
              {taskStats.done}/{taskStats.total}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-2.5">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all"
              style={{ width: `${taskDone}%` }}
            />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: "To do", value: taskStats.notStarted, color: "text-white/70" },
              { label: "In progress", value: taskStats.inProgress, color: "text-amber-300" },
              { label: "Blocked", value: taskStats.blocked, color: "text-rose-300" },
              { label: "Done", value: taskStats.done, color: "text-emerald-300" },
            ].map((s) => (
              <div key={s.label} className="rounded-md bg-black/20 py-1.5 text-center">
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-white/40 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Roadmap progress */}
        <div className="col-span-2 p-3 rounded-lg bg-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-white/70 flex items-center gap-1.5">
              <MapIcon className="w-3.5 h-3.5 text-violet-400" /> Roadmap
            </span>
            <span className="text-xs text-white/50">
              {versions.length > 0 ? `${completedVersions}/${versions.length} versions` : "No versions"}
            </span>
          </div>
          {versions.length > 0 ? (
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all"
                style={{ width: `${roadmapPercent}%` }}
              />
            </div>
          ) : (
            <p className="text-[11px] text-white/40">Add versions in the Plan view to track a roadmap.</p>
          )}
        </div>

        {/* OKRs */}
        {okrRows.length > 0 && (
          <div className="col-span-2 p-3 rounded-lg bg-white/5">
            <span className="text-xs font-medium text-white/70 flex items-center gap-1.5 mb-2">
              <Target className="w-3.5 h-3.5 text-emerald-400" /> OKRs
            </span>
            <div className="space-y-2">
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
          </div>
        )}

        {/* Sensory signature */}
        {sensoryBars.length > 0 && (
          <div className="col-span-2 p-3 rounded-lg bg-white/5">
            <span className="text-xs font-medium text-white/70 flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" /> Sensory Signature
            </span>
            <div className="space-y-1.5">
              {sensoryBars.map((s, i) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="text-[10px] text-white/50 w-16 flex-shrink-0 truncate">{s.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${s.value}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI insights — on-demand (spends credits), cached per project version */}
        <div className="col-span-2 p-3 rounded-lg bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 border border-violet-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-white/70 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-300" /> AI Insights
            </span>
            {insights && (
              <button
                onClick={generateInsights}
                disabled={insightsLoading}
                className="text-[10px] text-violet-300 hover:text-violet-200 flex items-center gap-1 disabled:opacity-50"
                title="Regenerate (uses AI credits)"
              >
                <RefreshCw className={`w-3 h-3 ${insightsLoading ? "animate-spin" : ""}`} /> Refresh
              </button>
            )}
          </div>

          {insights ? (
            <div className="space-y-2.5">
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
                Generate a summary of this experience plus prioritized recommendations. Uses AI credits.
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

        <div className="p-2 rounded-lg bg-white/5 text-center">
          <Layers className="w-3.5 h-3.5 text-violet-400 mx-auto mb-1" />
          <p className="text-sm font-bold text-white">{elements.length}</p>
          <p className="text-[9px] text-white/40">Elements</p>
        </div>
        <div className="p-2 rounded-lg bg-white/5 text-center">
          <Tag className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-1" />
          <p className="text-sm font-bold text-white">{taggedCount}</p>
          <p className="text-[9px] text-white/40">Tagged</p>
        </div>

        <div className="col-span-2 flex items-center gap-1.5 text-xs text-white/40">
          <Calendar className="w-3.5 h-3.5" />
          Updated {new Date(project.updatedAt).toLocaleDateString()}
        </div>

        <div className="col-span-2 flex flex-col gap-2 pt-1">
          <button
            onClick={() => onEnterProject(project.id)}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Enter Canvas
          </button>
          <button
            onClick={() => router.push(`/cxd/overview/${project.id}`)}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm font-medium transition-colors border border-white/10"
          >
            <Eye className="w-4 h-4" />
            Full Overview
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Quick actions — same set as the project tile, brought in below Full Overview */}
          <div className="flex items-center justify-center gap-1.5 pt-0.5">
            {onAddCover &&
              iconAction("cover", "Add Cover Image", <ImagePlus className="w-4 h-4" />, onAddCover, "hover:bg-emerald-500/30 hover:text-white hover:border-emerald-500/30")}
            {isOwner && onInvite &&
              iconAction("invite", "Invite Collaborators", <UserPlus className="w-4 h-4" />, onInvite, "hover:bg-violet-500/30 hover:text-white hover:border-violet-500/30")}
            {iconAction("overview", "Project Overview", <BarChart3 className="w-4 h-4" />, () => router.push(`/cxd/overview/${project.id}`), "hover:bg-purple-500/30 hover:text-white hover:border-purple-500/30")}
            {onRename &&
              iconAction("rename", "Rename", <Pencil className="w-4 h-4" />, onRename, "hover:bg-blue-500/30 hover:text-white hover:border-blue-500/30")}
            {isOwner && canDelete && onDelete &&
              iconAction("delete", "Delete", <Trash2 className="w-4 h-4" />, onDelete, "hover:bg-red-500/30 hover:text-red-400 hover:border-red-500/30")}
          </div>
        </div>
      </div>
    </div>
  );
}
