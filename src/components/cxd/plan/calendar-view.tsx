'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TaskProjection } from '@/types/plan-types';
import type { Version } from '@/types/version-types';
import { TYPE_LABEL_COLORS } from '@/types/version-types';
import { HYPERCUBE_FACE_COLORS } from '@/types/plan-types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, GripVertical } from 'lucide-react';

interface CalendarViewProps {
  tasks: TaskProjection[];
  versions?: Version[];
  onTaskClick: (taskId: string) => void;
  onTaskNavigate: (taskId: string) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<TaskProjection>) => void;
  onVersionClick?: (versionId: string) => void;
}

type CalendarViewMode = 'month' | 'week' | 'day';
type BlockDragMode = 'move' | 'resize';

interface TimeAllocation {
  id: string;
  taskId: string;
  dateKey: string;
  startHour: number;
  durationHours: number;
}

interface BlockDragState {
  allocationId: string;
  mode: BlockDragMode;
  startX: number;
  startY: number;
  initialStartHour: number;
  initialDurationHours: number;
  initialDateKey: string;
}

type CalendarColorBy = 'default' | 'status' | 'priority' | 'assignee' | 'faces';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 64;

const toDayKey = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const parseDayKey = (dayKey: string) => {
  const d = new Date(dayKey);
  d.setHours(0, 0, 0, 0);
  return d;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function CalendarView({ tasks, versions = [], onTaskClick, onTaskNavigate, onTaskUpdate, onVersionClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [draggedMonthTask, setDraggedMonthTask] = useState<{ taskId: string; sourceDayKey: string } | null>(null);
  const [colorBy, setColorBy] = useState<CalendarColorBy>(() => {
    if (typeof window === 'undefined') return 'status';
    return (localStorage.getItem('calendar-color') as CalendarColorBy) || 'status';
  });
  const [blockDragState, setBlockDragState] = useState<BlockDragState | null>(null);
  const [allocations, setAllocations] = useState<TimeAllocation[]>(() => {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem('calendar-time-allocations');
    if (!raw) return [];
    try {
      return JSON.parse(raw) as TimeAllocation[];
    } catch {
      return [];
    }
  });

  const timelineGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('calendar-time-allocations', JSON.stringify(allocations));
  }, [allocations]);
  useEffect(() => {
    localStorage.setItem('calendar-color', colorBy);
  }, [colorBy]);

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (viewMode === 'day') {
      return [new Date(currentDate)];
    }

    if (viewMode === 'week') {
      const startOfWeek = addDays(currentDate, -currentDate.getDay());
      return Array.from({ length: 7 }, (_, i) => addDays(startOfWeek, i));
    }

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = addDays(firstDay, -firstDay.getDay());
    const endDate = addDays(lastDay, 6 - lastDay.getDay());

    const days: Date[] = [];
    for (let d = new Date(startDate); d <= endDate; d = addDays(d, 1)) {
      days.push(new Date(d));
    }
    return days;
  }, [currentDate, viewMode]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskProjection[]>();

    tasks.forEach((task) => {
      if (!task.dueDate) return;

      const end = new Date(task.dueDate);
      end.setHours(0, 0, 0, 0);
      const start = task.startDate ? new Date(task.startDate) : new Date(end);
      start.setHours(0, 0, 0, 0);

      for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
        const key = toDayKey(d);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(task);
      }
    });

    return map;
  }, [tasks]);

  const versionsByDate = useMemo(() => {
    const map = new Map<string, Version[]>();

    versions.forEach((version) => {
      if (!version.started_at || !version.targetDate) return;

      const start = new Date(version.started_at);
      start.setHours(0, 0, 0, 0);
      const end = new Date(version.targetDate);
      end.setHours(0, 0, 0, 0);

      for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
        const key = toDayKey(d);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(version);
      }
    });

    return map;
  }, [versions]);

  const selectedDayKey = toDayKey(selectedDate || currentDate);
  const dayPanelTasks = tasksByDate.get(selectedDayKey) || [];

  const timeViewDays = useMemo(() => {
    if (viewMode === 'day') {
      const day = new Date(selectedDate || currentDate);
      day.setHours(0, 0, 0, 0);
      return [day];
    }

    if (viewMode === 'week') {
      const weekStart = addDays(currentDate, -currentDate.getDay());
      return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    }

    return [] as Date[];
  }, [viewMode, currentDate, selectedDate]);

  const timeViewTaskPool = useMemo(() => {
    if (viewMode === 'day') {
      return dayPanelTasks;
    }
    const keys = new Set(timeViewDays.map(d => toDayKey(d)));
    const seen = new Set<string>();
    const pooled: TaskProjection[] = [];
    keys.forEach((key) => {
      (tasksByDate.get(key) || []).forEach((task) => {
        if (!seen.has(task.id)) {
          seen.add(task.id);
          pooled.push(task);
        }
      });
    });
    return pooled;
  }, [viewMode, dayPanelTasks, timeViewDays, tasksByDate]);

  const tasksById = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);
  const monthRowCount = useMemo(() => Math.max(1, Math.ceil(calendarDays.length / 7)), [calendarDays.length]);

  const allocationsByDay = useMemo(() => {
    const map = new Map<string, TimeAllocation[]>();
    allocations.forEach((allocation) => {
      if (!map.has(allocation.dateKey)) map.set(allocation.dateKey, []);
      map.get(allocation.dateKey)!.push(allocation);
    });
    return map;
  }, [allocations]);

  const handlePrevious = () => {
    const next = new Date(currentDate);
    if (viewMode === 'day') next.setDate(next.getDate() - 1);
    else if (viewMode === 'week') next.setDate(next.getDate() - 7);
    else next.setMonth(next.getMonth() - 1);
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === 'day') next.setDate(next.getDate() + 1);
    else if (viewMode === 'week') next.setDate(next.getDate() + 7);
    else next.setMonth(next.getMonth() + 1);
    setCurrentDate(next);
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const isToday = (date: Date) => toDayKey(date) === toDayKey(new Date());
  const isCurrentMonth = (date: Date) => date.getMonth() === currentDate.getMonth();

  const getTaskColor = (task: TaskProjection) => {
    if (colorBy === 'status') {
      if (task.status === 'in_progress') return '#3B82F6';
      if (task.status === 'completed') return '#10B981';
      if (task.status === 'blocked') return '#EF4444';
      return '#6B7280';
    }
    if (colorBy === 'priority') {
      if (task.priority === 'urgent') return '#EF4444';
      if (task.priority === 'high') return '#F97316';
      if (task.priority === 'medium') return '#EAB308';
      if (task.priority === 'low') return '#22C55E';
      return '#6B7280';
    }
    if (colorBy === 'faces') {
      const face = task.hypercubeTags[0];
      return face ? HYPERCUBE_FACE_COLORS[face] : '#A78BFA';
    }
    if (colorBy === 'assignee') {
      const seed = task.assignee || task.id;
      let hash = 0;
      for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      const palette = ['#3B82F6', '#10B981', '#EAB308', '#EF4444', '#8B5CF6', '#06B6D4'];
      return palette[Math.abs(hash) % palette.length];
    }
    return '#A78BFA';
  };

  const shiftTaskDatesByDays = (taskId: string, daysDelta: number) => {
    if (!onTaskUpdate || daysDelta === 0) return;
    const task = tasksById.get(taskId);
    if (!task) return;

    const due = task.dueDate ? new Date(task.dueDate) : null;
    const start = task.startDate ? new Date(task.startDate) : null;
    if (!due && !start) return;

    const updates: Partial<TaskProjection> = {};
    if (due) {
      due.setDate(due.getDate() + daysDelta);
      updates.dueDate = due.toISOString();
    }
    if (start) {
      start.setDate(start.getDate() + daysDelta);
      updates.startDate = start.toISOString();
    } else if (updates.dueDate) {
      updates.startDate = updates.dueDate;
    }
    onTaskUpdate(taskId, updates);
  };

  const moveTaskToDay = (taskId: string, targetDayKey: string) => {
    const task = tasksById.get(taskId);
    if (!task) return;
    const anchor = task.dueDate ? parseDayKey(toDayKey(new Date(task.dueDate))) : task.startDate ? parseDayKey(toDayKey(new Date(task.startDate))) : null;
    if (!anchor) return;
    const target = parseDayKey(targetDayKey);
    const deltaDays = Math.round((target.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000));
    shiftTaskDatesByDays(taskId, deltaDays);
  };

  const createAllocation = (taskId: string, dateKey: string, startHour: number, durationHours: number = 1) => {
    setAllocations(prev => [
      ...prev,
      {
        id: `alloc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        taskId,
        dateKey,
        startHour: clamp(startHour, 0, 23),
        durationHours: clamp(durationHours, 0.5, 8),
      }
    ]);
  };

  const removeAllocation = (allocationId: string) => {
    setAllocations(prev => prev.filter(a => a.id !== allocationId));
  };

  const beginBlockDrag = (allocation: TimeAllocation, mode: BlockDragMode, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setBlockDragState({
      allocationId: allocation.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      initialStartHour: allocation.startHour,
      initialDurationHours: allocation.durationHours,
      initialDateKey: allocation.dateKey,
    });
    document.body.style.userSelect = 'none';
    document.body.style.cursor = mode === 'resize' ? 'ns-resize' : 'grab';
  };

  useEffect(() => {
    if (!blockDragState || !timelineGridRef.current) return;

    const handleMove = (event: MouseEvent) => {
      const dy = event.clientY - blockDragState.startY;
      const hourDelta = dy / HOUR_HEIGHT;

      setAllocations(prev => prev.map((allocation) => {
        if (allocation.id !== blockDragState.allocationId) return allocation;

        if (blockDragState.mode === 'resize') {
          const nextDuration = clamp(Math.round((blockDragState.initialDurationHours + hourDelta) * 2) / 2, 0.5, 12);
          const maxDuration = 24 - allocation.startHour;
          return { ...allocation, durationHours: clamp(nextDuration, 0.5, maxDuration) };
        }

        const rect = timelineGridRef.current!.getBoundingClientRect();
        const dayColumns = timeViewDays.length;
        const colWidth = (rect.width - 72) / Math.max(dayColumns, 1);
        const xInsideGrid = event.clientX - rect.left - 72;
        const dayOffset = clamp(Math.floor(xInsideGrid / Math.max(colWidth, 1)), 0, Math.max(dayColumns - 1, 0));

        const newDay = timeViewDays[dayOffset] || parseDayKey(blockDragState.initialDateKey);
        const nextStart = clamp(Math.round((blockDragState.initialStartHour + hourDelta) * 2) / 2, 0, 23.5);
        const boundedStart = Math.min(nextStart, 24 - allocation.durationHours);

        return {
          ...allocation,
          dateKey: toDayKey(newDay),
          startHour: boundedStart,
        };
      }));
    };

    const handleUp = () => {
      if (blockDragState && onTaskUpdate) {
        const finalAllocation = allocations.find(a => a.id === blockDragState.allocationId);
        if (finalAllocation && finalAllocation.dateKey !== blockDragState.initialDateKey) {
          const start = parseDayKey(blockDragState.initialDateKey);
          const end = parseDayKey(finalAllocation.dateKey);
          const deltaDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
          shiftTaskDatesByDays(finalAllocation.taskId, deltaDays);
        }
      }
      setBlockDragState(null);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [blockDragState, timeViewDays, allocations, onTaskUpdate]);

  const onTimeColumnDrop = (event: React.DragEvent, dateKey: string) => {
    event.preventDefault();
    if (!draggingTaskId) return;
    const columnRect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
    const y = event.clientY - columnRect.top;
    const startHour = clamp(Math.floor(y / HOUR_HEIGHT), 0, 23);
    createAllocation(draggingTaskId, dateKey, startHour, 1);
    moveTaskToDay(draggingTaskId, dateKey);
    setDraggingTaskId(null);
  };

  const renderMonthView = () => (
    <div className="h-full min-h-0 flex flex-col">
      <div className="grid grid-cols-7 gap-2 sm:gap-3 lg:gap-4 mb-2 shrink-0">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-xs sm:text-sm font-medium text-muted-foreground py-2">{day}</div>
        ))}
      </div>
      <div
        className="grid grid-cols-7 gap-2 sm:gap-3 lg:gap-4 flex-1 min-h-0"
        style={{ gridTemplateRows: `repeat(${monthRowCount}, minmax(0, 1fr))` }}
      >
        {calendarDays.map((date, i) => {
          const dateKey = toDayKey(date);
          const dayTasks = tasksByDate.get(dateKey) || [];
          const dayVersions = versionsByDate.get(dateKey) || [];
          const primaryVersion = dayVersions[0]; // Show the first version if multiple
          const versionColor = primaryVersion ? (primaryVersion.color || TYPE_LABEL_COLORS[primaryVersion.type_label] || '#8B5CF6') : undefined;

          return (
            <Card
              key={i}
              className={[
                'h-full min-h-0 p-2 sm:p-3 cursor-pointer transition-all border hover:border-purple-500/40 relative overflow-hidden',
                isCurrentMonth(date) ? 'bg-gradient-to-br from-black/40 to-black/20 border-white/10' : 'bg-black/10 opacity-55 border-white/5',
                isToday(date) ? 'ring-1 ring-purple-500/40 border-purple-500/50' : ''
              ].join(' ')}
              style={versionColor ? {
                borderTop: `3px solid ${versionColor}`,
                boxShadow: `inset 0 0 0 1px ${versionColor}20`,
              } : {}}
              onClick={() => setSelectedDate(date)}
              onDragOver={(e) => {
                if (draggedMonthTask) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (!draggedMonthTask) return;
                const source = parseDayKey(draggedMonthTask.sourceDayKey);
                const target = parseDayKey(dateKey);
                const deltaDays = Math.round((target.getTime() - source.getTime()) / (24 * 60 * 60 * 1000));
                shiftTaskDatesByDays(draggedMonthTask.taskId, deltaDays);
                setDraggedMonthTask(null);
              }}
              onDoubleClick={() => {
                setSelectedDate(date);
                setCurrentDate(date);
                setViewMode('day');
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={isToday(date) ? 'bg-purple-500 text-white rounded-full w-6 h-6 sm:w-7 sm:h-7 text-xs flex items-center justify-center' : 'text-xs sm:text-sm font-medium'}>
                  {date.getDate()}
                </span>
                {/* Version indicator */}
                {primaryVersion && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onVersionClick?.(primaryVersion.id);
                    }}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold hover:scale-105 transition-transform"
                    style={{
                      backgroundColor: `${versionColor}25`,
                      color: versionColor,
                      border: `1px solid ${versionColor}60`,
                    }}
                  >
                    {primaryVersion.type_label[0]}
                    <span className="hidden sm:inline">{primaryVersion.name}</span>
                  </button>
                )}
              </div>

              <div className="space-y-1 overflow-hidden">
                {/* Tasks */}
                {dayTasks.slice(0, 4).map(task => (
                  <button
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation();
                      setDraggedMonthTask({ taskId: task.id, sourceDayKey: dateKey });
                    }}
                    onDragEnd={() => setDraggedMonthTask(null)}
                    className="w-full text-left text-[10px] sm:text-xs rounded border px-1.5 py-1 truncate"
                    style={{
                      borderColor: `${getTaskColor(task)}66`,
                      backgroundColor: `${getTaskColor(task)}22`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTaskClick(task.id);
                    }}
                  >
                    {task.title}
                  </button>
                ))}
                {dayTasks.length > 4 && (
                  <div className="text-[10px] text-muted-foreground px-1">+{dayTasks.length - 4} more</div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const renderTimeView = () => {
    const dayCount = timeViewDays.length;

    return (
      <div className="h-full flex overflow-hidden">
        {viewMode !== 'month' && (
          <div className="w-64 lg:w-72 xl:w-80 shrink-0 border-r border-white/10 bg-black/20 p-3 overflow-y-auto gantt-scrollbar">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              {viewMode === 'day' ? 'Day Tasks' : 'Week Tasks'}
            </div>
            <div className="space-y-2">
              {timeViewTaskPool.map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={() => setDraggingTaskId(task.id)}
                  className="rounded-lg border border-white/10 bg-black/45 hover:bg-black/60 cursor-grab p-2"
                >
                  <div className="text-sm font-medium truncate">{task.title}</div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex gap-1">
                      {task.hypercubeTags.slice(0, 3).map(tag => (
                        <span key={tag} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: HYPERCUBE_FACE_COLORS[tag] }} />
                      ))}
                    </div>
                    <button
                      className="text-xs text-muted-foreground hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskClick(task.id);
                      }}
                    >
                      Open
                    </button>
                  </div>
                </div>
              ))}
              {timeViewTaskPool.length === 0 && (
                <div className="text-xs text-muted-foreground">No tasks for this day.</div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto gantt-scrollbar" ref={timelineGridRef}>
          <div style={{ minWidth: viewMode === 'week' ? '1400px' : '820px' }}>
            <div className="sticky top-0 z-10 grid border-b border-white/10 bg-black/70 backdrop-blur-lg" style={{ gridTemplateColumns: `72px repeat(${dayCount}, ${viewMode === 'week' ? '1fr' : 'minmax(180px, min(300px, 1fr))'})` }}>
              <div className="px-2 py-2 text-xs text-muted-foreground">Time</div>
              {timeViewDays.map(day => (
                <div key={toDayKey(day)} className="px-3 py-2 text-xs lg:text-sm font-medium border-l border-white/10">
                  {day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
              ))}
            </div>

            <div className="relative" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
              <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `72px repeat(${dayCount}, ${viewMode === 'week' ? '1fr' : 'minmax(180px, min(300px, 1fr))'})` }}>
                <div className="border-r border-white/10 bg-black/20">
                  {HOURS.map(hour => (
                    <div key={hour} className="h-16 text-[11px] text-muted-foreground px-2 pt-1 border-b border-white/10">
                      {String(hour).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {timeViewDays.map(day => {
                  const dayKey = toDayKey(day);
                  const dayAllocations = allocationsByDay.get(dayKey) || [];
                  return (
                    <div
                      key={dayKey}
                      className="relative border-l border-white/10"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => onTimeColumnDrop(e, dayKey)}
                    >
                      {HOURS.map(hour => (
                        <div key={hour} className="h-16 border-b border-white/10" />
                      ))}

                      {dayAllocations.map((allocation) => {
                        const task = tasksById.get(allocation.taskId);
                        if (!task) return null;

                        return (
                          <div
                            key={allocation.id}
                            className="absolute left-2 right-2 rounded-md border px-2 py-1 cursor-grab"
                            style={{
                              top: `${allocation.startHour * HOUR_HEIGHT}px`,
                              height: `${allocation.durationHours * HOUR_HEIGHT}px`,
                              borderColor: `${getTaskColor(task)}66`,
                              backgroundColor: `${getTaskColor(task)}22`,
                            }}
                            onMouseDown={(e) => beginBlockDrag(allocation, 'move', e)}
                            onClick={(e) => {
                              e.stopPropagation();
                              onTaskClick(task.id);
                            }}
                          >
                            <div className="text-xs font-medium truncate">{task.title}</div>
                            <div className="text-[10px] text-white/70">
                              {allocation.startHour.toFixed(1).replace('.0', '')}:00 • {allocation.durationHours}h
                            </div>
                            <button
                              className="absolute top-1 right-1 text-[10px] text-white/70 hover:text-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeAllocation(allocation.id);
                              }}
                              title="Remove allocation"
                            >
                              x
                            </button>
                            <div
                              className="absolute left-0 right-0 bottom-0 h-3 cursor-ns-resize rounded-b-md bg-gradient-to-r from-purple-600/35 via-violet-500/30 to-slate-900/45 flex items-center justify-center"
                              onMouseDown={(e) => beginBlockDrag(allocation, 'resize', e)}
                            >
                              <GripVertical className="w-3 h-3 text-white/70" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handlePrevious}><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={handleNext}><ChevronRight className="w-4 h-4" /></Button>
          <h2 className="text-base sm:text-lg lg:text-xl font-semibold ml-2">
            {viewMode === 'day'
              ? (selectedDate || currentDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
              : viewMode === 'week'
                ? `Week of ${addDays(currentDate, -currentDate.getDay()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs">
                Color: {colorBy}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-black/95 border border-white/15 rounded-xl p-1">
              <DropdownMenuLabel className="text-xs">Color By</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={() => setColorBy('default')}>Default</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setColorBy('status')}>Status</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setColorBy('priority')}>Priority</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setColorBy('assignee')}>Assignee</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setColorBy('faces')}>Faces</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center gap-1 mr-2">
            {(['month', 'week', 'day'] as CalendarViewMode[]).map((mode) => (
              <Button key={mode} variant={viewMode === mode ? 'default' : 'outline'} size="sm" onClick={() => setViewMode(mode)} className="capitalize">
                {mode}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleToday}>Today</Button>
        </div>
      </div>

      <div className={viewMode === 'month' ? 'flex-1 min-h-0 overflow-hidden' : 'flex-1 overflow-auto gantt-scrollbar'}>
        <div
          className={viewMode === 'month' ? 'h-full min-h-0' : undefined}
          onDragOver={(e) => {
            if (viewMode === 'month') e.preventDefault();
          }}
        >
          {viewMode === 'month' ? renderMonthView() : renderTimeView()}
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
