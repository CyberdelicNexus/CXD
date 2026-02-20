'use client';

import { useEffect, useMemo, useState } from 'react';
import { CXDProject } from '@/types/cxd-schema';
import { fetchProjectByShareToken } from '@/lib/supabase-projects';
import { CXDCanvasReadOnly } from '@/components/cxd/cxd-canvas-readonly';
import { CXDShareSummary } from '@/components/cxd/cxd-share-summary';
import Image from 'next/image';
import {
  Lock,
  Loader2,
  List,
  Grid3X3,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractCenterColor, hexToRgba } from '@/lib/utils';

// Canvas gradients (matching navbar)
const CANVAS_GRADIENTS = [
  { name: 'Dark Nebula', value: 'radial-gradient(circle at center, #1a0b2e 0%, #000000 100%)' },
  { name: 'Deep Ocean', value: 'radial-gradient(circle at center, #0b101eff 0%, #000000 100%)' },
  { name: 'Cosmic Fire', value: 'radial-gradient(circle at center, #18061bff 0%, #000000 100%)' },
  { name: 'Midnight Purple', value: 'radial-gradient(circle at center, #1c093dff 0%, #000000 100%)' },
  { name: 'Galactic Blue', value: 'radial-gradient(circle at center, #000323ff 0%, #000000 100%)' },
  { name: 'Void', value: '#000000' },
];

type ViewMode = 'summary' | 'canvas';

export default function SharePage({ params }: { params: { token: string } }) {
  const token = useMemo(() => decodeURIComponent(params.token), [params.token]);
  const [project, setProject] = useState<CXDProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('summary');

  useEffect(() => {
    async function loadProject() {
      setLoading(true);
      setError(false);
      try {
        const fetchedProject = await fetchProjectByShareToken(token);
        if (fetchedProject) {
          setProject(fetchedProject);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Error loading shared project:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadProject();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
          <p className="text-white/50">Loading shared project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-12 h-12 mx-auto mb-4 text-white/30" />
          <h2 className="text-xl font-semibold mb-2 text-white">Share Link Not Found</h2>
          <p className="text-white/50">
            This share link may have expired or been revoked.
          </p>
        </div>
      </div>
    );
  }

  // Dynamic background from project canvas
  const canvasBackground = project.canvasBackground || CANVAS_GRADIENTS[0].value;
  const centerColor = extractCenterColor(canvasBackground);
  const safeHexColor = centerColor.startsWith('#') ? centerColor : '#1a1a1a';
  const navBgColor = hexToRgba(safeHexColor, 0.8);

  return (
    <div className="flex flex-col h-screen" style={{ background: canvasBackground }}>
      {/* Header - matching main navbar style */}
      <header
        className="h-16 backdrop-blur-md border-b border-white/10 flex-shrink-0 relative overflow-visible transition-colors duration-500"
        style={{ backgroundColor: navBgColor }}
      >
        {/* Glass reflections */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-30" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

        <div className="h-full px-6 flex items-center justify-between relative z-10">
          {/* Left: Logo + Project Name */}
          <div className="flex items-center gap-3">
            <Image
              src="/images/hypercube-logo.webp"
              alt="CXD"
              width={28}
              height={28}
              className="object-contain"
              priority
            />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] backdrop-blur-md border border-white/10">
              <span className="text-sm font-medium text-white/70">{project.name}</span>
            </div>
          </div>

          {/* Center: View Toggle */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 rounded-full bg-white/[0.04] backdrop-blur-2xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.6),inset_0_0_20px_rgba(255,255,255,0.15)]">
            {[
              { id: 'summary' as ViewMode, label: 'Summary', icon: List, color: 'violet' },
              { id: 'canvas' as ViewMode, label: 'Canvas', icon: Grid3X3, color: 'cyan' },
            ].map((btn) => {
              const isActive = viewMode === btn.id;
              const colors: Record<string, string> = {
                violet: isActive
                  ? 'bg-gradient-to-b from-violet-400/20 to-violet-950/60 border-violet-500/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                  : 'hover:bg-violet-500/10 hover:border-violet-500/30',
                cyan: isActive
                  ? 'bg-gradient-to-b from-cyan-400/20 to-cyan-950/60 border-cyan-500/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                  : 'hover:bg-cyan-500/10 hover:border-cyan-500/30',
              };

              return (
                <div
                  key={btn.id}
                  onClick={() => setViewMode(btn.id)}
                  className={cn(
                    "relative flex items-center px-4 py-2 group rounded-full text-white transition-all duration-500 border active:scale-95 cursor-pointer",
                    isActive ? colors[btn.color] : `bg-transparent border-transparent ${colors[btn.color]}`,
                  )}
                >
                  <btn.icon className={cn("w-4 h-4 transition-colors", isActive ? 'text-white' : 'text-white/60 group-hover:text-white')} />
                  <span className={cn(
                    "text-xs font-bold overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] whitespace-nowrap",
                    isActive ? 'max-w-[100px] ml-2 opacity-100' : 'max-w-0 opacity-0 group-hover:max-w-[100px] group-hover:ml-2 group-hover:opacity-100'
                  )}>
                    {btn.label}
                  </span>
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              );
            })}
          </div>

          {/* Right: Read Only badge */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-white/50 text-xs">
              <Eye className="w-3.5 h-3.5" />
              Read Only
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {viewMode === 'summary' ? (
          <CXDShareSummary project={project} />
        ) : (
          <CXDCanvasReadOnly project={project} />
        )}
      </main>
    </div>
  );
}
