'use client';

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

  const addCanvasElement = useCXDStore(state => state.addCanvasElement);
  const project = useCXDStore(state => state.getCurrentProject());

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

  const handleAddTask = () => {
    if (!newTaskText.trim() || !project) return;

    // Create a new freeform element with task checkbox syntax
    const taskContent = `- [ ] ${newTaskText}`;
    const newElement = {
      id: uuidv4(),
      type: 'freeform' as const,
      x: 100 + Math.random() * 200, // Random position
      y: 100 + Math.random() * 200,
      width: 300,
      height: 100,
      zIndex: Date.now(), // Use timestamp for unique high z-index
      content: taskContent,
      taskMetadata: {
        isActionable: true,
        status: 'not_started' as const,
      },
    };

    addCanvasElement(newElement);
    setNewTaskText('');
    setIsAddTaskOpen(false);
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-[#0A0118] via-[#0F0A1F] to-[#0A0420]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/20 backdrop-blur-sm">
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
      <div className="flex items-center px-6 py-3 border-b border-white/10 bg-black/10">
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
      <div className="flex-1 flex overflow-hidden">
        {/* Filter Panel */}
        {isFilterPanelOpen && (
          <div className="w-80 border-r border-white/10 bg-black/20 overflow-y-auto">
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
          <div className="w-96 border-l border-white/10 bg-black/20 overflow-y-auto">
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
