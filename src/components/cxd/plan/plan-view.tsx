'use client';

import { ShimmerGrid } from '@/components/ui/shimmer-grid';

import { useState } from 'react';
import { KanbanView } from './kanban-view';
import { TableView } from './table-view';
import { TimelineView } from './timeline-view';
import { CalendarView } from './calendar-view';
import { TaskDetailPanel } from './task-detail-panel';
import { TaskFilterPanel } from './task-filter-panel';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { usePlanTasks } from '@/hooks/use-plan-tasks';
import { useCXDStore } from '@/store/cxd-store';
import { useCollaborationContext } from '@/contexts/collaboration-context';
import { extractCenterColor, hexToRgba } from '@/lib/utils';
import type { PlanViewType, TaskFilter } from '@/types/plan-types';
import { LayoutGrid, Table as TableIcon, Calendar, GanttChart, Filter, Settings, Plus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export function PlanView() {
  const [activeView, setActiveView] = useState<PlanViewType>('kanban');
  const [filter, setFilter] = useState<TaskFilter>({
    showCompleted: true,
    includeImplicitTasks: true,
    includeExplicitTasks: true,
    includeTaggedCards: true,
  });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');

  const project = useCXDStore(state => state.getCurrentProject());
  const { syncAddElement } = useCollaborationContext();

  const {
    tasks,
    totalCount,
    tasksByStatus,
    updateTaskStatus,
    updateTaskPriority,
    updateTaskDueDate,
    updateTaskMetadata,
    navigateToTask,
    getTaskById,
  } = usePlanTasks({ filter });

  const selectedTask = selectedTaskId ? getTaskById(selectedTaskId) : undefined;

  // Dynamic background based on canvas background
  const canvasBackground = project?.canvasBackground || 'radial-gradient(circle at center, #1a0b2e 0%, #000000 100%)';
  const centerColor = extractCenterColor(canvasBackground);
  const panelBgColor = hexToRgba(centerColor, 0.4);
  const headerBgColor = hexToRgba(centerColor, 0.6);

  const handleAddTask = () => {
    if (!newTaskText.trim() || !project) return;

    // Create a new freeform element with task checkbox syntax
    // Tasks go to the Task Inbox instead of random canvas positions
    const taskContent = `- [ ] ${newTaskText}`;
    const newElement = {
      id: uuidv4(),
      type: 'freeform' as const,
      x: 0, // Position doesn't matter for inbox items
      y: 0,
      width: 300,
      height: 100,
      zIndex: Date.now(), // Use timestamp for unique high z-index
      content: taskContent,
      inInbox: true, // Mark as inbox item - not yet placed on canvas
      taskMetadata: {
        isActionable: true,
        status: 'not_started' as const,
      },
    };

    syncAddElement(newElement as any);
    setNewTaskText('');
    setIsAddTaskOpen(false);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] h-[calc(100vh-4rem)] relative" style={{ background: canvasBackground }}>
      {/* Shimmer Grid - fixed position to cover entire viewport */}
      <ShimmerGrid className="!fixed inset-0 !z-0" />
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b border-white/10 backdrop-blur-sm relative z-10"
        style={{ backgroundColor: headerBgColor }}
      >
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            Plan
          </h1>
          <span className="text-sm text-muted-foreground">
            {totalCount} {totalCount === 1 ? 'task' : 'tasks'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
            <DialogTrigger asChild>
              <Button variant="default" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-black/90 border-white/20">
              <DialogHeader>
                <DialogTitle>Add New Task</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  placeholder="Enter task description..."
                  className="bg-black/40 border-white/10"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddTask();
                    }
                  }}
                />
                <div className="flex gap-2">
                  <Button onClick={handleAddTask} className="flex-1">
                    Create Task
                  </Button>
                  <Button onClick={() => setIsAddTaskOpen(false)} variant="outline" className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
            className={isFilterPanelOpen ? 'bg-purple-500/20' : ''}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Properties
          </Button>
        </div>
      </div>

      {/* View Tabs */}
      <div
        className="flex items-center px-6 py-3 border-b border-white/10 relative z-10"
        style={{ backgroundColor: panelBgColor }}
      >
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as PlanViewType)}>
          <TabsList className="bg-black/40">
            <TabsTrigger value="kanban" className="gap-2">
              <LayoutGrid className="w-4 h-4" />
              Kanban
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-2">
              <TableIcon className="w-4 h-4" />
              Table
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2">
              <GanttChart className="w-4 h-4" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="w-4 h-4" />
              Calendar
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Filter Panel */}
        {isFilterPanelOpen && (
          <div
            className="w-80 border-r border-white/10 overflow-y-auto"
            style={{ backgroundColor: panelBgColor }}
          >
            <TaskFilterPanel filter={filter} onFilterChange={setFilter} />
          </div>
        )}

        {/* View Content */}
        <div className="flex-1 overflow-hidden">
          {activeView === 'kanban' && (
            <KanbanView
              tasksByStatus={tasksByStatus}
              onTaskClick={setSelectedTaskId}
              onTaskStatusChange={updateTaskStatus}
              onTaskNavigate={navigateToTask}
              onTaskUpdate={updateTaskMetadata}
            />
          )}
          {activeView === 'table' && (
            <TableView
              tasks={tasks}
              onTaskClick={setSelectedTaskId}
              onTaskNavigate={navigateToTask}
              onTaskUpdate={updateTaskMetadata}
            />
          )}
          {activeView === 'timeline' && (
            <TimelineView
              tasks={tasks}
              onTaskClick={setSelectedTaskId}
              onTaskNavigate={navigateToTask}
              onTaskUpdate={updateTaskMetadata}
            />
          )}
          {activeView === 'calendar' && (
            <CalendarView
              tasks={tasks}
              onTaskClick={setSelectedTaskId}
              onTaskNavigate={navigateToTask}
              onTaskUpdate={updateTaskMetadata}
            />
          )}
        </div>

        {/* Detail Panel */}
        {selectedTask && (
          <div
            className="w-96 border-l border-white/10 overflow-y-auto"
            style={{ backgroundColor: panelBgColor }}
          >
            <TaskDetailPanel
              task={selectedTask}
              onClose={() => setSelectedTaskId(null)}
              onUpdate={(updates) => updateTaskMetadata(selectedTask.id, updates)}
              onNavigate={() => navigateToTask(selectedTask.id)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
