/**
 * Version Management Types (Refactored)
 * Versions are now simple iterations (not containers with internal stages)
 * OKRs are the CORE feature - they define graduation criteria for versions
 */

/**
 * Version status enum
 * Simple linear progression: Draft → Active → Testing → Complete
 */
export type VersionStatus = 'draft' | 'active' | 'testing' | 'complete';

/**
 * Version type labels (replaces internal stage pipelines)
 * These are TAGS on versions, not stages within them
 */
export type VersionTypeLabel = 'POC' | 'Alpha' | 'Beta' | 'Release' | 'Patch' | 'Hotfix' | 'Custom';

/**
 * Default type label colors for UI visualization
 */
export const TYPE_LABEL_COLORS: Record<VersionTypeLabel, string> = {
  'POC': '#6B7280',
  'Alpha': '#3B82F6',
  'Beta': '#10B981',
  'Release': '#8B5CF6',
  'Patch': '#F59E0B',
  'Hotfix': '#EF4444',
  'Custom': '#6366F1',
};

/**
 * Represents a product version/iteration
 * Each version IS a single iteration with simple status progression
 */
export interface Version {
  id: string;                     // UUID
  name: string;                   // e.g., "v0.1", "Beta 1", "MVP"
  description: string;            // PRD/scope content (rich text/markdown)
  color: string;                  // Hex color for UI (swimlane, badges, etc.)

  // Version lifecycle
  status: VersionStatus;          // Current status: draft | active | testing | complete
  type_label: VersionTypeLabel;   // Type tag: POC, Alpha, Beta, Release, etc.
  targetDate?: string;            // ISO date string - target completion date
  started_at?: string;            // ISO timestamp - when status changed to 'active'
  completed_at?: string;          // ISO timestamp - when status changed to 'complete'

  // OKR-driven graduation
  okrIds: string[];               // Linked OKR IDs (CORE feature - not optional)

  // Learnings & retrospective
  learnings_content: string;      // Markdown content for retrospective/learnings

  // Version chain (parent-child relationships)
  parent_version_id?: string;     // ID of previous version (creates sequential chain)

  // Metadata
  createdAt: string;              // ISO timestamp
  updatedAt: string;              // ISO timestamp
  order: number;                  // Display order in timeline (0-based)
}

/**
 * Represents a key result within an OKR
 * Simple checkbox-based completion tracking
 */
export interface KeyResult {
  id: string;                     // UUID
  description: string;            // Key result description
  completed: boolean;             // Completion status (checkbox toggle)
  targetValue?: number;           // Legacy: Target metric (kept for backward compat)
  currentValue?: number;          // Legacy: Current progress (kept for backward compat)
  unit?: string;                  // Legacy: Unit of measurement (kept for backward compat)
  createdAt: string;              // ISO timestamp
  updatedAt: string;              // ISO timestamp
}

/**
 * Represents an Objective (part of OKR)
 * Strategic goal with measurable key results
 */
export interface Objective {
  id: string;                     // UUID
  title: string;                  // Objective title
  description: string;            // Objective description
  keyResults: KeyResult[];        // Key results array (2-5 recommended)
  createdAt: string;              // ISO timestamp
  updatedAt: string;              // ISO timestamp
}

/**
 * OKR card status - tracks the health/progress of this OKR
 */
export type OKRStatus = 'on_track' | 'at_risk' | 'behind' | 'complete';

/**
 * Represents a full OKR (Objective and Key Results)
 * OKRs are now the CORE mechanism for version graduation
 * Versions must meet OKR criteria to be marked complete
 */
export interface OKR {
  id: string;                     // UUID
  versionId: string;              // Version this OKR belongs to (1:N relationship)
  name?: string;                  // OKR name/title (optional for backward compat)
  description?: string;           // OKR description
  status?: OKRStatus;             // OKR health status
  startDate?: string;             // Optional start date (ISO string)
  dueDate?: string;               // Optional due date (ISO string)
  assignees?: string[];           // Optional assignees
  objectives: Objective[];        // Array of objectives (each with key results)
  createdAt: string;              // ISO timestamp
  updatedAt: string;              // ISO timestamp
}

/**
 * Computed progress for a version
 * Calculated on-demand from linked tasks and OKRs
 */
export interface VersionProgress {
  versionId: string;
  totalTasks: number;
  completedTasks: number;
  completionPercent: number;      // 0-100
  okrProgress: number;            // 0-100 (averaged from all OKRs)
}

/**
 * Computed progress for an OKR
 * Calculated from key results across all objectives
 */
export interface OKRProgress {
  okrId: string;
  overallProgress: number;        // 0-100 (averaged from all key results)
  objectiveProgress: {
    objectiveId: string;
    objectiveProgress: number;    // 0-100 (averaged from key results)
    keyResultProgress: { krId: string; progress: number }[];
  }[];
}

/**
 * Default type labels for quick selection in UI
 */
export const DEFAULT_TYPE_LABELS: VersionTypeLabel[] = [
  'POC',
  'Alpha',
  'Beta',
  'Release',
  'Patch',
  'Hotfix',
  'Custom',
];

/**
 * Factory function to create a new version with default values
 */
export function createDefaultVersion(
  name: string,
  order: number = 0,
  parentVersionId?: string
): Omit<Version, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name,
    description: '',
    color: '#8B5CF6', // Default purple
    status: 'draft',
    type_label: 'Alpha', // Default type
    targetDate: undefined,
    started_at: undefined,
    completed_at: undefined,
    okrIds: [],
    learnings_content: '',
    parent_version_id: parentVersionId,
    order,
  };
}

/**
 * Factory function to create a new OKR with default values
 */
export function createDefaultOKR(versionId: string): Omit<OKR, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    versionId,
    name: 'New OKR',
    description: '',
    status: 'on_track',
    dueDate: undefined,
    assignees: [],
    objectives: [],
  };
}

export const OKR_STATUS_CONFIG: Record<OKRStatus, { label: string; color: string; bg: string }> = {
  on_track: { label: 'On Track', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
  at_risk: { label: 'At Risk', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
  behind: { label: 'Behind', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' },
  complete: { label: 'Complete', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)' },
};

/**
 * Factory function to create a new objective
 */
export function createDefaultObjective(title: string): Omit<Objective, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title,
    description: '',
    keyResults: [],
  };
}

/**
 * Factory function to create a new key result
 */
export function createDefaultKeyResult(description: string): Omit<KeyResult, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    description,
    completed: false,
  };
}

/**
 * Helper to calculate key result completion percentage
 */
export function calculateKeyResultProgress(kr: KeyResult): number {
  // New checkbox-based system
  if (kr.completed !== undefined) {
    return kr.completed ? 100 : 0;
  }

  // Legacy: fallback to targetValue/currentValue if present
  if (kr.targetValue !== undefined && kr.currentValue !== undefined) {
    if (kr.targetValue === 0) return 0;
    return Math.min(100, Math.round((kr.currentValue / kr.targetValue) * 100));
  }

  return 0;
}

/**
 * Helper to calculate objective completion percentage
 */
export function calculateObjectiveProgress(objective: Objective): number {
  if (objective.keyResults.length === 0) return 0;
  const totalProgress = objective.keyResults.reduce(
    (sum, kr) => sum + calculateKeyResultProgress(kr),
    0
  );
  return Math.round(totalProgress / objective.keyResults.length);
}

/**
 * Helper to calculate OKR overall completion percentage
 */
export function calculateOKRProgress(okr: OKR): number {
  if (okr.objectives.length === 0) return 0;
  const totalProgress = okr.objectives.reduce(
    (sum, obj) => sum + calculateObjectiveProgress(obj),
    0
  );
  return Math.round(totalProgress / okr.objectives.length);
}
