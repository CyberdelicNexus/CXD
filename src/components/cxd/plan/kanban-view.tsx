'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { TaskProjection, TaskStatus } from '@/types/plan-types';
import { HYPERCUBE_FACE_COLORS } from '@/types/plan-types';
import { CheckCircle2, Circle, Clock, AlertCircle, Calendar, User, ArrowRight } from 'lucide-react';

interface KanbanViewProps {
  tasksByStatus: Map<string, TaskProjection[]>;
  onTaskClick: (taskId: string) => void;
  onTaskStatusChange: (taskId: string, status: TaskStatus) => void;
  onTaskNavigate: (taskId: string) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<TaskProjection>) => void;
}

const STATUS_COLUMNS: { id: TaskStatus; label: string; icon: any; color: string }[] = [
  { id: 'not_started', label: 'To Do', icon: Circle, color: '#6B7280' },
  { id: 'in_progress', label: 'In Progress', icon: Clock, color: '#3B82F6' },
  { id: 'blocked', label: 'Blocked', icon: AlertCircle, color: '#EF4444' },
  { id: 'completed', label: 'Done', icon: CheckCircle2, color: '#10B981' },
];

export function KanbanView({
  tasksByStatus,
  onTaskClick,
  onTaskStatusChange,
  onTaskNavigate,
  onTaskUpdate,
}: KanbanViewProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  const handleDragStart = (taskId: string) => {
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, columnId: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDrop = (columnId: TaskStatus) => {
    if (draggedTaskId) {
      onTaskStatusChange(draggedTaskId, columnId);
      setDraggedTaskId(null);
      setDragOverColumn(null);
    }
  };

  return (
    <div className="h-full overflow-x-auto overflow-y-hidden">
      <div className="flex gap-4 p-6 h-full min-w-max">
        {STATUS_COLUMNS.map((column) => {
          const tasks = tasksByStatus.get(column.id) || [];
          const Icon = column.icon;

          return (
            <div
              key={column.id}
              className="flex flex-col w-80 min-w-[320px]"
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDrop={() => handleDrop(column.id)}
            >
              {/* Column Header */}
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
                <span className="text-xs text-muted-foreground">{tasks.length}</span>
              </div>

              {/* Column Content */}
              <div
                className={`flex-1 space-y-3 overflow-y-auto rounded-lg p-2 transition-colors ${
                  dragOverColumn === column.id ? 'bg-white/5' : ''
                }`}
              >
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isDragging={draggedTaskId === task.id}
                    onClick={() => onTaskClick(task.id)}
                    onNavigate={() => onTaskNavigate(task.id)}
                    onDragStart={() => handleDragStart(task.id)}
                    onSubtaskToggle={(subtaskId, isCompleted) => {
                      if (onTaskUpdate) {
                        const updatedSubtasks = task.subtasks.map(st =>
                          st.id === subtaskId ? { ...st, isCompleted } : st
                        );
                        
                        // Check if all subtasks are now completed
                        const allCompleted = updatedSubtasks.every(st => st.isCompleted);
                        
                        // If all subtasks are completed, automatically change status to completed
                        if (allCompleted) {
                          onTaskUpdate(task.id, { 
                            subtasks: updatedSubtasks,
                            status: 'completed'
                          });
                        } else {
                          onTaskUpdate(task.id, { subtasks: updatedSubtasks });
                        }
                      }
                    }}
                  />
                ))}
                {tasks.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    No tasks
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface TaskCardProps {
  task: TaskProjection;
  isDragging: boolean;
  onClick: () => void;
  onNavigate: () => void;
  onDragStart: () => void;
  onSubtaskToggle?: (subtaskId: string, isCompleted: boolean) => void;
}

function TaskCard({ task, isDragging, onClick, onNavigate, onDragStart, onSubtaskToggle }: TaskCardProps) {
  const priorityColors = {
    urgent: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500',
  };

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      className={`p-4 cursor-pointer hover:border-purple-500/50 transition-all min-w-[250px] ${
        isDragging ? 'opacity-50' : ''
      } bg-gradient-to-br from-black/40 to-black/20 border-white/10`}
    >
      {/* Priority Indicator */}
      {task.priority && (
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-1 h-1 rounded-full ${priorityColors[task.priority]}`} />
          <span className="text-xs text-muted-foreground capitalize">{task.priority}</span>
        </div>
      )}

      {/* Title */}
      <div className="mb-3" onClick={onClick}>
        <h3 className="text-sm font-medium line-clamp-2 mb-1">{task.title}</h3>
        {task.description !== task.title && (
          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
        )}
      </div>

      {/* Subtasks with checkboxes */}
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="mb-3 space-y-1">
          {task.subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className="flex items-center gap-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                if (onSubtaskToggle) {
                  onSubtaskToggle(subtask.id, !subtask.isCompleted);
                }
              }}
            >
              <div
                className="w-3 h-3 rounded-sm border border-white/30 flex items-center justify-center cursor-pointer hover:border-purple-400 transition-colors flex-shrink-0"
              >
                {subtask.isCompleted && (
                  <svg
                    className="w-2 h-2 text-purple-400"
                    fill="none"
                    strokeWidth="2"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
              <span className={`line-clamp-1 ${subtask.isCompleted ? 'line-through opacity-60' : ''}`}>
                {subtask.text}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Subtasks Progress - show if no direct subtasks but has totals */}
      {(!task.subtasks || task.subtasks.length === 0) && task.totalSubtasks > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Subtasks</span>
            <span>
              {task.completedSubtasks}/{task.totalSubtasks}
            </span>
          </div>
          <Progress value={task.completionPercent} className="h-1" />
        </div>
      )}

      {/* Hypercube Tags */}
      {task.hypercubeTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.hypercubeTags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="text-xs px-2 py-0.5"
              style={{
                borderColor: HYPERCUBE_FACE_COLORS[tag],
                color: HYPERCUBE_FACE_COLORS[tag],
              }}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Metadata */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          {task.dueDate && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{new Date(task.dueDate).toLocaleDateString()}</span>
            </div>
          )}
          {task.assignee && (
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <span>{task.assignee}</span>
            </div>
          )}
        </div>

        {/* Navigate to Canvas */}
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
    </Card>
  );
}
