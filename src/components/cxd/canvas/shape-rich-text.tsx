"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, FontSize, Color } from "@tiptap/extension-text-style";
import { Bold, Italic, Minus, Plus, Underline } from "lucide-react";
import { cn } from "@/lib/utils";

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
}: {
  html: string;
  /** Editing was started by typing this character on the selected shape: it replaces the text. */
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
    editor.chain().setContent(`<p>${escapeHtml(replaceWithChar)}</p>`).focus("end").run();
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

  const currentSize = (() => {
    const raw = editor.getAttributes("textStyle")?.fontSize as string | undefined;
    const n = raw ? parseFloat(raw) : NaN;
    return Number.isFinite(n) ? n : baseFontSize;
  })();
  const stepSize = (dir: 1 | -1) => {
    const next =
      dir > 0
        ? SIZE_STEPS.find((s) => s > currentSize) ?? SIZE_STEPS[SIZE_STEPS.length - 1]
        : [...SIZE_STEPS].reverse().find((s) => s < currentSize) ?? SIZE_STEPS[0];
    editor.chain().focus().setFontSize(`${next}px`).run();
  };
  const hasSelection = !editor.state.selection.empty;

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
        <button type="button" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
          <Bold className="w-3 h-3" />
        </button>
        <button type="button" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
          <Italic className="w-3 h-3" />
        </button>
        <button type="button" className={btn(editor.isActive("underline"))} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
          <Underline className="w-3 h-3" />
        </button>
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
