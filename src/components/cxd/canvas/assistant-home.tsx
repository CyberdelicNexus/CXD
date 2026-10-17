"use client";

// What a new Canvas Assistant chat opens on: a grid of things it can do, each
// one click, plus an honest note on what it cannot do yet. People do not read
// documentation for a chat box; the menu IS the documentation, and it doubles
// as the fastest way to start.

import { useState } from "react";
import type { ComponentType } from "react";
import {
  Workflow, PenLine, MessageSquareText, Tags, ListChecks, HelpCircle, ChevronDown, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** How a quick action starts: act on the canvas, answer in chat, or prefill the box for the user to finish. */
export type QuickActionMode = "canvas" | "chat" | "compose";

interface QuickAction {
  icon: ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  mode: QuickActionMode;
  text: string;
}

const CAN_DO = [
  "Draw flows, loops, mind maps, spines, tables and quadrants, and revise them in place",
  "Edit what is on the board: rename, restyle, tag, group, connect, delete",
  "Add tasks to your Plan and notes to your Inbox",
  "Review your canvas and pin comments where something needs work",
];

const CANNOT_DO = [
  "See inside images or files, or edit images",
  "Work on boards other than the one you have open",
  "Route a connector around other elements (connectors are straight)",
  "Change anything without showing you a preview first",
];

interface AssistantHomeProps {
  /** Prompts built from this project's own framing and canvas, most specific first. */
  starters: string[];
  /** Credits for a canvas action and for a chat answer, with the model in use. */
  canvasCost?: number;
  chatCost?: number;
  selectionCount: number;
  disabled?: boolean;
  onRun: (mode: QuickActionMode, text: string) => void;
}

export function AssistantHome({ starters, canvasCost, chatCost, selectionCount, disabled, onRun }: AssistantHomeProps) {
  const [showLimits, setShowLimits] = useState(false);
  const fromProject = starters[0];
  // A starter phrased as a question is answered in chat; sending it to the
  // canvas path would spend a build's credits to be told it is a question.
  const modeFor = (text: string): QuickActionMode => (text.trim().endsWith("?") ? "chat" : "canvas");

  const actions: QuickAction[] = [
    fromProject
      ? { icon: Workflow, title: modeFor(fromProject) === "chat" ? "Start from my project" : "Draw from my project", hint: fromProject, mode: modeFor(fromProject), text: fromProject }
      : { icon: Workflow, title: "Draw the journey", hint: "Map the experience from first contact to follow-up", mode: "canvas", text: "Map the participant journey from first contact to follow-up" },
    { icon: PenLine, title: "Draw something new", hint: "Describe it and pick a form", mode: "compose", text: "Draw " },
    { icon: MessageSquareText, title: "Review my canvas", hint: "Comments pinned where work is needed", mode: "canvas", text: "Review my canvas and leave comments on what needs work" },
    { icon: Tags, title: "Tag my elements", hint: "Sort untagged elements onto the hypercube", mode: "canvas", text: "Tag the untagged elements to the hypercube faces they belong to" },
    { icon: ListChecks, title: "Notes into tasks", hint: "Turn recent notes into Plan tasks", mode: "canvas", text: "Turn my latest notes into tasks in the Plan tab" },
    { icon: HelpCircle, title: "Ask a question", hint: "What is missing, what to do next", mode: "chat", text: "What is missing from this canvas, and what should I do next?" },
  ];

  const costOf = (mode: QuickActionMode) =>
    mode === "chat" ? chatCost : mode === "canvas" ? canvasCost : undefined;

  return (
    <div className="flex flex-col gap-3 py-1">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-violet-300" />
          What should we do on the canvas?
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Pick a start below or type your own. You always see a preview before anything changes.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {actions.map((a) => {
          const cost = costOf(a.mode);
          return (
            <button
              key={a.title}
              type="button"
              disabled={disabled}
              onClick={() => onRun(a.mode, a.text)}
              className={cn(
                "group flex min-h-[84px] flex-col items-start gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-left transition-colors",
                "hover:border-violet-400/40 hover:bg-violet-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <a.icon className="h-4 w-4 flex-shrink-0 text-violet-300/90" />
                {cost !== undefined && (
                  <span className="text-[10px] tabular-nums text-muted-foreground/50">{cost} cr</span>
                )}
              </span>
              <span className="text-xs font-medium leading-tight text-foreground/90">{a.title}</span>
              <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground/75">{a.hint}</span>
            </button>
          );
        })}
      </div>

      {starters.length > 1 && (
        <div>
          <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground/50">From your project</p>
          <div className="flex flex-col gap-1">
            {starters.slice(1, 4).map((s) => (
              <button
                key={s}
                type="button"
                disabled={disabled}
                onClick={() => onRun(modeFor(s), s)}
                className="truncate rounded-lg border border-white/8 px-2.5 py-1.5 text-left text-[11px] text-foreground/75 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-foreground disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground/70">
        {selectionCount >= 2
          ? `${selectionCount} elements selected: free tools to tidy, connect or redraw them are just above the message box.`
          : "Tip: select two or more elements to tidy, connect or redraw them, with tools that use no credits."}
      </p>

      <div className="rounded-lg border border-white/8">
        <button
          type="button"
          onClick={() => setShowLimits((v) => !v)}
          aria-expanded={showLimits}
          className="flex w-full items-center justify-between px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          What it can and can&apos;t do
          <ChevronDown className={cn("h-3 w-3 transition-transform", showLimits && "rotate-180")} />
        </button>
        {showLimits && (
          <div className="grid gap-2 border-t border-white/8 px-2.5 py-2 text-[11px] leading-snug">
            <div>
              <p className="mb-1 font-medium text-emerald-300/90">It can</p>
              <ul className="space-y-0.5 text-foreground/75">
                {CAN_DO.map((line) => <li key={line}>· {line}</li>)}
              </ul>
            </div>
            <div>
              <p className="mb-1 font-medium text-amber-300/90">Not yet</p>
              <ul className="space-y-0.5 text-foreground/75">
                {CANNOT_DO.map((line) => <li key={line}>· {line}</li>)}
              </ul>
            </div>
            <p className="text-muted-foreground/70">
              The assistant is in beta. Rating a result with the thumbs on its card is what improves it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
