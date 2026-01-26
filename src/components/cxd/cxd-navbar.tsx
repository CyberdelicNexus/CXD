'use client';

import { useCXDStore } from '@/store/cxd-store';
import { Button } from '@/components/ui/button';
import {
  Wand2,
  Share2,
  Download,
  ChevronLeft,
  Sparkles,
  LayoutDashboard,
  LayoutGrid,
  Hexagon
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { ShortcutsGuide } from './shortcuts-guide';

export function CXDNavbar() {
  const router = useRouter();
  const { 
    viewMode, 
    setViewMode, 
    getCurrentProject, 
    generateShareToken,
    canvasViewMode,
    setCanvasViewMode,
    focusedSection,
    setFocusedSection
  } = useCXDStore();
  const { toast } = useToast();
  const project = getCurrentProject();

  const handleExportJSON = () => {
    if (!project) return;
    const dataStr = JSON.stringify(project, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportName = `${project.name.replace(/\s+/g, '_')}_cxd.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportName);
    linkElement.click();
    toast({
      title: 'Export Complete',
      description: 'Your CXD map has been exported as JSON.',
    });
  };

  const handleShare = () => {
    const token = generateShareToken();
    const shareUrl = `${window.location.origin}/cxd/share/${token}`;
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: 'Share Link Copied',
      description: 'Read-only share link has been copied to clipboard.',
    });
  };

  const handleBack = () => {
    if (viewMode === 'focus') {
      setFocusedSection(null);
    } else if (viewMode === 'wizard') {
      // Go back to canvas from wizard
      setViewMode('canvas');
    } else if (viewMode === 'canvas') {
      // Navigate back to dashboard from canvas
      router.push('/dashboard');
    }
  };

  const handleDashboard = () => {
    router.push('/dashboard');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-card/80 backdrop-blur-xl border-b border-border">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Left section */}
        <div className="flex items-center gap-4">
          {viewMode !== 'home' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-border flex items-center justify-center glow-teal">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <span className="text-lg font-semibold text-gradient">CXD Canvas</span>
          </div>
          
          {project && viewMode !== 'home' && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50">
              <span className="text-sm text-muted-foreground">{project.name}</span>
            </div>
          )}
        </div>

        {/* Center section - Canvas View Toggle (only when in canvas mode) */}
        {project && (viewMode === 'canvas' || viewMode === 'focus') && (
          <div className="hidden md:flex items-center gap-1 p-1 rounded-lg bg-secondary/30">
            <Button
              variant={canvasViewMode === 'canvas' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCanvasViewMode('canvas')}
              className={canvasViewMode === 'canvas' ? 'glow-teal' : ''}
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              Canvas
            </Button>
            <Button
              variant={canvasViewMode === 'hexagon' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCanvasViewMode('hexagon')}
              className={canvasViewMode === 'hexagon' ? 'glow-teal' : ''}
            >
              <Hexagon className="w-4 h-4 mr-2" />
              Hypercube
            </Button>
          </div>
        )}

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Shortcuts Guide - Always visible */}
          <ShortcutsGuide />

          {project && viewMode !== 'home' && (
            <>
              {/* Wizard button - styled like Share */}
              <Button
                variant={viewMode === 'wizard' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('wizard')}
                className={viewMode === 'wizard' ? 'glow-teal' : 'text-muted-foreground hover:text-foreground'}
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Wizard
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                className="text-muted-foreground hover:text-foreground"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border">
                  <DropdownMenuItem onClick={handleExportJSON}>
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast({ title: 'Coming Soon', description: 'PDF export will be available in V1' })}>
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDashboard}
            className="text-muted-foreground hover:text-foreground"
            title="Back to Dashboard"
          >
            <LayoutDashboard className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
