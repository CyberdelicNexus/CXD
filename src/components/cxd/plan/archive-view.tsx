'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, ArrowRight } from 'lucide-react';
import type { TaskProjection } from '@/types/plan-types';

interface ArchiveViewProps {
  tasks: TaskProjection[];
  onRestore: (taskId: string) => void;
  onNavigate: (taskId: string) => void;
  onTaskClick: (taskId: string) => void;
}

export function ArchiveView({ tasks, onRestore, onNavigate, onTaskClick }: ArchiveViewProps) {
  if (tasks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        No archived tasks
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto gantt-scrollbar p-4">
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 hover:bg-white/5 transition-colors cursor-pointer"
            onClick={() => onTaskClick(task.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{task.title}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {task.priority && <Badge variant="outline" className="text-[10px] border-white/15">{task.priority}</Badge>}
                  {task.status && <span className="capitalize">{task.status.replace('_', ' ')}</span>}
                  {task.dueDate && <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>}
                </div>
              </div>

              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onRestore(task.id)}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Restore
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => onNavigate(task.id)}
                  title="View on Canvas"
                >
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
