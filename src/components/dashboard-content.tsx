"use client";

import React, { useState, useEffect } from "react";
import { useCXDStore } from "@/store/cxd-store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Sparkles,
  Trash2,
  Clock,
  FolderOpen,
  User,
  Mail,
  Lock,
  CreditCard,
  Receipt,
  HelpCircle,
  Bug,
  FileText,
  PlayCircle,
  ExternalLink,
  BarChart3,
  Layers,
  TrendingUp,
  Calendar,
  ArrowRight,
  ChevronRight,
  Camera,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { fetchUserProjects, ensureUserProfile, saveProject } from "@/lib/supabase-projects";
import { createNotification } from "@/lib/notifications";
import { createClient } from "../../supabase/client";
import { getLocalBackup, clearLocalBackup, flushPendingSave } from "@/hooks/use-project-sync";
import {
  getUserProfile,
  uploadProfileImage,
  updateUserCoverImage,
  updateUserCoverImagePosition,
  updateUserProfilePicture,
  removeUserCoverImage,
  removeUserProfilePicture,
  UserProfile,
} from "@/lib/user-profile";
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
  const [activeTab, setActiveTab] = useState("projects");
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangeEmailOpen, setIsChangeEmailOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

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

  useEffect(() => {
    const loadUserAndProjects = async () => {
      // First, flush any pending saves to ensure we don't lose data
      await flushPendingSave();

      await ensureUserProfile(userId, userEmail);
      const userProjects = await fetchUserProjects(userId);

      // Check for localStorage backup before setting projects
      const backup = getLocalBackup();
      if (backup && backup.project && backup.project.id) {
        const dbProject = userProjects.find(p => p.id === backup.project.id);
        const oneHourAgo = Date.now() - (60 * 60 * 1000);

        if (backup.timestamp > oneHourAgo) {
          if (dbProject) {
            const dbUpdated = new Date(dbProject.updatedAt).getTime();
            // If backup is newer than database, merge it in
            if (backup.timestamp > dbUpdated) {
              console.log('[Dashboard] Restoring from localStorage backup (newer than database)');
              const mergedProjects = userProjects.map(p =>
                p.id === backup.project.id ? { ...backup.project, updatedAt: new Date().toISOString() } : p
              );
              setProjects(mergedProjects);
              // Save backup to database
              saveProject(backup.project).then(success => {
                if (success) {
                  console.log('[Dashboard] Backup saved to database');
                  clearLocalBackup();
                }
              });
            } else {
              // Database is newer, clear stale backup
              clearLocalBackup();
              if (userProjects.length > 0) {
                setProjects(userProjects);
              }
            }
          } else {
            // No matching project in database, clear backup
            clearLocalBackup();
            if (userProjects.length > 0) {
              setProjects(userProjects);
            }
          }
        } else {
          // Backup is too old, clear it
          clearLocalBackup();
          if (userProjects.length > 0) {
            setProjects(userProjects);
          }
        }
      } else if (userProjects.length > 0) {
        setProjects(userProjects);
      }

      // Load user profile with images
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
    if (newProjectName.trim()) {
      const projectId = createProject(newProjectName.trim(), userId);
      setNewProjectName("");
      setIsDialogOpen(false);

      // Create notification for project creation
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

  // Get recent projects (last 3)
  const recentProjects = projects.slice(0, 3);
  const totalProjects = projects.length;

  // Cover image upload handler
  const handleCoverImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCover(true);
    try {
      const imageUrl = await uploadProfileImage(userId, file, "cover");
      if (imageUrl) {
        const success = await updateUserCoverImage(userId, imageUrl);
        if (success) {
          setUserProfile((prev) =>
            prev ? { ...prev, cover_image: imageUrl } : null,
          );
        } else {
          console.error("Failed to save cover image to database");
        }
      }
    } catch (error) {
      console.error("Error uploading cover image:", error);
    } finally {
      setIsUploadingCover(false);
    }
  };

  // Profile picture upload handler
  const handleProfilePictureUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingProfile(true);
    try {
      const imageUrl = await uploadProfileImage(userId, file, "profile");
      if (imageUrl) {
        const success = await updateUserProfilePicture(userId, imageUrl);
        if (success) {
          setUserProfile((prev) =>
            prev ? { ...prev, profile_picture: imageUrl } : null,
          );
        } else {
          console.error("Failed to save profile picture to database");
        }
      }
    } catch (error) {
      console.error("Error uploading profile picture:", error);
    } finally {
      setIsUploadingProfile(false);
    }
  };

  // Cover image repositioning handlers
  const enterRepositionMode = () => {
    setOriginalCoverPosition(coverImagePosition);
    setIsRepositionMode(true);
  };

  const handleCoverMouseDown = (e: React.MouseEvent) => {
    if (!isRepositionMode || !userProfile?.cover_image) return;
    e.preventDefault();
    setIsDraggingCover(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY - coverImagePosition.y,
    });
  };

  const handleCoverMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCover || !isRepositionMode) return;
    const newY = e.clientY - dragStart.y;
    setCoverImagePosition((prev) => ({
      ...prev,
      y: Math.max(-200, Math.min(200, newY)),
    }));
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
      console.error("Failed to save cover position");
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

  const handleRemoveCover = async () => {
    await removeUserCoverImage(userId);
    setUserProfile((prev) => (prev ? { ...prev, cover_image: null } : null));
    setCoverImagePosition({ x: 0, y: 0 });
  };

  const handleRemoveProfilePicture = async () => {
    await removeUserProfilePicture(userId);
    setUserProfile((prev) =>
      prev ? { ...prev, profile_picture: null } : null,
    );
  };

  return (
    <main className="w-full min-h-screen bg-gradient-radial">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Profile Header with Cover Image and Profile Picture */}
        <div className="relative mb-8 rounded-2xl overflow-hidden shadow-2xl">
          {/* Cover Image */}
          <div
            className="relative h-64 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-teal-900/20 overflow-hidden"
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
                  style={{
                    objectPosition: `50% ${50 + coverImagePosition.y / 4}%`,
                  }}
                />
                {isRepositionMode && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <p className="text-white font-medium text-lg">
                      {isDraggingCover ? "Release to stop dragging" : "Click and drag to reposition"}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No cover image
                  </p>
                </div>
              </div>
            )}

            {/* Cover Image Actions */}
            <div className="absolute top-4 right-4 flex gap-2">
              <input
                type="file"
                id="cover-upload"
                accept="image/*"
                className="hidden"
                onChange={handleCoverImageUpload}
                disabled={isUploadingCover || isRepositionMode}
              />
              {isRepositionMode ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="bg-red-500/80 hover:bg-red-500 text-white backdrop-blur cursor-pointer"
                    onClick={cancelReposition}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="bg-green-500/80 hover:bg-green-500 text-white backdrop-blur cursor-pointer"
                    onClick={saveRepositionAndExit}
                  >
                    Done
                  </Button>
                </>
              ) : (
                <>
                  {userProfile?.cover_image && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="bg-black/50 hover:bg-black/70 backdrop-blur cursor-pointer"
                      onClick={enterRepositionMode}
                    >
                      <span className="flex items-center">
                        <Camera className="w-4 h-4 mr-2" />
                        Reposition
                      </span>
                    </Button>
                  )}
                  <label htmlFor="cover-upload">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="bg-black/50 hover:bg-black/70 backdrop-blur cursor-pointer"
                      disabled={isUploadingCover}
                      asChild
                    >
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        {isUploadingCover ? "Uploading..." : "Change Cover"}
                      </span>
                    </Button>
                  </label>
                </>
              )}
            </div>
          </div>

          {/* Profile Info Section */}
          <div className="relative bg-card/80 backdrop-blur-sm border-t border-border px-8 pb-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              {/* Profile Picture */}
              <div className="relative -mt-16">
                <div className="relative">
                  {userProfile?.profile_picture ? (
                    <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-card shadow-2xl">
                      <Image
                        src={userProfile.profile_picture}
                        alt="Profile"
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-full border-4 border-card shadow-2xl bg-gradient-to-br from-purple-500/20 to-teal-500/20 flex items-center justify-center">
                      <User className="w-16 h-16 text-muted-foreground" />
                    </div>
                  )}

                  {/* Profile Picture Upload Button */}
                  <div className="absolute bottom-0 right-0">
                    <input
                      type="file"
                      id="profile-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={handleProfilePictureUpload}
                      disabled={isUploadingProfile}
                    />
                    <label htmlFor="profile-upload">
                      <Button
                        size="sm"
                        className="rounded-full w-10 h-10 p-0 cursor-pointer"
                        disabled={isUploadingProfile}
                        asChild
                      >
                        <span>
                          {isUploadingProfile ? (
                            <span className="animate-spin">⏳</span>
                          ) : (
                            <Camera className="w-4 h-4" />
                          )}
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>

                <div className="mt-4">
                  <h2 className="text-2xl font-bold">{userName}</h2>
                  <p className="text-sm text-muted-foreground">{userEmail}</p>
                </div>
              </div>
              {/* Quick Actions */}
              <div className="flex items-center gap-2 mt-4 md:mt-0">
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className={"glow-teal"}>
                      <Plus className={"w-4 h-4 mr-2"} />
                      Create New Map
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border">
                    <DialogHeader>
                      <DialogTitle>Create New Experience Map</DialogTitle>
                      <DialogDescription>
                        Give your new CXD project a name to get started
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="project-name">Project Name</Label>
                        <Input
                          id="project-name"
                          placeholder="Enter project name..."
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleCreateProject();
                            }
                          }}
                          className="bg-input border-border"
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-3 justify-end">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setIsDialogOpen(false);
                            setNewProjectName("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleCreateProject}
                          className="glow-teal"
                          disabled={!newProjectName.trim()}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Map
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </div>
        {/* Header with Welcome & Quick Stats */}

        {/* Main Grid Layout */}
        <div className="grid grid-cols-12 gap-6 h-fit">
          {/* Left Column - Main Content */}
          <div className="col-span-12 lg:col-span-8 space-y-6 h-fit">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="gradient-border bg-card/50 backdrop-blur">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Total Maps
                      </p>
                      <p className="text-2xl font-bold">{totalProjects}</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Layers className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="gradient-border bg-card/50 backdrop-blur">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Active
                      </p>
                      <p className="text-2xl font-bold">
                        {
                          projects.filter(
                            (p) =>
                              new Date(p.updatedAt) >
                              new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                          ).length
                        }
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-accent" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="gradient-border bg-card/50 backdrop-blur">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        This Month
                      </p>
                      <p className="text-2xl font-bold">
                        {
                          projects.filter(
                            (p) =>
                              new Date(p.createdAt).getMonth() ===
                              new Date().getMonth(),
                          ).length
                        }
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="gradient-border bg-card/50 backdrop-blur">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Analytics
                      </p>
                      <p className="text-2xl font-bold">—</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-teal-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Experience Maps Section */}
            <Card className="gradient-border bg-card/50 backdrop-blur h-fit">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    Your Experience Maps
                  </CardTitle>
                  <Badge variant="outline" className="text-muted-foreground">
                    {totalProjects} total
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {/* Loading State */}
                {isLoading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-pulse text-muted-foreground">
                      Loading your projects...
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {!isLoading && projects.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                      <FolderOpen className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">
                      No projects yet
                    </h3>
                    <p className="text-muted-foreground text-center mb-4 max-w-md">
                      Create your first CXD map to start designing
                      transformational experiences.
                    </p>
                    <Button
                      onClick={() => setIsDialogOpen(true)}
                      className="glow-teal"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Map
                    </Button>
                  </div>
                )}

                {/* Projects List */}
                {!isLoading && projects.length > 0 && (
                  <div className="space-y-3">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-background/50 hover:bg-background/80 transition-colors cursor-pointer group border border-border/50"
                        onClick={() => handleOpenProject(project.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                            <Sparkles className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-medium">{project.name}</h4>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>
                                Updated {formatDate(project.updatedAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProjectToDelete(project.id);
                              setDeleteConfirmOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Sidebar */}
          <div className="col-span-12 lg:col-span-4 space-y-6 h-fit">
            {/* Account Card */}
            <Card className="gradient-border bg-card/50 backdrop-blur h-fit">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <CardTitle className="text-base">{userName}</CardTitle>
                    <CardDescription className="text-xs truncate max-w-[180px]">
                      {userEmail}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Tabs defaultValue="account" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-background/50">
                    <TabsTrigger value="account" className="text-xs">
                      Account
                    </TabsTrigger>
                    <TabsTrigger value="billing" className="text-xs">
                      Billing
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="account" className="space-y-2 mt-3">
                    <button
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-background/50 transition-colors text-left"
                      onClick={() => setIsEditProfileOpen(true)}
                    >
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Edit Profile</span>
                    </button>
                    <button
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-background/50 transition-colors text-left"
                      onClick={() => setIsChangeEmailOpen(true)}
                    >
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Change Email</span>
                    </button>
                    <button
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-background/50 transition-colors text-left"
                      onClick={() => router.push("/dashboard/reset-password")}
                    >
                      <Lock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Change Password</span>
                    </button>
                  </TabsContent>
                  <TabsContent value="billing" className="space-y-2 mt-3">
                    <div className="p-3 rounded-lg bg-background/50 border border-border/50 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">
                          Current Plan
                        </span>
                        <Badge className="bg-primary/20 text-primary border-0">
                          Free
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">Starter</p>
                    </div>
                    <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-background/50 transition-colors text-left">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Upgrade Plan</span>
                    </button>
                    <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-background/50 transition-colors text-left">
                      <Receipt className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Billing History</span>
                    </button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            {/* Quick Actions */}
            <Card className="gradient-border bg-card/50 backdrop-blur h-fit">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto py-3 flex-col gap-1 bg-background/50 border-border/50 hover:bg-background/80"
                  onClick={() => setIsSupportOpen(true)}
                >
                  <HelpCircle className="w-4 h-4 text-primary" />
                  <span className="text-xs">Support</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto py-3 flex-col gap-1 bg-background/50 border-border/50 hover:bg-background/80"
                  onClick={() => setIsBugReportOpen(true)}
                >
                  <Bug className="w-4 h-4 text-accent" />
                  <span className="text-xs">Bug Report</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto py-3 flex-col gap-1 bg-background/50 border-border/50 hover:bg-background/80"
                  onClick={() => router.push("/dashboard/docs")}
                >
                  <FileText className="w-4 h-4 text-purple-400" />
                  <span className="text-xs">Docs</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto py-3 flex-col gap-1 bg-background/50 border-border/50 hover:bg-background/80"
                  onClick={() => router.push("/dashboard/tutorials")}
                >
                  <PlayCircle className="w-4 h-4 text-teal-400" />
                  <span className="text-xs">Tutorials</span>
                </Button>
              </CardContent>
            </Card>
            {/* Resources */}
          </div>
        </div>
      </div>
      {/* Edit Profile Dialog */}
      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your profile information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                defaultValue={userName}
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Input
                id="bio"
                placeholder="Tell us about yourself"
                className="bg-input border-border"
              />
            </div>
            <Button className="w-full glow-teal">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Change Email Dialog */}
      <Dialog open={isChangeEmailOpen} onOpenChange={setIsChangeEmailOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Change Email</DialogTitle>
            <DialogDescription>Update your email address</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-email">Current Email</Label>
              <Input
                id="current-email"
                value={userEmail}
                disabled
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">New Email</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="your.new@email.com"
                className="bg-input border-border"
              />
            </div>
            <Button className="w-full glow-teal">Update Email</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Support Dialog */}
      <Dialog open={isSupportOpen} onOpenChange={setIsSupportOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Contact Support</DialogTitle>
            <DialogDescription>How can we help you today?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="What do you need help with?"
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <textarea
                id="message"
                rows={5}
                placeholder="Describe your issue in detail..."
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <Button className="w-full glow-teal">Send Message</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Bug Report Dialog */}
      <Dialog open={isBugReportOpen} onOpenChange={setIsBugReportOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Report a Bug</DialogTitle>
            <DialogDescription>
              Help us improve by reporting bugs
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bug-title">Bug Title</Label>
              <Input
                id="bug-title"
                placeholder="Brief description of the bug"
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bug-description">Description</Label>
              <textarea
                id="bug-description"
                rows={5}
                placeholder="What happened? What did you expect to happen?"
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bug-steps">Steps to Reproduce</Label>
              <textarea
                id="bug-steps"
                rows={3}
                placeholder="1. Go to...&#10;2. Click on...&#10;3. See error"
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <Button className="w-full glow-teal">Submit Bug Report</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this project? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end py-4">
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setProjectToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (projectToDelete) {
                  // Get project name before deletion
                  const projectToDeleteObj = projects.find(
                    (p) => p.id === projectToDelete,
                  );
                  const projectName = projectToDeleteObj?.name || "Project";

                  deleteProject(projectToDelete);

                  // Create notification for project deletion
                  await createNotification(
                    userId,
                    "PROJECT_DELETED",
                    `Project "${projectName}" has been deleted`,
                    { projectId: projectToDelete, projectName },
                  );

                  setDeleteConfirmOpen(false);
                  setProjectToDelete(null);
                }
              }}
            >
              Delete Project
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
