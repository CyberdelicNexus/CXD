'use client';

/**
 * Yjs Project Context
 *
 * Manages the Y.Doc lifecycle for the current project.
 * Provides the Y.Doc and Awareness instances to the component tree.
 * Sets up the YjsZustandBridge to keep Zustand in sync with Y.Doc state.
 */

import { YJS_FINGERPRINT_FIELD } from '@/lib/yjs/state-fingerprint';
import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { createSnapshot } from '@/lib/yjs/snapshot-service';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { useCXDStore } from '@/store/cxd-store';
import * as Sentry from '@sentry/nextjs';
import { createProjectYDoc, initializeYDoc, deduplicateRealityPlanesV2, seedProjectExtrasIntoYDoc, reconcileCanvasIntoYDoc } from '@/lib/yjs/y-doc-factory';
import { YjsZustandBridge, BridgeCallbacks } from '@/lib/yjs/y-zustand-bridge';
import { LocalPersistence } from '@/lib/yjs/indexeddb-persistence';
import { SupabasePersistence } from '@/lib/yjs/supabase-persistence';
import { emitSaveStatus } from '@/lib/save-status';
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

// ─── Global Y.js Persistence Flush ──────────────────────────────────────────
// Module-level ref so logout handlers can flush Y.js binary state to DB
// before signing out, preventing data loss from the 2-second debounce window.

let _activeSupabasePersistence: SupabasePersistence | null = null;

/**
 * Tracks the previous project's async persistence teardown so the next
 * project's load can wait for it. Without this, a rapid project switch could
 * start loading the new project while the old one's final save is in flight.
 */
let _pendingDestroy: Promise<void> | null = null;

/**
 * Flush any pending Y.js binary state to Supabase.
 * Call before logout/navigation to prevent data loss.
 * Returns true if the flush save succeeded (or there was nothing to flush).
 */
export async function flushYjsPersistence(): Promise<boolean> {
  if (_activeSupabasePersistence) {
    return _activeSupabasePersistence.flush();
  }
  return true;
}

// ─── Provider ────────────────────────────────────────────────────────────────

interface YjsProjectProviderProps {
  children: ReactNode;
}

// The bridge rebuilds an element from its Y.Map, which has no entry for a key
// that was deleted there (yjsUngroup, removeNodeFromContainer, ...). The patch
// merges onto the existing Zustand element to keep local-only props, so a
// deleted key would otherwise survive in the UI: ungrouping looked like a no-op
// and elements stayed "inside" containers they had left. These structural keys
// are always persisted in the doc, so absence in the rebuilt element means
// deleted.
const DELETABLE_ELEMENT_KEYS = ['groupId', 'containerId', 'bend'] as const;
function withoutDeletedKeys(existing: CanvasElement, rebuilt: CanvasElement): CanvasElement {
  let out: CanvasElement = existing;
  for (const key of DELETABLE_ELEMENT_KEYS) {
    if (key in existing && !(key in rebuilt)) {
      if (out === existing) out = { ...existing };
      delete (out as any)[key];
    }
  }
  return out;
}

export function YjsProjectProvider({ children }: YjsProjectProviderProps) {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [awareness, setAwareness] = useState<Awareness | null>(null);
  const [isReady, setIsReady] = useState(false);

  const bridgeRef = useRef<YjsZustandBridge | null>(null);
  const localPersistenceRef = useRef<LocalPersistence | null>(null);
  const supabasePersistenceRef = useRef<SupabasePersistence | null>(null);
  const currentProjectIdRef = useRef<string | null>(null);
  const snapshotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSnapshotTimeRef = useRef<number>(0);

  const currentProjectId = useCXDStore((s) => s.currentProjectId);
  const getCurrentProject = useCXDStore((s) => s.getCurrentProject);
  // On a page reload currentProjectId rehydrates from localStorage before the
  // project itself is fetched, so the init effect below would bail on "no
  // project" and never re-run. Depending on this flag re-runs it on arrival.
  const currentProjectLoaded = useCXDStore((s) =>
    s.projects.some((p) => p.id === s.currentProjectId && !(p as any)._listingOnly),
  );
  const setYDoc = useCXDStore((s) => s.setYDoc);

  const createAutoSnapshot = useCallback(async (label: string, minIntervalMs = 300000) => {
    const now = Date.now();
    if (now - lastSnapshotTimeRef.current < minIntervalMs) return;
    const pid = currentProjectIdRef.current;
    if (!pid) return;
    lastSnapshotTimeRef.current = now;
    createSnapshot(pid, label).catch((err) =>
      console.warn('[YjsProject] Auto-snapshot failed:', err)
    );
  }, []);

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
    if (!project || (project as any)._listingOnly) return;


    // Create new Y.Doc
    const newDoc = createProjectYDoc();
    const newAwareness = new Awareness(newDoc);

    // Set up the bridge callbacks that push Y.Doc changes into Zustand.
    // Bridge is started IMMEDIATELY so it observes all Y.Doc changes from
    // this point forward — including those triggered by persistence load.
    // This prevents a race condition where remote updates applied to Y.Doc
    // before bridge.start() would never propagate to Zustand.
    const callbacks = createBridgeCallbacks(currentProjectId);
    const bridge = new YjsZustandBridge(newDoc, callbacks);
    bridgeRef.current = bridge;
    bridge.start(); // Must be before persistence setup

    // Set up IndexedDB local persistence (offline support)
    const localPersist = new LocalPersistence(newDoc, currentProjectId);
    localPersistenceRef.current = localPersist;

    // Set up Supabase persistence (binary Y.Doc state to DB).
    // getBaseProject supplies the Zustand snapshot used as the merge base for
    // the derived project_data JSON — read raw from projects[] (not
    // getCurrentProject(), which runs in-place migrations).
    const supabasePersist = new SupabasePersistence(newDoc, currentProjectId, {
      onError: (msg) => console.warn('[YjsProject] Persistence warning:', msg),
      onStatusChange: (status, message) => emitSaveStatus({ status, source: 'yjs', message }),
      getBaseProject: () =>
        useCXDStore.getState().projects.find((p) => p.id === currentProjectId) ?? null,
    });
    supabasePersistenceRef.current = supabasePersist;
    _activeSupabasePersistence = supabasePersist;

    // Flush Yjs state immediately when the tab is hidden or the page is unloading
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        supabasePersistenceRef.current?.flush();
        createAutoSnapshot('Tab close');
      } else if (document.visibilityState === 'visible') {
        // A resuming tab may have slept through another tab's realtime updates,
        // so its cached merge base is stale. Force the next save to re-read the
        // live DB row first, preventing a stale full-state write from clobbering
        // work another same-user tab persisted while this one was backgrounded.
        supabasePersistenceRef.current?.requestDbRemerge();
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
    //
    // IMPORTANT: setYDoc(newDoc) is called AFTER Promise.all resolves, not before.
    // Reason: if setYDoc fires while Y.Doc is still empty, store actions switch to
    // CRDT mode immediately. Any removeCanvasElement/commitDragPositionsToYjs calls
    // hit an empty Y.Doc (no-op) instead of updating Zustand directly. This makes
    // elements appear frozen — delete does nothing, drag positions reset on sync.
    // By delaying setYDoc until Y.Doc is populated, the store stays in LWW mode
    // (direct Zustand updates) during loading, so all interactions work correctly.
    // Sequenced deliberately:
    // 0. Wait for the PREVIOUS project's persistence teardown — its final save
    //    must complete before we read this project's state (rapid-switch race).
    // 1. IndexedDB (local, offline state) applies first.
    // 2. Supabase (remote, latest shared state) merges on top via CRDT.
    (_pendingDestroy ?? Promise.resolve())
      .then(() => localPersist.whenSynced())
      .then(() => supabasePersist.load())
      .then((supabaseLoaded) => {
      // Guard: if this provider was cleaned up while loading, bail out
      if (bridgeRef.current !== bridge) return;

      if (!supabaseLoaded) {
        // No persisted Yjs state in Supabase - hydrate from CURRENT project data.
        // Use getState() here (not captured `project`) so any LWW-mode changes
        // the user made during loading are included in the Y.Doc initialization.
        const currentProject = useCXDStore.getState().getCurrentProject();
        if (currentProject) {
          console.log('[YjsProject] No persisted state, initializing from project data');
          initializeYDoc(newDoc, currentProject);
        }
      } else {
        console.log('[YjsProject] Loaded persisted Yjs state from Supabase');
        // Backfill comments/versions/OKRs from project_data JSON — docs created
        // before these collections were CRDT-managed won't have them in yjs_state.
        // Union by id: existing Y.Doc items win, missing ones are added.
        const currentProject = useCXDStore.getState().getCurrentProject();
        if (currentProject) {
          seedProjectExtrasIntoYDoc(newDoc, currentProject);

          // Reconcile elements/edges too: a stale yjs_state must never win over
          // elements that exist in project_data (July 2026 data-loss root cause —
          // trusted-doc load dropped project_data-only elements, then the first
          // post-ready save persisted the loss to both columns).
          // Passing the DB state also restores project_data-only MODIFICATIONS
          // that a doc-wins-for-known-ids merge would silently revert.
          // Only when project_data provably descends from this yjs_state (same
          // fingerprint), or predates fingerprints: a project_data rewritten
          // from an older copy (stale tab) must not override the doc.
          const pdFingerprint = (currentProject as unknown as Record<string, unknown>)[YJS_FINGERPRINT_FIELD];
          const canRepairModifications =
            pdFingerprint === undefined || pdFingerprint === supabasePersist.getLoadedFingerprint();
          const { seededElements, seededEdges, repairedElements, repairedEdges } =
            reconcileCanvasIntoYDoc(
              newDoc,
              currentProject,
              canRepairModifications ? supabasePersist.getLoadedState() : null,
            );
          if (seededElements > 0 || seededEdges > 0 || repairedElements > 0 || repairedEdges > 0) {
            console.warn(
              `[YjsProject] Divergence repaired: seeded ${seededElements} element(s) / ${seededEdges} edge(s) missing from yjs_state; restored ${repairedElements} element(s) / ${repairedEdges} edge(s) edited only in project_data`
            );
            // Preserve the pre-repair yjs_state before the debounced save
            // overwrites it, and make the divergence visible in Sentry —
            // this failure mode is silent by nature (no exception is thrown).
            createAutoSnapshot('Pre-reconcile backup', 0); // bypass min-interval — must not be skipped
            Sentry.captureMessage('cxd-yjs-divergence-repaired', {
              level: 'warning',
              tags: { projectId: currentProjectId },
              extra: { seededElements, seededEdges, repairedElements, repairedEdges },
            });
          }
        }
      }

      // One-time repair: remove duplicate reality planes that may have accumulated
      // in IndexedDB from a previous bug where initializeYDoc lacked an idempotency guard.
      deduplicateRealityPlanesV2(newDoc);

      // Hydration is complete — the doc now holds the full known state,
      // so persistence may start writing to the DB.
      supabasePersist.markReady();

      // Force-sync all current Y.Doc state to Zustand immediately.
      // This handles two cases:
      // 1. Elements from persistence that arrived before RAF flush
      // 2. Elements in yjs_state that aren't in the JSON project_data
      bridge.forceInitialSync();

      // NOW activate CRDT mode in the store — Y.Doc is populated and in sync
      // with Zustand. Store actions can safely use CRDT operations from here.
      setYDoc(newDoc);

      // NOTE: We intentionally do NOT call saveProject() here.
      // The project_data JSON column in the DB may be staler than the yjs_state
      // binary we just loaded. Writing project_data back immediately would
      // overwrite the DB with stale data, causing the project to "revert" on
      // next load if yjs_state is missing. The SupabasePersistence layer handles
      // saving yjs_state on every Y.Doc change, and useProjectSync will save
      // project_data naturally as the user makes edits.

      // Mark as ready after successful hydration
      setIsReady(true);

      // Start auto-snapshot timer (every 30 minutes)
      snapshotIntervalRef.current = setInterval(() => {
        createAutoSnapshot('Auto-save');
      }, 30 * 60 * 1000);
    }).catch((err) => {
      console.error('[YjsProject] Failed to load persisted state:', err);
      if (bridgeRef.current !== bridge) return;
      // Fallback to project data on error
      const currentProject = useCXDStore.getState().getCurrentProject();
      if (currentProject) {
        initializeYDoc(newDoc, currentProject);
      }
      deduplicateRealityPlanesV2(newDoc);
      supabasePersist.markReady();
      bridge.forceInitialSync();
      setYDoc(newDoc);
      setIsReady(true);
    });

    currentProjectIdRef.current = currentProjectId;
    setDoc(newDoc);
    setAwareness(newAwareness);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId, currentProjectLoaded]);

  function cleanup() {
    // Clear auto-snapshot timer
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
    }

    if (supabasePersistenceRef.current) {
      // Snapshot before destroying (project switch)
      const pid = currentProjectIdRef.current;
      if (pid && isReady) {
        createSnapshot(pid, 'Project switch').catch(() => {});
      }
      // destroy() is async: it flushes the final save before marking destroyed.
      // React cleanup can't await it, but we chain the promise into
      // _pendingDestroy so the NEXT project's load waits for this final save.
      // Chaining (rather than replacing) also serializes overlapping teardowns.
      const persistence = supabasePersistenceRef.current;
      _pendingDestroy = (_pendingDestroy ?? Promise.resolve())
        .then(() => persistence.destroy())
        .catch((err) => {
          console.warn('[YjsProject] Final save on teardown failed:', err);
        });
      _activeSupabasePersistence = null;
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
            ...withoutDeletedKeys(existing, element),
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

    patchElements: (updates) => {
      updateProject((p) => {
        const elements = [...(p.canvasLayout?.elements ?? [])];
        for (const { id, element } of updates) {
          const idx = elements.findIndex((e) => e.id === id);
          if (idx >= 0) {
            const existing = elements[idx];
            elements[idx] = {
              ...withoutDeletedKeys(existing, element),
              ...element,
              x: isNaN(element.x) ? existing.x : element.x,
              y: isNaN(element.y) ? existing.y : element.y,
              width: isNaN(element.width) ? existing.width : element.width,
              height: isNaN(element.height) ? existing.height : element.height,
              locked: element.locked !== undefined ? element.locked : existing.locked,
            } as CanvasElement;
          } else {
            elements.push(element);
          }
        }
        return {
          ...p,
          canvasLayout: { ...p.canvasLayout, elements },
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
        if (field === 'framingCanvasPopulated') return { ...p, framingCanvasPopulated: value as boolean };
        if (field === 'framingType') return { ...p, framingType: value as string };
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

    setComments: (comments) => {
      updateProject((p) => ({ ...p, comments }));
    },

    setVersions: (versions) => {
      updateProject((p) => ({ ...p, versions }));
    },

    setOKRs: (okrs) => {
      updateProject((p) => ({ ...p, okrs }));
    },
  };
}
