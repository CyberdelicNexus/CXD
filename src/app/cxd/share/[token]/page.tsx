'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CXDProject } from '@/types/cxd-schema';
import { fetchProjectByShareToken } from '@/lib/supabase-projects';
import { CXDCanvasReadOnly } from '@/components/cxd/cxd-canvas-readonly';
import { ShareLandingPage } from '@/components/cxd/share/share-landing-page';
import dynamic from 'next/dynamic';
const ShareFramingPresentation = dynamic(
  () => import('@/components/cxd/share/share-framing-presentation').then(m => m.ShareFramingPresentation),
  { ssr: false }
);
import { createClient } from '@/supabase/client';
import {
  Lock,
  Loader2,
  Eye,
  Wand2,
  Grid3X3,
  ArrowLeft,
  Boxes,
  ListTodo,
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

type ViewMode = 'landing' | 'framing' | 'canvas' | 'map' | 'plan';

export default function SharePage({ params }: { params: { token: string } }) {
  const token = useMemo(() => decodeURIComponent(params.token), [params.token]);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [project, setProject] = useState<CXDProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('landing');

  // Load project
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

  // Handle ?join=true collaboration flow
  useEffect(() => {
    const join = searchParams.get('join');
    if (join !== 'true' || !project) return;

    // Capture project in a const so TypeScript narrows the type inside the async fn
    const currentProject = project;

    async function handleJoin() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          // Not authenticated — the sign-up page handles redirect via returnTo
          return;
        }

        // Check if user is already a collaborator
        const { data: existingCollab } = await supabase
          .from('canvas_collaborators')
          .select('id')
          .eq('canvas_id', currentProject.id)
          .eq('user_id', user.id)
          .single();

        if (existingCollab) {
          // Already a collaborator, just redirect
          router.replace('/cxd');
          return;
        }

        // Insert new collaborator record
        const { error: collabError } = await supabase
          .from('canvas_collaborators')
          .insert({
            canvas_id: currentProject.id,
            user_id: user.id,
            role: 'collaborator',
            added_by: currentProject.ownerId,
          });

        if (collabError) {
          console.error('Error joining as collaborator:', collabError);
          return;
        }

        // Get current user's name for notification
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('name, email')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('Error fetching user profile:', profileError);
        }

        const userName = userProfile?.name || userProfile?.email?.split('@')[0] || 'Someone';

        // Notify the project owner
        if (currentProject.ownerId) {
          const { error: notifError } = await supabase
            .from('notifications')
            .insert({
              user_id: currentProject.ownerId,
              title: 'New Collaborator',
              message: `${userName} joined your project "${currentProject.name}" via share link`,
              type: 'success',
              is_global: false,
              metadata: {
                canvasId: currentProject.id,
                canvasName: currentProject.name,
                collaboratorId: user.id,
                collaboratorName: userName,
              },
            });
          if (notifError) {
            console.error('Error sending notification to project owner:', notifError);
          }
        }

        // Redirect to CXD dashboard
        router.replace('/cxd');
      } catch (err) {
        console.error('Error handling join flow:', err);
      }
    }

    handleJoin();
  }, [searchParams, project, router]);

  const handleViewFraming = useCallback(() => setViewMode('framing'), []);
  const handleViewCanvas = useCallback(() => setViewMode('canvas'), []);

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

  // Landing page view
  if (viewMode === 'landing') {
    return (
      <ShareLandingPage
        project={project}
        onViewFraming={handleViewFraming}
        onViewCanvas={handleViewCanvas}
        shareToken={token}
      />
    );
  }

  // ── Shared navbar for framing + canvas views ──────────────────

  const canvasBackground = project.canvasBackground || CANVAS_GRADIENTS[0].value;
  const centerColor = extractCenterColor(canvasBackground);
  const safeHexColor = centerColor.startsWith('#') ? centerColor : '#1a1a1a';
  const navBgColor = hexToRgba(safeHexColor, 0.8);

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
              "relative flex items-center px-3 py-2 sm:px-5 sm:py-2.5 group rounded-full text-white transition-all duration-500 border active:scale-95 cursor-pointer",
              isActive ? colors[btn.color] : `bg-transparent border-transparent ${colors[btn.color]}`,
            )}
          >
            <btn.icon className={cn("w-4 h-4 transition-colors", isActive ? 'text-white' : 'text-white/60 group-hover:text-white')} />
            <span className="text-xs font-bold ml-2 whitespace-nowrap hidden sm:inline">
              {btn.label}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-black" style={viewMode === 'canvas' ? { background: canvasBackground } : undefined}>
      {/* Shared navbar */}
      <header
        className="h-14 sm:h-16 flex-shrink-0 backdrop-blur-md border-b border-white/10 px-3 sm:px-6 flex items-center justify-between gap-2"
        style={{ backgroundColor: navBgColor }}
      >
        {/* Left: Back + project name */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setViewMode('landing')}
            className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors cursor-pointer flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <span className="text-white/20 flex-shrink-0">|</span>
          <span className="text-sm text-white/70 truncate max-w-[120px] sm:max-w-none">{project.name}</span>
        </div>

        {/* Center: View toggle */}
        <ViewToggle />

        {/* Right: Read Only badge */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 sm:px-3 rounded-full bg-white/[0.05] border border-white/10 text-white/50 text-xs flex-shrink-0">
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Read Only</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {viewMode === 'framing' && (
          <ShareFramingPresentation project={project} />
        )}
        {viewMode === 'canvas' && (
          <CXDCanvasReadOnly project={project} />
        )}
        {viewMode === 'map' && (
          <ShareFramingPresentation project={project} defaultSection="hypercube" />
        )}
        {viewMode === 'plan' && (
          <ShareFramingPresentation project={project} defaultSection="planning" />
        )}
      </main>
    </div>
  );
}
