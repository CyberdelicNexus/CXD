'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { TaskProjection } from '@/types/plan-types';
import { HYPERCUBE_FACE_COLORS } from '@/types/plan-types';
import { ChevronLeft, ChevronRight, Calendar, ArrowRight, GripVertical } from 'lucide-react';

interface TimelineViewProps {
  tasks: TaskProjection[];
  onTaskClick: (taskId: string) => void;
  onTaskNavigate: (taskId: string) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<TaskProjection>) => void;
}

type ZoomLevel = 'day' | 'week' | 'month';

interface DragState {
  taskId: string;
  edge: 'start' | 'end' | 'move';  // Added 'move' for dragging entire task
  initialX: number;
  initialDate: Date;
  initialEndDate?: Date;  // Store end date when moving entire task
}

export function TimelineView({ tasks, onTaskClick, onTaskNavigate, onTaskUpdate }: TimelineViewProps) {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dragState, setDragState] = useState<DragState | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Filter tasks with dates
  const tasksWithDates = useMemo(() => {
    return tasks.filter((t) => t.startDate || t.dueDate);
  }, [tasks]);

  // Calculate date range based on zoom
  const { startDate, endDate, columns } = useMemo(() => {
    const start = new Date(currentDate);
    let end = new Date(currentDate);
    let cols: Date[] = [];

    if (zoomLevel === 'day') {
      start.setDate(start.getDate() - 3);
      end.setDate(end.getDate() + 10);
      // Generate daily columns
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        cols.push(new Date(d));
      }
    } else if (zoomLevel === 'week') {
      start.setDate(start.getDate() - start.getDay()); // Start of week
      end.setDate(start.getDate() + 28); // 4 weeks
      // Generate weekly columns
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
        cols.push(new Date(d));
      }
    } else {
      start.setDate(1); // Start of month
      end.setMonth(end.getMonth() + 3);
      // Generate monthly columns
      for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
        cols.push(new Date(d));
      }
    }

    return { startDate: start, endDate: end, columns: cols };
  }, [currentDate, zoomLevel]);

  // Position tasks on timeline
  const positionedTasks = useMemo(() => {
    return tasksWithDates.map((task) => {
      const taskStart = task.startDate ? new Date(task.startDate) : new Date(task.dueDate!);
      const taskEnd = task.dueDate ? new Date(task.dueDate) : new Date(task.startDate!);

      const totalDuration = endDate.getTime() - startDate.getTime();
      const taskStartOffset = taskStart.getTime() - startDate.getTime();
      const taskDuration = taskEnd.getTime() - taskStart.getTime();

      const left = Math.max(0, (taskStartOffset / totalDuration) * 100);
      const width = Math.max(2, (taskDuration / totalDuration) * 100);

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
    if (!task || !onTaskUpdate) return;

    if (edge === 'move') {
      // Moving entire task - store both dates
      const initialStartDate = task.startDate ? new Date(task.startDate) : new Date();
      const initialEndDate = task.dueDate ? new Date(task.dueDate) : new Date();
      
      setDragState({
        taskId,
        edge: 'move',
        initialX: e.clientX,
        initialDate: initialStartDate,
        initialEndDate,
      });
    } else {
      // Resizing edge
      const initialDate = edge === 'start' 
        ? (task.startDate ? new Date(task.startDate) : new Date())
        : (task.dueDate ? new Date(task.dueDate) : new Date());

      setDragState({
        taskId,
        edge,
        initialX: e.clientX,
        initialDate,
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
      // Moving entire task - shift both dates by same amount
      const newStartDate = new Date(dragState.initialDate.getTime() + timeDelta);
      const newEndDate = dragState.initialEndDate 
        ? new Date(dragState.initialEndDate.getTime() + timeDelta)
        : new Date(newStartDate.getTime() + 24 * 60 * 60 * 1000); // Default 1 day duration
      
      onTaskUpdate(dragState.taskId, { 
        startDate: newStartDate.toISOString(),
        dueDate: newEndDate.toISOString()
      });
    } else if (dragState.edge === 'start') {
      const newDate = new Date(dragState.initialDate.getTime() + timeDelta);
      onTaskUpdate(dragState.taskId, { startDate: newDate.toISOString() });
    } else {
      const newDate = new Date(dragState.initialDate.getTime() + timeDelta);
      onTaskUpdate(dragState.taskId, { dueDate: newDate.toISOString() });
    }
  };

  const handleDragEnd = () => {
    setDragState(null);
  };

  return (
    <div 
      className="h-full flex flex-col overflow-hidden p-6"
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
    >
      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
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

      {/* Timeline Grid */}
      <div className="flex-1 overflow-auto" ref={timelineRef}>
        <div className="min-w-max">
          {/* Timeline Header */}
          <div className="flex border-b border-white/10 sticky top-0 bg-black/40 backdrop-blur-sm z-10">
            {columns.map((date, i) => {
              // For week view, calculate week date range
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
          <div className="relative py-4" style={{ minHeight: `${positionedTasks.length * 60}px` }}>
            {/* Grid Lines */}
            <div className="absolute inset-0 flex">
              {columns.map((_, i) => (
                <div key={i} className="flex-1 min-w-[120px] border-r border-white/5" />
              ))}
            </div>

            {/* Task Bars */}
            {positionedTasks.map(({ task, left, width }, i) => (
              <div
                key={task.id}
                className="absolute h-12 group"
                style={{
                  left,
                  width,
                  top: `${i * 60 + 4}px`,
                }}
              >
                <Card
                  className="h-full px-3 py-2 hover:border-purple-500/50 transition-all bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border-purple-500/30 relative"
                  onClick={() => onTaskClick(task.id)}
                  onMouseDown={(e) => {
                    // Only start move drag if not clicking on edge handles or buttons
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
                  {/* Start drag handle */}
                  {onTaskUpdate && (
                    <div
                      className="drag-handle absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-purple-500/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center z-10"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleDragStart(task.id, 'start', e);
                      }}
                    >
                      <GripVertical className="w-3 h-3 text-white" />
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between h-full">
                    <div className="flex-1 min-w-0 mr-2">
                      <div className="text-xs font-medium truncate">{task.title}</div>
                      {task.hypercubeTags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {task.hypercubeTags.slice(0, 2).map((tag) => (
                            <div
                              key={tag}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: HYPERCUBE_FACE_COLORS[tag] }}
                            />
                          ))}
                        </div>
                      )}
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
                      className="drag-handle absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-purple-500/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end z-10"
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
  );
}
