'use client';

import React, { useMemo } from 'react';
import type { Version } from '@/types/version-types';
import type { TaskProjection } from '@/types/plan-types';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  MapPin,
  ChevronRight,
} from 'lucide-react';

interface VersionTaskListProps {
  version: Version;
  tasks: TaskProjection[];
  onTaskClick: (taskId: string) => void;
  onTaskNavigate: (taskId: string) => void;
}

export function VersionTaskList({
  version,
  tasks,
  onTaskClick,
  onTaskNavigate,
}: VersionTaskListProps) {
  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const groups = {
      not_started: tasks.filter((t) => t.status === 'not_started'),
      in_progress: tasks.filter((t) => t.status === 'in_progress'),
      completed: tasks.filter((t) => t.status === 'completed'),
      blocked: tasks.filter((t) => t.status === 'blocked'),
    };
    return groups;
  }, [tasks]);

  const totalTasks = tasks.length;
  const completedTasks = tasksByStatus.completed.length;
  const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 bg-black/40 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-white/90 font-medium">Version Tasks</h3>
          <div className="text-white/60 text-sm">
            {completedTasks} / {totalTasks} completed
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>Progress</span>
            <span>{completionPercent}%</span>
          </div>
          <div className="h-2 bg-black/40 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${completionPercent}%`,
                backgroundColor: version.color,
              }}
            />
          </div>
        </div>
      </div>

      {/* Task Groups */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {totalTasks === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-2">
            <Circle className="w-12 h-12 text-white/20" />
            <p className="text-white/40">No tasks tagged to this version yet</p>
            <p className="text-white/30 text-sm max-w-xs">
              Tag tasks from other views to track work for this release
            </p>
          </div>
        ) : (
          <>
            {/* In Progress */}
            {tasksByStatus.in_progress.length > 0 && (
              <TaskGroup
                title="In Progress"
                count={tasksByStatus.in_progress.length}
                icon={<Clock className="w-4 h-4 text-blue-400" />}
                tasks={tasksByStatus.in_progress}
                onTaskClick={onTaskClick}
                onTaskNavigate={onTaskNavigate}
              />
            )}

            {/* Blocked */}
            {tasksByStatus.blocked.length > 0 && (
              <TaskGroup
                title="Blocked"
                count={tasksByStatus.blocked.length}
                icon={<AlertCircle className="w-4 h-4 text-red-400" />}
                tasks={tasksByStatus.blocked}
                onTaskClick={onTaskClick}
                onTaskNavigate={onTaskNavigate}
              />
            )}

            {/* Not Started */}
            {tasksByStatus.not_started.length > 0 && (
              <TaskGroup
                title="Not Started"
                count={tasksByStatus.not_started.length}
                icon={<Circle className="w-4 h-4 text-white/40" />}
                tasks={tasksByStatus.not_started}
                onTaskClick={onTaskClick}
                onTaskNavigate={onTaskNavigate}
              />
            )}

            {/* Completed */}
            {tasksByStatus.completed.length > 0 && (
              <TaskGroup
                title="Completed"
                count={tasksByStatus.completed.length}
                icon={<CheckCircle2 className="w-4 h-4 text-green-400" />}
                tasks={tasksByStatus.completed}
                onTaskClick={onTaskClick}
                onTaskNavigate={onTaskNavigate}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface TaskGroupProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  tasks: TaskProjection[];
  onTaskClick: (taskId: string) => void;
  onTaskNavigate: (taskId: string) => void;
}

function TaskGroup({ title, count, icon, tasks, onTaskClick, onTaskNavigate }: TaskGroupProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);

  return (
    <div className="space-y-2">
      {/* Group Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-white/70 hover:text-white/90 transition-colors w-full"
      >
        <ChevronRight
          className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-90')}
        />
        {icon}
        <span className="font-medium text-sm">{title}</span>
        <span className="text-xs text-white/40">({count})</span>
      </button>

      {/* Tasks */}
      {isExpanded && (
        <div className="space-y-1 ml-6">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task.id)}
              onNavigate={() => onTaskNavigate(task.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TaskCardProps {
  task: TaskProjection;
  onClick: () => void;
  onNavigate: () => void;
}

function TaskCard({ task, onClick, onNavigate }: TaskCardProps) {
  const priorityColors = {
    urgent: 'text-red-400 border-red-400/30 bg-red-500/10',
    high: 'text-orange-400 border-orange-400/30 bg-orange-500/10',
    medium: 'text-blue-400 border-blue-400/30 bg-blue-500/10',
    low: 'text-gray-400 border-gray-400/30 bg-gray-500/10',
  };

  return (
    <div
      className={cn(
        'group flex items-start gap-3 p-3 rounded-lg border',
        'bg-black/20 border-white/10',
        'hover:bg-white/5 hover:border-white/20',
        'transition-all cursor-pointer'
      )}
      onClick={onClick}
    >
      <div className="flex-1 space-y-1">
        <div className="text-white/90 text-sm group-hover:text-white">
          {task.title || 'Untitled Task'}
        </div>
        {task.description && (
          <div className="text-white/40 text-xs line-clamp-1">{task.description}</div>
        )}
        <div className="flex items-center gap-2 text-xs text-white/40">
          {task.priority && (
            <span
              className={cn(
                'px-2 py-0.5 rounded border text-[10px] font-medium',
                priorityColors[task.priority]
              )}
            >
              {task.priority}
            </span>
          )}
          {task.dueDate && (
            <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>
          )}
          {task.totalSubtasks > 0 && (
            <span>
              {task.completedSubtasks}/{task.totalSubtasks} subtasks
            </span>
          )}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onNavigate();
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
      >
        <MapPin className="w-4 h-4 text-white/60" />
      </button>
    </div>
  );
}
