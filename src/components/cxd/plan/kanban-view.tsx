'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { FaceTagSelector } from './face-tag-selector';
import { AssigneeMultiSelect } from './assignee-multi-select';
import { parseAssignees, serializeAssignees } from './assignee-utils';
import { useCXDStore } from '@/store/cxd-store';
import { extractCenterColor, hexToRgba } from '@/lib/utils';
import type { HypercubeFaceTag } from '@/types/canvas-elements';
import type { TaskPriority, TaskProjection, TaskStatus } from '@/types/plan-types';
import { HYPERCUBE_FACE_COLORS } from '@/types/plan-types';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Calendar,
  User,
  ArrowRight,
  Users,
  Tag,
  ChevronDown,
  Archive,
  Milestone,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface KanbanViewProps {
  tasks: TaskProjection[];
  onTaskClick: (taskId: string) => void;
  onTaskStatusChange: (taskId: string, status: TaskStatus) => void;
  onTaskNavigate: (taskId: string) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<TaskProjection>) => void;
}

type GroupByMode = 'status' | 'priority' | 'assignee' | 'hypercubeFace';

const STATUS_COLUMNS: { id: TaskStatus; label: string; icon: any; color: string }[] = [
  { id: 'not_started', label: 'To Do', icon: Circle, color: '#6B7280' },
  { id: 'in_progress', label: 'In Progress', icon: Clock, color: '#3B82F6' },
  { id: 'blocked', label: 'Blocked', icon: AlertCircle, color: '#EF4444' },
  { id: 'completed', label: 'Done', icon: CheckCircle2, color: '#10B981' },
];

const PRIORITY_COLUMNS: { id: TaskPriority; label: string; color: string }[] = [
  { id: 'urgent', label: 'Urgent', color: '#EF4444' },
  { id: 'high', label: 'High', color: '#F97316' },
  { id: 'medium', label: 'Medium', color: '#EAB308' },
  { id: 'low', label: 'Low', color: '#22C55E' },
];

const GROUPBY_LABELS: Record<GroupByMode, string> = {
  status: 'Status',
  priority: 'Priority',
  assignee: 'Assignee',
  hypercubeFace: 'Hypercube Face',
};

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

const ORDER_STORAGE_KEY = 'kanban-manual-order-v1';

function persistGroupBy(next: GroupByMode) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('kanban-group-by', next);
  }
}

function readGroupBy(): GroupByMode {
  if (typeof window === 'undefined') return 'status';
  const saved = localStorage.getItem('kanban-group-by') as GroupByMode | null;
  return saved && ['status', 'priority', 'assignee', 'hypercubeFace'].includes(saved) ? saved : 'status';
}

const getOrderKey = (groupBy: GroupByMode, columnId: string, taskId: string) => `${groupBy}:${columnId}:${taskId}`;

export function KanbanView({
  tasks,
  onTaskClick,
  onTaskStatusChange,
  onTaskNavigate,
  onTaskUpdate,
}: KanbanViewProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupByMode>(() => readGroupBy());
  const [manualOrder, setManualOrder] = useState<Record<string, number>>(() => readLocalStorageJson<Record<string, number>>(ORDER_STORAGE_KEY, {}));
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const versions = useCXDStore((state) => state.getVersions());

  // Filter tasks by selected version
  const filteredTasks = useMemo(() => {
    if (!selectedVersionId) return tasks;
    return tasks.filter(task => task.taskMetadata?.versionId === selectedVersionId);
  }, [tasks, selectedVersionId]);

  const columns = useMemo(() => {
    if (groupBy === 'status') {
      return STATUS_COLUMNS.map((c) => ({ id: c.id, label: c.label, color: c.color, icon: c.icon }));
    }
    if (groupBy === 'priority') {
      return PRIORITY_COLUMNS.map((c) => ({ id: c.id, label: c.label, color: c.color, icon: Circle }));
    }

    const keys = new Set<string>();
    filteredTasks.forEach((task) => {
      if (groupBy === 'assignee') {
        const firstAssignee = parseAssignees(task.assignee)[0];
        if (firstAssignee) keys.add(firstAssignee);
      }
      if (groupBy === 'hypercubeFace') {
        const firstFace = task.hypercubeTags[0];
        if (firstFace) keys.add(firstFace);
      }
    });

    const dynamic = Array.from(keys).sort().map((key) => ({
      id: key,
      label: key,
      color: groupBy === 'hypercubeFace' ? (HYPERCUBE_FACE_COLORS[key as HypercubeFaceTag] || '#A78BFA') : '#60A5FA',
      icon: groupBy === 'assignee' ? Users : Tag,
    }));

    return [...dynamic, { id: '__ungrouped__', label: 'Ungrouped', color: '#A78BFA', icon: Circle }];
  }, [groupBy, filteredTasks]);

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, TaskProjection[]>();
    columns.forEach((col) => map.set(col.id, []));

    filteredTasks.forEach((task) => {
      let key = '__ungrouped__';
      if (groupBy === 'status') key = task.status;
      if (groupBy === 'priority') key = task.priority || '__ungrouped__';
      if (groupBy === 'assignee') key = parseAssignees(task.assignee)[0] || '__ungrouped__';
      if (groupBy === 'hypercubeFace') key = task.hypercubeTags[0] || '__ungrouped__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    });

    columns.forEach((column) => {
      const list = map.get(column.id) || [];
      list.sort((a, b) => {
        const aOrder = manualOrder[getOrderKey(groupBy, column.id, a.id)] ?? Number.MAX_SAFE_INTEGER;
        const bOrder = manualOrder[getOrderKey(groupBy, column.id, b.id)] ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.title.localeCompare(b.title);
      });
      map.set(column.id, list);
    });

    return map;
  }, [columns, groupBy, filteredTasks, manualOrder]);

  const taskToColumn = useMemo(() => {
    const map = new Map<string, string>();
    columns.forEach((column) => {
      (tasksByColumn.get(column.id) || []).forEach((task) => map.set(task.id, column.id));
    });
    return map;
  }, [columns, tasksByColumn]);

  const persistManualOrder = (next: Record<string, number>) => {
    setManualOrder(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(next));
    }
  };

  const updateTaskForColumn = (taskId: string, columnId: string) => {
    if (groupBy === 'status') {
      onTaskStatusChange(taskId, columnId as TaskStatus);
      return;
    }
    if (!onTaskUpdate) return;

    if (groupBy === 'priority') {
      onTaskUpdate(taskId, { priority: columnId === '__ungrouped__' ? undefined : (columnId as TaskPriority) });
      return;
    }
    if (groupBy === 'assignee') {
      onTaskUpdate(taskId, { assignee: columnId === '__ungrouped__' ? undefined : serializeAssignees([columnId]) });
      return;
    }
    if (groupBy === 'hypercubeFace') {
      onTaskUpdate(taskId, {
        hypercubeTags: columnId === '__ungrouped__' ? [] : [columnId as HypercubeFaceTag],
      });
    }
  };

  const reorderWithinColumn = (columnId: string, draggedId: string, targetId: string) => {
    const currentColumn = taskToColumn.get(draggedId);
    if (!currentColumn || currentColumn !== columnId) return;
    const ordered = [...(tasksByColumn.get(columnId) || [])];
    const from = ordered.findIndex((task) => task.id === draggedId);
    const to = ordered.findIndex((task) => task.id === targetId);
    if (from === -1 || to === -1 || from === to) return;

    const nextOrder = { ...manualOrder };
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    ordered.forEach((task, index) => {
      nextOrder[getOrderKey(groupBy, columnId, task.id)] = index;
    });
    persistManualOrder(nextOrder);
  };

  const handleDrop = (columnId: string) => {
    if (!draggedTaskId) return;

    const previousColumn = taskToColumn.get(draggedTaskId);
    updateTaskForColumn(draggedTaskId, columnId);

    if (previousColumn !== columnId) {
      const list = tasksByColumn.get(columnId) || [];
      const nextOrder = { ...manualOrder };
      const maxOrder = list.reduce((max, task) => {
        const value = nextOrder[getOrderKey(groupBy, columnId, task.id)] ?? -1;
        return Math.max(max, value);
      }, -1);
      nextOrder[getOrderKey(groupBy, columnId, draggedTaskId)] = maxOrder + 1;
      persistManualOrder(nextOrder);
    }

    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur-sm px-6 py-3 flex items-center justify-start gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs">
              Group By: {GROUPBY_LABELS[groupBy]}
              <ChevronDown className="w-3.5 h-3.5 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="z-[220] bg-black/95 border border-white/15 rounded-xl p-1 min-w-[180px] text-white">
            {(['status', 'priority', 'assignee', 'hypercubeFace'] as GroupByMode[]).map((opt) => (
              <DropdownMenuItem
                key={opt}
                onClick={() => {
                  setGroupBy(opt);
                  persistGroupBy(opt);
                }}
                className="rounded-lg text-xs text-white/90"
              >
                {GROUPBY_LABELS[opt]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Version Filter */}
        {versions.length > 0 && (
          selectedVersionId ? (
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-2"
              onClick={() => setSelectedVersionId(null)}
            >
              <Milestone className="w-3.5 h-3.5" />
              {versions.find(v => v.id === selectedVersionId)?.name || 'Version'}
              <X className="w-3 h-3" />
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs gap-1.5">
                  <Milestone className="w-3.5 h-3.5" />
                  Filter by Version
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="z-[220] bg-black/95 border border-white/15 rounded-xl p-1 min-w-[180px] text-white">
                {versions.map((version) => (
                  <DropdownMenuItem
                    key={version.id}
                    onClick={() => setSelectedVersionId(version.id)}
                    className="rounded-lg text-xs text-white/90"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: version.color }}
                      />
                      {version.name}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        )}
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden gantt-scrollbar">
        <div className="flex gap-4 p-6 h-full min-w-max">
          {columns.map((column) => {
            const columnTasks = tasksByColumn.get(column.id) || [];
            const Icon = column.icon;

            return (
              <div
                key={column.id}
                className="flex flex-col w-80 min-w-[320px]"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverColumn(column.id);
                }}
                onDrop={() => handleDrop(column.id)}
              >
                <div
                  className="flex items-center justify-between px-4 py-3 mb-3 rounded-lg border"
                  style={{
                    borderColor: `${column.color}40`,
                    backgroundColor: `${column.color}15`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" style={{ color: column.color }} />
                    <span className="font-medium text-sm">{column.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{columnTasks.length}</span>
                </div>

                <div className={`flex-1 space-y-3 overflow-y-auto gantt-scrollbar rounded-lg p-2 transition-colors ${dragOverColumn === column.id ? 'bg-white/5' : ''}`}>
                  {columnTasks.map((task) => {
                    const taskVersion = task.taskMetadata?.versionId
                      ? versions.find(v => v.id === task.taskMetadata?.versionId)
                      : null;

                    return (
                      <TaskCard
                        key={task.id}
                        task={task}
                        version={taskVersion}
                        isDragging={draggedTaskId === task.id}
                        onClick={() => onTaskClick(task.id)}
                        onNavigate={() => onTaskNavigate(task.id)}
                        onDragStart={() => setDraggedTaskId(task.id)}
                        onDragOverCard={() => {
                          if (draggedTaskId && draggedTaskId !== task.id) {
                            reorderWithinColumn(column.id, draggedTaskId, task.id);
                          }
                        }}
                        onArchive={() => onTaskUpdate?.(task.id, { isArchived: true })}
                        onSubtaskToggle={(subtaskId, isCompleted) => {
                          if (!onTaskUpdate) return;
                          const updatedSubtasks = task.subtasks.map(st => st.id === subtaskId ? { ...st, isCompleted } : st);
                          onTaskUpdate(task.id, {
                            subtasks: updatedSubtasks,
                            status: updatedSubtasks.every(st => st.isCompleted) ? 'completed' : task.status,
                          });
                        }}
                        onTaskUpdate={onTaskUpdate ? (updates) => onTaskUpdate(task.id, updates) : undefined}
                      />
                    );
                  })}
                  {columnTasks.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">No tasks</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface TaskCardProps {
  task: TaskProjection;
  version?: { id: string; name: string; color: string } | null;
  isDragging: boolean;
  onClick: () => void;
  onNavigate: () => void;
  onDragStart: () => void;
  onDragOverCard: () => void;
  onArchive: () => void;
  onSubtaskToggle?: (subtaskId: string, isCompleted: boolean) => void;
  onTaskUpdate?: (updates: Partial<TaskProjection>) => void;
}

function TaskCard({ task, version, isDragging, onClick, onNavigate, onDragStart, onDragOverCard, onArchive, onSubtaskToggle, onTaskUpdate }: TaskCardProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);

  const priorityColors = {
    urgent: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500',
  };

  const project = useCXDStore(state => state.getCurrentProject());
  const canvasBackground = project?.canvasBackground || 'radial-gradient(circle at center, #1a0b2e 0%, #000000 100%)';
  const centerColor = extractCenterColor(canvasBackground);
  const cardBgColor = hexToRgba(centerColor, 0.32);

  const saveTitle = () => {
    const next = titleDraft.trim();
    if (next && onTaskUpdate) {
      onTaskUpdate({ title: next });
    }
    setIsEditingTitle(false);
  };

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOverCard();
      }}
      className={`relative p-4 cursor-pointer hover:border-purple-400/40 transition-all min-w-[250px] overflow-hidden ${isDragging ? 'opacity-50' : ''} border-white/10`}
      style={{ backgroundColor: cardBgColor }}
      onClick={onClick}
    >
      {/* Version Color Stripe */}
      {version && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ backgroundColor: version.color }}
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/55 via-purple-950/18 to-transparent" />
      <div className="relative z-10">
        {task.priority && (
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-1 h-1 rounded-full ${priorityColors[task.priority]}`} />
            <span className="text-xs text-muted-foreground capitalize">{task.priority}</span>
          </div>
        )}

        <div className="mb-3">
          {isEditingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') {
                  setTitleDraft(task.title);
                  setIsEditingTitle(false);
                }
              }}
              className="h-8 w-full bg-black/40 border border-white/15 rounded px-2 text-sm"
            />
          ) : (
            <button
              className="text-sm font-medium line-clamp-2 mb-1 text-left hover:text-white/90"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingTitle(true);
              }}
            >
              {task.title}
            </button>
          )}
        </div>

        {(!task.subtasks || task.subtasks.length === 0) && task.totalSubtasks > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Subtasks</span>
              <span>{task.completedSubtasks}/{task.totalSubtasks}</span>
            </div>
            <Progress value={task.completionPercent} className="h-1" />
          </div>
        )}

        {task.subtasks && task.subtasks.length > 0 && (
          <div className="mb-3 space-y-1">
            {task.subtasks.slice(0, 3).map((subtask) => (
              <div
                key={subtask.id}
                className="flex items-center gap-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onSubtaskToggle?.(subtask.id, !subtask.isCompleted);
                }}
              >
                <div className="w-3 h-3 rounded-sm border border-white/30 flex items-center justify-center cursor-pointer hover:border-purple-400 transition-colors flex-shrink-0">
                  {subtask.isCompleted && (
                    <svg className="w-2 h-2 text-purple-400" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`line-clamp-1 ${subtask.isCompleted ? 'line-through opacity-60' : ''}`}>{subtask.text}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            {task.dueDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{new Date(task.dueDate).toLocaleDateString()}</span>
              </div>
            )}
            {!!parseAssignees(task.assignee).length && (
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>{parseAssignees(task.assignee)[0]}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {onTaskUpdate && (
              <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5">
                <AssigneeMultiSelect
                  compact
                  iconOnly
                  value={parseAssignees(task.assignee)}
                  onChange={(next) => onTaskUpdate({ assignee: serializeAssignees(next) })}
                />
                <FaceTagSelector
                  compact
                  iconOnly
                  value={task.hypercubeTags}
                  onChange={(next) => onTaskUpdate({ hypercubeTags: next })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchive();
                  }}
                  title="Archive task"
                >
                  <Archive className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate();
              }}
            >
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {(task.hypercubeTags.length > 0 || version) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {version && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-white/20"
                style={{ borderColor: version.color, color: version.color }}
              >
                <Milestone className="w-2.5 h-2.5 mr-0.5" />
                {version.name}
              </Badge>
            )}
            {task.hypercubeTags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-white/20"
                style={{ borderColor: HYPERCUBE_FACE_COLORS[tag], color: HYPERCUBE_FACE_COLORS[tag] }}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
