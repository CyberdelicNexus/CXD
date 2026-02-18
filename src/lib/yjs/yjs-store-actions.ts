/**
 * Yjs Store Actions
 *
 * Functions that perform mutations on the Y.Doc.
 * Called by Zustand store actions when yDoc is set (CRDT mode).
 * The Y.Doc observers in the bridge will push changes to Zustand automatically.
 */

import * as Y from 'yjs';
import type { CanvasElement, CanvasEdge } from '@/types/canvas-elements';
import type { RealityPlaneCode, EngagementDistribution, StagePresenceTypes, ExperienceFlowStageV2 } from '@/types/cxd-schema';
import { YDOC_KEYS } from './y-doc-types';
import { canvasElementToYMap, canvasEdgeToYMap, applyElementUpdates, applyEdgeUpdates } from './element-serializers';
import { setYText, createYText } from './y-text-helpers';
import { v4 as uuidv4 } from 'uuid';
import type { RealityPlaneCode as RPCode } from '@/types/cxd-schema';

// ─── Canvas Elements ─────────────────────────────────────────────────────────

export function yjsAddElement(doc: Y.Doc, element: CanvasElement): void {
  doc.transact(() => {
    const yElements = doc.getMap(YDOC_KEYS.ELEMENTS);
    yElements.set(element.id, canvasElementToYMap(element));
  }, 'local');
}

export function yjsUpdateElement(doc: Y.Doc, elementId: string, updates: Partial<CanvasElement>): void {
  doc.transact(() => {
    const yElements = doc.getMap(YDOC_KEYS.ELEMENTS);
    const yEl = yElements.get(elementId);
    if (yEl instanceof Y.Map) {
      applyElementUpdates(yEl, updates);
    }
  }, 'local');
}

export function yjsRemoveElement(doc: Y.Doc, elementId: string): void {
  doc.transact(() => {
    const yElements = doc.getMap(YDOC_KEYS.ELEMENTS);
    yElements.delete(elementId);
  }, 'local');
}

export function yjsDuplicateElement(doc: Y.Doc, elementId: string): string | null {
  const yElements = doc.getMap(YDOC_KEYS.ELEMENTS);
  const yEl = yElements.get(elementId);
  if (!(yEl instanceof Y.Map)) return null;

  const newId = uuidv4();
  doc.transact(() => {
    // Read original properties and create a copy with offset position
    const newYEl = new Y.Map<unknown>();
    (yEl as Y.Map<unknown>).forEach((value, key) => {
      if (key === 'id') {
        newYEl.set('id', newId);
      } else if (key === 'x') {
        newYEl.set('x', ((value as number) || 0) + 20);
      } else if (key === 'y') {
        newYEl.set('y', ((value as number) || 0) + 20);
      } else if (value instanceof Y.Text) {
        newYEl.set(key, createYText(value.toString()));
      } else if (value instanceof Y.Map) {
        // Deep copy nested Y.Map
        const newNested = new Y.Map<unknown>();
        value.forEach((nv, nk) => {
          if (nv instanceof Y.Text) {
            newNested.set(nk, createYText(nv.toString()));
          } else {
            newNested.set(nk, nv);
          }
        });
        newYEl.set(key, newNested);
      } else {
        newYEl.set(key, value);
      }
    });
    yElements.set(newId, newYEl);
  }, 'local');

  return newId;
}

// ─── Canvas Edges ────────────────────────────────────────────────────────────

export function yjsAddEdge(doc: Y.Doc, edge: CanvasEdge): void {
  doc.transact(() => {
    const yEdges = doc.getMap(YDOC_KEYS.EDGES);
    yEdges.set(edge.id, canvasEdgeToYMap(edge));
  }, 'local');
}

export function yjsUpdateEdge(doc: Y.Doc, edgeId: string, updates: Partial<CanvasEdge>): void {
  doc.transact(() => {
    const yEdges = doc.getMap(YDOC_KEYS.EDGES);
    const yEdge = yEdges.get(edgeId);
    if (yEdge instanceof Y.Map) {
      applyEdgeUpdates(yEdge, updates);
    }
  }, 'local');
}

export function yjsRemoveEdge(doc: Y.Doc, edgeId: string): void {
  doc.transact(() => {
    const yEdges = doc.getMap(YDOC_KEYS.EDGES);
    yEdges.delete(edgeId);
  }, 'local');
}

// ─── Container Management ────────────────────────────────────────────────────

export function yjsMoveContainerWithChildren(
  doc: Y.Doc,
  containerId: string,
  deltaX: number,
  deltaY: number
): void {
  doc.transact(() => {
    const yElements = doc.getMap(YDOC_KEYS.ELEMENTS);
    yElements.forEach((yEl) => {
      if (yEl instanceof Y.Map) {
        const id = yEl.get('id') as string;
        const elContainerId = yEl.get('containerId') as string | undefined;
        if (id === containerId || elContainerId === containerId) {
          const x = (yEl.get('x') as number) || 0;
          const y = (yEl.get('y') as number) || 0;
          yEl.set('x', x + deltaX);
          yEl.set('y', y + deltaY);
        }
      }
    });
  }, 'local');
}

// ─── Element Grouping ────────────────────────────────────────────────────────

export function yjsCreateGroup(doc: Y.Doc, elementIds: string[]): string {
  const groupId = `group-${uuidv4()}`;
  doc.transact(() => {
    const yElements = doc.getMap(YDOC_KEYS.ELEMENTS);
    for (const id of elementIds) {
      const yEl = yElements.get(id);
      if (yEl instanceof Y.Map) {
        yEl.set('groupId', groupId);
      }
    }
  }, 'local');
  return groupId;
}

export function yjsUngroup(doc: Y.Doc, groupId: string): void {
  doc.transact(() => {
    const yElements = doc.getMap(YDOC_KEYS.ELEMENTS);
    yElements.forEach((yEl) => {
      if (yEl instanceof Y.Map && yEl.get('groupId') === groupId) {
        yEl.delete('groupId');
      }
    });
  }, 'local');
}

// ─── Design Fields (Y.Text) ─────────────────────────────────────────────────

export function yjsSetDesignTextField(
  doc: Y.Doc,
  section: string,
  field: string,
  value: string
): void {
  doc.transact(() => {
    const ySection = doc.getMap(section);
    const existing = ySection.get(field);
    if (existing instanceof Y.Text) {
      setYText(existing, value);
    } else {
      ySection.set(field, createYText(value));
    }
  }, 'local');
}

// ─── Design Fields (numeric) ─────────────────────────────────────────────────

export function yjsSetDesignNumberField(
  doc: Y.Doc,
  section: string,
  field: string,
  value: number
): void {
  doc.transact(() => {
    const ySection = doc.getMap(section);
    ySection.set(field, value);
  }, 'local');
}

// ─── Meta Fields ─────────────────────────────────────────────────────────────

export function yjsSetMetaField(doc: Y.Doc, field: string, value: unknown): void {
  doc.transact(() => {
    const yMeta = doc.getMap(YDOC_KEYS.META);
    yMeta.set(field, value);
  }, 'local');
}

// ─── Reality Planes V2 ──────────────────────────────────────────────────────

export function yjsToggleRealityPlane(doc: Y.Doc, code: RealityPlaneCode): void {
  doc.transact(() => {
    const yRPV2 = doc.getArray(YDOC_KEYS.REALITY_PLANES_V2);
    for (let i = 0; i < yRPV2.length; i++) {
      const yPlane = yRPV2.get(i) as Y.Map<unknown>;
      if (yPlane.get('code') === code) {
        yPlane.set('enabled', !yPlane.get('enabled'));
        break;
      }
    }
  }, 'local');
}

export function yjsUpdateRealityPlaneInterface(
  doc: Y.Doc,
  code: RealityPlaneCode,
  interfaceModality: string
): void {
  doc.transact(() => {
    const yRPV2 = doc.getArray(YDOC_KEYS.REALITY_PLANES_V2);
    for (let i = 0; i < yRPV2.length; i++) {
      const yPlane = yRPV2.get(i) as Y.Map<unknown>;
      if (yPlane.get('code') === code) {
        const existing = yPlane.get('interfaceModality');
        if (existing instanceof Y.Text) {
          setYText(existing, interfaceModality);
        } else {
          yPlane.set('interfaceModality', createYText(interfaceModality));
        }
        break;
      }
    }
  }, 'local');
}

// ─── Experience Flow Stages V2 ──────────────────────────────────────────────

export function yjsUpdateStageField(
  doc: Y.Doc,
  stageId: string,
  field: string,
  value: unknown
): void {
  doc.transact(() => {
    const yStages = doc.getArray(YDOC_KEYS.EXPERIENCE_FLOW_STAGES);
    for (let i = 0; i < yStages.length; i++) {
      const yStage = yStages.get(i) as Y.Map<unknown>;
      if (yStage.get('id') === stageId) {
        if (typeof value === 'string') {
          const existing = yStage.get(field);
          if (existing instanceof Y.Text) {
            setYText(existing, value);
          } else {
            yStage.set(field, createYText(value));
          }
        } else if (typeof value === 'object' && value !== null) {
          // For nested objects like engagementDistribution, presenceTypes, realityPlanes
          const existing = yStage.get(field);
          if (existing instanceof Y.Map) {
            for (const [k, v] of Object.entries(value)) {
              existing.set(k, v);
            }
          } else {
            const yNested = new Y.Map<unknown>();
            for (const [k, v] of Object.entries(value)) {
              yNested.set(k, v);
            }
            yStage.set(field, yNested);
          }
        } else {
          yStage.set(field, value);
        }
        break;
      }
    }
  }, 'local');
}

export function yjsAddExperienceFlowStage(doc: Y.Doc, afterIndex: number): void {
  doc.transact(() => {
    const yStages = doc.getArray(YDOC_KEYS.EXPERIENCE_FLOW_STAGES);
    const yStage = new Y.Map<unknown>();
    yStage.set('id', uuidv4());
    yStage.set('name', createYText('New Stage'));
    yStage.set('narrativeNotes', createYText(''));
    yStage.set('designIntent', createYText(''));
    yStage.set('estimatedMinutes', null);

    const yDist = new Y.Map<unknown>();
    yDist.set('observer', 0);
    yDist.set('engager', 100);
    yDist.set('coCreator', 0);
    yDist.set('architect', 0);
    yStage.set('engagementDistribution', yDist);

    const yPresence = new Y.Map<unknown>();
    yPresence.set('mental', 50);
    yPresence.set('emotional', 50);
    yPresence.set('social', 0);
    yPresence.set('embodied', 0);
    yPresence.set('environmental', 0);
    yPresence.set('active', 0);
    yStage.set('presenceTypes', yPresence);

    yStages.insert(afterIndex + 1, [yStage]);
  }, 'local');
}

export function yjsRemoveExperienceFlowStage(doc: Y.Doc, stageId: string): void {
  doc.transact(() => {
    const yStages = doc.getArray(YDOC_KEYS.EXPERIENCE_FLOW_STAGES);
    if (yStages.length <= 1) return; // Prevent deleting last stage
    for (let i = 0; i < yStages.length; i++) {
      const yStage = yStages.get(i) as Y.Map<unknown>;
      if (yStage.get('id') === stageId) {
        yStages.delete(i, 1);
        break;
      }
    }
  }, 'local');
}

export function yjsMoveExperienceFlowStage(
  doc: Y.Doc,
  stageId: string,
  direction: 'left' | 'right'
): void {
  doc.transact(() => {
    const yStages = doc.getArray(YDOC_KEYS.EXPERIENCE_FLOW_STAGES);
    let index = -1;
    for (let i = 0; i < yStages.length; i++) {
      const yStage = yStages.get(i) as Y.Map<unknown>;
      if (yStage.get('id') === stageId) {
        index = i;
        break;
      }
    }
    if (index === -1) return;

    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= yStages.length) return;

    // Y.Array doesn't have a native swap — delete and re-insert
    const item = yStages.get(index);
    yStages.delete(index, 1);
    yStages.insert(newIndex, [item]);
  }, 'local');
}

// ─── Experience Flow Description ─────────────────────────────────────────────

export function yjsSetExperienceFlowDescription(doc: Y.Doc, value: string): void {
  doc.transact(() => {
    const yDesc = doc.getText(YDOC_KEYS.EXPERIENCE_FLOW_DESCRIPTION);
    yDesc.delete(0, yDesc.length);
    if (value.length > 0) {
      yDesc.insert(0, value);
    }
  }, 'local');
}

// ─── Element Field Deletion ─────────────────────────────────────────────────

export function yjsDeleteElementField(doc: Y.Doc, elementId: string, field: string): void {
  doc.transact(() => {
    const yElements = doc.getMap(YDOC_KEYS.ELEMENTS);
    const yEl = yElements.get(elementId);
    if (yEl instanceof Y.Map) {
      yEl.delete(field);
    }
  }, 'local');
}

// ─── Reorder Reality Planes ─────────────────────────────────────────────────

export function yjsReorderRealityPlanes(doc: Y.Doc, newOrder: RPCode[]): void {
  doc.transact(() => {
    const yRPV2 = doc.getArray(YDOC_KEYS.REALITY_PLANES_V2);

    // Read current plane data
    const planes = new Map<string, { enabled: boolean; interfaceModality: string }>();
    for (let i = 0; i < yRPV2.length; i++) {
      const yPlane = yRPV2.get(i) as Y.Map<unknown>;
      const code = yPlane.get('code') as string;
      const im = yPlane.get('interfaceModality');
      planes.set(code, {
        enabled: yPlane.get('enabled') as boolean,
        interfaceModality: im instanceof Y.Text ? im.toString() : (im as string) || '',
      });
    }

    // Delete all and reinsert in new order
    yRPV2.delete(0, yRPV2.length);
    for (let i = 0; i < newOrder.length; i++) {
      const code = newOrder[i];
      const data = planes.get(code) || { enabled: false, interfaceModality: '' };
      const yPlane = new Y.Map<unknown>();
      yPlane.set('code', code);
      yPlane.set('enabled', data.enabled);
      yPlane.set('interfaceModality', createYText(data.interfaceModality));
      yPlane.set('priority', i);
      yRPV2.push([yPlane]);
    }
  }, 'local');
}

// ─── Reorder Experience Flow Stage (arbitrary index) ────────────────────────

export function yjsReorderExperienceFlowStage(
  doc: Y.Doc,
  stageId: string,
  newIndex: number
): void {
  doc.transact(() => {
    const yStages = doc.getArray(YDOC_KEYS.EXPERIENCE_FLOW_STAGES);
    let oldIndex = -1;
    for (let i = 0; i < yStages.length; i++) {
      const yStage = yStages.get(i) as Y.Map<unknown>;
      if (yStage.get('id') === stageId) {
        oldIndex = i;
        break;
      }
    }
    if (oldIndex === -1 || oldIndex === newIndex) return;
    if (newIndex < 0 || newIndex >= yStages.length) return;

    const item = yStages.get(oldIndex);
    yStages.delete(oldIndex, 1);
    yStages.insert(newIndex, [item]);
  }, 'local');
}

// ─── Toggle Reality Plane on Experience Flow Stage ──────────────────────────

export function yjsToggleExperienceFlowStageRealityPlane(
  doc: Y.Doc,
  stageId: string,
  code: RealityPlaneCode
): void {
  doc.transact(() => {
    const yStages = doc.getArray(YDOC_KEYS.EXPERIENCE_FLOW_STAGES);
    for (let i = 0; i < yStages.length; i++) {
      const yStage = yStages.get(i) as Y.Map<unknown>;
      if (yStage.get('id') === stageId) {
        const yPlanes = yStage.get('realityPlanes');
        if (yPlanes instanceof Y.Map) {
          const current = (yPlanes.get(code) as boolean) || false;
          yPlanes.set(code, !current);
        } else {
          const defaults: Record<string, boolean> = {
            PR: true, VR: false, AR: false, MR: false, GR: false, BR: false, CR: false,
          };
          defaults[code] = !defaults[code];
          const yNewPlanes = new Y.Map<unknown>();
          for (const [k, v] of Object.entries(defaults)) {
            yNewPlanes.set(k, v);
          }
          yStage.set('realityPlanes', yNewPlanes);
        }
        break;
      }
    }
  }, 'local');
}

// ─── Version Management Actions (re-export) ──────────────────────────────────

export {
  VERSION_YDOC_KEYS,
  yjsAddVersion,
  yjsUpdateVersion,
  yjsDeleteVersion,
  yjsReorderVersions,
  yjsSetVersionStatus,
  yjsAddOKR,
  yjsUpdateOKR,
  yjsDeleteOKR,
  yjsAddObjective,
  yjsUpdateObjective,
  yjsDeleteObjective,
  yjsAddKeyResult,
  yjsUpdateKeyResult,
  yjsDeleteKeyResult,
} from './yjs-version-actions';
