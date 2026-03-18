'use client';

/**
 * Yjs Project Context
 *
 * Manages the Y.Doc lifecycle for the current project.
 * Provides the Y.Doc and Awareness instances to the component tree.
 * Sets up the YjsZustandBridge to keep Zustand in sync with Y.Doc state.
 */

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { useCXDStore } from '@/store/cxd-store';
import { createProjectYDoc, initializeYDoc } from '@/lib/yjs/y-doc-factory';
import { YjsZustandBridge, BridgeCallbacks } from '@/lib/yjs/y-zustand-bridge';
import { LocalPersistence } from '@/lib/yjs/indexeddb-persistence';
import { SupabasePersistence } from '@/lib/yjs/supabase-persistence';
import type { CXDProject } from '@/types/cxd-schema';
import type { CanvasElement, CanvasEdge } from '@/types/canvas-elements';

// ─── Context Types ───────────────────────────────────────────────────────────

interface YjsProjectContextValue {
  /** The Yjs document for the current project, or null if Yjs is disabled */
  doc: Y.Doc | null;
  /** The Awareness instance for presence/cursor tracking */
  awareness: Awareness | null;
  /** Whether the Y.Doc has been initialized and is ready for use */
  isReady: boolean;
}

const YjsProjectContext = createContext<YjsProjectContextValue>({
  doc: null,
  awareness: null,
  isReady: false,
});

// ─── Feature Flag ────────────────────────────────────────────────────────────

const USE_YJS_CRDT = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_USE_YJS_CRDT ?? 'true') === 'true'
  : false;

// ─── Provider ────────────────────────────────────────────────────────────────

interface YjsProjectProviderProps {
  children: ReactNode;
}

export function YjsProjectProvider({ children }: YjsProjectProviderProps) {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [awareness, setAwareness] = useState<Awareness | null>(null);
  const [isReady, setIsReady] = useState(false);

  const bridgeRef = useRef<YjsZustandBridge | null>(null);
  const localPersistenceRef = useRef<LocalPersistence | null>(null);
  const supabasePersistenceRef = useRef<SupabasePersistence | null>(null);
  const currentProjectIdRef = useRef<string | null>(null);

  const currentProjectId = useCXDStore((s) => s.currentProjectId);
  const getCurrentProject = useCXDStore((s) => s.getCurrentProject);
  const setYDoc = useCXDStore((s) => s.setYDoc);

  useEffect(() => {
    // Skip if Yjs is disabled
    if (!USE_YJS_CRDT) return;

    // Skip if no project selected
    if (!currentProjectId) {
      cleanup();
      return;
    }

    // Skip if already initialized for this project
    if (currentProjectIdRef.current === currentProjectId && doc) return;

    // Clean up previous doc if switching projects
    cleanup();

    const project = getCurrentProject();
    if (!project) return;

    // Create new Y.Doc
    const newDoc = createProjectYDoc();
    const newAwareness = new Awareness(newDoc);

    // Set up the bridge callbacks that push Y.Doc changes into Zustand
    const callbacks = createBridgeCallbacks(currentProjectId);
    const bridge = new YjsZustandBridge(newDoc, callbacks);
    bridgeRef.current = bridge;

    // Set up IndexedDB local persistence (offline support)
    const localPersist = new LocalPersistence(newDoc, currentProjectId);
    localPersistenceRef.current = localPersist;

    // Set up Supabase persistence (binary Y.Doc state to DB)
    const supabasePersist = new SupabasePersistence(newDoc, currentProjectId);
    supabasePersistenceRef.current = supabasePersist;

    // Flush Yjs state immediately when the tab is hidden or the page is unloading
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        supabasePersistenceRef.current?.flush();
      }
    };
    const handleBeforeUnload = () => {
      supabasePersistenceRef.current?.flush();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Load persisted state in order of priority:
    // 1. IndexedDB (local, fastest, for offline)
    // 2. Supabase (remote, latest shared state)
    // 3. Project data (fallback if no persisted state)
    Promise.all([
      localPersist.whenSynced(),
      supabasePersist.load(),
    ]).then(([_, supabaseLoaded]) => {
      if (!supabaseLoaded) {
        // No persisted Yjs state in Supabase - hydrate from project data
        console.log('[YjsProject] No persisted state, initializing from project data');
        initializeYDoc(newDoc, project);
      } else {
        console.log('[YjsProject] Loaded persisted Yjs state from Supabase');
      }

      // Start the bridge after all persistence layers are ready
      bridge.start();

      // Mark as ready after successful hydration
      setIsReady(true);
    }).catch((err) => {
      console.error('[YjsProject] Failed to load persisted state:', err);
      // Fallback to project data on error
      initializeYDoc(newDoc, project);
      bridge.start();
      setIsReady(true);
    });

    // Store doc reference in Zustand for store actions to use
    setYDoc(newDoc);

    currentProjectIdRef.current = currentProjectId;
    setDoc(newDoc);
    setAwareness(newAwareness);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId]);

  function cleanup() {
    if (supabasePersistenceRef.current) {
      // destroy() is async: it flushes the final save before marking destroyed.
      // Fire-and-forget is intentional here — we cannot await in a React cleanup.
      supabasePersistenceRef.current.destroy();
      supabasePersistenceRef.current = null;
    }
    if (localPersistenceRef.current) {
      localPersistenceRef.current.destroy();
      localPersistenceRef.current = null;
    }
    if (bridgeRef.current) {
      bridgeRef.current.destroy();
      bridgeRef.current = null;
    }
    if (doc) {
      doc.destroy();
    }
    setYDoc(null);
    setDoc(null);
    setAwareness(null);
    setIsReady(false);
    currentProjectIdRef.current = null;
  }

  return (
    <YjsProjectContext.Provider value={{ doc, awareness, isReady }}>
      {children}
    </YjsProjectContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useYjsProject() {
  return useContext(YjsProjectContext);
}

// ─── Bridge Callbacks Factory ────────────────────────────────────────────────

/**
 * Creates the bridge callbacks that translate Y.Doc observer events
 * into Zustand store updates. This is where Y.Doc → Zustand sync happens.
 */
function createBridgeCallbacks(projectId: string): BridgeCallbacks {
  const getState = () => useCXDStore.getState();

  const updateProject = (updater: (project: CXDProject) => CXDProject) => {
    const state = getState();
    const projects = state.projects.map((p) =>
      p.id === projectId ? updater(p) : p
    );
    useCXDStore.setState({ projects });
  };

  return {
    setElements: (elements: CanvasElement[]) => {
      updateProject((p) => ({
        ...p,
        canvasLayout: { ...p.canvasLayout, elements },
      }));
    },

    setEdges: (edges: CanvasEdge[]) => {
      updateProject((p) => ({
        ...p,
        canvasLayout: { ...p.canvasLayout, edges },
      }));
    },

    patchElement: (elementId: string, element: CanvasElement) => {
      updateProject((p) => {
        const elements = p.canvasLayout?.elements ?? [];
        const idx = elements.findIndex((e) => e.id === elementId);
        let newElements: CanvasElement[];
        if (idx >= 0) {
          const existing = elements[idx];
          // MERGE with existing element to preserve all properties
          newElements = [...elements];
          newElements[idx] = {
            ...existing,
            ...element,
            // Prevent NaN values
            x: isNaN(element.x) ? existing.x : element.x,
            y: isNaN(element.y) ? existing.y : element.y,
            width: isNaN(element.width) ? existing.width : element.width,
            height: isNaN(element.height) ? existing.height : element.height,
            // Explicitly preserve locked state from existing element if not in update
            locked: element.locked !== undefined ? element.locked : existing.locked,
          } as CanvasElement;
        } else {
          newElements = [...elements, element];
        }
        return {
          ...p,
          canvasLayout: { ...p.canvasLayout, elements: newElements },
        };
      });
    },

    removeElement: (elementId: string) => {
      updateProject((p) => ({
        ...p,
        canvasLayout: {
          ...p.canvasLayout,
          elements: (p.canvasLayout?.elements ?? []).filter(
            (e) => e.id !== elementId
          ),
        },
      }));
    },

    patchEdge: (edgeId: string, edge: CanvasEdge) => {
      updateProject((p) => {
        const edges = p.canvasLayout?.edges ?? [];
        const idx = edges.findIndex((e) => e.id === edgeId);
        let newEdges: CanvasEdge[];
        if (idx >= 0) {
          newEdges = [...edges];
          newEdges[idx] = edge;
        } else {
          newEdges = [...edges, edge];
        }
        return {
          ...p,
          canvasLayout: { ...p.canvasLayout, edges: newEdges },
        };
      });
    },

    removeEdge: (edgeId: string) => {
      updateProject((p) => ({
        ...p,
        canvasLayout: {
          ...p.canvasLayout,
          edges: (p.canvasLayout?.edges ?? []).filter(
            (e) => e.id !== edgeId
          ),
        },
      }));
    },

    setDesignField: (section: string, field: string, value: string | number) => {
      updateProject((p) => {
        const sectionData = (p as unknown as Record<string, unknown>)[section];
        if (sectionData && typeof sectionData === 'object') {
          return {
            ...p,
            [section]: { ...sectionData as Record<string, unknown>, [field]: value },
          };
        }
        return p;
      });
    },

    setMetaField: (field: string, value: unknown) => {
      updateProject((p) => {
        // Map meta fields to CXDProject fields
        if (field === 'name') return { ...p, name: value as string };
        if (field === 'description') return { ...p, description: value as string };
        if (field === 'canvasBackground') return { ...p, canvasBackground: value as string };
        if (field === 'wizardCompleted') return { ...p, wizardCompleted: value as boolean };
        if (field === 'currentWizardStep') return { ...p, currentWizardStep: value as number };
        if (field === 'shareToken') return { ...p, shareToken: value as string };
        return p;
      });
    },

    setRealityPlanesV2: (planes) => {
      updateProject((p) => ({ ...p, realityPlanesV2: planes }));
    },

    setExperienceFlowStages: (stages) => {
      updateProject((p) => ({ ...p, experienceFlowStages: stages }));
    },

    setExperienceFlowDescription: (value) => {
      updateProject((p) => ({ ...p, experienceFlowDescription: value }));
    },
  };
}
