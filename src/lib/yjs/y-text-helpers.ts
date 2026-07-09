/**
 * Y.Text Utility Functions
 *
 * Helpers for working with Yjs Y.Text instances — the CRDT type that enables
 * character-level concurrent editing of text fields.
 */

import * as Y from 'yjs';

/**
 * Convert a Y.Text instance to a plain string.
 */
export function yTextToString(ytext: Y.Text): string {
  return ytext.toString();
}

/**
 * Replace the entire content of a Y.Text with a new string value.
 * Performs a delete-all + insert to fully replace.
 * No-ops if the value is already identical (avoids unnecessary CRDT operations).
 */
export function setYText(ytext: Y.Text, value: string): void {
  // Coerce null/undefined/non-string to '' — legacy docs may carry undefined
  // for fields added after the record was first serialized.
  const next = typeof value === 'string' ? value : '';
  const current = ytext.toString();
  if (current === next) return;
  ytext.delete(0, ytext.length);
  if (next.length > 0) {
    ytext.insert(0, next);
  }
}

/**
 * Observe a Y.Text instance and call the callback with the new string value
 * whenever it changes. Returns an unsubscribe function.
 */
export function observeYText(
  ytext: Y.Text,
  callback: (value: string) => void
): () => void {
  const handler = () => {
    callback(ytext.toString());
  };
  ytext.observe(handler);
  return () => ytext.unobserve(handler);
}

/**
 * Create a Y.Text instance initialized with the given string value.
 * Useful when building Y.Map entries for elements.
 */
export function createYText(value: string): Y.Text {
  const ytext = new Y.Text();
  // Coerce null/undefined/non-string to '' — legacy records (e.g. versions/OKRs
  // stored before a text field existed) can deserialize with undefined here.
  const text = typeof value === 'string' ? value : '';
  if (text.length > 0) {
    ytext.insert(0, text);
  }
  return ytext;
}
