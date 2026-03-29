'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CXDProject } from '@/types/cxd-schema';
import { fetchProjectByShareToken } from '@/lib/supabase-projects';
import { CXDCanvasReadOnly } from '@/components/cxd/cxd-canvas-readonly';
import { ShareLandingPage } from '@/components/cxd/share/share-landing-page';
import { createClient } from '@/supabase/client';
import {
  Lock,
  Loader2,
  Eye,
} from 'lucide-react';
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

type ViewMode = 'landing' | 'framing' | 'canvas';

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
        const { data: userProfile } = await supabase
          .from('users')
          .select('name, email')
          .eq('id', user.id)
          .single();

        const userName = userProfile?.name || userProfile?.email?.split('@')[0] || 'Someone';

        // Notify the project owner
        if (currentProject.ownerId) {
          await supabase
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

  // Dynamic background from project canvas
  const canvasBackground = project.canvasBackground || CANVAS_GRADIENTS[0].value;
  const centerColor = extractCenterColor(canvasBackground);
  const safeHexColor = centerColor.startsWith('#') ? centerColor : '#1a1a1a';
  const navBgColor = hexToRgba(safeHexColor, 0.8);

  return (
    <div className="flex flex-col h-screen" style={{ background: canvasBackground }}>
      {/* Minimal header with back button */}
      <header
        className="h-14 backdrop-blur-md border-b border-white/10 flex-shrink-0 px-6 flex items-center justify-between"
        style={{ backgroundColor: navBgColor }}
      >
        <button
          onClick={() => setViewMode('landing')}
          className="text-sm text-white/50 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          &larr; Back to overview
        </button>
        <span className="text-sm text-white/60">{project.name}</span>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-white/50 text-xs">
          <Eye className="w-3.5 h-3.5" />
          Read Only
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {viewMode === 'framing' ? (
          <div className="flex-1 flex items-center justify-center text-white/50">
            Framing presentation coming soon
          </div>
        ) : (
          <CXDCanvasReadOnly project={project} />
        )}
      </main>
    </div>
  );
}
