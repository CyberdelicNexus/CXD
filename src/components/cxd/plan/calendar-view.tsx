'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { TaskProjection } from '@/types/plan-types';
import { HYPERCUBE_FACE_COLORS } from '@/types/plan-types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ArrowRight, GripVertical } from 'lucide-react';

interface CalendarViewProps {
  tasks: TaskProjection[];
  onTaskClick: (taskId: string) => void;
  onTaskNavigate: (taskId: string) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<TaskProjection>) => void;
}

type CalendarViewMode = 'month' | 'week' | 'day';

interface DragState {
  taskId: string;
  edge: 'start' | 'end' | 'move';
  initialX: number;
  initialDate: Date;
  initialEndDate?: Date;
}

export function CalendarView({ tasks, onTaskClick, onTaskNavigate, onTaskUpdate }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Generate calendar days based on view mode
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const days: Date[] = [];

    if (viewMode === 'day') {
      // Single day view
      days.push(new Date(currentDate));
    } else if (viewMode === 'week') {
      // Week view - start from Sunday
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(day.getDate() + i);
        days.push(day);
      }
    } else {
      // Month view
      // First day of the month
      const firstDay = new Date(year, month, 1);
      // Last day of the month
      const lastDay = new Date(year, month + 1, 0);

      // Start from the Sunday before or on the first day
      const startDate = new Date(firstDay);
      startDate.setDate(startDate.getDate() - startDate.getDay());

      // End on the Saturday after or on the last day
      const endDate = new Date(lastDay);
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

      // Generate all days
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d));
      }
    }

    return days;
  }, [currentDate, viewMode]);

  // Group tasks by date - and also track spanning tasks
  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskProjection[]>();
    const spanningTasks: Array<{ task: TaskProjection; startDate: Date; endDate: Date }> = [];

    tasks.forEach((task) => {
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        const startDate = task.startDate ? new Date(task.startDate) : dueDate;
        
        // If task spans multiple days, track it separately
        if (task.startDate && startDate.toDateString() !== dueDate.toDateString()) {
          spanningTasks.push({ task, startDate, endDate: dueDate });
        }
        
        // Add task to all dates it spans
        const currentDate = new Date(startDate);
        while (currentDate <= dueDate) {
          const dateKey = currentDate.toISOString().split('T')[0];
          if (!map.has(dateKey)) {
            map.set(dateKey, []);
          }
          map.get(dateKey)!.push(task);
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    });

    return { byDate: map, spanning: spanningTasks };
  }, [tasks]);

  const handlePreviousMonth = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date.toDateString() === selectedDate?.toDateString() ? null : date);
  };

  const handleDayDoubleClick = (date: Date) => {
    setCurrentDate(date);
    setViewMode('day');
  };

  const handleDragStart = (taskId: string, edge: 'start' | 'end' | 'move', e: React.MouseEvent) => {
    if (!onTaskUpdate) return;
    e.preventDefault();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    setDragState({
      taskId,
      edge,
      initialX: e.clientX,
      initialDate: task.startDate ? new Date(task.startDate) : new Date(task.dueDate!),
      initialEndDate: task.dueDate ? new Date(task.dueDate) : undefined,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragState || !onTaskUpdate || !calendarRef.current) return;

    const task = tasks.find(t => t.id === dragState.taskId);
    if (!task) return;

    const deltaX = e.clientX - dragState.initialX;
    const dayWidth = calendarRef.current.offsetWidth / 7; // Approximate day width
    const daysDelta = Math.round(deltaX / dayWidth);

    if (daysDelta === 0) return;

    if (dragState.edge === 'move') {
      const newStartDate = new Date(dragState.initialDate);
      newStartDate.setDate(newStartDate.getDate() + daysDelta);
      
      const newEndDate = dragState.initialEndDate ? new Date(dragState.initialEndDate) : new Date(newStartDate);
      if (dragState.initialEndDate) {
        newEndDate.setDate(newEndDate.getDate() + daysDelta);
      }

      onTaskUpdate(dragState.taskId, {
        startDate: newStartDate.toISOString(),
        dueDate: newEndDate.toISOString(),
      });
    } else if (dragState.edge === 'start' && task.startDate) {
      const newStartDate = new Date(dragState.initialDate);
      newStartDate.setDate(newStartDate.getDate() + daysDelta);
      onTaskUpdate(dragState.taskId, { startDate: newStartDate.toISOString() });
    } else if (dragState.edge === 'end' && task.dueDate) {
      const newEndDate = new Date(dragState.initialEndDate || dragState.initialDate);
      newEndDate.setDate(newEndDate.getDate() + daysDelta);
      onTaskUpdate(dragState.taskId, { dueDate: newEndDate.toISOString() });
    }
  };

  const handleMouseUp = () => {
    setDragState(null);
  };

  // Attach mouse event listeners
  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState]);

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold ml-2">
            {viewMode === 'day' 
              ? currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
              : viewMode === 'week'
              ? `Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            }
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2">
            {(['month', 'week', 'day'] as CalendarViewMode[]).map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode(mode)}
                className="capitalize"
              >
                {mode}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto" ref={calendarRef}>
        {/* Day Headers - only show for month and week view */}
        {viewMode !== 'day' && (
          <div className={`grid gap-2 mb-2 ${viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-7'}`}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>
        )}

        {/* Calendar Days */}
        <div 
          className={`grid gap-2 ${
            viewMode === 'day' 
              ? 'grid-cols-1' 
              : viewMode === 'week'
              ? 'grid-cols-7'
              : 'grid-cols-7'
          }`} 
          style={{ gridAutoRows: viewMode === 'day' ? 'auto' : 'minmax(120px, 1fr)' }}
        >
          {calendarDays.map((date, i) => {
            const dateKey = date.toISOString().split('T')[0];
            const dayTasks = tasksByDate.byDate.get(dateKey) || [];
            const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();

            return (
              <Card
                key={i}
                onClick={() => handleDayClick(date)}
                onDoubleClick={() => handleDayDoubleClick(date)}
                className={`p-2 overflow-visible relative cursor-pointer transition-all ${
                  viewMode === 'month' && !isCurrentMonth(date)
                    ? 'bg-black/10 opacity-50'
                    : 'bg-gradient-to-br from-black/40 to-black/20'
                } ${
                  isToday(date)
                    ? 'border-purple-500/50 ring-1 ring-purple-500/30'
                    : isSelected
                    ? 'border-cyan-500/50 ring-1 ring-cyan-500/30'
                    : 'border-white/10'
                } ${viewMode === 'day' ? 'min-h-[400px]' : ''} hover:border-purple-500/30`}
              >
                {/* Date Number */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-sm font-medium ${
                      isToday(date)
                        ? 'bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center'
                        : ''
                    }`}
                  >
                    {viewMode === 'day' 
                      ? date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric' })
                      : date.getDate()
                    }
                  </span>
                  {dayTasks.length > 0 && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5">
                      {dayTasks.length}
                    </Badge>
                  )}
                </div>

                {/* Tasks */}
                <div className="space-y-1 relative z-10" onClick={(e) => e.stopPropagation()}>
                  {dayTasks.slice(0, viewMode === 'day' ? 999 : 3).map((task) => {
                    // Check if this is a spanning task
                    const isSpanning = task.startDate && task.dueDate && 
                      new Date(task.startDate).toDateString() !== new Date(task.dueDate).toDateString();
                    const taskStart = task.startDate ? new Date(task.startDate) : null;
                    const taskEnd = task.dueDate ? new Date(task.dueDate) : null;
                    const isFirstDay = taskStart && date.toDateString() === taskStart.toDateString();
                    const isLastDay = taskEnd && date.toDateString() === taskEnd.toDateString();
                    
                    return (
                      <div
                        key={task.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTaskClick(task.id);
                        }}
                        onMouseDown={(e) => {
                          if (onTaskUpdate && !(e.target as HTMLElement).closest('button')) {
                            e.stopPropagation();
                            handleDragStart(task.id, 'move', e);
                          }
                        }}
                        className={`text-xs p-1.5 rounded border transition-colors group relative ${
                          isSpanning
                            ? 'bg-purple-500/30 hover:bg-purple-500/40 border-purple-500/50'
                            : 'bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/30'
                        } ${isSpanning && !isFirstDay ? 'rounded-l-none border-l-0' : ''} ${
                          isSpanning && !isLastDay ? 'rounded-r-none border-r-0' : ''
                        } ${onTaskUpdate ? 'cursor-move' : 'cursor-pointer'}`}
                        style={{ 
                          position: isSpanning ? 'absolute' : 'relative',
                          top: isSpanning ? '40px' : 'auto',
                          left: 0,
                          right: 0,
                          zIndex: 20,
                        }}
                      >
                        {/* Drag handles for start and end */}
                        {onTaskUpdate && isFirstDay && (
                          <div
                            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-purple-500/50 opacity-0 group-hover:opacity-100 transition-opacity"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              handleDragStart(task.id, 'start', e);
                            }}
                          >
                            <GripVertical className="w-3 h-3 text-white" />
                          </div>
                        )}
                        {onTaskUpdate && isLastDay && (
                          <div
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-purple-500/50 opacity-0 group-hover:opacity-100 transition-opacity"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              handleDragStart(task.id, 'end', e);
                            }}
                          >
                            <GripVertical className="w-3 h-3 text-white" />
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate flex-1">
                            {isSpanning && isFirstDay && '▶ '}
                            {task.title}
                            {isSpanning && isLastDay && ' ◀'}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTaskNavigate(task.id);
                            }}
                          >
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        </div>
                        {task.hypercubeTags.length > 0 && (
                          <div className="flex gap-0.5 mt-0.5">
                            {task.hypercubeTags.slice(0, 3).map((tag) => (
                              <div
                                key={tag}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: HYPERCUBE_FACE_COLORS[tag] }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {dayTasks.length > 3 && viewMode !== 'day' && (
                    <div className="text-xs text-muted-foreground text-center py-1">
                      +{dayTasks.length - 3} more
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 mt-8 text-muted-foreground">
            <CalendarIcon className="w-12 h-12 mb-4 opacity-50" />
            <p>No tasks scheduled</p>
          </div>
        )}
      </div>
    </div>
  );
}
