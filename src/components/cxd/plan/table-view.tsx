'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DatePicker } from '@/components/ui/date-picker';
import type { TaskProjection, TaskStatus, TaskPriority } from '@/types/plan-types';
import { HYPERCUBE_FACE_COLORS } from '@/types/plan-types';
import { ArrowUpDown, ArrowRight, Calendar, CheckCircle2, Circle, Clock, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';

interface TableViewProps {
  tasks: TaskProjection[];
  onTaskClick: (taskId: string) => void;
  onTaskNavigate: (taskId: string) => void;
  onTaskUpdate: (taskId: string, updates: Partial<TaskProjection>) => void;
}

type SortField = 'title' | 'status' | 'priority' | 'dueDate' | 'completionPercent';
type SortDirection = 'asc' | 'desc';

const STATUS_ICONS = {
  not_started: Circle,
  in_progress: Clock,
  blocked: AlertCircle,
  completed: CheckCircle2,
};

const STATUS_COLORS = {
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

const PRIORITY_COLORS = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function TableView({ tasks, onTaskClick, onTaskNavigate, onTaskUpdate }: TableViewProps) {
  const [sortField, setSortField] = useState<SortField>('dueDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [collapsedStatuses, setCollapsedStatuses] = useState<Set<TaskStatus>>(new Set());

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Group tasks by status
  const groupedTasks = tasks.reduce((acc, task) => {
    if (!acc[task.status]) {
      acc[task.status] = [];
    }
    acc[task.status].push(task);
    return acc;
  }, {} as Record<TaskStatus, TaskProjection[]>);

  // Sort tasks within each group
  const sortTasksInGroup = (groupTasks: TaskProjection[]) => {
    return [...groupTasks].sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;

      switch (sortField) {
        case 'title':
          return multiplier * a.title.localeCompare(b.title);
        case 'status':
          return multiplier * a.status.localeCompare(b.status);
        case 'priority': {
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          const aPriority = a.priority ? priorityOrder[a.priority] : 0;
          const bPriority = b.priority ? priorityOrder[b.priority] : 0;
          return multiplier * (aPriority - bPriority);
        }
        case 'dueDate': {
          const aDate = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          const bDate = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          return multiplier * (aDate - bDate);
        }
        case 'completionPercent':
          return multiplier * (a.completionPercent - b.completionPercent);
        default:
          return 0;
      }
    });
  };

  const toggleStatusCollapse = (status: TaskStatus) => {
    setCollapsedStatuses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  };

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-black/40 backdrop-blur-sm border-b border-white/10 z-10">
          <tr>
            <th className="text-left px-4 py-3 font-medium">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort('status')}
                className="gap-2 -ml-2"
              >
                Status
                <ArrowUpDown className="w-3 h-3" />
              </Button>
            </th>
            <th className="text-left px-4 py-3 font-medium">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort('title')}
                className="gap-2 -ml-2"
              >
                Title
                <ArrowUpDown className="w-3 h-3" />
              </Button>
            </th>
            <th className="text-left px-4 py-3 font-medium">Faces</th>
            <th className="text-left px-4 py-3 font-medium">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort('priority')}
                className="gap-2 -ml-2"
              >
                Priority
                <ArrowUpDown className="w-3 h-3" />
              </Button>
            </th>
            <th className="text-left px-4 py-3 font-medium">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort('dueDate')}
                className="gap-2 -ml-2"
              >
                Due Date
                <ArrowUpDown className="w-3 h-3" />
              </Button>
            </th>
            <th className="text-left px-4 py-3 font-medium">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort('completionPercent')}
                className="gap-2 -ml-2"
              >
                Progress
                <ArrowUpDown className="w-3 h-3" />
              </Button>
            </th>
            <th className="text-right px-4 py-3 font-medium w-20"></th>
          </tr>
        </thead>
        <tbody>
          {STATUS_OPTIONS.map((statusOption) => {
            const statusTasks = groupedTasks[statusOption.value] || [];
            if (statusTasks.length === 0) return null;
            
            const sortedStatusTasks = sortTasksInGroup(statusTasks);
            const isCollapsed = collapsedStatuses.has(statusOption.value);
            const StatusIcon = STATUS_ICONS[statusOption.value];

            return (
              <React.Fragment key={statusOption.value}>
                {/* Status Group Header */}
                <tr 
                  className="bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                  onClick={() => toggleStatusCollapse(statusOption.value)}
                >
                  <td colSpan={7} className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium">
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                      <StatusIcon 
                        className="w-4 h-4" 
                        style={{ color: STATUS_COLORS[statusOption.value] }}
                      />
                      <span>{statusOption.label}</span>
                      <Badge variant="secondary" className="ml-2">
                        {statusTasks.length}
                      </Badge>
                    </div>
                  </td>
                </tr>
                
                {/* Status Group Tasks */}
                {!isCollapsed && sortedStatusTasks.map((task) => {
                  const TaskStatusIcon = STATUS_ICONS[task.status];
                  return (
                    <tr
                      key={task.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 py-3 pl-12">
                        <select
                          value={task.status}
                          onChange={(e) => {
                            e.stopPropagation();
                            onTaskUpdate(task.id, { status: e.target.value as TaskStatus });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-transparent border-none text-xs capitalize cursor-pointer hover:bg-white/5 rounded px-2 py-1"
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 cursor-pointer" onClick={() => onTaskClick(task.id)}>
                        <div className="max-w-md">
                          <div className="font-medium truncate">{task.title}</div>
                          {task.description !== task.title && (
                            <div className="text-xs text-muted-foreground truncate">
                              {task.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {task.hypercubeTags.slice(0, 2).map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="text-xs px-2 py-0.5"
                              style={{
                                borderColor: HYPERCUBE_FACE_COLORS[tag],
                                color: HYPERCUBE_FACE_COLORS[tag],
                              }}
                            >
                              {tag.split(' ')[0]}
                            </Badge>
                          ))}
                          {task.hypercubeTags.length > 2 && (
                            <Badge variant="outline" className="text-xs px-2 py-0.5">
                              +{task.hypercubeTags.length - 2}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={task.priority || ''}
                          onChange={(e) => {
                            e.stopPropagation();
                            onTaskUpdate(task.id, { 
                              priority: e.target.value ? e.target.value as TaskPriority : undefined 
                            });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-transparent border-none text-xs capitalize cursor-pointer hover:bg-white/5 rounded px-2 py-1"
                        >
                          <option value="">None</option>
                          {PRIORITY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="w-[180px]">
                          <DatePicker
                            date={task.dueDate ? new Date(task.dueDate) : undefined}
                            onSelect={(date) => {
                              onTaskUpdate(task.id, { dueDate: date?.toISOString() });
                            }}
                            placeholder="Set date"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {task.totalSubtasks > 0 && (
                          <div className="flex items-center gap-2">
                            <Progress value={task.completionPercent} className="h-1 w-20" />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {task.completedSubtasks}/{task.totalSubtasks}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTaskNavigate(task.id);
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
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          No tasks found
        </div>
      )}
    </div>
  );
}
