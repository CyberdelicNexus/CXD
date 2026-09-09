// Shape style presets — reusable fill / border / text-font combinations.
//
// Presets are a USER-level preference (not project data), so they live in
// localStorage, shared across every project, and are NOT written to the Y.Doc.
// A tiny pub/sub keeps every open colour popover in sync when a preset is added
// or removed.

import { useEffect, useState } from 'react';

export interface ShapeStylePreset {
  id: string;
  name?: string;
  builtIn?: boolean;
  // A partial of ShapeElement['style'] — applied by merging into the element's style.
  style: {
    bgColor?: string;
    borderColor?: string;
    borderWidth?: number;
    fillOpacity?: number;
    borderStyle?: 'solid' | 'dashed' | 'dotted';
    textColor?: string;
    fontFamily?: string;
  };
}

// The screenshot preset: dark translucent fill + a thin purple→cyan gradient ring,
// plus a couple of tasteful defaults.
export const BUILT_IN_PRESETS: ShapeStylePreset[] = [
  {
    id: 'builtin-gradient-ring',
    name: 'Gradient Ring',
    builtIn: true,
    style: {
      bgColor: '#141225',
      fillOpacity: 35,
      borderColor: 'linear-gradient(135deg, #a855f7, #22d3ee)',
      borderWidth: 2,
      borderStyle: 'solid',
    },
  },
  {
    id: 'builtin-solid-violet',
    name: 'Violet',
    builtIn: true,
    style: { bgColor: '#a855f7', fillOpacity: 100, borderColor: 'transparent', borderWidth: 0 },
  },
  {
    id: 'builtin-outline',
    name: 'Outline',
    builtIn: true,
    style: {
      bgColor: 'transparent',
      fillOpacity: 0,
      borderColor: '#e4e4e7',
      borderWidth: 2,
      borderStyle: 'solid',
      textColor: '#e4e4e7',
    },
  },
];

const LS_KEY = 'cxd:shape-style-presets';
const listeners = new Set<() => void>();

function readSaved(): ShapeStylePreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ShapeStylePreset[]) : [];
  } catch {
    return [];
  }
}

function writeSaved(presets: ShapeStylePreset[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(presets));
  } catch {
    // Storage full / disabled — presets are best-effort, never block the UI.
  }
  listeners.forEach((l) => l());
}

export function addStylePreset(style: ShapeStylePreset['style']): void {
  // id is derived from the saved set length + content, not Date.now(), so it stays
  // deterministic-enough without a clock (Math.random is fine here — user action).
  const saved = readSaved();
  const id = `user-${saved.length}-${Math.round(Math.random() * 1e6)}`;
  writeSaved([...saved, { id, style }]);
}

export function removeStylePreset(id: string): void {
  writeSaved(readSaved().filter((p) => p.id !== id));
}

/** Built-in presets first, then the user's saved ones. Re-renders on any change. */
export function useShapeStylePresets(): {
  presets: ShapeStylePreset[];
  saved: ShapeStylePreset[];
} {
  const [saved, setSaved] = useState<ShapeStylePreset[]>(() => readSaved());
  useEffect(() => {
    const update = () => setSaved(readSaved());
    listeners.add(update);
    // Sync across browser tabs too.
    const onStorage = (e: StorageEvent) => { if (e.key === LS_KEY) update(); };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(update);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return { presets: [...BUILT_IN_PRESETS, ...saved], saved };
}
