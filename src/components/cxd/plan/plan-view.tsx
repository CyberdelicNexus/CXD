'use client';

import { ShimmerGrid } from '@/components/ui/shimmer-grid';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { KanbanView } from './kanban-view';
import { TableView } from './table-view';
import { CalendarView } from './calendar-view';

const GanttViewEnhanced = dynamic(
  () => import('./gantt-view-enhanced').then((m) => ({ default: m.GanttViewEnhanced })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          <span className="text-white/40 text-sm">Loading timeline...</span>
        </div>
      </div>
    ),
  }
);
import { ArchiveView } from './archive-view';
import { TaskDetailPanel } from './task-detail-panel';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { usePlanTasks } from '@/hooks/use-plan-tasks';
import { useCXDStore } from '@/store/cxd-store';
import { useCollaborationContext } from '@/contexts/collaboration-context';
import { extractCenterColor, hexToRgba } from '@/lib/utils';
import type { HypercubeFaceTag } from '@/types/canvas-elements';
import type { PlanViewType, TaskFilter, TaskPriority, TaskStatus } from '@/types/plan-types';
import { FaceTagSelector } from './face-tag-selector';
import { AssigneeMultiSelect } from './assignee-multi-select';
import { serializeAssignees } from './assignee-utils';
import { LayoutGrid, Table as TableIcon, Calendar, GanttChart, Plus, Archive, Milestone } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { VersionsView } from './versions-view';

export function PlanView() {
  // Load activeView from localStorage, default to 'kanban'
  const [activeView, setActiveView] = useState<PlanViewType>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cxd-plan-view');
      if (saved && ['kanban', 'table', 'timeline', 'calendar', 'archive', 'versions'].includes(saved)) {
        return saved as PlanViewType;
      }
    }
    return 'kanban';
  });

  const [filter, setFilter] = useState<TaskFilter>({
    showCompleted: true,
    includeImplicitTasks: true,
    includeExplicitTasks: true,
    includeTaggedCards: true,
  });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('not_started');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority | ''>('');
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | undefined>(undefined);
  const [newTaskStartDate, setNewTaskStartDate] = useState<Date | undefined>(undefined);
  const [newTaskFaces, setNewTaskFaces] = useState<HypercubeFaceTag[]>([]);

  // Save activeView to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cxd-plan-view', activeView);
    }
  }, [activeView]);

  const project = useCXDStore(state => state.getCurrentProject());
  const { syncAddElement, syncRemoveElement } = useCollaborationContext();

  const {
    tasks,
    updateTaskStatus,
    updateTaskMetadata,
    navigateToTask,
    getTaskById,
  } = usePlanTasks({ filter });

  const selectedTask = selectedTaskId ? getTaskById(selectedTaskId) : undefined;
  const activeTasks = tasks.filter(task => !task.isArchived);
  const archivedTasks = tasks.filter(task => task.isArchived);
  const visibleCount = activeView === 'archive' ? archivedTasks.length : activeTasks.length;

  // Dynamic background based on canvas background
  const canvasBackground = project?.canvasBackground || 'radial-gradient(circle at center, #1a0b2e 0%, #000000 100%)';
  const centerColor = extractCenterColor(canvasBackground);
  const panelBgColor = hexToRgba(centerColor, 0.4);
  const headerBgColor = hexToRgba(centerColor, 0.6);

  const handleAddTask = () => {
    if (!newTaskText.trim() || !project) return;

    // Create a new freeform element with task checkbox syntax
    // Tasks go to the Task Inbox instead of random canvas positions
    const taskContent = `${newTaskText}${newTaskDescription.trim() ? `\n${newTaskDescription.trim()}` : ''}`;
    const newElement = {
      id: uuidv4(),
      type: 'freeform' as const,
      cardType: 'task' as const,
      noteTitle: undefined,
      noteBody: undefined,
      x: 0, // Position doesn't matter for inbox items
      y: 0,
      width: 300,
      height: 100,
      zIndex: Date.now(), // Use timestamp for unique high z-index
      content: taskContent,
      emoji: '📌',
      hypercubeTags: newTaskFaces,
      inInbox: true, // Mark as inbox item - not yet placed on canvas
      taskMetadata: {
        isActionable: true,
        status: newTaskStatus,
        priority: newTaskPriority || undefined,
        assignee: serializeAssignees(newTaskAssignees),
        startDate: newTaskStartDate?.toISOString(),
        dueDate: newTaskDueDate?.toISOString(),
        description: newTaskDescription.trim() || undefined,
      },
    };

    syncAddElement(newElement as any);
    setNewTaskText('');
    setNewTaskDescription('');
    setNewTaskStatus('not_started');
    setNewTaskPriority('');
    setNewTaskAssignees([]);
    setNewTaskDueDate(undefined);
    setNewTaskStartDate(undefined);
    setNewTaskFaces([]);
    setIsAddTaskOpen(false);
  };

  const handleDeleteTask = (taskId: string) => {
    syncRemoveElement(taskId);
    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-1rem)] h-[calc(100vh-1rem)] relative" style={{ background: canvasBackground }}>
      {/* Shimmer Grid - fixed position to cover entire viewport */}
      <ShimmerGrid className="!fixed inset-0 !z-0" />
      {/* Header - merged view tabs, count, and actions */}
      <div
        className="flex items-center justify-between my-4 px-6 py-4 border-b border-white/10 backdrop-blur-sm relative z-10"
        style={{ backgroundColor: headerBgColor }}
      >
        <div className="flex items-center gap-4">
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
              <TabsTrigger value="archive" className="gap-2">
                <Archive className="w-4 h-4" />
                Archive
              </TabsTrigger>
              <TabsTrigger value="versions" className="gap-2">
                <Milestone className="w-4 h-4" />
                Versions
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <span className="text-sm text-muted-foreground">
            {visibleCount} {visibleCount === 1 ? 'task' : 'tasks'}
          </span>
        </div>

        <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
          <DialogTrigger asChild>
            <Button variant="default" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-black/90 border-white/20 overflow-visible">
            <DialogHeader>
              <DialogTitle>Add New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder="Task title"
                className="bg-black/40 border-white/10"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddTask();
                  }
                }}
              />
              <Textarea
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                placeholder="Description / notes (optional)"
                className="bg-black/40 border-white/10 min-h-[90px]"
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Status</label>
                  <select
                    value={newTaskStatus}
                    onChange={(e) => setNewTaskStatus(e.target.value as TaskStatus)}
                    className="w-full h-9 rounded-md bg-black/40 border border-white/10 px-3 text-sm text-white"
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority | '')}
                    className="w-full h-9 rounded-md bg-black/40 border border-white/10 px-3 text-sm text-white"
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="">None</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Start Date</label>
                  <DatePicker
                    date={newTaskStartDate}
                    onSelect={setNewTaskStartDate}
                    placeholder="Set start date"
                    triggerClassName="!w-full"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Due Date</label>
                  <DatePicker
                    date={newTaskDueDate}
                    onSelect={setNewTaskDueDate}
                    placeholder="Set due date"
                    triggerClassName="!w-full"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Assignee</label>
                <AssigneeMultiSelect value={newTaskAssignees} onChange={setNewTaskAssignees} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Hypercube Faces</label>
                <FaceTagSelector value={newTaskFaces} onChange={setNewTaskFaces} />
              </div>
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
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* View Content */}
        <div className="flex-1 overflow-hidden">
          {activeView === 'kanban' && (
            <KanbanView
              tasks={activeTasks}
              onTaskClick={setSelectedTaskId}
              onTaskStatusChange={updateTaskStatus}
              onTaskNavigate={navigateToTask}
              onTaskUpdate={updateTaskMetadata}
            />
          )}
          {activeView === 'table' && (
            <TableView
              tasks={activeTasks}
              onTaskClick={setSelectedTaskId}
              onTaskNavigate={navigateToTask}
              onTaskUpdate={updateTaskMetadata}
            />
          )}
          {activeView === 'timeline' && (
            <GanttViewEnhanced
              tasks={activeTasks}
              onTaskClick={setSelectedTaskId}
              onTaskNavigate={navigateToTask}
              onTaskUpdate={updateTaskMetadata}
              onTaskDelete={handleDeleteTask}
              detailPanelOpen={!!selectedTask}
            />
          )}
          {activeView === 'calendar' && (
            <CalendarView
              tasks={activeTasks}
              onTaskClick={setSelectedTaskId}
              onTaskNavigate={navigateToTask}
              onTaskUpdate={updateTaskMetadata}
            />
          )}
          {activeView === 'archive' && (
            <ArchiveView
              tasks={archivedTasks}
              onTaskClick={setSelectedTaskId}
              onNavigate={navigateToTask}
              onRestore={(taskId) => updateTaskMetadata(taskId, { isArchived: false })}
            />
          )}
          {activeView === 'versions' && (
            <VersionsView
              tasks={activeTasks}
              onTaskClick={setSelectedTaskId}
              onTaskNavigate={navigateToTask}
              onTaskUpdate={updateTaskMetadata}
            />
          )}
        </div>

        {/* Detail Panel - Overlay */}
        {selectedTask && (
          <div
            className="absolute right-0 top-0 bottom-0 w-96 border-l border-white/10 overflow-y-auto gantt-scrollbar z-20 shadow-2xl shadow-black/50"
            style={{ backgroundColor: panelBgColor, backdropFilter: 'blur(12px)' }}
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

      {/* Global Scrollbar Styles */}
      <style jsx global>{`
        .gantt-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .gantt-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }
        .gantt-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(168, 85, 247, 0.3);
          border-radius: 4px;
        }
        .gantt-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(168, 85, 247, 0.5);
        }
        .gantt-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(168, 85, 247, 0.3) rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
}
