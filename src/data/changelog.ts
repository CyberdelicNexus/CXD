export interface ChangelogEntry {
  version: string;
  date: string;
  isLatest?: boolean;
  changes: {
    category: 'feature' | 'improvement' | 'bugfix' | 'breaking';
    description: string;
  }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.0.0',
    date: 'February 16, 2026',
    isLatest: true,
    changes: [
      {
        category: 'feature',
        description: 'New weighted credit system with per-model pricing',
      },
      {
        category: 'feature',
        description: 'Comprehensive Settings modal with 5 tabs (General, AI, Canvas, Account, About)',
      },
      {
        category: 'feature',
        description: 'BYOK (Bring Your Own Keys) for Pro and Lifetime users',
      },
      {
        category: 'feature',
        description: 'Support for 8 AI models across 4 providers (Anthropic, OpenAI, Google, Moonshot)',
      },
      {
        category: 'feature',
        description: 'Claude Opus 4.6 now available for Pro and Lifetime users',
      },
      {
        category: 'improvement',
        description: 'Updated pricing: Pro $20/mo, Lifetime $399 one-time',
      },
      {
        category: 'improvement',
        description: 'Enhanced responsive design for 4K monitors across all views',
      },
      {
        category: 'improvement',
        description: 'Streamlined settings with persistent preferences via localStorage',
      },
      {
        category: 'improvement',
        description: 'Language selector now supports English, Spanish, German, and French',
      },
      {
        category: 'improvement',
        description: 'Default view preference for canvas, map, or plan view on load',
      },
    ],
  },
  {
    version: '0.9.0',
    date: 'January 2026',
    changes: [
      {
        category: 'feature',
        description: 'Plan View with Kanban boards, table, timeline, and calendar views',
      },
      {
        category: 'feature',
        description: 'Hypercube Map 3D visualization with face tagging',
      },
      {
        category: 'feature',
        description: 'Real-time collaboration with cursor tracking and presence indicators',
      },
      {
        category: 'feature',
        description: 'Task inbox and notes system with drag-and-drop',
      },
      {
        category: 'feature',
        description: 'Experience Flow stages with reality plane toggles',
      },
      {
        category: 'improvement',
        description: 'Enhanced Framing Wizard with 11 steps across 6 phases',
      },
      {
        category: 'improvement',
        description: 'Reality Planes V2 with drag-and-drop reordering',
      },
    ],
  },
  {
    version: '0.8.0',
    date: 'December 2025',
    changes: [
      {
        category: 'feature',
        description: 'Infinite canvas with boards and nested containers',
      },
      {
        category: 'feature',
        description: 'Framing Wizard for guided experience design',
      },
      {
        category: 'feature',
        description: 'Reality Planes, Sensory Domains, and Presence Types framework',
      },
      {
        category: 'feature',
        description: 'State and Trait Mapping with quadrant system',
      },
      {
        category: 'feature',
        description: 'Project sharing with read-only tokens',
      },
      {
        category: 'improvement',
        description: 'Canvas navigation with pan and zoom',
      },
    ],
  },
  {
    version: '0.7.0',
    date: 'November 2025',
    changes: [
      {
        category: 'feature',
        description: 'Initial beta release',
      },
      {
        category: 'feature',
        description: 'User authentication with Supabase',
      },
      {
        category: 'feature',
        description: 'Project creation and management',
      },
      {
        category: 'feature',
        description: 'Basic canvas with freeform cards',
      },
    ],
  },
];

export function getLatestVersion(): ChangelogEntry {
  return CHANGELOG.find(entry => entry.isLatest) || CHANGELOG[0];
}

export function getCategoryColor(category: ChangelogEntry['changes'][0]['category']): string {
  switch (category) {
    case 'feature':
      return 'text-green-400 bg-green-500/20 border-green-500/30';
    case 'improvement':
      return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
    case 'bugfix':
      return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
    case 'breaking':
      return 'text-red-400 bg-red-500/20 border-red-500/30';
    default:
      return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
  }
}

export function getCategoryLabel(category: ChangelogEntry['changes'][0]['category']): string {
  switch (category) {
    case 'feature':
      return 'New';
    case 'improvement':
      return 'Improved';
    case 'bugfix':
      return 'Fixed';
    case 'breaking':
      return 'Breaking';
    default:
      return 'Change';
  }
}
