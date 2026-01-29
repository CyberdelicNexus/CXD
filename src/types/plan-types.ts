// Plan Tab Types - Task projection layer over Canvas Elements
// Tasks are NOT separate entities - they are derived views of qualifying canvas cards

import type { 
  CanvasElement, 
  FreeformElement, 
  TextElement, 
  ShapeElement, 
  HypercubeFaceTag,
  TaskMetadata,
  TaskType
} from './canvas-elements';

// Re-export TaskMetadata and TaskType for convenience
export type { TaskMetadata, TaskType } from './canvas-elements';

// ============================================================================
// TASK QUALIFICATION RULES
// ============================================================================

/**
 * A card qualifies as a task if ANY of these conditions are met:
 * 1. Contains markdown task syntax: - [ ] or - [x]
 * 2. Has explicit actionable marker (isActionable flag)
 * 3. Is tagged with one or more hypercube faces
 */

export interface TaskQualificationCriteria {
  hasMarkdownTasks: boolean;      // Contains - [ ] or - [x] syntax
  isExplicitlyActionable: boolean; // Card has isActionable = true
  hasHypercubeTags: boolean;       // Card has hypercubeTags array with items
}

// ============================================================================
// TASK STATUS (derived from markdown or explicit)
// ============================================================================

export type TaskStatus = 
  | 'not_started'  // No checkbox or unchecked - [ ]
  | 'in_progress'  // Partial completion or explicitly marked
  | 'completed'    // Checked - [x]
  | 'blocked';     // Explicitly blocked

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

// ============================================================================
// TASK PROJECTION - Derived view of a qualifying card
// ============================================================================

/**
 * TaskProjection is NOT stored separately - it's computed on-demand from CanvasElement
 * This ensures single source of truth remains in the canvas
 */
export interface TaskProjection {
  // Identity - points back to source
  id: string;                        // Same as sourceElement.id
  sourceElementId: string;           // Reference to original canvas element
  sourceElementType: 'freeform' | 'text' | 'shape'; // Type of source element
  sourceBoardId: string | null;      // Board containing this element (null = root canvas)
  
  // Qualification info
  qualificationCriteria: TaskQualificationCriteria;
  
  // Task content (extracted/derived)
  title: string;                     // First line or extracted task text
  description: string;               // Full content of the card
  subtasks: SubtaskProjection[];     // Parsed from markdown checkboxes
  
  // Status (computed from content)
  status: TaskStatus;
  completedSubtasks: number;
  totalSubtasks: number;
  completionPercent: number;         // 0-100
  
  // Metadata (optional, from card extensions)
  priority?: TaskPriority;
  taskType?: TaskType;               // Task categorization
  dueDate?: string;                  // ISO date string
  startDate?: string;                // ISO date string
  assignee?: string;                 // User identifier
  estimatedHours?: number;
  tags?: string[];                   // Custom tags beyond hypercube
  customProperties?: Record<string, string | number | boolean>; // User-defined properties
  
  // Hypercube integration
  hypercubeTags: HypercubeFaceTag[]; // Links to hypercube faces
  linkedIntentId?: string;           // Indirect link to core intent via board hierarchy
  
  // Position in canvas (for navigation)
  canvasPosition: { x: number; y: number };
  
  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Subtask extracted from markdown checkbox syntax
 */
export interface SubtaskProjection {
  id: string;                        // Generated hash of content
  text: string;                      // Task text after checkbox
  isCompleted: boolean;              // [x] = true, [ ] = false
  lineIndex: number;                 // Line number in source content
}

// ============================================================================
// TASK-ENABLED ELEMENT TYPES
// ============================================================================

/**
 * These types extend base canvas elements with taskMetadata
 * Note: The actual taskMetadata field is defined in canvas-elements.ts
 */

// Extended FreeformElement with task metadata
export interface TaskEnabledFreeformElement extends FreeformElement {
  taskMetadata?: TaskMetadata;
}

// Extended TextElement with task metadata  
export interface TaskEnabledTextElement extends TextElement {
  taskMetadata?: TaskMetadata;
}

// Extended ShapeElement with task metadata
export interface TaskEnabledShapeElement extends ShapeElement {
  taskMetadata?: TaskMetadata;
}

// Union of all task-capable elements
export type TaskCapableElement = 
  | TaskEnabledFreeformElement 
  | TaskEnabledTextElement 
  | TaskEnabledShapeElement;

// ============================================================================
// VIEW CONFIGURATIONS
// ============================================================================

/**
 * Kanban View - Groups tasks by status columns
 */
export interface KanbanColumn {
  id: TaskStatus;
  label: string;
  tasks: TaskProjection[];
  color: string;
}

export interface KanbanViewConfig {
  type: 'kanban';
  columns: KanbanColumn[];
  groupBy: 'status' | 'priority' | 'hypercubeFace' | 'assignee';
  sortBy: 'dueDate' | 'priority' | 'createdAt' | 'title';
  sortDirection: 'asc' | 'desc';
}

/**
 * Table View - Flat list with sortable columns
 */
export interface TableColumn {
  id: string;
  label: string;
  accessor: keyof TaskProjection | string;
  width?: number;
  sortable?: boolean;
  filterable?: boolean;
}

export interface TableViewConfig {
  type: 'table';
  columns: TableColumn[];
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  pageSize: number;
  currentPage: number;
}

/**
 * Timeline View - Gantt-style horizontal bars
 */
export interface TimelineViewConfig {
  type: 'timeline';
  startDate: string;
  endDate: string;
  zoomLevel: 'day' | 'week' | 'month' | 'quarter';
  groupBy: 'hypercubeFace' | 'assignee' | 'none';
  showDependencies: boolean;
}

/**
 * Calendar View - Month/week grid
 */
export interface CalendarViewConfig {
  type: 'calendar';
  viewMode: 'month' | 'week' | 'day';
  currentDate: string;
  showCompleted: boolean;
  colorBy: 'status' | 'priority' | 'hypercubeFace';
}

export type PlanViewConfig = 
  | KanbanViewConfig 
  | TableViewConfig 
  | TimelineViewConfig 
  | CalendarViewConfig;

export type PlanViewType = 'kanban' | 'table' | 'timeline' | 'calendar';

// ============================================================================
// FILTER & QUERY TYPES
// ============================================================================

/**
 * Filter configuration for querying tasks
 * All views use the same filter system
 */
export interface TaskFilter {
  // Status filters
  statuses?: TaskStatus[];
  showCompleted?: boolean;
  
  // Hypercube face filter (critical for CXD integration)
  hypercubeFaces?: HypercubeFaceTag[];
  requireAllFaces?: boolean;         // AND vs OR logic
  
  // Date filters
  dueDateRange?: {
    start?: string;
    end?: string;
  };
  startDateRange?: {
    start?: string;
    end?: string;
  };
  
  // Other filters
  priorities?: TaskPriority[];
  assignees?: string[];
  searchQuery?: string;              // Full-text search in title/description
  boardIds?: string[];               // Filter by source board
  customTags?: string[];
  
  // Qualification filter
  includeImplicitTasks?: boolean;    // Include cards with markdown tasks
  includeExplicitTasks?: boolean;    // Include cards with isActionable
  includeTaggedCards?: boolean;      // Include cards with hypercube tags only
}

/**
 * Sort configuration
 */
export interface TaskSort {
  field: keyof TaskProjection | 'subtaskProgress';
  direction: 'asc' | 'desc';
}

/**
 * Query object combining filter and sort
 */
export interface TaskQuery {
  filter: TaskFilter;
  sort: TaskSort[];
  limit?: number;
  offset?: number;
}

// ============================================================================
// PLAN TAB STATE
// ============================================================================

export interface PlanTabState {
  // Current view
  activeView: PlanViewType;
  viewConfigs: {
    kanban: KanbanViewConfig;
    table: TableViewConfig;
    timeline: TimelineViewConfig;
    calendar: CalendarViewConfig;
  };
  
  // Active filter
  activeFilter: TaskFilter;
  savedFilters: SavedFilter[];
  
  // Selected task (for detail panel)
  selectedTaskId: string | null;
  
  // UI state
  isFilterPanelOpen: boolean;
  isDetailPanelOpen: boolean;
}

export interface SavedFilter {
  id: string;
  name: string;
  filter: TaskFilter;
  isDefault?: boolean;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const DEFAULT_TASK_FILTER: TaskFilter = {
  showCompleted: false,
  includeImplicitTasks: true,
  includeExplicitTasks: true,
  includeTaggedCards: true,
};

export const DEFAULT_KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'not_started', label: 'To Do', tasks: [], color: '#6B7280' },
  { id: 'in_progress', label: 'In Progress', tasks: [], color: '#3B82F6' },
  { id: 'blocked', label: 'Blocked', tasks: [], color: '#EF4444' },
  { id: 'completed', label: 'Done', tasks: [], color: '#10B981' },
];

export const DEFAULT_TABLE_COLUMNS: TableColumn[] = [
  { id: 'status', label: 'Status', accessor: 'status', width: 100, sortable: true },
  { id: 'title', label: 'Title', accessor: 'title', sortable: true, filterable: true },
  { id: 'hypercubeTags', label: 'Faces', accessor: 'hypercubeTags', width: 150 },
  { id: 'priority', label: 'Priority', accessor: 'priority', width: 100, sortable: true },
  { id: 'dueDate', label: 'Due Date', accessor: 'dueDate', width: 120, sortable: true },
  { id: 'progress', label: 'Progress', accessor: 'completionPercent', width: 100, sortable: true },
];

export const DEFAULT_PLAN_TAB_STATE: PlanTabState = {
  activeView: 'kanban',
  viewConfigs: {
    kanban: {
      type: 'kanban',
      columns: DEFAULT_KANBAN_COLUMNS,
      groupBy: 'status',
      sortBy: 'priority',
      sortDirection: 'desc',
    },
    table: {
      type: 'table',
      columns: DEFAULT_TABLE_COLUMNS,
      sortBy: 'dueDate',
      sortDirection: 'asc',
      pageSize: 25,
      currentPage: 0,
    },
    timeline: {
      type: 'timeline',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      zoomLevel: 'week',
      groupBy: 'hypercubeFace',
      showDependencies: false,
    },
    calendar: {
      type: 'calendar',
      viewMode: 'month',
      currentDate: new Date().toISOString(),
      showCompleted: false,
      colorBy: 'hypercubeFace',
    },
  },
  activeFilter: DEFAULT_TASK_FILTER,
  savedFilters: [],
  selectedTaskId: null,
  isFilterPanelOpen: false,
  isDetailPanelOpen: false,
};

// ============================================================================
// HYPERCUBE FACE COLORS (for visual consistency)
// ============================================================================

export const HYPERCUBE_FACE_TAGS: HypercubeFaceTag[] = [
  'Reality Planes',
  'Sensory Domains',
  'Presence Types',
  'State Mapping',
  'Trait Mapping',
  'Meaning Architecture',
];

export const HYPERCUBE_FACE_COLORS: Record<HypercubeFaceTag, string> = {
  'Reality Planes': '#8B5CF6',
  'Sensory Domains': '#EC4899',
  'Presence Types': '#06B6D4',
  'State Mapping': '#F59E0B',
  'Trait Mapping': '#10B981',
  'Meaning Architecture': '#6366F1',
};
