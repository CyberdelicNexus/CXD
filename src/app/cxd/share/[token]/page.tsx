'use client';

import { useEffect, useMemo, useState } from 'react';
import { CXDProject } from '@/types/cxd-schema';
import { fetchProjectByShareToken } from '@/lib/supabase-projects';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CXDCanvasReadOnly } from '@/components/cxd/cxd-canvas-readonly';
import { CXDShareSummary } from '@/components/cxd/cxd-share-summary';
import { 
  Sparkles, 
  Lock,
  Loader2,
  List,
  Map,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
      <div className="min-h-screen bg-gradient-radial flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading shared project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gradient-radial flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Share Link Not Found</h2>
          <p className="text-muted-foreground">
            This share link may have expired or been revoked.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-radial">
      {/* Header */}
      <header className="h-16 bg-card/80 backdrop-blur-xl border-b border-border flex-shrink-0">
        <div className="h-full px-4 flex items-center justify-between max-w-full mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg gradient-border flex items-center justify-center glow-teal">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <span className="text-lg font-semibold text-gradient">CXD Canvas</span>
          </div>
          
          {/* View Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('summary')}
              className={cn(
                "h-8 px-3 gap-2 rounded-md transition-all",
                viewMode === 'summary' 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                  : "hover:bg-muted"
              )}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Summary</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('canvas')}
              className={cn(
                "h-8 px-3 gap-2 rounded-md transition-all",
                viewMode === 'canvas' 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                  : "hover:bg-muted"
              )}
            >
              <Map className="w-4 h-4" />
              <span className="hidden sm:inline">Canvas</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-muted-foreground">
              Read Only
            </Badge>
            <span className="text-sm text-foreground hidden sm:inline">{project.name}</span>
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
