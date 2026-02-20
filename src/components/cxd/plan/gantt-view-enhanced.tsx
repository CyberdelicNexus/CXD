'use client';

import React, { useMemo, useRef, useState, useCallback, useEffect, useLayoutEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TaskProjection, TaskStatus } from '@/types/plan-types';
import type { Version } from '@/types/version-types';
import { TYPE_LABEL_COLORS, calculateOKRProgress } from '@/types/version-types';
import { useCXDStore } from '@/store/cxd-store';
import { HYPERCUBE_FACE_COLORS, HYPERCUBE_FACE_TAGS } from '@/types/plan-types';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Calendar,
  ArrowRight,
  GripVertical,
  Plus,
  Edit2,
  Filter,
  Check,
  X,
  Search,
  SlidersHorizontal,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface GanttViewProps {
  tasks: TaskProjection[];
  versions?: Version[];
  onTaskClick: (taskId: string) => void;
  onTaskNavigate: (taskId: string) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<TaskProjection>) => void;
  onTaskDelete?: (taskId: string) => void;
  detailPanelOpen?: boolean;
  onVersionClick?: (versionId: string) => void;
}

type ZoomLevel = 'day' | 'week' | 'month';
type SortField = 'dueDate' | 'priority' | 'status' | 'title' | 'assignee' | 'manual';
type ColorBy = 'status' | 'priority' | 'assignee' | 'default';

interface DragState {
  taskId: string;
  edge: 'start' | 'end' | 'move';
  initialX: number;
  initialDate: Date;
  initialEndDate?: Date;
  startX: number; // Track initial mouse position
}

interface DependencyDragState {
  sourceTaskId: string;
  sourceNode: 'start' | 'end';
  mouseX: number;
  mouseY: number;
}

interface VersionDragState {
  versionId: string;
  edge: 'start' | 'end' | 'move';
  initialX: number;
  initialStartDate: Date;
  initialEndDate: Date;
  startX: number;
}

interface HoverPreview {
  taskId: string;
  show: boolean;
  cursorX: number;
  cursorY: number;
  snappedDateLabel: string;
}

interface TaskHierarchy extends TaskProjection {
  children: TaskHierarchy[];
  isCollapsed: boolean;
  subtasksExpanded?: boolean;
  isHovered?: boolean;
  manualSortOrder?: number;
}

interface ManualTimelineGesture {
  taskId: string;
  startX: number;
  startY: number;
  mode: 'pending' | 'reorder' | 'reschedule';
}

const readLocalStorageJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export function GanttViewEnhanced({ tasks, versions = [], onTaskClick, onTaskNavigate, onTaskUpdate, onTaskDelete, detailPanelOpen, onVersionClick }: GanttViewProps) {
  // Get OKRs from store for version progress calculation
  const allOKRs = useCXDStore((state) => state.getCurrentProject()?.okrs || []);
  const updateVersion = useCXDStore((state) => state.updateVersion);

  // Persisted settings (localStorage)
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('gantt-zoom') as ZoomLevel) || 'week';
    }
    return 'week';
  });
  const [sortBy, setSortBy] = useState<SortField>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('gantt-sort') as SortField) || 'manual';
    }
    return 'manual';
  });
  const [colorBy, setColorBy] = useState<ColorBy>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('gantt-color') as ColorBy) || 'status';
    }
    return 'status';
  });
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gantt-panel-collapsed') === 'true';
    }
    return false;
  });

  const [filters, setFilters] = useState<{
    status: TaskStatus[];
    priority: string[];
    hypercubeFaces: string[];
  }>(() => {
    const parsed = readLocalStorageJson<{
      status?: TaskStatus[];
      priority?: string[];
      hypercubeFaces?: string[];
    }>('gantt-filters', {});

    return {
      status: Array.isArray(parsed.status) ? parsed.status : [],
      priority: Array.isArray(parsed.priority) ? parsed.priority : [],
      hypercubeFaces: Array.isArray(parsed.hypercubeFaces) ? parsed.hypercubeFaces : [],
    };
  });

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem('gantt-zoom', zoomLevel);
  }, [zoomLevel]);
  useEffect(() => {
    localStorage.setItem('gantt-sort', sortBy);
  }, [sortBy]);
  useEffect(() => {
    localStorage.setItem('gantt-color', colorBy);
  }, [colorBy]);
  useEffect(() => {
    localStorage.setItem('gantt-panel-collapsed', String(leftPanelCollapsed));
  }, [leftPanelCollapsed]);
  useEffect(() => {
    localStorage.setItem('gantt-filters', JSON.stringify(filters));
  }, [filters]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [versionDragState, setVersionDragState] = useState<VersionDragState | null>(null);
  const [dependencyDragState, setDependencyDragState] = useState<DependencyDragState | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set());

  // Initialize all tasks with subtasks collapsed by default
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());
  const [rescheduleDepcendencies, setRescheduleDependencies] = useState(true);
  const [hoverPreview, setHoverPreview] = useState<HoverPreview | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [hoveredDependency, setHoveredDependency] = useState<string | null>(null);
  const [newlyCreatedDependency, setNewlyCreatedDependency] = useState<string | null>(null);
  const [manualOrder, setManualOrder] = useState<Record<string, number>>(() => readLocalStorageJson<Record<string, number>>('gantt-manual-order', {}));
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedVersionId, setDraggedVersionId] = useState<string | null>(null);
  const [timelineExtension, setTimelineExtension] = useState({ before: 0, after: 0 });
  const [taskToDelete, setTaskToDelete] = useState<{ id: string; title: string } | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineContentRef = useRef<HTMLDivElement>(null);
  const taskListRef = useRef<HTMLDivElement>(null);
  const scrollExtensionTimer = useRef<NodeJS.Timeout | null>(null);
  const preExtensionScrollWidthRef = useRef(0);
  const pendingLeftExtensionRef = useRef(false);
  const isSyncingScrollRef = useRef<'timeline' | 'tasklist' | null>(null);
  const measuredPivotsRef = useRef<Map<string, { leftPx: number; rightPx: number; centerY: number }>>(new Map());
  const lastManualDragTargetRef = useRef<string | null>(null);
  const manualTimelineGestureRef = useRef<ManualTimelineGesture | null>(null);
  const [pivotVersion, setPivotVersion] = useState(0);

  const MIN_TASK_WIDTH = 40;
  const DEFAULT_TASK_DURATION_DAYS = 3;
  const DRAG_AXIS_THRESHOLD = 6;

  // Reset timeline extension when zoom level changes
  useEffect(() => {
    setTimelineExtension({ before: 0, after: 0 });
  }, [zoomLevel]);

  useEffect(() => {
    localStorage.setItem('gantt-manual-order', JSON.stringify(manualOrder));
  }, [manualOrder]);

  // Keep manual ordering stable as tasks are added/removed.
  useEffect(() => {
    setManualOrder(prev => {
      const next: Record<string, number> = {};
      let cursor = 0;

      tasks.forEach(task => {
        const existing = prev[task.id];
        if (typeof existing === 'number') {
          next[task.id] = existing;
          cursor = Math.max(cursor, existing + 1);
        }
      });

      tasks.forEach(task => {
        if (next[task.id] === undefined) {
          next[task.id] = cursor++;
        }
      });

      const sameKeys = Object.keys(prev).length === Object.keys(next).length;
      if (sameKeys && Object.keys(next).every(id => prev[id] === next[id])) {
        return prev;
      }
      return next;
    });
  }, [tasks]);

  // DEV-ONLY: Validate Gantt invariants after every render
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const violations: string[] = [];

    // Invariant 1: No task starts before its predecessor ends (finish-to-start)
    tasks.forEach(task => {
      if (!task.dependencies || !task.startDate) return;
      task.dependencies.forEach(dep => {
        if (dep.type !== 'finish-to-start') return;
        const predecessor = tasks.find(t => t.id === dep.taskId);
        if (!predecessor?.dueDate) return;

        const predEnd = new Date(predecessor.dueDate);
        predEnd.setHours(0, 0, 0, 0);
        const taskStart = new Date(task.startDate!);
        taskStart.setHours(0, 0, 0, 0);

        if (taskStart < predEnd) {
          violations.push(
            `[FS violation] "${task.title}" (${task.id}) starts ${taskStart.toLocaleDateString()} but predecessor "${predecessor.title}" ends ${predEnd.toLocaleDateString()}`
          );
        }
      });
    });

    // Invariant 2: No cyclic dependencies
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const detectCycle = (taskId: string): boolean => {
      if (inStack.has(taskId)) return true;
      if (visited.has(taskId)) return false;
      visited.add(taskId);
      inStack.add(taskId);
      const task = tasks.find(t => t.id === taskId);
      if (task?.dependencies) {
        for (const dep of task.dependencies) {
          if (detectCycle(dep.taskId)) {
            violations.push(`[Cycle] detected involving task "${task.title}" (${taskId})`);
            return true;
          }
        }
      }
      inStack.delete(taskId);
      return false;
    };
    tasks.forEach(t => detectCycle(t.id));

    if (violations.length > 0) {
      console.warn('[Gantt Invariant Violations]', violations);
    }
  }, [tasks]);

  // Snap to exact grid positions
  const snapToExactGrid = (date: Date, columnWidth: number): Date => {
    const snapped = new Date(date);
    snapped.setHours(0, 0, 0, 0);

    if (zoomLevel === 'day') {
      // Snap to day boundaries
      return snapped;
    } else if (zoomLevel === 'week') {
      // Snap to day boundaries (within week view)
      return snapped;
    } else {
      // Snap to week boundaries in month view
      const day = snapped.getDay();
      if (day !== 0) {
        snapped.setDate(snapped.getDate() - day);
      }
      return snapped;
    }
  };

  // Get task color based on colorBy setting
  const getTaskColor = (task: TaskProjection) => {
    if (colorBy === 'status') {
      switch (task.status) {
        case 'in_progress': return 'from-blue-500/20 to-blue-600/20 border-blue-500/30';
        case 'completed': return 'from-green-500/20 to-green-600/20 border-green-500/30';
        case 'blocked': return 'from-red-500/20 to-red-600/20 border-red-500/30';
        default: return 'from-gray-500/20 to-gray-600/20 border-gray-500/30';
      }
    } else if (colorBy === 'priority') {
      switch (task.priority) {
        case 'urgent': return 'from-red-500/20 to-red-600/20 border-red-500/30';
        case 'high': return 'from-orange-500/20 to-orange-600/20 border-orange-500/30';
        case 'medium': return 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30';
        case 'low': return 'from-green-500/20 to-green-600/20 border-green-500/30';
        default: return 'from-gray-500/20 to-gray-600/20 border-gray-500/30';
      }
    }
    return 'from-purple-500/20 to-cyan-500/20 border-purple-500/30';
  };

  // Calculate parent task dates from children
  const syncParentDates = (task: TaskHierarchy): { startDate?: string; dueDate?: string } => {
    if (!task.children || task.children.length === 0) {
      return { startDate: task.startDate, dueDate: task.dueDate };
    }

    let earliestStart: Date | null = null;
    let latestEnd: Date | null = null;

    task.children.forEach(child => {
      const childDates = syncParentDates(child);
      if (childDates.startDate) {
        const start = new Date(childDates.startDate);
        if (!earliestStart || start < earliestStart) {
          earliestStart = start;
        }
      }
      if (childDates.dueDate) {
        const end = new Date(childDates.dueDate);
        if (!latestEnd || end > latestEnd) {
          latestEnd = end;
        }
      }
    });

    return {
      startDate: (earliestStart as Date | null)?.toISOString() || task.startDate,
      dueDate: (latestEnd as Date | null)?.toISOString() || task.dueDate
    };
  };

  // Build task hierarchy
  const taskHierarchy = useMemo(() => {
    const taskMap = new Map<string, TaskHierarchy>();
    const rootTasks: TaskHierarchy[] = [];
    const taskIndexMap = new Map<string, number>(tasks.map((task, idx) => [task.id, idx]));

    console.log('[GanttView] Received tasks:', tasks.length);
    console.log('[GanttView] Active filters:', filters);
    console.log('[GanttView] Search query:', searchQuery);

    // Filter by search query
    let filteredTasks = tasks;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredTasks = filteredTasks.filter(task =>
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filters.status.length > 0) {
      filteredTasks = filteredTasks.filter(task => filters.status.includes(task.status));
    }

    // Apply priority filter
    if (filters.priority.length > 0) {
      filteredTasks = filteredTasks.filter(task => task.priority && filters.priority.includes(task.priority));
    }

    // Apply hypercube face filter
    if (filters.hypercubeFaces.length > 0) {
      filteredTasks = filteredTasks.filter(task =>
        task.hypercubeTags && task.hypercubeTags.some(tag => filters.hypercubeFaces.includes(tag))
      );
    }

    console.log('[GanttView] After filters - remaining tasks:', filteredTasks.length);
    if (filteredTasks.length === 0 && tasks.length > 0) {
      console.warn('[GanttView] All tasks filtered out! Check active filters.');
    }

    // First pass: create task hierarchy nodes
    filteredTasks.forEach(task => {
      taskMap.set(task.id, {
        ...task,
        children: [],
        isCollapsed: collapsedTasks.has(task.id),
        subtasksExpanded: expandedSubtasks.has(task.id),
        manualSortOrder: manualOrder[task.id] ?? 999999
      });
    });

    // Second pass: build parent-child relationships
    filteredTasks.forEach(task => {
      const taskNode = taskMap.get(task.id)!;
      if (task.parentTaskId && taskMap.has(task.parentTaskId)) {
        const parent = taskMap.get(task.parentTaskId)!;
        parent.children.push(taskNode);
      } else {
        rootTasks.push(taskNode);
      }
    });

    // Third pass: sync parent dates with children
    const syncDates = (task: TaskHierarchy) => {
      if (task.children.length > 0) {
        task.children.forEach(syncDates);
        const dates = syncParentDates(task);
        task.startDate = dates.startDate;
        task.dueDate = dates.dueDate;
      }
    };
    rootTasks.forEach(syncDates);

    // Sort tasks
    const sortTasks = (tasks: TaskHierarchy[]) => {
      tasks.sort((a, b) => {
        switch (sortBy) {
          case 'manual':
            {
              const aOrder = a.manualSortOrder ?? Number.MAX_SAFE_INTEGER;
              const bOrder = b.manualSortOrder ?? Number.MAX_SAFE_INTEGER;
              if (aOrder !== bOrder) return aOrder - bOrder;
              return (taskIndexMap.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (taskIndexMap.get(b.id) ?? Number.MAX_SAFE_INTEGER);
            }
          case 'dueDate': {
            const aDate = a.dueDate || a.startDate || '';
            const bDate = b.dueDate || b.startDate || '';
            return aDate.localeCompare(bDate);
          }
          case 'priority': {
            const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
            const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4;
            const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4;
            return aPriority - bPriority;
          }
          case 'status': {
            const statusOrder = { in_progress: 0, not_started: 1, blocked: 2, completed: 3 };
            const aStatus = statusOrder[a.status as keyof typeof statusOrder] ?? 4;
            const bStatus = statusOrder[b.status as keyof typeof statusOrder] ?? 4;
            return aStatus - bStatus;
          }
          case 'title':
            return a.title.localeCompare(b.title);
          case 'assignee':
            return (a.assignee || '').localeCompare(b.assignee || '');
          default:
            return 0;
        }
      });
      tasks.forEach(task => {
        if (task.children.length > 0) {
          sortTasks(task.children);
        }
      });
    };

    sortTasks(rootTasks);

    // Topological reorder: ensure predecessors appear before successors.
    // Skip in manual mode so user-defined order remains authoritative.
    if (sortBy !== 'manual') {
      let changed = true;
      let iterations = 0;
      const maxIterations = rootTasks.length * rootTasks.length; // O(n^2) worst case

      while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        for (let i = 0; i < rootTasks.length; i++) {
          const task = rootTasks[i];
          if (!task.dependencies || task.dependencies.length === 0) continue;

          for (const dep of task.dependencies) {
            const predIdx = rootTasks.findIndex(t => t.id === dep.taskId);
            if (predIdx === -1) continue;
            // If predecessor appears after this task, move this task after the predecessor
            if (predIdx > i) {
              const [moved] = rootTasks.splice(i, 1);
              rootTasks.splice(predIdx, 0, moved);
              changed = true;
              break;
            }
          }
          if (changed) break;
        }
      }
    }

    return rootTasks;
  }, [tasks, collapsedTasks, expandedSubtasks, searchQuery, sortBy, manualOrder, filters]);

  // Flatten hierarchy for display
  const flattenedTasks = useMemo(() => {
    const result: TaskHierarchy[] = [];

    const traverse = (task: TaskHierarchy, depth = 0) => {
      result.push({ ...task, depth });

      // Add subtasks as separate rows if expanded
      if (task.subtasksExpanded && task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach((subtask, index) => {
          // Check if subtask has custom dates, otherwise inherit from parent
          const subtaskStartDate = subtask.customProperties?.startDate || task.startDate;
          const subtaskDueDate = subtask.customProperties?.dueDate || task.dueDate;

          result.push({
            ...task,
            id: `${task.id}-subtask-${index}`,
            title: subtask.text,
            completionPercent: subtask.isCompleted ? 100 : 0,
            status: subtask.isCompleted ? 'completed' : task.status,
            depth: depth + 1,
            children: [],
            isCollapsed: false,
            parentTaskId: task.id,
            startDate: subtaskStartDate,
            dueDate: subtaskDueDate
          } as TaskHierarchy);
        });
      }

      // Add child tasks if not collapsed
      if (!task.isCollapsed && task.children.length > 0) {
        task.children.forEach(child => traverse(child, depth + 1));
      }
    };

    taskHierarchy.forEach(task => traverse(task));
    return result;
  }, [taskHierarchy]);

  // Filter tasks with dates for timeline display
  const tasksWithDates = useMemo(() => {
    return flattenedTasks.filter((t) => t.startDate || t.dueDate);
  }, [flattenedTasks]);

  // Calculate date range based on zoom - extended for infinite scroll
  const { startDate, endDate, columns } = useMemo(() => {
    const start = new Date(currentDate);
    start.setHours(0, 0, 0, 0); // Snap to midnight
    let end = new Date(currentDate);
    end.setHours(0, 0, 0, 0); // Snap to midnight
    let cols: Date[] = [];

    if (zoomLevel === 'day') {
      // Show 14 days before and 60 days after for smooth scrolling
      start.setDate(start.getDate() - 14 - (timelineExtension.before * 7));
      end.setDate(end.getDate() + 60 + (timelineExtension.after * 7));
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        cols.push(new Date(d));
      }
    } else if (zoomLevel === 'week') {
      // Show 4 weeks before and 16 weeks after
      start.setDate(start.getDate() - start.getDay() - (28 + timelineExtension.before * 28));
      end.setDate(start.getDate() + 112 + timelineExtension.after * 28);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
        cols.push(new Date(d));
      }
    } else {
      // Show 3 months before and 12 months after
      start.setMonth(start.getMonth() - (3 + timelineExtension.before * 3));
      start.setDate(1);
      end.setMonth(end.getMonth() + (12 + timelineExtension.after * 3));
      for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
        cols.push(new Date(d));
      }
    }

    // Set endDate to the END of the last column period (not the start).
    // This ensures totalDuration = numColumns * periodLength, so percentage-based
    // task positions align exactly with the equal-width flex columns.
    if (cols.length > 0) {
      end = new Date(cols[cols.length - 1]);
      if (zoomLevel === 'day') {
        end.setDate(end.getDate() + 1);
      } else if (zoomLevel === 'week') {
        end.setDate(end.getDate() + 7);
      } else {
        end.setMonth(end.getMonth() + 1);
      }
    }

    return { startDate: start, endDate: end, columns: cols };
  }, [currentDate, zoomLevel, timelineExtension]);

  // Compensate scroll position when prepending date columns.
  // When columns are added to the LEFT, all content shifts right by the pixel width of the
  // new columns. We capture scrollWidth before the extension, then after the DOM update
  // (in useLayoutEffect, before paint), we add the delta to scrollLeft so the viewport
  // stays on the same content. This works regardless of intermediate scroll position changes.
  useLayoutEffect(() => {
    if (pendingLeftExtensionRef.current && timelineRef.current && preExtensionScrollWidthRef.current > 0) {
      const newScrollWidth = timelineRef.current.scrollWidth;
      const delta = newScrollWidth - preExtensionScrollWidthRef.current;
      if (delta > 0) {
        timelineRef.current.scrollLeft += delta;
      }
      pendingLeftExtensionRef.current = false;
      preExtensionScrollWidthRef.current = 0;
    }
  }, [timelineExtension]);

  // Calculate today marker position - snap to start of today for accurate day alignment
  const todayPosition = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalDuration = endDate.getTime() - startDate.getTime();
    const todayOffset = today.getTime() - startDate.getTime();
    return Math.max(0, Math.min(100, (todayOffset / totalDuration) * 100));
  }, [startDate, endDate]);

  // Position tasks on timeline with exact date-grid alignment
  const positionedTasks = useMemo(() => {
    const totalDuration = endDate.getTime() - startDate.getTime();
    if (totalDuration <= 0) return [];

    return tasksWithDates.map((task) => {
      // Snap task start to midnight (start of day)
      const taskStart = task.startDate ? new Date(task.startDate) : new Date(task.dueDate!);
      taskStart.setHours(0, 0, 0, 0);

      // Snap task end to END of the due day (start of next day)
      // This ensures a task due on Jan 5 visually fills the entire Jan 5 column
      const taskEnd = task.dueDate ? new Date(task.dueDate) : new Date(task.startDate!);
      taskEnd.setHours(0, 0, 0, 0);
      taskEnd.setDate(taskEnd.getDate() + 1); // End of day = start of next day

      const taskStartOffset = taskStart.getTime() - startDate.getTime();
      const taskDuration = Math.max(taskEnd.getTime() - taskStart.getTime(), 24 * 60 * 60 * 1000); // Min 1 day

      const leftPct = (taskStartOffset / totalDuration) * 100;
      const widthPct = (taskDuration / totalDuration) * 100;

      return {
        task,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        leftPct,    // Numeric for connector computation
        widthPct,   // Numeric for connector computation
        taskStart,
        taskEnd,
      };
    });
  }, [tasksWithDates, startDate, endDate]);

  // Position Versions on timeline (Versions with target dates)
  const positionedVersions = useMemo(() => {
    const totalDuration = endDate.getTime() - startDate.getTime();
    if (totalDuration <= 0) return [];

    return versions
      .filter((version) => version.started_at && version.targetDate)
      .map((version) => {
        const versionStart = new Date(version.started_at!);
        versionStart.setHours(0, 0, 0, 0);

        const versionEnd = new Date(version.targetDate!);
        versionEnd.setHours(0, 0, 0, 0);
        versionEnd.setDate(versionEnd.getDate() + 1);

        const versionStartOffset = versionStart.getTime() - startDate.getTime();
        const versionDuration = Math.max(versionEnd.getTime() - versionStart.getTime(), 24 * 60 * 60 * 1000);

        const leftPct = (versionStartOffset / totalDuration) * 100;
        const widthPct = (versionDuration / totalDuration) * 100;

        return {
          version,
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          leftPct,
          widthPct,
        };
      });
  }, [versions, startDate, endDate]);

  // Post-layout pass: measure actual task bar DOM positions for connector accuracy.
  // Task bars are positioned with CSS percentages; reading offsetLeft/offsetWidth after
  // layout gives us the exact pixel coordinates the browser computed. The SVG connector
  // overlay shares the same positioning context (the 'relative' container), so these
  // pixel values map 1:1 to SVG coordinate space.
  useLayoutEffect(() => {
    if (!timelineRef.current || !timelineContentRef.current) return;

    const taskBars = timelineRef.current.querySelectorAll('.task-bar') as NodeListOf<HTMLElement>;
    const contentRect = timelineContentRef.current.getBoundingClientRect();
    const newPivots = new Map<string, { leftPx: number; rightPx: number; centerY: number }>();

    taskBars.forEach((bar) => {
      const taskId = bar.getAttribute('data-task-id');
      if (!taskId) return;
      const barRect = bar.getBoundingClientRect();
      const leftPx = barRect.left - contentRect.left;
      const topPx = barRect.top - contentRect.top;

      newPivots.set(taskId, {
        leftPx,
        rightPx: leftPx + barRect.width,
        centerY: topPx + barRect.height / 2,
      });
    });

    // Only trigger re-render if measurements actually changed (within 0.5px tolerance)
    const oldPivots = measuredPivotsRef.current;
    let changed = newPivots.size !== oldPivots.size;
    if (!changed) {
      newPivots.forEach((newP, id) => {
        if (changed) return;
        const oldP = oldPivots.get(id);
        if (!oldP || Math.abs(oldP.leftPx - newP.leftPx) > 0.5 || Math.abs(oldP.rightPx - newP.rightPx) > 0.5 || Math.abs(oldP.centerY - newP.centerY) > 0.5) {
          changed = true;
        }
      });
    }

    if (changed) {
      measuredPivotsRef.current = newPivots;
      setPivotVersion(v => v + 1);
    }
  }, [positionedTasks, flattenedTasks]);

  // Re-measure pivots when timeline container resizes (e.g. details panel opens/closes)
  useEffect(() => {
    if (!timelineRef.current || !timelineContentRef.current) return;
    const observer = new ResizeObserver(() => {
      // Force pivot re-measurement on next frame after resize settles
      requestAnimationFrame(() => {
        if (!timelineRef.current || !timelineContentRef.current) return;
        const taskBars = timelineRef.current.querySelectorAll('.task-bar') as NodeListOf<HTMLElement>;
        const contentRect = timelineContentRef.current.getBoundingClientRect();
        const newPivots = new Map<string, { leftPx: number; rightPx: number; centerY: number }>();
        taskBars.forEach((bar) => {
          const taskId = bar.getAttribute('data-task-id');
          if (!taskId) return;
          const barRect = bar.getBoundingClientRect();
          const leftPx = barRect.left - contentRect.left;
          const topPx = barRect.top - contentRect.top;
          newPivots.set(taskId, {
            leftPx,
            rightPx: leftPx + barRect.width,
            centerY: topPx + barRect.height / 2,
          });
        });
        measuredPivotsRef.current = newPivots;
        setPivotVersion(v => v + 1);
      });
    });
    observer.observe(timelineRef.current);
    return () => observer.disconnect();
  }, []);

  // DEV-ONLY: Validate connector endpoints match actual DOM task bar positions
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (measuredPivotsRef.current.size === 0 || !timelineRef.current) return;

    const tolerance = 1; // px
    const warnings: string[] = [];
    const contentWidth = timelineRef.current.scrollWidth || 1;

    positionedTasks.forEach(({ task, leftPct, widthPct }) => {
      const measured = measuredPivotsRef.current.get(task.id);
      if (!measured) return;

      const computedLeft = (leftPct / 100) * contentWidth;
      const computedRight = ((leftPct + widthPct) / 100) * contentWidth;

      if (Math.abs(measured.leftPx - computedLeft) > tolerance) {
        warnings.push(
          `[Pivot drift] "${task.title}" left: measured=${measured.leftPx.toFixed(1)}, computed=${computedLeft.toFixed(1)}`
        );
      }
      if (Math.abs(measured.rightPx - computedRight) > tolerance) {
        warnings.push(
          `[Pivot drift] "${task.title}" right: measured=${measured.rightPx.toFixed(1)}, computed=${computedRight.toFixed(1)}`
        );
      }
    });

    if (warnings.length > 0) {
      console.warn('[Gantt Connector Validation]', warnings);
    }
  }, [positionedTasks, pivotVersion]);

  // Authoritative constraint enforcement: enforce finish-to-start invariant
  // After any mutation, walk the dependency graph and push successors forward
  // if their start date violates the constraint (successor.start >= predecessor.end)
  const enforceDependencyConstraints = useCallback((changedTaskId: string) => {
    if (!onTaskUpdate) return;

    const visited = new Set<string>();
    const queue = [changedTaskId];
    const updates: Array<{ id: string; startDate: string; dueDate: string }> = [];

    // Build a map of current task states (including any pending updates)
    const taskState = new Map<string, { startDate: string | undefined; dueDate: string | undefined }>();
    tasks.forEach(t => taskState.set(t.id, { startDate: t.startDate, dueDate: t.dueDate }));

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const current = taskState.get(currentId);
      if (!current?.dueDate) continue;

      const predecessorEnd = new Date(current.dueDate);
      predecessorEnd.setHours(0, 0, 0, 0);

      // Find all tasks that depend on currentId (successors)
      const successors = tasks.filter(t =>
        t.dependencies?.some(dep => dep.taskId === currentId && dep.type === 'finish-to-start')
      );

      successors.forEach(successor => {
        if (visited.has(successor.id)) return;
        const state = taskState.get(successor.id);
        if (!state?.startDate) return;

        const successorStart = new Date(state.startDate);
        successorStart.setHours(0, 0, 0, 0);

        // Enforce invariant: successor must not start before predecessor ends
        if (successorStart < predecessorEnd) {
          const duration = state.dueDate
            ? new Date(state.dueDate).getTime() - new Date(state.startDate).getTime()
            : DEFAULT_TASK_DURATION_DAYS * 24 * 60 * 60 * 1000;

          const newStart = new Date(predecessorEnd);
          newStart.setHours(0, 0, 0, 0);
          const newEnd = new Date(newStart.getTime() + duration);
          newEnd.setHours(0, 0, 0, 0);

          // Update local state map for cascade propagation
          taskState.set(successor.id, {
            startDate: newStart.toISOString(),
            dueDate: newEnd.toISOString()
          });

          updates.push({
            id: successor.id,
            startDate: newStart.toISOString(),
            dueDate: newEnd.toISOString()
          });

          queue.push(successor.id);
        } else {
          // Even if this successor is fine, check its successors too
          queue.push(successor.id);
        }
      });
    }

    // Batch apply all constraint-enforced updates
    updates.forEach(update => {
      onTaskUpdate(update.id, {
        startDate: update.startDate,
        dueDate: update.dueDate
      });
    });

    if (updates.length > 0) {
      console.log('[Gantt] Dependency constraints enforced:', updates.length, 'tasks adjusted');
    }
  }, [tasks, onTaskUpdate]);

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
    // Reset timeline extension when manually navigating
    setTimelineExtension({ before: 0, after: 0 });
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
    // Reset timeline extension when manually navigating
    setTimelineExtension({ before: 0, after: 0 });
  };

  // Jump to Today: scroll timeline so today is centered in the viewport
  const scrollToToday = useCallback(() => {
    if (!timelineRef.current) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalDuration = endDate.getTime() - startDate.getTime();
    if (totalDuration <= 0) return;
    const todayOffset = today.getTime() - startDate.getTime();
    const contentWidth = timelineRef.current.scrollWidth;
    const viewportWidth = timelineRef.current.clientWidth;
    const todayPx = (todayOffset / totalDuration) * contentWidth;
    timelineRef.current.scrollLeft = todayPx - viewportWidth / 2;
  }, [startDate, endDate]);

  const beginTimelineDateDrag = useCallback((taskId: string, edge: 'start' | 'end' | 'move', clientX: number) => {
    const task = tasksWithDates.find(t => t.id === taskId);
    if (!task || !onTaskUpdate || !timelineRef.current) return;

    if (edge === 'move') {
      const initialStartDate = task.startDate ? new Date(task.startDate) : new Date();
      const initialEndDate = task.dueDate ? new Date(task.dueDate) : new Date();

      setDragState({
        taskId,
        edge: 'move',
        initialX: clientX,
        initialDate: initialStartDate,
        initialEndDate,
        startX: clientX
      });
    } else {
      const initialDate = edge === 'start'
        ? (task.startDate ? new Date(task.startDate) : new Date())
        : (task.dueDate ? new Date(task.dueDate) : new Date());

      setDragState({
        taskId,
        edge,
        initialX: clientX,
        initialDate,
        startX: clientX
      });
    }

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
  }, [tasksWithDates, onTaskUpdate]);

  const handleDragStart = (taskId: string, edge: 'start' | 'end' | 'move', e: React.MouseEvent) => {
    if (dependencyDragState) return; // Don't start task drag if in dependency mode
    e.stopPropagation();
    e.preventDefault();
    beginTimelineDateDrag(taskId, edge, e.clientX);
  };

  const handleManualTimelineGestureStart = (taskId: string, e: React.MouseEvent) => {
    if (sortBy !== 'manual' || dependencyDragState || !onTaskUpdate) return;
    if ((e.target as HTMLElement).closest('.drag-handle') || (e.target as HTMLElement).closest('.connection-node') || (e.target as HTMLElement).closest('button')) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    manualTimelineGestureRef.current = {
      taskId,
      startX: e.clientX,
      startY: e.clientY,
      mode: 'pending'
    };
    setDraggedTaskId(taskId);
    lastManualDragTargetRef.current = null;
  };

  const handleManualTimelineGestureMove = (e: React.MouseEvent<HTMLDivElement>): boolean => {
    const gesture = manualTimelineGestureRef.current;
    if (!gesture) return false;

    if (gesture.mode === 'pending') {
      const dx = e.clientX - gesture.startX;
      const dy = e.clientY - gesture.startY;
      if (Math.abs(dx) < DRAG_AXIS_THRESHOLD && Math.abs(dy) < DRAG_AXIS_THRESHOLD) {
        return true;
      }

      if (Math.abs(dx) >= Math.abs(dy)) {
        manualTimelineGestureRef.current = { ...gesture, mode: 'reschedule' };
        setDraggedTaskId(null);
        beginTimelineDateDrag(gesture.taskId, 'move', e.clientX);
        return true;
      }

      manualTimelineGestureRef.current = { ...gesture, mode: 'reorder' };
    }

    if (manualTimelineGestureRef.current?.mode === 'reorder') {
      if (!timelineRef.current) return true;
      const rect = timelineRef.current.getBoundingClientRect();
      const mouseY = e.clientY - rect.top + timelineRef.current.scrollTop;
      const rowIndex = Math.max(0, Math.min(flattenedTasks.length - 1, Math.floor(mouseY / 60)));
      const targetTaskId = getReorderableTaskId(rowIndex);

      if (!targetTaskId || targetTaskId === gesture.taskId) return true;
      if (lastManualDragTargetRef.current === targetTaskId) return true;

      moveTaskInManualOrder(gesture.taskId, targetTaskId);
      lastManualDragTargetRef.current = targetTaskId;
      return true;
    }

    if (manualTimelineGestureRef.current?.mode === 'reschedule' && !dragState) {
      return true;
    }

    return false;
  };

  const handleDragMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Handle version dragging
    if (versionDragState && timelineRef.current && updateVersion) {
      console.log('[Version Drag] Moving version:', versionDragState.versionId, versionDragState.edge);
      const contentWidth = timelineRef.current.scrollWidth;
      const totalDuration = endDate.getTime() - startDate.getTime();
      const deltaX = e.clientX - versionDragState.startX;
      const msPerPixel = totalDuration / contentWidth;

      // Snap to day boundaries
      const daysMoved = Math.round((deltaX * msPerPixel) / (24 * 60 * 60 * 1000));
      if (daysMoved === 0) return;
      console.log('[Version Drag] Days moved:', daysMoved);

      if (versionDragState.edge === 'move') {
        let newStartDate = new Date(versionDragState.initialStartDate);
        newStartDate.setDate(newStartDate.getDate() + daysMoved);
        newStartDate.setHours(0, 0, 0, 0);

        const duration = versionDragState.initialEndDate.getTime() - versionDragState.initialStartDate.getTime();
        let newEndDate = new Date(newStartDate.getTime() + duration);

        updateVersion(versionDragState.versionId, {
          started_at: newStartDate.toISOString(),
          targetDate: newEndDate.toISOString()
        });
      } else if (versionDragState.edge === 'start') {
        let newStartDate = new Date(versionDragState.initialStartDate);
        newStartDate.setDate(newStartDate.getDate() + daysMoved);
        newStartDate.setHours(0, 0, 0, 0);

        if (newStartDate < versionDragState.initialEndDate) {
          updateVersion(versionDragState.versionId, {
            started_at: newStartDate.toISOString()
          });
        }
      } else if (versionDragState.edge === 'end') {
        let newEndDate = new Date(versionDragState.initialEndDate);
        newEndDate.setDate(newEndDate.getDate() + daysMoved);
        newEndDate.setHours(0, 0, 0, 0);

        if (newEndDate > versionDragState.initialStartDate) {
          updateVersion(versionDragState.versionId, {
            targetDate: newEndDate.toISOString()
          });
        }
      }
      return;
    }

    if (sortBy === 'manual' && handleManualTimelineGestureMove(e)) return;
    if (!dragState || !timelineRef.current || !onTaskUpdate) return;

    // Use scrollWidth (content width), not rect.width (viewport width)
    // Task bars are positioned as percentages of content width
    const contentWidth = timelineRef.current.scrollWidth;
    const totalDuration = endDate.getTime() - startDate.getTime();

    // Calculate exact pixel movement in content coordinates
    const deltaX = e.clientX - dragState.startX;

    // Calculate days moved for snapping - use zoom-appropriate granularity
    const msPerPixel = totalDuration / contentWidth;
    let daysMoved: number;
    if (zoomLevel === 'month') {
      // Snap to week boundaries in month view for smoother dragging
      daysMoved = Math.round((deltaX * msPerPixel) / (7 * 24 * 60 * 60 * 1000)) * 7;
    } else {
      daysMoved = Math.round((deltaX * msPerPixel) / (24 * 60 * 60 * 1000));
    }

    // Skip update if no visual change yet - prevents unnecessary re-renders
    if (daysMoved === 0) return;

    const task = tasksWithDates.find((t) => t.id === dragState.taskId);
    if (!task) return;

    // Check if this is a subtask and get parent constraints
    const isSubtask = task.id.includes('-subtask-');
    let parentTask: TaskProjection | undefined;
    let subtaskIndex: number = -1;
    let parentStartDate: Date | null = null;
    let parentEndDate: Date | null = null;

    if (isSubtask) {
      const parentId = task.id.split('-subtask-')[0];
      subtaskIndex = parseInt(task.id.split('-subtask-')[1]);
      parentTask = tasks.find(t => t.id === parentId);
      if (parentTask && parentTask.startDate && parentTask.dueDate) {
        parentStartDate = new Date(parentTask.startDate);
        parentEndDate = new Date(parentTask.dueDate);
      }
    }

    if (dragState.edge === 'move') {
      // Move entire task - snap to day boundaries
      let newStartDate = new Date(dragState.initialDate);
      newStartDate.setDate(newStartDate.getDate() + daysMoved);
      newStartDate.setHours(0, 0, 0, 0);

      const duration = dragState.initialEndDate
        ? dragState.initialEndDate.getTime() - dragState.initialDate.getTime()
        : DEFAULT_TASK_DURATION_DAYS * 24 * 60 * 60 * 1000;

      let newEndDate = new Date(newStartDate.getTime() + duration);

      // Constrain subtask to parent bounds
      if (isSubtask && parentStartDate && parentEndDate) {
        if (newStartDate < parentStartDate) {
          newStartDate = new Date(parentStartDate);
          newEndDate = new Date(newStartDate.getTime() + duration);
        }
        if (newEndDate > parentEndDate) {
          newEndDate = new Date(parentEndDate);
          newStartDate = new Date(newEndDate.getTime() - duration);
          // Ensure start doesn't go before parent start
          if (newStartDate < parentStartDate) {
            newStartDate = new Date(parentStartDate);
            newEndDate = new Date(parentEndDate);
          }
        }
      }

      // Update subtask within parent or update regular task
      if (isSubtask && parentTask && subtaskIndex >= 0) {
        const updatedSubtasks = [...(parentTask.subtasks || [])];
        if (updatedSubtasks[subtaskIndex]) {
          updatedSubtasks[subtaskIndex] = {
            ...updatedSubtasks[subtaskIndex],
            customProperties: {
              ...updatedSubtasks[subtaskIndex].customProperties,
              startDate: newStartDate.toISOString(),
              dueDate: newEndDate.toISOString()
            }
          };
          onTaskUpdate(parentTask.id, { subtasks: updatedSubtasks });
        } else {
          // Subtask not found at expected index
        }
      } else {
        // Move parent task and shift subtask dates to preserve relative offsets
        const movingTask = tasks.find(t => t.id === dragState.taskId);
        if (movingTask?.subtasks && movingTask.subtasks.length > 0 && movingTask.startDate) {
          const oldStart = new Date(movingTask.startDate).getTime();
          const shiftMs = newStartDate.getTime() - oldStart;
          const updatedSubtasks = movingTask.subtasks.map(st => {
            if (st.customProperties?.startDate && st.customProperties?.dueDate) {
              return {
                ...st,
                customProperties: {
                  ...st.customProperties,
                  startDate: new Date(new Date(st.customProperties.startDate).getTime() + shiftMs).toISOString(),
                  dueDate: new Date(new Date(st.customProperties.dueDate).getTime() + shiftMs).toISOString()
                }
              };
            }
            return st;
          });
          onTaskUpdate(dragState.taskId, {
            startDate: newStartDate.toISOString(),
            dueDate: newEndDate.toISOString(),
            subtasks: updatedSubtasks
          });
        } else {
          onTaskUpdate(dragState.taskId, {
            startDate: newStartDate.toISOString(),
            dueDate: newEndDate.toISOString()
          });
        }

        if (rescheduleDepcendencies) {
          enforceDependencyConstraints(dragState.taskId);
        }
      }
    } else if (dragState.edge === 'start') {
      let newDate = new Date(dragState.initialDate);
      newDate.setDate(newDate.getDate() + daysMoved);
      newDate.setHours(0, 0, 0, 0);

      // Ensure minimum duration of 1 day
      const currentEnd = task.dueDate ? new Date(task.dueDate) : new Date();
      if (newDate >= currentEnd) {
        newDate.setTime(currentEnd.getTime() - 24 * 60 * 60 * 1000);
      }

      // Constrain subtask start to parent bounds
      if (isSubtask && parentStartDate && parentEndDate) {
        if (newDate < parentStartDate) {
          newDate = new Date(parentStartDate);
        }
      }

      // Update subtask within parent or update regular task
      if (isSubtask && parentTask && subtaskIndex >= 0) {
        const updatedSubtasks = [...(parentTask.subtasks || [])];
        if (updatedSubtasks[subtaskIndex]) {
          const currentDueDate = updatedSubtasks[subtaskIndex].customProperties?.dueDate || task.dueDate;
          updatedSubtasks[subtaskIndex] = {
            ...updatedSubtasks[subtaskIndex],
            customProperties: {
              ...updatedSubtasks[subtaskIndex].customProperties,
              startDate: newDate.toISOString(),
              dueDate: currentDueDate
            }
          };
          onTaskUpdate(parentTask.id, { subtasks: updatedSubtasks });
        }
      } else {
        // When resizing parent start edge, clamp subtasks that would fall outside
        const resizingTask = tasks.find(t => t.id === dragState.taskId);
        if (resizingTask?.subtasks && resizingTask.subtasks.length > 0) {
          const newParentStart = newDate.getTime();
          const updatedSubtasks = resizingTask.subtasks.map(st => {
            if (st.customProperties?.startDate) {
              const stStart = new Date(st.customProperties.startDate).getTime();
              if (stStart < newParentStart) {
                return {
                  ...st,
                  customProperties: {
                    ...st.customProperties,
                    startDate: newDate.toISOString(),
                    dueDate: st.customProperties.dueDate && new Date(st.customProperties.dueDate).getTime() < newParentStart
                      ? newDate.toISOString()
                      : st.customProperties.dueDate
                  }
                };
              }
            }
            return st;
          });
          onTaskUpdate(dragState.taskId, { startDate: newDate.toISOString(), subtasks: updatedSubtasks });
        } else {
          onTaskUpdate(dragState.taskId, { startDate: newDate.toISOString() });
        }
      }
    } else {
      let newDate = new Date(dragState.initialDate);
      newDate.setDate(newDate.getDate() + daysMoved);
      newDate.setHours(0, 0, 0, 0);

      // Ensure minimum duration of 1 day
      const currentStart = task.startDate ? new Date(task.startDate) : new Date();
      if (newDate <= currentStart) {
        newDate.setTime(currentStart.getTime() + 24 * 60 * 60 * 1000);
      }

      // Constrain subtask end to parent bounds
      if (isSubtask && parentStartDate && parentEndDate) {
        if (newDate > parentEndDate) {
          newDate = new Date(parentEndDate);
        }
      }

      // Update subtask within parent or update regular task
      if (isSubtask && parentTask && subtaskIndex >= 0) {
        const updatedSubtasks = [...(parentTask.subtasks || [])];
        if (updatedSubtasks[subtaskIndex]) {
          const currentStartDate = updatedSubtasks[subtaskIndex].customProperties?.startDate || task.startDate;
          updatedSubtasks[subtaskIndex] = {
            ...updatedSubtasks[subtaskIndex],
            customProperties: {
              ...updatedSubtasks[subtaskIndex].customProperties,
              startDate: currentStartDate,
              dueDate: newDate.toISOString()
            }
          };
          onTaskUpdate(parentTask.id, { subtasks: updatedSubtasks });
        }
      } else {
        // When resizing parent end edge, clamp subtasks that would fall outside
        const resizingTask = tasks.find(t => t.id === dragState.taskId);
        if (resizingTask?.subtasks && resizingTask.subtasks.length > 0) {
          const newParentEnd = newDate.getTime();
          const updatedSubtasks = resizingTask.subtasks.map(st => {
            if (st.customProperties?.dueDate) {
              const stEnd = new Date(st.customProperties.dueDate).getTime();
              if (stEnd > newParentEnd) {
                return {
                  ...st,
                  customProperties: {
                    ...st.customProperties,
                    dueDate: newDate.toISOString(),
                    startDate: st.customProperties.startDate && new Date(st.customProperties.startDate).getTime() > newParentEnd
                      ? newDate.toISOString()
                      : st.customProperties.startDate
                  }
                };
              }
            }
            return st;
          });
          onTaskUpdate(dragState.taskId, { dueDate: newDate.toISOString(), subtasks: updatedSubtasks });
        } else {
          onTaskUpdate(dragState.taskId, { dueDate: newDate.toISOString() });
        }
      }
    }
  };

  const handleDragEnd = () => {
    // Only clear regular task drag state here
    // Dependency drag is handled by window-level useEffect
    manualTimelineGestureRef.current = null;
    setDraggedTaskId(null);
    setDraggedVersionId(null);
    lastManualDragTargetRef.current = null;
    if (dragState) {
      setDragState(null);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    } else if (versionDragState) {
      setVersionDragState(null);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    } else {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
  };

  // Handle connection node drag for dependencies
  const handleConnectionDragStart = (taskId: string, node: 'start' | 'end', e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDependencyDragState({
      sourceTaskId: taskId,
      sourceNode: node,
      mouseX: e.clientX,
      mouseY: e.clientY
    });
    document.body.style.cursor = 'crosshair';
    document.body.style.userSelect = 'none';
  };

  // Check if adding a dependency would create a cycle (or self-reference)
  const wouldCreateCycle = useCallback((sourceId: string, targetId: string): boolean => {
    if (sourceId === targetId) return true; // Self-reference guard
    const visited = new Set<string>();
    const stack = [targetId];

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      if (currentId === sourceId) return true;
      if (visited.has(currentId)) continue;

      visited.add(currentId);
      const currentTask = tasks.find(t => t.id === currentId);
      if (currentTask?.dependencies) {
        currentTask.dependencies.forEach(dep => stack.push(dep.taskId));
      }
    }

    return false;
  }, [tasks]);

  // Window-level event listeners for dependency drag (reliable drop detection)
  useEffect(() => {
    if (!dependencyDragState) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      setDependencyDragState(prev => prev ? {
        ...prev,
        mouseX: e.clientX,
        mouseY: e.clientY
      } : null);
    };

    const handleWindowMouseUp = (e: MouseEvent) => {
      if (!onTaskUpdate) {
        setDependencyDragState(null);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        return;
      }

      const sourceTaskId = dependencyDragState.sourceTaskId;

      // Find the task element under the cursor using DOM
      const element = document.elementFromPoint(e.clientX, e.clientY);
      const taskBar = element?.closest('.task-bar');
      const targetTaskId = taskBar?.getAttribute('data-task-id');

      if (targetTaskId && targetTaskId !== sourceTaskId) {
        // Prevent dependencies on subtasks
        if (!targetTaskId.includes('-subtask-') && !sourceTaskId.includes('-subtask-')) {
          const sourceTask = tasks.find(t => t.id === sourceTaskId);
          const targetTask = tasks.find(t => t.id === targetTaskId);
          if (targetTask && sourceTask) {
            const dependencies = targetTask.dependencies || [];
            const exists = dependencies.some(dep => dep.taskId === sourceTaskId);

            if (!exists && !wouldCreateCycle(sourceTaskId, targetTaskId)) {
              // Create the dependency
              onTaskUpdate(targetTaskId, {
                dependencies: [...dependencies, {
                  taskId: sourceTaskId,
                  type: 'finish-to-start' as const
                }]
              });

              // Run authoritative constraint enforcement from the predecessor
              // This will push the successor (and its successors) forward if needed
              enforceDependencyConstraints(sourceTaskId);

              // Show visual feedback
              const depKey = `${targetTaskId}-${sourceTaskId}`;
              setNewlyCreatedDependency(depKey);
              setTimeout(() => setNewlyCreatedDependency(null), 2000);
              console.log('[Dependency] Created:', sourceTaskId, '→', targetTaskId);
            }
          }
        }
      }

      setDependencyDragState(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [dependencyDragState, tasks, onTaskUpdate, wouldCreateCycle, enforceDependencyConstraints]);

  // Remove dependency and log for debugging
  const handleRemoveDependency = (taskId: string, depTaskId: string) => {
    if (!onTaskUpdate) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const dependencies = (task.dependencies || []).filter(dep => dep.taskId !== depTaskId);
    onTaskUpdate(taskId, { dependencies });
    setHoveredDependency(null); // Clear hover state immediately
    console.log('[Dependency] Deleted:', depTaskId, '→', taskId);
  };

  // Handle timeline hover for tasks without dates
  const handleTimelineHover = (e: React.MouseEvent<HTMLDivElement>, taskIndex: number) => {
    if (dragState || dependencyDragState || !timelineRef.current || !timelineContentRef.current) return;

    const task = flattenedTasks[taskIndex];
    if (task.startDate && task.dueDate) return;

    const contentRect = timelineContentRef.current.getBoundingClientRect();
    const contentWidth = timelineContentRef.current.scrollWidth;
    const mouseX = Math.max(0, Math.min(contentWidth, e.clientX - contentRect.left + timelineRef.current.scrollLeft));
    const totalDuration = endDate.getTime() - startDate.getTime();
    const clickedTime = startDate.getTime() + (mouseX / contentWidth) * totalDuration;
    const snappedDate = new Date(clickedTime);
    snappedDate.setHours(0, 0, 0, 0);

    const previewWidth = 200;
    const previewHeight = 48;
    const offset = 14;
    const timelineRect = timelineRef.current.getBoundingClientRect();
    const minX = Math.max(8, timelineRect.left + 8);
    const minY = Math.max(8, timelineRect.top + 8);
    const maxX = Math.min(window.innerWidth - previewWidth - 8, timelineRect.right - previewWidth - 8);
    const maxY = Math.min(window.innerHeight - previewHeight - 8, timelineRect.bottom - previewHeight - 8);
    const cursorX = Math.max(minX, Math.min(maxX, e.clientX + offset));
    const cursorY = Math.max(minY, Math.min(maxY, e.clientY + offset));

    setHoverPreview({
      taskId: task.id,
      show: true,
      cursorX,
      cursorY,
      snappedDateLabel: snappedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    });
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>, taskIndex: number) => {
    if (!hoverPreview || !onTaskUpdate || !timelineRef.current || !timelineContentRef.current) return;

    const task = flattenedTasks[taskIndex];
    if (task.startDate && task.dueDate) return;

    const contentRect = timelineContentRef.current.getBoundingClientRect();
    const contentWidth = timelineContentRef.current.scrollWidth;
    const mouseX = Math.max(0, Math.min(contentWidth, e.clientX - contentRect.left + timelineRef.current.scrollLeft));
    const totalDuration = endDate.getTime() - startDate.getTime();
    const clickedTime = startDate.getTime() + (mouseX / contentWidth) * totalDuration;

    const newStartDate = new Date(clickedTime);
    newStartDate.setHours(0, 0, 0, 0);
    const newDueDate = new Date(newStartDate.getTime() + DEFAULT_TASK_DURATION_DAYS * 24 * 60 * 60 * 1000);

    onTaskUpdate(task.id, {
      startDate: newStartDate.toISOString(),
      dueDate: newDueDate.toISOString()
    });

    setHoverPreview(null);
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

  const toggleSubtasks = (taskId: string) => {
    setExpandedSubtasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleTaskClick = (taskId: string, multiSelect: boolean = false) => {
    if (multiSelect) {
      setSelectedTaskIds(prev => {
        const next = new Set(prev);
        if (next.has(taskId)) {
          next.delete(taskId);
        } else {
          next.add(taskId);
        }
        return next;
      });
    } else {
      setSelectedTaskIds(new Set([taskId]));
    }
    onTaskClick(taskId);
  };

  const startEditingTask = (taskId: string, currentTitle: string) => {
    setEditingTaskId(taskId);
    setEditingValue(currentTitle);
  };

  const saveTaskEdit = () => {
    if (editingTaskId && editingValue.trim() && onTaskUpdate) {
      onTaskUpdate(editingTaskId, { title: editingValue.trim() });
    }
    setEditingTaskId(null);
    setEditingValue('');
  };

  const cancelTaskEdit = () => {
    setEditingTaskId(null);
    setEditingValue('');
  };

  const createSubtask = (parentTaskId: string) => {
    if (!onTaskUpdate) return;

    const parentTask = tasks.find(t => t.id === parentTaskId);
    if (!parentTask) return;

    const newSubtask = {
      id: `temp-${Date.now()}`,
      text: 'New Subtask',
      isCompleted: false,
      lineIndex: (parentTask.subtasks?.length || 0) + 1
    };

    onTaskUpdate(parentTaskId, {
      subtasks: [...(parentTask.subtasks || []), newSubtask]
    });

    // Auto-expand subtasks when adding
    setExpandedSubtasks(prev => new Set(prev).add(parentTaskId));
  };

  const deleteTask = (taskId: string) => {
    if (onTaskDelete) {
      onTaskDelete(taskId);
    } else if (onTaskUpdate) {
      // Fallback: mark as completed if no delete handler
      onTaskUpdate(taskId, { status: 'completed' as TaskStatus });
    }
  };

  // Version drag handlers
  const beginVersionDrag = useCallback((versionId: string, edge: 'start' | 'end' | 'move', clientX: number) => {
    const version = versions.find(v => v.id === versionId);
    if (!version || !updateVersion || !timelineRef.current) return;

    const initialStartDate = version.started_at ? new Date(version.started_at) : new Date();
    const initialEndDate = version.targetDate ? new Date(version.targetDate) : new Date();

    setVersionDragState({
      versionId,
      edge,
      initialX: clientX,
      initialStartDate,
      initialEndDate,
      startX: clientX
    });

    setDraggedVersionId(versionId);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
  }, [versions, updateVersion]);

  const handleVersionDragStart = (versionId: string, edge: 'start' | 'end' | 'move', e: React.MouseEvent) => {
    console.log('[Version Drag] Starting drag:', versionId, edge);
    e.stopPropagation();
    e.preventDefault();
    beginVersionDrag(versionId, edge, e.clientX);
  };

  const getReorderableTaskId = useCallback((index: number): string | null => {
    const task = flattenedTasks[index];
    if (!task) return null;
    if (!task.id.includes('-subtask-')) return task.id;
    return task.parentTaskId || null;
  }, [flattenedTasks]);

  const moveTaskInManualOrder = useCallback((sourceTaskId: string, targetTaskId: string) => {
    setManualOrder(prev => {
      const allTaskIds = tasks.map(t => t.id);
      const fallbackOrder = new Map<string, number>(allTaskIds.map((id, idx) => [id, idx]));
      const ordered = [...allTaskIds].sort((a, b) => {
        const aOrder = prev[a] ?? fallbackOrder.get(a) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = prev[b] ?? fallbackOrder.get(b) ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
      });

      const sourceIndex = ordered.indexOf(sourceTaskId);
      const targetIndex = ordered.indexOf(targetTaskId);
      if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
        return prev;
      }

      const [moved] = ordered.splice(sourceIndex, 1);
      ordered.splice(targetIndex, 0, moved);

      const next: Record<string, number> = {};
      ordered.forEach((id, idx) => {
        next[id] = idx;
      });

      const sameKeys = Object.keys(prev).length === Object.keys(next).length;
      if (sameKeys && Object.keys(next).every(id => prev[id] === next[id])) {
        return prev;
      }
      return next;
    });
  }, [tasks]);

  // Manual reorder tasks
  const handleTaskDragStart = (taskId: string, e?: React.DragEvent) => {
    if (sortBy !== 'manual') return;
    const target = e?.target as HTMLElement | undefined;
    if (target?.closest('button') || target?.closest('.drag-handle') || target?.closest('.connection-node')) {
      e?.preventDefault();
      return;
    }
    if (e?.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', taskId);
    }
    setDraggedTaskId(taskId);
    lastManualDragTargetRef.current = null;
  };

  const handleTaskDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (sortBy !== 'manual' || !draggedTaskId) return;

    const targetTaskId = getReorderableTaskId(index);
    if (!targetTaskId || targetTaskId === draggedTaskId) return;
    if (lastManualDragTargetRef.current === targetTaskId) return;

    moveTaskInManualOrder(draggedTaskId, targetTaskId);
    lastManualDragTargetRef.current = targetTaskId;
  };

  const handleTaskDragEnd = () => {
    setDraggedTaskId(null);
    lastManualDragTargetRef.current = null;
  };

  // Synchronize scroll between task list and timeline without feedback loops.
  const handleTaskListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    if (isSyncingScrollRef.current === 'tasklist') {
      isSyncingScrollRef.current = null;
      return;
    }
    isSyncingScrollRef.current = 'timeline';
    timelineRef.current.scrollTop = e.currentTarget.scrollTop;
  };

  const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (taskListRef.current && isSyncingScrollRef.current !== 'timeline') {
      isSyncingScrollRef.current = 'tasklist';
      taskListRef.current.scrollTop = e.currentTarget.scrollTop;
    } else if (isSyncingScrollRef.current === 'timeline') {
      isSyncingScrollRef.current = null;
    }

    // Capture scroll values before setTimeout (React events are pooled)
    const element = e.currentTarget;
    const scrollLeft = element.scrollLeft;
    const scrollWidth = element.scrollWidth;
    const clientWidth = element.clientWidth;
    const scrollRight = scrollWidth - scrollLeft - clientWidth;

    // Debounce the extension check
    if (scrollExtensionTimer.current) {
      clearTimeout(scrollExtensionTimer.current);
    }

    scrollExtensionTimer.current = setTimeout(() => {
      // Only extend one direction per cycle to keep scroll compensation accurate
      if (scrollLeft < 200 && timelineExtension.before < 10 && !pendingLeftExtensionRef.current) {
        // Capture scrollWidth RIGHT before triggering the state update.
        // useLayoutEffect will read the new scrollWidth after DOM commit and add the delta.
        preExtensionScrollWidthRef.current = timelineRef.current?.scrollWidth ?? 0;
        pendingLeftExtensionRef.current = true;
        setTimelineExtension(prev => ({
          before: prev.before + 1,
          after: prev.after
        }));
      } else if (scrollRight < 200 && timelineExtension.after < 10) {
        // Right extension: no scroll compensation needed
        setTimelineExtension(prev => ({
          before: prev.before,
          after: prev.after + 1
        }));
      }
    }, 100);
  };

  useEffect(() => {
    if (!leftPanelCollapsed && timelineRef.current && taskListRef.current) {
      taskListRef.current.scrollTop = timelineRef.current.scrollTop;
    }
  }, [leftPanelCollapsed]);

  return (
    <div
      className="h-full flex flex-col overflow-hidden gantt-view-container"
      onMouseMove={(e) => {
        handleDragMove(e);
      }}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
    >
      {/* Controls */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 transition-[padding]" style={detailPanelOpen ? { paddingRight: '26rem' } : undefined}>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handlePrevious}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={scrollToToday} className="text-xs">
            Today
          </Button>
          <span className="text-sm font-medium ml-2">
            {columns[0]?.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>

          <div className="mx-4 w-px h-6 bg-white/10" />

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="pl-9 w-64 h-9 bg-black/20 border-white/10"
            />
          </div>

          {/* Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "relative",
                  (filters.status.length > 0 || filters.priority.length > 0 || filters.hypercubeFaces.length > 0) &&
                  "bg-purple-500/20 border-purple-500 border-2 shadow-lg shadow-purple-500/20"
                )}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filter
                {(filters.status.length > 0 || filters.priority.length > 0 || filters.hypercubeFaces.length > 0) && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-purple-500 text-white rounded-full">
                    {filters.status.length + filters.priority.length + filters.hypercubeFaces.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-black/90 border-white/20 gantt-scrollbar max-h-80 overflow-y-auto w-56">
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(['not_started', 'in_progress', 'blocked', 'completed'] as TaskStatus[]).map(status => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={filters.status.includes(status)}
                  onCheckedChange={(checked) => {
                    setFilters(prev => ({
                      ...prev,
                      status: checked
                        ? [...prev.status, status]
                        : prev.status.filter(s => s !== status)
                    }));
                  }}
                >
                  {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Priority</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {['low', 'medium', 'high', 'urgent'].map(priority => (
                <DropdownMenuCheckboxItem
                  key={priority}
                  checked={filters.priority.includes(priority)}
                  onCheckedChange={(checked) => {
                    setFilters(prev => ({
                      ...prev,
                      priority: checked
                        ? [...prev.priority, priority]
                        : prev.priority.filter(p => p !== priority)
                    }));
                  }}
                >
                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Hypercube Face</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {HYPERCUBE_FACE_TAGS.map(face => (
                <DropdownMenuCheckboxItem
                  key={face}
                  checked={filters.hypercubeFaces.includes(face)}
                  onCheckedChange={(checked) => {
                    setFilters(prev => ({
                      ...prev,
                      hypercubeFaces: checked
                        ? [...prev.hypercubeFaces, face]
                        : prev.hypercubeFaces.filter(f => f !== face)
                    }));
                  }}
                >
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: HYPERCUBE_FACE_COLORS[face] }} />
                    {face}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                Sort: {sortBy}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-black/90 border-white/20 gantt-scrollbar">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSortBy('manual')}>Manual Order</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('dueDate')}>Due Date</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('priority')}>Priority</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('status')}>Status</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('title')}>Title</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('assignee')}>Assignee</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Color By */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Color: {colorBy}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-black/90 border-white/20 gantt-scrollbar">
              <DropdownMenuLabel>Color by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setColorBy('default')}>Default</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setColorBy('status')}>Status</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setColorBy('priority')}>Priority</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setColorBy('assignee')}>Assignee</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Dependencies
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-black/90 border-white/20 gantt-scrollbar">
              <DropdownMenuCheckboxItem
                checked={rescheduleDepcendencies}
                onCheckedChange={setRescheduleDependencies}
              >
                Auto-reschedule dependencies
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
        {/* Left Panel - Task List (collapsible) */}
        {!leftPanelCollapsed && (
          <div
            ref={taskListRef}
            className="w-80 border-r border-white/10 overflow-y-auto gantt-scrollbar shrink-0"
            onScroll={handleTaskListScroll}
            style={{ scrollbarGutter: 'stable' }}
          >
            <div className="sticky top-0 bg-black/40 backdrop-blur-sm z-10 border-b border-white/10 px-4 py-3 flex items-center justify-between">
              <div className="text-xs font-medium text-muted-foreground">Task Name</div>
              <button
                onClick={() => setLeftPanelCollapsed(true)}
                className="text-muted-foreground hover:text-white transition-colors"
                title="Collapse panel"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            {/* Spacer to align with version lanes on timeline */}
            <div style={{ height: `${positionedVersions.length * 48}px` }} />

            <div className="py-2">
              {flattenedTasks.map((task, index) => {
                const isHovered = hoveredTaskId === task.id;
                const isEditing = editingTaskId === task.id;
                const isSelected = selectedTaskIds.has(task.id);
                const hasChildren = task.children && task.children.length > 0;
                const hasSubtasks = task.subtasks && task.subtasks.length > 0;
                const isSubtask = task.id.includes('-subtask-');
                const isDraggable = sortBy === 'manual' && !isSubtask;

                return (
                  <div
                    key={task.id}
                    draggable={isDraggable}
                    onDragStart={(e) => handleTaskDragStart(task.id, e)}
                    onDragOver={(e) => handleTaskDragOver(e, index)}
                    onDragEnd={handleTaskDragEnd}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer border-b border-white/5 group",
                      isSelected && "bg-purple-500/10 border-l-2 border-l-purple-500",
                      isSubtask && "bg-white/5",
                      draggedTaskId === task.id && "opacity-50"
                    )}
                    style={{
                      paddingLeft: `${16 + (task.depth || 0) * 24}px`,
                      height: '60px'
                    }}
                    onClick={(e) => handleTaskClick(task.id, e.ctrlKey || e.metaKey)}
                    onMouseEnter={() => setHoveredTaskId(task.id)}
                    onMouseLeave={() => setHoveredTaskId(null)}
                  >
                    {/* Manual drag handle */}
                    {isDraggable && (
                      <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 cursor-grab" />
                    )}

                    {/* Expand/Collapse for children */}
                    {hasChildren && !isSubtask && (
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

                    {/* Expand/Collapse for subtasks */}
                    {hasSubtasks && !hasChildren && !isSubtask && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSubtasks(task.id);
                        }}
                        className="shrink-0"
                      >
                        {task.subtasksExpanded ? (
                          <ChevronDown className="w-4 h-4 text-purple-400" />
                        ) : (
                          <ChevronRightIcon className="w-4 h-4 text-purple-400" />
                        )}
                      </button>
                    )}

                    {/* Task Title */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveTaskEdit();
                              if (e.key === 'Escape') cancelTaskEdit();
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-7 text-sm bg-black/40 border-white/20"
                            autoFocus
                          />
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={saveTaskEdit}>
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={cancelTaskEdit}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium truncate">{task.title}</div>
                            {!task.startDate && !task.dueDate && (
                              <div className="flex items-center gap-1 text-[10px] text-purple-400/60 shrink-0" title="Click timeline to schedule">
                                <Calendar className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                          {task.hypercubeTags && task.hypercubeTags.length > 0 && (
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
                        </>
                      )}
                    </div>

                    {/* Hover Actions */}
                    {isHovered && !isEditing && !isSubtask && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingTask(task.id, task.title);
                          }}
                          title="Rename task"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            createSubtask(task.id);
                          }}
                          title="Add subtask"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTaskToDelete({ id: task.id, title: task.title });
                          }}
                          title="Delete task"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {flattenedTasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Calendar className="w-12 h-12 mb-4 opacity-50" />
                <p>No tasks found</p>
                <p className="text-xs mt-2">Click "Add Task" button above to create your first task</p>
              </div>
            )}
          </div>
        )}

        {/* Collapsed panel toggle */}
        {leftPanelCollapsed && (
          <div className="border-r border-white/10 flex flex-col items-center py-3 px-1 shrink-0">
            <button
              onClick={() => setLeftPanelCollapsed(false)}
              className="text-muted-foreground hover:text-white transition-colors"
              title="Expand panel"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Right Panel - Timeline Chart */}
        <div
          className="flex-1 overflow-x-auto overflow-y-auto gantt-scrollbar"
          ref={timelineRef}
          onScroll={handleTimelineScroll}
        >
          <div className="min-w-max" style={{ width: zoomLevel === 'day' ? '300%' : zoomLevel === 'week' ? '200%' : '150%', minHeight: '100%' }}>
            {/* Timeline Header */}
            <div className="flex border-b border-white/10 sticky top-0 bg-black/70 backdrop-blur-lg z-20">
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
            <div
              ref={timelineContentRef}
              className="relative"
              style={{ minHeight: `100vh` }}
            >
              {/* Grid Lines */}
              <div className="absolute inset-0 flex">
                {columns.map((_, i) => (
                  <div key={i} className="flex-1 min-w-[120px] border-r border-white/10" />
                ))}
              </div>

              {/* Row backgrounds for hover */}
              {flattenedTasks.map((task, i) => {
                const versionLanesOffset = positionedVersions.length * 48;
                return (
                  <div
                    key={`row-${task.id}`}
                    className="absolute inset-x-0 h-[60px] hover:bg-white/5 transition-colors"
                    style={{ top: `${i * 60 + versionLanesOffset}px` }}
                    onMouseMove={(e) => handleTimelineHover(e, i)}
                    onMouseLeave={() => setHoverPreview(null)}
                    onClick={(e) => handleTimelineClick(e, i)}
                  />
                );
              })}

              {/* Today Indicator - gradient purple line */}
              <div
                className="absolute top-0 bottom-0 w-[2px] z-20 pointer-events-none"
                style={{
                  left: `${todayPosition}%`,
                  background: 'linear-gradient(to bottom, rgba(168, 85, 247, 1), rgba(139, 92, 246, 0.6), rgba(168, 85, 247, 0.2))',
                }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-purple-500 shadow-lg shadow-purple-500/50" />
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-purple-300 bg-purple-950/80 px-1.5 py-0.5 rounded-sm whitespace-nowrap border border-purple-500/30">
                  Today
                </div>
              </div>

              {/* Hover Preview */}
              {hoverPreview?.show && (
                <div
                  className="fixed pointer-events-none z-[120]"
                  style={{
                    left: `${hoverPreview.cursorX}px`,
                    top: `${hoverPreview.cursorY}px`,
                    width: '200px',
                    height: '48px',
                  }}
                >
                  <Card className="h-full border-purple-500 border-dashed bg-purple-500/10 flex items-center justify-between px-3">
                    <span className="text-xs text-purple-300">Click to schedule</span>
                    <span className="text-[10px] text-purple-200/90">{hoverPreview.snappedDateLabel}</span>
                  </Card>
                </div>
              )}

              {/* Version Bars - Pipeline markers in dedicated lanes */}
              {positionedVersions.map(({ version, left, width }, idx) => {
                const versionColor = version.color || TYPE_LABEL_COLORS[version.type_label] || '#8B5CF6';
                // Calculate progress based on OKRs
                const versionOKRs = allOKRs.filter(okr => okr.versionId === version.id);
                const progressPercent = versionOKRs.length > 0
                  ? Math.round(versionOKRs.reduce((sum, okr) => sum + calculateOKRProgress(okr), 0) / versionOKRs.length)
                  : 0;

                return (
                  <div
                    key={version.id}
                    className={cn(
                      "absolute h-10 z-10 group/version",
                      draggedVersionId === version.id && "opacity-50"
                    )}
                    style={{
                      left,
                      width,
                      top: `${idx * 48}px`, // Stack versions in dedicated lanes below date header
                    }}
                  >
                    <Card
                      className="h-full px-3 py-2 border-2 hover:shadow-xl transition-all relative select-none cursor-move group"
                      style={{
                        background: `linear-gradient(135deg, ${versionColor}20 0%, ${versionColor}08 100%)`,
                        borderColor: `${versionColor}80`,
                        overflow: 'visible',
                      }}
                      onClick={(e) => {
                        // Don't trigger click if we just finished dragging
                        if (versionDragState || draggedVersionId) {
                          e.stopPropagation();
                          return;
                        }
                        onVersionClick?.(version.id);
                      }}
                      onMouseDown={(e) => {
                        if (!(e.target as HTMLElement).closest('.drag-handle')) {
                          handleVersionDragStart(version.id, 'move', e);
                        }
                      }}
                    >
                      {/* Left drag handle (start date) */}
                      <div
                        className="drag-handle absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
                        style={{ background: `linear-gradient(to right, ${versionColor}80, transparent)` }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleVersionDragStart(version.id, 'start', e);
                        }}
                        title="Drag to adjust start date"
                      >
                        <div className="w-1 h-6 rounded-full" style={{ backgroundColor: versionColor }} />
                      </div>

                      {/* Progress fill */}
                      <div
                        className="absolute inset-0 transition-all pointer-events-none"
                        style={{
                          width: `${progressPercent}%`,
                          background: `linear-gradient(90deg, ${versionColor}30, ${versionColor}15)`,
                        }}
                      />

                      {/* Sticky version info container */}
                      <div className="sticky left-0 flex items-center gap-2 h-full relative z-[1] pr-3 bg-gradient-to-r from-black/60 to-transparent" style={{ width: 'fit-content', maxWidth: '300px' }}>
                        <div
                          className="flex items-center justify-center w-6 h-6 rounded-md shrink-0 font-bold text-[10px]"
                          style={{
                            backgroundColor: `${versionColor}25`,
                            borderColor: `${versionColor}`,
                            border: '2px solid',
                            color: versionColor,
                          }}
                        >
                          {version.type_label[0]}
                        </div>
                        <span className="text-sm font-semibold truncate" style={{ color: versionColor }}>
                          {version.name}
                        </span>
                        <span className="text-[10px] opacity-70 ml-auto shrink-0 font-medium" style={{ color: versionColor }}>
                          {progressPercent}%
                        </span>
                      </div>

                      {/* Right drag handle (end date) */}
                      <div
                        className="drag-handle absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
                        style={{ background: `linear-gradient(to left, ${versionColor}80, transparent)` }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleVersionDragStart(version.id, 'end', e);
                        }}
                        title="Drag to adjust end date"
                      >
                        <div className="w-1 h-6 rounded-full" style={{ backgroundColor: versionColor }} />
                      </div>
                    </Card>
                  </div>
                );
              })}

              {/* Task Bars */}
              {positionedTasks.map(({ task, left, width }, i) => {
                const isSelected = selectedTaskIds.has(task.id);
                const isSubtask = task.id.includes('-subtask-');
                const taskIndex = flattenedTasks.findIndex(t => t.id === task.id);
                const versionLanesOffset = positionedVersions.length * 48; // Offset for version lanes

                return (
                  <div
                    key={task.id}
                    data-task-id={task.id}
                    className={cn(
                      "absolute group task-bar",
                      draggedTaskId === task.id && "opacity-50",
                      isSelected && "z-10"
                    )}
                    style={{
                      left,
                      width,
                      top: `${taskIndex * 60 + versionLanesOffset}px`,
                      height: '60px',
                      padding: '6px 0',
                    }}
                  >
                    <Card
                      className={cn(
                        "h-full px-3 py-2 hover:border-purple-500/50 transition-all relative overflow-visible select-none",
                        `bg-gradient-to-r ${getTaskColor(task)}`,
                        isSelected && "border-purple-500 shadow-lg shadow-purple-500/20",
                        isSubtask && "opacity-90 border-l-2 border-l-purple-400/50",
                        dependencyDragState && dependencyDragState.sourceTaskId !== task.id && !isSubtask && "ring-1 ring-purple-500/30"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTaskClick(task.id, e.ctrlKey || e.metaKey);
                      }}
                      onMouseDown={(e) => {
                        if (sortBy === 'manual') {
                          handleManualTimelineGestureStart(task.id, e);
                          return;
                        }
                        if (
                          onTaskUpdate &&
                          !dependencyDragState &&
                          !(e.target as HTMLElement).closest('.drag-handle') &&
                          !(e.target as HTMLElement).closest('.connection-node') &&
                          !(e.target as HTMLElement).closest('button')
                        ) {
                          handleDragStart(task.id, 'move', e);
                        }
                      }}
                      style={{
                        cursor: dependencyDragState
                          ? 'crosshair'
                          : sortBy === 'manual'
                            ? 'grab'
                            : (onTaskUpdate ? 'move' : 'pointer'),
                        userSelect: 'none'
                      }}
                    >
                      {/* Progress fill */}
                      {task.completionPercent > 0 && (
                        <div
                          className="absolute inset-0 bg-purple-500/20 rounded-l transition-all pointer-events-none"
                          style={{ width: `${task.completionPercent}%` }}
                        />
                      )}

                      {/* Start connection node */}
                      {onTaskUpdate && !isSubtask && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center">
                          <div
                            className="connection-node w-3 h-3 bg-purple-500 border-2 border-white rounded-full cursor-pointer hover:scale-125 transition-transform"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              handleConnectionDragStart(task.id, 'start', e);
                            }}
                            title="Drag to create dependency"
                          />
                          <div className="w-3 h-0.5 bg-purple-500" />
                        </div>
                      )}

                      {/* Start drag handle */}
                      {onTaskUpdate && (
                        <div
                          className="drag-handle absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize hover:bg-purple-500/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleDragStart(task.id, 'start', e);
                          }}
                        >
                          <GripVertical className="w-4 h-4 text-white drop-shadow-lg" />
                        </div>
                      )}

                      <div className="flex items-center justify-between h-full relative z-[1]">
                        {/* Subtask expand/collapse toggle on timeline block */}
                        {!isSubtask && task.subtasks && task.subtasks.length > 0 && (
                          <button
                            className="shrink-0 mr-1 flex items-center justify-center w-6 h-6 rounded text-[#A78BFA] hover:text-[#C4B5FD] hover:bg-white/10 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSubtasks(task.id);
                            }}
                            title={expandedSubtasks.has(task.id) ? 'Collapse subtasks' : 'Expand subtasks'}
                          >
                            {expandedSubtasks.has(task.id) ? (
                              <ChevronDown className="w-5 h-5" />
                            ) : (
                              <ChevronRightIcon className="w-5 h-5" />
                            )}
                          </button>
                        )}
                        <div className="flex-1 min-w-0 mr-2">
                          <div className="text-xs font-medium truncate">{task.title}</div>
                          {task.subtasks && task.subtasks.length > 0 && (
                            <div className="text-[10px] text-white/50 truncate mt-0.5">
                              {task.completionPercent}% complete
                            </div>
                          )}
                        </div>
                        {!isSubtask && (
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
                        )}
                      </div>

                      {/* End drag handle */}
                      {onTaskUpdate && (
                        <div
                          className="drag-handle absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize hover:bg-purple-500/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleDragStart(task.id, 'end', e);
                          }}
                        >
                          <GripVertical className="w-4 h-4 text-white drop-shadow-lg" />
                        </div>
                      )}

                      {/* End connection node */}
                      {onTaskUpdate && !isSubtask && (
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center">
                          <div className="w-3 h-0.5 bg-purple-500" />
                          <div
                            className="connection-node w-3 h-3 bg-purple-500 border-2 border-white rounded-full cursor-pointer hover:scale-125 transition-transform"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              handleConnectionDragStart(task.id, 'end', e);
                            }}
                            title="Drag to create dependency"
                          />
                        </div>
                      )}
                    </Card>
                  </div>
                );
              })}

              {/* Dependency drag line */}
              {dependencyDragState && timelineRef.current && (() => {
                // Use DOM-measured pivot, fallback to computed
                const sourcePivot = measuredPivotsRef.current.get(dependencyDragState.sourceTaskId);
                const sourceTask = positionedTasks.find(pt => pt.task.id === dependencyDragState.sourceTaskId);
                if (!sourcePivot && !sourceTask) return null;

                const sourceIndex = flattenedTasks.findIndex(t => t.id === dependencyDragState.sourceTaskId);
                const rect = timelineRef.current.getBoundingClientRect();
                const contentWidth = timelineRef.current.scrollWidth;

                const sourceY = sourcePivot?.centerY ?? (sourceIndex !== -1 ? sourceIndex * 60 + 30 : 30);
                const sourceX = dependencyDragState.sourceNode === 'end'
                  ? (sourcePivot?.rightPx ?? (sourceTask ? ((sourceTask.leftPct + sourceTask.widthPct) / 100) * contentWidth : 0))
                  : (sourcePivot?.leftPx ?? (sourceTask ? (sourceTask.leftPct / 100) * contentWidth : 0));

                // Mouse position relative to timeline content (in pixels)
                // Offset slightly so arrow tip appears at cursor
                const mouseX = dependencyDragState.mouseX - rect.left + timelineRef.current.scrollLeft;
                const mouseY = dependencyDragState.mouseY - rect.top + timelineRef.current.scrollTop - 5;

                return (
                  <svg className="absolute inset-0 pointer-events-none z-30" style={{ overflow: 'visible' }}>
                    <defs>
                      <marker
                        id="drag-arrow"
                        markerWidth="10"
                        markerHeight="8"
                        refX="10"
                        refY="4"
                        orient="auto"
                        markerUnits="userSpaceOnUse"
                      >
                        <path d="M0,0 L10,4 L0,8 z" fill="rgba(196, 167, 255, 1)" />
                      </marker>
                    </defs>
                    <line
                      x1={sourceX}
                      y1={sourceY}
                      x2={mouseX}
                      y2={mouseY}
                      stroke="rgba(196, 167, 255, 1)"
                      strokeWidth="2"
                      strokeDasharray="5,5"
                      markerEnd="url(#drag-arrow)"
                    />
                  </svg>
                );
              })()}

              {/* Render dependency lines and subtask connection lines in SVG */}
              {/* pointer-events: none on SVG root, individual <g> elements opt-in with pointer-events-auto */}
              <svg
                className="absolute top-0 left-0 z-[15]"
                style={{
                  pointerEvents: 'none',
                  overflow: 'visible',
                  width: '100%',
                  height: `${flattenedTasks.length * 60}px`
                }}
              >
                <defs>
                  {/* Create arrow markers for each dependency */}
                  {tasksWithDates.map((task, taskIndex) => {
                    if (!task.dependencies || task.dependencies.length === 0) return null;
                    return task.dependencies.map((dep, depIndex) => (
                      <marker
                        key={`marker-${task.id}-${depIndex}`}
                        id={`arrow-${task.id}-${depIndex}`}
                        markerWidth="10"
                        markerHeight="8"
                        refX="10"
                        refY="4"
                        orient="auto"
                        markerUnits="userSpaceOnUse"
                      >
                        <path d="M0,0 L10,4 L0,8 z" fill="rgba(196, 167, 255, 0.7)" />
                      </marker>
                    ));
                  })}
                </defs>

                {/* Dependency lines */}
                {tasksWithDates.map((task, taskIndex) => {
                  if (!task.dependencies || task.dependencies.length === 0) return null;

                  return task.dependencies.map((dep, depIndex) => {
                    // Skip invalid dependencies
                    if (dep.taskId.includes('-subtask-')) return null;
                    if (task.id.includes('-subtask-')) return null;

                    // Use DOM-measured pivot points for accurate connector placement
                    const sourcePivot = measuredPivotsRef.current.get(dep.taskId);
                    const targetPivot = measuredPivotsRef.current.get(task.id);

                    // Fallback to computed positions if DOM measurements not yet available
                    const sourceIndex = flattenedTasks.findIndex(t => t.id === dep.taskId);
                    const targetIndex = flattenedTasks.findIndex(t => t.id === task.id);
                    if (sourceIndex === -1 || targetIndex === -1) return null;

                    const sourcePositioned = positionedTasks.find(pt => pt.task.id === dep.taskId);
                    const targetPositioned = positionedTasks.find(pt => pt.task.id === task.id);
                    if (!sourcePositioned || !targetPositioned) return null;

                    const contentWidth = timelineRef.current?.scrollWidth || 1;
                    const srcX = sourcePivot?.rightPx ?? ((sourcePositioned.leftPct + sourcePositioned.widthPct) / 100) * contentWidth;
                    const tgtX = targetPivot?.leftPx ?? (targetPositioned.leftPct / 100) * contentWidth;
                    const sourceY = sourcePivot?.centerY ?? (sourceIndex * 60 + 30);
                    const targetY = targetPivot?.centerY ?? (targetIndex * 60 + 30);

                    // Orthogonal (right-angle) routing like Notion/ClickUp Gantt charts
                    // Pattern: horizontal from source → vertical to target row → horizontal into target
                    let pathD: string;
                    const gap = tgtX - srcX;
                    const horizontalStub = 12; // Short horizontal segment out of task edge

                    if (gap > horizontalStub * 2 + 4) {
                      // Normal case: enough space for midpoint routing
                      pathD = `M ${srcX} ${sourceY} L ${srcX + horizontalStub} ${sourceY} L ${srcX + horizontalStub} ${targetY} L ${tgtX} ${targetY}`;
                    } else {
                      // Overlapping or close: route around via above/below
                      const detourX = Math.max(srcX + horizontalStub, tgtX + horizontalStub + 20);
                      const midY = sourceY < targetY
                        ? sourceY + 30 + 8  // Below source row
                        : sourceY - 30 - 8; // Above source row
                      pathD = `M ${srcX} ${sourceY} L ${detourX} ${sourceY} L ${detourX} ${midY} L ${tgtX - horizontalStub} ${midY} L ${tgtX - horizontalStub} ${targetY} L ${tgtX} ${targetY}`;
                    }

                    const depKey = `${task.id}-${dep.taskId}`;
                    // Place delete button at the vertical segment midpoint
                    const btnX = gap > horizontalStub * 2 + 4
                      ? srcX + horizontalStub
                      : (srcX + tgtX) / 2;
                    const btnY = (sourceY + targetY) / 2;

                    return (
                      // Hover on <g> so moving between path and button doesn't dismiss
                      <g
                        key={`dep-${task.id}-${dep.taskId}-${depIndex}`}
                        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                        onMouseEnter={() => setHoveredDependency(depKey)}
                        onMouseLeave={() => setHoveredDependency(null)}
                      >
                        {/* Invisible wider path for easier hover detection */}
                        <path
                          d={pathD}
                          stroke="transparent"
                          strokeWidth="14"
                          fill="none"
                          style={{ cursor: 'pointer' }}
                        />
                        {/* Visible dependency line - light purple */}
                        <path
                          d={pathD}
                          stroke={
                            newlyCreatedDependency === depKey
                              ? "rgba(34, 197, 94, 0.9)"
                              : hoveredDependency === depKey
                                ? "rgba(196, 167, 255, 0.95)"
                                : "rgba(196, 167, 255, 0.5)"
                          }
                          strokeWidth={
                            newlyCreatedDependency === depKey || hoveredDependency === depKey ? "3" : "1.5"
                          }
                          fill="none"
                          markerEnd={`url(#arrow-${task.id}-${depIndex})`}
                          style={{ pointerEvents: 'none' }}
                          className={newlyCreatedDependency === depKey ? "animate-pulse" : undefined}
                        />
                        {hoveredDependency === depKey && (
                          <foreignObject
                            x={btnX - 14}
                            y={btnY - 14}
                            width="28"
                            height="28"
                            style={{ pointerEvents: 'auto', overflow: 'visible' }}
                          >
                            <button
                              className="w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 hover:scale-110 flex items-center justify-center transition-all shadow-lg border-2 border-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveDependency(task.id, dep.taskId);
                              }}
                              title="Click to remove dependency"
                            >
                              <X className="w-4 h-4 text-white" />
                            </button>
                          </foreignObject>
                        )}
                      </g>
                    );
                  });
                })}

                {/* Subtask connection lines */}
                {positionedTasks.map(({ task }, idx) => {
                  const isSubtask = task.id.includes('-subtask-');
                  if (!isSubtask) return null;

                  const parentId = task.id.split('-subtask-')[0];
                  const parentPositioned = positionedTasks.find(pt => pt.task.id === parentId);
                  if (!parentPositioned) return null;

                  // Use DOM-measured pivots, fallback to computed
                  const subtaskPivot = measuredPivotsRef.current.get(task.id);
                  const parentPivot = measuredPivotsRef.current.get(parentId);

                  const subtaskIndex = flattenedTasks.findIndex(t => t.id === task.id);
                  const parentIndex = flattenedTasks.findIndex(t => t.id === parentId);
                  if (subtaskIndex === -1 || parentIndex === -1) return null;

                  const contentWidth = timelineRef.current?.scrollWidth || 1;
                  const subtaskY = subtaskPivot?.centerY ?? (subtaskIndex * 60 + 30);
                  const parentY = parentPivot?.centerY ?? (parentIndex * 60 + 30);
                  const subtaskLeftPx = subtaskPivot?.leftPx ?? ((positionedTasks[idx].leftPct / 100) * contentWidth);
                  const parentLeftPx = parentPivot?.leftPx ?? ((parentPositioned.leftPct / 100) * contentWidth);

                  // L-shaped elbow routing: vertical down from parent, then horizontal to subtask
                  const pathD = `M ${parentLeftPx} ${parentY} L ${parentLeftPx} ${subtaskY} L ${subtaskLeftPx} ${subtaskY}`;

                  return (
                    <path
                      key={`subtask-line-${task.id}`}
                      d={pathD}
                      stroke="rgba(196, 167, 255, 0.3)"
                      strokeWidth="1"
                      strokeDasharray="4,2"
                      fill="none"
                    />
                  );
                })}
              </svg>
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

      {/* Delete/Archive Task Confirmation Dialog */}
      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent className="bg-black/95 border-purple-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-purple-400">What would you like to do with this task?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              Choose how to handle <span className="font-semibold text-white">"{taskToDelete?.title}"</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="bg-white/10 border-white/20 hover:bg-white/20 mt-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (taskToDelete && onTaskUpdate) {
                  // Archive the task
                  onTaskUpdate(taskToDelete.id, { isArchived: true });
                  setTaskToDelete(null);
                }
              }}
              className="bg-purple-500 hover:bg-purple-600 text-white mt-0"
            >
              Archive
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                if (taskToDelete) {
                  deleteTask(taskToDelete.id);
                  setTaskToDelete(null);
                }
              }}
              className="bg-red-500 hover:bg-red-600 text-white mt-0"
            >
              Permanently Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
