"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseQuickAdd, type QuickAddResult } from "@/lib/master-plan/plan/quick-add";
import { formatMinutes } from "@/lib/master-plan/plan/plan-days";
import type { MasterPlanProject } from "../shared";
import { projectColor } from "../shared";
import { FOCUS_RING } from "./plan-task-card";

/**
 * One-line task composer. Enter adds, Escape cancels, and leaving it empty
 * closes it. Timing can be typed inline ("Review @14:00 45m"); the parsed
 * result is shown under the field before anything is saved.
 */
export function PlanQuickAdd({
  projects,
  projectId,
  onProjectChange,
  onSubmit,
  onCancel,
  placeholder = "Add a task…",
}: {
  projects: MasterPlanProject[];
  projectId: string;
  onProjectChange: (id: string) => void;
  onSubmit: (projectId: string, parsed: QuickAddResult) => Promise<boolean>;
  onCancel: () => void;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parseQuickAdd(text), [text]);
  const hasTiming = parsed.scheduledStart !== undefined || parsed.durationMinutes !== undefined;

  const submit = async () => {
    if (!parsed.title || !projectId || busy) return;
    setBusy(true);
    const ok = await onSubmit(projectId, parsed);
    setBusy(false);
    if (ok) setText("");
  };

  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 px-3 py-2 text-[11.5px] text-white/40">
        Show at least one project in the filter above to add tasks here.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-violet-400/30 bg-black/40 p-2">
      <input
        autoFocus
        value={text}
        disabled={busy}
        aria-label="New task title"
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setText("");
            onCancel();
          }
        }}
        onBlur={(e) => {
          // Moving focus to the project picker keeps the composer open.
          if (!text.trim() && !e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) onCancel();
        }}
        className="w-full bg-transparent px-1 py-1 text-[13px] text-white placeholder:text-white/30 outline-none"
      />
      <div className="mt-1 flex items-center gap-2">
        <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: projectColor(projectId) }} />
        <select
          value={projectId}
          aria-label="Project for the new task"
          onChange={(e) => onProjectChange(e.target.value)}
          className={cn("min-w-0 flex-1 truncate rounded-md bg-white/5 px-1.5 py-1 text-[11.5px] text-white/70", FOCUS_RING)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id} className="bg-[#14141c]">
              {p.name}
            </option>
          ))}
        </select>
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/50 motion-reduce:animate-none" />}
      </div>
      <p className="mt-1.5 px-1 text-[10.5px] leading-snug text-white/35">
        {hasTiming ? (
          <span className="text-teal-200/80">
            {parsed.scheduledStart && `at ${parsed.scheduledStart}`}
            {parsed.scheduledStart && parsed.durationMinutes ? " · " : ""}
            {parsed.durationMinutes && formatMinutes(parsed.durationMinutes)}
          </span>
        ) : (
          <>Enter to add · add a time with @14:00 or a length with 45m</>
        )}
      </p>
    </div>
  );
}
