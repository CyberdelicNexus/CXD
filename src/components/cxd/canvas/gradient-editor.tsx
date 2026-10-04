"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftRight, Minus, Pipette, Plus, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildGradientCss,
  defaultGradient,
  hexToRgb,
  hsvToHex,
  isGradientCss,
  newStop,
  parseGradient,
  previewBarCss,
  reverseStops,
  rgbToHsv,
  sortStops,
  svgGeometry,
  stopCss,
  type GradientKind,
  type GradientModel,
  type GradientStop,
} from "@/lib/gradient";

const CHECKER =
  "repeating-conic-gradient(#8884 0% 25%, transparent 0% 50%) 50% / 10px 10px";

/** Pointer-driven drag on an element: reports 0-1 coordinates inside its box. */
function useBoxDrag(onMove: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const move = useRef(onMove);
  move.current = onMove;
  const onPointerDown = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    el.setPointerCapture(e.pointerId);
    const apply = (ev: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      move.current(
        Math.max(0, Math.min(1, (ev.clientX - r.left) / Math.max(1, r.width))),
        Math.max(0, Math.min(1, (ev.clientY - r.top) / Math.max(1, r.height))),
      );
    };
    apply(e.nativeEvent);
    const mv = (ev: PointerEvent) => apply(ev);
    const up = () => {
      el.removeEventListener("pointermove", mv);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", mv);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
  return { ref, onPointerDown };
}

function Slider({
  value,
  onChange,
  background,
  thumbColor,
  className,
}: {
  value: number; // 0-1
  onChange: (v: number) => void;
  background: string;
  thumbColor?: string;
  className?: string;
}) {
  const drag = useBoxDrag((x) => onChange(x));
  return (
    <div
      ref={drag.ref}
      onPointerDown={drag.onPointerDown}
      className={cn("relative h-3 rounded-full cursor-pointer touch-none", className)}
      style={{ background }}
    >
      <span
        className="absolute top-1/2 w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
        style={{ left: `${value * 100}%`, background: thumbColor }}
      />
    </div>
  );
}

/** Saturation/value square + hue + alpha for one stop. */
function ColorSurface({
  color,
  alpha,
  onChange,
}: {
  color: string;
  alpha: number;
  onChange: (color: string, alpha: number) => void;
}) {
  const { r, g, b } = hexToRgb(color);
  const [hsv, setHsv] = useState(() => rgbToHsv(r, g, b));
  // Keep hue/saturation when the colour changes from outside (e.g. selecting
  // another stop); grey/black collapse them otherwise.
  const lastHex = useRef(color);
  useEffect(() => {
    if (color.toLowerCase() !== lastHex.current.toLowerCase()) {
      lastHex.current = color;
      const c = hexToRgb(color);
      setHsv(rgbToHsv(c.r, c.g, c.b));
    }
  }, [color]);

  const emit = (h: number, s: number, v: number, a: number) => {
    const hex = hsvToHex(h, s, v);
    lastHex.current = hex;
    setHsv({ h, s, v });
    onChange(hex, a);
  };
  const sv = useBoxDrag((x, y) => emit(hsv.h, x, 1 - y, alpha));
  const pure = hsvToHex(hsv.h, 1, 1);

  return (
    <div className="space-y-2">
      <div
        ref={sv.ref}
        onPointerDown={sv.onPointerDown}
        className="relative h-28 rounded-lg cursor-crosshair touch-none"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pure})` }}
      >
        <span
          className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: color }}
        />
      </div>
      <Slider
        value={hsv.h / 360}
        onChange={(v) => emit(Math.min(359.9, v * 360), hsv.s || 0.01, hsv.v || 0.01, alpha)}
        background="linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)"
        thumbColor={pure}
      />
      <div className="relative">
        <div className="absolute inset-0 rounded-full" style={{ background: CHECKER }} />
        <Slider
          value={alpha / 100}
          onChange={(v) => emit(hsv.h, hsv.s, hsv.v, Math.round(v * 100))}
          background={`linear-gradient(to right, rgba(${r},${g},${b},0), ${color})`}
          className="relative"
        />
      </div>
    </div>
  );
}

function Segmented({
  value,
  onChange,
}: {
  value: GradientKind;
  onChange: (v: GradientKind) => void;
}) {
  return (
    <div className="flex p-0.5 rounded-lg bg-white/5 border border-white/10">
      {(["linear", "radial"] as const).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={cn(
            "px-3 py-1 rounded-md text-xs capitalize transition-colors",
            value === k ? "bg-violet-600 text-white" : "text-white/60 hover:text-white",
          )}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

const iconBtn = "h-7 w-7 rounded-md flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors";

/**
 * Full gradient editor: linear/radial, draggable colour stops with position,
 * colour and transparency, reverse, rotate, angle / centre. Calls onChange with
 * a CSS gradient string on every edit (live). `compact` drops the typed fields
 * so nothing inside can take keyboard focus (used while editing text in a shape,
 * where losing focus would end the edit).
 */
export function GradientEditor({
  value,
  onChange,
  compact = false,
  fallbackColor,
}: {
  value: string | undefined;
  onChange: (css: string) => void;
  compact?: boolean;
  fallbackColor?: string;
}) {
  const [model, setModel] = useState<GradientModel>(() => parseGradient(value) ?? defaultGradient(fallbackColor));
  const [selId, setSelId] = useState<string>(() => model.stops[0]?.id);
  const emitted = useRef<string | null>(null);

  const commit = useCallback(
    (next: GradientModel) => {
      setModel(next);
      const css = buildGradientCss(next);
      emitted.current = css;
      onChange(css);
    },
    [onChange],
  );

  const sel = model.stops.find((s) => s.id === selId) ?? model.stops[0];
  const patchStop = (id: string, patch: Partial<GradientStop>) =>
    commit({ ...model, stops: model.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  const removeStop = (id: string) => {
    if (model.stops.length <= 2) return;
    const stops = model.stops.filter((s) => s.id !== id);
    commit({ ...model, stops });
    if (selId === id) setSelId(stops[0].id);
  };
  const addStop = (pos = 50) => {
    const s = newStop(model, pos);
    commit({ ...model, stops: sortStops([...model.stops, s]) });
    setSelId(s.id);
  };

  // Dragging a marker along the bar.
  const barRef = useRef<HTMLDivElement>(null);
  const startMarkerDrag = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelId(id);
    const bar = barRef.current;
    if (!bar) return;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const mv = (ev: PointerEvent) => {
      const r = bar.getBoundingClientRect();
      const pos = Math.max(0, Math.min(100, Math.round(((ev.clientX - r.left) / r.width) * 100)));
      setModel((m) => {
        const next = { ...m, stops: m.stops.map((s) => (s.id === id ? { ...s, pos } : s)) };
        const css = buildGradientCss(next);
        emitted.current = css;
        onChange(css);
        return next;
      });
    };
    const up = () => {
      target.removeEventListener("pointermove", mv);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
    target.addEventListener("pointermove", mv);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  };

  const onBarPointerDown = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    addStop(Math.round(((e.clientX - r.left) / r.width) * 100));
  };

  const rotate90 = () => commit({ ...model, angle: (model.angle + 90) % 360 });
  const dial = useBoxDrag((x) => commit({ ...model, angle: Math.round(x * 360) % 360 }));
  const cxDrag = useBoxDrag((x) => commit({ ...model, cx: Math.round(x * 100) }));
  const cyDrag = useBoxDrag((x) => commit({ ...model, cy: Math.round(x * 100) }));

  const eyeDropper = typeof window !== "undefined" && "EyeDropper" in window && !compact;
  const pipette = async () => {
    try {
      const Ctor = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
      const res = await new Ctor().open();
      if (sel) patchStop(sel.id, { color: res.sRGBHex.toLowerCase() });
    } catch {
      /* cancelled */
    }
  };

  const preview = useMemo(() => buildGradientCss(model), [model]);
  const field =
    "h-7 rounded-md bg-white/5 border border-white/10 text-[11px] text-white/85 px-1.5 outline-none focus:border-violet-400/60 tabular-nums";

  return (
    <div className="w-[272px] p-3 space-y-3 text-white select-none">
      <div className="flex items-center gap-1.5">
        <Segmented value={model.kind} onChange={(kind) => commit({ ...model, kind })} />
        <div className="flex-1" />
        <button type="button" className={iconBtn} title="Reverse stops" onClick={() => commit(reverseStops(model))}>
          <ArrowLeftRight className="w-3.5 h-3.5" />
        </button>
        {model.kind === "linear" && (
          <button type="button" className={iconBtn} title="Rotate 90°" onClick={rotate90}>
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        )}
        {eyeDropper && (
          <button type="button" className={iconBtn} title="Pick colour from screen" onClick={pipette}>
            <Pipette className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Gradient bar + stop markers */}
      <div className="pt-1 pb-5 relative">
        <div className="absolute inset-x-0 top-1 h-9 rounded-lg" style={{ background: CHECKER }} />
        <div
          ref={barRef}
          onPointerDown={onBarPointerDown}
          className="relative h-9 rounded-lg cursor-copy border border-white/10"
          style={{ background: previewBarCss(model) }}
          title="Click the bar to add a colour stop"
        >
          {model.stops.map((s) => (
            <button
              key={s.id}
              type="button"
              onPointerDown={(e) => startMarkerDrag(e, s.id)}
              className={cn(
                "absolute top-full -translate-x-1/2 mt-0.5 w-4 h-5 rounded-b-md rounded-t-[2px] border-2 cursor-grab active:cursor-grabbing touch-none",
                s.id === sel?.id ? "border-sky-400" : "border-white/70",
              )}
              style={{ left: `${s.pos}%`, background: stopCss(s) }}
              title={`${Math.round(s.pos)}%`}
            />
          ))}
        </div>
      </div>

      {/* Angle / centre */}
      {model.kind === "linear" ? (
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-white/40 w-10">Angle</span>
          <div ref={dial.ref} onPointerDown={dial.onPointerDown} className="relative h-3 flex-1 rounded-full bg-white/10 cursor-pointer touch-none">
            <span className="absolute top-1/2 w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-violet-500" style={{ left: `${(model.angle / 360) * 100}%` }} />
          </div>
          <span className="text-[11px] tabular-nums text-white/70 w-9 text-right">{Math.round(model.angle)}°</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {([["X", model.cx, cxDrag], ["Y", model.cy, cyDrag]] as const).map(([label, v, d]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide text-white/40 w-10">{label} pos</span>
              <div ref={d.ref} onPointerDown={d.onPointerDown} className="relative h-3 flex-1 rounded-full bg-white/10 cursor-pointer touch-none">
                <span className="absolute top-1/2 w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-violet-500" style={{ left: `${v}%` }} />
              </div>
              <span className="text-[11px] tabular-nums text-white/70 w-9 text-right">{Math.round(v)}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Colour of the selected stop */}
      {sel && <ColorSurface color={sel.color} alpha={sel.alpha} onChange={(color, alpha) => patchStop(sel.id, { color, alpha })} />}

      {/* Stops list */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-white/85">Stops</span>
          <button type="button" className={iconBtn} title="Add stop" onClick={() => addStop(50)}>
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5" data-prevent-canvas-wheel="true">
          {model.stops.map((s) => (
            <div
              key={s.id}
              onClick={() => setSelId(s.id)}
              className={cn("flex items-center gap-1.5 rounded-lg p-1 cursor-pointer", s.id === sel?.id ? "bg-sky-500/15" : "hover:bg-white/5")}
            >
              {compact ? (
                <span className="w-11 text-[11px] text-white/80 tabular-nums text-center">{Math.round(s.pos)}%</span>
              ) : (
                <input
                  className={cn(field, "w-11 text-center")}
                  value={Math.round(s.pos)}
                  inputMode="numeric"
                  onChange={(e) => {
                    const n = parseInt(e.target.value.replace(/\D/g, "") || "0", 10);
                    patchStop(s.id, { pos: Math.max(0, Math.min(100, n)) });
                  }}
                  onFocus={() => setSelId(s.id)}
                />
              )}
              <span className="w-4 h-4 rounded-sm border border-white/30 flex-shrink-0" style={{ background: `${stopCss(s)}`, backgroundImage: undefined }} />
              {compact ? (
                <span className="flex-1 text-[11px] text-white/70 uppercase">{s.color.slice(1)}</span>
              ) : (
                <input
                  className={cn(field, "flex-1 min-w-0 uppercase")}
                  defaultValue={s.color.slice(1)}
                  key={`${s.id}-${s.color}`}
                  maxLength={6}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9a-f]/gi, "");
                    if (v.length === 6) patchStop(s.id, { color: `#${v.toLowerCase()}` });
                  }}
                  onFocus={() => setSelId(s.id)}
                />
              )}
              <span className="text-[11px] text-white/60 tabular-nums w-9 text-right">{Math.round(s.alpha)}%</span>
              <button
                type="button"
                disabled={model.stops.length <= 2}
                className={cn(iconBtn, "disabled:opacity-25 disabled:cursor-not-allowed")}
                title="Remove stop"
                onClick={(e) => {
                  e.stopPropagation();
                  removeStop(s.id);
                }}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="h-6 rounded-md border border-white/10" style={{ background: preview }} />
    </div>
  );
}

/**
 * Small "gradient" tile for colour menus. Opens the editor in a portaled popover
 * beside the tile; closes on outside click or Esc. The popover carries
 * data-gradient-editor so host menus can treat clicks inside it as "inside".
 */
export function GradientToolButton({
  value,
  onChange,
  compact = false,
  className,
  title = "Gradient editor",
  tileClassName,
  fallbackColor,
}: {
  value?: string;
  onChange: (css: string) => void;
  compact?: boolean;
  className?: string;
  tileClassName?: string;
  title?: string;
  fallbackColor?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const active = isGradientCss(value);

  // Placement: beside the element being edited (never on top of it), clear of
  // the toolbar and the colour menu it was opened from, and it keeps following
  // the element while the canvas pans, zooms or the element moves.
  useLayoutEffect(() => {
    if (!open) return;
    let raf = 0;
    const W = 272, GAP = 14, M = 8;
    const hit = (a: { left: number; top: number; right: number; bottom: number }, b: DOMRect) =>
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const place = () => {
      const btn = btnRef.current, panel = panelRef.current;
      if (btn && panel) {
        const holder = btn.closest("[data-avoid-selector]") as HTMLElement | null;
        const sel = holder?.getAttribute("data-avoid-selector");
        const target = (sel && document.querySelector(sel)) as HTMLElement | null;
        const tr = (target ?? btn).getBoundingClientRect();
        const avoid: DOMRect[] = [tr];
        if (holder) avoid.push(holder.getBoundingClientRect());
        const menu = btn.closest("[data-submenu]");
        if (menu) avoid.push(menu.getBoundingClientRect());
        const vw = window.innerWidth, vh = window.innerHeight;
        const H = panel.offsetHeight || 560;
        const top = Math.max(M, Math.min(vh - H - M, tr.top + tr.height / 2 - H / 2));
        const lefts = [
          tr.left - W - GAP,
          tr.right + GAP,
          ...(menu ? [menu.getBoundingClientRect().left - W - GAP] : []),
        ];
        let left = lefts.find((x) => x >= M && x + W <= vw - M && !avoid.some((r) => hit({ left: x, top, right: x + W, bottom: top + H }, r)));
        if (left === undefined) {
          // No clear spot: take the roomier side of the element and clamp.
          left = tr.left > vw - tr.right ? Math.max(M, tr.left - W - GAP) : Math.min(vw - W - M, tr.right + GAP);
        }
        panel.style.left = `${Math.round(left)}px`;
        panel.style.top = `${Math.round(top)}px`;
        panel.style.visibility = "visible";
      }
      raf = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title={title}
        onMouseDown={compact ? (e) => e.preventDefault() : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "relative flex items-center justify-center rounded-full border-2 overflow-hidden transition-transform hover:scale-110",
          active ? "border-foreground" : "border-border/50",
          tileClassName ?? "w-6 h-6",
          className,
        )}
        style={{ background: "linear-gradient(135deg, #a855f7, #22d3ee 55%, rgba(255,255,255,0.15))" }}
      >
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow">+</span>
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            data-gradient-editor="true"
            data-prevent-canvas-wheel="true"
            className="fixed z-[10070] rounded-xl bg-zinc-900 border border-violet-500/30 shadow-[0_12px_48px_rgba(0,0,0,0.65)]"
            style={{ left: 0, top: 0, visibility: "hidden" }}
            onMouseDown={(e) => {
              stop(e);
              // Compact (text-editing) mode must never move focus out of the editor.
              if (compact) e.preventDefault();
            }}
            onClick={stop}
            onDoubleClick={stop}
            onPointerDown={stop}
            onContextMenu={stop}
            onWheel={stop}
            onKeyDown={stop}
          >
            <GradientEditor value={value} onChange={onChange} compact={compact} fallbackColor={fallbackColor} />
          </div>,
          document.body,
        )}
    </>
  );
}

/** <linearGradient>/<radialGradient> def for any gradient CSS, all stops + opacity. */
export function SvgGradientDef({ id, css, fallback = "#a855f7" }: { id: string; css: string; fallback?: string }) {
  const g = parseGradient(css);
  if (!g) {
    return (
      <linearGradient id={id}>
        <stop offset="0%" stopColor={fallback} />
        <stop offset="100%" stopColor={fallback} />
      </linearGradient>
    );
  }
  const stops = sortStops(g.stops).map((s) => (
    <stop key={s.id} offset={`${s.pos}%`} stopColor={s.color} stopOpacity={s.alpha / 100} />
  ));
  const geo = svgGeometry(g);
  return g.kind === "radial" ? (
    <radialGradient id={id} cx={geo.cx} cy={geo.cy} r={geo.r} fx={geo.cx} fy={geo.cy}>
      {stops}
    </radialGradient>
  ) : (
    <linearGradient id={id} x1={geo.x1} y1={geo.y1} x2={geo.x2} y2={geo.y2}>
      {stops}
    </linearGradient>
  );
}
