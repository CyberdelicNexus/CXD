/**
 * Team projects for the Nexus staff area (platform D337): one project's tasks in the shape the
 * platform reads. Pure. Tasks are the same projection the Plan tab and the Master Plan use
 * (queryTasks over the canvas and its boards, completed included); archived ones are left out.
 * Assignees are the names typed on the card, sent as written.
 */

import { parseAssignees } from '@/components/cxd/plan/assignee-utils';
import type { CanvasElement } from '@/types/canvas-elements';
import type { TaskQuery } from '@/types/plan-types';
import { queryTasks } from '@/utils/task-engine';
import { safeCoverImage } from './listing';

export const TEAM_IDS_CAP = 40;
export const TEAM_TASK_CAP = 300;

const QUERY: TaskQuery = {
  filter: { showCompleted: true, includeImplicitTasks: true, includeExplicitTasks: true, includeTaggedCards: true },
  sort: [
    { field: 'priority', direction: 'desc' },
    { field: 'dueDate', direction: 'asc' },
  ],
};

export interface TeamTask {
  id: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'urgent' | null;
  dueDate: string | null;
  assignees: string[];
  percent: number;
}

export interface TeamProject {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  coverImage: string | null;
  collaborators: number;
  tasks: TeamTask[];
}

export interface TeamSourceRow {
  id: string;
  name: string | null;
  description: string | null;
  updated_at: string;
  project_data: unknown;
}

/** `?ids=a,b,c`: up to 40 distinct lower-cased uuids, or null when anything else is there. */
export function parseTeamIds(raw: string | null, isUuid: (value: unknown) => value is string): string[] | null {
  if (!raw) return null;
  const ids = raw.split(',').map((id) => id.trim().toLowerCase());
  if (ids.length === 0 || ids.length > TEAM_IDS_CAP || !ids.every((id) => isUuid(id))) return null;
  return ids.filter((id, index) => ids.indexOf(id) === index);
}

function elementsOf(projectData: unknown): CanvasElement[] {
  const data = (projectData || {}) as { canvasLayout?: { elements?: CanvasElement[]; boards?: { nodes?: CanvasElement[] }[] } };
  const elements: CanvasElement[] = [...(data.canvasLayout?.elements || [])];
  for (const board of data.canvasLayout?.boards || []) elements.push(...(board.nodes || []));
  return elements;
}

export function buildTeamProject(row: TeamSourceRow, collaborators: number): TeamProject {
  const elements = elementsOf(row.project_data);
  const tasks = elements.length === 0 ? [] : queryTasks(elements, QUERY).tasks;
  const coverImage = (row.project_data as { coverImage?: unknown } | null)?.coverImage;
  return {
    id: row.id,
    name: row.name ?? '',
    description: row.description ?? '',
    updatedAt: new Date(row.updated_at).toISOString(),
    coverImage: safeCoverImage(coverImage),
    collaborators,
    tasks: tasks
      .filter((task) => !task.isArchived && !task.taskMetadata?.isArchived)
      .slice(0, TEAM_TASK_CAP)
      .map((task) => ({
        id: task.id,
        title: (task.title || '').trim().slice(0, 200),
        status: task.status,
        priority: task.priority ?? null,
        dueDate: task.dueDate ?? null,
        assignees: parseAssignees(task.assignee).slice(0, 8),
        percent: Math.max(0, Math.min(100, Math.round(task.completionPercent || 0))),
      })),
  };
}
