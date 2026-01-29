"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4 bg-[#161427] text-white rounded-xl", className)}
      classNames={{
        months: "flex flex-col",
        month: "space-y-4",

        caption: "flex items-center justify-between mb-2",
        caption_label: "text-lg font-semibold text-white",

        nav: "flex items-center gap-2",
        nav_button:
          "h-8 w-8 rounded-md text-purple-400 hover:text-purple-300 hover:bg-white/10 inline-flex items-center justify-center",
        nav_button_previous: "",
        nav_button_next: "",
        table: "w-full border-collapse",

        head_row: "flex",
        head_cell: "w-9 text-center text-xs font-medium text-slate-400",

        row: "flex w-full",
        cell: "w-9 h-9 text-center p-0 relative",

        day: "h-9 w-9 p-0 font-normal rounded-full hover:bg-white/10 hover:text-white",

        day_selected: "bg-purple-500 text-white hover:bg-purple-500",
        day_today: "text-purple-300 font-semibold",
        day_outside: "text-slate-500 opacity-50",
        day_disabled: "text-slate-600 opacity-40",
        day_hidden: "invisible",

        ...classNames,
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-5 w-5 text-purple-400" />,
        IconRight: () => <ChevronRight className="h-5 w-5 text-purple-400" />,
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
