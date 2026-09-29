"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, GripHorizontal, Minus, Plus, X } from "lucide-react";
import { useCXDStore } from "@/store/cxd-store";
import type { FreeformElement } from "@/types/canvas-elements";
import { NoteRichTextEditor } from "./note-rich-text-editor";

const PANEL_WIDTH = 340;

/**
 * Floating editor for an inbox note the user pinned open. It stays up while the
 * canvas is panned/zoomed underneath (and in focus mode), so notes can be
 * written while moving around. Edits write the same fields a canvas note card
 * does (noteTitle / noteBody / content) through updateCanvasElement.
 */
export function PinnedInboxNote() {
  const pinnedId = useCXDStore((s) => s.pinnedInboxNoteId);
  const setPinnedId = useCXDStore((s) => s.setPinnedInboxNoteId);
  const updateCanvasElement = useCXDStore((s) => s.updateCanvasElement);
  const canvasFocusMode = useCXDStore((s) => s.canvasFocusMode);
  const note = useCXDStore((s) => {
    if (!s.pinnedInboxNoteId) return null;
    const el = s.getCurrentProject()?.canvasLayout?.elements?.find((e) => e.id === s.pinnedInboxNoteId);
    return el && el.type === "freeform" ? (el as FreeformElement) : null;
  });

  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  // The note was deleted (or the project switched): nothing left to show.
  useEffect(() => {
    if (pinnedId && !note) setPinnedId(null);
  }, [pinnedId, note, setPinnedId]);

  const noteTitle = note?.noteTitle ?? "";
  const noteBody = note?.noteBody ?? "";

  const syncNoteFields = useCallback(
    (nextTitle: string, nextBody: string) => {
      if (!note) return;
      const combined = nextBody.trim().length > 0 ? `${nextTitle}\n${nextBody}` : nextTitle;
      updateCanvasElement(note.id, { noteTitle: nextTitle, noteBody: nextBody, content: combined } as Partial<FreeformElement>);
    },
    [note, updateCanvasElement],
  );
  const noop = useCallback(() => {}, []);

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    const move = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 120, ev.clientX - dragRef.current.dx)),
        y: Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - dragRef.current.dy)),
      });
    };
    const up = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  if (!note) return null;

  const left = pos?.x ?? 88;
  const top = pos?.y ?? (canvasFocusMode ? 24 : 96);

  return (
    <div
      className="fixed z-[45] flex flex-col rounded-xl border border-cyan-500/25 bg-[rgba(12,10,22,0.94)] backdrop-blur-xl shadow-2xl"
      style={{ left, top, width: PANEL_WIDTH }}
      data-prevent-canvas-wheel="true"
      // Keep canvas handlers (pan, marquee, deselect, context menu) out of the panel.
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 border-b border-white/10 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={onHeaderMouseDown}
      >
        <GripHorizontal className="w-3.5 h-3.5 text-white/30" />
        <FileText className="w-3.5 h-3.5 text-cyan-400" />
        <span className="flex-1 text-xs font-medium text-white/70 truncate">
          {noteTitle.trim() || "Untitled Note"}
        </span>
        <button
          className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand" : "Collapse"}
          type="button"
        >
          {collapsed ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
        </button>
        <button
          className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10"
          onClick={() => setPinnedId(null)}
          title="Close note (it stays in the inbox)"
          type="button"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {!collapsed && (
        // No overflow clipping here: the editor's toolbar and its colour menus
        // hang off the panel's right edge. The text area scrolls on its own.
        <div className="px-4 py-3 select-text">
          <input
            value={noteTitle}
            onChange={(e) => syncNoteFields(e.target.value, noteBody)}
            placeholder="Untitled Note"
            className="w-full bg-transparent text-base font-semibold text-white placeholder-white/30 outline-none mb-1"
          />
          <NoteRichTextEditor
            key={note.id}
            value={noteBody}
            textColor="#ffffff"
            isSelected
            toolbarSide="right"
            contentMaxHeight="55vh"
            onChange={(nextHtml) => syncNoteFields(noteTitle, nextHtml)}
            onBlurCard={noop}
            onFocusBody={noop}
            onHeightChange={noop}
          />
        </div>
      )}
    </div>
  );
}
