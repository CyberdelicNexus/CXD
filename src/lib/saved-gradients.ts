"use client";

import { useEffect, useState, useCallback } from "react";

// User-saved gradients, shown as swatches in every colour menu. Stored per
// browser (localStorage); a custom event keeps every open menu in sync.

export interface SavedGradient {
  id: string;
  css: string;
}

const KEY = "cxd:saved-gradients";
const EVENT = "cxd:saved-gradients-changed";
const MAX = 30;

function read(): SavedGradient[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((g) => g && typeof g.css === "string") : [];
  } catch {
    return [];
  }
}

function write(list: SavedGradient[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage full / blocked: the gradient just isn't kept */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function saveGradient(css: string): boolean {
  const list = read();
  if (list.some((g) => g.css === css)) return false;
  write([{ id: `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, css }, ...list]);
  return true;
}

export function removeSavedGradient(id: string) {
  write(read().filter((g) => g.id !== id));
}

export function useSavedGradients(): SavedGradient[] {
  const [list, setList] = useState<SavedGradient[]>([]);
  const refresh = useCallback(() => setList(read()), []);
  useEffect(() => {
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);
  return list;
}
