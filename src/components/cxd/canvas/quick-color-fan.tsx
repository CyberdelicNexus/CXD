"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { CanvasElement } from "@/types/canvas-elements";
import { BOARD_HEX_COLORS } from "./canvas-element";

// Quick colour fan: right after an element is placed, a half-circle of colour
// swatches fans out under it so the NEXT click can style it — no toolbar, no
// popover hunting. Clicking anywhere else, Esc, or a few seconds of inactivity
// dismisses it. Borrowed from the connector radial menu's principles: few
// choices, spatially close to the object, one click to apply.

type Swatch = { key: string; preview: string; updates: (el: CanvasElement) => Partial<CanvasElement> };

const SHAPE_SWATCHES: Array<[string, string, string]> = [
  // [key, fill gradient, ring gradient]
  ["aurora", "linear-gradient(135deg, #3b1466, #0c2d5c)", "linear-gradient(135deg, #c084fc, #22d3ee)"],
  ["rose", "linear-gradient(135deg, #4a0d33, #2a0f4d)", "linear-gradient(135deg, #f472b6, #a78bfa)"],
  ["emerald", "linear-gradient(135deg, #063b34, #0b2c4a)", "linear-gradient(135deg, #34d399, #22d3ee)"],
  ["sunset", "linear-gradient(135deg, #4a1d0a, #3b0d2e)", "linear-gradient(135deg, #fbbf24, #f472b6)"],
  ["ocean", "linear-gradient(135deg, #0b2a55, #081a33)", "linear-gradient(135deg, #60a5fa, #22d3ee)"],
  ["mono", "linear-gradient(135deg, #1f1f24, #0e0e12)", "linear-gradient(135deg, #e4e4e7, #71717a)"],
  ["outline", "transparent", "linear-gradient(135deg, #c084fc, #22d3ee)"],
];

const NOTE_SWATCHES = [
  "linear-gradient(135deg, #2A0A3D 0%, #4B1B6B 50%, #0B2C5A 100%)",
  "linear-gradient(135deg, #0B1B2B 0%, #123A5A 100%)",
  "linear-gradient(135deg, #0F2230 0%, #0F3A3A 100%)",
  "linear-gradient(135deg, #2B0F2A 0%, #3B1842 100%)",
  "linear-gradient(135deg, #3a1f0a 0%, #4a2a12 100%)",
  "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
];

const TEXT_SWATCHES: Array<[string, string]> = [
  // [key, colour or gradient]
  ["white", "#ffffff"],
  ["violet", "#c084fc"],
  ["cyan", "#22d3ee"],
  ["green", "#34d399"],
  ["pink", "#f472b6"],
  ["amber", "#fbbf24"],
  ["grad", "linear-gradient(90deg, #A855F7, #22D3EE)"],
];

const TINTS: Array<[NonNullable<Extract<CanvasElement, { type: "container" }>["tintColor"]>, string]> = [
  ["violet", "#a855f7"],
  ["ocean", "#3b82f6"],
  ["emerald", "#10b981"],
  ["sunset", "#f97316"],
  ["rose", "#f43f5e"],
  ["glacier", "#67e8f9"],
];

const EXPERIENCE_SWATCHES = [
  "linear-gradient(135deg, #2A0A3D 0%, #4B1B6B 50%, #0B2C5A 100%)",
  "linear-gradient(135deg, #0B1B2B 0%, #123A5A 100%)",
  "linear-gradient(135deg, #0F2230 0%, #0F3A3A 100%)",
  "linear-gradient(135deg, #2B0F2A 0%, #3B1842 100%)",
  "linear-gradient(135deg, #3a1f0a 0%, #4a2a12 100%)",
  "linear-gradient(135deg, #1B1024 0%, #351A45 100%)",
  "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
];

export function swatchesFor(el: CanvasElement): Swatch[] {
  switch (el.type) {
    case "experienceBlock":
      return EXPERIENCE_SWATCHES.map((bg, i) => ({
        key: `exp-${i}`,
        preview: bg,
        updates: (e) => ({ style: { ...((e as { style?: object }).style || {}), bgColor: bg } }) as Partial<CanvasElement>,
      }));
    case "board":
      return BOARD_HEX_COLORS.slice(0, 7).map((c) => ({
        key: c.id,
        preview: c.gradient,
        updates: () => ({ hexColor: c.gradient }) as Partial<CanvasElement>,
      }));
    case "shape":
      return SHAPE_SWATCHES.map(([key, fill, ring]) => ({
        key,
        preview: fill === "transparent" ? `radial-gradient(circle, transparent 55%, #c084fc 58%)` : fill,
        updates: (e) => ({
          style: {
            ...((e as { style?: object }).style || {}),
            bgColor: fill,
            fillOpacity: fill === "transparent" ? 0 : 90,
            borderColor: ring,
            borderWidth: 2,
          },
        }) as Partial<CanvasElement>,
      }));
    case "freeform":
      return NOTE_SWATCHES.map((bg, i) => ({
        key: `note-${i}`,
        preview: bg,
        updates: (e) => ({ style: { ...((e as { style?: object }).style || {}), bgColor: bg } }) as Partial<CanvasElement>,
      }));
    case "text":
      return TEXT_SWATCHES.map(([key, c]) => ({
        key,
        preview: c,
        // Text gradients live in style.bgColor; a solid colour clears it ('' not
        // undefined: the doc serializer ignores undefined values).
        updates: (e) => ({
          style: {
            ...((e as { style?: object }).style || {}),
            ...(c.startsWith("linear-gradient") ? { bgColor: c } : { textColor: c, bgColor: "" }),
          },
        }) as Partial<CanvasElement>,
      }));
    case "container":
      return TINTS.map(([tint, hex]) => ({
        key: tint,
        preview: hex,
        updates: () => ({ tintColor: tint }) as Partial<CanvasElement>,
      }));
    default:
      return [];
  }
}

export function QuickColorFan({
  element,
  canvasPosition,
  canvasZoom,
  onApply,
  onClose,
}: {
  element: CanvasElement;
  canvasPosition: { x: number; y: number };
  canvasZoom: number;
  onApply: (updates: Partial<CanvasElement>) => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const swatches = swatchesFor(element);

  // Dismiss on outside press (without swallowing it), Esc, or inactivity.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const t = window.setTimeout(onClose, 7000);
    document.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (swatches.length === 0) return null;

  const cx = canvasPosition.x + (element.x + element.width / 2) * canvasZoom;
  const bottom = canvasPosition.y + (element.y + element.height) * canvasZoom;
  const top = canvasPosition.y + element.y * canvasZoom;
  // Fan below the element; flip above when too close to the bottom edge.
  const flip = typeof window !== "undefined" && bottom + 110 > window.innerHeight - 64;
  // Tall elements (experience blocks) can run off-screen: keep the fan in view.
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cy = Math.max(110, Math.min(vh - 120, flip ? top - 14 : bottom + 14));
  const R = 62;
  const n = swatches.length;

  return (
    <div
      ref={rootRef}
      className="absolute z-[9999]"
      style={{ left: cx, top: cy, width: 0, height: 0 }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {swatches.map((sw, i) => {
        // Spread across a half circle (15°…165°), downward or upward.
        const t = n === 1 ? 0.5 : i / (n - 1);
        const ang = ((15 + t * 150) * Math.PI) / 180;
        const x = Math.cos(ang) * R;
        const y = Math.sin(ang) * R * (flip ? -1 : 1);
        return (
          <button
            key={sw.key}
            type="button"
            className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-2 border-white/25 shadow-[0_4px_14px_rgba(0,0,0,0.5)] hover:scale-125 hover:border-white/70 transition-transform animate-in fade-in zoom-in-50 duration-200"
            style={{
              left: -x,
              top: y,
              background: sw.preview,
              animationDelay: `${i * 25}ms`,
              animationFillMode: "both",
            }}
            title="Apply colour"
            onClick={() => {
              onApply(sw.updates(element));
              onClose();
            }}
          />
        );
      })}
      <button
        type="button"
        className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-zinc-900/90 border border-white/15 text-white/50 hover:text-white flex items-center justify-center animate-in fade-in duration-200"
        style={{ left: 0, top: flip ? -8 : 8 }}
        onClick={onClose}
        title="Keep default colour"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
