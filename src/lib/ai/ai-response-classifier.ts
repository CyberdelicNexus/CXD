/**
 * AI Response Classifier
 *
 * Analyzes AI chat responses and classifies actionable content (tasks, notes).
 * Runs client-side using heuristics - no AI call needed.
 */

import { FACE_DISPLAY_NAMES } from '@/lib/display-utils';

export interface ExtractedTask {
  title: string;
  description: string;
  suggestedFaces: string[];
  isSubtask: boolean;
  parentIndex?: number;
  estimatedEffort?: 'small' | 'medium' | 'large';
  metadata?: {
    status?: string;
    priority?: string;
    dueDate?: string;
    startDate?: string;
    assignee?: string;
  };
}

export interface ActionableContent {
  type: 'tasks' | 'note' | 'tasks_and_note';
  tasks: ExtractedTask[];
  noteContent: string;
  sourceInsightId?: string;
  sourceFaces: string[];
}

interface ClassifierOptions {
  sourceInsightId?: string;
  sourceFaces?: string[];
}

// Action verbs that indicate a task
const ACTION_VERBS = [
  'add', 'create', 'define', 'update', 'remove', 'fix', 'build', 'design',
  'write', 'test', 'review', 'implement', 'set up', 'configure', 'map',
  'connect', 'develop', 'establish', 'enhance', 'refine', 'integrate',
  'specify', 'document', 'validate', 'verify', 'adjust', 'modify'
];

// Task-related headings
const TASK_HEADINGS = [
  'action items', 'next steps', 'tasks', 'to do', 'recommendations',
  'steps', 'plan', 'recommended actions', 'suggested actions'
];

// Face-related keywords for detection
const FACE_KEYWORDS: Record<string, string[]> = {
  realityPlanes: ['PR', 'VR', 'AR', 'MR', 'GR', 'BR', 'CR', 'plane', 'planes', 'reality', 'physical', 'digital'],
  stateMapping: ['state', 'states', 'altered state', 'emotional state', 'psychological', 'internal'],
  traitMapping: ['trait', 'traits', 'lasting change', 'integration', 'transformation', 'outcome', 'behavioral'],
  contextAndMeaning: ['world', 'story', 'magic', 'narrative', 'meaning', 'context', 'framework'],
  sensoryDomains: ['sensory', 'visual', 'auditory', 'haptic', 'olfactory', 'tactile', 'sound', 'sight'],
  presence: ['presence', 'embodiment', 'attention', 'awareness', 'immersion', 'focus']
};

/**
 * Detect if a line is a task item
 */
function isTaskLine(line: string): boolean {
  const trimmed = line.trim();

  // Numbered list starting with action verb
  if (/^\d+\.\s+/.test(trimmed)) {
    const content = trimmed.replace(/^\d+\.\s+/, '').toLowerCase();
    return ACTION_VERBS.some(verb => content.startsWith(verb));
  }

  // Bullet list starting with action verb
  if (/^[-*]\s+/.test(trimmed) || /^[-*]\s\[\s?\]\s+/.test(trimmed)) {
    const content = trimmed.replace(/^[-*]\s+/, '').replace(/\[\s?\]\s+/, '').toLowerCase();
    return ACTION_VERBS.some(verb => content.startsWith(verb));
  }

  // Markdown checkbox
  if (/^-?\s*\[\s?\]\s+/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Extract effort estimation from task text
 */
function estimateEffort(text: string): 'small' | 'medium' | 'large' {
  const lower = text.toLowerCase();

  // Small: single-word actions, toggles, quick edits
  if (lower.match(/^(add|toggle|enable|disable|set|change)\s+\w+$/i)) {
    return 'small';
  }

  // Large indicators
  if (lower.includes('research') || lower.includes('design iteration') ||
      lower.includes('coordinate') || lower.includes('across') ||
      lower.match(/multiple|several|all|comprehensive/i)) {
    return 'large';
  }

  // Medium: most content creation and multi-step work
  return 'medium';
}

/**
 * Extract tasks from response text
 */
function extractTasks(text: string, detectedFaces: string[]): ExtractedTask[] {
  const lines = text.split('\n');
  const tasks: ExtractedTask[] = [];
  let inTaskSection = false;
  let currentParentIndex: number | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if we're entering a task section
    if (TASK_HEADINGS.some(heading => trimmed.toLowerCase().includes(heading))) {
      inTaskSection = true;
      continue;
    }

    // Empty line might end task section
    if (trimmed === '' && inTaskSection) {
      const nextNonEmpty = lines.slice(i + 1).find(l => l.trim() !== '');
      if (nextNonEmpty && !isTaskLine(nextNonEmpty)) {
        inTaskSection = false;
        currentParentIndex = undefined;
      }
      continue;
    }

    // Detect task lines
    if (isTaskLine(line) || inTaskSection) {
      const indentLevel = line.search(/\S/);
      const isIndented = indentLevel > 2;

      if (isTaskLine(line)) {
        // Extract title (first line of the task)
        let title = trimmed
          .replace(/^\d+\.\s+/, '')
          .replace(/^[-*]\s+/, '')
          .replace(/\[\s?\]\s+/, '')
          .trim();

        // Get description (look ahead for non-task lines that might be elaboration)
        let description = title;
        let j = i + 1;
        while (j < lines.length && lines[j].trim() !== '' && !isTaskLine(lines[j])) {
          const nextLine = lines[j].trim();
          if (nextLine && !nextLine.startsWith('#')) {
            description += ' ' + nextLine;
          }
          j++;
        }

        // Detect faces mentioned in this specific task
        const taskFaces = detectFaces(description, detectedFaces);

        const task: ExtractedTask = {
          title: title.length > 100 ? title.substring(0, 100) + '...' : title,
          description: description.length > 500 ? description.substring(0, 500) + '...' : description,
          suggestedFaces: taskFaces.length > 0 ? taskFaces : detectedFaces,
          isSubtask: isIndented && currentParentIndex !== undefined,
          parentIndex: isIndented ? currentParentIndex : undefined,
          estimatedEffort: estimateEffort(title)
        };

        tasks.push(task);

        if (!isIndented) {
          currentParentIndex = tasks.length - 1;
        }
      }
    }
  }

  return tasks;
}

/**
 * Detect Hypercube faces mentioned in text
 */
function detectFaces(text: string, inheritedFaces: string[]): string[] {
  const lower = text.toLowerCase();
  const detected = new Set<string>(inheritedFaces);

  // Check for exact face display names
  Object.entries(FACE_DISPLAY_NAMES).forEach(([key, displayName]) => {
    if (text.includes(displayName)) {
      detected.add(key);
    }
  });

  // Check for face-related keywords
  Object.entries(FACE_KEYWORDS).forEach(([faceKey, keywords]) => {
    if (keywords.some(keyword => lower.includes(keyword.toLowerCase()))) {
      detected.add(faceKey);
    }
  });

  return Array.from(detected);
}

/**
 * Extract note-worthy content from response
 */
function extractNoteContent(text: string, hasTasks: boolean): string {
  // If the response is very short, it's not note-worthy
  if (text.length < 100) {
    return '';
  }

  // Remove task sections
  const lines = text.split('\n');
  const noteLines: string[] = [];
  let inTaskSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip headings that indicate task sections
    if (TASK_HEADINGS.some(heading => trimmed.toLowerCase().includes(heading))) {
      inTaskSection = true;
      continue;
    }

    // Skip empty lines
    if (trimmed === '') {
      if (inTaskSection && noteLines.length > 0) {
        inTaskSection = false;
      }
      continue;
    }

    // Skip task lines
    if (isTaskLine(line)) {
      continue;
    }

    // Add explanatory content
    if (!inTaskSection && trimmed.length > 20) {
      noteLines.push(trimmed);
    }
  }

  const noteContent = noteLines.join('\n\n');

  // Only return as note if there's substantial explanatory content
  if (noteContent.length < 100) {
    return '';
  }

  // Cap at 2000 characters
  if (noteContent.length > 2000) {
    return noteContent.substring(0, 2000) + '...';
  }

  return noteContent;
}

/**
 * Classify an AI response into actionable content
 */
export function classifyResponse(
  responseText: string,
  options: ClassifierOptions = {}
): ActionableContent {
  const { sourceInsightId, sourceFaces = [] } = options;

  // Detect faces mentioned in the response
  const detectedFaces = detectFaces(responseText, sourceFaces);

  // Extract tasks
  const tasks = extractTasks(responseText, detectedFaces);

  // Extract note content
  const noteContent = extractNoteContent(responseText, tasks.length > 0);

  // Determine type
  let type: ActionableContent['type'] = 'note';
  if (tasks.length > 0 && noteContent) {
    type = 'tasks_and_note';
  } else if (tasks.length > 0) {
    type = 'tasks';
  } else if (noteContent) {
    type = 'note';
  }

  return {
    type,
    tasks,
    noteContent,
    sourceInsightId,
    sourceFaces: detectedFaces
  };
}
