'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DatePicker } from '@/components/ui/date-picker';
import { FaceTagSelector } from './face-tag-selector';
import { AssigneeMultiSelect } from './assignee-multi-select';
import { parseAssignees, serializeAssignees } from './assignee-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TaskProjection, TaskStatus, TaskPriority, SubtaskProjection } from '@/types/plan-types';
import { HYPERCUBE_FACE_COLORS } from '@/types/plan-types';
import {
  ArrowUpDown,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  EyeOff,
  Plus,
  GripVertical,
  Archive,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCXDStore } from '@/store/cxd-store';
import type { HypercubeFaceTag } from '@/types/canvas-elements';

interface TableViewProps {
  tasks: TaskProjection[];
  onTaskClick: (taskId: string) => void;
  onTaskNavigate: (taskId: string) => void;
  onTaskUpdate: (taskId: string, updates: Partial<TaskProjection>) => void;
}

type SortDirection = 'asc' | 'desc';
type BuiltInColumnId = 'status' | 'title' | 'hypercubeTags' | 'priority' | 'dueDate' | 'progress' | 'assignee' | 'version';
type ColumnId = BuiltInColumnId | `custom:${string}`;

interface TableColumnDef {
  id: ColumnId;
  label: string;
  sortable?: boolean;
  minWidth: number;
  defaultWidth: number;
}

interface SubtaskRow {
  type: 'subtask';
  key: string;
  parent: TaskProjection;
  subtask: SubtaskProjection;
  subtaskIndex: number;
}

interface TaskRow {
  type: 'task';
  key: string;
  task: TaskProjection;
}

type DisplayRow = TaskRow | SubtaskRow;

const BASE_COLUMNS: TableColumnDef[] = [
  { id: 'status', label: 'Status', sortable: true, minWidth: 140, defaultWidth: 170 },
  { id: 'title', label: 'Title', sortable: true, minWidth: 260, defaultWidth: 360 },
  { id: 'hypercubeTags', label: 'Faces', minWidth: 170, defaultWidth: 210 },
  { id: 'priority', label: 'Priority', sortable: true, minWidth: 140, defaultWidth: 160 },
  { id: 'dueDate', label: 'Due Date', sortable: true, minWidth: 180, defaultWidth: 210 },
  { id: 'progress', label: 'Progress', sortable: true, minWidth: 150, defaultWidth: 180 },
  { id: 'assignee', label: 'Assignee', sortable: true, minWidth: 150, defaultWidth: 180 },
  { id: 'version', label: 'Version', sortable: true, minWidth: 140, defaultWidth: 170 },
];

const DEFAULT_VISIBLE_COLUMNS: ColumnId[] = ['status', 'title', 'hypercubeTags', 'priority', 'dueDate', 'progress'];

const STATUS_ICONS = {
  not_started: Circle,
  in_progress: Clock,
  blocked: AlertCircle,
  completed: CheckCircle2,
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  not_started: '#6B7280',
  in_progress: '#3B82F6',
  blocked: '#EF4444',
  completed: '#10B981',
};

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'completed', label: 'Completed' },
];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: '#EF4444',
  high: '#F97316',
  medium: '#EAB308',
  low: '#22C55E',
};

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

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

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return 'Unassigned';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return 'Unassigned';
};

export function TableView({ tasks, onTaskClick, onTaskNavigate, onTaskUpdate }: TableViewProps) {
  const versions = useCXDStore((state) => state.getVersions());
  const [sortField, setSortField] = useState<ColumnId>('dueDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [groupBy, setGroupBy] = useState<string>(() => {
    if (typeof window === 'undefined') return 'status';
    return localStorage.getItem('table-group-by') || 'status';
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(() => {
    return readLocalStorageJson<ColumnId[]>('table-visible-columns', DEFAULT_VISIBLE_COLUMNS);
  });
  const [groupOrderByField, setGroupOrderByField] = useState<Record<string, string[]>>(() => {
    return readLocalStorageJson<Record<string, string[]>>('table-group-order', {});
  });
  const [customColumnKeys, setCustomColumnKeys] = useState<string[]>(() => {
    return readLocalStorageJson<string[]>('table-custom-columns', []);
  });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    return readLocalStorageJson<Record<string, number>>('table-column-widths', {});
  });
  const [newPropertyName, setNewPropertyName] = useState('');
  const [editingTitleTaskId, setEditingTitleTaskId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');

  const resizeRef = useRef<{ columnId: string; startX: number; startWidth: number } | null>(null);
  const draggedColumnRef = useRef<ColumnId | null>(null);
  const draggedGroupRef = useRef<string | null>(null);

  const discoveredCustomKeys = useMemo(
    () => Array.from(new Set(tasks.flatMap(task => Object.keys(task.customProperties || {})))).sort(),
    [tasks]
  );

  const allCustomKeys = useMemo(
    () => Array.from(new Set([...customColumnKeys, ...discoveredCustomKeys])).sort(),
    [customColumnKeys, discoveredCustomKeys]
  );

  const allColumns = useMemo<TableColumnDef[]>(() => {
    const customColumns: TableColumnDef[] = allCustomKeys.map((key) => ({
      id: `custom:${key}`,
      label: key,
      sortable: true,
      minWidth: 150,
      defaultWidth: 180,
    }));
    return [...BASE_COLUMNS, ...customColumns];
  }, [allCustomKeys]);

  const allColumnMap = useMemo(() => new Map(allColumns.map(col => [col.id, col])), [allColumns]);

  useEffect(() => {
    localStorage.setItem('table-visible-columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem('table-custom-columns', JSON.stringify(customColumnKeys));
  }, [customColumnKeys]);

  useEffect(() => {
    localStorage.setItem('table-column-widths', JSON.stringify(columnWidths));
  }, [columnWidths]);

  useEffect(() => {
    localStorage.setItem('table-group-by', groupBy);
  }, [groupBy]);
  useEffect(() => {
    localStorage.setItem('table-group-order', JSON.stringify(groupOrderByField));
  }, [groupOrderByField]);

  useEffect(() => {
    setVisibleColumns(prev => {
      const valid = prev.filter(id => allColumnMap.has(id));
      if (valid.length > 0) return valid;
      return DEFAULT_VISIBLE_COLUMNS.filter(id => allColumnMap.has(id));
    });
  }, [allColumnMap]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const resizeState = resizeRef.current;
      if (!resizeState) return;
      const column = allColumnMap.get(resizeState.columnId as ColumnId);
      if (!column) return;

      const nextWidth = Math.max(column.minWidth, resizeState.startWidth + (event.clientX - resizeState.startX));
      setColumnWidths(prev => {
        if (prev[resizeState.columnId] === nextWidth) return prev;
        return { ...prev, [resizeState.columnId]: nextWidth };
      });
    };

    const onMouseUp = () => {
      if (resizeRef.current) {
        resizeRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [allColumnMap]);

  const visibleColumnDefs = useMemo(
    () => visibleColumns.map(id => allColumnMap.get(id)).filter((col): col is TableColumnDef => Boolean(col)),
    [allColumnMap, visibleColumns]
  );

  const hiddenColumnDefs = useMemo(
    () => allColumns.filter(col => !visibleColumns.includes(col.id)),
    [allColumns, visibleColumns]
  );

  const getColumnWidth = (column: TableColumnDef) => {
    return Math.max(column.minWidth, columnWidths[column.id] ?? column.defaultWidth);
  };

  const getTaskValue = (task: TaskProjection, columnId: string): unknown => {
    if (columnId.startsWith('custom:')) {
      const key = columnId.replace('custom:', '');
      return task.customProperties?.[key];
    }

    switch (columnId as BuiltInColumnId) {
      case 'status':
        return task.status;
      case 'title':
        return task.title;
      case 'hypercubeTags':
        return task.hypercubeTags[0] || 'Unassigned';
      case 'priority':
        return task.priority || 'Unassigned';
      case 'dueDate':
        return task.dueDate || '';
      case 'progress':
        return task.completionPercent;
      case 'assignee':
        return task.assignee || 'Unassigned';
      case 'version': {
        const versionId = task.taskMetadata?.versionId;
        if (!versionId) return 'Unversioned';
        const version = versions.find((v) => v.id === versionId);
        return version?.name || 'Unknown';
      }
      default:
        return '';
    }
  };

  const sortedTasks = useMemo(() => {
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, Unassigned: 4 };
    const statusOrder: Record<TaskStatus, number> = { in_progress: 0, not_started: 1, blocked: 2, completed: 3 };
    const multiplier = sortDirection === 'asc' ? 1 : -1;

    return [...tasks].sort((a, b) => {
      const aValue = getTaskValue(a, sortField);
      const bValue = getTaskValue(b, sortField);

      if (sortField === 'priority') {
        return multiplier * ((priorityOrder[formatValue(aValue)] ?? 99) - (priorityOrder[formatValue(bValue)] ?? 99));
      }

      if (sortField === 'status') {
        return multiplier * ((statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99));
      }

      if (sortField === 'dueDate') {
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return multiplier * (aDate - bDate);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return multiplier * (aValue - bValue);
      }

      return multiplier * formatValue(aValue).localeCompare(formatValue(bValue));
    });
  }, [tasks, sortField, sortDirection]);

  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: 'All Tasks', color: '#A78BFA', tasks: sortedTasks }];
    }

    const groups = new Map<string, TaskProjection[]>();
    sortedTasks.forEach(task => {
      const raw = getTaskValue(task, groupBy);
      const isEmpty = raw === null || raw === undefined || raw === '';
      const label = isEmpty ? 'Ungrouped' : formatValue(raw);
      const key = `${groupBy}:${label}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(task);
    });

    const getGroupColor = (property: string, value: string) => {
      if (property === 'status') {
        const v = value.toLowerCase().replace(' ', '_') as TaskStatus;
        return STATUS_COLORS[v] || '#A78BFA';
      }
      if (property === 'priority') {
        return PRIORITY_COLORS[value.toLowerCase() as TaskPriority] || '#A78BFA';
      }
      if (property === 'hypercubeTags') {
        return HYPERCUBE_FACE_COLORS[value as keyof typeof HYPERCUBE_FACE_COLORS] || '#A78BFA';
      }
      return '#A78BFA';
    };

    const entries = Array.from(groups.entries()).map(([key, group]) => {
      const label = key.split(':').slice(1).join(':') || 'Unassigned';
      return {
        key,
        label,
        color: getGroupColor(groupBy, label),
        isUngrouped: label === 'Ungrouped',
        tasks: group,
      };
    });

    const preferredOrder = groupOrderByField[groupBy] || [];
    if (preferredOrder.length === 0) {
      return entries.sort((a, b) => Number(a.isUngrouped) - Number(b.isUngrouped));
    }
    const orderIndex = new Map(preferredOrder.map((key, idx) => [key, idx]));
    const ordered = entries.sort((a, b) => (orderIndex.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (orderIndex.get(b.key) ?? Number.MAX_SAFE_INTEGER));
    return ordered.sort((a, b) => Number(a.isUngrouped) - Number(b.isUngrouped));
  }, [groupBy, sortedTasks, groupOrderByField]);

  const startTitleEditing = (task: TaskProjection) => {
    setEditingTitleTaskId(task.id);
    setEditingTitleValue(task.title);
  };

  const saveTitleEditing = (taskId: string) => {
    const nextTitle = editingTitleValue.trim();
    if (nextTitle) {
      onTaskUpdate(taskId, { title: nextTitle });
    }
    setEditingTitleTaskId(null);
    setEditingTitleValue('');
  };

  const groupedRows = useMemo(() => {
    return groupedTasks.map(group => {
      const rows: DisplayRow[] = [];
      group.tasks.forEach(task => {
        rows.push({ type: 'task', key: task.id, task });
        if (expandedSubtasks.has(task.id) && task.subtasks.length > 0) {
          task.subtasks.forEach((subtask, index) => {
            rows.push({
              type: 'subtask',
              key: `${task.id}-subtask-${index}`,
              parent: task,
              subtask,
              subtaskIndex: index,
            });
          });
        }
      });
      return { ...group, rows };
    });
  }, [groupedTasks, expandedSubtasks]);

  const handleSort = (field: ColumnId) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortDirection('asc');
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSubtasks = (taskId: string) => {
    setExpandedSubtasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const startColumnResize = (event: React.MouseEvent, column: TableColumnDef) => {
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = {
      columnId: column.id,
      startX: event.clientX,
      startWidth: getColumnWidth(column),
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const showColumn = (columnId: ColumnId) => {
    setVisibleColumns(prev => (prev.includes(columnId) ? prev : [...prev, columnId]));
  };

  const hideColumn = (columnId: ColumnId) => {
    setVisibleColumns(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(id => id !== columnId);
    });
  };

  const addCustomColumn = () => {
    const key = newPropertyName.trim();
    if (!key) return;
    const columnId = `custom:${key}` as ColumnId;
    setCustomColumnKeys(prev => (prev.includes(key) ? prev : [...prev, key]));
    showColumn(columnId);
    setNewPropertyName('');
  };

  const handleColumnDragStart = (columnId: ColumnId) => {
    draggedColumnRef.current = columnId;
  };

  const handleColumnDragOver = (e: React.DragEvent, targetId: ColumnId) => {
    e.preventDefault();
    const draggedId = draggedColumnRef.current;
    if (!draggedId || draggedId === targetId) return;

    setVisibleColumns(prev => {
      const from = prev.indexOf(draggedId);
      const to = prev.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleColumnDragEnd = () => {
    draggedColumnRef.current = null;
  };

  const handleGroupDragStart = (groupKey: string) => {
    draggedGroupRef.current = groupKey;
  };

  const handleGroupDragOver = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    const draggedKey = draggedGroupRef.current;
    if (!draggedKey || draggedKey === targetKey) return;

    setGroupOrderByField(prev => {
      const allGroupKeys = groupedTasks.map(g => g.key);
      const current = prev[groupBy]?.filter(k => allGroupKeys.includes(k)) || allGroupKeys;
      if (!current.includes(draggedKey)) current.push(draggedKey);
      if (!current.includes(targetKey)) current.push(targetKey);
      const from = current.indexOf(draggedKey);
      const to = current.indexOf(targetKey);
      if (from === -1 || to === -1) return prev;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...prev, [groupBy]: next };
    });
  };

  const handleGroupDragEnd = () => {
    draggedGroupRef.current = null;
  };

  const updateTaskCustomProperty = (task: TaskProjection, key: string, value: string) => {
    const next = { ...(task.customProperties || {}) };
    if (!value.trim()) {
      delete next[key];
    } else {
      next[key] = value;
    }
    onTaskUpdate(task.id, { customProperties: next });
  };

  const updateSubtask = (parent: TaskProjection, subtaskIndex: number, updates: Partial<SubtaskProjection>) => {
    const nextSubtasks = [...parent.subtasks];
    if (!nextSubtasks[subtaskIndex]) return;
    nextSubtasks[subtaskIndex] = { ...nextSubtasks[subtaskIndex], ...updates };
    onTaskUpdate(parent.id, { subtasks: nextSubtasks });
  };

  const updateSubtaskDates = (parent: TaskProjection, subtaskIndex: number, key: 'startDate' | 'dueDate', date?: Date) => {
    const nextSubtasks = [...parent.subtasks];
    if (!nextSubtasks[subtaskIndex]) return;
    const current = nextSubtasks[subtaskIndex];
    nextSubtasks[subtaskIndex] = {
      ...current,
      customProperties: {
        ...(current.customProperties || {}),
        [key]: date?.toISOString(),
      },
    };
    onTaskUpdate(parent.id, { subtasks: nextSubtasks });
  };

  const renderTaskStatusCell = (task: TaskProjection) => {
    const StatusIcon = STATUS_ICONS[task.status];
    const selectedOption = STATUS_OPTIONS.find(opt => opt.value === task.status);

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="w-full rounded-md border border-white/15 bg-black/40 px-2 py-1.5 text-left text-xs hover:bg-white/10 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="flex items-center gap-2">
              <StatusIcon className="w-3.5 h-3.5" style={{ color: STATUS_COLORS[task.status] }} />
              <span>{selectedOption?.label}</span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-black/95 border border-white/15 rounded-xl p-1 min-w-[170px]">
          {STATUS_OPTIONS.map(option => {
            const Icon = STATUS_ICONS[option.value];
            return (
              <DropdownMenuItem
                key={option.value}
                onClick={(e) => {
                  e.stopPropagation();
                  onTaskUpdate(task.id, { status: option.value });
                }}
                className="rounded-lg text-xs"
              >
                <Icon className="w-3.5 h-3.5 mr-2" style={{ color: STATUS_COLORS[option.value] }} />
                {option.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderTaskPriorityCell = (task: TaskProjection) => {
    const activePriority = task.priority;
    const activeLabel = PRIORITY_OPTIONS.find(opt => opt.value === activePriority)?.label || 'None';
    const dotColor = activePriority ? PRIORITY_COLORS[activePriority] : '#6B7280';

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="w-full rounded-md border border-white/15 bg-black/40 px-2 py-1.5 text-left text-xs hover:bg-white/10 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
              {activeLabel}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-black/95 border border-white/15 rounded-xl p-1 min-w-[150px]">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onTaskUpdate(task.id, { priority: undefined });
            }}
            className="rounded-lg text-xs"
          >
            None
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/10" />
          {PRIORITY_OPTIONS.map(option => (
            <DropdownMenuItem
              key={option.value}
              onClick={(e) => {
                e.stopPropagation();
                onTaskUpdate(task.id, { priority: option.value });
              }}
              className="rounded-lg text-xs"
            >
              <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: PRIORITY_COLORS[option.value] }} />
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderCell = (row: DisplayRow, column: TableColumnDef) => {
    if (row.type === 'subtask') {
      const { parent, subtask, subtaskIndex } = row;

      if (column.id === 'title') {
        return (
          <div className="flex items-center gap-2 pl-6" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={subtask.isCompleted}
              onChange={(e) => updateSubtask(parent, subtaskIndex, { isCompleted: e.target.checked })}
              className="rounded border-white/20 bg-black/30"
            />
            <span className={cn('text-sm', subtask.isCompleted && 'line-through text-muted-foreground')}>
              {subtask.text}
            </span>
          </div>
        );
      }

      if (column.id === 'status') {
        return (
          <Badge variant="outline" className="border-white/15 text-xs bg-black/30">
            {subtask.isCompleted ? 'Completed' : 'Not Started'}
          </Badge>
        );
      }

      if (column.id === 'dueDate') {
        return (
          <div className="w-[170px]" onClick={(e) => e.stopPropagation()}>
            <DatePicker
              date={subtask.customProperties?.dueDate ? new Date(subtask.customProperties.dueDate) : undefined}
              onSelect={(date) => updateSubtaskDates(parent, subtaskIndex, 'dueDate', date)}
              placeholder="Set date"
            />
          </div>
        );
      }

      if (column.id === 'progress') {
        return (
          <span className="text-xs text-muted-foreground">{subtask.isCompleted ? '100%' : '0%'}</span>
        );
      }

      return <span className="text-xs text-muted-foreground">-</span>;
    }

    const { task } = row;

    if (column.id === 'status') return renderTaskStatusCell(task);

    if (column.id === 'title') {
      const hasSubtasks = task.subtasks.length > 0;
      const subtasksOpen = expandedSubtasks.has(task.id);
      const isEditing = editingTitleTaskId === task.id;
      return (
        <div className="max-w-xl">
          <div className="flex items-center gap-2">
            {hasSubtasks && (
              <button
                className="shrink-0 text-[#A78BFA] hover:text-[#C4B5FD] transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSubtasks(task.id);
                }}
                title={subtasksOpen ? 'Collapse subtasks' : 'Expand subtasks'}
              >
                {subtasksOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            )}
            <div>
              {isEditing ? (
                <input
                  value={editingTitleValue}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setEditingTitleValue(e.target.value)}
                  onBlur={() => saveTitleEditing(task.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      saveTitleEditing(task.id);
                    }
                    if (e.key === 'Escape') {
                      setEditingTitleTaskId(null);
                      setEditingTitleValue('');
                    }
                  }}
                  className="h-7 min-w-[220px] bg-black/40 border border-white/15 rounded px-2 text-sm"
                />
              ) : (
                <button
                  className="font-medium truncate text-left hover:text-white/90"
                  onClick={(e) => {
                    e.stopPropagation();
                    startTitleEditing(task);
                  }}
                >
                  {task.title}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (column.id === 'hypercubeTags') {
      return (
        <div className="space-y-1.5" onClick={(e) => e.stopPropagation()} title="Hypercube Faces">
          <FaceTagSelector
            compact
            iconOnly
            value={task.hypercubeTags}
            onChange={(next) => onTaskUpdate(task.id, { hypercubeTags: next as HypercubeFaceTag[] })}
          />
          <div className="flex flex-wrap gap-1">
            {task.hypercubeTags.length === 0 && (
              <span className="text-[10px] text-muted-foreground">None</span>
            )}
            {task.hypercubeTags.map(tag => (
              <Badge
                key={tag}
                variant="outline"
                className="text-[10px] border-white/15 px-1.5 py-0"
                style={{ borderColor: HYPERCUBE_FACE_COLORS[tag], color: HYPERCUBE_FACE_COLORS[tag] }}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      );
    }

    if (column.id === 'priority') return renderTaskPriorityCell(task);

    if (column.id === 'dueDate') {
      return (
        <div className="inline-flex w-fit" onClick={(e) => e.stopPropagation()}>
          <DatePicker
            date={task.dueDate ? new Date(task.dueDate) : undefined}
            onSelect={(date) => onTaskUpdate(task.id, { dueDate: date?.toISOString() })}
            placeholder="Set date"
            fitContent
            triggerClassName="!w-fit !px-2 !py-1 text-xs"
          />
        </div>
      );
    }

    if (column.id === 'progress') {
      if (task.totalSubtasks === 0) return <span className="text-xs text-muted-foreground">-</span>;
      return (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Progress value={task.completionPercent} className="h-1.5 w-24" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {task.completedSubtasks}/{task.totalSubtasks}
          </span>
        </div>
      );
    }

    if (column.id === 'assignee') {
      const assignees = parseAssignees(task.assignee);
      return (
        <div title="Assignee" className="space-y-1.5">
          <AssigneeMultiSelect
            compact
            iconOnly
            value={assignees}
            onChange={(next) => onTaskUpdate(task.id, { assignee: serializeAssignees(next) })}
          />
          <div className="flex flex-wrap gap-1">
            {assignees.length === 0 && (
              <span className="text-[10px] text-muted-foreground">Unassigned</span>
            )}
            {assignees.map(name => (
              <Badge key={name} variant="outline" className="text-[10px] border-white/15 bg-black/25 px-1.5 py-0">
                {name}
              </Badge>
            ))}
          </div>
        </div>
      );
    }

    if (column.id === 'version') {
      const versionId = task.taskMetadata?.versionId;
      const version = versionId ? versions.find((v) => v.id === versionId) : null;
      return (
        <div className="flex items-center gap-2">
          {version ? (
            <>
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: version.color }}
              />
              <span className="text-xs text-white/80">{version.name}</span>
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-medium text-white/70 uppercase tracking-wider"
                style={{ backgroundColor: `${version.color}30` }}
              >
                {version.type_label}
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground italic">Unversioned</span>
          )}
        </div>
      );
    }

    if (column.id.startsWith('custom:')) {
      const key = column.id.replace('custom:', '');
      const value = task.customProperties?.[key];
      return (
        <input
          defaultValue={value === undefined || value === null ? '' : String(value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => updateTaskCustomProperty(task, key, e.target.value)}
          className="w-full bg-black/40 border border-white/15 rounded-md px-2 py-1 text-xs"
          placeholder="Set value"
        />
      );
    }

    return <span className="text-xs text-muted-foreground">-</span>;
  };

  return (
    <div className="h-full overflow-auto gantt-scrollbar">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur-sm px-4 py-2 flex items-center justify-between">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs">
              Group By: {groupBy === 'none' ? 'None' : (allColumnMap.get(groupBy as ColumnId)?.label || groupBy)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-black/95 border border-white/15 rounded-xl p-1 min-w-[220px]">
            <DropdownMenuItem onClick={() => setGroupBy('none')} className="rounded-lg text-xs">
              None
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            {allColumns.filter(column => column.id !== 'title' && column.id !== 'dueDate').map(column => (
              <DropdownMenuItem
                key={column.id}
                onClick={() => setGroupBy(column.id)}
                className="rounded-lg text-xs"
              >
                {column.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <table className="w-max min-w-full text-sm border-separate border-spacing-0">
        <thead className="sticky top-[44px] bg-black/70 backdrop-blur-lg z-10">
          <tr>
            {visibleColumnDefs.map(column => (
              <th
                key={column.id}
                draggable
                onDragStart={() => handleColumnDragStart(column.id)}
                onDragOver={(e) => handleColumnDragOver(e, column.id)}
                onDragEnd={handleColumnDragEnd}
                style={{ width: getColumnWidth(column), minWidth: getColumnWidth(column), maxWidth: getColumnWidth(column) }}
                className="relative group border-b border-r border-white/10 px-3 py-2 text-left"
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="w-3 h-3 text-white/35" />
                  {column.sortable ? (
                    <button
                      className="flex items-center gap-1 text-xs font-medium hover:text-white/90"
                      onClick={() => handleSort(column.id)}
                    >
                      {column.label}
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  ) : (
                    <span className="text-xs font-medium">{column.label}</span>
                  )}

                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      hideColumn(column.id);
                    }}
                    title="Hide column"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div
                  className="absolute top-0 right-0 h-full w-2 cursor-col-resize"
                  onMouseDown={(e) => startColumnResize(e, column)}
                />
              </th>
            ))}
            <th className="w-12 min-w-[48px] border-b border-r border-white/10 px-2 py-2 text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-md border border-white/15 bg-black/40 p-1.5 hover:bg-white/10 transition-colors" title="Add or show column">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-black/95 border border-white/15 rounded-xl p-2 min-w-[260px]">
                  <DropdownMenuLabel className="text-xs">Add Existing Property</DropdownMenuLabel>
                  <div className="max-h-44 overflow-y-auto pr-1">
                    {hiddenColumnDefs.length === 0 && (
                      <div className="text-xs text-muted-foreground px-2 py-1">All properties already visible.</div>
                    )}
                    {hiddenColumnDefs.map(column => (
                      <DropdownMenuItem
                        key={column.id}
                        onClick={() => showColumn(column.id)}
                        className="rounded-lg text-xs"
                      >
                        {column.label}
                      </DropdownMenuItem>
                    ))}
                  </div>
                  <DropdownMenuSeparator className="bg-white/10 my-2" />
                  <DropdownMenuLabel className="text-xs">Create Custom Property</DropdownMenuLabel>
                  <div className="px-2 py-1.5 space-y-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      value={newPropertyName}
                      onChange={(e) => setNewPropertyName(e.target.value)}
                      placeholder="Property name"
                      className="w-full h-8 rounded-md border border-white/15 bg-black/40 px-2 text-xs"
                    />
                    <Button size="sm" className="w-full h-8 text-xs" onClick={addCustomColumn}>
                      Create Property
                    </Button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </th>
          </tr>
        </thead>

        <tbody>
          {groupedRows.map(group => {
            const isCollapsed = collapsedGroups.has(group.key);
            return (
              <React.Fragment key={group.key}>
                <tr
                  draggable={groupBy !== 'none'}
                  onDragStart={() => handleGroupDragStart(group.key)}
                  onDragOver={(e) => handleGroupDragOver(e, group.key)}
                  onDragEnd={handleGroupDragEnd}
                  className="cursor-pointer transition-colors"
                  onClick={() => toggleGroup(group.key)}
                  style={{
                    background: `linear-gradient(90deg, ${group.color}20 0%, ${group.color}10 28%, rgba(255,255,255,0.03) 100%)`,
                  }}
                >
                  <td colSpan={visibleColumnDefs.length + 1} className="border-b border-r border-white/10 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {groupBy !== 'none' && <GripVertical className="w-3.5 h-3.5 text-white/40" />}
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
                      <span>{group.label}</span>
                      <Badge variant="secondary" className="ml-1">{group.tasks.length}</Badge>
                    </div>
                  </td>
                </tr>

                {!isCollapsed && group.rows.map(row => {
                  const rowTaskId = row.type === 'task' ? row.task.id : row.parent.id;
                  return (
                    <tr
                      key={row.key}
                      className={cn(
                        'transition-colors hover:bg-white/5',
                        row.type === 'subtask' && 'bg-white/3'
                      )}
                      onClick={() => onTaskClick(rowTaskId)}
                    >
                      {visibleColumnDefs.map(column => (
                        <td key={`${row.key}-${column.id}`} className="border-b border-r border-white/10 px-3 py-2 align-middle">
                          {renderCell(row, column)}
                        </td>
                      ))}
                      <td className="border-b border-r border-white/10 px-2 py-2 text-right">
                        {row.type === 'task' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 mr-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTaskUpdate(row.task.id, { isArchived: true });
                            }}
                            title="Archive task"
                          >
                            <Archive className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTaskNavigate(rowTaskId);
                          }}
                        >
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {tasks.length === 0 && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">No tasks found</div>
      )}
    </div>
  );
}
