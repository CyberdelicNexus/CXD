"use client";

import React, { useState, useEffect } from "react";
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
import {
  Plus,
  Trash2,
  Clock,
  FolderOpen,
  User,
  HelpCircle,
  Bug,
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
} from "lucide-react";
import { HypercubeLogo } from "@/components/icons/hypercube-logo";
import { useRouter } from "next/navigation";
import { fetchUserProjects, ensureUserProfile, saveProject } from "@/lib/supabase-projects";
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
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [inviteProject, setInviteProject] = useState<{ id: string; name: string } | null>(null);
  const [renameProject, setRenameProject] = useState<{ id: string; name: string } | null>(null);
  const [newRenameValue, setNewRenameValue] = useState("");
  const [uploadingCoverFor, setUploadingCoverFor] = useState<string | null>(null);
  const [coverImageProject, setCoverImageProject] = useState<{ id: string; name: string } | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState("");

  // Subscription state
  const {
    isFree,
    isPro,
    isLifetime,
    isBetaTester,
    canCreateCanvas,
    isTrialing,
    trialDaysRemaining
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

  useEffect(() => {
    const loadUserAndProjects = async () => {
      await flushPendingSave();
      await ensureUserProfile(userId, userEmail);

      // Fetch projects via API route (uses admin client to bypass RLS)
      let userProjects: any[] = [];
      try {
        const response = await fetch('/api/projects');
        const data = await response.json();
        if (data.projects) {
          userProjects = data.projects;
        }
      } catch (error) {
        console.error('Error fetching projects from API:', error);
        // Fallback to client-side fetch
        userProjects = await fetchUserProjects(userId);
      }

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

      const profile = await getUserProfile(userId);
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

  const handleOpenProject = (projectId: string) => {
    loadProject(projectId);
    router.push("/cxd");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const totalProjects = projects.length;

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

  const handleCoverMouseDown = (e: React.MouseEvent) => {
    if (!isRepositionMode || !userProfile?.cover_image) return;
    e.preventDefault();
    setIsDraggingCover(true);
    setDragStart({ x: e.clientX, y: e.clientY - coverImagePosition.y });
  };

  const handleCoverMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCover || !isRepositionMode) return;
    const newY = e.clientY - dragStart.y;
    setCoverImagePosition((prev) => ({ ...prev, y: Math.max(-200, Math.min(200, newY)) }));
  };

  const handleCoverMouseUp = () => {
    if (!isDraggingCover) return;
    setIsDraggingCover(false);
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
        const project = projects.find(p => p.id === projectId);
        if (project) {
          const updatedProject = {
            ...project,
            coverImage: imageUrl,
            updatedAt: new Date().toISOString()
          };
          const updatedProjects = projects.map(p =>
            p.id === projectId ? updatedProject : p
          );
          setProjects(updatedProjects);
          await saveProject(updatedProject);
        }
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
    <main className="min-h-screen bg-black text-white">
      {/* Background */}
      <div className="fixed inset-0 grid-bg pointer-events-none" />
      <div className="fixed inset-0 hero-gradient pointer-events-none" />

      {/* Decorative orbs */}
      <div className="glow-orb" style={{ top: '10%', right: '10%', opacity: 0.3 }} />
      <div className="glow-orb glow-orb-cyan" style={{ bottom: '20%', left: '5%', opacity: 0.2 }} />

      <div className="relative z-10 container mx-auto px-4 py-6 max-w-7xl">
        {/* Profile Header */}
        <div className="relative mb-8 rounded-2xl overflow-hidden glass-card-glow">
          {/* Cover Image */}
          <div
            className="relative h-48 bg-gradient-to-br from-violet-900/30 via-purple-900/20 to-cyan-900/20 overflow-hidden"
            onMouseMove={handleCoverMouseMove}
            onMouseUp={handleCoverMouseUp}
            onMouseLeave={handleCoverMouseUp}
          >
            {userProfile?.cover_image ? (
              <div
                className={`absolute inset-0 ${isRepositionMode ? (isDraggingCover ? "cursor-grabbing" : "cursor-grab") : ""}`}
                onMouseDown={handleCoverMouseDown}
              >
                <Image
                  src={userProfile.cover_image}
                  alt="Cover"
                  fill
                  className="object-cover select-none"
                  draggable={false}
                  style={{ objectPosition: `50% ${50 + coverImagePosition.y / 4}%` }}
                />
                {isRepositionMode && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <p className="text-white font-medium">
                      {isDraggingCover ? "Release to stop" : "Drag to reposition"}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Camera className="w-10 h-10 text-white/20" />
              </div>
            )}

            {/* Cover Actions */}
            <div className="absolute top-4 right-4 flex gap-2">
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

          {/* Profile Info */}
          <div className="relative px-6 pb-6 bg-black/40 backdrop-blur-sm border-t border-white/10">
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
                    <h2 className="text-xl font-bold text-white">{userName}</h2>
                    <Badge className={`text-xs ${planBadge.color}`}>
                      {planBadge.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-white/50">{userEmail}</p>
                </div>
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
                    <Button className="btn-primary-glow">
                      {canCreate ? (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Create New Map
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
                        <DialogTitle>Create New Experience Map</DialogTitle>
                        <DialogDescription className="text-white/60">
                          Give your new CXD project a name
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

        {/* Main Content - 70/30 Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Left Column - Experience Maps (70%) */}
          <div className="glass-card rounded-xl overflow-hidden">
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
                    Create your first CXD map to start designing transformational experiences.
                  </p>
                  <Button onClick={() => setIsDialogOpen(true)} className="btn-primary-glow">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Map
                  </Button>
                </div>
              )}

              {!isLoading && projects.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects.map((project) => {
                    const isOwner = project.ownerId === userId;
                    const coverImage = (project as any).coverImage;
                    const isUploading = uploadingCoverFor === project.id;

                    return (
                      <div
                        key={project.id}
                        className="relative aspect-square rounded-xl bg-gradient-to-br from-violet-900/60 via-purple-800/50 to-indigo-900/60 hover:from-violet-800/70 hover:via-purple-700/60 hover:to-indigo-800/70 transition-all cursor-pointer group border border-violet-500/20 hover:border-violet-400/40 overflow-hidden shadow-lg hover:shadow-violet-500/20"
                        onClick={() => handleOpenProject(project.id)}
                      >
                        {/* Cover Image - using img tag to support any external URL */}
                        {coverImage && (
                          <div className="absolute inset-0">
                            <img
                              src={coverImage}
                              alt={project.name}
                              className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                            />
                          </div>
                        )}

                        {/* Default Hypercube Logo - positioned above gradient */}
                        {!coverImage && (
                          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                            <div className="opacity-40 group-hover:opacity-60 transition-opacity">
                              <Image
                                src="/images/hypercube-logo.webp"
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

                        {/* Project Name - Top */}
                        <div className="absolute top-3 left-3 right-16">
                          <h4 className="font-semibold text-white text-lg truncate group-hover:text-violet-200 transition-colors drop-shadow-md">
                            {project.name}
                          </h4>
                          <div className="flex items-center gap-1 text-xs text-white/50 mt-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(project.updatedAt)}</span>
                          </div>
                        </div>

                        {/* Action Buttons - Bottom */}
                        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
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

                            {isOwner && (
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
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Stats & Quick Actions (30%) */}
          <div className="space-y-6">
            {/* Stats Grid - 2x2 */}
            <div className="glass-card p-4 rounded-xl">
              <h3 className="text-sm font-medium text-white/70 mb-3">Statistics</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <Layers className="w-4 h-4 text-violet-400" />
                  </div>
                  <p className="text-xl font-bold text-white">{totalProjects}</p>
                  <p className="text-xs text-white/50">Total Maps</p>
                </div>

                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                  </div>
                  <p className="text-xl font-bold text-white">
                    {projects.filter((p) => new Date(p.updatedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}
                  </p>
                  <p className="text-xs text-white/50">Active</p>
                </div>

                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <Calendar className="w-4 h-4 text-purple-400" />
                  </div>
                  <p className="text-xl font-bold text-white">
                    {projects.filter((p) => new Date(p.createdAt).getMonth() === new Date().getMonth()).length}
                  </p>
                  <p className="text-xs text-white/50">This Month</p>
                </div>

                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-xl font-bold text-white">—</p>
                  <p className="text-xs text-white/50">Analytics</p>
                </div>
              </div>
            </div>

            {/* Quick Actions - 2x2 */}
            <div className="glass-card p-4 rounded-xl">
              <h3 className="text-sm font-medium text-white/70 mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="ghost"
                  className="h-auto py-4 flex-col gap-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white"
                  onClick={() => setIsSupportOpen(true)}
                >
                  <HelpCircle className="w-5 h-5 text-violet-400" />
                  <span className="text-xs">Support</span>
                </Button>
                <Button
                  variant="ghost"
                  className="h-auto py-4 flex-col gap-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white"
                  onClick={() => setIsBugReportOpen(true)}
                >
                  <Bug className="w-5 h-5 text-cyan-400" />
                  <span className="text-xs">Bug Report</span>
                </Button>
                <Button
                  variant="ghost"
                  className="h-auto py-4 flex-col gap-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white"
                  onClick={() => router.push("/dashboard/docs")}
                >
                  <FileText className="w-5 h-5 text-purple-400" />
                  <span className="text-xs">Docs</span>
                </Button>
                <Button
                  variant="ghost"
                  className="h-auto py-4 flex-col gap-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white"
                  onClick={() => router.push("/dashboard/tutorials")}
                >
                  <PlayCircle className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs">Tutorials</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="unlimitedCanvases"
      />

      {/* Support Dialog */}
      <Dialog open={isSupportOpen} onOpenChange={setIsSupportOpen}>
        <DialogContent className="bg-zinc-900/95 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Contact Support</DialogTitle>
            <DialogDescription className="text-white/60">How can we help?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-white/70">Subject</Label>
              <Input placeholder="What do you need help with?" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Message</Label>
              <textarea rows={5} placeholder="Describe your issue..." className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/50" />
            </div>
            <Button className="w-full btn-primary-glow">Send Message</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bug Report Dialog */}
      <Dialog open={isBugReportOpen} onOpenChange={setIsBugReportOpen}>
        <DialogContent className="bg-zinc-900/95 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Report a Bug</DialogTitle>
            <DialogDescription className="text-white/60">Help us improve</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-white/70">Bug Title</Label>
              <Input placeholder="Brief description" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Description</Label>
              <textarea rows={4} placeholder="What happened?" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/50" />
            </div>
            <Button className="w-full btn-primary-glow">Submit Report</Button>
          </div>
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
              onClick={async () => {
                if (projectToDelete) {
                  const proj = projects.find((p) => p.id === projectToDelete);
                  deleteProject(projectToDelete);
                  await createNotification(userId, "PROJECT_DELETED", `Project "${proj?.name}" deleted`, { projectId: projectToDelete });
                  setDeleteConfirmOpen(false);
                  setProjectToDelete(null);
                }
              }}
            >
              Delete
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
                    const updatedProject = updatedProjects.find((p) => p.id === renameProject.id);
                    if (updatedProject) saveProject(updatedProject);
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
                    const updatedProject = updatedProjects.find((p) => p.id === renameProject.id);
                    if (updatedProject) saveProject(updatedProject);
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
                      const project = projects.find(p => p.id === coverImageProject.id);
                      if (project) {
                        const updatedProject = {
                          ...project,
                          coverImage: coverImageUrl.trim(),
                          updatedAt: new Date().toISOString()
                        };
                        const updatedProjects = projects.map(p =>
                          p.id === coverImageProject.id ? updatedProject : p
                        );
                        setProjects(updatedProjects);
                        await saveProject(updatedProject);
                      }
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
            <img
              src="/images/CL Logo NL.png"
              alt="Cyberdelic Labs"
              className="w-8 h-8 rounded-lg opacity-70"
            />
            <span className="text-white/50 text-sm">Cyberdelic Labs</span>
          </div>

          <div className="flex items-center gap-2">
            <HypercubeLogo size={20} />
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
