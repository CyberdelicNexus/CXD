"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Loader2, X, Sparkles, Camera, Check,
  ImagePlus, UserPlus, BarChart3, Pencil, Trash2, Lightbulb, RefreshCw, ChevronRight,
  Layers, Eye, Radio, Brain, Heart, Globe, Target, Ear, Wind, Apple, Fingerprint,
  ListTodo, Flag, Map as MapIcon, Clock, Shapes,
} from "lucide-react";
import { fetchProjectById } from "@/lib/supabase-projects";
import { queryTasks } from "@/utils/task-engine";
import { SENSORY_DOMAINS } from "@/types/cxd-schema";
import { calculateOKRProgress, calculateObjectiveProgress } from "@/types/version-types";
import { HYPERCUBE_FACE_TAGS, type CanvasElement, type HypercubeFaceTag } from "@/types/canvas-elements";
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
  /** Persist a new cover framing (object-position in %). Resolves true on success. */
  onSaveCoverPosition?: (position: { x: number; y: number }) => Promise<boolean> | boolean;
}

// Same face icons as the canvas tag badge and the right-hand face panel.
const FACE_ICON: Record<HypercubeFaceTag, React.ComponentType<{ className?: string }>> = {
  "Reality Planes": Layers,
  "Sensory Domains": Eye,
  "Presence Types": Radio,
  "State Mapping": Brain,
  "Trait Mapping": Heart,
  "Meaning Architecture": Globe,
  "Core": Target,
};
const SENSE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  visual: Eye, auditory: Ear, olfactory: Wind, gustatory: Apple, haptic: Fingerprint,
};

const DAY = 86_400_000;
function relDay(iso?: string | null): string {
  if (!iso) return "";
  const d = Math.round((new Date(iso).getTime() - Date.now()) / DAY);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  return d > 0 ? `in ${d}d` : `${-d}d ago`;
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
  onSaveCoverPosition,
}: ProjectDetailPanelProps) {
  const router = useRouter();
  const [project, setProject] = useState<CXDProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Cover framing: drag the image to reposition, then save or cancel.
  const [repositioning, setRepositioning] = useState(false);
  const [coverPos, setCoverPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [savedPos, setSavedPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [savingPos, setSavingPos] = useState(false);

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
      if (p) {
        setProject(p);
        const cp = (p as { coverPosition?: { x: number; y: number } }).coverPosition;
        const pos = cp && typeof cp.x === "number" && typeof cp.y === "number" ? cp : { x: 50, y: 50 };
        setCoverPos(pos);
        setSavedPos(pos);
        setRepositioning(false);
      }
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

  const objectiveRows = useMemo(
    () =>
      okrs
        .flatMap((o) => o.objectives || [])
        .slice(0, 3)
        .map((obj) => ({
          title: obj.title || "Objective",
          progress: calculateObjectiveProgress(obj),
          krDone: (obj.keyResults || []).filter((k) => k.completed).length,
          krTotal: (obj.keyResults || []).length,
        })),
    [okrs],
  );
  const okrOverall = okrs.length > 0 ? Math.round(okrs.reduce((t, o) => t + calculateOKRProgress(o), 0) / okrs.length) : 0;

  const sortedVersions = useMemo(() => [...versions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [versions]);
  const currentVersion =
    sortedVersions.find((v) => v.status === "active" || v.status === "testing") ??
    sortedVersions.find((v) => v.status === "draft") ??
    sortedVersions[sortedVersions.length - 1];
  const nextDeadlineVersion = sortedVersions
    .filter((v) => v.status !== "complete" && v.targetDate)
    .sort((a, b) => (a.targetDate as string).localeCompare(b.targetDate as string))[0];

  // Canvas coverage per hypercube face: how many elements carry each tag.
  const faceCounts = useMemo(() => {
    const counts = Object.fromEntries(HYPERCUBE_FACE_TAGS.map((t) => [t, 0])) as Record<HypercubeFaceTag, number>;
    for (const e of elements) for (const t of e.hypercubeTags || []) if (t in counts) counts[t as HypercubeFaceTag]++;
    return counts;
  }, [elements]);
  const facesCovered = HYPERCUBE_FACE_TAGS.filter((t) => faceCounts[t] > 0).length;
  const contentCount = useMemo(() => elements.filter((e) => e.type !== "line" && e.type !== "connector" && !e.inInbox).length, [elements]);

  // Open tasks with a due date, soonest first (overdue sorts to the top).
  const dueTasks = useMemo(() => {
    const { tasks } = queryTasks(elements, {
      filter: { showCompleted: false, includeImplicitTasks: true, includeExplicitTasks: true, includeTaggedCards: true },
      sort: [],
    });
    return tasks
      .filter((t) => t.dueDate && t.status !== "completed")
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  }, [elements]);
  const overdueCount = dueTasks.filter((t) => new Date(t.dueDate as string).getTime() < Date.now() - DAY).length;
  const openTasks = taskStats.total - taskStats.done;

  const concept = project?.intentionCore?.mainConcept || project?.intentionCore?.coreMessage;

  const sensoryBars = useMemo(
    () =>
      SENSORY_DOMAINS
        .map((s) => ({ code: s.code as string, label: s.label, value: project?.sensoryDomains?.[s.code] ?? 0 }))
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
      className={`w-9 h-9 flex items-center justify-center rounded-full bg-violet-950/70 text-white/85 border border-white/10 transition-colors ${hoverClass}`}
      title={label}
    >
      {icon}
    </button>
  );

  const R = 38;
  const C = 2 * Math.PI * R;
  // Donut: done / in progress / blocked / to do as full-ring shares of the total.
  const ringSegs = [
    { key: "done", n: taskStats.done, color: "#34d399", label: "Done" },
    { key: "progress", n: taskStats.inProgress, color: "#fbbf24", label: "In progress" },
    { key: "blocked", n: taskStats.blocked, color: "#f87171", label: "Blocked" },
    { key: "todo", n: taskStats.notStarted, color: "#71717a", label: "To do" },
  ];
  let acc = 0;
  const arcs = taskStats.total === 0 ? [] : ringSegs.filter((r) => r.n > 0).map((r) => {
    const len = (r.n / taskStats.total) * C;
    const arc = { ...r, len, offset: -acc };
    acc += len;
    return arc;
  });

  // Radar of face coverage (7 spokes, scaled to the busiest face).
  const faces = HYPERCUBE_FACE_TAGS;
  const maxFace = Math.max(1, ...faces.map((t) => faceCounts[t]));
  const radarPt = (i: number, r: number) => {
    const a = (i / faces.length) * Math.PI * 2 - Math.PI / 2;
    return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r] as const;
  };
  const radarPoly = faces.map((t, i) => radarPt(i, 8 + (faceCounts[t] / maxFace) * 30).join(",")).join(" ");

  const card = "rounded-xl border border-violet-500/20 bg-white/[0.03] p-3.5 min-w-0";
  const cardHead = (icon: React.ReactNode, label: string, right?: React.ReactNode) => (
    <div className="flex items-center justify-between mb-3">
      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
        {icon}{label}
      </span>
      {right}
    </div>
  );

  const startReposition = () => {
    setSavedPos(coverPos);
    setRepositioning(true);
  };
  const cancelReposition = () => {
    setCoverPos(savedPos);
    setRepositioning(false);
  };
  const saveReposition = async () => {
    setSavingPos(true);
    try {
      const ok = onSaveCoverPosition ? await onSaveCoverPosition(coverPos) : true;
      if (ok) {
        setSavedPos(coverPos);
        setRepositioning(false);
      }
    } finally {
      setSavingPos(false);
    }
  };
  const onCoverPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Buttons on the cover (Save / Cancel) must receive their own clicks.
    if (!repositioning || (e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, pos: coverPos };
    const move = (ev: PointerEvent) => {
      // Dragging the image right/down reveals its left/top: positions move opposite.
      const nx = Math.max(0, Math.min(100, start.pos.x - ((ev.clientX - start.x) / rect.width) * 100));
      const ny = Math.max(0, Math.min(100, start.pos.y - ((ev.clientY - start.y) / rect.height) * 100));
      setCoverPos({ x: nx, y: ny });
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  return (
    // aspect-square + self-start gives the panel a definite height equal to its
    // width (the 2x2 tile area) so long content scrolls instead of stretching the grid.
    <div className="col-span-2 row-span-2 self-start aspect-square rounded-xl overflow-hidden bg-[#0a0712] border border-violet-500/30 flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Cover */}
        <div
          className={`relative h-44 flex-shrink-0 ${repositioning ? "cursor-grab active:cursor-grabbing touch-none select-none" : ""}`}
          onPointerDown={onCoverPointerDown}
        >
          {coverImage && coverImage.startsWith("http") ? (
            <Image
              src={coverImage}
              alt={project.name}
              fill
              draggable={false}
              className="object-cover pointer-events-none"
              style={{ objectPosition: `${coverPos.x}% ${coverPos.y}%` }}
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/70 via-purple-800/50 to-indigo-900/70" />
          )}
          <div className={`absolute inset-0 bg-gradient-to-t from-[#0a0712] via-[#0a0712]/30 to-transparent ${repositioning ? "opacity-40" : ""} pointer-events-none`} />
          {!repositioning && (
            <>
              <button
                onClick={onClose}
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/55 hover:bg-black/75 text-white/75 hover:text-white transition-colors z-10"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
              {coverImage && coverImage.startsWith("http") && onSaveCoverPosition && (
                <button
                  onClick={startReposition}
                  className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 h-8 rounded-full bg-black/55 hover:bg-black/75 text-white/80 hover:text-white text-xs transition-colors"
                  title="Reposition cover image"
                >
                  <Camera className="w-3.5 h-3.5" /> Reposition
                </button>
              )}
              <div className="absolute bottom-3 left-5 right-5 pointer-events-none">
                <h3 className="font-bold text-white text-2xl leading-tight truncate drop-shadow">{project.name}</h3>
                <p className="text-xs text-white/60 mt-0.5">
                  Edited {relDay(project.updatedAt)} · {contentCount} element{contentCount === 1 ? "" : "s"}
                </p>
              </div>
            </>
          )}
          {repositioning && (
            <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2 z-10">
              <span className="px-3 py-1.5 rounded-full bg-black/60 text-white/80 text-xs">Drag to reposition</span>
              <button onClick={cancelReposition} disabled={savingPos} className="px-3 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs">Cancel</button>
              <button onClick={saveReposition} disabled={savingPos} className="px-3 h-8 rounded-full bg-emerald-500/90 hover:bg-emerald-400 text-black text-xs font-medium flex items-center gap-1.5">
                {savingPos ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
              </button>
            </div>
          )}
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
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
            <button
              onClick={() => onEnterProject(project.id)}
              className="px-5 h-9 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-sm font-medium tracking-wide shadow-lg shadow-violet-900/40 transition-colors"
              title="Open this canvas"
            >
              Open canvas
            </button>
          </div>

          {(concept || project.description) && (
            <p className="text-sm text-white/75 leading-relaxed line-clamp-3">{concept || project.description}</p>
          )}

          {/* At a glance */}
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(104px, 1fr))" }}>
            {[
              { icon: <Shapes className="w-3.5 h-3.5 text-violet-300" />, value: contentCount, label: "Elements", tone: "text-white" },
              { icon: <Layers className="w-3.5 h-3.5 text-cyan-300" />, value: `${facesCovered}/${faces.length}`, label: "Faces", tone: facesCovered === faces.length ? "text-emerald-300" : "text-white" },
              { icon: <ListTodo className="w-3.5 h-3.5 text-amber-300" />, value: openTasks, label: "Open tasks", tone: overdueCount > 0 ? "text-rose-300" : "text-white" },
              { icon: <Flag className="w-3.5 h-3.5 text-fuchsia-300" />, value: currentVersion ? currentVersion.name : "—", label: "Version", tone: "text-white" },
            ].map((k, i) => (
              <div key={i} className="rounded-xl border border-violet-500/15 bg-white/[0.03] px-3 py-2.5 min-w-0">
                <div className="flex items-center gap-1.5">{k.icon}<span className="text-[10px] uppercase tracking-wider text-white/45 truncate">{k.label}</span></div>
                <p className={`mt-1 text-xl font-semibold leading-none truncate ${k.tone}`}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
            {/* Tasks */}
            <div className={card}>
              {cardHead(<ListTodo className="w-3.5 h-3.5 text-amber-300" />, "Tasks")}
              {taskStats.total === 0 ? (
                <p className="text-xs text-white/40 py-6 text-center">No tasks on this canvas yet.</p>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <div className="relative w-24 h-24 flex-shrink-0">
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                        <circle cx="50" cy="50" r={R} fill="none" stroke="#1d1a28" strokeWidth="13" />
                        {arcs.map((a) => (
                          <circle key={a.key} cx="50" cy="50" r={R} fill="none" stroke={a.color} strokeWidth="13"
                            strokeDasharray={`${Math.max(0, a.len - (arcs.length > 1 ? 1 : 0))} ${C}`} strokeDashoffset={a.offset} />
                        ))}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-semibold text-white leading-none tabular-nums">{taskDone}%</span>
                        <span className="text-[10px] text-white/45 mt-0.5">{taskStats.done}/{taskStats.total}</span>
                      </div>
                    </div>
                    <ul className="space-y-1 text-xs min-w-0">
                      {ringSegs.map((r) => (
                        <li key={r.key} className="flex items-center gap-2 text-white/70">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
                          <span className="truncate">{r.label}</span>
                          <span className="ml-auto text-white tabular-nums">{r.n}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {dueTasks.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-white/40">Due next</p>
                      {dueTasks.slice(0, 3).map((t, i) => {
                        const late = new Date(t.dueDate as string).getTime() < Date.now() - DAY;
                        return (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <Clock className={`w-3 h-3 flex-shrink-0 ${late ? "text-rose-300" : "text-white/40"}`} />
                            <span className="truncate text-white/80">{t.title}</span>
                            <span className={`ml-auto flex-shrink-0 ${late ? "text-rose-300" : "text-white/50"}`}>{relDay(t.dueDate as string)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Hypercube coverage */}
            <div className={card}>
              {cardHead(<Layers className="w-3.5 h-3.5 text-cyan-300" />, "Hypercube", <span className="text-[11px] text-white/45">{facesCovered}/{faces.length} faces</span>)}
              <div className="relative mx-auto w-full max-w-[210px] aspect-square">
                <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible">
                  {[0.35, 0.7, 1].map((k) => (
                    <polygon key={k} points={faces.map((_, i) => radarPt(i, 8 + k * 30).join(",")).join(" ")} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
                  ))}
                  {faces.map((_, i) => {
                    const [x, y] = radarPt(i, 38);
                    return <line key={i} x1="50" y1="50" x2={x} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />;
                  })}
                  <polygon points={radarPoly} fill="rgba(139,92,246,0.28)" stroke="#a78bfa" strokeWidth="1" strokeLinejoin="round" />
                  {faces.map((t, i) => {
                    const [x, y] = radarPt(i, 8 + (faceCounts[t] / maxFace) * 30);
                    return faceCounts[t] > 0 ? <circle key={t} cx={x} cy={y} r="1.6" fill="#c4b5fd" /> : null;
                  })}
                </svg>
                {faces.map((t, i) => {
                  const [x, y] = radarPt(i, 47);
                  const Icon = FACE_ICON[t];
                  const has = faceCounts[t] > 0;
                  return (
                    <span
                      key={t}
                      title={`${t}: ${faceCounts[t]}`}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center border ${has ? "bg-violet-500/25 border-violet-400/50 text-cyan-200" : "bg-white/5 border-white/10 text-white/30"}`}
                      style={{ left: `${x}%`, top: `${y}%` }}
                    >
                      <Icon className="w-3 h-3" />
                    </span>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-white/45 text-center">
                {facesCovered === faces.length ? "Every face has content" : `Missing: ${faces.filter((t) => faceCounts[t] === 0).slice(0, 2).join(", ")}${faces.filter((t) => faceCounts[t] === 0).length > 2 ? "…" : ""}`}
              </p>
            </div>

            {/* Roadmap */}
            <div className={card}>
              {cardHead(<MapIcon className="w-3.5 h-3.5 text-violet-300" />, "Roadmap", <span className="text-[11px] text-white/45">{completedVersions}/{versions.length} done</span>)}
              {sortedVersions.length === 0 ? (
                <p className="text-xs text-white/40 py-6 text-center">No versions planned yet.</p>
              ) : (
                <>
                  <div className="relative flex items-start justify-between px-1 pt-1">
                    <div className="absolute left-3 right-3 top-[11px] h-px bg-white/10" />
                    {sortedVersions.slice(0, 6).map((v) => {
                      const isCur = currentVersion?.id === v.id;
                      const done = v.status === "complete";
                      return (
                        <div key={v.id} className="relative flex flex-col items-center gap-1.5 min-w-0 flex-1">
                          <span
                            className={`w-[22px] h-[22px] rounded-full flex items-center justify-center border-2 ${done ? "bg-emerald-400/90 border-emerald-300 text-black" : isCur ? "border-violet-300 bg-violet-600 shadow-[0_0_14px_rgba(139,92,246,0.7)]" : "border-white/25 bg-[#0a0712]"}`}
                          >
                            {done && <Check className="w-3 h-3" />}
                          </span>
                          <span className={`text-[10px] truncate max-w-full ${isCur ? "text-white" : "text-white/50"}`} title={v.name}>{v.name}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/5 text-xs flex items-center justify-between gap-2">
                    <span className="text-white/60 truncate">{currentVersion?.name}{currentVersion?.type_label && currentVersion.type_label !== currentVersion.name ? ` · ${currentVersion.type_label}` : ""}</span>
                    <span className={`flex-shrink-0 ${nextDeadlineVersion && new Date(nextDeadlineVersion.targetDate as string).getTime() < Date.now() ? "text-rose-300" : "text-white/80"}`}>
                      {nextDeadlineVersion ? `Due ${new Date(nextDeadlineVersion.targetDate as string).toLocaleDateString()}` : "No deadline set"}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* OKRs */}
            <div className={card}>
              {cardHead(<Target className="w-3.5 h-3.5 text-emerald-300" />, "OKRs", okrs.length > 0 ? <span className="text-[11px] text-white/45">{okrOverall}% overall</span> : undefined)}
              {objectiveRows.length === 0 ? (
                <p className="text-xs text-white/40 py-6 text-center">No objectives defined yet.</p>
              ) : (
                <div className="space-y-3">
                  {objectiveRows.map((o, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-white/80" title={o.title}>{o.title}</span>
                        <span className="flex-shrink-0 text-white/50 tabular-nums">{o.krTotal > 0 ? `${o.krDone}/${o.krTotal} KR` : `${o.progress}%`}</span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400" style={{ width: `${o.progress}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sensory profile */}
          {sensoryBars.length > 0 && (
            <div className={card}>
              {cardHead(<Eye className="w-3.5 h-3.5 text-sky-300" />, "Sensory profile")}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                {sensoryBars.map((sb) => {
                  const Icon = SENSE_ICON[sb.code] ?? Eye;
                  const pct = Math.max(0, Math.min(100, sb.value));
                  return (
                    <div key={sb.code} className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-3.5 h-3.5 text-sky-300/80 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-[11px] text-white/65"><span>{sb.label}</span><span className="tabular-nums">{Math.round(pct)}</span></div>
                        <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-400" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI insights: on-demand (spends credits), collapsed by default */}
          <details className="group rounded-xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 border border-violet-500/20">
            <summary className="flex items-center justify-between cursor-pointer list-none px-4 py-3 text-sm text-white/85">
              <span className="flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-300" /> AI Insights</span>
              <ChevronRight className="w-4 h-4 text-white/40 group-open:rotate-90 transition-transform" />
            </summary>
            <div className="px-4 pb-4">
              {insights ? (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <button onClick={generateInsights} disabled={insightsLoading} className="text-xs text-violet-300 hover:text-violet-200 flex items-center gap-1 disabled:opacity-50" title="Regenerate (uses AI credits)">
                      <RefreshCw className={`w-3 h-3 ${insightsLoading ? "animate-spin" : ""}`} /> Refresh
                    </button>
                  </div>
                  <p className="text-sm text-white/80 leading-relaxed">{insights.summary}</p>
                  {insights.recommendations.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-violet-300/70 mb-1">Prioritize</p>
                      <ol className="space-y-1">
                        {insights.recommendations.map((r, i) => (
                          <li key={i} className="text-xs text-white/75 flex gap-2"><span className="text-violet-400 font-semibold flex-shrink-0">{i + 1}.</span><span>{r}</span></li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-white/45">A summary of this experience plus prioritized recommendations. Uses AI credits.</p>
                  {insightsError && <p className="text-xs text-rose-300">{insightsError}</p>}
                  <button onClick={generateInsights} disabled={insightsLoading} className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-violet-600/80 hover:bg-violet-500 text-white text-xs font-medium transition-colors disabled:opacity-60">
                    {insightsLoading ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>) : (<><Sparkles className="w-3.5 h-3.5" /> Generate AI insights</>)}
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
