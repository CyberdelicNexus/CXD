/**
 * Encoding Utilities for Yjs Binary Transport
 *
 * Supabase Realtime Broadcast only supports JSON payloads,
 * so we encode Yjs binary updates (Uint8Array) as base64 strings.
 */

/**
 * Convert a Uint8Array to a base64 string for JSON transport.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert a base64 string back to a Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
