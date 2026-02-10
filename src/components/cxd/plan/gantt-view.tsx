'use client';

import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { TaskProjection } from '@/types/plan-types';
import { HYPERCUBE_FACE_COLORS } from '@/types/plan-types';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Calendar,
  ArrowRight,
  GripVertical,
  Plus,
  Link
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GanttViewProps {
  tasks: TaskProjection[];
  onTaskClick: (taskId: string) => void;
  onTaskNavigate: (taskId: string) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<TaskProjection>) => void;
}

type ZoomLevel = 'day' | 'week' | 'month';

interface DragState {
  taskId: string;
  edge: 'start' | 'end' | 'move';
  initialX: number;
  initialDate: Date;
  initialEndDate?: Date;
  minWidth: number; // Minimum width in pixels to prevent tiny tasks
}

interface TaskHierarchy extends TaskProjection {
  children: TaskHierarchy[];
  isCollapsed: boolean;
}

export function GanttView({ tasks, onTaskClick, onTaskNavigate, onTaskUpdate }: GanttViewProps) {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set());
  const [showDependencyMode, setShowDependencyMode] = useState(false);
  const [dependencySource, setDependencySource] = useState<string | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const taskListRef = useRef<HTMLDivElement>(null);

  // Minimum task width in pixels to improve drag precision
  const MIN_TASK_WIDTH = 40;

  // Grid snap interval in days
  const getSnapInterval = () => {
    switch (zoomLevel) {
      case 'day': return 1;
      case 'week': return 7;
      case 'month': return 30;
    }
  };

  // Snap date to grid
  const snapToGrid = (date: Date): Date => {
    const snapped = new Date(date);
    const interval = getSnapInterval();
    const day = snapped.getDate();
    const remainder = day % interval;
    if (remainder !== 0) {
      snapped.setDate(day - remainder);
    }
    snapped.setHours(0, 0, 0, 0);
    return snapped;
  };

  // Build task hierarchy
  const taskHierarchy = useMemo(() => {
    const taskMap = new Map<string, TaskHierarchy>();
    const rootTasks: TaskHierarchy[] = [];

    // First pass: create task hierarchy nodes
    tasks.forEach(task => {
      taskMap.set(task.id, {
        ...task,
        children: [],
        isCollapsed: collapsedTasks.has(task.id)
      });
    });

    // Second pass: build parent-child relationships
    tasks.forEach(task => {
      const taskNode = taskMap.get(task.id)!;
      if (task.parentTaskId && taskMap.has(task.parentTaskId)) {
        const parent = taskMap.get(task.parentTaskId)!;
        parent.children.push(taskNode);
      } else {
        rootTasks.push(taskNode);
      }
    });

    // Sort by startDate or dueDate
    const sortTasks = (tasks: TaskHierarchy[]) => {
      tasks.sort((a, b) => {
        const aDate = a.startDate || a.dueDate || '';
        const bDate = b.startDate || b.dueDate || '';
        return aDate.localeCompare(bDate);
      });
      tasks.forEach(task => {
        if (task.children.length > 0) {
          sortTasks(task.children);
        }
      });
    };

    sortTasks(rootTasks);
    return rootTasks;
  }, [tasks, collapsedTasks]);

  // Flatten hierarchy for display (respecting collapsed state)
  const flattenedTasks = useMemo(() => {
    const result: TaskHierarchy[] = [];

    const traverse = (task: TaskHierarchy, depth = 0) => {
      result.push({ ...task, depth });
      if (!task.isCollapsed && task.children.length > 0) {
        task.children.forEach(child => traverse(child, depth + 1));
      }
    };

    taskHierarchy.forEach(task => traverse(task));
    return result;
  }, [taskHierarchy]);

  // Filter tasks with dates
  const tasksWithDates = useMemo(() => {
    return flattenedTasks.filter((t) => t.startDate || t.dueDate);
  }, [flattenedTasks]);

  // Calculate date range based on zoom
  const { startDate, endDate, columns } = useMemo(() => {
    const start = new Date(currentDate);
    let end = new Date(currentDate);
    let cols: Date[] = [];

    if (zoomLevel === 'day') {
      start.setDate(start.getDate() - 3);
      end.setDate(end.getDate() + 10);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        cols.push(new Date(d));
      }
    } else if (zoomLevel === 'week') {
      start.setDate(start.getDate() - start.getDay());
      end.setDate(start.getDate() + 28);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
        cols.push(new Date(d));
      }
    } else {
      start.setDate(1);
      end.setMonth(end.getMonth() + 3);
      for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
        cols.push(new Date(d));
      }
    }

    return { startDate: start, endDate: end, columns: cols };
  }, [currentDate, zoomLevel]);

  // Calculate today marker position
  const todayPosition = useMemo(() => {
    const now = new Date();
    const totalDuration = endDate.getTime() - startDate.getTime();
    const nowOffset = now.getTime() - startDate.getTime();
    return Math.max(0, Math.min(100, (nowOffset / totalDuration) * 100));
  }, [startDate, endDate]);

  // Position tasks on timeline
  const positionedTasks = useMemo(() => {
    return tasksWithDates.map((task) => {
      const taskStart = task.startDate ? new Date(task.startDate) : new Date(task.dueDate!);
      const taskEnd = task.dueDate ? new Date(task.dueDate) : new Date(task.startDate!);

      const totalDuration = endDate.getTime() - startDate.getTime();
      const taskStartOffset = taskStart.getTime() - startDate.getTime();
      const taskDuration = taskEnd.getTime() - taskStart.getTime();

      const left = Math.max(0, (taskStartOffset / totalDuration) * 100);
      const width = Math.max(0.5, (taskDuration / totalDuration) * 100); // Ensure minimum visual width

      return {
        task,
        left: `${left}%`,
        width: `${width}%`,
        taskStart,
        taskEnd,
      };
    });
  }, [tasksWithDates, startDate, endDate]);

  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    if (zoomLevel === 'day') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (zoomLevel === 'week') {
      newDate.setDate(newDate.getDate() - 28);
    } else {
      newDate.setMonth(newDate.getMonth() - 3);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (zoomLevel === 'day') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (zoomLevel === 'week') {
      newDate.setDate(newDate.getDate() + 28);
    } else {
      newDate.setMonth(newDate.getMonth() + 3);
    }
    setCurrentDate(newDate);
  };

  const handleDragStart = (taskId: string, edge: 'start' | 'end' | 'move', e: React.MouseEvent) => {
    e.stopPropagation();
    const task = tasksWithDates.find(t => t.id === taskId);
    if (!task || !onTaskUpdate || !timelineRef.current) return;

    // Get current task width in pixels to enforce minimum
    const taskBar = (e.currentTarget as HTMLElement).closest('.task-bar');
    const taskBarWidth = taskBar?.getBoundingClientRect().width || MIN_TASK_WIDTH;

    if (edge === 'move') {
      const initialStartDate = task.startDate ? new Date(task.startDate) : new Date();
      const initialEndDate = task.dueDate ? new Date(task.dueDate) : new Date();

      setDragState({
        taskId,
        edge: 'move',
        initialX: e.clientX,
        initialDate: initialStartDate,
        initialEndDate,
        minWidth: Math.max(MIN_TASK_WIDTH, taskBarWidth)
      });
    } else {
      const initialDate = edge === 'start'
        ? (task.startDate ? new Date(task.startDate) : new Date())
        : (task.dueDate ? new Date(task.dueDate) : new Date());

      setDragState({
        taskId,
        edge,
        initialX: e.clientX,
        initialDate,
        minWidth: Math.max(MIN_TASK_WIDTH, taskBarWidth)
      });
    }
  };

  const handleDragMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragState || !timelineRef.current || !onTaskUpdate) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragState.initialX;
    const totalDuration = endDate.getTime() - startDate.getTime();
    const timeDelta = (deltaX / rect.width) * totalDuration;

    const task = tasksWithDates.find((t) => t.id === dragState.taskId);
    if (!task) return;

    if (dragState.edge === 'move') {
      // Moving entire task - shift both dates by same amount, with grid snapping
      let newStartDate = new Date(dragState.initialDate.getTime() + timeDelta);
      newStartDate = snapToGrid(newStartDate);

      const duration = dragState.initialEndDate
        ? dragState.initialEndDate.getTime() - dragState.initialDate.getTime()
        : 24 * 60 * 60 * 1000; // Default 1 day

      const newEndDate = new Date(newStartDate.getTime() + duration);

      onTaskUpdate(dragState.taskId, {
        startDate: newStartDate.toISOString(),
        dueDate: newEndDate.toISOString()
      });
    } else if (dragState.edge === 'start') {
      let newDate = new Date(dragState.initialDate.getTime() + timeDelta);
      newDate = snapToGrid(newDate);

      // Ensure minimum duration
      const currentEnd = task.dueDate ? new Date(task.dueDate) : new Date();
      const minDuration = (dragState.minWidth / rect.width) * totalDuration;
      if (currentEnd.getTime() - newDate.getTime() < minDuration) {
        newDate = new Date(currentEnd.getTime() - minDuration);
      }

      onTaskUpdate(dragState.taskId, { startDate: newDate.toISOString() });
    } else {
      let newDate = new Date(dragState.initialDate.getTime() + timeDelta);
      newDate = snapToGrid(newDate);

      // Ensure minimum duration
      const currentStart = task.startDate ? new Date(task.startDate) : new Date();
      const minDuration = (dragState.minWidth / rect.width) * totalDuration;
      if (newDate.getTime() - currentStart.getTime() < minDuration) {
        newDate = new Date(currentStart.getTime() + minDuration);
      }

      onTaskUpdate(dragState.taskId, { dueDate: newDate.toISOString() });
    }
  };

  const handleDragEnd = () => {
    setDragState(null);
  };

  const toggleCollapse = (taskId: string) => {
    setCollapsedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
    onTaskClick(taskId);
  };

  // Synchronize scroll between task list and timeline
  const handleTaskListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (taskListRef.current) {
      taskListRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
    >
      {/* Controls */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevious}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium ml-2">
            {columns[0]?.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={showDependencyMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setShowDependencyMode(!showDependencyMode);
              setDependencySource(null);
            }}
          >
            <Link className="w-4 h-4 mr-2" />
            Dependencies
          </Button>

          {(['day', 'week', 'month'] as ZoomLevel[]).map((zoom) => (
            <Button
              key={zoom}
              variant={zoomLevel === zoom ? 'default' : 'outline'}
              size="sm"
              onClick={() => setZoomLevel(zoom)}
              className="capitalize"
            >
              {zoom}
            </Button>
          ))}
        </div>
      </div>

      {/* Main Gantt Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Task List */}
        <div
          ref={taskListRef}
          className="w-80 border-r border-white/10 overflow-y-auto overflow-x-hidden"
          onScroll={handleTaskListScroll}
          style={{ scrollbarGutter: 'stable' }}
        >
          <div className="sticky top-0 bg-black/40 backdrop-blur-sm z-10 border-b border-white/10 px-4 py-3">
            <div className="text-xs font-medium text-muted-foreground">Task Name</div>
          </div>

          <div className="py-2">
            {flattenedTasks.map((task, index) => (
              <div
                key={task.id}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer border-b border-white/5",
                  selectedTaskId === task.id && "bg-purple-500/10 border-l-2 border-l-purple-500"
                )}
                style={{
                  paddingLeft: `${16 + (task.depth || 0) * 24}px`,
                  height: '60px'  // Match timeline row height
                }}
                onClick={() => handleTaskClick(task.id)}
              >
                {task.children && task.children.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapse(task.id);
                    }}
                    className="shrink-0"
                  >
                    {task.isCollapsed ? (
                      <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                )}

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{task.title}</div>
                  {task.hypercubeTags.length > 0 && (
                    <div className="flex gap-1 mt-1">
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

                {showDependencyMode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (dependencySource === task.id) {
                        setDependencySource(null);
                      } else if (dependencySource && onTaskUpdate) {
                        // Create dependency
                        const sourceTask = tasks.find(t => t.id === dependencySource);
                        if (sourceTask) {
                          const dependencies = task.dependencies || [];
                          onTaskUpdate(task.id, {
                            dependencies: [...dependencies, {
                              taskId: dependencySource,
                              type: 'finish-to-start'
                            }]
                          });
                        }
                        setDependencySource(null);
                      } else {
                        setDependencySource(task.id);
                      }
                    }}
                  >
                    {dependencySource === task.id ? (
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>

          {flattenedTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Calendar className="w-12 h-12 mb-4 opacity-50" />
              <p>No tasks</p>
            </div>
          )}
        </div>

        {/* Right Panel - Timeline Chart */}
        <div
          className="flex-1 overflow-auto"
          ref={timelineRef}
          onScroll={handleTimelineScroll}
        >
          <div className="min-w-max">
            {/* Timeline Header */}
            <div className="flex border-b border-white/10 sticky top-0 bg-black/40 backdrop-blur-sm z-10">
              {columns.map((date, i) => {
                let label = '';
                if (zoomLevel === 'day') {
                  label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                } else if (zoomLevel === 'week') {
                  const weekEnd = new Date(date);
                  weekEnd.setDate(weekEnd.getDate() + 6);
                  label = `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                } else {
                  label = date.toLocaleDateString('en-US', { month: 'short' });
                }

                return (
                  <div
                    key={i}
                    className="flex-1 min-w-[120px] px-2 py-3 text-center text-xs text-muted-foreground border-r border-white/5"
                  >
                    {label}
                  </div>
                );
              })}
            </div>

            {/* Timeline Content */}
            <div className="relative" style={{ minHeight: `${flattenedTasks.length * 60}px` }}>
              {/* Grid Lines */}
              <div className="absolute inset-0 flex">
                {columns.map((_, i) => (
                  <div key={i} className="flex-1 min-w-[120px] border-r border-white/5" />
                ))}
              </div>

              {/* Today Indicator */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-purple-500 z-20 pointer-events-none"
                style={{ left: `${todayPosition}%` }}
              >
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] font-medium text-purple-400 bg-black/80 px-1 rounded whitespace-nowrap">
                  Today
                </div>
              </div>

              {/* Task Bars */}
              {positionedTasks.map(({ task, left, width }, i) => (
                <div
                  key={task.id}
                  className={cn(
                    "absolute h-12 group task-bar",
                    selectedTaskId === task.id && "z-10"
                  )}
                  style={{
                    left,
                    width,
                    top: `${i * 60 + 4}px`,
                  }}
                >
                  <Card
                    className={cn(
                      "h-full px-3 py-2 hover:border-purple-500/50 transition-all relative",
                      task.children && task.children.length > 0
                        ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border-cyan-500/30 font-medium"
                        : "bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border-purple-500/30",
                      selectedTaskId === task.id && "border-purple-500 shadow-lg shadow-purple-500/20",
                      showDependencyMode && dependencySource === task.id && "ring-2 ring-purple-500"
                    )}
                    onClick={() => handleTaskClick(task.id)}
                    onMouseDown={(e) => {
                      if (
                        onTaskUpdate &&
                        !(e.target as HTMLElement).closest('.drag-handle') &&
                        !(e.target as HTMLElement).closest('button')
                      ) {
                        handleDragStart(task.id, 'move', e);
                      }
                    }}
                    style={{ cursor: onTaskUpdate ? 'move' : 'pointer' }}
                  >
                    {/* Progress fill */}
                    {task.completionPercent > 0 && (
                      <div
                        className="absolute inset-0 bg-purple-500/20 rounded-l transition-all"
                        style={{ width: `${task.completionPercent}%` }}
                      />
                    )}

                    {/* Start drag handle */}
                    {onTaskUpdate && (
                      <div
                        className="drag-handle absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-purple-500/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center z-10"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleDragStart(task.id, 'start', e);
                        }}
                      >
                        <GripVertical className="w-3 h-3 text-white" />
                      </div>
                    )}

                    <div className="flex items-center justify-between h-full relative z-[1]">
                      <div className="flex-1 min-w-0 mr-2">
                        <div className="text-xs font-medium truncate">{task.title}</div>
                        <div className="text-[10px] text-white/50 truncate mt-0.5">
                          {task.completionPercent}% complete
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTaskNavigate(task.id);
                        }}
                      >
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>

                    {/* End drag handle */}
                    {onTaskUpdate && (
                      <div
                        className="drag-handle absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-purple-500/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end z-10"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleDragStart(task.id, 'end', e);
                        }}
                      >
                        <GripVertical className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </Card>
                </div>
              ))}

              {/* Dependency Lines */}
              {tasksWithDates.map((task, taskIndex) => {
                if (!task.dependencies || task.dependencies.length === 0) return null;

                return task.dependencies.map((dep, depIndex) => {
                  const sourceTask = positionedTasks.find(pt => pt.task.id === dep.taskId);
                  const targetTask = positionedTasks[taskIndex];

                  if (!sourceTask || !targetTask) return null;

                  // Calculate positions
                  const sourceIndex = positionedTasks.findIndex(pt => pt.task.id === dep.taskId);
                  const sourceY = sourceIndex * 60 + 30; // Middle of source task
                  const targetY = taskIndex * 60 + 30; // Middle of target task

                  // Parse percentages to calculate pixel positions
                  const sourceRight = parseFloat(sourceTask.left) + parseFloat(sourceTask.width);
                  const targetLeft = parseFloat(targetTask.left);

                  // Create path for dependency line
                  const pathD = `M ${sourceRight}% ${sourceY} L ${targetLeft}% ${targetY}`;

                  return (
                    <svg
                      key={`${task.id}-${dep.taskId}-${depIndex}`}
                      className="absolute inset-0 pointer-events-none z-[5]"
                      style={{ overflow: 'visible' }}
                    >
                      <defs>
                        <marker
                          id={`arrow-${task.id}-${depIndex}`}
                          markerWidth="10"
                          markerHeight="10"
                          refX="8"
                          refY="3"
                          orient="auto"
                          markerUnits="strokeWidth"
                        >
                          <path d="M0,0 L0,6 L9,3 z" fill="rgba(168, 85, 247, 0.5)" />
                        </marker>
                      </defs>
                      <path
                        d={pathD}
                        stroke="rgba(168, 85, 247, 0.5)"
                        strokeWidth="2"
                        fill="none"
                        markerEnd={`url(#arrow-${task.id}-${depIndex})`}
                      />
                    </svg>
                  );
                });
              })}
            </div>
          </div>

          {tasksWithDates.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Calendar className="w-12 h-12 mb-4 opacity-50" />
              <p>No tasks with dates</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
