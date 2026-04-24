'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCXDStore } from '@/store/cxd-store';
import { fetchProjectById } from '@/lib/supabase-projects';
import dynamic from 'next/dynamic';
const ShareFramingPresentation = dynamic(
  () => import('@/components/cxd/share/share-framing-presentation').then(m => m.ShareFramingPresentation),
  { ssr: false }
);
import { Loader2, ArrowLeft, LogIn } from 'lucide-react';

export default function ProjectOverviewPage({ params }: { params: { projectId: string } }) {
  const router = useRouter();
  const { getCurrentProject, loadProject, setProjects } = useCXDStore();
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Header */}
      <header className="h-14 flex-shrink-0 backdrop-blur-md border-b border-white/10 px-3 sm:px-6 flex items-center justify-between gap-2 bg-black/80">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors cursor-pointer flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>
          <span className="text-white/20 flex-shrink-0">|</span>
          <span className="text-sm text-white/70 font-medium truncate max-w-[120px] sm:max-w-none">{project.name}</span>
        </div>

        <button
          onClick={handleEnterProject}
          className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 text-white text-xs sm:text-sm font-medium transition-all hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] flex-shrink-0"
        >
          <LogIn className="w-4 h-4" />
          <span className="hidden sm:inline">Enter Project</span>
          <span className="sm:hidden">Enter</span>
        </button>
      </header>

      {/* Dashboard content */}
      <main className="flex-1 overflow-hidden">
        <ShareFramingPresentation project={project} />
      </main>
    </div>
  );
}
