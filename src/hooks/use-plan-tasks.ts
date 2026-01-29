'use client';

import { useMemo, useCallback } from 'react';
import { useCXDStore } from '@/store/cxd-store';
import type { CanvasElement, HypercubeFaceTag } from '@/types/canvas-elements';
import type { 
  TaskProjection, 
  TaskFilter, 
  TaskQuery, 
  TaskSort,
  PlanViewType,
  TaskStatus,
  TaskPriority,
  DEFAULT_TASK_FILTER
} from '@/types/plan-types';
import { 
  queryTasks, 
  groupTasksBy, 
  projectElementAsTask,
  getTasksForDate,
  getTasksInRange,
  createUpdatedContent,
  createTaskMetadataUpdate
} from '@/utils/task-engine';

interface UsePlanTasksOptions {
  filter?: TaskFilter;
  sort?: TaskSort[];
  limit?: number;
  offset?: number;
}

interface UsePlanTasksReturn {
  // Task data
  tasks: TaskProjection[];
  totalCount: number;
  isLoading: boolean;
  
  // Grouped views
  tasksByStatus: Map<string, TaskProjection[]>;
  tasksByPriority: Map<string, TaskProjection[]>;
  tasksByFace: Map<string, TaskProjection[]>;
  
  // Actions
  toggleSubtask: (taskId: string, subtaskIndex: number) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  updateTaskPriority: (taskId: string, priority: TaskPriority) => void;
  updateTaskDueDate: (taskId: string, dueDate: string | undefined) => void;
  updateTaskMetadata: (taskId: string, metadata: Partial<TaskProjection>) => void;
  navigateToTask: (taskId: string) => void;
  
  // Helpers
  getTaskById: (taskId: string) => TaskProjection | undefined;
  getTasksForDate: (date: Date) => TaskProjection[];
  getTasksInRange: (startDate: Date, endDate: Date) => TaskProjection[];
  filterByFace: (face: HypercubeFaceTag) => TaskProjection[];
}

const DEFAULT_SORT: TaskSort[] = [
  { field: 'priority', direction: 'desc' },
  { field: 'dueDate', direction: 'asc' },
];

/**
 * Hook for accessing and manipulating tasks derived from canvas elements
 */
export function usePlanTasks(options: UsePlanTasksOptions = {}): UsePlanTasksReturn {
  const { 
    filter = { 
      showCompleted: true, 
      includeImplicitTasks: true, 
      includeExplicitTasks: true, 
      includeTaggedCards: true 
    }, 
    sort = DEFAULT_SORT,
    limit,
    offset 
  } = options;
  
  // Get canvas elements from store
  const project = useCXDStore(state => state.getCurrentProject());
  const updateCanvasElement = useCXDStore(state => state.updateCanvasElement);
  const setViewMode = useCXDStore(state => state.setViewMode);
  const setCanvasViewMode = useCXDStore(state => state.setCanvasViewMode);
  const setActiveBoardId = useCXDStore(state => state.setActiveBoardId);
  const highlightElementBriefly = useCXDStore(state => state.highlightElementBriefly);
  const setCanvasPosition = useCXDStore(state => state.setCanvasPosition);
  const setCanvasZoom = useCXDStore(state => state.setCanvasZoom);
  
  // Get all elements from project (including boards)
  const allElements = useMemo(() => {
    if (!project) return [];
    
    const elements: CanvasElement[] = [...(project.canvasElements || [])];
    
    // Include elements from all boards
    if (project.boards) {
      project.boards.forEach(board => {
        elements.push(...board.nodes);
      });
    }
    
    return elements;
  }, [project]);
  
  // Build query
  const query: TaskQuery = useMemo(() => ({
    filter,
    sort,
    limit,
    offset,
  }), [filter, sort, limit, offset]);
  
  // Execute query
  const { tasks, total } = useMemo(() => {
    const result = queryTasks(allElements, query);
    console.log('[PLAN TASKS] All elements:', allElements.length);
    console.log('[PLAN TASKS] Query result:', result.tasks.length, 'tasks');
    console.log('[PLAN TASKS] First few tasks:', result.tasks.slice(0, 3));
    return result;
  }, [allElements, query]);
  
  // Pre-computed groupings for views
  const tasksByStatus = useMemo(() => groupTasksBy(tasks, 'status'), [tasks]);
  const tasksByPriority = useMemo(() => groupTasksBy(tasks, 'priority'), [tasks]);
  const tasksByFace = useMemo(() => groupTasksBy(tasks, 'hypercubeFace'), [tasks]);
  
  // Toggle a subtask checkbox
  const toggleSubtask = useCallback((taskId: string, subtaskIndex: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const subtask = task.subtasks[subtaskIndex];
    if (!subtask) return;
    
    // Update the content with toggled checkbox
    const newContent = createUpdatedContent(
      task.description,
      subtask.lineIndex,
      !subtask.isCompleted
    );
    
    // Find and update the source element
    const element = allElements.find(el => el.id === taskId);
    if (element && 'content' in element) {
      updateCanvasElement(taskId, { content: newContent } as Partial<CanvasElement>);
    }
  }, [tasks, allElements, updateCanvasElement]);
  
  // Update task status
  const updateTaskStatus = useCallback((taskId: string, status: TaskStatus) => {
    const element = allElements.find(el => el.id === taskId);
    if (!element) return;
    
    const existingMetadata = 'taskMetadata' in element 
      ? (element as any).taskMetadata 
      : undefined;
    
    const newMetadata = createTaskMetadataUpdate(existingMetadata, { status });
    
    updateCanvasElement(taskId, { taskMetadata: newMetadata } as Partial<CanvasElement>);
  }, [allElements, updateCanvasElement]);
  
  // Update task priority
  const updateTaskPriority = useCallback((taskId: string, priority: TaskPriority) => {
    const element = allElements.find(el => el.id === taskId);
    if (!element) return;
    
    const existingMetadata = 'taskMetadata' in element 
      ? (element as any).taskMetadata 
      : undefined;
    
    const newMetadata = createTaskMetadataUpdate(existingMetadata, { priority });
    
    updateCanvasElement(taskId, { taskMetadata: newMetadata } as Partial<CanvasElement>);
  }, [allElements, updateCanvasElement]);
  
  // Update task due date
  const updateTaskDueDate = useCallback((taskId: string, dueDate: string | undefined) => {
    const element = allElements.find(el => el.id === taskId);
    if (!element) return;
    
    const existingMetadata = 'taskMetadata' in element 
      ? (element as any).taskMetadata 
      : undefined;
    
    const newMetadata = createTaskMetadataUpdate(existingMetadata, { dueDate });
    
    updateCanvasElement(taskId, { taskMetadata: newMetadata } as Partial<CanvasElement>);
  }, [allElements, updateCanvasElement]);
  
  // Update any task metadata
  const updateTaskMetadata = useCallback((taskId: string, updates: Partial<TaskProjection>) => {
    const element = allElements.find(el => el.id === taskId);
    if (!element) return;
    
    const existingMetadata = 'taskMetadata' in element 
      ? (element as any).taskMetadata 
      : undefined;
    
    const metadataUpdates: any = {};
    if (updates.status) metadataUpdates.status = updates.status;
    if (updates.priority) metadataUpdates.priority = updates.priority;
    if (updates.taskType !== undefined) metadataUpdates.taskType = updates.taskType;
    if (updates.dueDate !== undefined) metadataUpdates.dueDate = updates.dueDate;
    if (updates.startDate !== undefined) metadataUpdates.startDate = updates.startDate;
    if (updates.assignee !== undefined) metadataUpdates.assignee = updates.assignee;
    if (updates.estimatedHours !== undefined) metadataUpdates.estimatedHours = updates.estimatedHours;
    if (updates.tags) metadataUpdates.customTags = updates.tags;
    if (updates.subtasks) metadataUpdates.subtasks = updates.subtasks;
    if (updates.customProperties) metadataUpdates.customProperties = updates.customProperties;
    
    const newMetadata = createTaskMetadataUpdate(existingMetadata, metadataUpdates);
    
    updateCanvasElement(taskId, { taskMetadata: newMetadata } as Partial<CanvasElement>);
  }, [allElements, updateCanvasElement]);
  
  // Navigate to task in canvas
  const navigateToTask = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Switch to canvas view
    setViewMode('canvas');
    setCanvasViewMode('canvas');
    
    // Navigate to the correct board if needed
    if (task.sourceBoardId) {
      setActiveBoardId(task.sourceBoardId);
    } else {
      setActiveBoardId(null);
    }
    
    // Center on the element
    setCanvasPosition({
      x: -task.canvasPosition.x + window.innerWidth / 2,
      y: -task.canvasPosition.y + window.innerHeight / 2,
    });
    setCanvasZoom(1);
    
    // Highlight the element briefly
    highlightElementBriefly(taskId, 2000);
  }, [tasks, setViewMode, setCanvasViewMode, setActiveBoardId, setCanvasPosition, setCanvasZoom, highlightElementBriefly]);
  
  // Get task by ID
  const getTaskById = useCallback((taskId: string): TaskProjection | undefined => {
    return tasks.find(t => t.id === taskId);
  }, [tasks]);
  
  // Get tasks for a specific date
  const getTasksForDateHelper = useCallback((date: Date): TaskProjection[] => {
    return getTasksForDate(tasks, date);
  }, [tasks]);
  
  // Get tasks in a date range
  const getTasksInRangeHelper = useCallback((startDate: Date, endDate: Date): TaskProjection[] => {
    return getTasksInRange(tasks, startDate, endDate);
  }, [tasks]);
  
  // Filter by hypercube face
  const filterByFace = useCallback((face: HypercubeFaceTag): TaskProjection[] => {
    return tasks.filter(t => t.hypercubeTags.includes(face));
  }, [tasks]);
  
  return {
    tasks,
    totalCount: total,
    isLoading: false,
    
    tasksByStatus,
    tasksByPriority,
    tasksByFace,
    
    toggleSubtask,
    updateTaskStatus,
    updateTaskPriority,
    updateTaskDueDate,
    updateTaskMetadata,
    navigateToTask,
    
    getTaskById,
    getTasksForDate: getTasksForDateHelper,
    getTasksInRange: getTasksInRangeHelper,
    filterByFace,
  };
}
