import type { CanvasElement, TableElement } from '@/types/canvas-elements';
import { makeEmptyTableCells } from '@/types/canvas-elements';
import type { TemplateDefinition } from './templates';
import {
  title, caption, divider, note, board, container, shape, storyboard, edge, zone, type Fam,
  NOTE_TEAL, NOTE_ROSE, NOTE_VIOLET, NOTE_EMERALD, WARM_SUN,
} from './templates-quickstart';

// ─── Classic templates, rebuilt against the design system ───────────────────
// The original 8 flat templates ("boxes with prompts") were rejected once the
// design language existed — these are their replacements, authored with the
// same factories and rules as the quickstart set (templates.design.md).

function runOfShowTable(id: string, x: number, y: number, containerId: string): TableElement {
  const cells = makeEmptyTableCells(3, 3);
  cells[0] = [
    { text: 'Time', bold: true },
    { text: 'Beat', bold: true },
    { text: 'Owner', bold: true },
  ];
  return {
    id, x, y, width: 560, height: 180, zIndex: 1,
    locked: false, boardId: null, surface: 'canvas',
    type: 'table', rows: 3, cols: 3, cells, headerRow: true,
    containerId,
  } as TableElement;
}

// ─── 1. Experience Journey — RAIL of five stage zones ───────────────────────

const STAGES: { key: string; label: string; fam: Fam; cap: string; noteTitle: string; emoji: string; fill: string }[] = [
  { key: 'aw', label: 'Awareness', fam: 'violet', cap: 'How does the audience first discover this? Channels, triggers, first impressions.', noteTitle: 'First Touch', emoji: '📣', fill: NOTE_VIOLET },
  { key: 'co', label: 'Consideration', fam: 'ocean', cap: 'What motivates commitment — and what hesitations stand in the way?', noteTitle: 'Motivation', emoji: '🤔', fill: NOTE_TEAL },
  { key: 'en', label: 'Engagement', fam: 'emerald', cap: 'The core interaction. Describe the peak moment of participation.', noteTitle: 'Peak Moment', emoji: '🔥', fill: NOTE_EMERALD },
  { key: 'ex', label: 'Experience', fam: 'sunset', cap: 'The lived experience: senses, emotions, pacing.', noteTitle: 'How It Feels', emoji: '✨', fill: WARM_SUN },
  { key: 're', label: 'Reflection', fam: 'rose', cap: 'How do participants reflect, remember, and share afterward?', noteTitle: 'Afterglow', emoji: '💭', fill: NOTE_ROSE },
];

const experienceJourney: TemplateDefinition = {
  id: 'experience-journey',
  name: 'Experience Journey',
  description: 'Map the end-to-end experience across five lifecycle stages',
  emoji: '🗺️',
  category: 'experience',
  elements: [
    title('ej-title', 40, 40, 'Experience Journey', 'linear-gradient(90deg, #6D28D9, #22D3EE)'),
    caption('ej-cap', 40, 88, 'Five stages, left to right. Fill each zone with what happens there — the seeded note starts the thinking.'),
    ...STAGES.flatMap((s, i) => {
      const zx = 40 + i * 540;
      return [
        ...zone(`ej-${s.key}`, zx, 160, 480, 520, s.label, s.fam, s.cap),
        note(`ej-${s.key}-n`, zx + 36, 310, s.noteTitle, s.emoji, s.fill, '', `ej-${s.key}`),
      ];
    }),
  ] as CanvasElement[],
  edges: [
    edge('ej-e1', 'ej-aw', 'ej-co', 'violet'),
    edge('ej-e2', 'ej-co', 'ej-en', 'ocean'),
    edge('ej-e3', 'ej-en', 'ej-ex', 'emerald'),
    edge('ej-e4', 'ej-ex', 'ej-re', 'sunset'),
  ],
};

// ─── 2. Immersive Experience Canvas — HUB with four corner zones ────────────

const immersiveCanvas: TemplateDefinition = {
  id: 'immersive-canvas',
  name: 'Immersive Experience Canvas',
  description: 'Design multi-sensory immersive environments and narratives',
  emoji: '🌀',
  category: 'experience',
  elements: [
    title('ic-title', 40, 40, 'Immersive Experience Canvas', 'linear-gradient(90deg, #A78BFA, #22D3EE)', 24, 700),
    caption('ic-cap', 40, 88, 'The concept sits at the center; audience, senses, space, and narrative orbit it. Double-click any hexagon to go deeper.', 700),

    ...zone('ic-core', 760, 540, 560, 500, 'Concept & Theme', 'violet',
      'What world are you creating, and why does it matter?'),
    note('ic-core-n', 796, 680, 'Core Concept', '💎', NOTE_VIOLET, 'One sentence. If it takes more, it is not the core yet.', 'ic-core'),

    ...zone('ic-aud', 40, 140, 540, 420, 'Audience', 'ocean',
      'Who arrives, and with what expectations?'),
    board('ic-aud-b1', 76, 280, 'Personas', '#60A5FA', 'ic-aud'),
    board('ic-aud-b2', 278, 280, 'Interviews', '#22D3EE', 'ic-aud'),

    ...zone('ic-sen', 1580, 140, 660, 420, 'Sensory Domains', 'rose',
      'One hexagon per sense — open it and collect references.'),
    board('ic-sen-b1', 1616, 280, 'Visual', '#EC4899', 'ic-sen'),
    board('ic-sen-b2', 1818, 280, 'Auditory', '#8B5CF6', 'ic-sen'),
    board('ic-sen-b3', 2020, 280, 'Haptic', '#F97316', 'ic-sen'),

    ...zone('ic-spa', 40, 1120, 540, 420, 'Spatial Layout', 'emerald',
      'Sketch or upload the space. Where do bodies move?'),
    { ...storyboard('ic-spa-sb', 76, 1260, 320, 220), containerId: 'ic-spa' },

    ...zone('ic-nar', 1580, 1120, 660, 420, 'Narrative Arc', 'glacier',
      'Beginning, climax, resolution — each gets its own board.'),
    board('ic-nar-b1', 1616, 1260, 'Beginning', '#22D3EE', 'ic-nar'),
    board('ic-nar-b2', 1818, 1260, 'Climax', '#A78BFA', 'ic-nar'),
    board('ic-nar-b3', 2020, 1260, 'Resolution', '#34D399', 'ic-nar'),
  ] as CanvasElement[],
  edges: [
    edge('ic-e1', 'ic-core', 'ic-aud', 'ocean'),
    edge('ic-e2', 'ic-core', 'ic-sen', 'rose'),
    edge('ic-e3', 'ic-core', 'ic-spa', 'emerald'),
    edge('ic-e4', 'ic-core', 'ic-nar', 'glacier'),
  ],
};

// ─── 3. Event Blueprint — RAIL of three phases + run-of-show table ──────────

const eventBlueprint: TemplateDefinition = {
  id: 'event-blueprint',
  name: 'Event Blueprint',
  description: 'Plan live events from pre-production through post-experience',
  emoji: '🎪',
  category: 'experience',
  elements: [
    title('eb-title', 40, 40, 'Event Blueprint', 'linear-gradient(90deg, #F97316, #F472B6)'),
    caption('eb-cap', 40, 88, 'Three phases, left to right. The run-of-show table in the middle is your minute-by-minute script.'),

    ...zone('eb-pre', 40, 160, 700, 520, 'Pre-Production', 'violet',
      'Everything that must be true before doors open.'),
    note('eb-pre-n', 76, 310, 'Checklist', '📋', NOTE_VIOLET, 'Venue, permits, gear, people.', 'eb-pre'),
    board('eb-pre-b', 368, 310, 'Logistics', '#8B5CF6', 'eb-pre'),

    ...zone('eb-live', 800, 160, 700, 740, 'Live Experience', 'sunset',
      'The event itself. Script the peak, then protect it.'),
    note('eb-live-n', 836, 310, 'Peak Moment', '✨', WARM_SUN, 'What must every participant feel at least once?', 'eb-live'),
    board('eb-live-b', 1128, 310, 'Moments', '#F97316', 'eb-live'),
    runOfShowTable('eb-live-t', 836, 680, 'eb-live'),

    ...zone('eb-post', 1560, 160, 700, 520, 'Post-Experience', 'rose',
      'The echo: follow-ups, debriefs, and what carries forward.'),
    note('eb-post-n', 1596, 310, 'Debrief', '💭', NOTE_ROSE, 'What worked, what broke, what surprised.', 'eb-post'),
    board('eb-post-b', 1888, 310, 'Learnings', '#EC4899', 'eb-post'),
  ] as CanvasElement[],
  edges: [
    edge('eb-e1', 'eb-pre', 'eb-live', 'violet'),
    edge('eb-e2', 'eb-live', 'eb-post', 'sunset'),
  ],
};

// ─── 4. Product Canvas — 2×2 zones + output shelf ────────────────────────────

const productCanvas: TemplateDefinition = {
  id: 'product-canvas',
  name: 'Product Canvas',
  description: 'Define your product from problem to channels, with an output shelf',
  emoji: '📦',
  category: 'product-brand',
  elements: [
    title('pc-title', 40, 40, 'Product Canvas', 'linear-gradient(90deg, #60A5FA, #A78BFA)'),
    caption('pc-cap', 40, 88, 'Problem feeds solution feeds metrics feeds channels. The shelf on the right holds the deeper work.'),

    ...zone('pc-prob', 40, 160, 620, 480, 'Problem', 'rose',
      'What hurts today? One problem per note.'),
    note('pc-prob-n', 76, 290, 'Pain Point', '😖', NOTE_ROSE, '', 'pc-prob'),

    ...zone('pc-sol', 700, 160, 620, 480, 'Solution', 'emerald',
      'The smallest thing that makes the problem go away.'),
    note('pc-sol-n', 736, 290, 'Solution Idea', '💡', NOTE_EMERALD, '', 'pc-sol'),

    ...zone('pc-met', 40, 680, 620, 480, 'Key Metrics', 'ocean',
      'How will you know it is working? Numbers, not vibes.'),
    note('pc-met-n', 76, 810, 'Key Metric', '📈', NOTE_TEAL, '', 'pc-met'),

    ...zone('pc-cha', 700, 680, 620, 480, 'Channels', 'violet',
      'Where does this reach people — and in what order?'),
    note('pc-cha-n', 736, 810, 'Channel', '📣', NOTE_VIOLET, '', 'pc-cha'),

    divider('pc-vdiv', 1400, 160, 1400, 1160, 'rgba(139,92,246,0.25)'),
    board('pc-b1', 1460, 160, 'Roadmap', '#8B5CF6'),
    board('pc-b2', 1460, 450, 'Research', '#22D3EE'),
    board('pc-b3', 1460, 740, 'Competitors', '#F97316'),
  ] as CanvasElement[],
  edges: [
    edge('pc-e1', 'pc-prob', 'pc-sol', 'rose'),
    edge('pc-e2', 'pc-sol', 'pc-met', 'emerald'),
    edge('pc-e3', 'pc-met', 'pc-cha', 'ocean'),
  ],
};

// ─── 5. Brand Assets — GALLERY frame ─────────────────────────────────────────

const swatchStyle = (fill: string) => ({
  bgColor: fill,
  borderColor: 'rgba(255,255,255,0.2)',
  borderWidth: 1,
});

const brandAssets: TemplateDefinition = {
  id: 'brand-assets',
  name: 'Brand System',
  description: 'Colors, voice, logo explorations, and the asset library in one frame',
  emoji: '✨',
  category: 'product-brand',
  elements: [
    title('ba-title', 40, 40, 'Brand System', 'linear-gradient(90deg, #C084FC, #22D3EE)'),
    caption('ba-cap', 40, 88, 'Swatches, voice, and visual explorations. Double-click the library to store final assets.'),

    ...zone('ba-frame', 40, 160, 1240, 790, 'Brand System', 'violet',
      'Everything the brand looks and sounds like, at a glance.'),
    { ...shape('ba-sw1', 76, 300, 100, 100, 'circle', '', swatchStyle('linear-gradient(135deg, #24113D 0%, #3D1E66 100%)')), containerId: 'ba-frame' },
    { ...shape('ba-sw2', 196, 300, 100, 100, 'circle', '', swatchStyle('linear-gradient(135deg, #0B1B2B 0%, #123A5A 100%)')), containerId: 'ba-frame' },
    { ...shape('ba-sw3', 316, 300, 100, 100, 'circle', '', swatchStyle('linear-gradient(135deg, #2B0F2A 0%, #3B1842 100%)')), containerId: 'ba-frame' },
    note('ba-voice', 460, 300, 'Voice & Tone', '🗣️', NOTE_VIOLET, 'Three adjectives. Three anti-adjectives.', 'ba-frame'),
    board('ba-lib', 770, 300, 'Asset Library', '#8B5CF6', 'ba-frame'),
    { ...storyboard('ba-logo1', 76, 660, 320, 250), containerId: 'ba-frame' },
    { ...storyboard('ba-logo2', 436, 660, 320, 250), containerId: 'ba-frame' },
    board('ba-type', 796, 660, 'Typography', '#22D3EE', 'ba-frame'),
  ] as CanvasElement[],
  edges: [],
};

// ─── 6. Mood Board — GALLERY of storyboard frames (exemplar-2 pattern) ───────

const moodBoard: TemplateDefinition = {
  id: 'mood-board',
  name: 'Mood Board',
  description: 'A 3×2 wall of framed references with captions',
  emoji: '🎨',
  category: 'creative',
  elements: [
    title('mb-title', 40, 40, 'Moodboard', 'linear-gradient(90deg, #F472B6, #A78BFA)'),
    caption('mb-cap', 40, 88, 'Upload a reference into each frame and caption why it belongs.'),
    ...zone('mb-frame', 40, 160, 1088, 700, 'Moodboard', 'rose',
      'What should this feel like? Collect the evidence.'),
    { ...storyboard('mb-1', 76, 300), containerId: 'mb-frame' }, { ...storyboard('mb-2', 420, 300), containerId: 'mb-frame' }, { ...storyboard('mb-3', 764, 300), containerId: 'mb-frame' },
    { ...storyboard('mb-4', 76, 574), containerId: 'mb-frame' }, { ...storyboard('mb-5', 420, 574), containerId: 'mb-frame' }, { ...storyboard('mb-6', 764, 574), containerId: 'mb-frame' },
  ] as CanvasElement[],
  edges: [],
};

// ─── 7. Lean Canvas — 3×3 zone grid ──────────────────────────────────────────

const LEAN_ZONES: { key: string; label: string; fam: Fam; cap: string }[] = [
  { key: 'prob', label: 'Problem', fam: 'rose', cap: 'Top three problems worth solving.' },
  { key: 'sol', label: 'Solution', fam: 'emerald', cap: 'The smallest fix for each problem.' },
  { key: 'uvp', label: 'Unique Value Proposition', fam: 'violet', cap: 'One clear sentence: why you, why now.' },
  { key: 'met', label: 'Key Metrics', fam: 'ocean', cap: 'The numbers that prove it is working.' },
  { key: 'cha', label: 'Channels', fam: 'sunset', cap: 'Paths to your customers, ranked.' },
  { key: 'seg', label: 'Customer Segments', fam: 'glacier', cap: 'Who is this for — and who is it NOT for?' },
  { key: 'cost', label: 'Cost Structure', fam: 'rose', cap: 'What it costs to run this.' },
  { key: 'rev', label: 'Revenue Streams', fam: 'emerald', cap: 'How money actually comes in.' },
  { key: 'adv', label: 'Unfair Advantage', fam: 'ocean', cap: 'What cannot be easily copied or bought.' },
];

const leanCanvas: TemplateDefinition = {
  id: 'lean-canvas',
  name: 'Lean Canvas',
  description: "One-page business model adapted from Ash Maurya's Lean Canvas",
  emoji: '📊',
  category: 'creative',
  elements: [
    title('lc-title', 40, 40, 'Lean Canvas', 'linear-gradient(90deg, #34D399, #60A5FA)'),
    caption('lc-cap', 40, 88, "One-page business model. Each zone's caption tells you what to capture — drag cards in as answers."),
    ...LEAN_ZONES.flatMap((z, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      return zone(`lc-${z.key}`, 40 + col * 560, 160 + row * 460, 520, 420, z.label, z.fam, z.cap);
    }),
  ] as CanvasElement[],
  edges: [],
};

// ─── 8. Brainstorm Board — RAIL: diverge → converge → act ────────────────────

const brainstormBoard: TemplateDefinition = {
  id: 'brainstorm-board',
  name: 'Brainstorm Board',
  description: 'Diverge, converge, and turn the winners into action',
  emoji: '💡',
  category: 'creative',
  elements: [
    title('bb-title', 40, 40, 'Brainstorm', 'linear-gradient(90deg, #F59E0B, #EF4444)'),
    caption('bb-cap', 40, 88, 'Quantity left, judgment middle, commitment right. Move notes rightward as they earn it.'),

    ...zone('bb-div', 40, 160, 640, 880, 'Diverge', 'violet',
      'No judging. One idea per note, as fast as possible.'),
    note('bb-div-n1', 76, 310, 'Wild Idea', '💡', NOTE_VIOLET, '', 'bb-div'),
    note('bb-div-n2', 76, 670, 'What if…', '🌊', NOTE_TEAL, '', 'bb-div'),

    ...zone('bb-con', 760, 160, 640, 880, 'Converge', 'ocean',
      'Cluster similar ideas, then pick what deserves to live.'),
    note('bb-con-n1', 796, 310, 'Cluster', '🧲', NOTE_TEAL, 'Name the pattern these ideas share.', 'bb-con'),
    note('bb-con-n2', 796, 670, 'Top Pick', '⭐', NOTE_ROSE, '', 'bb-con'),

    ...zone('bb-act', 1480, 160, 640, 880, 'Act', 'emerald',
      'Winners become actions with an owner and a date.'),
    note('bb-act-n1', 1516, 310, 'Next Step', '✅', NOTE_EMERALD, '', 'bb-act'),
    note('bb-act-n2', 1516, 670, 'Owner & When', '🚀', WARM_SUN, '', 'bb-act'),
  ] as CanvasElement[],
  edges: [
    edge('bb-e1', 'bb-div', 'bb-con', 'violet'),
    edge('bb-e2', 'bb-con', 'bb-act', 'ocean'),
  ],
};

export const CLASSIC_TEMPLATES: TemplateDefinition[] = [
  experienceJourney,
  immersiveCanvas,
  eventBlueprint,
  productCanvas,
  brandAssets,
  moodBoard,
  leanCanvas,
  brainstormBoard,
];
