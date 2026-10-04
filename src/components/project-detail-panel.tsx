"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Loader2, X, Sparkles,
  ImagePlus, UserPlus, BarChart3, Pencil, Trash2, Lightbulb, RefreshCw, ChevronRight,
} from "lucide-react";
import { fetchProjectById } from "@/lib/supabase-projects";
import { queryTasks } from "@/utils/task-engine";
import { SENSORY_DOMAINS } from "@/types/cxd-schema";
import { calculateOKRProgress, calculateObjectiveProgress, OKR_STATUS_CONFIG } from "@/types/version-types";
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

  // First objectives across all OKRs, with a few key results each (OKRs card).
  const objectiveRows = useMemo(
    () =>
      okrs
        .flatMap((o) => o.objectives || [])
        .slice(0, 3)
        .map((obj) => ({
          title: obj.title || "Objective",
          progress: calculateObjectiveProgress(obj),
          keyResults: (obj.keyResults || []).slice(0, 3).map((kr) => ({ text: kr.description || "Key result", done: kr.completed })),
        })),
    [okrs],
  );

  // Roadmap card: the version in flight (else the next draft), a sparkline of
  // how far along each version is, and the nearest open deadline.
  const STATUS_PROGRESS: Record<string, number> = { complete: 100, testing: 75, active: 50, draft: 8 };
  const sortedVersions = useMemo(() => [...versions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [versions]);
  const currentVersion =
    sortedVersions.find((v) => v.status === "active" || v.status === "testing") ??
    sortedVersions.find((v) => v.status === "draft") ??
    sortedVersions[sortedVersions.length - 1];
  const sparkPoints = sortedVersions.map((v) => STATUS_PROGRESS[v.status] ?? 8);
  const nextDeadline = sortedVersions
    .filter((v) => v.status !== "complete" && v.targetDate)
    .map((v) => v.targetDate as string)
    .sort()[0];

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
      className={`w-[7.4cqw] h-[7.4cqw] flex items-center justify-center rounded-full bg-violet-950/70 text-white/85 border border-white/10 transition-colors ${hoverClass}`}
      title={label}
    >
      {icon}
    </button>
  );

  // Donut: the ring shows the work still open (by status), the centre shows done/total.
  const ring = [
    { key: "blocked", n: taskStats.blocked, color: "#c0463c" },
    { key: "progress", n: taskStats.inProgress, color: "#c9c455" },
    { key: "todo", n: taskStats.notStarted, color: "#6f6f75" },
  ];
  const ringTotal = ring.reduce((t, r) => t + r.n, 0);
  const R = 38;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const arcs = ringTotal === 0
    ? [{ key: "all", n: 0, color: taskStats.total > 0 ? "#34d399" : "#3a3a44", dash: C, offset: 0, mid: 0 }]
    : ring.filter((r) => r.n > 0).map((r) => {
        const len = (r.n / ringTotal) * C;
        const arc = { ...r, dash: len, offset: -acc, mid: ((acc + len / 2) / C) * 2 * Math.PI - Math.PI / 2 };
        acc += len;
        return arc;
      });

  const card = "rounded-[2.4cqw] border-2 border-violet-400/35 bg-black/90 p-[2.2cqw] flex flex-col min-w-0";
  const cardTitle = "text-center uppercase tracking-[0.12em] font-semibold text-white text-[3cqw] leading-none";

  return (
    // aspect-square + self-start gives the panel a DEFINITE height equal to its
    // own width, so it spans the 2x2 tile area without stretching grid rows.
    // Sizes use container-query units (cqw) so the whole layout scales with the
    // panel instead of being a fixed-px design.
    <div
      className="col-span-2 row-span-2 self-start aspect-square rounded-[2.6cqw] overflow-hidden bg-black border-2 border-violet-400/30 flex flex-col"
      style={{ containerType: "inline-size" }}
    >
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Cover: full-bleed, fading into the page */}
        <div className="relative h-[34cqw]">
          {coverImage && coverImage.startsWith("http") ? (
            <Image src={coverImage} alt={project.name} fill className="object-cover" unoptimized />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/70 via-purple-800/50 to-indigo-900/70" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-[2.2cqw] right-[2.2cqw] w-[6cqw] h-[6cqw] flex items-center justify-center rounded-full bg-black/55 hover:bg-black/75 text-white/75 hover:text-white transition-colors z-10"
            title="Close"
          >
            <X className="w-[3.2cqw] h-[3.2cqw]" />
          </button>
          <h3 className="absolute bottom-[3cqw] left-[4cqw] right-[4cqw] font-bold text-white text-[3.6cqw] leading-tight truncate drop-shadow">
            {project.name}
          </h3>
        </div>

        <div className="px-[4cqw] pb-[3.5cqw] space-y-[3cqw]">
          {/* Actions + primary button */}
          <div className="flex items-center justify-between gap-[2cqw]">
            <div className="flex items-center gap-[1.4cqw]">
              {onAddCover &&
                iconAction("cover", "Add Cover Image", <ImagePlus className="w-[3.2cqw] h-[3.2cqw]" />, onAddCover, "hover:bg-emerald-500/40 hover:text-white")}
              {isOwner && onInvite &&
                iconAction("invite", "Invite Collaborators", <UserPlus className="w-[3.2cqw] h-[3.2cqw]" />, onInvite, "hover:bg-violet-500/40 hover:text-white")}
              {iconAction("overview", "Project Overview", <BarChart3 className="w-[3.2cqw] h-[3.2cqw]" />, () => router.push(`/cxd/overview/${project.id}`), "hover:bg-purple-500/40 hover:text-white")}
              {onRename &&
                iconAction("rename", "Rename", <Pencil className="w-[3.2cqw] h-[3.2cqw]" />, onRename, "hover:bg-blue-500/40 hover:text-white")}
              {isOwner && canDelete && onDelete &&
                iconAction("delete", "Delete", <Trash2 className="w-[3.2cqw] h-[3.2cqw]" />, onDelete, "hover:bg-red-500/40 hover:text-red-300")}
            </div>
            <button
              onClick={() => onEnterProject(project.id)}
              className="px-[4cqw] py-[1.6cqw] rounded-[1cqw] border border-violet-400/50 hover:border-violet-300 hover:bg-violet-500/15 text-white uppercase tracking-[0.1em] font-medium text-[3cqw] leading-none transition-colors"
              title="Open this canvas"
            >
              Open canvas
            </button>
          </div>

          {(concept || project.description) && (
            <p className="text-white/85 text-[2.5cqw] leading-snug line-clamp-3">{concept || project.description}</p>
          )}

          {/* Tasks / OKRs / Roadmap */}
          <div className="grid grid-cols-3 gap-[2.4cqw]">
            {/* TASKS */}
            <div className={card}>
              <h4 className={cardTitle}>Tasks</h4>
              <div className="relative mt-[1.6cqw] mx-auto w-full max-w-[24cqw] aspect-square">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r={R} fill="none" stroke="#1d1d24" strokeWidth="14" />
                  {arcs.map((a) => (
                    <circle
                      key={a.key}
                      cx="50" cy="50" r={R} fill="none"
                      stroke={a.color} strokeWidth="14"
                      strokeDasharray={`${Math.max(0, a.dash - (arcs.length > 1 ? 0.8 : 0))} ${C}`}
                      strokeDashoffset={a.offset}
                    />
                  ))}
                </svg>
                {/* counts on the segments (unrotated overlay) */}
                {ringTotal > 0 && arcs.map((a) => (
                  <span
                    key={`l-${a.key}`}
                    className="absolute text-white font-semibold text-[2.1cqw] leading-none -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${50 + Math.cos(a.mid) * R}%`, top: `${50 + Math.sin(a.mid) * R}%` }}
                  >
                    {a.n}
                  </span>
                ))}
                <span className="absolute inset-0 flex items-center justify-center text-white font-medium text-[4.2cqw] tabular-nums">
                  {taskStats.done}/{taskStats.total}
                </span>
              </div>
              <p className="mt-[1.4cqw] text-center text-[1.5cqw] leading-tight text-white/55">
                {taskStats.notStarted} to do · <span className="text-amber-300/85">{taskStats.inProgress} in progress</span>
                {taskStats.blocked > 0 && <> · <span className="text-rose-300/85">{taskStats.blocked} blocked</span></>}
              </p>
            </div>

            {/* OKRS */}
            <div className={card}>
              <h4 className={cardTitle}>OKRs</h4>
              {objectiveRows.length === 0 ? (
                <p className="flex-1 flex items-center justify-center text-center text-white/35 text-[1.9cqw] mt-[2cqw]">No OKRs yet</p>
              ) : (
                <div className="mt-[2cqw] space-y-[2cqw]">
                  {objectiveRows.map((o, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr] gap-x-[1.4cqw] items-center">
                      <div className="min-w-0">
                        <p className="text-white/85 text-[1.7cqw] leading-tight truncate" title={o.title}>{o.title}</p>
                        <div className="mt-[0.8cqw] h-[1.9cqw] rounded-full bg-black border border-white/70 overflow-hidden">
                          <div className="h-full bg-emerald-400/90" style={{ width: `${o.progress}%` }} />
                        </div>
                      </div>
                      <ul className="min-w-0 space-y-[0.3cqw]">
                        {o.keyResults.length === 0 && <li className="text-[1.4cqw] text-white/30">No key results</li>}
                        {o.keyResults.map((k, j) => (
                          <li key={j} className="flex items-center gap-[0.6cqw] text-[1.4cqw] leading-tight text-white/80 min-w-0">
                            <span className={`flex-shrink-0 w-[1cqw] h-[1cqw] rounded-full border ${k.done ? "bg-amber-300 border-amber-300" : "border-white/70"}`} />
                            <span className={`truncate ${k.done ? "line-through opacity-70" : ""}`}>{k.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ROADMAP */}
            <div className={card}>
              <h4 className={cardTitle}>Roadmap</h4>
              {currentVersion ? (
                <>
                  <div className="mt-[2cqw] flex items-center gap-[1.4cqw] min-w-0">
                    <span
                      className="flex-shrink-0 w-[5cqw] h-[5cqw] rounded-full"
                      style={{ background: `radial-gradient(circle at 35% 30%, ${currentVersion.color || "#a78bfa"}, #1e1b4b)` }}
                    />
                    <span className="min-w-0 truncate px-[1.6cqw] py-[1cqw] rounded-[0.8cqw] bg-indigo-900/80 text-white text-[2.6cqw] leading-none">
                      {currentVersion.name}
                    </span>
                  </div>
                  <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="mt-[1.6cqw] w-full h-[10cqw] overflow-visible">
                    <path d="M2 38 H98 M2 2 V38" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" fill="none" vectorEffect="non-scaling-stroke" />
                    {sparkPoints.length > 1 && (() => {
                      const pts = sparkPoints.map((v, i) => [4 + (i / (sparkPoints.length - 1)) * 92, 36 - (v / 100) * 32] as const);
                      const d = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");
                      return (
                        <>
                          <path d={d} fill="none" stroke="#6d5bd0" strokeWidth="1.4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                          {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.6" fill="#8b7bf0" />)}
                        </>
                      );
                    })()}
                  </svg>
                  <p className="mt-[1.4cqw] text-center text-white text-[2.1cqw] leading-tight">
                    {nextDeadline ? <>Deadline: {new Date(nextDeadline).toLocaleDateString()}</> : <span className="text-white/45">{completedVersions}/{versions.length} versions done</span>}
                  </p>
                </>
              ) : (
                <p className="flex-1 flex items-center justify-center text-center text-white/35 text-[1.9cqw] mt-[2cqw]">No versions yet</p>
              )}
            </div>
          </div>

          {/* AI insights: on-demand (spends credits), collapsed by default */}
          <details className="group rounded-[1.8cqw] bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 border border-violet-500/20">
            <summary className="flex items-center justify-between cursor-pointer list-none px-[3cqw] py-[2.2cqw] text-white/85 text-[2.8cqw]">
              <span className="flex items-center gap-[1.6cqw]">
                <Lightbulb className="w-[3.2cqw] h-[3.2cqw] text-amber-300" /> AI Insights
              </span>
              <ChevronRight className="w-[3cqw] h-[3cqw] text-white/40 group-open:rotate-90 transition-transform" />
            </summary>
            <div className="px-[3cqw] pb-[3cqw]">
              {insights ? (
                <div className="space-y-[2cqw]">
                  <div className="flex justify-end">
                    <button
                      onClick={generateInsights}
                      disabled={insightsLoading}
                      className="text-[1.8cqw] text-violet-300 hover:text-violet-200 flex items-center gap-1 disabled:opacity-50"
                      title="Regenerate (uses AI credits)"
                    >
                      <RefreshCw className={`w-[2cqw] h-[2cqw] ${insightsLoading ? "animate-spin" : ""}`} /> Refresh
                    </button>
                  </div>
                  <p className="text-[2.2cqw] text-white/80 leading-relaxed">{insights.summary}</p>
                  {insights.recommendations.length > 0 && (
                    <div>
                      <p className="text-[1.7cqw] uppercase tracking-wide text-violet-300/70 mb-1">Prioritize</p>
                      <ol className="space-y-1">
                        {insights.recommendations.map((r, i) => (
                          <li key={i} className="text-[2cqw] text-white/75 flex gap-[1cqw]">
                            <span className="text-violet-400 font-semibold flex-shrink-0">{i + 1}.</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-[2cqw]">
                  <p className="text-[2cqw] text-white/45">
                    A summary of this experience plus prioritized recommendations. Uses AI credits.
                  </p>
                  {insightsError && <p className="text-[2cqw] text-rose-300">{insightsError}</p>}
                  <button
                    onClick={generateInsights}
                    disabled={insightsLoading}
                    className="flex items-center justify-center gap-[1.4cqw] w-full px-[3cqw] py-[1.8cqw] rounded-[1.2cqw] bg-violet-600/80 hover:bg-violet-500 text-white text-[2.3cqw] font-medium transition-colors disabled:opacity-60"
                  >
                    {insightsLoading ? (
                      <>
                        <Loader2 className="w-[2.6cqw] h-[2.6cqw] animate-spin" /> Generating…
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-[2.6cqw] h-[2.6cqw]" /> Generate AI insights
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
