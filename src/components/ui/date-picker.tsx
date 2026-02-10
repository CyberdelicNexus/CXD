"use client";

import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  date?: Date;
  onSelect: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
  fitContent?: boolean;
}

export function DatePicker({
  date,
  onSelect,
  placeholder = "Pick a date",
  disabled,
  triggerClassName,
  fitContent = false,
}: DatePickerProps) {
  const today = new Date();
  return (
    <Popover modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            fitContent ? "inline-flex w-auto px-2.5 py-1.5 h-auto justify-start text-left font-normal bg-black/40" : "w-full justify-start text-left font-normal bg-black/40",
            !date && "text-muted-foreground",
            triggerClassName,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        side="top"
        className="p-0 bg-zinc-950/95 border border-white/15 rounded-xl shadow-2xl z-[1000] backdrop-blur-xl"
      >
        <div className="p-1">
          <Calendar
            mode="single"
            selected={date}
            onSelect={onSelect}
            initialFocus
            className="bg-transparent"
            classNames={{
              day_today: "text-purple-300 ring-1 ring-purple-400/40 rounded-full",
              day_selected: "bg-purple-600 text-white hover:bg-purple-600",
            }}
          />
          <div className="flex items-center justify-between px-3 pb-2 pt-1 text-xs border-t border-white/10">
            <button
              type="button"
              onClick={() => onSelect(undefined)}
              className="text-white/70 hover:text-white transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => onSelect(today)}
              className="text-purple-300 hover:text-purple-200 transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
