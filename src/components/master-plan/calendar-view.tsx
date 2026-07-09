"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { projectColor, type MasterPlanTaskItem } from "./shared";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface MasterPlanCalendarViewProps {
  items: MasterPlanTaskItem[];
  onTaskClick: (item: MasterPlanTaskItem) => void;
}

export function MasterPlanCalendarView({ items, onTaskClick }: MasterPlanCalendarViewProps) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const tasksByDate = useMemo(() => {
    const map = new Map<string, MasterPlanTaskItem[]>();
    for (const it of items) {
      if (!it.task.dueDate) continue;
      const key = it.task.dueDate.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return map;
  }, [items]);

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-white/80">
          {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            className="p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() =>
              setCursor(() => {
                const d = new Date();
                d.setDate(1);
                return d;
              })
            }
            className="px-2 py-1 rounded-md text-xs text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            className="p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[10px] uppercase tracking-wide text-white/30 py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (!day) return <div key={i} className="min-h-[80px] rounded-lg bg-transparent" />;
          const key = day.toISOString().slice(0, 10);
          const dayTasks = tasksByDate.get(key) || [];
          const isToday = key === todayKey;
          return (
            <div
              key={i}
              className={cn(
                "min-h-[80px] rounded-lg p-1.5 border",
                isToday ? "border-violet-500/40 bg-violet-500/5" : "border-white/5 bg-white/[0.02]"
              )}
            >
              <span className={cn("text-[10px]", isToday ? "text-violet-300 font-bold" : "text-white/40")}>{day.getDate()}</span>
              <div className="space-y-0.5 mt-1">
                {dayTasks.slice(0, 3).map((item) => (
                  <div
                    key={`${item.projectId}-${item.task.id}`}
                    onClick={() => onTaskClick(item)}
                    className="flex items-center gap-1 px-1 py-0.5 rounded bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                    title={item.task.title}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: projectColor(item.projectId) }} />
                    <span className="text-[9px] text-white/70 truncate">{item.task.title}</span>
                  </div>
                ))}
                {dayTasks.length > 3 && <div className="text-[9px] text-white/30 px-1">+{dayTasks.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
