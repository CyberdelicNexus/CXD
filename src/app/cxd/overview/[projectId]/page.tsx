'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCanvasPermissions } from '@/hooks/use-canvas-permissions';
import { useCXDStore } from '@/store/cxd-store';
import { fetchProjectById } from '@/lib/supabase-projects';
import { CXDCanvasReadOnly } from '@/components/cxd/cxd-canvas-readonly';
import dynamic from 'next/dynamic';
const ShareFramingPresentation = dynamic(
  () => import('@/components/cxd/share/share-framing-presentation').then(m => m.ShareFramingPresentation),
  { ssr: false }
);
import {
  Loader2,
  ArrowLeft,
  LogIn,
  Eye,
  Wand2,
  Grid3X3,
  Boxes,
  ListTodo,
} from 'lucide-react';
import { cn, extractCenterColor, hexToRgba } from '@/lib/utils';

const CANVAS_GRADIENTS = [
  { name: 'Dark Nebula', value: 'radial-gradient(circle at center, #1a0b2e 0%, #000000 100%)' },
  { name: 'Deep Ocean', value: 'radial-gradient(circle at center, #0b101eff 0%, #000000 100%)' },
  { name: 'Cosmic Fire', value: 'radial-gradient(circle at center, #18061bff 0%, #000000 100%)' },
  { name: 'Midnight Purple', value: 'radial-gradient(circle at center, #1c093dff 0%, #000000 100%)' },
  { name: 'Galactic Blue', value: 'radial-gradient(circle at center, #000323ff 0%, #000000 100%)' },
  { name: 'Void', value: '#000000' },
];

type ViewMode = 'framing' | 'canvas' | 'map' | 'plan';

export default function ProjectOverviewPage({ params }: { params: { projectId: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isLockedQuery = searchParams.get('locked') === '1';
  const { access: canvasAccess } = useCanvasPermissions(params.projectId);
  const showLockBanner = Boolean(isLockedQuery || canvasAccess?.isLocked);
  const isLocked = Boolean(canvasAccess?.isLocked);
  const { getCurrentProject, loadProject, setProjects } = useCXDStore();
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('framing');

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      loadProject(params.projectId);
      const existing = useCXDStore.getState().projects.find(p => p.id === params.projectId);
      if (!existing || (existing as any)._listingOnly) {
        let fullProject = await fetchProjectById(params.projectId);
        if (!fullProject) {
          try {
            const res = await fetch('/api/projects');
            if (res.ok) {
              const data = await res.json();
              fullProject = data.projects?.find((p: any) => p.id === params.projectId) || null;
            }
          } catch {}
        }
        if (fullProject && !cancelled) {
          const updated = useCXDStore.getState().projects.map(p =>
            p.id === params.projectId ? fullProject! : p
          );
          const alreadyIn = updated.some(p => p.id === params.projectId);
          setProjects(alreadyIn ? updated : [...updated, fullProject]);
          loadProject(params.projectId);
        }
      }
      if (!cancelled) setLoading(false);
    };
    hydrate();
    return () => { cancelled = true; };
  }, [params.projectId, loadProject, setProjects]);

  const project = getCurrentProject();
  const isReady = project && !(project as any)._listingOnly;

  const handleEnterProject = useCallback(() => {
    router.push('/cxd');
  }, [router]);

  const handleBack = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  // Tint the navbar to match the canvas background (matches the share page).
  const canvasBackground = useMemo(
    () => project?.canvasBackground || CANVAS_GRADIENTS[0].value,
    [project],
  );
  const navBgColor = useMemo(() => {
    const center = extractCenterColor(canvasBackground);
    const safeHex = center.startsWith('#') ? center : '#1a1a1a';
    return hexToRgba(safeHex, 0.8);
  }, [canvasBackground]);

  if (loading || !project || !isReady) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
          <p className="text-white/50">Loading project overview...</p>
        </div>
      </div>
    );
  }

  const ViewToggle = () => (
    <div className="flex items-center gap-1 p-1 rounded-full bg-white/[0.04] backdrop-blur-2xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.6),inset_0_0_20px_rgba(255,255,255,0.15)]">
      {[
        { id: 'framing' as const, label: 'Experience', icon: Wand2, color: 'violet' },
        { id: 'canvas' as const, label: 'Canvas', icon: Grid3X3, color: 'cyan' },
        { id: 'map' as const, label: 'Map', icon: Boxes, color: 'emerald' },
        { id: 'plan' as const, label: 'Plan', icon: ListTodo, color: 'amber' },
      ].map((btn) => {
        const isActive = viewMode === btn.id;
        const colors: Record<string, string> = {
          violet: isActive
            ? 'bg-gradient-to-b from-violet-400/20 to-violet-950/60 border-violet-500/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
            : 'hover:bg-violet-500/10 hover:border-violet-500/30',
          cyan: isActive
            ? 'bg-gradient-to-b from-cyan-400/20 to-cyan-950/60 border-cyan-500/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
            : 'hover:bg-cyan-500/10 hover:border-cyan-500/30',
          emerald: isActive
            ? 'bg-gradient-to-b from-emerald-400/20 to-emerald-950/60 border-emerald-500/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
            : 'hover:bg-emerald-500/10 hover:border-emerald-500/30',
          amber: isActive
            ? 'bg-gradient-to-b from-amber-400/20 to-amber-950/60 border-amber-500/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
            : 'hover:bg-amber-500/10 hover:border-amber-500/30',
        };
        return (
          <div
            key={btn.id}
            onClick={() => setViewMode(btn.id)}
            className={cn(
              'relative flex items-center px-3 py-2 sm:px-5 sm:py-2.5 group rounded-full text-white transition-all duration-500 border active:scale-95 cursor-pointer',
              isActive ? colors[btn.color] : `bg-transparent border-transparent ${colors[btn.color]}`,
            )}
          >
            <btn.icon className={cn('w-4 h-4 transition-colors', isActive ? 'text-white' : 'text-white/60 group-hover:text-white')} />
            <span className="text-xs font-bold ml-2 whitespace-nowrap hidden sm:inline">
              {btn.label}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      className="flex flex-col h-screen bg-black"
      style={viewMode === 'canvas' ? { background: canvasBackground } : undefined}
    >
      {/* Shared navbar — matches the public share page */}
      <header
        className="h-14 sm:h-16 flex-shrink-0 backdrop-blur-md border-b border-white/10 px-3 sm:px-6 flex items-center justify-between gap-2"
        style={{ backgroundColor: navBgColor }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors cursor-pointer flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>
          <span className="text-white/20 flex-shrink-0">|</span>
          <span className="text-sm text-white/70 font-medium truncate max-w-[120px] sm:max-w-none">
            {project.name}
          </span>
        </div>

        <ViewToggle />

        {/* Right side: Enter (editable canvases) OR read-only badge (locked) */}
        {isLocked ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5 sm:px-3 rounded-full bg-white/[0.05] border border-white/10 text-white/50 text-xs flex-shrink-0">
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Read Only</span>
          </div>
        ) : (
          <button
            onClick={handleEnterProject}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 text-white text-xs sm:text-sm font-medium transition-all hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] flex-shrink-0"
          >
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:inline">Enter Project</span>
            <span className="sm:hidden">Enter</span>
          </button>
        )}
      </header>

      {showLockBanner && (
        <div className="flex-shrink-0 px-4 sm:px-6 py-3 bg-gradient-to-r from-violet-500/15 to-purple-500/10 border-b border-violet-500/25 flex items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-violet-100/90 flex-1">
            <span className="font-semibold text-white">This canvas is archived on your Free plan.</span>{' '}
            Editing is disabled. Upgrade to Pro to restore full access to every canvas you own.
          </p>
          <Link
            href="/#pricing"
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-500 hover:bg-violet-400 text-white transition-colors"
          >
            Upgrade to Pro
          </Link>
        </div>
      )}

      <main className="flex-1 overflow-hidden">
        {viewMode === 'framing' && <ShareFramingPresentation project={project} />}
        {viewMode === 'canvas' && <CXDCanvasReadOnly project={project} />}
        {viewMode === 'map' && <ShareFramingPresentation project={project} defaultSection="hypercube" />}
        {viewMode === 'plan' && <ShareFramingPresentation project={project} defaultSection="planning" />}
      </main>
    </div>
  );
}
