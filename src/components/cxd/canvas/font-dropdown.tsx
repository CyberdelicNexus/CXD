"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FONT_FAMILIES } from "@/types/canvas-elements";

const LIST_W = 176;
const LIST_MAX_H = 224;

/**
 * Compact font picker: a small trigger plus a fixed-size scrollable list
 * portaled to <body>, so no ancestor (canvas overflow, stacking contexts,
 * transformed layers) can clip or shrink it.
 */
export function FontDropdown({
  value,
  onChange,
  open,
  onOpenChange,
  className,
  title = "Font",
  keepEditorFocus = false,
}: {
  value: string | undefined;
  onChange: (fontFamily: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
  title?: string;
  /** Prevent mousedown from stealing focus (rich-text bars keep their selection). */
  keepEditorFocus?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const current = value || "inherit";
  const label = FONT_FAMILIES.find((f) => f.value === current)?.label ?? "Font";

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const placeAbove = below < LIST_MAX_H + 12 && r.top > below;
    const top = placeAbove ? Math.max(8, r.top - LIST_MAX_H - 6) : r.bottom + 6;
    const left = Math.max(8, Math.min(window.innerWidth - LIST_W - 8, r.right - LIST_W));
    setPos({ left, top });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (listRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          "h-6 max-w-[110px] px-1.5 rounded-md bg-white/5 border border-white/10 text-[11px] text-white/80 hover:bg-white/10 inline-flex items-center gap-1",
          className,
        )}
        style={{ fontFamily: current !== "inherit" ? current : undefined }}
        onMouseDown={keepEditorFocus ? (e) => e.preventDefault() : undefined}
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(!open);
        }}
        title={title}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-60" />
      </button>
      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={listRef}
            className="fixed z-[10060] overflow-y-auto overscroll-contain rounded-lg bg-zinc-900 border border-white/10 shadow-2xl p-1"
            style={{ left: pos.left, top: pos.top, width: LIST_W, maxHeight: LIST_MAX_H }}
            data-prevent-canvas-wheel="true"
            onMouseDown={(e) => {
              e.stopPropagation();
              if (keepEditorFocus) e.preventDefault();
            }}
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            {FONT_FAMILIES.map((f) => (
              <button
                key={f.value}
                type="button"
                className={cn(
                  "w-full text-left px-2 py-1 rounded text-sm text-white/85 hover:bg-white/10 truncate",
                  current === f.value && "bg-white/15",
                )}
                style={{ fontFamily: f.value === "inherit" ? undefined : f.value }}
                onClick={() => {
                  onChange(f.value);
                  onOpenChange(false);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
