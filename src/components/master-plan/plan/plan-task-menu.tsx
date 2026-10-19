"use client";

import type { ReactNode } from "react";
import { Archive, CalendarArrowUp, CalendarCheck2, Check, Clock, ExternalLink, Inbox, Undo2 } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { PlanEntry } from "./plan-entries";

export interface PlanActions {
  open: (entry: PlanEntry) => void;
  toggleDone: (entry: PlanEntry) => void;
  planToday: (entry: PlanEntry) => void;
  pushNextDay: (entry: PlanEntry) => void;
  toBacklog: (entry: PlanEntry) => void;
  clearTime: (entry: PlanEntry) => void;
  archive: (entry: PlanEntry) => void;
}

const ITEM =
  "gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-white/80 focus:bg-violet-500/20 focus:text-white data-[disabled]:opacity-35";

/** Right-click (or long-press / context-menu key) menu for a Plan task. */
export function PlanTaskMenu({
  entry,
  actions,
  today,
  children,
}: {
  entry: PlanEntry;
  actions: PlanActions;
  today: string;
  children: ReactNode;
}) {
  const done = entry.status === "completed";
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="min-w-[212px] rounded-xl border border-violet-300/20 bg-[#14141c]/95 p-1 text-white shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <ContextMenuItem className={ITEM} onSelect={() => actions.open(entry)}>
          <ExternalLink className="h-4 w-4 text-white/45" /> Open task
        </ContextMenuItem>
        <ContextMenuItem className={ITEM} onSelect={() => actions.toggleDone(entry)}>
          {done ? <Undo2 className="h-4 w-4 text-white/45" /> : <Check className="h-4 w-4 text-white/45" />}
          {done ? "Mark as not done" : "Mark as done"}
        </ContextMenuItem>
        {entry.plannable ? (
          <>
            <ContextMenuSeparator className="bg-white/10" />
            <ContextMenuItem className={ITEM} disabled={entry.plannedDate === today} onSelect={() => actions.planToday(entry)}>
              <CalendarCheck2 className="h-4 w-4 text-white/45" /> Plan for today
            </ContextMenuItem>
            <ContextMenuItem className={ITEM} onSelect={() => actions.pushNextDay(entry)}>
              <CalendarArrowUp className="h-4 w-4 text-white/45" /> Push to next day
            </ContextMenuItem>
            <ContextMenuItem className={ITEM} disabled={!entry.scheduledStart} onSelect={() => actions.clearTime(entry)}>
              <Clock className="h-4 w-4 text-white/45" /> Remove time
            </ContextMenuItem>
            <ContextMenuSeparator className="bg-white/10" />
            <ContextMenuItem className={ITEM} disabled={!entry.plannedDate} onSelect={() => actions.toBacklog(entry)}>
              <Inbox className="h-4 w-4 text-white/45" /> Move to backlog
            </ContextMenuItem>
            <ContextMenuItem className={ITEM} onSelect={() => actions.archive(entry)}>
              <Archive className="h-4 w-4 text-white/45" /> Archive
            </ContextMenuItem>
          </>
        ) : (
          <>
            <ContextMenuSeparator className="bg-white/10" />
            <ContextMenuLabel className="px-2.5 py-1.5 text-[11px] font-normal leading-snug text-white/40">
              A checklist item inside a card. Open the card in its canvas to plan it.
            </ContextMenuLabel>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
