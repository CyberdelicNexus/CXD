"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useCXDStore } from "@/store/cxd-store";
import { cn, extractCenterColor, hexToRgba } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import {
  Wand2,
  Share2,
  Download,
  ChevronLeft,
  Sparkles,
  LayoutDashboard,
  Grid3X3,
  Brain,
  Box,
  Bell,
  Info,
  CheckCircle,
  AlertTriangle,
  Megaphone,
  FolderOpen,
  Check,
  ListTodo,
  Users,
  Settings,
  HelpCircle,
  LogOut,
  UserCircle,
  Menu,
  ChevronRight,
  Palette,
  Loader2,
  Home,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Link } from "lucide-react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { ShortcutsGuide } from "./shortcuts-guide";
import { createNotification, NotificationType } from "@/lib/notifications";
import { createClient } from "@/../../supabase/client";
import { useNotifications } from "@/hooks/use-notifications";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCanvasPermissions } from "@/hooks/use-collaboration";
import { useCollaborationContext } from "@/contexts/collaboration-context";
import { ConnectionStatus } from "@/components/collaboration";
import { CollaborationPanel } from "@/components/collaboration";
import { NavCreditMeter } from "./nav-credit-meter";
import { AccountMenu } from "./account-menu";
import { useSubscription } from "@/hooks/use-subscription";
import { useAICredits } from "@/hooks/use-ai-credits";
import { UpgradeModal } from "@/components/modals/upgrade-modal";
import { SettingsModal } from "@/components/modals/settings-modal";
import { TemplatePickerModal } from './template-picker-modal';
import { ShareSettingsModal } from './share/share-settings-modal';
import { VersionHistoryPanel } from './version-history-panel';
import { Lock } from "lucide-react";

const notificationIcons: Record<NotificationType, React.ReactNode> = {
  info: <Info className="w-4 h-4 text-blue-400" />,
  success: <CheckCircle className="w-4 h-4 text-green-400" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  announcement: <Megaphone className="w-4 h-4 text-purple-400" />,
  update: <Sparkles className="w-4 h-4 text-cyan-400" />,
  project: <FolderOpen className="w-4 h-4 text-orange-400" />,
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

const CANVAS_GRADIENTS = [
  {
    name: 'Dark Nebula',
    value: 'radial-gradient(circle at center, #1a0b2e 0%, #000000 100%)',
    preview: 'radial-gradient(circle at center, #4a2b6e 0%, #1a0b2e 100%)'
  },
  {
    name: 'Deep Ocean',
    value: 'radial-gradient(circle at center, #0b101eff 0%, #000000 100%)',
    preview: 'radial-gradient(circle at center, #2b405e 0%, #0b101e 100%)'
  },
  {
    name: 'Cosmic Fire',
    value: 'radial-gradient(circle at center, #18061bff 0%, #000000 100%)',
    preview: 'radial-gradient(circle at center, #48265b 0%, #18061b 100%)'
  },
  {
    name: 'Midnight Purple',
    value: 'radial-gradient(circle at center, #1c093dff 0%, #000000 100%)',
    preview: 'radial-gradient(circle at center, #5c397d 0%, #1c093d 100%)'
  },
  {
    name: 'Galactic Blue',
    value: 'radial-gradient(circle at center, #000323ff 0%, #000000 100%)',
    preview: 'radial-gradient(circle at center, #303363 0%, #000323 100%)'
  },
  {
    name: 'Void',
    value: '#000000',
    preview: 'radial-gradient(circle at center, #333333 0%, #000000 100%)'
  },
];

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
    setFocusedSection,
    updateProjectName,
    updateCanvasBackground,
    boardPath,
    navigateToBoardPath,
  } = useCXDStore();
  const yDoc = useCXDStore((s) => s.yDoc);
  const { toast } = useToast();
  const project = getCurrentProject();

  // Deduplicate boardPath to prevent duplicate breadcrumb entries
  const dedupedBoardPath = useMemo(() => {
    if (!boardPath) return [];
    const seen = new Set<string>();
    return boardPath.filter(entry => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
  }, [boardPath]);

  // Browser back button / mouse back button: go up one level in board breadcrumbs
  const prevBoardDepthRef = useRef(0);
  useEffect(() => {
    if (boardPath.length > prevBoardDepthRef.current) {
      // Entered a deeper board — push a history entry so the back button can pop it
      window.history.pushState({ boardDepth: boardPath.length }, '');
    }
    prevBoardDepthRef.current = boardPath.length;
  }, [boardPath.length]);

  useEffect(() => {
    const handlePopState = () => {
      if (boardPath.length > 0) {
        // Go up one level (back to parent board, or root if at depth 1)
        navigateToBoardPath(boardPath.length - 2);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [boardPath, navigateToBoardPath]);
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, clearAll } = useNotifications();

  // Subscription and credits
  const { hasPlanView, plan, isTrialing, trialDaysRemaining } = useSubscription();
  const { credits } = useAICredits();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [blockedFeature, setBlockedFeature] = useState<'plan-view' | 'tasks' | 'premium-ai' | 'templates' | 'collaboration' | 'canvases'>('plan-view');
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [saveError, setSaveError] = useState<string | null>(null);

  // Listen for save errors from the sync system
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setSaveError(detail?.message || 'Save failed');
      // Auto-dismiss after 8 seconds
      setTimeout(() => setSaveError(null), 8000);
    };
    window.addEventListener('cxd-save-error', handler);
    return () => window.removeEventListener('cxd-save-error', handler);
  }, []);

  // Fetch user email
  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email);
    };
    fetchUser();
  }, []);

  // Handle logout - flush all pending saves before signing out
  const handleLogout = async () => {
    try {
      // Flush pending Y.js binary state (2s debounce) and JSON project_data (300ms debounce)
      const [{ flushPendingSave }, { flushYjsPersistence }] = await Promise.all([
        import('@/hooks/use-project-sync'),
        import('@/contexts/yjs-project-context'),
      ]);
      await Promise.all([flushPendingSave(), flushYjsPersistence()]);
    } catch (e) {
      console.warn('[Logout] Failed to flush pending saves:', e);
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  // Renaming state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Initialize rename value when project loads
  useEffect(() => {
    if (project) setRenameValue(project.name);
  }, [project]);

  const handleRenameSubmit = () => {
    if (renameValue.trim()) {
      updateProjectName(renameValue.trim());
      setIsRenaming(false);
    }
  };

  // Collapsible navbar buttons state
  const [navButtonsExpanded, setNavButtonsExpanded] = useState(false);

  // Listen for tour event to auto-expand navbar
  useEffect(() => {
    const handler = () => setNavButtonsExpanded(true);
    document.addEventListener('tour-expand-navbar', handler);
    return () => document.removeEventListener('tour-expand-navbar', handler);
  }, []);

  // Collaboration state
  const [showCollaborationPanel, setShowCollaborationPanel] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const { collaborators, isConnected, currentUser, followingCollaboratorId, setFollowingCollaboratorId } = useCollaborationContext();
  const { role: canvasRole } = useCanvasPermissions(project?.id || null);

  const handleExportJSON = async () => {
    if (!project) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const dataStr = JSON.stringify(project, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    const exportName = `${project.name.replace(/\s+/g, "_")}_cxd.json`;
    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportName);
    linkElement.click();

    // Send notification
    if (user) {
      await createNotification(
        user.id,
        'EXPORT_COMPLETE',
        `Your project "${project.name}" has been exported as JSON`,
        {
          projectId: project.id,
          projectName: project.name,
          format: 'json',
          fileName: exportName
        },
        72 // 3 days
      );
    }

    toast({
      title: "Export Complete",
      description: "Your CXD map has been exported as JSON.",
    });
  };

  const handleShare = async () => {
    const token = generateShareToken();
    const shareUrl = `${window.location.origin}/cxd/share/${token}`;
    navigator.clipboard.writeText(shareUrl);

    // Send notification
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user && project) {
      await createNotification(
        user.id,
        'SHARE_LINK_GENERATED',
        'Your share link has been created and copied to clipboard',
        {
          projectId: project.id,
          projectName: project.name,
          shareUrl,
          token,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        720 // 30 days
      );
    }

    toast({
      title: "Share Link Copied",
      description: "Read-only share link has been copied to clipboard.",
    });
  };

  const handleBack = () => {
    if (viewMode === "focus") {
      setFocusedSection(null);
    } else if (viewMode === "wizard") {
      // Go back to canvas from wizard
      setViewMode("canvas");
    } else if (viewMode === "canvas") {
      // Flush pending saves BEFORE navigating to prevent data loss
      import('@/hooks/use-project-sync').then(async ({ flushPendingSave }) => {
        await flushPendingSave();
        router.push("/dashboard");
      }).catch(() => {
        router.push("/dashboard");
      });
    }
  };

  // Get dynamic background color from canvas background
  const canvasBackground = project?.canvasBackground || CANVAS_GRADIENTS[0].value;
  const centerColor = extractCenterColor(canvasBackground);
  // Ensure we have a hex color for the opacity conversion
  const safeHexColor = centerColor.startsWith('#') ? centerColor : '#1a1a1a';
  const navBgColor = hexToRgba(safeHexColor, 0.8);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-20 backdrop-blur-md border-b border-white/10 transition-colors duration-500 overflow-visible"
      style={{ backgroundColor: navBgColor }}
    >
      {/* Glass Reflection Effects */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-30" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-20" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

      {/* Save error banner */}
      {saveError && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[100] px-4 py-2 rounded-lg bg-red-500/90 backdrop-blur-sm text-white text-sm font-medium shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {saveError}
          <button onClick={() => setSaveError(null)} className="ml-2 text-white/70 hover:text-white">
            &times;
          </button>
        </div>
      )}

      <div className="h-full px-6 lg:px-8 xl:px-10 2xl:px-12 flex items-center justify-between relative z-10">
        {/* Left section */}
        <div className="flex items-center gap-4 flex-1">
          <div
            className="cursor-pointer transition-all"
            onClick={handleBack}
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/[0.05] backdrop-blur-md border border-white/10 hover:bg-violet-600/20 hover:border-violet-500/50 hover:shadow-[0_0_15px_rgba(139,92,246,0.3)] group">
              <ChevronLeft className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
            </div>
          </div>

          {/* Color Picker with Gradient Outline - replaces logo */}
          {project && viewMode !== "home" ? (
            <DropdownMenu open={showColorPicker} onOpenChange={setShowColorPicker}>
              <DropdownMenuTrigger asChild>
                <div className="relative group cursor-pointer active:scale-95 transition-all p-[1px] rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-cyan-500">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-zinc-950 transition-all duration-300">
                    <div
                      className="w-5 h-5 rounded-full border border-white/10 shadow-inner"
                      style={{
                        background: CANVAS_GRADIENTS.find(g => g.value === project.canvasBackground)?.preview || CANVAS_GRADIENTS[0].preview
                      }}
                    />
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-zinc-900/95 backdrop-blur-xl border-white/10 p-2 shadow-2xl">
                <div className="grid grid-cols-3 gap-2">
                  {CANVAS_GRADIENTS.map((gradient) => (
                    <button
                      key={gradient.name}
                      className="w-full aspect-square rounded-full border border-white/10 hover:border-violet-500/50 hover:scale-110 transition-all relative group overflow-hidden"
                      style={{ background: gradient.preview }}
                      onClick={() => {
                        updateCanvasBackground(gradient.value);
                        setShowColorPicker(false);
                      }}
                      title={gradient.name}
                    >
                      {project.canvasBackground === gradient.value && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <NextLink href="/dashboard" className="flex items-center gap-2 transition-all duration-300">
              <Image
                src="/images/CXD Logo 2.png"
                alt="CXD"
                width={28}
                height={28}
                className="object-contain"
                priority
              />
            </NextLink>
          )}

          {project && viewMode !== "home" && (
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] backdrop-blur-md border border-white/10 shadow-lg group">
                {isRenaming ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={handleRenameSubmit}
                    onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
                    className="bg-transparent border-none text-sm text-white focus:outline-none min-w-[120px]"
                  />
                ) : (
                  <span
                    className="text-sm font-medium text-white/70 cursor-pointer hover:text-white transition-colors"
                    onClick={() => {
                      setRenameValue(project.name);
                      setIsRenaming(true);
                    }}
                  >
                    {project.name}
                  </span>
                )}
              </div>

              {/* Breadcrumbs - shown when inside a board */}
              {dedupedBoardPath && dedupedBoardPath.length > 0 && (
                <div className="flex items-center gap-1 ml-3 pl-3 border-l border-white/10 max-w-[300px] lg:max-w-[400px] xl:max-w-[500px] 2xl:max-w-[600px]">
                  {/* Hidden gradient definition for home icon */}
                  <svg width="0" height="0" className="absolute overflow-hidden">
                    <defs>
                      <linearGradient id="home-icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#c084fc" />
                        <stop offset="100%" stopColor="#f472b6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <button
                    onClick={() => navigateToBoardPath(-1)}
                    className="flex items-center gap-1 transition-opacity hover:opacity-80 text-sm flex-shrink-0"
                    title="Go to root canvas"
                  >
                    <Home className="w-5 h-5" style={{ stroke: 'url(#home-icon-grad)' }} />
                  </button>
                  {dedupedBoardPath.length <= 3 ? (
                    // Show all breadcrumbs if 3 or fewer
                    dedupedBoardPath.map((board, index) => (
                      <div key={board.id} className="flex items-center flex-shrink-0">
                        <ChevronRight className="w-3.5 h-3.5 text-white/40 mx-0.5" />
                        <button
                          onClick={() => navigateToBoardPath(index)}
                          className={`text-sm transition-colors truncate max-w-[100px] lg:max-w-[120px] xl:max-w-[150px] ${
                            index === dedupedBoardPath.length - 1
                              ? "text-primary font-medium"
                              : "text-white/60 hover:text-white"
                          }`}
                          title={board.title}
                        >
                          {board.title}
                        </button>
                      </div>
                    ))
                  ) : (
                    // Show first, ellipsis, and last 2 when more than 3
                    <>
                      <div className="flex items-center flex-shrink-0">
                        <ChevronRight className="w-3.5 h-3.5 text-white/40 mx-0.5" />
                        <button
                          onClick={() => navigateToBoardPath(0)}
                          className="text-sm text-white/60 hover:text-white transition-colors truncate max-w-[80px]"
                          title={dedupedBoardPath[0].title}
                        >
                          {dedupedBoardPath[0].title}
                        </button>
                      </div>
                      <div className="flex items-center flex-shrink-0">
                        <ChevronRight className="w-3.5 h-3.5 text-white/40 mx-0.5" />
                        <span className="text-sm text-white/40">...</span>
                      </div>
                      {dedupedBoardPath.slice(-2).map((board, idx) => {
                        const index = dedupedBoardPath.length - 2 + idx;
                        return (
                          <div key={board.id} className="flex items-center flex-shrink-0">
                            <ChevronRight className="w-3.5 h-3.5 text-white/40 mx-0.5" />
                            <button
                              onClick={() => navigateToBoardPath(index)}
                              className={`text-sm transition-colors truncate max-w-[100px] ${
                                index === dedupedBoardPath.length - 1
                                  ? "text-primary font-medium"
                                  : "text-white/60 hover:text-white"
                              }`}
                              title={board.title}
                            >
                              {board.title}
                            </button>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center section - Canvas View Toggle (only when in canvas mode) */}
        {project && viewMode !== "home" && (
          <div className="absolute left-1/2 -translate-x-1/2 hidden lg:flex items-center gap-2 p-1.5 rounded-full bg-white/[0.04] backdrop-blur-2xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.6),inset_0_0_20px_rgba(255,255,255,0.15),inset_0_1px_2px_rgba(255,255,255,0.3)]">
            {/* View Toggle Buttons */}
            {[
              { id: 'wizard', label: 'Framing', icon: Brain, mode: 'wizard', color: 'magenta' },
              { id: 'canvas', label: 'Canvas', icon: Grid3X3, mode: 'canvas', canvasMode: 'canvas', color: 'violet' },
              { id: 'hypercube', label: 'Map', icon: Box, mode: 'canvas', canvasMode: 'hexagon', color: 'cyan' },
              { id: 'plan', label: 'Plan', icon: ListTodo, mode: 'canvas', canvasMode: 'plan', color: 'emerald' },
            ].map((btn) => {
              const isActive = btn.id === 'wizard'
                ? viewMode === 'wizard'
                : (viewMode === 'canvas' || viewMode === 'focus') && canvasViewMode === btn.canvasMode;

              const colors: Record<string, string> = {
                magenta: isActive
                  ? 'bg-gradient-to-b from-fuchsia-400/20 to-fuchsia-950/60 border-fuchsia-500/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                  : 'hover:bg-fuchsia-500/10 hover:border-fuchsia-500/30 hover:shadow-[0_0_15px_rgba(217,70,239,0.1)]',
                violet: isActive
                  ? 'bg-gradient-to-b from-violet-400/20 to-violet-950/60 border-violet-500/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                  : 'hover:bg-violet-500/10 hover:border-violet-500/30 hover:shadow-[0_0_15px_rgba(139,92,246,0.1)]',
                cyan: isActive
                  ? 'bg-gradient-to-b from-cyan-400/20 to-cyan-950/60 border-cyan-500/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                  : 'hover:bg-cyan-500/10 hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)]',
                emerald: isActive
                  ? 'bg-gradient-to-b from-emerald-400/20 to-emerald-950/60 border-emerald-500/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                  : 'hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]',
              };

              const isPlanView = btn.id === 'plan';
              const isLocked = isPlanView && !hasPlanView;

              return (
                <div
                  key={btn.id}
                  onClick={() => {
                    // Gate Plan View for non-Pro users
                    if (isPlanView && !hasPlanView) {
                      setBlockedFeature('plan-view');
                      setShowUpgradeModal(true);
                      return;
                    }

                    setViewMode(btn.mode as any);
                    if (btn.canvasMode) setCanvasViewMode(btn.canvasMode as any);
                  }}
                  className={`relative flex items-center px-4 py-2 group rounded-full text-white transition-all duration-500 border active:scale-95 overflow-visible cursor-pointer
                    ${isActive ? colors[btn.color] : `bg-transparent border-transparent ${colors[btn.color]}`}
                    ${isLocked ? 'opacity-60' : ''}
                  `}
                >
                  {isLocked && (
                    <Lock className="w-3 h-3 absolute -top-1 -right-1 text-orange-400 z-10" />
                  )}
                  <btn.icon className={`w-4 h-4 transition-colors ${isActive ? 'text-white' : 'text-white/60 group-hover:text-white'}`} />
                  <span className={`text-xs font-bold overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] whitespace-nowrap
                    ${isActive ? 'max-w-[100px] ml-2 opacity-100' : 'max-w-0 opacity-0 group-hover:max-w-[100px] group-hover:ml-2 group-hover:opacity-100'}
                  `}>
                    {btn.label}
                  </span>

                  {/* Glass Shine Effect */}
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              );
            })}
          </div>
        )}

        {/* Right section */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          {/* Hidden gradient definition for expand/collapse icon */}
          <svg width="0" height="0" className="absolute overflow-hidden">
            <defs>
              <linearGradient id="expand-icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#f472b6" />
              </linearGradient>
            </defs>
          </svg>

          {/* Toggle button for collapsible toolbar — first icon from left */}
          <button
            onClick={() => setNavButtonsExpanded(!navButtonsExpanded)}
            className="flex items-center justify-center flex-shrink-0 transition-all duration-200 hover:scale-110 hover:drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]"
            title={navButtonsExpanded ? "Hide toolbar" : "Show toolbar"}
          >
            {navButtonsExpanded ? (
              <ChevronsRight className="w-5 h-5" style={{ stroke: 'url(#expand-icon-grad)' }} />
            ) : (
              <ChevronsLeft className="w-5 h-5" style={{ stroke: 'url(#expand-icon-grad)' }} />
            )}
          </button>

          {/* Collapsible button group: Tour, Shortcuts, Share, Export, Notifications */}
          {/* AI model selector — always visible */}
          {project && viewMode !== "home" && (
            <NavCreditMeter />
          )}

          {/* Collapsible button group: Tour, Shortcuts, Share, Export, Notifications */}
          <div className={cn(
            "flex items-center gap-2 overflow-hidden transition-all duration-300",
            navButtonsExpanded ? "max-w-[500px] opacity-100" : "max-w-0 opacity-0"
          )}>
            {/* Tour replay button */}
            <div
              className="cursor-pointer transition-all h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full bg-white/[0.05] backdrop-blur-md border border-white/10 hover:bg-violet-600/20 hover:border-violet-500/50 hover:shadow-[0_0_15px_rgba(139,92,246,0.3)] group"
              onClick={() => {
                const state = useCXDStore.getState();
                let tourIdForView: 'canvas' | 'map' | 'plan' = 'canvas';
                if (canvasViewMode === 'hexagon' || canvasViewMode === 'hypercube') tourIdForView = 'map';
                else if (canvasViewMode === 'plan') tourIdForView = 'plan';
                state.startTour(tourIdForView);
              }}
              title="Replay tour"
            >
              <HelpCircle className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" />
            </div>

            {/* Shortcuts Guide */}
            <ShortcutsGuide />

            {project && viewMode !== "home" && (
              <>
                <div
                  className="cursor-pointer transition-all h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full bg-white/[0.05] backdrop-blur-md border border-white/10 hover:bg-violet-600/20 hover:border-violet-500/50 hover:shadow-[0_0_15px_rgba(139,92,246,0.3)] group"
                  onClick={() => setShowShareModal(true)}
                >
                  <Share2 className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="cursor-pointer transition-all h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full bg-white/[0.05] backdrop-blur-md border border-white/10 hover:bg-violet-600/20 hover:border-violet-500/50 hover:shadow-[0_0_15px_rgba(139,92,246,0.3)] group">
                      <Download className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="bg-zinc-900/95 backdrop-blur-xl border-white/10 p-1 shadow-2xl"
                  >
                    <DropdownMenuItem onClick={handleExportJSON} className="hover:bg-white/5 cursor-pointer rounded-md">
                      Export as JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="hover:bg-white/5 cursor-not-allowed text-white/40 rounded-md"
                      onClick={() =>
                        toast({
                          title: "Coming Soon",
                          description: "PDF export will be available in V1",
                        })
                      }
                    >
                      Export as PDF (Soon)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="relative cursor-pointer transition-all h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full bg-white/[0.05] backdrop-blur-md border border-white/10 hover:bg-violet-600/20 hover:border-violet-500/50 hover:shadow-[0_0_15px_rgba(139,92,246,0.3)] group">
                  <Bell className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
                  )}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-80 bg-zinc-900/95 backdrop-blur-xl border-white/10 p-0 shadow-2xl"
              >
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <h3 className="font-semibold text-sm">Notifications</h3>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={markAllAsRead}
                      className="text-xs text-violet-400 hover:text-violet-300 h-auto p-1 hover:bg-transparent"
                    >
                      Mark all read
                    </Button>
                  )}
                </div>

                <ScrollArea className="h-[400px]">
                  {loading ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                      <Bell className="w-12 h-12 text-white/10 mb-3" />
                      <p className="text-sm text-white/40">No notifications yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-4 hover:bg-white/5 cursor-pointer transition-colors ${!notification.is_read ? 'bg-violet-500/5' : ''
                            }`}
                          onClick={() => markAsRead(notification.id)}
                        >
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              {notificationIcons[notification.type]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p className="text-sm font-medium text-white">
                                  {notification.title}
                                </p>
                                {!notification.is_read && (
                                  <div className="w-2 h-2 bg-violet-500 rounded-full flex-shrink-0 mt-1 shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
                                )}
                              </div>
                              <p className="text-xs text-white/50 line-clamp-2 mb-2 leading-relaxed">
                                {notification.message}
                              </p>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-white/30">
                                  {formatTimeAgo(notification.created_at)}
                                </span>
                                {notification.is_read && (
                                  <Check className="w-3 h-3 text-white/20" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                {notifications.length > 0 && (
                  <div className="border-t border-white/5 p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        clearAll();
                      }}
                    >
                      Clear All
                    </Button>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Always visible: Collaborate and Account */}
          {project && viewMode !== "home" && (
            <>
              {/* Collaboration section — single button with hover-reveal bubbles */}
              <div className="relative group mr-2" style={{ zIndex: 100 }} data-tour-id="canvas-collaborate-btn">
                {/* Main circle button */}
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-white/[0.05] backdrop-blur-md border border-white/10 relative cursor-pointer hover:bg-violet-600/20 hover:border-violet-500/50 hover:shadow-[0_0_15px_rgba(139,92,246,0.3)] transition-all"
                  onClick={() => setShowCollaborationPanel(true)}
                  title="Collaboration"
                >
                  <Users className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
                  {/* Live participant count badge */}
                  {collaborators.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.8)] text-[10px] flex items-center justify-center text-white font-bold px-0.5">
                      {collaborators.length}
                    </span>
                  )}
                </div>

                {/* Hover-reveal: profile bubbles for each online collaborator */}
                {collaborators.length > 0 && (
                  <div
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-2 flex flex-row items-start gap-2
                               opacity-0 pointer-events-none -translate-y-1
                               group-hover:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0
                               transition-all duration-200 delay-300 group-hover:delay-0"
                  >
                    {collaborators.map((c) => {
                      const initials = c.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
                      const isFollowing = followingCollaboratorId === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFollowingCollaboratorId(isFollowing ? null : c.id);
                          }}
                          title={isFollowing ? `Stop following ${c.name}` : `Follow ${c.name}`}
                          className="relative flex-shrink-0 transition-transform hover:scale-110"
                        >
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold border-2 transition-all"
                            style={{
                              backgroundColor: c.avatarUrl ? undefined : c.color,
                              borderColor: isFollowing ? c.color : 'transparent',
                              boxShadow: isFollowing ? `0 0 8px ${c.color}` : undefined,
                            }}
                          >
                            {c.avatarUrl ? (
                              <Image src={c.avatarUrl} alt={c.name} width={36} height={36} className="w-full h-full rounded-full object-cover" unoptimized />
                            ) : (
                              initials
                            )}
                          </div>
                          {/* Live green dot */}
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-black" />
                          {/* "Following" label */}
                          {isFollowing && (
                            <span
                              className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold rounded px-1 py-0.5 text-white"
                              style={{ backgroundColor: c.color }}
                            >
                              Following
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Account Menu - Shows tier, credits, trial countdown in dropdown - Far right */}
          <AccountMenu
            userEmail={userEmail}
            aiCredits={credits}
            onLogout={handleLogout}
            onOpenSettings={() => setShowSettingsModal(true)}
            onOpenTemplates={() => setShowTemplatesModal(true)}
            onOpenVersionHistory={() => setShowVersionHistory(true)}
            plan={plan.id as any}
            isTrialing={isTrialing}
            trialDaysRemaining={trialDaysRemaining}
          />
        </div>
      </div>

      {/* Collaboration Panel Modal */}
      {showCollaborationPanel && project && (
        <CollaborationPanel
          canvasId={project.id}
          canvasName={project.name}
          isOwner={canvasRole === 'owner'}
          onlineCollaborators={collaborators}
          onClose={() => setShowCollaborationPanel(false)}
        />
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature={blockedFeature}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* Template Picker Modal — hidden until templates are production-ready */}

      {/* Version History Modal */}
      {project && (
        <VersionHistoryPanel
          open={showVersionHistory}
          onClose={() => setShowVersionHistory(false)}
          projectId={project.id}
          yDoc={yDoc}
        />
      )}

      {/* Share Settings Modal */}
      <ShareSettingsModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
      />
    </nav>
  );
}
