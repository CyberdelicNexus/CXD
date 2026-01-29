'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import type { TaskFilter, TaskStatus, TaskPriority } from '@/types/plan-types';
import { HYPERCUBE_FACE_TAGS, HYPERCUBE_FACE_COLORS } from '@/types/plan-types';
import type { HypercubeFaceTag } from '@/types/canvas-elements';

interface TaskFilterPanelProps {
  filter: TaskFilter;
  onFilterChange: (filter: TaskFilter) => void;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'completed', label: 'Completed' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function TaskFilterPanel({ filter, onFilterChange }: TaskFilterPanelProps) {
  const toggleStatus = (status: TaskStatus) => {
    const statuses = filter.statuses || [];
    const newStatuses = statuses.includes(status)
      ? statuses.filter((s) => s !== status)
      : [...statuses, status];
    onFilterChange({ ...filter, statuses: newStatuses });
  };

  const togglePriority = (priority: TaskPriority) => {
    const priorities = filter.priorities || [];
    const newPriorities = priorities.includes(priority)
      ? priorities.filter((p) => p !== priority)
      : [...priorities, priority];
    onFilterChange({ ...filter, priorities: newPriorities });
  };

  const toggleHypercubeFace = (face: HypercubeFaceTag) => {
    const faces = filter.hypercubeFaces || [];
    const newFaces = faces.includes(face) ? faces.filter((f) => f !== face) : [...faces, face];
    onFilterChange({ ...filter, hypercubeFaces: newFaces });
  };

  const clearAllFilters = () => {
    onFilterChange({
      showCompleted: true,
      includeImplicitTasks: true,
      includeExplicitTasks: true,
      includeTaggedCards: true,
    });
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Filters</h3>
        <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs">
          Clear All
        </Button>
      </div>

      <Separator />

      {/* Task Types */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">Task Types</Label>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Markdown Tasks</span>
            <Switch
              checked={filter.includeImplicitTasks}
              onCheckedChange={(checked) =>
                onFilterChange({ ...filter, includeImplicitTasks: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Actionable Cards</span>
            <Switch
              checked={filter.includeExplicitTasks}
              onCheckedChange={(checked) =>
                onFilterChange({ ...filter, includeExplicitTasks: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Tagged Cards</span>
            <Switch
              checked={filter.includeTaggedCards}
              onCheckedChange={(checked) =>
                onFilterChange({ ...filter, includeTaggedCards: checked })
              }
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Show Completed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Show Completed</Label>
          <Switch
            checked={filter.showCompleted}
            onCheckedChange={(checked) => onFilterChange({ ...filter, showCompleted: checked })}
          />
        </div>
      </div>

      <Separator />

      {/* Status Filter */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">Status</Label>
        <div className="space-y-2">
          {STATUS_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              onClick={() => toggleStatus(opt.value)}
              className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors"
            >
              <div
                className={`w-4 h-4 rounded border ${
                  filter.statuses?.includes(opt.value)
                    ? 'bg-purple-500 border-purple-500'
                    : 'border-white/20'
                }`}
              />
              <span className="text-sm">{opt.label}</span>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Priority Filter */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">Priority</Label>
        <div className="space-y-2">
          {PRIORITY_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              onClick={() => togglePriority(opt.value)}
              className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors"
            >
              <div
                className={`w-4 h-4 rounded border ${
                  filter.priorities?.includes(opt.value)
                    ? 'bg-purple-500 border-purple-500'
                    : 'border-white/20'
                }`}
              />
              <span className="text-sm capitalize">{opt.label}</span>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Hypercube Face Filter */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">Hypercube Faces</Label>
        <div className="space-y-2">
          {HYPERCUBE_FACE_TAGS.map((face) => (
            <div
              key={face}
              onClick={() => toggleHypercubeFace(face)}
              className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors"
            >
              <div
                className={`w-4 h-4 rounded border ${
                  filter.hypercubeFaces?.includes(face)
                    ? 'border-2'
                    : 'border border-white/20'
                }`}
                style={{
                  borderColor: filter.hypercubeFaces?.includes(face)
                    ? HYPERCUBE_FACE_COLORS[face]
                    : undefined,
                  backgroundColor: filter.hypercubeFaces?.includes(face)
                    ? `${HYPERCUBE_FACE_COLORS[face]}40`
                    : undefined,
                }}
              />
              <span className="text-sm">{face}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
