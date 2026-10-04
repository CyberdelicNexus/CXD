"use client";

import React, { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useCXDStore } from "@/store/cxd-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Trash2,
  Clock,
  FolderOpen,
  User,
  HelpCircle,
  FileText,
  PlayCircle,
  BarChart3,
  Layers,
  TrendingUp,
  Calendar,
  Camera,
  Upload,
  Lock,
  UserPlus,
  Pencil,
  Users,
  Crown,
  ImagePlus,
  Link2,
  MessageCircle,
  Send,
  Check,
  Loader2,
  LayoutTemplate,
  Newspaper,
} from "lucide-react";
import { TEMPLATES, TEMPLATE_CATEGORY_LABELS, instantiateTemplate, type TemplateDefinition, type TemplateCategory } from "@/lib/templates";
import { HypercubeLogo } from "@/components/icons/hypercube-logo";
import { useRouter } from "next/navigation";
import { fetchUserProjects, fetchProjectById, ensureUserProfile, saveProject, updateProjectMetadata } from "@/lib/supabase-projects";
import { createNotification } from "@/lib/notifications";
import { getLocalBackup, clearLocalBackup, flushPendingSave } from "@/hooks/use-project-sync";
import {
  getUserProfile,
  uploadProfileImage,
  updateUserCoverImage,
  updateUserCoverImagePosition,
  updateUserProfilePicture,
  UserProfile,
} from "@/lib/user-profile";
import { useSubscription } from "@/hooks/use-subscription";
import { UpgradeModal } from "@/components/upgrade-modal";
import { ProjectDetailPanel } from "@/components/project-detail-panel";
import { PickFreeCanvasModal } from "@/components/pick-free-canvas-modal";
import { CollaborationPanel } from "@/components/collaboration";
import Image from "next/image";

interface DashboardContentProps {
  userId: string;
  userEmail: string;
}

export function DashboardContent({ userId, userEmail }: DashboardContentProps) {
  const router = useRouter();
  const { projects, createProject, loadProject, deleteProject, setProjects } =
    useCXDStore();
  const [newProjectName, setNewProjectName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [inviteProject, setInviteProject] = useState<{ id: string; name: string } | null>(null);
  const [renameProject, setRenameProject] = useState<{ id: string; name: string } | null>(null);
  const [newRenameValue, setNewRenameValue] = useState("");
  const [uploadingCoverFor, setUploadingCoverFor] = useState<string | null>(null);
  const [coverImageProject, setCoverImageProject] = useState<{ id: string; name: string } | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDefinition | null>(null);
  const [templateProjectName, setTemplateProjectName] = useState('');

  // Subscription state
  const {
    isFree,
    isPro,
    isLifetime,
    isBetaTester,
    hasTemplates,
    canCreateCanvas,
    isTrialing,
    trialDaysRemaining,
    freePrimaryCanvasId,
    needsPickFreeCanvas,
    refetch: refetchSubscription,
  } = useSubscription();

  // Profile customization state
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [coverImagePosition, setCoverImagePosition] = useState({ x: 0, y: 0 });
  const [originalCoverPosition, setOriginalCoverPosition] = useState({ x: 0, y: 0 });
  const [isRepositionMode, setIsRepositionMode] = useState(false);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);

  // Extract user name from email
  const userName = userEmail
    .split("@")[0]
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

  // Check if user can create more canvases
  const canCreate = canCreateCanvas(projects.length);

  // Support form submit handler
  const handleSupportSubmit = async () => {
    if (!supportMessage.trim()) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      // Get browser info
      const browserInfo = `${navigator.userAgent} | Screen: ${window.screen.width}x${window.screen.height}`;

      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Support Request',
          description: supportMessage,
          browserInfo,
        }),
      });

      if (!response.ok) {
        setFormError('Failed to submit support request. Please try again or email contact@cyberdelic.design');
        return;
      }

      const data = await response.json();

      if (data.success) {
        setSubmitSuccess(true);
        // Close dialog after showing success - state reset handled by onOpenChange
        setTimeout(() => {
          setIsSupportOpen(false);
        }, 1500);
      } else {
        throw new Error(data.error || 'Failed to submit support request');
      }
    } catch (error) {
      console.error('Support submission error:', error);
      setFormError('Failed to submit support request. Please try again or email contact@cyberdelic.design');
    } finally {
      setIsSubmitting(false);
    }
  };

  // If Zustand already has cached projects, show them immediately without waiting
  // for the network fetch. The effect below will refresh them in the background.
  useEffect(() => {
    if (projects.length > 0) {
      setIsLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const loadUserAndProjects = async () => {
      // Flush any pending project_data save BEFORE fetching projects so the fetch
      // sees the latest state (prevents stale data overwriting Zustand on dashboard load).
      await flushPendingSave();

      // Now fetch projects and profile in parallel
      const [userProjects, profile] = await Promise.all([
        // Fetch projects via API route (uses admin client to bypass RLS)
        fetch('/api/projects?listing=true')
          .then(r => r.json())
          .then(d => d.projects as any[] ?? [])
          .catch(async () => {
            console.error('API route failed, falling back to client fetch');
            return fetchUserProjects(userId);
          }),
        // Profile fetch runs in parallel — it doesn't depend on projects
        getUserProfile(userId),
        ensureUserProfile(userId, userEmail),
      ]);

      const backup = getLocalBackup();
      if (backup && backup.project && backup.project.id) {
        const dbProject = userProjects.find(p => p.id === backup.project.id);
        const oneHourAgo = Date.now() - (60 * 60 * 1000);

        if (backup.timestamp > oneHourAgo) {
          if (dbProject) {
            const dbUpdated = new Date(dbProject.updatedAt).getTime();
            if (backup.timestamp > dbUpdated) {
              const mergedProjects = userProjects.map(p =>
                p.id === backup.project.id ? { ...backup.project, updatedAt: new Date().toISOString() } : p
              );
              setProjects(mergedProjects);
              saveProject(backup.project).then(success => {
                if (success) clearLocalBackup();
              });
            } else {
              clearLocalBackup();
              if (userProjects.length > 0) setProjects(userProjects);
            }
          } else {
            clearLocalBackup();
            if (userProjects.length > 0) setProjects(userProjects);
          }
        } else {
          clearLocalBackup();
          if (userProjects.length > 0) setProjects(userProjects);
        }
      } else if (userProjects.length > 0) {
        setProjects(userProjects);
      }

      if (profile) {
        setUserProfile(profile);
        setCoverImagePosition(profile.cover_image_position);
        setOriginalCoverPosition(profile.cover_image_position);
      }

      setIsLoading(false);
    };

    loadUserAndProjects();
  }, [userId, userEmail, setProjects]);

  const handleCreateProject = async () => {
    if (!canCreate) {
      setShowUpgradeModal(true);
      setIsDialogOpen(false);
      return;
    }

    if (newProjectName.trim()) {
      const projectId = createProject(newProjectName.trim(), userId);
      setNewProjectName("");
      setIsDialogOpen(false);

      await createNotification(
        userId,
        "PROJECT_CREATED",
        `Your project "${newProjectName.trim()}" has been created successfully`,
        { projectId, projectName: newProjectName.trim() },
      );

      router.push("/cxd");
    }
  };

  const handleCreateFromTemplate = async () => {
    if (!canCreate) { setShowUpgradeModal(true); setTemplateDialogOpen(false); return; }
    if (!selectedTemplate || !templateProjectName.trim()) return;

    const { elements: freshElements, edges: freshEdges } = instantiateTemplate(selectedTemplate);

    const projectId = createProject(templateProjectName.trim(), userId, freshElements, freshEdges);
    setTemplateProjectName('');
    setSelectedTemplate(null);
    setTemplateDialogOpen(false);

    await createNotification(
      userId,
      "PROJECT_CREATED",
      `Your project "${templateProjectName.trim()}" has been created successfully`,
      { projectId, projectName: templateProjectName.trim() },
    );
    router.push('/cxd');
  };

  const handleOpenProject = (projectId: string) => {
    setNavigatingTo(projectId);
    const project = projects.find(p => p.id === projectId);
    if (project && (project as any)._listingOnly) {
      // Fetch full project data, then navigate once ready.
      // This prevents the canvas from rendering with incomplete data.
      fetchProjectById(projectId).then(async (fullProject) => {
        if (!fullProject) {
          // Fallback: fetch via API route (admin client, works for collaborators)
          try {
            const res = await fetch(`/api/projects`);
            if (res.ok) {
              const data = await res.json();
              fullProject = data.projects?.find((p: any) => p.id === projectId) || null;
            }
          } catch {}
        }
        if (fullProject) {
          const updated = useCXDStore.getState().projects.map(p => p.id === projectId ? fullProject! : p);
          setProjects(updated);
        }
        loadProject(projectId);
        router.push("/cxd");
      });
    } else {
      // Full data already in store, navigate immediately
      loadProject(projectId);
      router.push("/cxd");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const totalProjects = projects.length;

  // When a project is selected, pin it to the top-left of the grid — the
  // rest keep their existing order.
  const displayProjects = useMemo(() => {
    if (!selectedProjectId) return projects;
    const selected = projects.find((p) => p.id === selectedProjectId);
    if (!selected) return projects;
    return [selected, ...projects.filter((p) => p.id !== selectedProjectId)];
  }, [projects, selectedProjectId]);

  // Cover image handlers
  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCover(true);
    try {
      const imageUrl = await uploadProfileImage(userId, file, "cover");
      if (imageUrl) {
        const success = await updateUserCoverImage(userId, imageUrl);
        if (success) {
          setUserProfile((prev) => prev ? { ...prev, cover_image: imageUrl } : null);
        }
      }
    } catch (error) {
      console.error("Error uploading cover image:", error);
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingProfile(true);
    try {
      const imageUrl = await uploadProfileImage(userId, file, "profile");
      if (imageUrl) {
        const success = await updateUserProfilePicture(userId, imageUrl);
        if (success) {
          setUserProfile((prev) => prev ? { ...prev, profile_picture: imageUrl } : null);
        }
      }
    } catch (error) {
      console.error("Error uploading profile picture:", error);
    } finally {
      setIsUploadingProfile(false);
    }
  };

  const enterRepositionMode = () => {
    setOriginalCoverPosition(coverImagePosition);
    setIsRepositionMode(true);
  };

  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!isDraggingCover || !isRepositionMode) return;
      e.preventDefault();
      const newY = e.clientY - dragStart.y;
      setCoverImagePosition((prev) => ({ ...prev, y: Math.max(-200, Math.min(200, newY)) }));
    };

    const handleWindowMouseUp = () => {
      if (isDraggingCover) {
        setIsDraggingCover(false);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }
    };

    if (isDraggingCover) {
      // Disable text selection during drag
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDraggingCover, isRepositionMode, dragStart]);

  const handleCoverMouseDown = (e: React.MouseEvent) => {
    if (!isRepositionMode || !userProfile?.cover_image) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCover(true);
    setDragStart({ x: e.clientX, y: e.clientY - coverImagePosition.y });
  };

  const saveRepositionAndExit = async () => {
    const success = await updateUserCoverImagePosition(userId, coverImagePosition);
    if (success) {
      setOriginalCoverPosition(coverImagePosition);
    } else {
      setCoverImagePosition(originalCoverPosition);
    }
    setIsRepositionMode(false);
    setIsDraggingCover(false);
  };

  const cancelReposition = () => {
    setCoverImagePosition(originalCoverPosition);
    setIsRepositionMode(false);
    setIsDraggingCover(false);
  };

  // Canvas cover image upload handler
  const handleCanvasCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>, projectId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCoverFor(projectId);
    try {
      const imageUrl = await uploadProfileImage(userId, file, `canvas-cover-${projectId}`);
      if (imageUrl) {
        const updatedProjects = projects.map(p =>
          p.id === projectId
            ? { ...p, coverImage: imageUrl, coverPosition: { x: 50, y: 50 }, updatedAt: new Date().toISOString() }
            : p
        );
        setProjects(updatedProjects);
        await updateProjectMetadata(projectId, { coverImage: imageUrl, coverPosition: { x: 50, y: 50 } });
      }
    } catch (error) {
      console.error("Error uploading canvas cover:", error);
    } finally {
      setUploadingCoverFor(null);
    }
  };

  // Get plan badge info
  const getPlanBadge = () => {
    if (isLifetime) return { label: 'Lifetime', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
    if (isBetaTester) return { label: 'Beta Tester', color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' };
    if (isPro) return { label: isTrialing ? `Pro Trial (${trialDaysRemaining}d)` : 'Pro', color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' };
    return { label: 'Free', color: 'bg-white/10 text-white/60 border-white/10' };
  };

  const planBadge = getPlanBadge();

  return (
    <main className="min-h-screen text-white">
      {needsPickFreeCanvas(projects.length) && (
        <PickFreeCanvasModal
          open={true}
          canvases={projects.filter((p) => p.ownerId === userId)}
          onChoose={async (canvasId) => {
            const res = await fetch('/api/subscriptions/free-primary-canvas', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ canvasId }),
            });
            if (!res.ok) {
              throw new Error('Failed to save primary canvas choice');
            }
            await refetchSubscription();
          }}
          onUpgrade={() => setShowUpgradeModal(true)}
        />
      )}

      {/* Background gradient overlay */}
      <div className="fixed inset-0 hero-gradient pointer-events-none z-0" />

      {/* Decorative orbs */}
      <div className="glow-orb" style={{ top: '10%', right: '10%', opacity: 0.3 }} />
      <div className="glow-orb glow-orb-cyan" style={{ bottom: '20%', left: '5%', opacity: 0.2 }} />

      <div className="relative z-10 container mx-auto px-4 py-6 max-w-7xl">
        {/* Profile Header */}
        <div
          className="relative mb-8 rounded-2xl overflow-hidden glass-card-glow"
        >
          {/* Cover Image - Extends behind entire card */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-900/30 via-purple-900/20 to-cyan-900/20">
            {userProfile?.cover_image ? (
              <div
                className={`absolute inset-0 ${isRepositionMode ? (isDraggingCover ? "cursor-grabbing" : "cursor-grab") : ""}`}
                onMouseDown={handleCoverMouseDown}
              >
                <Image
                  src={userProfile.cover_image}
                  alt="Cover"
                  fill
                  className={`object-cover select-none ${isRepositionMode ? "pointer-events-none" : ""}`}
                  draggable={false}
                  style={{ objectPosition: `50% ${50 + coverImagePosition.y / 4}%` }}
                />
                {isRepositionMode && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                    <p className="text-white font-medium">
                      {isDraggingCover ? "Release to stop" : "Drag to reposition"}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center opacity-30">
                <Camera className="w-10 h-10 text-white/20" />
              </div>
            )}
          </div>

          {/* Cover section with actions */}
          <div className={`relative h-48 ${isRepositionMode ? "pointer-events-none" : ""}`}>
            {/* Cover Actions */}
            <div className="absolute top-4 right-4 flex gap-2 z-10 pointer-events-auto">
              <input type="file" id="cover-upload" accept="image/*" className="hidden" onChange={handleCoverImageUpload} disabled={isUploadingCover || isRepositionMode} />
              {isRepositionMode ? (
                <>
                  <Button size="sm" onClick={cancelReposition} className="bg-red-500/80 hover:bg-red-500 text-white backdrop-blur">Cancel</Button>
                  <Button size="sm" onClick={saveRepositionAndExit} className="bg-green-500/80 hover:bg-green-500 text-white backdrop-blur">Done</Button>
                </>
              ) : (
                <>
                  {userProfile?.cover_image && (
                    <Button size="sm" onClick={enterRepositionMode} className="bg-black/50 hover:bg-black/70 backdrop-blur text-white">
                      <Camera className="w-4 h-4 mr-2" />Reposition
                    </Button>
                  )}
                  <label htmlFor="cover-upload">
                    <Button size="sm" className="bg-black/50 hover:bg-black/70 backdrop-blur text-white cursor-pointer" disabled={isUploadingCover} asChild>
                      <span><Upload className="w-4 h-4 mr-2" />{isUploadingCover ? "..." : "Cover"}</span>
                    </Button>
                  </label>
                </>
              )}
            </div>
          </div>

          {/* Profile Info - Semi-transparent to show cover behind */}
          <div className="relative px-6 pb-6 bg-black/50 backdrop-blur-sm border-t border-white/10">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              {/* Profile Picture */}
              <div className="relative -mt-14">
                <input type="file" id="profile-upload" accept="image/*" className="hidden" onChange={handleProfilePictureUpload} disabled={isUploadingProfile} />
                <label htmlFor="profile-upload" className="block cursor-pointer group">
                  <div className="relative">
                    {userProfile?.profile_picture ? (
                      <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-black/80 shadow-2xl">
                        <Image src={userProfile.profile_picture} alt="Profile" fill className="object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Camera className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-28 h-28 rounded-full border-4 border-black/80 shadow-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/30 flex items-center justify-center group-hover:from-violet-500/50 group-hover:to-cyan-500/50 transition-all">
                        <User className="w-12 h-12 text-white/40 group-hover:hidden" />
                        <Camera className="w-8 h-8 text-white/70 hidden group-hover:block" />
                      </div>
                    )}
                    {isUploadingProfile && (
                      <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                </label>
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white truncate max-w-[200px]">{userProfile?.full_name || userProfile?.name || userName}</h2>
                    <Badge className={`text-xs ${planBadge.color}`}>
                      {planBadge.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-white/50">{userEmail}</p>
                </div>
              </div>

              {/* Help links, centred in the row. Each tile shows its icon and
                  swaps to its name on hover, so the icons never need guessing. */}
              <div className="hidden lg:flex flex-1 items-center justify-center gap-2 2xl:gap-3 min-w-0">
                {[
                  { label: "Support", icon: HelpCircle, color: "text-violet-400", border: "hover:border-violet-500/40", onClick: () => setIsSupportOpen(true) },
                  { label: "Docs", icon: FileText, color: "text-purple-400", border: "hover:border-purple-500/40", onClick: () => router.push("/dashboard/docs") },
                  { label: "Tutorials", icon: PlayCircle, color: "text-emerald-400", border: "hover:border-emerald-500/40", onClick: () => router.push("/dashboard/tutorials") },
                  { label: "Changelog", icon: Newspaper, color: "text-pink-400", border: "hover:border-pink-500/40", onClick: () => router.push("/changelog") },
                ].map(({ label, icon: Icon, color, border, onClick }) => (
                  <button
                    key={label}
                    className={`relative w-16 h-16 2xl:w-[72px] 2xl:h-[72px] flex-shrink-0 rounded-xl bg-gradient-to-br from-black to-violet-950/50 border border-violet-500/10 ${border} hover:from-violet-950/30 transition-all group overflow-hidden`}
                    onClick={onClick}
                    aria-label={label}
                  >
                    <Icon className={`absolute inset-0 m-auto w-6 h-6 ${color} transition-all duration-200 group-hover:opacity-0 group-hover:scale-75`} />
                    <span className="absolute inset-0 flex items-center justify-center px-1 text-[11px] 2xl:text-xs font-medium text-white opacity-0 scale-90 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100">
                      {label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Create Button */}
              <div className="flex items-center gap-2 mt-4 md:mt-0">
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                  if (open && !canCreate) {
                    setShowUpgradeModal(true);
                    return;
                  }
                  setIsDialogOpen(open);
                }}>
                  <DialogTrigger asChild>
                    <Button className="btn-primary-glow flex-shrink-0 whitespace-nowrap">
                      {canCreate ? (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Create New Canvas
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 mr-2" />
                          Upgrade to Create
                        </>
                      )}
                    </Button>
                  </DialogTrigger>
                  {canCreate && (
                    <DialogContent className="bg-zinc-900/95 border-white/10 text-white">
                      <DialogHeader>
                        <DialogTitle>Create New Canvas</DialogTitle>
                        <DialogDescription className="text-white/60">
                          Give your new project a name
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="project-name" className="text-white/70">Project Name</Label>
                          <Input
                            id="project-name"
                            placeholder="Enter project name..."
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                            autoFocus
                          />
                        </div>
                        <div className="flex gap-3 justify-end">
                          <Button variant="ghost" onClick={() => { setIsDialogOpen(false); setNewProjectName(""); }} className="text-white/60 hover:text-white">
                            Cancel
                          </Button>
                          <Button onClick={handleCreateProject} className="btn-primary-glow" disabled={!newProjectName.trim()}>
                            <Plus className="w-4 h-4 mr-2" />
                            Create Map
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  )}
                </Dialog>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content — Experience Maps */}
        <div>
          {/* Experience Maps */}
          <div className="rounded-xl overflow-hidden bg-black/20 border border-white/10 h-fit">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-semibold text-white">Your Experience Maps</h3>
              <Badge variant="outline" className="text-white/50 border-white/20">
                {totalProjects} {isFree ? '/ 1' : ''} total
              </Badge>
            </div>

            <div className="p-4">
              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-white/50">Loading your projects...</div>
                </div>
              )}

              {!isLoading && projects.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <FolderOpen className="w-8 h-8 text-white/30" />
                  </div>
                  <h3 className="text-lg font-medium mb-2 text-white">No projects yet</h3>
                  <p className="text-white/50 text-center mb-4 max-w-md">
                    Create your first map to start designing transformational experiences.
                  </p>
                  <Button onClick={() => setIsDialogOpen(true)} className="btn-primary-glow">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Map
                  </Button>
                </div>
              )}

              {!isLoading && projects.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {displayProjects.map((project, projectIndex) => {
                    const isOwner = project.ownerId === userId;
                    const tileIsFreePrimary = isFree && freePrimaryCanvasId === project.id;
                    const tileIsLocked = isFree && !tileIsFreePrimary;
                    const coverImage = (project as any).coverImage;
                    const isUploading = uploadingCoverFor === project.id;
                    const isSelected = selectedProjectId === project.id;

                    return (
                    <React.Fragment key={project.id}>
                      <div
                        className={cn(
                          "relative aspect-square rounded-xl bg-gradient-to-br from-violet-900/60 via-purple-800/50 to-indigo-900/60 hover:from-violet-800/70 hover:via-purple-700/60 hover:to-indigo-800/70 transition-all cursor-pointer group border overflow-hidden shadow-lg hover:shadow-violet-500/20",
                          isSelected ? "border-violet-400 ring-2 ring-violet-400/50" : "border-violet-500/20 hover:border-violet-400/40"
                        )}
                        onClick={() => {
                          setSelectedProjectId((prev) => (prev === project.id ? null : project.id));
                        }}
                      >
                        {/* Cover Image */}
                        {coverImage && coverImage.startsWith('http') && (
                          <div className="absolute inset-0">
                            <Image
                              src={coverImage}
                              alt={project.name}
                              fill
                              className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                              style={{ objectPosition: `${(project as any).coverPosition?.x ?? 50}% ${(project as any).coverPosition?.y ?? 50}%` }}
                              unoptimized
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          </div>
                        )}

                        {tileIsLocked && (
                          <div className="absolute top-3 left-3 z-30 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 border border-white/15 backdrop-blur-sm text-[10px] font-medium text-white/70">
                            <Lock className="w-3 h-3" />
                            Read-only
                          </div>
                        )}
                        {tileIsFreePrimary && (
                          <div className="absolute top-3 left-3 z-30 flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-sm text-[10px] font-medium text-emerald-200">
                            <Check className="w-3 h-3" />
                            Your canvas
                          </div>
                        )}

                        {/* Loading Overlay */}
                        {navigatingTo === project.id && (
                          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                            <div className="relative">
                              <div className="w-12 h-12 border-4 border-violet-500/30 border-t-violet-400 rounded-full animate-spin" />
                              <Loader2 className="absolute inset-0 m-auto w-5 h-5 text-violet-200 animate-spin-slow" />
                            </div>
                            <span className="text-xs font-semibold text-violet-200 tracking-wider animate-pulse">
                              ENTERING...
                            </span>
                          </div>
                        )}

                        {/* Default Hypercube Logo - positioned above gradient */}
                        {!coverImage && (
                          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                            <div className="opacity-40 group-hover:opacity-60 transition-opacity">
                              <Image
                                src="/images/CXD Logo 2.png"
                                alt="Hypercube"
                                width={100}
                                height={100}
                                className="object-contain drop-shadow-lg"
                              />
                            </div>
                          </div>
                        )}

                        {/* Owner/Collaborator Badge */}
                        <div className="absolute top-3 right-3">
                          {isOwner ? (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 backdrop-blur-sm">
                              <Crown className="w-3 h-3" />
                              <span className="text-[10px] font-medium">Owner</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 backdrop-blur-sm">
                              <Users className="w-3 h-3" />
                              <span className="text-[10px] font-medium">Collaborator</span>
                            </div>
                          )}
                        </div>

                        {/* Project Name + Action Buttons - Bottom */}
                        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/60 to-transparent">
                          <div className="text-center mb-2 px-1">
                            <h4 className="font-semibold text-white text-base truncate group-hover:text-violet-200 transition-colors drop-shadow-md">
                              {project.name}
                            </h4>
                            <div className="flex items-center justify-center gap-1 text-[10px] text-white/50 mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span>{formatDate(project.updatedAt)}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Cover Image Button - Opens Dialog */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-8 h-8 bg-white/10 hover:bg-emerald-500/30 text-white/70 hover:text-white border border-white/10 hover:border-emerald-500/30"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setCoverImageProject({ id: project.id, name: project.name });
                                setCoverImageUrl("");
                              }}
                              title="Add Cover Image"
                            >
                              <ImagePlus className="w-4 h-4" />
                            </Button>

                            {isOwner && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 bg-white/10 hover:bg-violet-500/30 text-white/70 hover:text-white border border-white/10 hover:border-violet-500/30"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await saveProject(project);
                                  setInviteProject({ id: project.id, name: project.name });
                                }}
                                title="Invite Collaborators"
                              >
                                <UserPlus className="w-4 h-4" />
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-8 h-8 bg-white/10 hover:bg-purple-500/30 text-white/70 hover:text-white border border-white/10 hover:border-purple-500/30"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/cxd/overview/${project.id}`);
                              }}
                              title="Project Overview"
                            >
                              <BarChart3 className="w-4 h-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-8 h-8 bg-white/10 hover:bg-blue-500/30 text-white/70 hover:text-white border border-white/10 hover:border-blue-500/30"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenameProject({ id: project.id, name: project.name });
                                setNewRenameValue(project.name);
                              }}
                              title="Rename"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>

                            {isOwner && !tileIsFreePrimary && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 bg-white/10 hover:bg-red-500/30 text-white/70 hover:text-red-400 border border-white/10 hover:border-red-500/30"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProjectToDelete(project.id);
                                  setDeleteConfirmOpen(true);
                                }}
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Detail panel — lives inside the same grid, right after
                          the selected tile (pinned to index 0), spanning the
                          area of a 2x2 block of tiles for real room to show
                          stats/graphs rather than a cramped external sidebar. */}
                      {projectIndex === 0 && selectedProjectId && (() => {
                        const selProj = projects.find((p) => p.id === selectedProjectId);
                        const selIsOwner = !!selProj && selProj.ownerId === userId;
                        const selIsFreePrimary = isFree && freePrimaryCanvasId === selectedProjectId;
                        return (
                          <ProjectDetailPanel
                            projectId={selectedProjectId}
                            onClose={() => setSelectedProjectId(null)}
                            onEnterProject={(projectId) => {
                              const isProjectFreePrimary = isFree && freePrimaryCanvasId === projectId;
                              const isProjectLocked = isFree && !isProjectFreePrimary;
                              if (isProjectLocked) {
                                router.push(`/cxd/overview/${projectId}`);
                              } else {
                                handleOpenProject(projectId);
                              }
                            }}
                            isOwner={selIsOwner}
                            canDelete={!selIsFreePrimary}
                            onAddCover={selProj ? () => {
                              setCoverImageProject({ id: selProj.id, name: selProj.name });
                              setCoverImageUrl("");
                            } : undefined}
                            onInvite={selProj ? async () => {
                              await saveProject(selProj);
                              setInviteProject({ id: selProj.id, name: selProj.name });
                            } : undefined}
                            onRename={selProj ? () => {
                              setRenameProject({ id: selProj.id, name: selProj.name });
                              setNewRenameValue(selProj.name);
                            } : undefined}
                            onDelete={selProj ? () => {
                              setProjectToDelete(selProj.id);
                              setDeleteConfirmOpen(true);
                            } : undefined}
                            onSaveCoverPosition={selProj && selIsOwner ? async (coverPosition) => {
                              const ok = await updateProjectMetadata(selProj.id, { coverPosition });
                              if (ok) {
                                setProjects(projects.map((p) => (p.id === selProj.id ? ({ ...p, coverPosition } as typeof p) : p)));
                              }
                              return ok;
                            } : undefined}
                          />
                        );
                      })()}
                    </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Template Gallery — hidden until templates are production-ready */}
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="unlimitedCanvases"
      />

      {/* Support Dialog */}
      <Dialog open={isSupportOpen} onOpenChange={(open) => {
        setIsSupportOpen(open);
        if (open) {
          setFormError(null);
        }
        if (!open) {
          // Reset form state when dialog closes
          setTimeout(() => {
            setSupportMessage('');
            setSubmitSuccess(false);
            setIsSubmitting(false);
            setFormError(null);
          }, 150);
        }
      }}>
        <DialogContent className="bg-zinc-900/95 backdrop-blur-xl border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <MessageCircle className="w-5 h-5 text-violet-400" />
              Contact Support
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Have a question or need help? We're here to assist you.
            </DialogDescription>
          </DialogHeader>

          {submitSuccess ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Message Sent!</h3>
              <p className="text-white/50 text-sm">We'll get back to you as soon as possible.</p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="support-message" className="text-white/70">Your Message</Label>
                <Textarea
                  id="support-message"
                  placeholder="Describe your question or issue..."
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[120px] focus:border-violet-500/50"
                  maxLength={10000}
                />
              </div>

              <Button
                onClick={handleSupportSubmit}
                disabled={!supportMessage.trim() || isSubmitting}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
              {formError && (
                <p className="text-sm text-red-400 mt-2">{formError}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-zinc-900/95 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription className="text-white/60">
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end py-4">
            <Button variant="ghost" onClick={() => { setDeleteConfirmOpen(false); setProjectToDelete(null); }} className="text-white/60 hover:text-white">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={async () => {
                if (projectToDelete) {
                  setIsDeleting(true);
                  try {
                    const proj = projects.find((p) => p.id === projectToDelete);
                    deleteProject(projectToDelete);
                    await createNotification(userId, "PROJECT_DELETED", `Project "${proj?.name}" deleted`, { projectId: projectToDelete });
                    setDeleteConfirmOpen(false);
                    setProjectToDelete(null);
                  } finally {
                    setIsDeleting(false);
                  }
                }
              }}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameProject} onOpenChange={(open) => { if (!open) { setRenameProject(null); setNewRenameValue(""); } }}>
        <DialogContent className="bg-zinc-900/95 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
            <DialogDescription className="text-white/60">
              Enter a new name for your project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-white/70">Project Name</Label>
              <Input
                value={newRenameValue}
                onChange={(e) => setNewRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newRenameValue.trim() && renameProject) {
                    const updatedProjects = projects.map((p) =>
                      p.id === renameProject.id
                        ? { ...p, name: newRenameValue.trim(), updatedAt: new Date().toISOString() }
                        : p
                    );
                    setProjects(updatedProjects);
                    updateProjectMetadata(renameProject.id, { name: newRenameValue.trim() });
                    setRenameProject(null);
                    setNewRenameValue("");
                  }
                }}
                placeholder="Enter project name..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => { setRenameProject(null); setNewRenameValue(""); }} className="text-white/60 hover:text-white">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (newRenameValue.trim() && renameProject) {
                    const updatedProjects = projects.map((p) =>
                      p.id === renameProject.id
                        ? { ...p, name: newRenameValue.trim(), updatedAt: new Date().toISOString() }
                        : p
                    );
                    setProjects(updatedProjects);
                    updateProjectMetadata(renameProject.id, { name: newRenameValue.trim() });
                    setRenameProject(null);
                    setNewRenameValue("");
                  }
                }}
                className="btn-primary-glow"
                disabled={!newRenameValue.trim()}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Rename
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cover Image Dialog */}
      <Dialog open={!!coverImageProject} onOpenChange={(open) => { if (!open) { setCoverImageProject(null); setCoverImageUrl(""); } }}>
        <DialogContent className="bg-zinc-900/95 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Add Cover Image</DialogTitle>
            <DialogDescription className="text-white/60">
              Upload an image or paste a URL for your canvas cover
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Upload Option */}
            <div className="space-y-2">
              <Label className="text-white/70">Upload Image</Label>
              <div className="flex gap-2">
                <input
                  type="file"
                  id="canvas-cover-dialog-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    if (coverImageProject) {
                      await handleCanvasCoverUpload(e, coverImageProject.id);
                      setCoverImageProject(null);
                      setCoverImageUrl("");
                    }
                  }}
                  disabled={uploadingCoverFor === coverImageProject?.id}
                />
                <Button
                  variant="outline"
                  className="w-full bg-white/5 border-white/10 text-white hover:bg-white/10"
                  onClick={() => document.getElementById('canvas-cover-dialog-upload')?.click()}
                  disabled={uploadingCoverFor === coverImageProject?.id}
                >
                  {uploadingCoverFor === coverImageProject?.id ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  {uploadingCoverFor === coverImageProject?.id ? "Uploading..." : "Choose File"}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-white/40 text-xs">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* URL Option */}
            <div className="space-y-2">
              <Label className="text-white/70">Image URL</Label>
              <div className="flex gap-2">
                <Input
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
                <Button
                  onClick={async () => {
                    if (coverImageUrl.trim() && coverImageProject) {
                      const updatedProjects = projects.map(p =>
                        p.id === coverImageProject.id
                          ? { ...p, coverImage: coverImageUrl.trim(), updatedAt: new Date().toISOString() }
                          : p
                      );
                      setProjects(updatedProjects);
                      await updateProjectMetadata(coverImageProject.id, { coverImage: coverImageUrl.trim() });
                      setCoverImageProject(null);
                      setCoverImageUrl("");
                    }
                  }}
                  className="btn-primary-glow"
                  disabled={!coverImageUrl.trim()}
                >
                  <Link2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="ghost" onClick={() => { setCoverImageProject(null); setCoverImageUrl(""); }} className="text-white/60 hover:text-white">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Name Dialog — hidden until templates are production-ready */}

      {/* Collaboration Panel for Invites */}
      {inviteProject && (
        <CollaborationPanel
          canvasId={inviteProject.id}
          canvasName={inviteProject.name}
          isOwner={true}
          onlineCollaborators={[]}
          onClose={() => setInviteProject(null)}
        />
      )}

      {/* Footer */}
      <footer className="relative z-10 py-8 px-4 border-t border-white/10 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/images/CL Logo NL.png"
              alt="Cyberdelic Labs"
              width={32}
              height={32}
              className="w-8 h-8 rounded-lg opacity-70"
            />
            <span className="text-white/50 text-sm">Cyberdelic Labs</span>
          </div>

          <div className="flex items-center gap-2">

            <Image
              src="/images/CXD Logo 2.png"
              alt="CXD"
              width={28}
              height={28}
              className="object-contain"
            />



            <span className="text-white/50 text-sm">CXD Canvas</span>
          </div>

          <p className="text-white/30 text-sm">
            © 2025 Cyberdelic Labs
          </p>
        </div>
      </footer>
    </main>
  );
}
