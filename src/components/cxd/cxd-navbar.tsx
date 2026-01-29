"use client";

import { useCXDStore } from "@/store/cxd-store";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import {
  Wand2,
  Share2,
  Download,
  ChevronLeft,
  Sparkles,
  LayoutDashboard,
  LayoutGrid,
  Hexagon,
  Bell,
  Info,
  CheckCircle,
  AlertTriangle,
  Megaphone,
  FolderOpen,
  Check,
  ListTodo,
} from "lucide-react";
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
  } = useCXDStore();
  const { toast } = useToast();
  const project = getCurrentProject();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, clearAll } = useNotifications();

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
      // Navigate back to dashboard from canvas
      router.push("/dashboard");
    }
  };

  const handleDashboard = () => {
    router.push("/dashboard");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-card/80 backdrop-blur-xl border-b border-border">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Left section */}
        <div className="flex items-center gap-4 flex-1">
          {viewMode !== "home" && (
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
            <Image
              src="/images/CL Logo NL.png"
              alt="CXD Logo"
              width={32}
              height={32}
              className="w-8 h-8"
            />
          </div>

          {project && viewMode !== "home" && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50">
              <span className="text-sm text-muted-foreground">
                {project.name}
              </span>
            </div>
          )}
        </div>

        {/* Center section - Canvas View Toggle (only when in canvas mode) */}
        {project && viewMode !== "home" && (
          <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1 p-1 rounded-lg bg-secondary/30">{/* Wizard button */}
            <Button
              variant={viewMode === "wizard" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("wizard")}
              className={viewMode === "wizard" ? "glow-teal" : ""}
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Framing
            </Button>
            <Button
              variant={
                canvasViewMode === "canvas" &&
                (viewMode === "canvas" || viewMode === "focus")
                  ? "default"
                  : "ghost"
              }
              size="sm"
              onClick={() => {
                setViewMode("canvas");
                setCanvasViewMode("canvas");
              }}
              className={
                canvasViewMode === "canvas" &&
                (viewMode === "canvas" || viewMode === "focus")
                  ? "glow-teal"
                  : ""
              }
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              Canvas
            </Button>
            <Button
              variant={
                canvasViewMode === "hypercube" &&
                (viewMode === "canvas" || viewMode === "focus")
                  ? "default"
                  : "ghost"
              }
              size="sm"
              onClick={() => {
                setViewMode("canvas");
                setCanvasViewMode("hypercube");
              }}
              className={
                canvasViewMode === "hypercube" &&
                (viewMode === "canvas" || viewMode === "focus")
                  ? "glow-teal"
                  : ""
              }
            >
              <Hexagon className="w-4 h-4 mr-2" />
              Map
            </Button>
            <Button
              variant={
                canvasViewMode === "plan" &&
                (viewMode === "canvas" || viewMode === "focus")
                  ? "default"
                  : "ghost"
              }
              size="sm"
              onClick={() => {
                setViewMode("canvas");
                setCanvasViewMode("plan");
              }}
              className={
                canvasViewMode === "plan" &&
                (viewMode === "canvas" || viewMode === "focus")
                  ? "glow-teal"
                  : ""
              }
            >
              <ListTodo className="w-4 h-4 mr-2" />
              Plan
            </Button>
          </div>
        )}

        {/* Right section */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          {/* Shortcuts Guide - Always visible */}
          <ShortcutsGuide />

          {project && viewMode !== "home" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                className="text-muted-foreground hover:text-foreground"
                title="Share"
              >
                <Share2 className="w-4 h-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    title="Export"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="bg-card border-border"
                >
                  <DropdownMenuItem onClick={handleExportJSON}>
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      toast({
                        title: "Coming Soon",
                        description: "PDF export will be available in V1",
                      })
                    }
                  >
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="relative text-muted-foreground hover:text-foreground"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-gradient-to-r from-purple-500 to-teal-500 rounded-full animate-pulse" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className="w-80 bg-card border-border p-0"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-semibold text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-xs text-purple-400 hover:text-purple-300 h-auto p-1"
                  >
                    Mark all read
                  </Button>
                )}
              </div>
              
              <ScrollArea className="h-[400px]">
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <Bell className="w-12 h-12 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-accent/50 cursor-pointer transition-colors ${
                          !notification.is_read ? 'bg-accent/20' : ''
                        }`}
                        onClick={() => markAsRead(notification.id)}
                      >
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {notificationIcons[notification.type]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="text-sm font-medium text-foreground">
                                {notification.title}
                              </p>
                              {!notification.is_read && (
                                <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-teal-500 rounded-full flex-shrink-0 mt-1" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {formatTimeAgo(notification.created_at)}
                              </span>
                              {notification.is_read && (
                                <Check className="w-3 h-3 text-muted-foreground" />
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
                <div className="border-t border-border p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
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
