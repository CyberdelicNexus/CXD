/**
 * Yjs Version Management Actions (Refactored)
 *
 * CRDT operations for versions and OKRs.
 * These functions mutate the Y.Doc shared types for real-time collaboration.
 *
 * Changes in refactored model:
 * - Versions no longer have internal stage pipelines
 * - Versions have simple status enum (draft, active, testing, complete)
 * - OKRs belong to specific versions (versionId field)
 * - OKRs contain objectives, which contain key results (nested structure)
 */

import * as Y from 'yjs';
import { createYText, setYText } from './y-text-helpers';
import type { Version, OKR, Objective, KeyResult, VersionStatus } from '@/types/version-types';

// Y.Doc keys for version management
export const VERSION_YDOC_KEYS = {
  VERSIONS: 'versions',
  OKRS: 'okrs',
} as const;

// ─── Version CRUD ────────────────────────────────────────────────────────────

/**
 * Add a new version to the Y.Doc
 */
export function yjsAddVersion(doc: Y.Doc, version: Version): void {
  doc.transact(() => {
    const yVersions = doc.getArray<Y.Map<unknown>>(VERSION_YDOC_KEYS.VERSIONS);
    const yVersion = versionToYMap(version);
    yVersions.push([yVersion]);
  }, 'local');
}

/**
 * Update an existing version
 */
export function yjsUpdateVersion(doc: Y.Doc, versionId: string, updates: Partial<Version>): void {
  doc.transact(() => {
    const yVersions = doc.getArray<Y.Map<unknown>>(VERSION_YDOC_KEYS.VERSIONS);
    const versionIndex = findVersionIndex(yVersions, versionId);

    if (versionIndex >= 0) {
      const yVersion = yVersions.get(versionIndex) as Y.Map<unknown>;
      applyVersionUpdates(yVersion, updates);
      // Always update timestamp
      yVersion.set('updatedAt', new Date().toISOString());
    }
  }, 'local');
}

/**
 * Delete a version.
 * Also clears taskMetadata.versionId from any canvas elements tagged with it,
 * mirroring the non-CRDT store path so tasks don't point at a dead version.
 */
export function yjsDeleteVersion(doc: Y.Doc, versionId: string): void {
  doc.transact(() => {
    const yVersions = doc.getArray<Y.Map<unknown>>(VERSION_YDOC_KEYS.VERSIONS);
    const versionIndex = findVersionIndex(yVersions, versionId);

    if (versionIndex >= 0) {
      yVersions.delete(versionIndex, 1);
    }

    // Scrub the deleted version from task metadata on canvas elements
    const yElements = doc.getMap('elements');
    yElements.forEach((yEl) => {
      if (yEl instanceof Y.Map) {
        const yMeta = yEl.get('taskMetadata');
        if (yMeta instanceof Y.Map && yMeta.get('versionId') === versionId) {
          yMeta.delete('versionId');
        }
      }
    });
  }, 'local');
}

/**
 * Reorder versions
 */
export function yjsReorderVersions(doc: Y.Doc, newOrder: string[]): void {
  doc.transact(() => {
    const yVersions = doc.getArray<Y.Map<unknown>>(VERSION_YDOC_KEYS.VERSIONS);

    // Create a map of versionId -> Y.Map
    const versionMap = new Map<string, Y.Map<unknown>>();
    for (let i = 0; i < yVersions.length; i++) {
      const yVersion = yVersions.get(i) as Y.Map<unknown>;
      const id = yVersion.get('id') as string;
      versionMap.set(id, yVersion);
    }

    // Clear and rebuild array in new order
    yVersions.delete(0, yVersions.length);
    newOrder.forEach((versionId, index) => {
      const yVersion = versionMap.get(versionId);
      if (yVersion) {
        yVersion.set('order', index);
        yVersions.push([yVersion]);
      }
    });
  }, 'local');
}

/**
 * Set version status (replaces stage advancement)
 */
export function yjsSetVersionStatus(
  doc: Y.Doc,
  versionId: string,
  status: VersionStatus,
  updates: Partial<Version>
): void {
  doc.transact(() => {
    const yVersions = doc.getArray<Y.Map<unknown>>(VERSION_YDOC_KEYS.VERSIONS);
    const versionIndex = findVersionIndex(yVersions, versionId);

    if (versionIndex >= 0) {
      const yVersion = yVersions.get(versionIndex) as Y.Map<unknown>;
      applyVersionUpdates(yVersion, updates);
    }
  }, 'local');
}

// ─── OKR Management ──────────────────────────────────────────────────────────

/**
 * Add a new OKR
 */
export function yjsAddOKR(doc: Y.Doc, okr: OKR): void {
  doc.transact(() => {
    const yOKRs = doc.getArray<Y.Map<unknown>>(VERSION_YDOC_KEYS.OKRS);
    const yOKR = okrToYMap(okr);
    yOKRs.push([yOKR]);
  }, 'local');
}

/**
 * Update an existing OKR
 */
export function yjsUpdateOKR(doc: Y.Doc, okrId: string, updates: Partial<OKR>): void {
  doc.transact(() => {
    const yOKRs = doc.getArray<Y.Map<unknown>>(VERSION_YDOC_KEYS.OKRS);
    const okrIndex = findOKRIndex(yOKRs, okrId);

    if (okrIndex >= 0) {
      const yOKR = yOKRs.get(okrIndex) as Y.Map<unknown>;
      applyOKRUpdates(yOKR, updates);
      // Always update timestamp
      yOKR.set('updatedAt', new Date().toISOString());
    }
  }, 'local');
}

/**
 * Delete an OKR
 */
export function yjsDeleteOKR(doc: Y.Doc, okrId: string): void {
  doc.transact(() => {
    const yOKRs = doc.getArray<Y.Map<unknown>>(VERSION_YDOC_KEYS.OKRS);
    const okrIndex = findOKRIndex(yOKRs, okrId);

    if (okrIndex >= 0) {
      yOKRs.delete(okrIndex, 1);
    }
  }, 'local');
}

// ─── Objective Management ────────────────────────────────────────────────────

/**
 * Add a new objective to an OKR
 */
export function yjsAddObjective(doc: Y.Doc, okrId: string, objective: Objective): void {
  doc.transact(() => {
    const yOKRs = doc.getArray<Y.Map<unknown>>(VERSION_YDOC_KEYS.OKRS);
    const okrIndex = findOKRIndex(yOKRs, okrId);

    if (okrIndex >= 0) {
      const yOKR = yOKRs.get(okrIndex) as Y.Map<unknown>;
      const yObjectives = yOKR.get('objectives') as Y.Array<Y.Map<unknown>>;
      const yObjective = objectiveToYMap(objective);
      yObjectives.push([yObjective]);
      yOKR.set('updatedAt', new Date().toISOString());
    }
  }, 'local');
}

/**
 * Update an objective within an OKR
 */
export function yjsUpdateObjective(
  doc: Y.Doc,
  okrId: string,
  objectiveId: string,
  updates: Partial<Objective>
): void {
  doc.transact(() => {
    const yOKRs = doc.getArray<Y.Map<unknown>>(VERSION_YDOC_KEYS.OKRS);
    const okrIndex = findOKRIndex(yOKRs, okrId);

    if (okrIndex >= 0) {
      const yOKR = yOKRs.get(okrIndex) as Y.Map<unknown>;
      const yObjectives = yOKR.get('objectives') as Y.Array<Y.Map<unknown>>;

      for (let i = 0; i < yObjectives.length; i++) {
        const yObjective = yObjectives.get(i) as Y.Map<unknown>;
        if (yObjective.get('id') === objectiveId) {
          applyObjectiveUpdates(yObjective, updates);
          yObjective.set('updatedAt', new Date().toISOString());
          yOKR.set('updatedAt', new Date().toISOString());
          break;
        }
      }
    }
  }, 'local');
}

/**
 * Delete an objective from an OKR
 */
export function yjsDeleteObjective(doc: Y.Doc, okrId: string, objectiveId: string): void {
  doc.transact(() => {
    const yOKRs = doc.getArray<Y.Map<unknown>>(VERSION_YDOC_KEYS.OKRS);
    const okrIndex = findOKRIndex(yOKRs, okrId);

    if (okrIndex >= 0) {
      const yOKR = yOKRs.get(okrIndex) as Y.Map<unknown>;
      const yObjectives = yOKR.get('objectives') as Y.Array<Y.Map<unknown>>;

      for (let i = 0; i < yObjectives.length; i++) {
        const yObjective = yObjectives.get(i) as Y.Map<unknown>;
        if (yObjective.get('id') === objectiveId) {
          yObjectives.delete(i, 1);
          yOKR.set('updatedAt', new Date().toISOString());
          break;
        }
      }
    }
  }, 'local');
}

// ─── Key Result Management ───────────────────────────────────────────────────

/**
 * Add a new key result to an objective
 */
export function yjsAddKeyResult(
  doc: Y.Doc,
  okrId: string,
  objectiveId: string,
  keyResult: KeyResult
): void {
  doc.transact(() => {
    const yOKRs = doc.getArray<Y.Map<unknown>>(VERSION_YDOC_KEYS.OKRS);
    const okrIndex = findOKRIndex(yOKRs, okrId);

    if (okrIndex >= 0) {
      const yOKR = yOKRs.get(okrIndex) as Y.Map<unknown>;
      const yObjectives = yOKR.get('objectives') as Y.Array<Y.Map<unknown>>;

      for (let i = 0; i < yObjectives.length; i++) {
        const yObjective = yObjectives.get(i) as Y.Map<unknown>;
        if (yObjective.get('id') === objectiveId) {
          const yKeyResults = yObjective.get('keyResults') as Y.Array<Y.Map<unknown>>;
          const yKR = keyResultToYMap(keyResult);
          yKeyResults.push([yKR]);
          yObjective.set('updatedAt', new Date().toISOString());
          yOKR.set('updatedAt', new Date().toISOString());
          break;
        }
      }
    }
  }, 'local');
}

/**
 * Update a key result within an objective
 */
export function yjsUpdateKeyResult(
  doc: Y.Doc,
  okrId: string,
  objectiveId: string,
  krId: string,
  updates: Partial<KeyResult>
): void {
  doc.transact(() => {
    const yOKRs = doc.getArray<Y.Map<unknown>>(VERSION_YDOC_KEYS.OKRS);
    const okrIndex = findOKRIndex(yOKRs, okrId);

    if (okrIndex >= 0) {
      const yOKR = yOKRs.get(okrIndex) as Y.Map<unknown>;
      const yObjectives = yOKR.get('objectives') as Y.Array<Y.Map<unknown>>;

      for (let i = 0; i < yObjectives.length; i++) {
        const yObjective = yObjectives.get(i) as Y.Map<unknown>;
        if (yObjective.get('id') === objectiveId) {
          const yKeyResults = yObjective.get('keyResults') as Y.Array<Y.Map<unknown>>;

          for (let j = 0; j < yKeyResults.length; j++) {
            const yKR = yKeyResults.get(j) as Y.Map<unknown>;
            if (yKR.get('id') === krId) {
              applyKeyResultUpdates(yKR, updates);
              yKR.set('updatedAt', new Date().toISOString());
              yObjective.set('updatedAt', new Date().toISOString());
              yOKR.set('updatedAt', new Date().toISOString());
              break;
            }
          }
          break;
        }
      }
    }
  }, 'local');
}

/**
 * Delete a key result from an objective
 */
export function yjsDeleteKeyResult(
  doc: Y.Doc,
  okrId: string,
  objectiveId: string,
  krId: string
): void {
  doc.transact(() => {
    const yOKRs = doc.getArray<Y.Map<unknown>>(VERSION_YDOC_KEYS.OKRS);
    const okrIndex = findOKRIndex(yOKRs, okrId);

    if (okrIndex >= 0) {
      const yOKR = yOKRs.get(okrIndex) as Y.Map<unknown>;
      const yObjectives = yOKR.get('objectives') as Y.Array<Y.Map<unknown>>;

      for (let i = 0; i < yObjectives.length; i++) {
        const yObjective = yObjectives.get(i) as Y.Map<unknown>;
        if (yObjective.get('id') === objectiveId) {
          const yKeyResults = yObjective.get('keyResults') as Y.Array<Y.Map<unknown>>;

          for (let j = 0; j < yKeyResults.length; j++) {
            const yKR = yKeyResults.get(j) as Y.Map<unknown>;
            if (yKR.get('id') === krId) {
              yKeyResults.delete(j, 1);
              yObjective.set('updatedAt', new Date().toISOString());
              yOKR.set('updatedAt', new Date().toISOString());
              break;
            }
          }
          break;
        }
      }
    }
  }, 'local');
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Convert Version object to Y.Map
 */
export function versionToYMap(version: Version): Y.Map<unknown> {
  const yVersion = new Y.Map<unknown>();
  yVersion.set('id', version.id);
  yVersion.set('name', version.name);
  yVersion.set('description', createYText(version.description));
  yVersion.set('color', version.color);
  yVersion.set('status', version.status);
  yVersion.set('type_label', version.type_label);
  yVersion.set('targetDate', version.targetDate || null);
  yVersion.set('started_at', version.started_at || null);
  yVersion.set('completed_at', version.completed_at || null);
  yVersion.set('okrIds', version.okrIds);
  yVersion.set('learnings_content', createYText(version.learnings_content));
  yVersion.set('parent_version_id', version.parent_version_id || null);
  yVersion.set('createdAt', version.createdAt);
  yVersion.set('updatedAt', version.updatedAt);
  yVersion.set('order', version.order);

  return yVersion;
}

/**
 * Convert OKR object to Y.Map
 */
export function okrToYMap(okr: OKR): Y.Map<unknown> {
  const yOKR = new Y.Map<unknown>();
  yOKR.set('id', okr.id);
  yOKR.set('versionId', okr.versionId);
  yOKR.set('name', okr.name ?? 'New OKR');
  yOKR.set('description', okr.description ?? '');
  yOKR.set('status', okr.status ?? 'on_track');
  yOKR.set('dueDate', okr.dueDate ?? null);
  yOKR.set('assignees', okr.assignees ?? []);
  yOKR.set('createdAt', okr.createdAt);
  yOKR.set('updatedAt', okr.updatedAt);

  // Convert objectives array to Y.Array
  const yObjectives = new Y.Array<Y.Map<unknown>>();
  for (const objective of okr.objectives) {
    yObjectives.push([objectiveToYMap(objective)]);
  }
  yOKR.set('objectives', yObjectives);

  return yOKR;
}

/**
 * Convert Objective object to Y.Map
 */
function objectiveToYMap(objective: Objective): Y.Map<unknown> {
  const yObjective = new Y.Map<unknown>();
  yObjective.set('id', objective.id);
  yObjective.set('title', createYText(objective.title));
  yObjective.set('description', createYText(objective.description));
  yObjective.set('createdAt', objective.createdAt);
  yObjective.set('updatedAt', objective.updatedAt);

  // Convert key results array to Y.Array
  const yKeyResults = new Y.Array<Y.Map<unknown>>();
  for (const kr of objective.keyResults) {
    yKeyResults.push([keyResultToYMap(kr)]);
  }
  yObjective.set('keyResults', yKeyResults);

  return yObjective;
}

/**
 * Convert KeyResult object to Y.Map
 */
function keyResultToYMap(kr: KeyResult): Y.Map<unknown> {
  const yKR = new Y.Map<unknown>();
  yKR.set('id', kr.id);
  yKR.set('description', createYText(kr.description));
  yKR.set('targetValue', kr.targetValue);
  yKR.set('currentValue', kr.currentValue);
  yKR.set('unit', kr.unit);
  yKR.set('createdAt', kr.createdAt);
  yKR.set('updatedAt', kr.updatedAt);
  return yKR;
}

/**
 * Apply updates to a Version Y.Map
 */
function applyVersionUpdates(yVersion: Y.Map<unknown>, updates: Partial<Version>): void {
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'description' || key === 'learnings_content') {
      const existing = yVersion.get(key);
      if (existing instanceof Y.Text) {
        setYText(existing, value as string);
      } else {
        yVersion.set(key, createYText(value as string));
      }
    } else if (key !== 'id' && key !== 'createdAt') {
      yVersion.set(key, value);
    }
  }
}

/**
 * Apply updates to an OKR Y.Map
 */
function applyOKRUpdates(yOKR: Y.Map<unknown>, updates: Partial<OKR>): void {
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'objectives' && Array.isArray(value)) {
      // Replace entire objectives array
      const yObjectives = new Y.Array<Y.Map<unknown>>();
      for (const objective of value as Objective[]) {
        yObjectives.push([objectiveToYMap(objective)]);
      }
      yOKR.set('objectives', yObjectives);
    } else if (key !== 'id' && key !== 'createdAt') {
      yOKR.set(key, value);
    }
  }
}

/**
 * Apply updates to an Objective Y.Map
 */
function applyObjectiveUpdates(yObjective: Y.Map<unknown>, updates: Partial<Objective>): void {
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'title' || key === 'description') {
      const existing = yObjective.get(key);
      if (existing instanceof Y.Text) {
        setYText(existing, value as string);
      } else {
        yObjective.set(key, createYText(value as string));
      }
    } else if (key === 'keyResults' && Array.isArray(value)) {
      // Replace entire key results array
      const yKeyResults = new Y.Array<Y.Map<unknown>>();
      for (const kr of value as KeyResult[]) {
        yKeyResults.push([keyResultToYMap(kr)]);
      }
      yObjective.set('keyResults', yKeyResults);
    } else if (key !== 'id' && key !== 'createdAt') {
      yObjective.set(key, value);
    }
  }
}

/**
 * Apply updates to a KeyResult Y.Map
 */
function applyKeyResultUpdates(yKR: Y.Map<unknown>, updates: Partial<KeyResult>): void {
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'description') {
      const existing = yKR.get('description');
      if (existing instanceof Y.Text) {
        setYText(existing, value as string);
      } else {
        yKR.set('description', createYText(value as string));
      }
    } else if (key !== 'id' && key !== 'createdAt') {
      yKR.set(key, value);
    }
  }
}

// ─── Reverse Converters: Y.Map → plain objects ──────────────────────────────

/**
 * Convert a version Y.Map back to a plain Version object.
 * Y.Text fields (description, learnings_content) become strings.
 */
export function yMapToVersion(yVersion: Y.Map<unknown>): Version {
  const obj: Record<string, unknown> = {};
  yVersion.forEach((value, key) => {
    obj[key] = value instanceof Y.Text ? value.toString() : value;
  });
  return obj as unknown as Version;
}

/**
 * Convert an OKR Y.Map back to a plain OKR object,
 * including nested objectives and key results.
 */
export function yMapToOKR(yOKR: Y.Map<unknown>): OKR {
  const obj: Record<string, unknown> = {};
  yOKR.forEach((value, key) => {
    if (key === 'objectives' && value instanceof Y.Array) {
      const objectives: Objective[] = [];
      for (let i = 0; i < value.length; i++) {
        const yObjective = value.get(i);
        if (yObjective instanceof Y.Map) {
          objectives.push(yMapToObjective(yObjective));
        }
      }
      obj[key] = objectives;
    } else {
      obj[key] = value instanceof Y.Text ? value.toString() : value;
    }
  });
  if (!Array.isArray(obj.objectives)) obj.objectives = [];
  return obj as unknown as OKR;
}

function yMapToObjective(yObjective: Y.Map<unknown>): Objective {
  const obj: Record<string, unknown> = {};
  yObjective.forEach((value, key) => {
    if (key === 'keyResults' && value instanceof Y.Array) {
      const keyResults: KeyResult[] = [];
      for (let i = 0; i < value.length; i++) {
        const yKR = value.get(i);
        if (yKR instanceof Y.Map) {
          const kr: Record<string, unknown> = {};
          (yKR as Y.Map<unknown>).forEach((v, k) => {
            kr[k] = v instanceof Y.Text ? v.toString() : v;
          });
          keyResults.push(kr as unknown as KeyResult);
        }
      }
      obj[key] = keyResults;
    } else {
      obj[key] = value instanceof Y.Text ? value.toString() : value;
    }
  });
  if (!Array.isArray(obj.keyResults)) obj.keyResults = [];
  return obj as unknown as Objective;
}

/**
 * Find version index by ID
 */
function findVersionIndex(yVersions: Y.Array<Y.Map<unknown>>, versionId: string): number {
  for (let i = 0; i < yVersions.length; i++) {
    const yVersion = yVersions.get(i) as Y.Map<unknown>;
    if (yVersion.get('id') === versionId) {
      return i;
    }
  }
  return -1;
}

/**
 * Find OKR index by ID
 */
function findOKRIndex(yOKRs: Y.Array<Y.Map<unknown>>, okrId: string): number {
  for (let i = 0; i < yOKRs.length; i++) {
    const yOKR = yOKRs.get(i) as Y.Map<unknown>;
    if (yOKR.get('id') === okrId) {
      return i;
    }
  }
  return -1;
}
