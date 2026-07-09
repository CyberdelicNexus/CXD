"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, X, LogIn, Eye, Layers, ListTodo, Tag, Calendar, ArrowRight, Sparkles } from "lucide-react";
import { fetchProjectById } from "@/lib/supabase-projects";
import { queryTasks } from "@/utils/task-engine";
import { SENSORY_DOMAINS } from "@/types/cxd-schema";
import type { CanvasElement } from "@/types/canvas-elements";
import type { CXDProject } from "@/types/cxd-schema";

interface ProjectDetailPanelProps {
  projectId: string;
  onClose: () => void;
  onEnterProject: (projectId: string) => void;
}

const BAR_COLORS = ["#8B5CF6", "#22D3EE", "#F472B6", "#34D399", "#F97316"];

/**
 * Overview snapshot for a selected project card — lives INSIDE the same grid
 * as the project tiles (col-span-2 row-span-2, so its height is naturally
 * "two squares tall" since implicit rows auto-size to the aspect-square
 * tiles), not an external sidebar. Fetched via fetchProjectById (single
 * project, RLS-respecting client call), NOT the full read-only canvas
 * renderer used by /cxd/overview/[projectId] — that page loads the whole
 * project into the global Zustand store, the wrong side effect to trigger
 * just from selecting a card in a list.
 */
export function ProjectDetailPanel({ projectId, onClose, onEnterProject }: ProjectDetailPanelProps) {
  const router = useRouter();
  const [project, setProject] = useState<CXDProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setProject(null);
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
  const elements: CanvasElement[] = [
    ...(project.canvasLayout?.elements || []),
    ...((project.canvasLayout?.boards || []).flatMap((b) => b.nodes || [])),
  ];
  const { tasks } = queryTasks(elements, {
    filter: { showCompleted: true, includeImplicitTasks: true, includeExplicitTasks: true, includeTaggedCards: true },
    sort: [],
  });
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const taskProgress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const taggedCount = elements.filter((e) => e.hypercubeTags && e.hypercubeTags.length > 0).length;
  const concept = project.intentionCore?.mainConcept || project.intentionCore?.coreMessage;

  // Sensory signature — the project's own 0-100 intensities, as a mini bar
  // chart. Real framing data, not a placeholder metric.
  const sensoryBars = SENSORY_DOMAINS
    .map((s) => ({ label: s.label, value: project.sensoryDomains?.[s.code] ?? 0 }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

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
                <p className="text-sm text-white/80 line-clamp-2">{concept}</p>
              </div>
            )}
          </div>
        )}

        {/* Task progress — a real bar, not just a fraction */}
        <div className="col-span-2 p-3 rounded-lg bg-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-white/70 flex items-center gap-1.5">
              <ListTodo className="w-3.5 h-3.5 text-cyan-400" /> Task Progress
            </span>
            <span className="text-xs text-white/50">
              {completedTasks}/{tasks.length}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all"
              style={{ width: `${taskProgress}%` }}
            />
          </div>
        </div>

        {/* Sensory signature — mini bar chart of the project's own framing data */}
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
        </div>
      </div>
    </div>
  );
}
