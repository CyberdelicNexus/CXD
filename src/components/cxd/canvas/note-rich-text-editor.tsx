"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import UnderlineExtension from "@tiptap/extension-underline";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  Strikethrough,
  Underline,
  Link2,
  List,
  ListOrdered,
  Highlighter,
  Palette,
  Type,
} from "lucide-react";

type NoteTextStyle = "heading" | "subheading" | "body" | "small";
type NoteMenu = "none" | "style" | "textColor" | "highlight";

interface NoteRichTextEditorProps {
  value: string;
  textColor: string;
  isSelected: boolean;
  onChange: (nextHtml: string) => void;
  onBlurCard: () => void;
  onFocusBody: () => void;
  onHeightChange: () => void;
}

const TEXT_COLORS = [
  { label: "Default", value: "default" },
  { label: "White", value: "#FFFFFF" },
  { label: "Gray", value: "#D1D5DB" },
  { label: "Red", value: "#F87171" },
  { label: "Orange", value: "#FB923C" },
  { label: "Yellow", value: "#FBBF24" },
  { label: "Green", value: "#34D399" },
  { label: "Blue", value: "#60A5FA" },
  { label: "Purple", value: "#A78BFA" },
];

const HIGHLIGHT_COLORS = [
  { label: "Default", value: "default" },
  { label: "White", value: "rgba(255,255,255,0.28)" },
  { label: "Gray", value: "rgba(209,213,219,0.28)" },
  { label: "Red", value: "rgba(248,113,113,0.35)" },
  { label: "Orange", value: "rgba(251,146,60,0.35)" },
  { label: "Yellow", value: "rgba(251,191,36,0.35)" },
  { label: "Green", value: "rgba(52,211,153,0.35)" },
  { label: "Blue", value: "rgba(96,165,250,0.35)" },
  { label: "Purple", value: "rgba(167,139,250,0.35)" },
];

export function NoteRichTextEditor({
  value,
  textColor,
  isSelected,
  onChange,
  onBlurCard,
  onFocusBody,
  onHeightChange,
}: NoteRichTextEditorProps) {
  const [menu, setMenu] = useState<NoteMenu>("none");
  const [textStyle, setTextStyle] = useState<NoteTextStyle>("body");
  const [showLinkPopup, setShowLinkPopup] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkPopupPosition, setLinkPopupPosition] = useState<{ left: number; top: number } | null>(null);
  const [selectionForLink, setSelectionForLink] = useState<{ from: number; to: number } | null>(null);
  const editorWrapRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const linkButtonRef = useRef<HTMLButtonElement>(null);
  const updateTimer = useRef<number | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      UnderlineExtension,
      Link.configure({
        openOnClick: false,
      }),
      Highlight.configure({
        multicolor: true,
      }),
    ],
    content: value || "<p></p>",
    editorProps: {
      attributes: {
        class:
          "note-rich-editor min-h-[160px] w-full text-sm leading-relaxed outline-none break-words [overflow-wrap:anywhere] [word-break:break-word] [&_p]:my-2 [&_h1]:my-2 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:my-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:my-1 [&_h3]:text-lg [&_h3]:font-semibold [&_ul]:my-2 [&_ol]:my-2 [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-1 [&_ul]:list-disc [&_ol]:list-decimal",
        style: `color:${textColor};cursor:text;`,
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      if (updateTimer.current !== null) {
        window.clearTimeout(updateTimer.current);
      }
      updateTimer.current = window.setTimeout(() => {
        onChange(html);
      }, 80);
      onHeightChange();
    },
    onFocus: () => {
      onFocusBody();
    },
    onSelectionUpdate: ({ editor: ed }) => {
      if (ed.isActive("heading", { level: 1 }) || ed.isActive("heading", { level: 2 })) {
        setTextStyle("heading");
      } else if (ed.isActive("heading", { level: 3 })) {
        setTextStyle("subheading");
      } else if (ed.isActive("paragraph") && ed.getAttributes("textStyle")?.fontSize === "0.875rem") {
        setTextStyle("small");
      } else {
        setTextStyle("body");
      }
    },
    onBlur: ({ event }) => {
      const target = event.relatedTarget as HTMLElement | null;
      if (target && popupRef.current?.contains(target)) {
        return;
      }
      if (target && editorWrapRef.current?.contains(target)) {
        return;
      }
      setMenu("none");
      setShowLinkPopup(false);
      onBlurCard();
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    if (!isSelected) {
      setMenu("none");
      setShowLinkPopup(false);
    }
  }, [isSelected]);

  useLayoutEffect(() => {
    onHeightChange();
  }, [editor, onHeightChange, value]);

  useEffect(() => {
    return () => {
      if (updateTimer.current !== null) {
        window.clearTimeout(updateTimer.current);
      }
    };
  }, []);

  const applyTextStyle = useCallback(
    (style: NoteTextStyle) => {
      if (!editor) return;
      if (style === "heading") {
        editor.chain().focus().setHeading({ level: 2 }).run();
      } else if (style === "subheading") {
        editor.chain().focus().setHeading({ level: 3 }).run();
      } else if (style === "small") {
        editor.chain().focus().setParagraph().setMark("textStyle", { fontSize: "0.875rem" }).run();
      } else {
        editor.chain().focus().setParagraph().unsetMark("textStyle").run();
      }
      setTextStyle(style);
      setMenu("none");
    },
    [editor],
  );

  const openLinkPopup = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    setSelectionForLink({ from, to });
    setLinkUrl(editor.getAttributes("link").href || "");

    const viewRect = editor.view.dom.getBoundingClientRect();
    let left = viewRect.left + 24;
    let top = viewRect.top + 40;
    if (from !== to) {
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      left = (start.left + end.right) / 2;
      top = end.bottom + 8;
    } else if (linkButtonRef.current) {
      const btn = linkButtonRef.current.getBoundingClientRect();
      left = btn.left + btn.width / 2;
      top = btn.bottom + 10;
    }
    setLinkPopupPosition({ left, top });
    setShowLinkPopup(true);
    setMenu("none");
    window.requestAnimationFrame(() => linkInputRef.current?.focus());
  }, [editor]);

  const applyLink = useCallback(() => {
    if (!editor || !linkUrl.trim()) {
      setShowLinkPopup(false);
      return;
    }
    const chain = editor.chain().focus();
    if (selectionForLink) {
      chain.setTextSelection(selectionForLink);
    }
    chain.extendMarkRange("link").setLink({ href: linkUrl.trim() }).run();
    setShowLinkPopup(false);
    setLinkUrl("");
  }, [editor, linkUrl, selectionForLink]);

  const clearLink = useCallback(() => {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (selectionForLink) {
      chain.setTextSelection(selectionForLink);
    }
    chain.unsetLink().run();
    setShowLinkPopup(false);
    setLinkUrl("");
  }, [editor, selectionForLink]);

  const editorButtons = useMemo(
    () => [
      {
        title: "Text style",
        icon: <Type className="mx-auto h-3.5 w-3.5" />,
        onClick: () => setMenu((prev) => (prev === "style" ? "none" : "style")),
      },
      {
        title: "Bold",
        icon: <Bold className="mx-auto h-3.5 w-3.5" />,
        onClick: () => editor?.chain().focus().toggleBold().run(),
        active: editor?.isActive("bold"),
      },
      {
        title: "Italic",
        icon: <Italic className="mx-auto h-3.5 w-3.5" />,
        onClick: () => editor?.chain().focus().toggleItalic().run(),
        active: editor?.isActive("italic"),
      },
      {
        title: "Strikethrough",
        icon: <Strikethrough className="mx-auto h-3.5 w-3.5" />,
        onClick: () => editor?.chain().focus().toggleStrike().run(),
        active: editor?.isActive("strike"),
      },
      {
        title: "Underline",
        icon: <Underline className="mx-auto h-3.5 w-3.5" />,
        onClick: () => editor?.chain().focus().toggleUnderline().run(),
        active: editor?.isActive("underline"),
      },
      {
        title: "Bulleted list",
        icon: <List className="mx-auto h-3.5 w-3.5" />,
        onClick: () => editor?.chain().focus().toggleBulletList().run(),
        active: editor?.isActive("bulletList"),
      },
      {
        title: "Numbered list",
        icon: <ListOrdered className="mx-auto h-3.5 w-3.5" />,
        onClick: () => editor?.chain().focus().toggleOrderedList().run(),
        active: editor?.isActive("orderedList"),
      },
    ],
    [editor],
  );

  if (!editor) return null;

  return (
    <div ref={editorWrapRef} className="relative w-full overflow-visible">
      <div className="flex items-start overflow-visible">
        {isSelected && (
          <div className="sticky top-20 z-20 mr-[30px] -ml-[55px] flex flex-col gap-1 rounded-lg border border-white/15 bg-black/5 p-1.5 shadow-xl">
            {editorButtons.map((button) => (
              <button
                key={button.title}
                className={cn(
                  "h-7 w-7 rounded text-white hover:bg-white/10",
                  button.active && "bg-white/15",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={button.onClick}
                title={button.title}
                type="button"
              >
                {button.icon}
              </button>
            ))}

            <button
              ref={linkButtonRef}
              className={cn("h-7 w-7 rounded text-white hover:bg-white/10", editor.isActive("link") && "bg-white/15")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={openLinkPopup}
              title="Link"
              type="button"
            >
              <Link2 className="mx-auto h-3.5 w-3.5" />
            </button>

            <button
              className="h-7 w-7 rounded text-white hover:bg-white/10"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setMenu((prev) => (prev === "textColor" ? "none" : "textColor"))}
              title="Text color"
              type="button"
            >
              <Palette className="mx-auto h-3.5 w-3.5" />
            </button>

            <button
              className="h-7 w-7 rounded text-white hover:bg-white/10"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setMenu((prev) => (prev === "highlight" ? "none" : "highlight"))}
              title="Highlight"
              type="button"
            >
              <Highlighter className="mx-auto h-3.5 w-3.5" />
            </button>

            {menu === "style" && (
              <div className="absolute left-full top ml-2 min-w-[150px] -translate-y-1/2 rounded-lg border border-white/15 bg-[#1a1a2e] p-2 shadow-xl">
                {[
                  { value: "heading", label: "Heading" },
                  { value: "subheading", label: "Subheading" },
                  { value: "body", label: "Body" },
                  { value: "small", label: "Small" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    className={cn(
                      "w-full rounded px-2 py-1.5 text-left text-xs text-white hover:bg-white/10",
                      textStyle === opt.value && "bg-white/15",
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyTextStyle(opt.value as NoteTextStyle)}
                    type="button"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {menu === "textColor" && (
              <div className="absolute left-full top-1/2 ml-2 min-w-[122px] -translate-y-1/2 rounded-lg border border-white/15 bg-[#1a1a2e] p-2.5 shadow-xl">
                <div className="grid grid-cols-3 place-items-center gap-1.5">
                  {TEXT_COLORS.map((color) => (
                    <button
                      key={color.label}
                      type="button"
                      className="h-7 w-7 shrink-0 rounded-md border border-white/20"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (color.value === "default") {
                          editor.chain().focus().unsetColor().run();
                        } else {
                          editor.chain().focus().setColor(color.value).run();
                        }
                        setMenu("none");
                      }}
                      title={color.label}
                      style={{
                        backgroundColor: color.value === "default" ? "transparent" : color.value,
                        backgroundImage:
                          color.value === "default"
                            ? "linear-gradient(135deg, transparent 45%, rgba(248,113,113,0.9) 45%, rgba(248,113,113,0.9) 55%, transparent 55%)"
                            : undefined,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {menu === "highlight" && (
              <div className="absolute left-full top-1/2 ml-2 min-w-[122px] -translate-y-1/2 rounded-lg border border-white/15 bg-[#1a1a2e] p-2.5 shadow-xl">
                <div className="grid grid-cols-3 place-items-center gap-1.5">
                  {HIGHLIGHT_COLORS.map((color) => (
                    <button
                      key={color.label}
                      type="button"
                      className="h-7 w-7 shrink-0 rounded-md border border-white/20"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (color.value === "default") {
                          editor.chain().focus().unsetHighlight().run();
                        } else {
                          editor.chain().focus().toggleHighlight({ color: color.value }).run();
                        }
                        setMenu("none");
                      }}
                      title={color.label}
                      style={{
                        backgroundColor: color.value === "default" ? "transparent" : color.value,
                        backgroundImage:
                          color.value === "default"
                            ? "linear-gradient(135deg, transparent 45%, rgba(248,113,113,0.9) 45%, rgba(248,113,113,0.9) 55%, transparent 55%)"
                            : undefined,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <EditorContent
            editor={editor}
            className="w-full rounded bg-transparent p-0 text-sm leading-relaxed [box-sizing:border-box] overflow-visible"
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
      </div>

      {showLinkPopup && linkPopupPosition && (
        <div
          ref={popupRef}
          className="fixed z-[999] w-[260px] rounded-lg border border-white/15 bg-[#1a1a2e] p-2.5 shadow-xl"
          style={{ left: linkPopupPosition.left - 130, top: linkPopupPosition.top }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            ref={linkInputRef}
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="Paste or type URL"
            className="w-full rounded border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-white outline-none focus:border-purple-400"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setShowLinkPopup(false);
              }
            }}
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              className="rounded px-2 py-1 text-xs text-white/80 hover:bg-white/10"
              onClick={clearLink}
            >
              Clear
            </button>
            <button
              type="button"
              className="rounded bg-purple-500/80 px-2 py-1 text-xs text-white hover:bg-purple-500"
              onClick={applyLink}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
