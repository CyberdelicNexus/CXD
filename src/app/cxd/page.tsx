"use client";

import { useState, useEffect } from "react";
import { useCXDStore } from "@/store/cxd-store";
import { CXDWizard } from "@/components/cxd/cxd-wizard";
import { CXDCanvas } from "@/components/cxd/cxd-canvas";
import { CXDFocusMode } from "@/components/cxd/cxd-focus-mode";
import { CXDNavbar } from "@/components/cxd/cxd-navbar";
import { HexagonView } from "@/components/cxd/canvas/hexagon-view";
import { PlanView } from "@/components/cxd/plan/plan-view";
import { useProjectSync, getLocalBackup, clearLocalBackup } from "@/hooks/use-project-sync";
import { fetchUserProjects, saveProject } from "@/lib/supabase-projects";
import { createClient } from "../../../supabase/client";
import { useRouter } from "next/navigation";

export default function CXDPage() {
  const router = useRouter();
  const {
    viewMode,
    setViewMode,
    focusedSection,
    currentProjectId,
    projects,
    setProjects,
    canvasViewMode,
  } = useCXDStore();
  const [isRestoring, setIsRestoring] = useState(true);

  // Auto-sync project changes to database
  useProjectSync();

  // Restore project state on page reload
  useEffect(() => {
    const restoreProjectState = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Middleware should handle redirect, use window.location for full page navigation
        window.location.href = "/sign-in";
        return;
      }

      // If we have a currentProjectId but no projects loaded, restore from database
      if (currentProjectId && projects.length === 0) {
        const userProjects = await fetchUserProjects(user.id);

        // Check for localStorage backup before setting projects
        const backup = getLocalBackup();
        if (backup && backup.project && backup.project.id) {
          const dbProject = userProjects.find(p => p.id === backup.project.id);
          const oneHourAgo = Date.now() - (60 * 60 * 1000);

          if (backup.timestamp > oneHourAgo) {
            if (dbProject) {
              const dbUpdated = new Date(dbProject.updatedAt).getTime();
              // If backup is newer than database, use backup
              if (backup.timestamp > dbUpdated) {
                console.log('[CXD] Restoring from localStorage backup (newer than database)');
                const mergedProjects = userProjects.map(p =>
                  p.id === backup.project.id ? { ...backup.project, updatedAt: new Date().toISOString() } : p
                );
                setProjects(mergedProjects);
                // Save backup to database
                saveProject(backup.project).then(success => {
                  if (success) {
                    console.log('[CXD] Backup saved to database');
                    clearLocalBackup();
                  }
                });
                setIsRestoring(false);
                return;
              }
            }
            // Clear stale backup
            clearLocalBackup();
          } else {
            clearLocalBackup();
          }
        }

        if (userProjects.length > 0) {
          setProjects(userProjects);
        }
      }

      // Ensure we're not in home mode since CXD page is for editing
      if (viewMode === "home" && currentProjectId) {
        setViewMode("canvas");
      }

      setIsRestoring(false);
    };

    restoreProjectState();
  }, [
    currentProjectId,
    projects.length,
    setProjects,
    router,
    viewMode,
    setViewMode,
  ]);

  // Redirect to dashboard if no project is selected (separate effect to handle timing)
  useEffect(() => {
    if (!isRestoring && !currentProjectId) {
      // Use window.location for full page navigation to avoid RSC fetch issues
      window.location.href = "/dashboard";
    }
  }, [isRestoring, currentProjectId, router]);

  return (
    <div className="min-h-screen bg-gradient-radial">
      <CXDNavbar />
      <main className="pt-16">
        {isRestoring ? (
          <div className="flex items-center justify-center min-h-[80vh]">
            <div className="text-muted-foreground">Restoring project...</div>
          </div>
        ) : (
          <>
            {viewMode === "wizard" && <CXDWizard />}
            {viewMode === "canvas" && canvasViewMode === "canvas" && (
              <CXDCanvas />
            )}
            {viewMode === "canvas" && canvasViewMode === "hypercube" && (
              <HexagonView />
            )}
            {viewMode === "canvas" && canvasViewMode === "plan" && (
              <PlanView />
            )}
            {viewMode === "focus" && focusedSection && (
              <CXDFocusMode sectionId={focusedSection} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
