/**
 * Y.Doc Factory
 *
 * Creates and hydrates Y.Doc instances from CXDProject data.
 * Also provides the reverse conversion: Y.Doc → CXDProject.
 *
 * The Y.Doc structure mirrors the CXDProject schema but uses appropriate
 * Yjs shared types for CRDT conflict resolution:
 * - Y.Map for key-value records (elements, edges, design field groups)
 * - Y.Text for user-editable text (character-level merging)
 * - Y.Array for ordered collections (experience flow stages, reality planes V2)
 */

import * as Y from 'yjs';
import type { CXDProject, ExperienceFlowStageV2 } from '@/types/cxd-schema';
import { DEFAULT_ENGAGEMENT_DISTRIBUTION, DEFAULT_STAGE_PRESENCE_TYPES } from '@/types/cxd-schema';
import type { CanvasElement, CanvasEdge } from '@/types/canvas-elements';
import {
  YDOC_KEYS,
  META_SCALAR_FIELDS,
  YTEXT_DESIGN_FIELDS,
  YNUMBER_DESIGN_FIELDS,
  STAGE_YTEXT_FIELDS,
  STAGE_NESTED_FIELDS,
  REALITY_PLANE_V2_YTEXT_FIELDS,
} from './y-doc-types';
import { createYText, yTextToString } from './y-text-helpers';
import {
  canvasElementToYMap,
  yMapToCanvasElement,
  canvasEdgeToYMap,
  yMapToCanvasEdge,
} from './element-serializers';
import { versionToYMap, okrToYMap, yMapToVersion, yMapToOKR } from './yjs-version-actions';
import { commentToYMap, yMapToComment } from './yjs-comment-actions';
import type { Comment } from '@/types/comment-types';
import type { Version, OKR } from '@/types/version-types';

// ─── Y.Doc Creation ──────────────────────────────────────────────────────────

/**
 * Create a fresh Y.Doc with all top-level shared types pre-initialized.
 * The doc is empty — call initializeYDoc() to hydrate from project data.
 */
export function createProjectYDoc(): Y.Doc {
  const doc = new Y.Doc();

  // Pre-initialize all top-level shared types so they exist for observers
  doc.getMap(YDOC_KEYS.META);
  doc.getMap(YDOC_KEYS.ELEMENTS);
  doc.getMap(YDOC_KEYS.EDGES);
  doc.getMap(YDOC_KEYS.INTENTION_CORE);
  doc.getMap(YDOC_KEYS.DESIRED_CHANGE);
  doc.getMap(YDOC_KEYS.HUMAN_CONTEXT);
  doc.getMap(YDOC_KEYS.CONTEXT_AND_MEANING);
  doc.getMap(YDOC_KEYS.STATE_MAPPING);
  doc.getMap(YDOC_KEYS.TRAIT_MAPPING);
  doc.getMap(YDOC_KEYS.SENSORY_DOMAINS);
  doc.getMap(YDOC_KEYS.PRESENCE_TYPES);
  doc.getMap(YDOC_KEYS.REALITY_PLANES);
  doc.getArray(YDOC_KEYS.REALITY_PLANES_V2);
  doc.getMap(YDOC_KEYS.EXPERIENCE_FLOW);
  doc.getArray(YDOC_KEYS.EXPERIENCE_FLOW_STAGES);
  doc.getText(YDOC_KEYS.EXPERIENCE_FLOW_DESCRIPTION);
  doc.getMap(YDOC_KEYS.COMMENTS);
  doc.getArray(YDOC_KEYS.VERSIONS);
  doc.getArray(YDOC_KEYS.OKRS);

  return doc;
}

// ─── Hydration: CXDProject → Y.Doc ──────────────────────────────────────────

/**
 * Hydrate a Y.Doc from existing CXDProject JSON data.
 * Wraps all mutations in a single transaction for atomicity.
 *
 * This is used when:
 * 1. Creating a new collaborative session
 * 2. Migrating a legacy project (no yjs_state yet) to CRDT
 */
export function initializeYDoc(doc: Y.Doc, project: CXDProject): void {
  // Use 'initialization' origin so SupabaseYjsProvider can skip broadcasting this.
  // The full state is saved to yjs_state by SupabasePersistence — new peers load
  // from DB rather than needing a P2P broadcast of 6MB+ data.
  doc.transact(() => {
    // ── Meta ──
    const yMeta = doc.getMap(YDOC_KEYS.META);
    for (const field of META_SCALAR_FIELDS) {
      const value = (project as unknown as Record<string, unknown>)[field];
      if (value !== undefined) {
        yMeta.set(field, value);
      }
    }
    // Also store project id in meta
    yMeta.set('id', project.id);

    // ── Canvas Elements ──
    const yElements = doc.getMap(YDOC_KEYS.ELEMENTS);
    const elements = project.canvasLayout?.elements ?? [];
    // Guard: skip if already populated (e.g., from IndexedDB)
    if (yElements.size === 0) {
      for (const element of elements) {
        yElements.set(element.id, canvasElementToYMap(element));
      }
    }

    // ── Canvas Edges ──
    const yEdges = doc.getMap(YDOC_KEYS.EDGES);
    const edges = project.canvasLayout?.edges ?? [];
    // Guard: skip if already populated (e.g., from IndexedDB)
    if (yEdges.size === 0) {
      for (const edge of edges) {
        yEdges.set(edge.id, canvasEdgeToYMap(edge));
      }
    }

    // ── Design Fields with Y.Text ──
    for (const [sectionKey, fields] of Object.entries(YTEXT_DESIGN_FIELDS)) {
      const ySection = doc.getMap(sectionKey);
      const sectionData = (project as unknown as Record<string, unknown>)[sectionKey] as Record<string, string> | undefined;
      if (sectionData) {
        for (const field of fields) {
          const value = sectionData[field] ?? '';
          ySection.set(field, createYText(value));
        }
      }
    }

    // ── Design Fields with numeric values ──
    for (const [sectionKey, fields] of Object.entries(YNUMBER_DESIGN_FIELDS)) {
      const ySection = doc.getMap(sectionKey);
      const sectionData = (project as unknown as Record<string, unknown>)[sectionKey] as Record<string, number> | undefined;
      if (sectionData) {
        for (const field of fields) {
          ySection.set(field, sectionData[field] ?? 0);
        }
      }
    }

    // ── Reality Planes V2 (ordered array) ──
    const yRealityPlanesV2 = doc.getArray(YDOC_KEYS.REALITY_PLANES_V2);
    const rpv2 = project.realityPlanesV2 ?? [];
    // Guard: skip if already populated (e.g., loaded from IndexedDB persistence).
    // Without this, calling initializeYDoc on top of existing data doubles every plane.
    if (yRealityPlanesV2.length === 0) {
      for (const plane of rpv2) {
        const yPlane = new Y.Map<unknown>();
        yPlane.set('code', plane.code);
        yPlane.set('enabled', plane.enabled);
        yPlane.set('priority', plane.priority);
        yPlane.set('interfaceModality', createYText(plane.interfaceModality ?? ''));
        yRealityPlanesV2.push([yPlane]);
      }
    }

    // ── Experience Flow (legacy fixed stages) ──
    const yExpFlow = doc.getMap(YDOC_KEYS.EXPERIENCE_FLOW);
    if (project.experienceFlow) {
      for (const [code, stage] of Object.entries(project.experienceFlow)) {
        const yStage = new Y.Map<unknown>();
        yStage.set('code', stage.code);
        yStage.set('label', stage.label);
        yStage.set('description', stage.description);
        yStage.set('engagementLevel', stage.engagementLevel);
        yStage.set('narrativeNotes', createYText(stage.narrativeNotes ?? ''));
        yStage.set('designIntent', createYText(stage.designIntent ?? ''));

        // Engagement distribution as nested Y.Map
        const yDist = new Y.Map<unknown>();
        if (stage.engagementDistribution) {
          for (const [ek, ev] of Object.entries(stage.engagementDistribution)) {
            yDist.set(ek, ev);
          }
        }
        yStage.set('engagementDistribution', yDist);

        yExpFlow.set(code, yStage);
      }
    }

    // ── Experience Flow Stages V2 (ordered array) ──
    const yStages = doc.getArray(YDOC_KEYS.EXPERIENCE_FLOW_STAGES);
    const stages = project.experienceFlowStages ?? [];
    // Guard: skip if already populated (same race condition as reality planes above)
    if (yStages.length === 0) {
      for (const stage of stages) {
        const yStage = new Y.Map<unknown>();
        yStage.set('id', stage.id);
        yStage.set('estimatedMinutes', stage.estimatedMinutes);

        // Text fields → Y.Text
        for (const field of STAGE_YTEXT_FIELDS) {
          const value = (stage as unknown as Record<string, unknown>)[field];
          yStage.set(field, createYText(typeof value === 'string' ? value : ''));
        }

        // Nested fields → Y.Map. engagementDistribution/presenceTypes are
        // required by ExperienceFlowStageV2, but stages built through older
        // or partial code paths can still arrive without them — fall back to
        // the schema defaults so the key is always written. Leaving it unset
        // here means downstream readers (share page, exports, drawer) get
        // `undefined` back and crash on the first `.observer`-style access
        // instead of an empty/default distribution (2026-07-23 share-page bug).
        const nestedDefaults: Partial<Record<(typeof STAGE_NESTED_FIELDS)[number], object>> = {
          engagementDistribution: DEFAULT_ENGAGEMENT_DISTRIBUTION,
          presenceTypes: DEFAULT_STAGE_PRESENCE_TYPES,
        };
        for (const field of STAGE_NESTED_FIELDS) {
          const value = (stage as unknown as Record<string, unknown>)[field] ?? nestedDefaults[field];
          if (value && typeof value === 'object') {
            const yNested = new Y.Map<unknown>();
            for (const [nk, nv] of Object.entries(value)) {
              yNested.set(nk, nv);
            }
            yStage.set(field, yNested);
          }
        }

        yStages.push([yStage]);
      }
    }

    // ── Experience Flow Description ──
    const yDesc = doc.getText(YDOC_KEYS.EXPERIENCE_FLOW_DESCRIPTION);
    if (project.experienceFlowDescription) {
      yDesc.insert(0, project.experienceFlowDescription);
    }
  }, 'initialization'); // origin: SupabaseYjsProvider skips broadcasting this

  // Comments / versions / OKRs are seeded via the union-merge helper so the
  // same code path covers both fresh docs and docs from the era when these
  // collections lived only in project_data JSON.
  seedProjectExtrasIntoYDoc(doc, project);
}

// ─── Seeding: comments / versions / OKRs (union by id) ──────────────────────

/**
 * Merge comments, versions, and OKRs from project JSON into the Y.Doc.
 *
 * Union semantics: items already present in the Y.Doc win; items that exist
 * only in project_data are added. This backfills docs created before these
 * collections were CRDT-managed (they were saved only to project_data JSON,
 * so an existing yjs_state won't contain them), without duplicating items
 * that already live in the doc.
 *
 * Safe to call on every project load — it's idempotent.
 */
export function seedProjectExtrasIntoYDoc(doc: Y.Doc, project: CXDProject): void {
  const comments = project.comments ?? [];
  const versions = project.versions ?? [];
  const okrs = project.okrs ?? [];
  if (comments.length === 0 && versions.length === 0 && okrs.length === 0) return;

  doc.transact(() => {
    const yComments = doc.getMap(YDOC_KEYS.COMMENTS);
    for (const comment of comments) {
      if (comment?.id && !yComments.has(comment.id)) {
        yComments.set(comment.id, commentToYMap(comment));
      }
    }

    const yVersions = doc.getArray<Y.Map<unknown>>(YDOC_KEYS.VERSIONS);
    const versionIds = new Set<string>();
    for (let i = 0; i < yVersions.length; i++) {
      versionIds.add(yVersions.get(i).get('id') as string);
    }
    for (const version of versions) {
      if (version?.id && !versionIds.has(version.id)) {
        yVersions.push([versionToYMap(version)]);
      }
    }

    const yOKRs = doc.getArray<Y.Map<unknown>>(YDOC_KEYS.OKRS);
    const okrIds = new Set<string>();
    for (let i = 0; i < yOKRs.length; i++) {
      okrIds.add(yOKRs.get(i).get('id') as string);
    }
    for (const okr of okrs) {
      if (okr?.id && !okrIds.has(okr.id)) {
        yOKRs.push([okrToYMap(okr)]);
      }
    }
  }, 'initialization');
}

/**
 * Reconcile canvas data from project_data into an already-hydrated Y.Doc.
 *
 * Root cause this closes (July 2026 data-loss incident): when a row has BOTH
 * yjs_state and project_data, load trusted yjs_state unconditionally. Any
 * element that existed only in project_data (written by a legacy/LWW-mode
 * saveProject, a localStorage-backup restore, or a session with the CRDT flag
 * off) was silently dropped from the doc — then the first post-ready save
 * derived project_data from that stale doc and persisted the loss. The wipe
 * guard only catches the zero-element case, not partial staleness.
 *
 * This union-merges BY ID: elements/edges the doc already knows stay untouched
 * (the CRDT remains authoritative for everything it contains); only ids the
 * doc has never seen are seeded. Trade-off, documented deliberately: an
 * element deleted in the doc universe while project_data still carried it is
 * resurrected. With the unified writer both columns update atomically within
 * one save, so that window is seconds wide and only reachable via legacy
 * paths — resurrecting a rare deleted element is the right failure direction
 * for a tool whose core promise is never losing user work.
 *
 * Also reconciles meta name/description from project_data: dashboard renames
 * write project_data only, so for these two fields project_data is always
 * at-least-as-fresh as doc meta (canvas renames write both).
 *
 * MODIFICATIONS (pass `dbState`, the yjs_state binary exactly as loaded from
 * the DB): every writer of yjs_state also writes project_data in the same
 * UPDATE, so when project_data's version of a known element differs from the
 * DB yjs_state's version, project_data was written LATER by a project_data-only
 * path (a session that ran without the CRDT, e.g. every post-reload session
 * before the reload fix). "Doc wins for known ids" silently reverted those
 * edits; instead project_data's version replaces the doc's. Elements the live
 * doc changed beyond the DB state (unsaved IndexedDB edits) are unaffected:
 * they only get replaced where project_data itself diverged from the DB.
 *
 * Returns seed/repair counts so the caller can emit telemetry — divergence
 * should be visible in Sentry, not silent.
 */
export function reconcileCanvasIntoYDoc(
  doc: Y.Doc,
  project: CXDProject,
  dbState?: Uint8Array | null
): { seededElements: number; seededEdges: number; repairedElements: number; repairedEdges: number } {
  const elements = project.canvasLayout?.elements ?? [];
  const edges = project.canvasLayout?.edges ?? [];
  let seededElements = 0;
  let seededEdges = 0;
  let repairedElements = 0;
  let repairedEdges = 0;

  // Canonical forms of the DB yjs_state's elements/edges, and a normalizer that
  // round-trips project_data items through the same serializer so formatting
  // differences (Y.Text, JSON arrays, undefined keys) never read as edits.
  let dbElements: Map<string, string> | null = null;
  let dbEdges: Map<string, string> | null = null;
  const scratch = new Y.Doc();
  const scratchEls = scratch.getMap<Y.Map<unknown>>('els');
  const scratchEdges = scratch.getMap<Y.Map<unknown>>('edges');
  const normElement = (el: CanvasElement): string => {
    scratchEls.set('x', canvasElementToYMap(el));
    return stableStringify(yMapToCanvasElement(scratchEls.get('x')!));
  };
  const normEdge = (edge: CanvasEdge): string => {
    scratchEdges.set('x', canvasEdgeToYMap(edge));
    return stableStringify(yMapToCanvasEdge(scratchEdges.get('x')!));
  };
  if (dbState && dbState.length > 0) {
    try {
      const dbDoc = new Y.Doc();
      Y.applyUpdate(dbDoc, dbState);
      dbElements = new Map();
      dbEdges = new Map();
      dbDoc.getMap<Y.Map<unknown>>(YDOC_KEYS.ELEMENTS).forEach((yEl, id) => {
        if (yEl instanceof Y.Map) dbElements!.set(id, normElement(yMapToCanvasElement(yEl)));
      });
      dbDoc.getMap<Y.Map<unknown>>(YDOC_KEYS.EDGES).forEach((yEdge, id) => {
        if (yEdge instanceof Y.Map) dbEdges!.set(id, normEdge(yMapToCanvasEdge(yEdge)));
      });
      dbDoc.destroy();
    } catch (err) {
      console.warn('[reconcile] Could not decode DB yjs_state; skipping modification repair:', err);
      dbElements = null;
      dbEdges = null;
    }
  }

  doc.transact(() => {
    const yElements = doc.getMap(YDOC_KEYS.ELEMENTS);
    for (const element of elements) {
      if (!element?.id) continue;
      if (!yElements.has(element.id)) {
        yElements.set(element.id, canvasElementToYMap(element));
        seededElements++;
      } else if (dbElements?.has(element.id) && dbElements.get(element.id) !== normElement(element)) {
        yElements.set(element.id, canvasElementToYMap(element));
        repairedElements++;
      }
    }

    const yEdges = doc.getMap(YDOC_KEYS.EDGES);
    for (const edge of edges) {
      if (!edge?.id) continue;
      if (!yEdges.has(edge.id)) {
        yEdges.set(edge.id, canvasEdgeToYMap(edge));
        seededEdges++;
      } else if (dbEdges?.has(edge.id) && dbEdges.get(edge.id) !== normEdge(edge)) {
        yEdges.set(edge.id, canvasEdgeToYMap(edge));
        repairedEdges++;
      }
    }

    const yMeta = doc.getMap(YDOC_KEYS.META);
    for (const field of ['name', 'description'] as const) {
      const value = project[field];
      if (typeof value === 'string' && value.length > 0 && yMeta.get(field) !== value) {
        yMeta.set(field, value);
      }
    }
  }, 'initialization');
  scratch.destroy();

  return { seededElements, seededEdges, repairedElements, repairedEdges };
}

/** JSON with sorted keys and undefined dropped, for order-insensitive equality. */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(v).sort()) {
        if (v[k] !== undefined) sorted[k] = v[k];
      }
      return sorted;
    }
    return v;
  });
}

// ─── Conversion: Y.Doc → CXDProject ─────────────────────────────────────────

/**
 * Read the full Y.Doc state and convert it back to a plain CXDProject object.
 * Used for persistence (saving to Supabase project_data as JSON backup)
 * and for Zustand store hydration.
 */
export function yDocToProject(doc: Y.Doc): CXDProject {
  // ── Meta ──
  const yMeta = doc.getMap(YDOC_KEYS.META);
  const meta: Record<string, unknown> = {};
  yMeta.forEach((value, key) => {
    meta[key] = value;
  });

  // ── Elements ──
  const yElements = doc.getMap(YDOC_KEYS.ELEMENTS);
  const elements: CanvasElement[] = [];
  yElements.forEach((yEl) => {
    if (yEl instanceof Y.Map) {
      elements.push(yMapToCanvasElement(yEl));
    }
  });

  // ── Edges ──
  const yEdges = doc.getMap(YDOC_KEYS.EDGES);
  const edges: CanvasEdge[] = [];
  yEdges.forEach((yEdge) => {
    if (yEdge instanceof Y.Map) {
      edges.push(yMapToCanvasEdge(yEdge));
    }
  });

  // ── Text design fields ──
  const textSections: Record<string, Record<string, string>> = {};
  for (const [sectionKey, fields] of Object.entries(YTEXT_DESIGN_FIELDS)) {
    const ySection = doc.getMap(sectionKey);
    const section: Record<string, string> = {};
    for (const field of fields) {
      const yVal = ySection.get(field);
      section[field] = yVal instanceof Y.Text ? yTextToString(yVal) : (typeof yVal === 'string' ? yVal : '');
    }
    textSections[sectionKey] = section;
  }

  // ── Number design fields ──
  const numberSections: Record<string, Record<string, number>> = {};
  for (const [sectionKey, fields] of Object.entries(YNUMBER_DESIGN_FIELDS)) {
    const ySection = doc.getMap(sectionKey);
    const section: Record<string, number> = {};
    for (const field of fields) {
      section[field] = (ySection.get(field) as number) ?? 0;
    }
    numberSections[sectionKey] = section;
  }

  // ── Reality Planes V2 ──
  const yRPV2 = doc.getArray(YDOC_KEYS.REALITY_PLANES_V2);
  const realityPlanesV2: CXDProject['realityPlanesV2'] = [];
  for (let i = 0; i < yRPV2.length; i++) {
    const yPlane = yRPV2.get(i) as Y.Map<unknown>;
    const interfaceModality = yPlane.get('interfaceModality');
    realityPlanesV2.push({
      code: yPlane.get('code') as string,
      enabled: yPlane.get('enabled') as boolean,
      priority: yPlane.get('priority') as number,
      interfaceModality: interfaceModality instanceof Y.Text
        ? yTextToString(interfaceModality)
        : (typeof interfaceModality === 'string' ? interfaceModality : ''),
    } as CXDProject['realityPlanesV2'] extends (infer T)[] | undefined ? T : never);
  }

  // ── Experience Flow (legacy) ──
  const yExpFlow = doc.getMap(YDOC_KEYS.EXPERIENCE_FLOW);
  const experienceFlow: Record<string, unknown> = {};
  yExpFlow.forEach((yStage, code) => {
    if (yStage instanceof Y.Map) {
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
      experienceFlow[code] = stage;
    }
  });

  // ── Experience Flow Stages V2 ──
  const yStages = doc.getArray(YDOC_KEYS.EXPERIENCE_FLOW_STAGES);
  const experienceFlowStages: CXDProject['experienceFlowStages'] = [];
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

    // Self-heal: skip orphan entries (no id) left by the pre-fix reorder/move bug,
    // and guarantee `name` is a string so `stage.name.toLowerCase()` never throws.
    if (!stage.id) continue;
    if (typeof stage.name !== 'string') stage.name = 'Untitled Stage';

    experienceFlowStages.push(stage as unknown as ExperienceFlowStageV2);
  }

  // ── Experience Flow Description ──
  const yDesc = doc.getText(YDOC_KEYS.EXPERIENCE_FLOW_DESCRIPTION);
  const experienceFlowDescription = yDesc.toString();

  // ── Comments / Versions / OKRs ──
  const comments = getYDocComments(doc);
  const versions = getYDocVersions(doc);
  const okrs = getYDocOKRs(doc);

  // ── Assemble CXDProject ──
  return {
    id: (meta.id as string) ?? '',
    name: (meta.name as string) ?? '',
    description: (meta.description as string) ?? '',
    createdAt: (meta.createdAt as string) ?? new Date().toISOString(),
    updatedAt: (meta.updatedAt as string) ?? new Date().toISOString(),
    schemaVersion: (meta.schemaVersion as string) ?? '1.0.0',
    ownerId: (meta.ownerId as string) ?? '',
    shareToken: meta.shareToken as string | undefined,
    canvasBackground: meta.canvasBackground as string | undefined,
    wizardCompleted: (meta.wizardCompleted as boolean) ?? false,
    currentWizardStep: (meta.currentWizardStep as number) ?? 0,
    framingCanvasPopulated: (meta.framingCanvasPopulated as boolean) ?? false,
    framingType: meta.framingType as string | undefined,

    intentionCore: textSections.intentionCore as unknown as CXDProject['intentionCore'],
    desiredChange: textSections.desiredChange as unknown as CXDProject['desiredChange'],
    humanContext: textSections.humanContext as unknown as CXDProject['humanContext'],
    contextAndMeaning: textSections.contextAndMeaning as unknown as CXDProject['contextAndMeaning'],
    stateMapping: textSections.stateMapping as unknown as CXDProject['stateMapping'],
    traitMapping: textSections.traitMapping as unknown as CXDProject['traitMapping'],

    sensoryDomains: numberSections.sensoryDomains as unknown as CXDProject['sensoryDomains'],
    presenceTypes: numberSections.presenceTypes as unknown as CXDProject['presenceTypes'],
    realityPlanes: numberSections.realityPlanes as CXDProject['realityPlanes'],

    realityPlanesV2,
    experienceFlow: experienceFlow as CXDProject['experienceFlow'],
    experienceFlowStages,
    experienceFlowDescription,

    comments,
    versions,
    okrs,

    canvasLayout: {
      elements,
      edges,
      sectionPositions: project_canvasLayoutSectionPositions(doc),
    },
  };
}

// ─── Collection Readers ──────────────────────────────────────────────────────

/** Read all comments from the Y.Doc, ordered by creation time. */
export function getYDocComments(doc: Y.Doc): Comment[] {
  const yComments = doc.getMap(YDOC_KEYS.COMMENTS);
  const comments: Comment[] = [];
  yComments.forEach((yComment) => {
    if (yComment instanceof Y.Map) {
      comments.push(yMapToComment(yComment));
    }
  });
  comments.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  return comments;
}

/** Read all versions from the Y.Doc in array order. */
export function getYDocVersions(doc: Y.Doc): Version[] {
  const yVersions = doc.getArray<Y.Map<unknown>>(YDOC_KEYS.VERSIONS);
  const versions: Version[] = [];
  for (let i = 0; i < yVersions.length; i++) {
    const yVersion = yVersions.get(i);
    if (yVersion instanceof Y.Map) {
      versions.push(yMapToVersion(yVersion));
    }
  }
  return versions;
}

/** Read all OKRs from the Y.Doc in array order. */
export function getYDocOKRs(doc: Y.Doc): OKR[] {
  const yOKRs = doc.getArray<Y.Map<unknown>>(YDOC_KEYS.OKRS);
  const okrs: OKR[] = [];
  for (let i = 0; i < yOKRs.length; i++) {
    const yOKR = yOKRs.get(i);
    if (yOKR instanceof Y.Map) {
      okrs.push(yMapToOKR(yOKR));
    }
  }
  return okrs;
}

// ─── One-time Migration: Deduplicate Reality Planes ──────────────────────────

/**
 * Removes duplicate reality planes from the Y.Doc, keeping only the first
 * occurrence of each plane code.
 *
 * Previous versions of initializeYDoc lacked an idempotency guard, which
 * caused planes to accumulate in IndexedDB across sessions. This function
 * is a one-time repair — it detects duplicates and deletes them in a
 * transact() so observers see a single clean update.
 *
 * Returns true if any duplicates were removed.
 */
export function deduplicateRealityPlanesV2(doc: Y.Doc): boolean {
  const yRPV2 = doc.getArray(YDOC_KEYS.REALITY_PLANES_V2);
  if (yRPV2.length === 0) return false;

  // Walk the array and collect indices of duplicate codes (keep first occurrence)
  const seenCodes = new Set<string>();
  const toDelete: number[] = [];

  for (let i = 0; i < yRPV2.length; i++) {
    const yPlane = yRPV2.get(i) as Y.Map<unknown>;
    const code = yPlane.get('code') as string;
    if (seenCodes.has(code)) {
      toDelete.push(i);
    } else {
      seenCodes.add(code);
    }
  }

  if (toDelete.length === 0) return false;

  // Delete from highest index down so earlier indices stay valid
  doc.transact(() => {
    for (let i = toDelete.length - 1; i >= 0; i--) {
      yRPV2.delete(toDelete[i], 1);
    }
  }, 'deduplication');

  console.log(`[YjsProject] Removed ${toDelete.length} duplicate reality planes`);
  return true;
}

/**
 * Helper to read canvasLayout.sectionPositions from meta if stored there.
 * Section positions are simple coordinate pairs stored in meta.
 */
function project_canvasLayoutSectionPositions(doc: Y.Doc): Record<string, { x: number; y: number }> | undefined {
  const yMeta = doc.getMap(YDOC_KEYS.META);
  const raw = yMeta.get('sectionPositions');
  if (!raw || typeof raw !== 'string') return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

// ─── Utility: Get single element from Y.Doc ──────────────────────────────────

/**
 * Get a single canvas element from the Y.Doc by ID.
 */
export function getYDocElement(doc: Y.Doc, elementId: string): CanvasElement | null {
  const yElements = doc.getMap(YDOC_KEYS.ELEMENTS);
  const yEl = yElements.get(elementId);
  if (yEl instanceof Y.Map) {
    return yMapToCanvasElement(yEl);
  }
  return null;
}

/**
 * Get all canvas elements from the Y.Doc as a plain array.
 */
export function getYDocElements(doc: Y.Doc): CanvasElement[] {
  const yElements = doc.getMap(YDOC_KEYS.ELEMENTS);
  const elements: CanvasElement[] = [];
  yElements.forEach((yEl) => {
    if (yEl instanceof Y.Map) {
      elements.push(yMapToCanvasElement(yEl));
    }
  });
  return elements;
}

/**
 * Get all canvas edges from the Y.Doc as a plain array.
 */
export function getYDocEdges(doc: Y.Doc): CanvasEdge[] {
  const yEdges = doc.getMap(YDOC_KEYS.EDGES);
  const edges: CanvasEdge[] = [];
  yEdges.forEach((yEdge) => {
    if (yEdge instanceof Y.Map) {
      edges.push(yMapToCanvasEdge(yEdge));
    }
  });
  return edges;
}
