/**
 * Yjs-Zustand Bridge
 *
 * Connects Y.Doc observation to Zustand store updates.
 * When the Y.Doc changes (locally or remotely), the bridge converts the
 * affected data back to plain objects and writes them into Zustand.
 *
 * Performance strategy:
 * - Uses observeDeep to detect which specific elements/edges changed
 * - Only rebuilds affected items, not the entire collection
 * - Batches updates via requestAnimationFrame to stay within 16ms frame budget
 */

import * as Y from 'yjs';
import type { CanvasElement, CanvasEdge } from '@/types/canvas-elements';
import type { CXDProject } from '@/types/cxd-schema';
import type { Comment } from '@/types/comment-types';
import type { Version, OKR } from '@/types/version-types';
import { YDOC_KEYS, YTEXT_DESIGN_FIELDS, YNUMBER_DESIGN_FIELDS } from './y-doc-types';
import { yMapToCanvasElement, yMapToCanvasEdge } from './element-serializers';
import { yMapToVersion, yMapToOKR } from './yjs-version-actions';
import { yMapToComment } from './yjs-comment-actions';
import { yTextToString } from './y-text-helpers';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Callback interface that the bridge uses to push state into Zustand.
 * These map directly to the Zustand store's internal update mechanisms.
 */
export interface BridgeCallbacks {
  /** Replace the entire elements array for the current project */
  setElements: (elements: CanvasElement[]) => void;
  /** Replace the entire edges array for the current project */
  setEdges: (edges: CanvasEdge[]) => void;
  /** Update a single element by ID (partial update in the array) */
  patchElement: (elementId: string, element: CanvasElement) => void;
  /** Batch update multiple elements at once (for performance) */
  patchElements?: (updates: Array<{ id: string; element: CanvasElement }>) => void;
  /** Remove a single element by ID */
  removeElement: (elementId: string) => void;
  /** Update a single edge by ID */
  patchEdge: (edgeId: string, edge: CanvasEdge) => void;
  /** Remove a single edge by ID */
  removeEdge: (edgeId: string) => void;
  /** Update a design section field */
  setDesignField: (section: string, field: string, value: string | number) => void;
  /** Update meta fields (name, description, etc.) */
  setMetaField: (field: string, value: unknown) => void;
  /** Set reality planes V2 array */
  setRealityPlanesV2: (planes: NonNullable<CXDProject['realityPlanesV2']>) => void;
  /** Set experience flow stages array */
  setExperienceFlowStages: (stages: NonNullable<CXDProject['experienceFlowStages']>) => void;
  /** Set experience flow description */
  setExperienceFlowDescription: (value: string) => void;
  /** Replace the comments array (remote/CRDT changes) */
  setComments: (comments: Comment[]) => void;
  /** Replace the versions array (remote/CRDT changes) */
  setVersions: (versions: Version[]) => void;
  /** Replace the OKRs array (remote/CRDT changes) */
  setOKRs: (okrs: OKR[]) => void;
}

// ─── Bridge Class ────────────────────────────────────────────────────────────

export class YjsZustandBridge {
  private doc: Y.Doc;
  private callbacks: BridgeCallbacks;
  private unsubscribers: (() => void)[] = [];
  private pendingElementChanges = new Set<string>();
  private pendingElementRemovals = new Set<string>();
  private pendingEdgeChanges = new Set<string>();
  private pendingEdgeRemovals = new Set<string>();
  private rafId: number | null = null;
  private destroyed = false;
  /**
   * When true, bridge skips processing element/edge observer events.
   * Set by store actions that do both Y.Doc + Zustand updates directly.
   */
  public suppressElementSync = false;

  constructor(doc: Y.Doc, callbacks: BridgeCallbacks) {
    this.doc = doc;
    this.callbacks = callbacks;
  }

  /**
   * Start observing all Y.Doc shared types and pushing changes to Zustand.
   * Call this after the Y.Doc has been initialized/hydrated.
   */
  start(): void {
    this.observeElements();
    this.observeEdges();
    this.observeTextDesignFields();
    this.observeNumberDesignFields();
    this.observeRealityPlanesV2();
    this.observeExperienceFlowStages();
    this.observeExperienceFlowDescription();
    this.observeMeta();
    this.observeComments();
    this.observeVersions();
    this.observeOKRs();
  }

  /**
   * Stop all observers and clean up.
   */
  destroy(): void {
    this.destroyed = true;
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // ── Element Observer (performance-critical) ─────────────────────────────

  private observeElements(): void {
    const yElements = this.doc.getMap(YDOC_KEYS.ELEMENTS);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (events: Y.YEvent<any>[]) => {
      // 'drag-commit' transactions are written by commitDragPositionsToYjs after
      // the drag ends. Zustand was already updated directly (updateElementsPositionLocal)
      // throughout the drag, so skipping the bridge flush here avoids a redundant
      // Zustand setState with identical data.
      const origin = events[0]?.transaction?.origin;
      if (origin === 'drag-commit' || origin === 'template-batch') return;

      for (const event of events) {
        if (event.target === yElements) {
          // Top-level changes to the elements map (add/delete keys)
          event.changes.keys.forEach((change, key) => {
            if (change.action === 'delete') {
              this.pendingElementRemovals.add(key);
              this.pendingElementChanges.delete(key);
            } else {
              // 'add' or 'update'
              this.pendingElementRemovals.delete(key);
              this.pendingElementChanges.add(key);
            }
          });
        } else {
          // Nested property change within an element Y.Map
          // Walk up to find the element ID
          const elementId = this.findParentKey(event.target, yElements);
          if (elementId) {
            this.pendingElementChanges.add(elementId);
          }
        }
      }
      this.scheduleFlush();
    };

    yElements.observeDeep(handler);
    this.unsubscribers.push(() => yElements.unobserveDeep(handler));
  }

  // ── Edge Observer ───────────────────────────────────────────────────────

  private observeEdges(): void {
    const yEdges = this.doc.getMap(YDOC_KEYS.EDGES);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (events: Y.YEvent<any>[]) => {
      // 'template-batch' transactions (addCanvasEdges) already wrote directly
      // to Zustand before touching Yjs — skipping the flush here avoids a
      // redundant setState with identical data, mirroring the same guard on
      // the element observer above (see its comment: this is exactly the
      // mechanism that previously caused "Maximum update depth exceeded" for
      // large batches before it was skipped there).
      const origin = events[0]?.transaction?.origin;
      if (origin === 'drag-commit' || origin === 'template-batch') return;

      for (const event of events) {
        if (event.target === yEdges) {
          event.changes.keys.forEach((change, key) => {
            if (change.action === 'delete') {
              this.pendingEdgeRemovals.add(key);
              this.pendingEdgeChanges.delete(key);
            } else {
              this.pendingEdgeRemovals.delete(key);
              this.pendingEdgeChanges.add(key);
            }
          });
        } else {
          const edgeId = this.findParentKey(event.target, yEdges);
          if (edgeId) {
            this.pendingEdgeChanges.add(edgeId);
          }
        }
      }
      this.scheduleFlush();
    };

    yEdges.observeDeep(handler);
    this.unsubscribers.push(() => yEdges.unobserveDeep(handler));
  }

  // ── Design Field Observers ──────────────────────────────────────────────

  private observeTextDesignFields(): void {
    for (const [sectionKey, fields] of Object.entries(YTEXT_DESIGN_FIELDS)) {
      const ySection = this.doc.getMap(sectionKey);

      const handler = () => {
        for (const field of fields) {
          const yVal = ySection.get(field);
          if (yVal instanceof Y.Text) {
            this.callbacks.setDesignField(sectionKey, field, yTextToString(yVal));
          }
        }
      };

      ySection.observeDeep(handler);
      this.unsubscribers.push(() => ySection.unobserveDeep(handler));
    }
  }

  private observeNumberDesignFields(): void {
    for (const [sectionKey, fields] of Object.entries(YNUMBER_DESIGN_FIELDS)) {
      const ySection = this.doc.getMap(sectionKey);

      const handler = () => {
        for (const field of fields) {
          const value = ySection.get(field);
          if (typeof value === 'number') {
            this.callbacks.setDesignField(sectionKey, field, value);
          }
        }
      };

      ySection.observe(handler);
      this.unsubscribers.push(() => ySection.unobserve(handler));
    }
  }

  private observeRealityPlanesV2(): void {
    const yRPV2 = this.doc.getArray(YDOC_KEYS.REALITY_PLANES_V2);

    const handler = () => {
      const planes: NonNullable<CXDProject['realityPlanesV2']> = [];
      for (let i = 0; i < yRPV2.length; i++) {
        const yPlane = yRPV2.get(i) as Y.Map<unknown>;
        const interfaceModality = yPlane.get('interfaceModality');
        planes.push({
          code: yPlane.get('code') as string,
          enabled: yPlane.get('enabled') as boolean,
          priority: yPlane.get('priority') as number,
          interfaceModality: interfaceModality instanceof Y.Text
            ? yTextToString(interfaceModality)
            : (typeof interfaceModality === 'string' ? interfaceModality : ''),
        } as NonNullable<CXDProject['realityPlanesV2']>[number]);
      }
      this.callbacks.setRealityPlanesV2(planes);
    };

    yRPV2.observeDeep(handler);
    this.unsubscribers.push(() => yRPV2.unobserveDeep(handler));
  }

  private observeExperienceFlowStages(): void {
    const yStages = this.doc.getArray(YDOC_KEYS.EXPERIENCE_FLOW_STAGES);

    const handler = () => {
      const stages: NonNullable<CXDProject['experienceFlowStages']> = [];
      const seenIds = new Set<string>();

      for (let i = 0; i < yStages.length; i++) {
        const yStage = yStages.get(i) as Y.Map<unknown>;
        const stage: Record<string, unknown> = {};
        yStage.forEach((value, key) => {
          if (value instanceof Y.Text) {
            stage[key] = yTextToString(value);
          } else if (value instanceof Y.Map) {
            const nested: Record<string, unknown> = {};
            value.forEach((nv, nk) => { nested[nk] = nv; });
            stage[key] = nested;
          } else {
            stage[key] = value;
          }
        });

        // Skip duplicate IDs (defensive check for sync issues)
        const stageId = stage.id as string;
        if (stageId && seenIds.has(stageId)) {
          console.warn('[YjsZustandBridge] Skipping duplicate stage ID:', stageId);
          continue;
        }
        if (stageId) seenIds.add(stageId);

        stages.push(stage as unknown as NonNullable<CXDProject['experienceFlowStages']>[number]);
      }
      this.callbacks.setExperienceFlowStages(stages);
    };

    yStages.observeDeep(handler);
    this.unsubscribers.push(() => yStages.unobserveDeep(handler));
  }

  private observeExperienceFlowDescription(): void {
    const yDesc = this.doc.getText(YDOC_KEYS.EXPERIENCE_FLOW_DESCRIPTION);

    const handler = () => {
      this.callbacks.setExperienceFlowDescription(yDesc.toString());
    };

    yDesc.observe(handler);
    this.unsubscribers.push(() => yDesc.unobserve(handler));
  }

  private observeMeta(): void {
    const yMeta = this.doc.getMap(YDOC_KEYS.META);

    const handler = () => {
      yMeta.forEach((value, key) => {
        this.callbacks.setMetaField(key, value);
      });
    };

    yMeta.observe(handler);
    this.unsubscribers.push(() => yMeta.unobserve(handler));
  }

  // ── Comments / Versions / OKRs Observers ────────────────────────────────
  // These collections use optimistic direct Zustand updates in store actions
  // (origin 'local'), so the observers only apply remote/seed/restore changes.
  // Rebuilding the full array is fine — these collections are small.

  private observeComments(): void {
    const yComments = this.doc.getMap(YDOC_KEYS.COMMENTS);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (events: Y.YEvent<any>[]) => {
      if (events[0]?.transaction?.origin === 'local') return;
      const comments: Comment[] = [];
      yComments.forEach((yComment) => {
        if (yComment instanceof Y.Map) {
          comments.push(yMapToComment(yComment));
        }
      });
      comments.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
      this.callbacks.setComments(comments);
    };

    yComments.observeDeep(handler);
    this.unsubscribers.push(() => yComments.unobserveDeep(handler));
  }

  private observeVersions(): void {
    const yVersions = this.doc.getArray<Y.Map<unknown>>(YDOC_KEYS.VERSIONS);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (events: Y.YEvent<any>[]) => {
      if (events[0]?.transaction?.origin === 'local') return;
      const versions: Version[] = [];
      for (let i = 0; i < yVersions.length; i++) {
        const yVersion = yVersions.get(i);
        if (yVersion instanceof Y.Map) {
          versions.push(yMapToVersion(yVersion));
        }
      }
      this.callbacks.setVersions(versions);
    };

    yVersions.observeDeep(handler);
    this.unsubscribers.push(() => yVersions.unobserveDeep(handler));
  }

  private observeOKRs(): void {
    const yOKRs = this.doc.getArray<Y.Map<unknown>>(YDOC_KEYS.OKRS);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (events: Y.YEvent<any>[]) => {
      if (events[0]?.transaction?.origin === 'local') return;
      const okrs: OKR[] = [];
      for (let i = 0; i < yOKRs.length; i++) {
        const yOKR = yOKRs.get(i);
        if (yOKR instanceof Y.Map) {
          okrs.push(yMapToOKR(yOKR));
        }
      }
      this.callbacks.setOKRs(okrs);
    };

    yOKRs.observeDeep(handler);
    this.unsubscribers.push(() => yOKRs.unobserveDeep(handler));
  }

  /**
   * Force an immediate full sync of all elements and edges from Y.Doc to Zustand.
   * Call this after bridge.start() to ensure initial Y.Doc state (loaded from
   * IndexedDB or Supabase persistence) is reflected in Zustand — the deep
   * observers only fire for future changes, not for state that was already
   * present when the bridge started.
   */
  forceInitialSync(): void {
    if (this.destroyed) return;

    // Cancel any pending RAF flush — we're replacing the full arrays right now,
    // so the individual patchElement/removeElement calls it would make are redundant.
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.pendingElementChanges.clear();
    this.pendingElementRemovals.clear();
    this.pendingEdgeChanges.clear();
    this.pendingEdgeRemovals.clear();

    const yElements = this.doc.getMap(YDOC_KEYS.ELEMENTS);
    const yEdges = this.doc.getMap(YDOC_KEYS.EDGES);

    const elements: CanvasElement[] = [];
    yElements.forEach((yEl) => {
      if (yEl instanceof Y.Map) {
        elements.push(yMapToCanvasElement(yEl as Y.Map<unknown>));
      }
    });

    const edges: CanvasEdge[] = [];
    yEdges.forEach((yEdge) => {
      if (yEdge instanceof Y.Map) {
        edges.push(yMapToCanvasEdge(yEdge as Y.Map<unknown>));
      }
    });

    // Replace the full arrays — this surfaces any elements that arrived
    // during persistence load before the bridge was observing.
    if (elements.length > 0) {
      this.callbacks.setElements(elements);
    }
    if (edges.length > 0) {
      this.callbacks.setEdges(edges);
    }

    // Comments / versions / OKRs: after union-seeding, the Y.Doc is a superset
    // of project_data, so replacing the Zustand arrays is safe and surfaces
    // CRDT-only items (e.g., collaborator changes saved only to yjs_state).
    const comments: Comment[] = [];
    this.doc.getMap(YDOC_KEYS.COMMENTS).forEach((yComment) => {
      if (yComment instanceof Y.Map) comments.push(yMapToComment(yComment));
    });
    if (comments.length > 0) {
      comments.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
      this.callbacks.setComments(comments);
    }

    const yVersions = this.doc.getArray<Y.Map<unknown>>(YDOC_KEYS.VERSIONS);
    const versions: Version[] = [];
    for (let i = 0; i < yVersions.length; i++) {
      const yVersion = yVersions.get(i);
      if (yVersion instanceof Y.Map) versions.push(yMapToVersion(yVersion));
    }
    if (versions.length > 0) {
      this.callbacks.setVersions(versions);
    }

    const yOKRs = this.doc.getArray<Y.Map<unknown>>(YDOC_KEYS.OKRS);
    const okrs: OKR[] = [];
    for (let i = 0; i < yOKRs.length; i++) {
      const yOKR = yOKRs.get(i);
      if (yOKR instanceof Y.Map) okrs.push(yMapToOKR(yOKR));
    }
    if (okrs.length > 0) {
      this.callbacks.setOKRs(okrs);
    }
  }

  // ── Batched Flush (RAF) ─────────────────────────────────────────────────

  private scheduleFlush(): void {
    if (this.rafId !== null || this.destroyed) return;

    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.flush();
    });
  }

  private flush(): void {
    if (this.destroyed) return;

    const yElements = this.doc.getMap(YDOC_KEYS.ELEMENTS);
    const yEdges = this.doc.getMap(YDOC_KEYS.EDGES);

    // Process element removals
    this.pendingElementRemovals.forEach((id) => {
      this.callbacks.removeElement(id);
    });
    this.pendingElementRemovals.clear();

    // Process element changes (add or update) - BATCHED for performance
    if (this.pendingElementChanges.size > 0) {
      if (this.callbacks.patchElements && this.pendingElementChanges.size > 1) {
        // Batch path for multiple elements — single Zustand setState
        const updates: Array<{ id: string; element: CanvasElement }> = [];
        this.pendingElementChanges.forEach((id) => {
          const yEl = yElements.get(id);
          if (yEl instanceof Y.Map) {
            updates.push({ id, element: yMapToCanvasElement(yEl) });
          }
        });
        if (updates.length > 0) {
          this.callbacks.patchElements(updates);
        }
      } else {
        // Single element — use original path
        this.pendingElementChanges.forEach((id) => {
          const yEl = yElements.get(id);
          if (yEl instanceof Y.Map) {
            this.callbacks.patchElement(id, yMapToCanvasElement(yEl));
          }
        });
      }
      this.pendingElementChanges.clear();
    }

    // Process edge removals
    this.pendingEdgeRemovals.forEach((id) => {
      this.callbacks.removeEdge(id);
    });
    this.pendingEdgeRemovals.clear();

    // Process edge changes
    this.pendingEdgeChanges.forEach((id) => {
      const yEdge = yEdges.get(id);
      if (yEdge instanceof Y.Map) {
        this.callbacks.patchEdge(id, yMapToCanvasEdge(yEdge));
      }
    });
    this.pendingEdgeChanges.clear();
  }

  // ── Utility ─────────────────────────────────────────────────────────────

  /**
   * Walk up from a nested Y.AbstractType to find the key it's stored under
   * in the given parent Y.Map.
   */
  private findParentKey(target: Y.AbstractType<unknown>, parentMap: Y.Map<unknown>): string | null {
    let current: Y.AbstractType<unknown> | null = target;
    while (current) {
      // Check if parent of current is the parentMap
      const parent = current._item?.parent;
      if (parent === parentMap) {
        return current._item?.parentSub ?? null;
      }
      // Move up one level
      if (current._item?.parent instanceof Y.AbstractType) {
        current = current._item.parent as Y.AbstractType<unknown>;
      } else {
        break;
      }
    }
    return null;
  }
}
