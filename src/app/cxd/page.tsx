"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useCXDStore } from "@/store/cxd-store";
import { CXDNavbar } from "@/components/cxd/cxd-navbar";
import { LoadingScreen } from "@/components/cxd/loading-screen";
import { useProjectSync, getLocalBackup, clearLocalBackup } from "@/hooks/use-project-sync";
import { fetchUserProjects, saveProject } from "@/lib/supabase-projects";
import { createClient } from "../../../supabase/client";
import { useRouter } from "next/navigation";
import { CollaborationProvider } from "@/contexts/collaboration-context";
import { YjsProjectProvider } from "@/contexts/yjs-project-context";
import { CreditTopUpSuccess } from "@/components/cxd/credit-topup-success";
import { TourOverlay } from "@/components/cxd/tour/tour-overlay";
import type { CanvasUpdate } from "@/hooks/use-collaboration";

// Skeleton loader shown while dynamic components are loading their JS chunks
function ViewSkeleton() {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-3 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
        <span className="text-sm text-purple-300/70 animate-pulse">Loading view...</span>
      </div>
    </div>
  );
}

// Dynamically import heavy components with skeleton loading fallback
const CXDWizard = dynamic(() => import("@/components/cxd/cxd-wizard").then(mod => ({ default: mod.CXDWizard })), {
  ssr: false,
  loading: () => <ViewSkeleton />,
});
const CXDCanvas = dynamic(() => import("@/components/cxd/cxd-canvas").then(mod => ({ default: mod.CXDCanvas })), {
  ssr: false,
  loading: () => <ViewSkeleton />,
});
const CXDFocusMode = dynamic(() => import("@/components/cxd/cxd-focus-mode").then(mod => ({ default: mod.CXDFocusMode })), {
  ssr: false,
  loading: () => <ViewSkeleton />,
});
const HexagonView = dynamic(() => import("@/components/cxd/canvas/hexagon-view").then(mod => ({ default: mod.HexagonView })), {
  ssr: false,
  loading: () => <ViewSkeleton />,
});
const PlanView = dynamic(() => import("@/components/cxd/plan/plan-view").then(mod => ({ default: mod.PlanView })), {
  ssr: false,
  loading: () => <ViewSkeleton />,
});

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
    setCachedUserProfile,
  } = useCXDStore();
  const [isRestoring, setIsRestoring] = useState(true);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  // Track minimum loading time so LoadingScreen doesn't flash
  const [minLoadTimePassed, setMinLoadTimePassed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMinLoadTimePassed(true), 800);
    return () => clearTimeout(timer);
  }, []);

  // Wait for Zustand to hydrate from localStorage
  useEffect(() => {
    // Small delay to ensure persist middleware has hydrated
    const timer = setTimeout(() => {
      setHasHydrated(true);
    }, 50); // Reduced from 100ms to 50ms for faster loading
    return () => clearTimeout(timer);
  }, []);

  // Add transition effect when switching views
  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 300);
    return () => clearTimeout(timer);
  }, [viewMode, canvasViewMode]);

  // Load and cache user profile for comments
  useEffect(() => {
    async function loadUserProfile() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase.from('users').select('full_name, name, profile_picture').eq('id', user.id).single();
          const avatar = data?.profile_picture
            || user.user_metadata?.avatar_url
            || user.user_metadata?.picture
            || null;
          setCachedUserProfile({
            name: data?.full_name || data?.name || user.email?.split('@')[0] || 'You',
            avatar,
          });
        }
      } catch (err) {
        console.error('[CXD] Error loading user profile for comments:', err);
      }
    }
    loadUserProfile();
  }, [setCachedUserProfile]);

  // Handle remote updates from collaborators (shared across all views).
  // LWW broadcasts are sent even in CRDT mode as a fallback for dropped Yjs updates.
  // Receivers apply them with deduplication: element_add only if not already present.
  const handleRemoteUpdate = useCallback((update: CanvasUpdate) => {
    const state = useCXDStore.getState();
    const inCrdtMode = !!state.yDoc;
    console.log('[Collab] Received remote update:', update.type, inCrdtMode ? '(CRDT mode)' : '(LWW mode)');

    switch (update.type) {
      case 'element_add':
        if (update.element) {
          // Dedup: skip if Yjs already synced this element to avoid double-writing Y.Doc
          const alreadyExists = getCanvasElements().some((e) => e.id === (update.element as any).id);
          if (!alreadyExists) {
            addCanvasElement(update.element as any);
          }
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
        // Full state sync from undo/redo — skip in CRDT mode, Yjs owns full state
        if (inCrdtMode) break;
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
        // Skip in CRDT mode — Yjs handles field sync via YjsZustandBridge
        if (inCrdtMode) break;
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

      // Fast path: if projects are already in state, show the canvas immediately.
      // Auth is still verified in the background; expired sessions redirect on next interaction.
      if (currentProjectId && projects.length > 0) {
        // Ensure correct view mode (e.g. if navigated directly to /cxd with viewMode="home")
        if (viewMode === "home" && currentProjectId) {
          setViewMode("canvas");
        }
        setIsRestoring(false);
        supabase.auth.getUser().then(({ data: { user }, error }) => {
          // Only redirect on definitive auth failures, not transient errors
          // (e.g. lock contention, network hiccups, token refresh timing).
          // Transient failures return error + null user; a real expired session
          // will be caught on the next DB interaction or page navigation.
          if (!user && !error) window.location.href = "/sign-in";
        });
        return;
      }

      try {
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
      } catch (err) {
        console.error('[CXD] Error restoring project state:', err);
      } finally {
        setIsRestoring(false);
      }
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
      console.log('[CXD] No project selected, redirecting to dashboard');
      // Use window.location for full page navigation to avoid RSC fetch issues
      window.location.href = "/dashboard";
    }
  }, [isRestoring, hasHydrated, currentProjectId, router]);

  // Failsafe: if loading takes too long, force show content
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isRestoring) {
        console.warn('[CXD] Loading timeout, forcing content display');
        setIsRestoring(false);
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timeout);
  }, [isRestoring]);

  // Track previous viewMode so we can detect wizard→canvas transitions
  const prevViewModeRef = useRef(viewMode);
  useEffect(() => {
    prevViewModeRef.current = viewMode;
  }, [viewMode]);

  // Auto-trigger onboarding tour when switching to a tab whose tour hasn't been completed.
  // Skip when transitioning from framing (wizard) — the tour should only start when the
  // user explicitly switches between canvas sub-views or loads a project already in canvas mode.
  useEffect(() => {
    if (isRestoring || viewMode !== "canvas") return;
    // Don't auto-trigger tour right after completing framing
    if (prevViewModeRef.current === "wizard") return;

    const state = useCXDStore.getState();
    let tourIdForView: 'canvas' | 'map' | 'plan' | null = null;
    if (canvasViewMode === "canvas") tourIdForView = "canvas";
    else if (canvasViewMode === "hexagon" || canvasViewMode === "hypercube") tourIdForView = "map";
    else if (canvasViewMode === "plan") tourIdForView = "plan";

    if (tourIdForView && !state.isTourCompleted(tourIdForView) && !state.tourActive) {
      const timer = setTimeout(() => {
        // Re-check in case tour was started or completed during the delay
        const freshState = useCXDStore.getState();
        if (!freshState.isTourCompleted(tourIdForView!) && !freshState.tourActive) {
          freshState.startTour(tourIdForView!);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [canvasViewMode, viewMode, isRestoring]);

  // Create a unique key for the current view to trigger transitions (only for wizard and plan)
  const viewKey = `${viewMode}-${canvasViewMode}`;
  const shouldAnimate = viewMode === "wizard" || (viewMode === "canvas" && canvasViewMode === "plan");

  return (
    <YjsProjectProvider>
    <CollaborationProvider onRemoteUpdate={handleRemoteUpdate}>
      <div className="min-h-screen bg-gradient-radial">
        {!isRestoring && minLoadTimePassed && <CXDNavbar />}
        <main className={!isRestoring && minLoadTimePassed ? "pt-20" : ""}>
          {isRestoring || !minLoadTimePassed ? (
            <LoadingScreen />
          ) : (
            <div
              key={shouldAnimate ? viewKey : undefined}
              className="relative w-full h-full"
              style={{
                animation: shouldAnimate ? 'viewFadeIn 300ms ease-out' : 'none'
              }}
            >
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
            </div>
          )}
          {/* CSS animation keyframes */}
          <style jsx>{`
            @keyframes viewFadeIn {
              from {
                opacity: 0;
                transform: translateY(8px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
        </main>
      </div>
      {showTopUpSuccess && (
        <CreditTopUpSuccess
          packId={topupPack}
          onDismiss={() => setShowTopUpSuccess(false)}
        />
      )}
      <TourOverlay />
    </CollaborationProvider>
    </YjsProjectProvider>
  );
}
