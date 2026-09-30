"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { saveAs } from "file-saver";
import { Check, ClipboardCopy, Download, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CanvasElement, CanvasEdge } from "@/types/canvas-elements";
import {
  buildScene,
  exportFileName,
  exportScene,
  plannedSize,
  renderSceneToCanvas,
  type ExportBackground,
  type ExportFormat,
  type ExportQuality,
} from "@/lib/canvas-export";

type Scope = "selection" | "board";

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string; hint?: string; disabled?: boolean }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          title={o.hint}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-35 disabled:cursor-not-allowed",
            value === o.value ? "bg-violet-600 text-white shadow" : "text-white/60 hover:text-white hover:bg-white/10",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Export the board or the current selection as PNG, JPEG or PDF. The whole
 * board always exports as ONE image, however large, so a long flow chart can
 * be handed to an AI (or a teammate) without stitching screenshots.
 */
export function ExportDialog({
  open,
  initialScope,
  onClose,
  elements,
  edges,
  selectedIds,
  projectName,
}: {
  open: boolean;
  initialScope: Scope;
  onClose: () => void;
  /** Elements and edges of the board being viewed (already filtered to it). */
  elements: CanvasElement[];
  edges: CanvasEdge[];
  selectedIds: Set<string>;
  projectName: string;
}) {
  const [scope, setScope] = useState<Scope>(initialScope);
  const [format, setFormat] = useState<ExportFormat>("png");
  const [quality, setQuality] = useState<ExportQuality>("standard");
  const [background, setBackground] = useState<ExportBackground>("dark");
  const [busy, setBusy] = useState<null | "download" | "copy">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const previewToken = useRef(0);

  useEffect(() => {
    if (open) {
      setScope(initialScope);
      setError(null);
      setDone(null);
    }
  }, [open, initialScope]);

  const hasSelection = selectedIds.size > 0;
  const effectiveScope: Scope = scope === "selection" && hasSelection ? "selection" : "board";
  const scene = useMemo(
    () => buildScene(elements, edges, effectiveScope === "selection" ? selectedIds : null),
    [elements, edges, selectedIds, effectiveScope],
  );
  const boardCount = useMemo(() => buildScene(elements, edges, null).elements.length, [elements, edges]);
  const plan = useMemo(() => plannedSize(scene, { quality }), [scene, quality]);

  // Live preview, debounced; older renders are discarded.
  useEffect(() => {
    if (!open) return;
    const token = ++previewToken.current;
    setPreview(null);
    const t = window.setTimeout(async () => {
      try {
        const c = await renderSceneToCanvas(scene, { background: format === "png" ? background : "dark", maxDimensionOverride: 720 });
        if (token === previewToken.current) setPreview(c.toDataURL("image/png"));
      } catch {
        if (token === previewToken.current) setPreview(null);
      }
    }, 200);
    return () => window.clearTimeout(t);
  }, [open, scene, format, background]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const fileName = exportFileName(projectName, effectiveScope, format === "jpeg" ? "jpg" : format);

  const download = async () => {
    setBusy("download"); setError(null); setDone(null);
    try {
      const r = await exportScene(scene, { format, quality, background });
      saveAs(r.blob, fileName);
      setDone(`Saved ${fileName}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    setBusy("copy"); setError(null); setDone(null);
    try {
      if (!navigator.clipboard || typeof ClipboardItem === "undefined") throw new Error("Copying images isn't supported in this browser. Use Download instead.");
      // Promise form keeps the user-gesture valid while the image renders (Safari).
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": exportScene(scene, { format: "png", quality, background }).then((r) => r.blob) }),
      ]);
      setDone("Image copied. Paste it into your AI chat or doc.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't copy the image");
    } finally {
      setBusy(null);
    }
  };

  const empty = !plan;

  return createPortal(
    <div
      className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => e.stopPropagation()}
      data-prevent-canvas-wheel="true"
    >
      <div className="w-full max-w-[520px] max-h-[92vh] overflow-y-auto rounded-2xl border border-white/10 bg-[rgba(14,10,24,0.98)] shadow-2xl text-white" role="dialog" aria-label="Export">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div>
            <h2 className="text-base font-semibold">Export</h2>
            <p className="text-xs text-white/45">Image or PDF of your board, in one piece</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/30 h-52 flex items-center justify-center overflow-hidden">
            {empty ? (
              <span className="text-xs text-white/40">Nothing to export here yet</span>
            ) : preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Export preview" className="max-w-full max-h-full object-contain" />
            ) : (
              <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
            )}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-white/40 mb-1.5">What to export</p>
              <Segmented
                value={effectiveScope}
                onChange={setScope}
                options={[
                  { value: "selection", label: `Selection${hasSelection ? ` (${selectedIds.size})` : ""}`, disabled: !hasSelection, hint: hasSelection ? undefined : "Select elements first" },
                  { value: "board", label: `Whole board (${boardCount})` },
                ]}
              />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-white/40 mb-1.5">Format</p>
              <Segmented value={format} onChange={setFormat} options={[{ value: "png", label: "PNG" }, { value: "jpeg", label: "JPEG" }, { value: "pdf", label: "PDF" }]} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-white/40 mb-1.5">Size</p>
              <Segmented
                value={quality}
                onChange={setQuality}
                options={[
                  { value: "standard", label: "Standard 2×" },
                  { value: "high", label: "High 3×" },
                  { value: "ai", label: "Fit for AI", hint: "Long side capped at 2400px: legible and small enough for vision models" },
                ]}
              />
            </div>
            {format === "png" && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-white/40 mb-1.5">Background</p>
                <Segmented value={background} onChange={setBackground} options={[{ value: "dark", label: "Board dark" }, { value: "transparent", label: "Transparent" }]} />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-white/40">
            <span className="truncate mr-2">{fileName}</span>
            {plan && <span className="flex-shrink-0">{plan.width} × {plan.height}px</span>}
          </div>

          {error && <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>}
          {done && (
            <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> {done}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={copy}
              disabled={empty || busy !== null}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-white/15 text-sm text-white/80 hover:bg-white/10 disabled:opacity-40"
              title="Copy as PNG, ready to paste into an AI chat"
            >
              {busy === "copy" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCopy className="w-4 h-4" />}
              Copy image
            </button>
            <button
              onClick={download}
              disabled={empty || busy !== null}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium disabled:opacity-40"
            >
              {busy === "download" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Download {format === "jpeg" ? "JPEG" : format.toUpperCase()}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
