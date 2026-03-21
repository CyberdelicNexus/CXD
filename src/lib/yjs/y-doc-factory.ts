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
    for (const element of elements) {
      yElements.set(element.id, canvasElementToYMap(element));
    }

    // ── Canvas Edges ──
    const yEdges = doc.getMap(YDOC_KEYS.EDGES);
    const edges = project.canvasLayout?.edges ?? [];
    for (const edge of edges) {
      yEdges.set(edge.id, canvasEdgeToYMap(edge));
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
    for (const plane of rpv2) {
      const yPlane = new Y.Map<unknown>();
      yPlane.set('code', plane.code);
      yPlane.set('enabled', plane.enabled);
      yPlane.set('priority', plane.priority);
      yPlane.set('interfaceModality', createYText(plane.interfaceModality ?? ''));
      yRealityPlanesV2.push([yPlane]);
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
    for (const stage of stages) {
      const yStage = new Y.Map<unknown>();
      yStage.set('id', stage.id);
      yStage.set('estimatedMinutes', stage.estimatedMinutes);

      // Text fields → Y.Text
      for (const field of STAGE_YTEXT_FIELDS) {
        const value = (stage as unknown as Record<string, unknown>)[field];
        yStage.set(field, createYText(typeof value === 'string' ? value : ''));
      }

      // Nested fields → Y.Map
      for (const field of STAGE_NESTED_FIELDS) {
        const value = (stage as unknown as Record<string, unknown>)[field];
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

    // ── Experience Flow Description ──
    const yDesc = doc.getText(YDOC_KEYS.EXPERIENCE_FLOW_DESCRIPTION);
    if (project.experienceFlowDescription) {
      yDesc.insert(0, project.experienceFlowDescription);
    }
  }, 'initialization'); // origin: SupabaseYjsProvider skips broadcasting this
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

    experienceFlowStages.push(stage as unknown as ExperienceFlowStageV2);
  }

  // ── Experience Flow Description ──
  const yDesc = doc.getText(YDOC_KEYS.EXPERIENCE_FLOW_DESCRIPTION);
  const experienceFlowDescription = yDesc.toString();

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

    canvasLayout: {
      elements,
      edges,
      sectionPositions: project_canvasLayoutSectionPositions(doc),
    },
  };
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
