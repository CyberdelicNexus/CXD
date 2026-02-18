/**
 * AI Task Creation Service
 *
 * Maps extracted tasks from AI responses to canvas elements in the Plan tab.
 * Creates tasks in the Canvas Task Inbox for user placement.
 */

import { v4 as uuidv4 } from 'uuid';
import type { ExtractedTask } from './ai-response-classifier';
import type { CanvasElement, FreeformElement, HypercubeFaceTag, TaskMetadata } from '@/types/canvas-elements';
import type { TaskStatus } from '@/types/plan-types';
import { FACE_DISPLAY_NAMES } from '@/lib/display-utils';

export interface TaskCreationOptions {
  chatMessageId: string;
  sourceInsightId?: string;
}

export interface TaskCreationResult {
  success: boolean;
  createdCount: number;
  errorCount: number;
  errors?: Array<{ task: ExtractedTask; error: string }>;
}

/**
 * Map effort estimation to estimated hours
 */
function effortToHours(effort: 'small' | 'medium' | 'large'): number {
  const mapping = {
    small: 1,
    medium: 4,
    large: 8,
  };
  return mapping[effort];
}

/**
 * Create a task element from extracted task data
 */
function createTaskElement(
  task: ExtractedTask,
  options: TaskCreationOptions
): CanvasElement {
  // Build content - task title on first line
  let content = task.title;

  // Add description as subsequent lines if present
  if (task.description && task.description !== task.title) {
    content += `\n${task.description}`;
  }

  // Create task metadata - use user-provided metadata if available
  const taskMetadata: TaskMetadata = {
    isActionable: true,
    status: (task.metadata?.status as TaskStatus) || 'not_started',
    priority: task.metadata?.priority as any,
    estimatedHours: task.estimatedEffort ? effortToHours(task.estimatedEffort) : 4,
    dueDate: task.metadata?.dueDate,
    startDate: task.metadata?.startDate,
    assignee: task.metadata?.assignee,
    // Add provenance metadata
    customProperties: {
      source: JSON.stringify({
        type: 'ai_chat',
        chatMessageId: options.chatMessageId,
        sourceInsightId: options.sourceInsightId,
        extractedAt: new Date().toISOString(),
      }),
    },
  };

  // Convert face keys to hypercube tags (map camelCase keys to display names)
  const hypercubeTags: HypercubeFaceTag[] = task.suggestedFaces
    .filter(face =>
      ['realityPlanes', 'sensoryDomains', 'presence', 'stateMapping', 'traitMapping', 'contextAndMeaning', 'intentionCore'].includes(face)
    )
    .map(face => FACE_DISPLAY_NAMES[face] as HypercubeFaceTag)
    .filter(Boolean); // Remove any undefined values

  // Create freeform element for inbox
  const element: FreeformElement = {
    id: uuidv4(),
    type: 'freeform',
    cardType: 'task',
    x: 0, // Position doesn't matter for inbox items
    y: 0,
    width: 300,
    height: 100,
    zIndex: Date.now() + Math.random(), // Unique z-index
    content,
    emoji: '🤖', // AI-generated task indicator
    hypercubeTags,
    inInbox: true, // Mark as inbox item - not yet placed on canvas
    taskMetadata,
  };

  return element;
}

/**
 * Create tasks from AI-extracted task data
 *
 * @param tasks - Array of extracted tasks from AI response
 * @param options - Creation options including provenance metadata
 * @param syncAddElement - Collaboration context function to add elements
 * @returns Result with success count and any errors
 */
export async function createTasksFromAI(
  tasks: ExtractedTask[],
  options: TaskCreationOptions,
  syncAddElement: (element: CanvasElement) => void
): Promise<TaskCreationResult> {
  const errors: Array<{ task: ExtractedTask; error: string }> = [];
  let createdCount = 0;

  // Process tasks sequentially to maintain order
  for (const task of tasks) {
    try {
      // Skip subtasks for now (Phase 1 - flat task list)
      // Subtask support can be added in Phase 1.5
      if (task.isSubtask) {
        continue;
      }

      // Validate task has minimum required data
      if (!task.title || task.title.trim().length === 0) {
        errors.push({
          task,
          error: 'Task title is required',
        });
        continue;
      }

      // Create the task element
      const element = createTaskElement(task, options);

      // Add to canvas via collaboration sync
      syncAddElement(element);

      createdCount++;
    } catch (error) {
      errors.push({
        task,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    success: errors.length === 0,
    createdCount,
    errorCount: errors.length,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Create a single task (for testing or direct creation)
 */
export function createSingleTask(
  task: ExtractedTask,
  options: TaskCreationOptions,
  syncAddElement: (element: CanvasElement) => void
): void {
  const element = createTaskElement(task, options);
  syncAddElement(element);
}
