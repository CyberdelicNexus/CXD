/**
 * Element & Edge Serializers
 *
 * Converts between plain CanvasElement/CanvasEdge objects and Yjs Y.Map structures.
 * Text content fields use Y.Text for character-level CRDT merging.
 * Nested objects (style, taskMetadata) use nested Y.Map for per-property merging.
 */

import * as Y from 'yjs';
import type { CanvasElement, CanvasEdge, ElementStyle, TaskMetadata } from '@/types/canvas-elements';
import { ELEMENT_YTEXT_FIELDS, ELEMENT_NESTED_FIELDS, EDGE_NESTED_FIELDS } from './y-doc-types';
import { createYText, yTextToString } from './y-text-helpers';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a plain object to a Y.Map, recursively handling nested objects.
 * Does NOT handle Y.Text — that's done explicitly for known text fields.
 */
function plainObjectToYMap(obj: Record<string, unknown>): Y.Map<unknown> {
  const ymap = new Y.Map<unknown>();
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      ymap.set(key, plainObjectToYMap(value as Record<string, unknown>));
    } else if (Array.isArray(value)) {
      // Store arrays as JSON-serialized strings for simple nested arrays
      // (e.g., subtasks, dependencies, customTags, hypercubeTags)
      ymap.set(key, JSON.stringify(value));
    } else {
      ymap.set(key, value);
    }
  }
  return ymap;
}

/**
 * Convert a Y.Map back to a plain object, recursively handling nested Y.Maps.
 * Y.Text instances are converted to strings.
 * JSON-stringified arrays are parsed back to arrays.
 */
function yMapToPlainObject(ymap: Y.Map<unknown>): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  ymap.forEach((value, key) => {
    if (value instanceof Y.Text) {
      obj[key] = yTextToString(value);
    } else if (value instanceof Y.Map) {
      obj[key] = yMapToPlainObject(value);
    } else if (ELEMENT_ARRAY_FIELDS.has(key)) {
      // Parse JSON-stringified arrays (subtasks, dependencies, customTags)
      obj[key] = tryParseJsonArray(value);
    } else {
      obj[key] = value;
    }
  });
  return obj;
}

/**
 * Try to parse a JSON-serialized array string back to an array.
 * Returns the original value if parsing fails.
 */
function tryParseJsonArray(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : value;
  } catch {
    return value;
  }
}

// Set of fields that are text content (should be Y.Text)
const elementYTextFieldSet = new Set<string>(ELEMENT_YTEXT_FIELDS);

// Set of fields that are nested objects (should be nested Y.Map)
const elementNestedFieldSet = new Set<string>(ELEMENT_NESTED_FIELDS);

// Fields that are JSON-serialized arrays
const ELEMENT_ARRAY_FIELDS = new Set([
  'hypercubeTags',
  'subtasks',      // inside taskMetadata
  'dependencies',  // inside taskMetadata
  'customTags',    // inside taskMetadata
  'cells',         // table: 2D grid of TableCell (whole-grid replace on edit)
  'rowColors',     // table: per-row solid background
  'colColors',     // table: per-column solid background
  'rowGradient',   // table: per-row continuous horizontal gradient base color
  'colGradient',   // table: per-column continuous vertical gradient base color
  'colWidths',     // table: per-column widths (px, JSON round-trip)
  'rowHeights',    // table: per-row heights (px, JSON round-trip)
]);

// ─── Canvas Element Serialization ────────────────────────────────────────────

/**
 * Convert a CanvasElement to a Y.Map for storage in the Y.Doc "elements" map.
 *
 * - Text content fields (content, noteTitle, noteBody, label, title) → Y.Text
 * - Nested objects (style, taskMetadata, imageMeta, etc.) → nested Y.Map
 * - Arrays (hypercubeTags) → JSON string
 * - All other scalars → direct Y.Map entries
 */
export function canvasElementToYMap(element: CanvasElement): Y.Map<unknown> {
  const yEl = new Y.Map<unknown>();

  for (const [key, value] of Object.entries(element)) {
    if (value === undefined) continue;

    if (elementYTextFieldSet.has(key) && typeof value === 'string') {
      // Text content → Y.Text for character-level CRDT
      yEl.set(key, createYText(value));
    } else if (elementNestedFieldSet.has(key) && value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Nested object → Y.Map for per-property merging
      yEl.set(key, plainObjectToYMap(value as Record<string, unknown>));
    } else if (Array.isArray(value)) {
      // Arrays → JSON string (simple serialization for now)
      yEl.set(key, JSON.stringify(value));
    } else {
      // Scalar values (number, string, boolean, null)
      yEl.set(key, value);
    }
  }

  return yEl;
}

/**
 * Convert a Y.Map back to a plain CanvasElement object.
 *
 * Reconstructs the discriminated union by reading the "type" field.
 * Y.Text → string, nested Y.Map → plain object, JSON arrays → parsed arrays.
 */
export function yMapToCanvasElement(yEl: Y.Map<unknown>): CanvasElement {
  const obj: Record<string, unknown> = {};

  yEl.forEach((value, key) => {
    if (value instanceof Y.Text) {
      obj[key] = yTextToString(value);
    } else if (value instanceof Y.Map) {
      obj[key] = yMapToPlainObject(value);
    } else if (ELEMENT_ARRAY_FIELDS.has(key)) {
      obj[key] = tryParseJsonArray(value);
    } else {
      obj[key] = value;
    }
  });

  return obj as unknown as CanvasElement;
}

/**
 * Apply partial updates to an existing element Y.Map.
 * Only modifies the specified keys, preserving other properties.
 * Handles Y.Text and nested Y.Map correctly.
 */
export function applyElementUpdates(
  yEl: Y.Map<unknown>,
  updates: Partial<CanvasElement>
): void {
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;

    if (elementYTextFieldSet.has(key) && typeof value === 'string') {
      const existing = yEl.get(key);
      if (existing instanceof Y.Text) {
        // Update existing Y.Text in place
        const current = existing.toString();
        if (current !== value) {
          existing.delete(0, existing.length);
          if (value.length > 0) {
            existing.insert(0, value);
          }
        }
      } else {
        // First time setting a text field — create Y.Text
        yEl.set(key, createYText(value));
      }
    } else if (elementNestedFieldSet.has(key) && value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const existing = yEl.get(key);
      if (existing instanceof Y.Map) {
        // Merge into existing nested Y.Map
        for (const [sk, sv] of Object.entries(value as Record<string, unknown>)) {
          if (sv === undefined) continue;
          existing.set(sk, sv);
        }
      } else {
        // Replace with new Y.Map
        yEl.set(key, plainObjectToYMap(value as Record<string, unknown>));
      }
    } else if (Array.isArray(value)) {
      yEl.set(key, JSON.stringify(value));
    } else {
      yEl.set(key, value);
    }
  }
}

// ─── Canvas Edge Serialization ───────────────────────────────────────────────

const edgeNestedFieldSet = new Set<string>(EDGE_NESTED_FIELDS);

/**
 * Convert a CanvasEdge to a Y.Map for storage in the Y.Doc "edges" map.
 *
 * - Nested objects (style, label, bend) → nested Y.Map
 * - label.text → Y.Text for concurrent label editing
 * - All other scalars → direct entries
 */
export function canvasEdgeToYMap(edge: CanvasEdge): Y.Map<unknown> {
  const yEdge = new Y.Map<unknown>();

  for (const [key, value] of Object.entries(edge)) {
    if (value === undefined) continue;

    if (key === 'label' && value !== null && typeof value === 'object') {
      // Special handling for label — text field gets Y.Text
      const labelObj = value as CanvasEdge['label'];
      if (labelObj) {
        const yLabel = new Y.Map<unknown>();
        for (const [lk, lv] of Object.entries(labelObj)) {
          if (lv === undefined) continue;
          if (lk === 'text' && typeof lv === 'string') {
            yLabel.set(lk, createYText(lv));
          } else {
            yLabel.set(lk, lv);
          }
        }
        yEdge.set(key, yLabel);
      }
    } else if (edgeNestedFieldSet.has(key) && value !== null && typeof value === 'object' && !Array.isArray(value)) {
      yEdge.set(key, plainObjectToYMap(value as Record<string, unknown>));
    } else {
      yEdge.set(key, value);
    }
  }

  return yEdge;
}

/**
 * Convert a Y.Map back to a plain CanvasEdge object.
 */
export function yMapToCanvasEdge(yEdge: Y.Map<unknown>): CanvasEdge {
  const obj: Record<string, unknown> = {};

  yEdge.forEach((value, key) => {
    if (value instanceof Y.Text) {
      obj[key] = yTextToString(value);
    } else if (value instanceof Y.Map) {
      obj[key] = yMapToPlainObject(value);
    } else {
      obj[key] = value;
    }
  });

  return obj as unknown as CanvasEdge;
}

/**
 * Apply partial updates to an existing edge Y.Map.
 */
export function applyEdgeUpdates(
  yEdge: Y.Map<unknown>,
  updates: Partial<CanvasEdge>
): void {
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;

    if (key === 'label' && value !== null && typeof value === 'object') {
      const existing = yEdge.get(key);
      if (existing instanceof Y.Map) {
        for (const [lk, lv] of Object.entries(value as Record<string, unknown>)) {
          if (lv === undefined) continue;
          if (lk === 'text' && typeof lv === 'string') {
            const existingText = existing.get('text');
            if (existingText instanceof Y.Text) {
              const current = existingText.toString();
              if (current !== lv) {
                existingText.delete(0, existingText.length);
                if ((lv as string).length > 0) {
                  existingText.insert(0, lv as string);
                }
              }
            } else {
              existing.set('text', createYText(lv as string));
            }
          } else {
            existing.set(lk, lv);
          }
        }
      } else {
        // Build new label Y.Map
        const labelObj = value as CanvasEdge['label'];
        if (labelObj) {
          const yLabel = new Y.Map<unknown>();
          for (const [lk, lv] of Object.entries(labelObj)) {
            if (lv === undefined) continue;
            if (lk === 'text' && typeof lv === 'string') {
              yLabel.set(lk, createYText(lv));
            } else {
              yLabel.set(lk, lv);
            }
          }
          yEdge.set(key, yLabel);
        }
      }
    } else if (edgeNestedFieldSet.has(key) && value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const existing = yEdge.get(key);
      if (existing instanceof Y.Map) {
        for (const [sk, sv] of Object.entries(value as Record<string, unknown>)) {
          if (sv === undefined) continue;
          existing.set(sk, sv);
        }
      } else {
        yEdge.set(key, plainObjectToYMap(value as Record<string, unknown>));
      }
    } else {
      yEdge.set(key, value);
    }
  }
}
