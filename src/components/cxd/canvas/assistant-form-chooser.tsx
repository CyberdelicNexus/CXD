"use client";

// "How should I draw this?" Shown before the assistant generates a diagram
// whose form the request left open. The options are suggestions with a
// recommendation already in front, so one click (or Enter) carries on; it is
// a proposal, never a questionnaire. Drawn thumbnails make the choice visual.

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormId, FormOption } from "@/lib/ai/assistant-forms";

const STROKE = { stroke: "currentColor", strokeWidth: 1.5, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const pill = (x: number, y: number, w = 14, h = 7) => <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx={h / 2} {...STROKE} />;
const box = (x: number, y: number, w: number, h: number) => <rect key={`b${x}-${y}`} x={x} y={y} width={w} height={h} rx={2} {...STROKE} />;
const line = (x1: number, y1: number, x2: number, y2: number) => <path key={`l${x1}-${y1}-${x2}-${y2}`} d={`M${x1} ${y1}L${x2} ${y2}`} {...STROKE} opacity={0.6} />;

/** A 56x36 sketch of each form: enough to recognise, not a miniature diagram. */
function FormGlyph({ form }: { form: FormId }) {
  let parts: React.ReactNode;
  switch (form) {
    case "flow":
      parts = [pill(2, 5), pill(21, 5), pill(40, 5), pill(40, 24), pill(21, 24), pill(2, 24), line(16, 8.5, 21, 8.5), line(35, 8.5, 40, 8.5), line(47, 12, 47, 24), line(40, 27.5, 35, 27.5), line(21, 27.5, 16, 27.5)];
      break;
    case "spine":
      parts = [box(3, 3, 10, 7), box(3, 14.5, 10, 7), box(3, 26, 10, 7), box(20, 2, 33, 9), box(20, 13.5, 33, 9), box(20, 25, 33, 9), line(13, 6.5, 20, 6.5), line(13, 18, 20, 18), line(13, 29.5, 20, 29.5), line(8, 10, 8, 14.5), line(8, 21.5, 8, 26)];
      break;
    case "loop":
      parts = [pill(4, 4, 18, 8), pill(34, 4, 18, 8), pill(34, 24, 18, 8), pill(4, 24, 18, 8), line(22, 8, 34, 8), line(43, 12, 43, 24), line(34, 28, 22, 28), line(13, 24, 13, 12)];
      break;
    case "mindmap":
      parts = [pill(20, 14, 16, 8), pill(1, 3, 12, 6), pill(43, 3, 12, 6), pill(1, 27, 12, 6), pill(43, 27, 12, 6), line(22, 15, 12, 8), line(34, 15, 44, 8), line(22, 21, 12, 28), line(34, 21, 44, 28)];
      break;
    case "table":
      parts = [box(4, 4, 48, 28), line(4, 12, 52, 12), line(4, 22, 52, 22), line(20, 4, 20, 32), line(36, 4, 36, 32)];
      break;
    case "quadrants":
      parts = [box(3, 3, 23, 13), box(30, 3, 23, 13), box(3, 20, 23, 13), box(30, 20, 23, 13), pill(7, 8, 8, 4), pill(40, 8, 8, 4), pill(12, 25, 8, 4), pill(34, 25, 8, 4)];
      break;
    case "frames":
      parts = [box(2, 4, 15, 28), box(20.5, 4, 15, 28), box(39, 4, 15, 28), line(5, 10, 13, 10), line(23.5, 10, 31.5, 10), line(42, 10, 50, 10), pill(5, 15, 9, 4), pill(5, 22, 9, 4), pill(23.5, 15, 9, 4), pill(42, 15, 9, 4), pill(42, 22, 9, 4)];
      break;
    case "stack":
      parts = [box(6, 3, 44, 8), box(6, 14, 44, 8), box(6, 25, 44, 8), pill(10, 5, 8, 4), pill(22, 5, 8, 4), pill(10, 16, 8, 4), pill(22, 16, 8, 4), pill(34, 16, 8, 4), pill(10, 27, 8, 4)];
      break;
    case "timeline":
      parts = [line(4, 18, 52, 18), pill(5, 15, 8, 6), pill(19, 15, 8, 6), pill(33, 15, 8, 6), pill(45, 15, 8, 6), line(9, 9, 9, 11), line(23, 9, 23, 11), line(37, 9, 37, 11), line(5, 27, 13, 27), line(19, 27, 27, 27), line(33, 27, 41, 27)];
      break;
    case "swimlanes":
      parts = [box(2, 3, 52, 9), box(2, 13.5, 52, 9), box(2, 24, 52, 9), pill(6, 5.5, 9, 4), pill(22, 16, 9, 4), pill(38, 26.5, 9, 4), line(15, 7.5, 26, 16), line(31, 18, 42, 26.5)];
      break;
    case "tree":
      parts = [pill(21, 3, 14, 6), pill(5, 15, 12, 6), pill(22, 15, 12, 6), pill(39, 15, 12, 6), pill(1, 27, 10, 5), pill(13, 27, 10, 5), line(28, 9, 11, 15), line(28, 9, 28, 15), line(28, 9, 45, 15), line(11, 21, 6, 27), line(11, 21, 18, 27)];
      break;
    case "funnel":
      parts = [box(6, 3, 44, 7), box(12, 12, 32, 7), box(18, 21, 20, 7), line(28, 10, 28, 12), line(28, 19, 28, 21), line(28, 28, 28, 33)];
      break;
    case "note":
      parts = [box(14, 3, 28, 30), line(19, 10, 31, 10), line(19, 16, 37, 16), line(19, 21, 37, 21), line(19, 26, 32, 26)];
      break;
  }
  return <svg width={56} height={36} viewBox="0 0 56 36" aria-hidden>{parts}</svg>;
}

interface AssistantFormChooserProps {
  /** What is about to be drawn, in the user's words. */
  subject: string;
  /** Best first; the first is preselected. */
  options: FormOption[];
  /** Every other form, behind "More forms". */
  more?: FormOption[];
  /** Credits the drawing will use, when known. */
  cost?: number;
  onPick: (form: FormId | null) => void;
  onCancel: () => void;
  /** Stop offering this for the project and always use the recommendation. */
  onStopAsking: () => void;
}

export function AssistantFormChooser({ subject, options, more, cost, onPick, onCancel, onStopAsking }: AssistantFormChooserProps) {
  const firstRef = useRef<HTMLButtonElement>(null);
  const [showMore, setShowMore] = useState(false);
  const shown = new Set(options.map((o) => o.id));
  const rest = (more ?? []).filter((o) => !shown.has(o.id));
  // Focus the recommendation so Enter accepts it.
  useEffect(() => firstRef.current?.focus(), []);

  return (
    <div
      className="my-2 rounded-xl border border-violet-500/25 bg-violet-500/[0.04] p-3 animate-in fade-in slide-in-from-bottom-1 duration-300"
      onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
    >
      <p className="truncate text-[11px] text-muted-foreground/70">{subject}</p>
      <p className="mt-1 text-xs text-foreground/90">How should I draw this?</p>

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {options.map((opt, i) => (
          <button
            key={opt.id}
            ref={i === 0 ? firstRef : undefined}
            type="button"
            onClick={() => onPick(opt.id)}
            className={cn(
              "group relative flex flex-col items-center gap-1 rounded-lg border px-1.5 pb-2 pt-2.5 text-center transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60",
              i === 0
                ? "border-violet-400/45 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25"
                : "border-white/10 bg-white/[0.03] text-foreground/70 hover:border-white/25 hover:text-foreground",
            )}
          >
            {i === 0 && (
              <span className="absolute -top-1.5 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-violet-500 px-1.5 py-px text-[9px] font-medium leading-none text-white">
                <Sparkles className="h-2 w-2" /> Suggested
              </span>
            )}
            <FormGlyph form={opt.id} />
            <span className="text-[11px] font-medium leading-none">{opt.label}</span>
            <span className="text-[10px] leading-tight text-muted-foreground/70">{opt.hint}</span>
          </button>
        ))}
      </div>

      {rest.length > 0 && (
        <div className="mt-1.5">
          {showMore ? (
            <div className="grid grid-cols-3 gap-1.5">
              {rest.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onPick(opt.id)}
                  title={opt.hint}
                  className="flex flex-col items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-1.5 pb-1.5 pt-2 text-center text-foreground/70 transition-colors hover:border-white/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
                >
                  <FormGlyph form={opt.id} />
                  <span className="text-[11px] font-medium leading-none">{opt.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowMore(true)}
              className="w-full rounded-lg border border-dashed border-white/15 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-white/30 hover:text-foreground"
            >
              {rest.length} more forms
            </button>
          )}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px]">
        <button type="button" onClick={onStopAsking} className="text-muted-foreground/60 underline-offset-2 hover:text-foreground hover:underline">
          Don&apos;t ask in this project
        </button>
        <div className="flex items-center gap-1.5">
          {cost !== undefined && <span className="text-muted-foreground/50">{cost} credits</span>}
          <button type="button" onClick={onCancel} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-white/10">
            Cancel
          </button>
          <button type="button" onClick={() => onPick(null)} className="rounded-md border border-white/10 px-2 py-1 text-foreground/80 hover:bg-white/10">
            You decide
          </button>
        </div>
      </div>
    </div>
  );
}
