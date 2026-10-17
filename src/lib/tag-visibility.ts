// Whether Hypercube tag badges stay pinned above every tagged element.
//
// A USER-level view preference (not project data), so it lives in localStorage
// and is NOT written to the Y.Doc — one collaborator hiding tags must not hide
// them for everyone. Off by default: on a dense diagram the badges cover the
// nodes they belong to, so they appear on hover unless the user pins them.

import { useSyncExternalStore } from 'react';

const LS_KEY = 'cxd:show-element-tags';
const listeners = new Set<() => void>();

function read(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(LS_KEY) === '1';
  } catch {
    return false;
  }
}

let current: boolean | null = null;
const getSnapshot = () => (current ??= read());

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Keep other browser tabs in step.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== LS_KEY) return;
    current = read();
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function toggleTagVisibility(): void {
  current = !getSnapshot();
  try {
    window.localStorage.setItem(LS_KEY, current ? '1' : '0');
  } catch {
    // Storage full / disabled — the preference still holds for this session.
  }
  listeners.forEach((l) => l());
}

/** True when tag badges are pinned on; false means they show on hover only. */
export function useTagVisibility(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
