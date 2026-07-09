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
    version: '1.3.0',
    date: 'July 10, 2026',
    isLatest: true,
    changes: [
      {
        category: 'feature',
        description: 'Master Plan Database (Pro) — a cross-project task cockpit with Table, Kanban, List, Timeline, Calendar, and Roadmap views over every task across every canvas you own or collaborate on',
      },
      {
        category: 'feature',
        description: 'Master Plan tasks are now fully editable — inline status/priority edits, drag-and-drop between Kanban columns, and a task detail panel that opens on click in any view, all writing safely back into the source project',
      },
      {
        category: 'feature',
        description: 'Master Plan Timeline uses the same Gantt chart as the single-project Plan tab, with drag-to-reschedule and dependencies; Roadmap shows every version across every project with its linked tasks',
      },
      {
        category: 'feature',
        description: 'AI-drafted canvas elements and AI-suggested Hypercube tags, both reviewed before they touch your canvas',
      },
      {
        category: 'feature',
        description: 'Wizard answers now populate the canvas as a hub-and-satellite layout of real Experience Block cards, boards, and notes instead of flat text containers, with text boxes that grow to fit their content',
      },
      {
        category: 'improvement',
        description: 'Dashboard redesign — profile stats and quick actions moved inline as compact squares, Experience Maps grid widened to 4 columns, and selecting a project now opens an in-grid overview panel with progress and a sensory-signature chart',
      },
      {
        category: 'bugfix',
        description: 'Hypercube Map — corrected the minimap so the selected face lands on the front of the cube, and removed a flicker during rotation',
      },
      {
        category: 'bugfix',
        description: 'Fixed a "Maximum update depth exceeded" crash that could occur right after completing the wizard',
      },
    ],
  },
  {
    version: '1.2.0',
    date: 'April 19, 2026',
    isLatest: false,
    changes: [
      {
        category: 'feature',
        description: 'Production-ready security hardening — rate limiting on auth endpoints, CSP headers, input validation, and cookie security',
      },
      {
        category: 'feature',
        description: 'SEO overhaul — Open Graph and Twitter Card tags, dynamic social previews for shared canvases, robots.txt, sitemap, JSON-LD structured data',
      },
      {
        category: 'feature',
        description: 'Error boundaries on all routes — graceful error recovery with retry buttons instead of white screens',
      },
      {
        category: 'feature',
        description: 'Environment validation at startup — clear error messages when required config is missing',
      },
      {
        category: 'feature',
        description: 'PWA manifest — app is now installable on mobile devices',
      },
      {
        category: 'feature',
        description: 'Vercel Speed Insights integration for performance monitoring',
      },
      {
        category: 'feature',
        description: 'Connector tag inheritance — elements spawned from connector drop menu now inherit parent hypercube tags',
      },
      {
        category: 'improvement',
        description: 'Dashboard loads significantly faster — lightweight project listing query excludes heavy canvas data',
      },
      {
        category: 'improvement',
        description: 'Canvas auto-save optimized — lightweight change detection replaces expensive full-project serialization',
      },
      {
        category: 'improvement',
        description: 'All images now use Next.js Image component for automatic optimization and lazy loading',
      },
      {
        category: 'improvement',
        description: 'Landing page is now statically generated for faster load times and better SEO',
      },
      {
        category: 'improvement',
        description: 'Unified loading screen with tesseract animation across all canvas loading states',
      },
      {
        category: 'improvement',
        description: 'Per-page metadata with unique titles and descriptions for every route',
      },
      {
        category: 'improvement',
        description: 'Stripe webhook hardened with idempotency checks to prevent duplicate credit additions',
      },
      {
        category: 'improvement',
        description: 'Request timeouts on all external calls — Stripe 10s, emails 5s, AI chat 60s',
      },
      {
        category: 'improvement',
        description: 'Mobile dialog overflow fix — dialogs no longer exceed viewport on small screens',
      },
      {
        category: 'bugfix',
        description: 'Fixed canvas zoom freeze — wheel event handler now uses zero-dependency pattern that never detaches',
      },
      {
        category: 'bugfix',
        description: 'Fixed XSS vulnerability in canvas note innerHTML assignments',
      },
      {
        category: 'bugfix',
        description: 'Fixed Stripe checkout redirecting to localhost instead of production domain',
      },
      {
        category: 'bugfix',
        description: 'Fixed right-click note cards spawning at incorrect 200x150 size instead of standard 300x300',
      },
      {
        category: 'bugfix',
        description: 'Fixed tour overlay crash when target elements are missing during dynamic component loading',
      },
      {
        category: 'bugfix',
        description: 'Fixed collaborator projects failing to open due to RLS permissions on direct fetch',
      },
      {
        category: 'bugfix',
        description: 'Fixed browser back button causing full page reloads instead of SPA navigation',
      },
      {
        category: 'bugfix',
        description: 'Removed ~50 debug console.log statements from production client code',
      },
    ],
  },
  {
    version: '1.1.0',
    date: 'February 18, 2026',
    isLatest: false,
    changes: [
      {
        category: 'feature',
        description: 'Subtask creation on Enter — pressing Enter inside a Task Note automatically creates a new subtask',
      },
      {
        category: 'feature',
        description: 'Multi-selection bounding box with proportional resize and optional non-uniform scaling',
      },
      {
        category: 'feature',
        description: 'Group context menu with alignment tools (left, center, right, top, middle, bottom)',
      },
      {
        category: 'feature',
        description: 'Shift+click multi-select — holding Shift and clicking elements adds them to group selection',
      },
      {
        category: 'improvement',
        description: 'Subtask text wrapping — text that exceeds available width now wraps instead of clipping',
      },
      {
        category: 'improvement',
        description: 'Canvas breadcrumbs relocated to navigation bar for cleaner layout',
      },
      {
        category: 'improvement',
        description: 'Image resize now fits content properly instead of cropping',
      },
      {
        category: 'improvement',
        description: 'Inbox blinking animation refined to 3 seconds with light purple color',
      },
      {
        category: 'improvement',
        description: 'Group bounding box drag — clicking anywhere inside the box now moves entire group',
      },
      {
        category: 'bugfix',
        description: 'Fixed Copy shortcut conflict that interfered with C shortcut on cards',
      },
      {
        category: 'bugfix',
        description: 'Fixed Framing Wizard "Explore Map" button navigation in last step',
      },
      {
        category: 'bugfix',
        description: 'Fixed "Create First Version" button not working in Versions view',
      },
      {
        category: 'bugfix',
        description: 'Fixed multi-group alignment tool icons rendering incorrectly',
      },
      {
        category: 'bugfix',
        description: 'Fixed infinite render loop when dropping inbox items on canvas',
      },
    ],
  },
  {
    version: '1.0.0',
    date: 'February 16, 2026',
    isLatest: false,
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
        description: 'Support for AI models across 3 providers (Anthropic, Google, Moonshot)',
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
