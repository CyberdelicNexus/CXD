"use client";

import { useState, useEffect, useCallback } from "react";
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
import { CollaborationProvider } from "@/contexts/collaboration-context";
import { YjsProjectProvider } from "@/contexts/yjs-project-context";
import { CreditTopUpSuccess } from "@/components/cxd/credit-topup-success";
import type { CanvasUpdate } from "@/hooks/use-collaboration";

export default function CXDPage() {
  const router = useRouter();
  const [showTopUpSuccess, setShowTopUpSuccess] = useState(false);
  const [topupPack, setTopupPack] = useState<string | null>(null);

  // Show success overlay when returning from Stripe credit checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("credits_topup") === "success") {
      setTopupPack(params.get("pack"));
      setShowTopUpSuccess(true);
    }
  }, []);

  // Mobile device detection and redirect
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth < 768;
      if (isMobile) {
        window.location.href = '/mobile-notice';
      }
    };
    checkMobile();
  }, []);

  const {
    viewMode,
    setViewMode,
    focusedSection,
    currentProjectId,
    projects,
    setProjects,
    canvasViewMode,
    addCanvasElement,
    updateCanvasElement,
    removeCanvasElement,
    addCanvasEdge,
    updateCanvasEdge,
    removeCanvasEdge,
    getCanvasElements,
    getCanvasEdges,
    // CXD Field update functions for remote sync
    updateSensoryDomain,
    updatePresenceType,
    toggleRealityPlane,
    updateRealityPlaneInterface,
    updateStateMapping,
    updateTraitMapping,
    updateIntentionProjectName,
    updateIntentionMainConcept,
    updateIntentionCoreMessage,
    updateDesiredInsights,
    updateDesiredFeelings,
    updateDesiredStates,
    updateDesiredKnowledge,
    updateHumanAudienceNeeds,
    updateHumanAudienceDesires,
    updateHumanUserRole,
    updateContextWorld,
    updateContextStory,
    updateContextMagic,
    updateExperienceFlowNarrative,
    updateExperienceFlowIntent,
  } = useCXDStore();
  const [isRestoring, setIsRestoring] = useState(true);
  const [hasHydrated, setHasHydrated] = useState(false);

  // Wait for Zustand to hydrate from localStorage
  useEffect(() => {
    // Small delay to ensure persist middleware has hydrated
    const timer = setTimeout(() => {
      setHasHydrated(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Handle remote updates from collaborators (shared across all views)
  // In CRDT mode, the Yjs provider handles all sync — skip LWW dispatch
  const handleRemoteUpdate = useCallback((update: CanvasUpdate) => {
    if (useCXDStore.getState().yDoc) return;
    console.log('[Collab] Received remote update:', update.type);

    switch (update.type) {
      case 'element_add':
        if (update.element) {
          addCanvasElement(update.element as any);
        }
        break;
      case 'element_update':
        if (update.elementId && update.changes) {
          updateCanvasElement(update.elementId, update.changes as any);
        }
        break;
      case 'element_delete':
        if (update.elementId) {
          removeCanvasElement(update.elementId);
        }
        break;
      case 'edge_add':
        if (update.edge) {
          addCanvasEdge(update.edge as any);
        }
        break;
      case 'edge_update':
        if (update.edgeId && update.edgeChanges) {
          updateCanvasEdge(update.edgeId, update.edgeChanges as any);
        }
        break;
      case 'edge_delete':
        if (update.edgeId) {
          removeCanvasEdge(update.edgeId);
        }
        break;
      case 'container_move':
        if (update.childUpdates) {
          update.childUpdates.forEach((u: { elementId: string; changes: Record<string, unknown> }) => {
            updateCanvasElement(u.elementId, u.changes as any);
          });
        }
        break;
      case 'state_sync':
        // Full state sync from undo/redo
        if (update.elements && update.edges) {
          const currentElements = getCanvasElements();
          const currentEdges = getCanvasEdges();

          // Remove elements that don't exist in synced state
          currentElements.forEach(el => {
            if (!update.elements!.find((e: any) => e.id === el.id)) {
              removeCanvasElement(el.id);
            }
          });

          // Remove edges that don't exist in synced state
          currentEdges.forEach(edge => {
            if (!update.edges!.find((e: any) => e.id === edge.id)) {
              removeCanvasEdge(edge.id);
            }
          });

          // Add or update elements from synced state
          update.elements.forEach((el: any) => {
            const existing = currentElements.find(e => e.id === el.id);
            if (existing) {
              updateCanvasElement(el.id, el);
            } else {
              addCanvasElement(el);
            }
          });

          // Add edges that don't exist
          update.edges.forEach((edge: any) => {
            const existing = currentEdges.find(e => e.id === edge.id);
            if (!existing) {
              addCanvasEdge(edge);
            }
          });
        }
        break;
      case 'field_update':
        // Handle CXD design field updates
        if (update.path && update.value !== undefined) {
          const [section, field, subfield] = update.path;
          console.log('[Collab] Field update:', section, field, subfield, update.value);

          switch (section) {
            case 'sensoryDomains':
              updateSensoryDomain(field as any, update.value as number);
              break;
            case 'presenceTypes':
              updatePresenceType(field as any, update.value as number);
              break;
            case 'realityPlanesV2':
              if (field === 'toggle') {
                toggleRealityPlane(update.value as any);
              } else if (subfield === 'interfaceModality') {
                updateRealityPlaneInterface(field as any, update.value as string);
              }
              break;
            case 'stateMapping':
              updateStateMapping(field as any, update.value as string);
              break;
            case 'traitMapping':
              updateTraitMapping(field as any, update.value as string);
              break;
            case 'intentionCore':
              if (field === 'projectName') updateIntentionProjectName(update.value as string);
              else if (field === 'mainConcept') updateIntentionMainConcept(update.value as string);
              else if (field === 'coreMessage') updateIntentionCoreMessage(update.value as string);
              break;
            case 'desiredChange':
              if (field === 'insights') updateDesiredInsights(update.value as string);
              else if (field === 'feelings') updateDesiredFeelings(update.value as string);
              else if (field === 'states') updateDesiredStates(update.value as string);
              else if (field === 'knowledge') updateDesiredKnowledge(update.value as string);
              break;
            case 'humanContext':
              if (field === 'audienceNeeds') updateHumanAudienceNeeds(update.value as string);
              else if (field === 'audienceDesires') updateHumanAudienceDesires(update.value as string);
              else if (field === 'userRole') updateHumanUserRole(update.value as string);
              break;
            case 'contextAndMeaning':
              if (field === 'world') updateContextWorld(update.value as string);
              else if (field === 'story') updateContextStory(update.value as string);
              else if (field === 'magic') updateContextMagic(update.value as string);
              break;
            case 'experienceFlow':
              if (subfield === 'narrativeNotes') {
                updateExperienceFlowNarrative(field as any, update.value as string);
              } else if (subfield === 'designIntent') {
                updateExperienceFlowIntent(field as any, update.value as string);
              }
              break;
          }
        }
        break;
    }
  }, [
    addCanvasElement, updateCanvasElement, removeCanvasElement,
    addCanvasEdge, updateCanvasEdge, removeCanvasEdge,
    getCanvasElements, getCanvasEdges,
    updateSensoryDomain, updatePresenceType, toggleRealityPlane, updateRealityPlaneInterface,
    updateStateMapping, updateTraitMapping,
    updateIntentionProjectName, updateIntentionMainConcept, updateIntentionCoreMessage,
    updateDesiredInsights, updateDesiredFeelings, updateDesiredStates, updateDesiredKnowledge,
    updateHumanAudienceNeeds, updateHumanAudienceDesires, updateHumanUserRole,
    updateContextWorld, updateContextStory, updateContextMagic,
    updateExperienceFlowNarrative, updateExperienceFlowIntent
  ]);

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
    // Wait for Zustand to hydrate before checking currentProjectId
    if (!isRestoring && hasHydrated && !currentProjectId) {
      // Use window.location for full page navigation to avoid RSC fetch issues
      window.location.href = "/dashboard";
    }
  }, [isRestoring, hasHydrated, currentProjectId, router]);

  return (
    <YjsProjectProvider>
    <CollaborationProvider onRemoteUpdate={handleRemoteUpdate}>
      <div className="min-h-screen bg-gradient-radial">
        <CXDNavbar />
        <main className="pt-20">
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
              {viewMode === "canvas" && canvasViewMode === "hexagon" && (
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
      {showTopUpSuccess && (
        <CreditTopUpSuccess
          packId={topupPack}
          onDismiss={() => setShowTopUpSuccess(false)}
        />
      )}
    </CollaborationProvider>
    </YjsProjectProvider>
  );
}
