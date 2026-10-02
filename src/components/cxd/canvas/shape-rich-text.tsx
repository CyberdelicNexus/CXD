"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, FontSize, Color } from "@tiptap/extension-text-style";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Minus, Plus, Underline } from "lucide-react";
import { cn } from "@/lib/utils";
import { FONT_FAMILIES, TEXT_GRADIENTS, type ElementStyle } from "@/types/canvas-elements";

const TEXT_SWATCHES = ["#ffffff", "#a3a3a3", "#404040", "#c084fc", "#22d3ee", "#34d399", "#f472b6", "#fbbf24", "#f87171"];

const SIZE_STEPS = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64, 72, 96];

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Plain text (legacy `content`) → paragraphs the editor can load. */
export function plainTextToHtml(text: string): string {
  if (!text) return "<p></p>";
  return text
    .split("\n")
    .map((line) => `<p>${line ? escapeHtml(line) : ""}</p>`)
    .join("");
}

/**
 * Inline rich-text editor for text inside a shape. Unlike the old textarea it
 * supports per-selection formatting: select some words and change their size,
 * weight or style without touching the rest. A small bar floats above the
 * shape while editing; its buttons keep focus in the editor (mousedown is
 * prevented), so using them never ends editing.
 */
export function ShapeRichTextEditor({
  html,
  baseFontSize,
  textStyle,
  onChange,
  onBlur,
  replaceWithChar,
  shapeStyle,
  onShapeStyleChange,
}: {
  /** Shape-level text style (colour, family, alignment): the bar edits it. */
  shapeStyle?: ElementStyle;
  onShapeStyleChange?: (updates: Partial<ElementStyle>) => void;
  html: string;
  /** Editing was started by typing this character on the selected shape: it is appended to the text. */
  replaceWithChar?: string | null;
  baseFontSize: number;
  textStyle: React.CSSProperties;
  onChange: (html: string, plainText: string) => void;
  onBlur: () => void;
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const pending = useRef<number | null>(null);
  const [, force] = useState(0);
  const [showColors, setShowColors] = useState(false);

  const flush = (ed: { getHTML: () => string; getText: (o?: { blockSeparator?: string }) => string }) => {
    if (pending.current !== null) {
      window.clearTimeout(pending.current);
      pending.current = null;
    }
    onChangeRef.current(ed.getHTML(), ed.getText({ blockSeparator: "\n" }));
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // StarterKit v3 already bundles Underline (and Link, disabled here).
      StarterKit.configure({ heading: false, codeBlock: false, blockquote: false, horizontalRule: false, link: false }),
      TextStyle,
      FontSize,
      Color,
    ],
    content: html || "<p></p>",
    autofocus: "end",
    editorProps: {
      attributes: {
        class: "shape-rich-editor w-full outline-none [&_p]:m-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (pending.current !== null) window.clearTimeout(pending.current);
      pending.current = window.setTimeout(() => flush(ed), 120);
    },
    onSelectionUpdate: () => force((n) => n + 1),
    onBlur: ({ editor: ed }) => {
      flush(ed);
      onBlur();
    },
  });

  // Type-to-edit: the key that opened the editor replaces the shape's text.
  const appliedCharRef = useRef(false);
  useEffect(() => {
    if (!editor || !replaceWithChar || appliedCharRef.current) return;
    appliedCharRef.current = true;
    // Append at the end (empty shape: becomes the first character).
    editor.chain().focus("end").insertContent(escapeHtml(replaceWithChar)).run();
    flush(editor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, replaceWithChar]);

  // Never drop the last keystrokes when editing ends by unmount.
  useEffect(() => {
    return () => {
      if (editor && pending.current !== null) flush(editor);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) return null;
  const ed = editor;

  const currentSize = (() => {
    const raw = editor.getAttributes("textStyle")?.fontSize as string | undefined;
    const n = raw ? parseFloat(raw) : NaN;
    return Number.isFinite(n) ? n : baseFontSize;
  })();
  // Formatting applies to the selected text; with nothing selected it applies to
  // ALL the text (what you'd expect when you just click a shape and pick a size).
  const applyScoped = (fn: (chain: ReturnType<typeof ed.chain>) => ReturnType<typeof ed.chain>) => {
    const { from, to, empty } = editor.state.selection;
    if (!empty) {
      fn(editor.chain().focus()).run();
      return;
    }
    const end = editor.state.doc.content.size - 1;
    fn(editor.chain().focus().setTextSelection({ from: 1, to: Math.max(1, end) })).setTextSelection({ from, to }).run();
  };
  const stepSize = (dir: 1 | -1) => {
    const next =
      dir > 0
        ? SIZE_STEPS.find((s) => s > currentSize) ?? SIZE_STEPS[SIZE_STEPS.length - 1]
        : [...SIZE_STEPS].reverse().find((s) => s < currentSize) ?? SIZE_STEPS[0];
    applyScoped((c) => c.setFontSize(`${next}px`));
  };
  const pickColor = (value: string) => {
    const gradient = value.startsWith("linear-gradient");
    if (gradient) {
      // A gradient can't be a per-selection mark: it colours the whole text.
      editor.chain().focus().setTextSelection({ from: 1, to: Math.max(1, editor.state.doc.content.size - 1) }).unsetColor().run();
      onShapeStyleChange?.({ textColor: value });
    } else {
      const wholeText = editor.state.selection.empty;
      applyScoped((c) => c.setColor(value));
      if (wholeText) onShapeStyleChange?.({ textColor: value });
    }
    setShowColors(false);
  };
  const align = shapeStyle?.textAlign || "center";
  const nextAlign = align === "left" ? "center" : align === "center" ? "right" : "left";
  const AlignIcon = align === "left" ? AlignLeft : align === "right" ? AlignRight : AlignCenter;
  const hasSelection = !editor.state.selection.empty;
  const currentColor = (editor.getAttributes("textStyle")?.color as string | undefined) || shapeStyle?.textColor || "#ffffff";

  const btn = (active: boolean) =>
    cn(
      "h-6 min-w-6 px-1 rounded-md flex items-center justify-center text-white/80 hover:bg-white/10 hover:text-white",
      active && "bg-white/15 text-white",
    );

  return (
    <>
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-40 flex items-center gap-0.5 px-1 py-0.5 rounded-lg bg-zinc-900/95 backdrop-blur-xl border border-white/10 shadow-lg whitespace-nowrap"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => e.stopPropagation()}
        title={hasSelection ? "Formats the selected text" : "Select text to format just part of it"}
      >
        <button type="button" className={btn(false)} onClick={() => stepSize(-1)} title="Smaller text">
          <Minus className="w-3 h-3" />
        </button>
        <span className="text-[11px] tabular-nums text-white/70 w-7 text-center">{Math.round(currentSize)}</span>
        <button type="button" className={btn(false)} onClick={() => stepSize(1)} title="Larger text">
          <Plus className="w-3 h-3" />
        </button>
        <div className="w-px h-4 bg-white/10 mx-0.5" />
        <button type="button" className={btn(editor.isActive("bold"))} onClick={() => applyScoped((c) => c.toggleBold())} title="Bold">
          <Bold className="w-3 h-3" />
        </button>
        <button type="button" className={btn(editor.isActive("italic"))} onClick={() => applyScoped((c) => c.toggleItalic())} title="Italic">
          <Italic className="w-3 h-3" />
        </button>
        <button type="button" className={btn(editor.isActive("underline"))} onClick={() => applyScoped((c) => c.toggleUnderline())} title="Underline">
          <Underline className="w-3 h-3" />
        </button>
        <div className="w-px h-4 bg-white/10 mx-0.5" />
        <div className="relative">
          <button type="button" className={btn(showColors)} onClick={() => setShowColors((v) => !v)} title="Text colour">
            <span className="w-3.5 h-3.5 rounded-full border border-white/40" style={{ background: shapeStyle?.textColor?.startsWith("linear-gradient") ? shapeStyle.textColor : currentColor }} />
          </button>
          {showColors && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 p-2 rounded-lg bg-zinc-900/95 border border-white/10 shadow-xl w-[132px]">
              <div className="grid grid-cols-5 gap-1.5 mb-1.5">
                {TEXT_SWATCHES.map((c) => (
                  <button key={c} type="button" className="w-5 h-5 rounded-full border border-white/25 hover:scale-110 transition-transform" style={{ background: c }} onClick={() => pickColor(c)} title={c} />
                ))}
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {TEXT_GRADIENTS.slice(0, 5).map((g, i) => (
                  <button key={i} type="button" className="w-5 h-5 rounded-full border border-white/25 hover:scale-110 transition-transform" style={{ background: g }} onClick={() => pickColor(g)} title="Gradient (whole text)" />
                ))}
              </div>
              <p className="mt-1.5 text-[9px] text-white/40 leading-tight">{hasSelection ? "Colours the selected text" : "Colours all the text"}</p>
            </div>
          )}
        </div>
        <button type="button" className={btn(false)} onClick={() => onShapeStyleChange?.({ textAlign: nextAlign })} title={`Align ${align} (click for ${nextAlign})`}>
          <AlignIcon className="w-3 h-3" />
        </button>
        <select
          value={shapeStyle?.fontFamily || "inherit"}
          onChange={(e) => onShapeStyleChange?.({ fontFamily: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
          className="h-6 max-w-[84px] text-[11px] rounded-md bg-white/5 border border-white/10 text-white/80 px-1 focus:outline-none"
          title="Font"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value} className="bg-zinc-900">{f.label}</option>
          ))}
        </select>
      </div>
      <div
        className="w-full max-h-full overflow-hidden cursor-text"
        style={{ ...textStyle, fontSize: baseFontSize }}
        onMouseDown={(e) => e.stopPropagation()}
        data-no-drag
      >
        <EditorContent editor={editor} />
      </div>
    </>
  );
}
