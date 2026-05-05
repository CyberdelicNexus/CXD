/**
 * Y.UndoManager wrappers for CXD Canvas
 *
 * Two separate undo managers:
 * - Canvas: tracks elements + edges (Ctrl+Z on canvas)
 * - Design: tracks design field maps (Ctrl+Z in form context)
 *
 * Only local changes are tracked (trackedOrigins: ['local']).
 * Remote changes from other users are never undone.
 * captureTimeout groups rapid changes into a single undo step.
 */

import * as Y from 'yjs';
import { YDOC_KEYS } from './y-doc-types';

const CAPTURE_TIMEOUT_MS = 500;
const LOCAL_ORIGIN = 'local';

/**
 * Creates an UndoManager that tracks canvas elements and edges.
 * This handles undo/redo for element add/move/delete/resize and edge changes.
 */
export function createCanvasUndoManager(doc: Y.Doc): Y.UndoManager {
  const yElements = doc.getMap(YDOC_KEYS.ELEMENTS);
  const yEdges = doc.getMap(YDOC_KEYS.EDGES);

  return new Y.UndoManager([yElements, yEdges], {
    captureTimeout: CAPTURE_TIMEOUT_MS,
    trackedOrigins: new Set([LOCAL_ORIGIN]),
  });
}

/**
 * Creates an UndoManager that tracks design fields (text + number sections).
 * This handles undo/redo for form fields in the wizard/inspector.
 */
export function createDesignUndoManager(doc: Y.Doc): Y.UndoManager {
  const trackedTypes: (Y.Map<unknown> | Y.Text | Y.Array<unknown>)[] = [
    doc.getMap(YDOC_KEYS.META),
    doc.getMap(YDOC_KEYS.INTENTION_CORE),
    doc.getMap(YDOC_KEYS.DESIRED_CHANGE),
    doc.getMap(YDOC_KEYS.HUMAN_CONTEXT),
    doc.getMap(YDOC_KEYS.CONTEXT_AND_MEANING),
    doc.getMap(YDOC_KEYS.STATE_MAPPING),
    doc.getMap(YDOC_KEYS.TRAIT_MAPPING),
    doc.getMap(YDOC_KEYS.SENSORY_DOMAINS),
    doc.getMap(YDOC_KEYS.PRESENCE_TYPES),
    doc.getArray(YDOC_KEYS.REALITY_PLANES_V2),
    doc.getArray(YDOC_KEYS.EXPERIENCE_FLOW_STAGES),
    doc.getText(YDOC_KEYS.EXPERIENCE_FLOW_DESCRIPTION),
  ];

  return new Y.UndoManager(trackedTypes, {
    captureTimeout: CAPTURE_TIMEOUT_MS,
    trackedOrigins: new Set([LOCAL_ORIGIN]),
  });
}
