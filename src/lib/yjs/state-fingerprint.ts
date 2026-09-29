/**
 * Fingerprint of a persisted yjs_state, stamped into project_data by every
 * writer that saves both columns. On load, a project_data carrying the SAME
 * fingerprint as the loaded yjs_state provably descends from it, so any element
 * that differs between the two was edited later through a project_data-only
 * save and must not be reverted (see reconcileCanvasIntoYDoc). A different
 * fingerprint means project_data was rewritten from an older copy (e.g. a stale
 * dashboard tab), so the doc stays authoritative.
 */
export const YJS_FINGERPRINT_FIELD = 'yjsStateFingerprint' as const;

/** FNV-1a (32-bit) over the base64 string, plus its length. */
export function fingerprintYjsState(base64: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < base64.length; i++) {
    h ^= base64.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${base64.length.toString(36)}-${(h >>> 0).toString(36)}`;
}
