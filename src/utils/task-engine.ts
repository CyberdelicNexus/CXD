// Task Engine - Derives task projections from canvas elements
// This is the core logic layer for the Plan tab

import type { 
  CanvasElement, 
  FreeformElement, 
  TextElement, 
  ShapeElement,
  HypercubeFaceTag,
  TaskMetadata
} from '@/types/canvas-elements';
import type { 
  TaskProjection, 
  SubtaskProjection, 
  TaskStatus,
  TaskFilter,
  TaskQuery,
  TaskSort,
  TaskQualificationCriteria,
  TaskCapableElement
} from '@/types/plan-types';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// MARKDOWN TASK PARSING
// ============================================================================

const TASK_CHECKBOX_REGEX = /^(\s*)-\s*\[([ xX])\]\s*(.+)$/gm;
const UNCHECKED_TASK_REGEX = /^(\s*)-\s*\[\s*\]\s*(.+)$/gm;
const CHECKED_TASK_REGEX = /^(\s*)-\s*\[[xX]\]\s*(.+)$/gm;

/**
 * Extract title from content, removing markdown checkbox syntax
 */
function extractTitle(content: string): string {
  const firstLine = content.split('\n')[0]?.trim() ?? 'Untitled Task';
  
  // Remove markdown checkbox syntax from title
  const cleanTitle = firstLine.replace(/^\s*-?\s*\[([ xX])?\]\s*/, '').trim();
  
  // If empty after cleaning, use fallback
  if (cleanTitle.length === 0) {
    return 'Untitled Task';
  }
  
  // Truncate if too long
  return cleanTitle.length > 50 ? cleanTitle.substring(0, 47) + '...' : cleanTitle;
}

/**
 * Parse markdown content to extract subtasks
 * Also detects if card has multiple top-level tasks (for splitting into separate task projections)
 */
export function parseMarkdownTasks(content: string): SubtaskProjection[] {
  const subtasks: SubtaskProjection[] = [];
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    const match = line.match(/^\s*-\s*\[([ xX])\]\s*(.+)$/);
    if (match) {
      const isCompleted = match[1].toLowerCase() === 'x';
      const text = match[2].trim();
      subtasks.push({
        id: `${index}-${hashString(text)}`,
        text,
        isCompleted,
        lineIndex: index,
      });
    }
  });
  
  return subtasks;
}

/**
 * Check if content has multiple separate tasks (more than one [] bracket)
 * This determines if we should split the card into multiple task projections
 */
export function hasMultipleTasks(content: string): boolean {
  const taskMatches = content.match(/^\s*-\s*\[([ xX])\]\s*(.+)$/gm);
  return taskMatches ? taskMatches.length > 1 : false;
}

/**
 * Simple string hash for generating subtask IDs
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Check if content contains markdown task syntax
 */
export function hasMarkdownTasks(content: string): boolean {
  return TASK_CHECKBOX_REGEX.test(content);
}

/**
 * Update a specific subtask in content (toggle checkbox)
 */
export function updateSubtaskInContent(
  content: string, 
  lineIndex: number, 
  isCompleted: boolean
): string {
  const lines = content.split('\n');
  if (lineIndex >= 0 && lineIndex < lines.length) {
    const line = lines[lineIndex];
    if (isCompleted) {
      lines[lineIndex] = line.replace(/\[\s*\]/, '[x]');
    } else {
      lines[lineIndex] = line.replace(/\[[xX]\]/, '[ ]');
    }
  }
  return lines.join('\n');
}

// ============================================================================
// TASK QUALIFICATION
// ============================================================================

/**
 * Determine if a canvas element qualifies as a task
 */
export function qualifiesAsTask(element: CanvasElement): TaskQualificationCriteria {
  const content = getElementContent(element);
  const metadata = getTaskMetadata(element);
  
  return {
    hasMarkdownTasks: content ? hasMarkdownTasks(content) : false,
    isExplicitlyActionable: metadata?.isActionable === true,
    hasHypercubeTags: (element.hypercubeTags?.length ?? 0) > 0,
  };
}

/**
 * Check if element meets any qualification criteria
 * CRITICAL: Only cards with [ ] markdown become tasks
 * Hypercube tags alone NEVER create tasks
 */
export function isTaskQualified(element: CanvasElement): boolean {
  const criteria = qualifiesAsTask(element);
  return criteria.hasMarkdownTasks || criteria.isExplicitlyActionable;
}

/**
 * Get content from different element types
 */
export function getElementContent(element: CanvasElement): string | null {
  switch (element.type) {
    case 'freeform':
      return (element as FreeformElement).content;
    case 'text':
      return (element as TextElement).content;
    case 'shape':
      return (element as ShapeElement).content ?? null;
    default:
      return null;
  }
}

/**
 * Get task metadata from element if it exists
 */
export function getTaskMetadata(element: CanvasElement): TaskMetadata | undefined {
  if ('taskMetadata' in element) {
    return (element as TaskCapableElement).taskMetadata;
  }
  return undefined;
}

// ============================================================================
// TASK PROJECTION
// ============================================================================

/**
 * Project a canvas element into one or more TaskProjections
 * If a card has multiple [] tasks, each becomes a separate task projection
 * Returns an array of TaskProjections (can be empty if element doesn't qualify)
 */
export function projectElementAsTasks(
  element: CanvasElement,
  filter?: TaskFilter
): TaskProjection[] {
  // Check qualification - ONLY markdown tasks or explicit actionable
  const criteria = qualifiesAsTask(element);
  
  // Apply filter for qualification types
  if (filter) {
    const qualifiesByMarkdown = criteria.hasMarkdownTasks && filter.includeImplicitTasks !== false;
    const qualifiesByExplicit = criteria.isExplicitlyActionable && filter.includeExplicitTasks !== false;
    
    if (!qualifiesByMarkdown && !qualifiesByExplicit) {
      return [];
    }
  } else {
    // No filter - must have markdown tasks OR be explicitly actionable
    if (!criteria.hasMarkdownTasks && !criteria.isExplicitlyActionable) {
      return [];
    }
  }
  
  // Only process supported element types
  if (element.type !== 'freeform' && element.type !== 'text' && element.type !== 'shape') {
    return [];
  }
  
  const content = getElementContent(element) ?? '';
  const metadata = getTaskMetadata(element);
  
  // Use subtasks from taskMetadata if available, otherwise parse from markdown
  const subtasks = metadata?.subtasks 
    ? metadata.subtasks.map(st => ({
        id: st.id,
        text: st.text,
        isCompleted: st.isCompleted,
        lineIndex: st.order
      }))
    : parseMarkdownTasks(content);
  
  // If there are multiple checkbox tasks, split into separate task projections
  if (subtasks.length > 1 && !metadata?.subtasks) {  // Only split markdown tasks, not structured subtasks
    return subtasks.map((subtask, index) => {
      const status: TaskStatus = subtask.isCompleted ? 'completed' : 'not_started';
      
      return {
        id: `${element.id}-task-${index}`,
        sourceElementId: element.id,
        sourceElementType: element.type as 'freeform' | 'text' | 'shape',
        sourceBoardId: element.boardId ?? null,
        
        qualificationCriteria: criteria,
        
        title: subtask.text,
        description: subtask.text,
        subtasks: [], // Individual tasks don't have subtasks
        
        status,
        completedSubtasks: subtask.isCompleted ? 1 : 0,
        totalSubtasks: 1,
        completionPercent: subtask.isCompleted ? 100 : 0,
        
        priority: metadata?.priority,
        taskType: metadata?.taskType,
        dueDate: metadata?.dueDate,
        startDate: metadata?.startDate,
        assignee: metadata?.assignee,
        estimatedHours: metadata?.estimatedHours,
        tags: metadata?.customTags,
        customProperties: metadata?.customProperties,
        
        hypercubeTags: element.hypercubeTags ?? [],
        
        canvasPosition: { x: element.x, y: element.y },
      };
    });
  }
  
  // Single task or no subtasks - return one projection
  const title = extractTitle(content);
  
  const completedSubtasks = subtasks.filter(s => s.isCompleted).length;
  const totalSubtasks = subtasks.length;
  const completionPercent = totalSubtasks > 0 
    ? Math.round((completedSubtasks / totalSubtasks) * 100) 
    : 0;
  
  let status: TaskStatus = metadata?.status ?? 'not_started';
  if (!metadata?.status) {
    if (totalSubtasks > 0) {
      if (completedSubtasks === totalSubtasks) {
        status = 'completed';
      } else if (completedSubtasks > 0) {
        status = 'in_progress';
      }
    }
  }
  
  return [{
    id: element.id,
    sourceElementId: element.id,
    sourceElementType: element.type as 'freeform' | 'text' | 'shape',
    sourceBoardId: element.boardId ?? null,
    
    qualificationCriteria: criteria,
    
    title,
    description: content,
    subtasks,
    
    status,
    completedSubtasks,
    totalSubtasks,
    completionPercent,
    
    priority: metadata?.priority,
    taskType: metadata?.taskType,
    dueDate: metadata?.dueDate,
    startDate: metadata?.startDate,
    assignee: metadata?.assignee,
    estimatedHours: metadata?.estimatedHours,
    tags: metadata?.customTags,
    customProperties: metadata?.customProperties,
    
    hypercubeTags: element.hypercubeTags ?? [],
    
    canvasPosition: { x: element.x, y: element.y },
  }];
}

/**
 * Project a canvas element into a TaskProjection (legacy - single task)
 * Returns null if element doesn't qualify as a task
 * @deprecated Use projectElementAsTasks instead for multi-task support
 */
export function projectElementAsTask(
  element: CanvasElement,
  filter?: TaskFilter
): TaskProjection | null {
  // Check qualification
  const criteria = qualifiesAsTask(element);
  
  // Apply filter for qualification types
  if (filter) {
    const qualifiesByMarkdown = criteria.hasMarkdownTasks && filter.includeImplicitTasks !== false;
    const qualifiesByExplicit = criteria.isExplicitlyActionable && filter.includeExplicitTasks !== false;
    const qualifiesByTags = criteria.hasHypercubeTags && filter.includeTaggedCards !== false;
    
    if (!qualifiesByMarkdown && !qualifiesByExplicit && !qualifiesByTags) {
      return null;
    }
  } else {
    // No filter - must meet at least one criteria
    if (!criteria.hasMarkdownTasks && !criteria.isExplicitlyActionable && !criteria.hasHypercubeTags) {
      return null;
    }
  }
  
  // Only process supported element types
  if (element.type !== 'freeform' && element.type !== 'text' && element.type !== 'shape') {
    return null;
  }
  
  const content = getElementContent(element) ?? '';
  const metadata = getTaskMetadata(element);
  const subtasks = parseMarkdownTasks(content);
  
  // Extract title (first line or first 50 chars)
  const firstLine = content.split('\n')[0]?.trim() ?? 'Untitled Task';
  const title = firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;
  
  // Calculate completion
  const completedSubtasks = subtasks.filter(s => s.isCompleted).length;
  const totalSubtasks = subtasks.length;
  const completionPercent = totalSubtasks > 0 
    ? Math.round((completedSubtasks / totalSubtasks) * 100) 
    : 0;
  
  // Determine status
  let status: TaskStatus = metadata?.status ?? 'not_started';
  if (!metadata?.status) {
    if (totalSubtasks > 0) {
      if (completedSubtasks === totalSubtasks) {
        status = 'completed';
      } else if (completedSubtasks > 0) {
        status = 'in_progress';
      }
    }
  }
  
  return {
    id: element.id,
    sourceElementId: element.id,
    sourceElementType: element.type as 'freeform' | 'text' | 'shape',
    sourceBoardId: element.boardId ?? null,
    
    qualificationCriteria: criteria,
    
    title,
    description: content,
    subtasks,
    
    status,
    completedSubtasks,
    totalSubtasks,
    completionPercent,
    
    priority: metadata?.priority,
    dueDate: metadata?.dueDate,
    startDate: metadata?.startDate,
    assignee: metadata?.assignee,
    estimatedHours: metadata?.estimatedHours,
    tags: metadata?.customTags,
    
    hypercubeTags: element.hypercubeTags ?? [],
    
    canvasPosition: { x: element.x, y: element.y },
  };
}

// ============================================================================
// QUERY ENGINE
// ============================================================================

/**
 * Query tasks from a set of canvas elements
 * This is the main entry point for all Plan views
 */
export function queryTasks(
  elements: CanvasElement[],
  query: TaskQuery
): { tasks: TaskProjection[]; total: number } {
  // Project all qualifying elements (now supports multiple tasks per element)
  let tasks: TaskProjection[] = [];
  elements.forEach(el => {
    const projected = projectElementAsTasks(el, query.filter);
    tasks.push(...projected);
  });
  
  // Apply additional filters
  tasks = applyFilters(tasks, query.filter);
  
  // Store total before pagination
  const total = tasks.length;
  
  // Apply sorting
  tasks = applySorting(tasks, query.sort);
  
  // Apply pagination
  if (query.offset !== undefined) {
    tasks = tasks.slice(query.offset);
  }
  if (query.limit !== undefined) {
    tasks = tasks.slice(0, query.limit);
  }
  
  return { tasks, total };
}

/**
 * Apply filters to task projections
 */
function applyFilters(tasks: TaskProjection[], filter: TaskFilter): TaskProjection[] {
  return tasks.filter(task => {
    // Status filter
    if (filter.statuses && filter.statuses.length > 0) {
      if (!filter.statuses.includes(task.status)) {
        return false;
      }
    }
    
    // Show completed filter
    if (filter.showCompleted === false && task.status === 'completed') {
      return false;
    }
    
    // Hypercube face filter
    if (filter.hypercubeFaces && filter.hypercubeFaces.length > 0) {
      if (filter.requireAllFaces) {
        // AND logic - must have all specified faces
        const hasAllFaces = filter.hypercubeFaces.every(
          face => task.hypercubeTags.includes(face)
        );
        if (!hasAllFaces) return false;
      } else {
        // OR logic - must have at least one specified face
        const hasAnyFace = filter.hypercubeFaces.some(
          face => task.hypercubeTags.includes(face)
        );
        if (!hasAnyFace) return false;
      }
    }
    
    // Priority filter
    if (filter.priorities && filter.priorities.length > 0) {
      if (!task.priority || !filter.priorities.includes(task.priority)) {
        return false;
      }
    }
    
    // Assignee filter
    if (filter.assignees && filter.assignees.length > 0) {
      if (!task.assignee || !filter.assignees.includes(task.assignee)) {
        return false;
      }
    }
    
    // Due date range filter
    if (filter.dueDateRange) {
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        if (filter.dueDateRange.start && dueDate < new Date(filter.dueDateRange.start)) {
          return false;
        }
        if (filter.dueDateRange.end && dueDate > new Date(filter.dueDateRange.end)) {
          return false;
        }
      } else if (filter.dueDateRange.start || filter.dueDateRange.end) {
        // If we're filtering by due date and task has none, exclude it
        return false;
      }
    }
    
    // Board filter
    if (filter.boardIds && filter.boardIds.length > 0) {
      const taskBoardId = task.sourceBoardId ?? 'root';
      if (!filter.boardIds.includes(taskBoardId)) {
        return false;
      }
    }
    
    // Search query
    if (filter.searchQuery && filter.searchQuery.trim()) {
      const query = filter.searchQuery.toLowerCase();
      const matchesTitle = task.title.toLowerCase().includes(query);
      const matchesDescription = task.description.toLowerCase().includes(query);
      if (!matchesTitle && !matchesDescription) {
        return false;
      }
    }
    
    // Custom tags filter
    if (filter.customTags && filter.customTags.length > 0) {
      if (!task.tags || !filter.customTags.some(tag => task.tags?.includes(tag))) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Apply sorting to task projections
 */
function applySorting(tasks: TaskProjection[], sorts: TaskSort[]): TaskProjection[] {
  if (!sorts.length) return tasks;
  
  return [...tasks].sort((a, b) => {
    for (const sort of sorts) {
      let comparison = 0;
      
      switch (sort.field) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'status':
          comparison = statusOrder(a.status) - statusOrder(b.status);
          break;
        case 'priority':
          comparison = priorityOrder(a.priority) - priorityOrder(b.priority);
          break;
        case 'dueDate':
          comparison = compareDates(a.dueDate, b.dueDate);
          break;
        case 'startDate':
          comparison = compareDates(a.startDate, b.startDate);
          break;
        case 'completionPercent':
          comparison = (a.completionPercent ?? 0) - (b.completionPercent ?? 0);
          break;
        case 'subtaskProgress':
          comparison = (a.completionPercent ?? 0) - (b.completionPercent ?? 0);
          break;
        default:
          // Try direct property access for other fields
          const aVal = (a as any)[sort.field];
          const bVal = (b as any)[sort.field];
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            comparison = aVal.localeCompare(bVal);
          } else if (typeof aVal === 'number' && typeof bVal === 'number') {
            comparison = aVal - bVal;
          }
      }
      
      if (comparison !== 0) {
        return sort.direction === 'asc' ? comparison : -comparison;
      }
    }
    return 0;
  });
}

function statusOrder(status: TaskStatus): number {
  const order: Record<TaskStatus, number> = {
    'not_started': 0,
    'in_progress': 1,
    'blocked': 2,
    'completed': 3,
  };
  return order[status] ?? 0;
}

function priorityOrder(priority?: string): number {
  const order: Record<string, number> = {
    'urgent': 0,
    'high': 1,
    'medium': 2,
    'low': 3,
  };
  return priority ? (order[priority] ?? 4) : 4;
}

function compareDates(a?: string, b?: string): number {
  if (!a && !b) return 0;
  if (!a) return 1; // No date sorts to end
  if (!b) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
}

// ============================================================================
// VIEW-SPECIFIC HELPERS
// ============================================================================

/**
 * Group tasks by a field (for Kanban columns)
 */
export function groupTasksBy(
  tasks: TaskProjection[],
  groupBy: 'status' | 'priority' | 'hypercubeFace' | 'assignee'
): Map<string, TaskProjection[]> {
  const groups = new Map<string, TaskProjection[]>();
  
  tasks.forEach(task => {
    let keys: string[];
    
    switch (groupBy) {
      case 'status':
        keys = [task.status];
        break;
      case 'priority':
        keys = [task.priority ?? 'none'];
        break;
      case 'hypercubeFace':
        keys = task.hypercubeTags.length > 0 ? task.hypercubeTags : ['untagged'];
        break;
      case 'assignee':
        keys = [task.assignee ?? 'unassigned'];
        break;
      default:
        keys = ['other'];
    }
    
    keys.forEach(key => {
      const existing = groups.get(key) ?? [];
      existing.push(task);
      groups.set(key, existing);
    });
  });
  
  return groups;
}

/**
 * Get tasks for a specific date (for Calendar view)
 */
export function getTasksForDate(
  tasks: TaskProjection[],
  date: Date
): TaskProjection[] {
  const dateStr = date.toISOString().split('T')[0];
  return tasks.filter(task => {
    if (task.dueDate) {
      return task.dueDate.split('T')[0] === dateStr;
    }
    return false;
  });
}

/**
 * Get tasks within a date range (for Timeline view)
 */
export function getTasksInRange(
  tasks: TaskProjection[],
  startDate: Date,
  endDate: Date
): TaskProjection[] {
  return tasks.filter(task => {
    if (!task.startDate && !task.dueDate) return false;
    
    const taskStart = task.startDate ? new Date(task.startDate) : null;
    const taskEnd = task.dueDate ? new Date(task.dueDate) : null;
    
    // Task overlaps with range if:
    // - Task starts before range ends AND
    // - Task ends after range starts (or has no end)
    if (taskStart && taskStart > endDate) return false;
    if (taskEnd && taskEnd < startDate) return false;
    
    return true;
  });
}

// ============================================================================
// STATE UPDATE HELPERS
// ============================================================================

/**
 * Create updated content with toggled subtask
 * Used when user toggles a checkbox in Plan view
 */
export function createUpdatedContent(
  originalContent: string,
  subtaskIndex: number,
  newCompletedState: boolean
): string {
  return updateSubtaskInContent(originalContent, subtaskIndex, newCompletedState);
}

/**
 * Create task metadata update
 * Used when user changes status, priority, etc. in Plan view
 */
export function createTaskMetadataUpdate(
  existingMetadata: TaskMetadata | undefined,
  updates: Partial<TaskMetadata>
): TaskMetadata {
  return {
    ...existingMetadata,
    ...updates,
  };
}
