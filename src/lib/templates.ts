import type { CanvasElement } from '@/types/canvas-elements';
import type { ElementStyle } from '@/types/canvas-elements';

export type TemplateCategory = 'experience' | 'product-brand' | 'creative';

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  experience: 'Experience Design',
  'product-brand': 'Product & Brand',
  creative: 'Creative & General',
};

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: TemplateCategory;
  elements: CanvasElement[];
}

const containerStyle: ElementStyle = {
  borderColor: 'rgba(255,255,255,0.15)',
  borderWidth: 1,
  borderStyle: 'dashed',
  bgColor: 'rgba(255,255,255,0.03)',
};

const promptStyle: ElementStyle = {
  fontSize: 14,
  fontWeight: 'normal',
  textColor: 'rgba(255,255,255,0.5)',
};

const labelStyle: ElementStyle = {
  fontSize: 16,
  fontWeight: 'bold',
  textColor: 'rgba(255,255,255,0.8)',
};

/**
 * Re-map element IDs to fresh UUIDs while preserving containerId references.
 * Call this before adding template elements to a project.
 */
export function remapTemplateIds(elements: CanvasElement[]): CanvasElement[] {
  const idMap = new Map<string, string>();
  // First pass: assign new IDs
  for (const el of elements) {
    idMap.set(el.id, crypto.randomUUID());
  }
  // Second pass: apply new IDs and remap containerId
  return elements.map((el) => ({
    ...el,
    id: idMap.get(el.id)!,
    ...('containerId' in el && el.containerId
      ? { containerId: idMap.get(el.containerId) ?? el.containerId }
      : {}),
  }));
}

// ─── Experience Design ──────────────────────────────────────────────

// 1. Experience Journey — 5 containers + 5 text prompts = 10 elements
const experienceJourney: TemplateDefinition = {
  id: 'experience-journey',
  name: 'Experience Journey',
  description: 'Map the end-to-end experience across five lifecycle stages',
  emoji: '🗺️',
  category: 'experience',
  elements: [
    { id: 'ej-c1', type: 'container', x: 50,   y: 100, width: 340, height: 420, zIndex: 0, label: 'Awareness',     tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    { id: 'ej-c2', type: 'container', x: 420,  y: 100, width: 340, height: 420, zIndex: 0, label: 'Consideration', tintColor: 'ocean',   collapsed: false, locked: false, style: containerStyle },
    { id: 'ej-c3', type: 'container', x: 790,  y: 100, width: 340, height: 420, zIndex: 0, label: 'Engagement',    tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    { id: 'ej-c4', type: 'container', x: 1160, y: 100, width: 340, height: 420, zIndex: 0, label: 'Experience',    tintColor: 'sunset',  collapsed: false, locked: false, style: containerStyle },
    { id: 'ej-c5', type: 'container', x: 1530, y: 100, width: 340, height: 420, zIndex: 0, label: 'Reflection',    tintColor: 'rose',    collapsed: false, locked: false, style: containerStyle },
    { id: 'ej-t1', type: 'text', x: 70,   y: 160, width: 300, height: 60, zIndex: 1, locked: false, containerId: 'ej-c1', content: 'How does the audience first discover this experience? What channels or triggers create awareness?', style: promptStyle, textAlign: 'left' },
    { id: 'ej-t2', type: 'text', x: 440,  y: 160, width: 300, height: 60, zIndex: 1, locked: false, containerId: 'ej-c2', content: 'What motivates someone to commit? What barriers or hesitations exist at this stage?', style: promptStyle, textAlign: 'left' },
    { id: 'ej-t3', type: 'text', x: 810,  y: 160, width: 300, height: 60, zIndex: 1, locked: false, containerId: 'ej-c3', content: 'What is the core interaction? Describe the peak moment of participation.', style: promptStyle, textAlign: 'left' },
    { id: 'ej-t4', type: 'text', x: 1180, y: 160, width: 300, height: 60, zIndex: 1, locked: false, containerId: 'ej-c4', content: 'What sensory and emotional elements define the lived experience?', style: promptStyle, textAlign: 'left' },
    { id: 'ej-t5', type: 'text', x: 1550, y: 160, width: 300, height: 60, zIndex: 1, locked: false, containerId: 'ej-c5', content: 'How do participants reflect on and share the experience afterward?', style: promptStyle, textAlign: 'left' },
  ] as CanvasElement[],
};

// 2. Immersive Experience Canvas — 5 containers + 5 text prompts = 10 elements
const immersiveCanvas: TemplateDefinition = {
  id: 'immersive-canvas',
  name: 'Immersive Experience Canvas',
  description: 'Design multi-sensory immersive environments and narratives',
  emoji: '🌀',
  category: 'experience',
  elements: [
    { id: 'ic-c1', type: 'container', x: 50,   y: 50,  width: 550, height: 300, zIndex: 0, label: 'Concept & Theme',  tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    { id: 'ic-c2', type: 'container', x: 630,  y: 50,  width: 550, height: 300, zIndex: 0, label: 'Audience',         tintColor: 'ocean',   collapsed: false, locked: false, style: containerStyle },
    { id: 'ic-c3', type: 'container', x: 50,   y: 380, width: 370, height: 300, zIndex: 0, label: 'Sensory Domains',  tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    { id: 'ic-c4', type: 'container', x: 450,  y: 380, width: 370, height: 300, zIndex: 0, label: 'Spatial Layout',   tintColor: 'sunset',  collapsed: false, locked: false, style: containerStyle },
    { id: 'ic-c5', type: 'container', x: 850,  y: 380, width: 330, height: 300, zIndex: 0, label: 'Narrative Arc',    tintColor: 'rose',    collapsed: false, locked: false, style: containerStyle },
    { id: 'ic-t1', type: 'text', x: 70,  y: 110, width: 510, height: 50, zIndex: 1, locked: false, containerId: 'ic-c1', content: 'What is the central concept or theme? What world are you creating and why does it matter?', style: promptStyle, textAlign: 'left' },
    { id: 'ic-t2', type: 'text', x: 650, y: 110, width: 510, height: 50, zIndex: 1, locked: false, containerId: 'ic-c2', content: 'Who is the intended audience? What prior knowledge or expectations do they bring?', style: promptStyle, textAlign: 'left' },
    { id: 'ic-t3', type: 'text', x: 70,  y: 440, width: 330, height: 50, zIndex: 1, locked: false, containerId: 'ic-c3', content: 'Which senses are engaged? Map visual, audio, haptic, olfactory, and taste elements.', style: promptStyle, textAlign: 'left' },
    { id: 'ic-t4', type: 'text', x: 470, y: 440, width: 330, height: 50, zIndex: 1, locked: false, containerId: 'ic-c4', content: 'How is the space organized? Describe zones, flow paths, and transition points.', style: promptStyle, textAlign: 'left' },
    { id: 'ic-t5', type: 'text', x: 870, y: 440, width: 290, height: 50, zIndex: 1, locked: false, containerId: 'ic-c5', content: 'Map the narrative arc: beginning, rising tension, climax, and resolution.', style: promptStyle, textAlign: 'left' },
  ] as CanvasElement[],
};

// 3. Event Blueprint — 3 containers + 3 text prompts = 6 elements
const eventBlueprint: TemplateDefinition = {
  id: 'event-blueprint',
  name: 'Event Blueprint',
  description: 'Plan live events from pre-production through post-experience',
  emoji: '🎪',
  category: 'experience',
  elements: [
    { id: 'eb-c1', type: 'container', x: 50,  y: 100, width: 500, height: 450, zIndex: 0, label: 'Pre-Production',  tintColor: 'ocean',   collapsed: false, locked: false, style: containerStyle },
    { id: 'eb-c2', type: 'container', x: 580, y: 100, width: 500, height: 450, zIndex: 0, label: 'Live Experience', tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    { id: 'eb-c3', type: 'container', x: 1110, y: 100, width: 500, height: 450, zIndex: 0, label: 'Post-Experience', tintColor: 'sunset',  collapsed: false, locked: false, style: containerStyle },
    { id: 'eb-t1', type: 'text', x: 70,   y: 160, width: 460, height: 50, zIndex: 1, locked: false, containerId: 'eb-c1', content: 'What are the critical milestones? List venue, vendors, permits, rehearsal dates, and budget.', style: promptStyle, textAlign: 'left' },
    { id: 'eb-t2', type: 'text', x: 600,  y: 160, width: 460, height: 50, zIndex: 1, locked: false, containerId: 'eb-c2', content: 'What are the signature moments? Map the guest journey from arrival to finale.', style: promptStyle, textAlign: 'left' },
    { id: 'eb-t3', type: 'text', x: 1130, y: 160, width: 460, height: 50, zIndex: 1, locked: false, containerId: 'eb-c3', content: 'How will you gather feedback and measure success? Plan surveys, thank-yous, and metrics.', style: promptStyle, textAlign: 'left' },
  ] as CanvasElement[],
};

// ─── Product & Brand ────────────────────────────────────────────────

// 4. Product Canvas — 6 containers + 6 text prompts = 12 elements
const productCanvas: TemplateDefinition = {
  id: 'product-canvas',
  name: 'Product Canvas',
  description: 'Define your product from problem to metrics in a structured grid',
  emoji: '📦',
  category: 'product-brand',
  elements: [
    { id: 'pc-c1', type: 'container', x: 50,  y: 50,  width: 400, height: 280, zIndex: 0, label: 'Problem',           tintColor: 'rose',    collapsed: false, locked: false, style: containerStyle },
    { id: 'pc-c2', type: 'container', x: 480, y: 50,  width: 400, height: 280, zIndex: 0, label: 'Solution',          tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    { id: 'pc-c3', type: 'container', x: 50,  y: 360, width: 280, height: 280, zIndex: 0, label: 'Audience',          tintColor: 'ocean',   collapsed: false, locked: false, style: containerStyle },
    { id: 'pc-c4', type: 'container', x: 360, y: 360, width: 340, height: 280, zIndex: 0, label: 'Value Proposition', tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    { id: 'pc-c5', type: 'container', x: 730, y: 360, width: 280, height: 280, zIndex: 0, label: 'Channels',          tintColor: 'sunset',  collapsed: false, locked: false, style: containerStyle },
    { id: 'pc-c6', type: 'container', x: 50,  y: 670, width: 960, height: 200, zIndex: 0, label: 'Key Metrics',       tintColor: 'glacier', collapsed: false, locked: false, style: containerStyle },
    { id: 'pc-t1', type: 'text', x: 70,  y: 110, width: 360, height: 50, zIndex: 1, locked: false, containerId: 'pc-c1', content: 'What problem are you solving? Who feels this pain most acutely?', style: promptStyle, textAlign: 'left' },
    { id: 'pc-t2', type: 'text', x: 500, y: 110, width: 360, height: 50, zIndex: 1, locked: false, containerId: 'pc-c2', content: 'How does your product solve it? What is the core mechanism?', style: promptStyle, textAlign: 'left' },
    { id: 'pc-t3', type: 'text', x: 70,  y: 420, width: 240, height: 50, zIndex: 1, locked: false, containerId: 'pc-c3', content: 'Describe your ideal customer persona.', style: promptStyle, textAlign: 'left' },
    { id: 'pc-t4', type: 'text', x: 380, y: 420, width: 300, height: 50, zIndex: 1, locked: false, containerId: 'pc-c4', content: '"We help [audience] to [outcome] by [method]."', style: promptStyle, textAlign: 'left' },
    { id: 'pc-t5', type: 'text', x: 750, y: 420, width: 240, height: 50, zIndex: 1, locked: false, containerId: 'pc-c5', content: 'How do customers find and access the product?', style: promptStyle, textAlign: 'left' },
    { id: 'pc-t6', type: 'text', x: 70,  y: 720, width: 920, height: 50, zIndex: 1, locked: false, containerId: 'pc-c6', content: 'Define your North Star metric and 3-5 supporting KPIs.', style: promptStyle, textAlign: 'left' },
  ] as CanvasElement[],
};

// 5. Brand Assets — 4 containers + 4 text prompts = 8 elements
const brandAssets: TemplateDefinition = {
  id: 'brand-assets',
  name: 'Brand Assets',
  description: 'Organize primary colors, logo, typography, and photographic style',
  emoji: '🎨',
  category: 'product-brand',
  elements: [
    { id: 'ba-c1', type: 'container', x: 50,  y: 50,  width: 480, height: 340, zIndex: 0, label: 'Primary Colors',      tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    { id: 'ba-c2', type: 'container', x: 560, y: 50,  width: 480, height: 340, zIndex: 0, label: 'Logo',                tintColor: 'ocean',   collapsed: false, locked: false, style: containerStyle },
    { id: 'ba-c3', type: 'container', x: 50,  y: 420, width: 480, height: 340, zIndex: 0, label: 'Typography',           tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    { id: 'ba-c4', type: 'container', x: 560, y: 420, width: 480, height: 340, zIndex: 0, label: 'Photographic Style',   tintColor: 'sunset',  collapsed: false, locked: false, style: containerStyle },
    { id: 'ba-t1', type: 'text', x: 70,  y: 110, width: 440, height: 50, zIndex: 1, locked: false, containerId: 'ba-c1', content: 'Add color swatches here. Define primary, secondary, and accent colors with hex values.', style: promptStyle, textAlign: 'left' },
    { id: 'ba-t2', type: 'text', x: 580, y: 110, width: 440, height: 50, zIndex: 1, locked: false, containerId: 'ba-c2', content: 'Place logo variations here: full color, monochrome, icon-only. Note minimum sizes and clear space.', style: promptStyle, textAlign: 'left' },
    { id: 'ba-t3', type: 'text', x: 70,  y: 480, width: 440, height: 50, zIndex: 1, locked: false, containerId: 'ba-c3', content: 'Define heading and body typefaces. Note weights, sizes, and line-height guidelines.', style: promptStyle, textAlign: 'left' },
    { id: 'ba-t4', type: 'text', x: 580, y: 480, width: 440, height: 50, zIndex: 1, locked: false, containerId: 'ba-c4', content: 'Describe the photographic direction: lighting, color treatment, subject matter, and composition rules.', style: promptStyle, textAlign: 'left' },
  ] as CanvasElement[],
};

// ─── Creative & General ─────────────────────────────────────────────

// 6. Mood Board — 5 containers + 3 text prompts = 8 elements
const moodBoard: TemplateDefinition = {
  id: 'mood-board',
  name: 'Mood Board',
  description: 'Collect visual inspiration, colors, typography, and references',
  emoji: '🎨',
  category: 'creative',
  elements: [
    { id: 'mb-c1', type: 'container', x: 50,  y: 50,  width: 1000, height: 320, zIndex: 0, label: 'Visual Inspiration', tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    { id: 'mb-c2', type: 'container', x: 50,  y: 400, width: 320,  height: 280, zIndex: 0, label: 'Color Palette',      tintColor: 'sunset',  collapsed: false, locked: false, style: containerStyle },
    { id: 'mb-c3', type: 'container', x: 400, y: 400, width: 320,  height: 280, zIndex: 0, label: 'Typography',         tintColor: 'ocean',   collapsed: false, locked: false, style: containerStyle },
    { id: 'mb-c4', type: 'container', x: 750, y: 400, width: 300,  height: 280, zIndex: 0, label: 'References',         tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    { id: 'mb-c5', type: 'container', x: 50,  y: 710, width: 1000, height: 180, zIndex: 0, label: 'Notes & Decisions',  tintColor: 'glacier', collapsed: false, locked: false, style: containerStyle },
    { id: 'mb-t1', type: 'text', x: 70,  y: 110, width: 960, height: 40, zIndex: 1, locked: false, containerId: 'mb-c1', content: 'Drag images here that capture the mood, texture, and aesthetic you are aiming for.', style: promptStyle, textAlign: 'left' },
    { id: 'mb-t2', type: 'text', x: 70,  y: 460, width: 280, height: 40, zIndex: 1, locked: false, containerId: 'mb-c2', content: 'Primary, secondary, and accent color swatches.', style: promptStyle, textAlign: 'left' },
    { id: 'mb-t3', type: 'text', x: 420, y: 460, width: 280, height: 40, zIndex: 1, locked: false, containerId: 'mb-c3', content: 'Heading and body typefaces with weight and size notes.', style: promptStyle, textAlign: 'left' },
  ] as CanvasElement[],
};

// 7. Lean Canvas — 9 containers + 9 text labels = 18 elements
const leanCanvas: TemplateDefinition = {
  id: 'lean-canvas',
  name: 'Lean Canvas',
  description: 'One-page business model adapted from Ash Maurya\'s Lean Canvas',
  emoji: '📋',
  category: 'creative',
  elements: [
    // Row 1: Problem | Solution | UVP | Unfair Advantage | Customer Segments
    { id: 'lc-c1', type: 'container', x: 50,  y: 50,  width: 300, height: 360, zIndex: 0, label: 'Problem',                tintColor: 'rose',    collapsed: false, locked: false, style: containerStyle },
    { id: 'lc-c2', type: 'container', x: 370, y: 50,  width: 300, height: 360, zIndex: 0, label: 'Solution',               tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    { id: 'lc-c3', type: 'container', x: 690, y: 50,  width: 300, height: 360, zIndex: 0, label: 'Unique Value Proposition', tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    { id: 'lc-c4', type: 'container', x: 1010, y: 50,  width: 300, height: 360, zIndex: 0, label: 'Unfair Advantage',       tintColor: 'ocean',   collapsed: false, locked: false, style: containerStyle },
    { id: 'lc-c5', type: 'container', x: 1330, y: 50,  width: 300, height: 360, zIndex: 0, label: 'Customer Segments',      tintColor: 'sunset',  collapsed: false, locked: false, style: containerStyle },
    // Row 2: Key Metrics | Channels
    { id: 'lc-c6', type: 'container', x: 50,  y: 440, width: 460, height: 260, zIndex: 0, label: 'Key Metrics',             tintColor: 'glacier', collapsed: false, locked: false, style: containerStyle },
    { id: 'lc-c7', type: 'container', x: 530, y: 440, width: 460, height: 260, zIndex: 0, label: 'Channels',                tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    // Row 3: Cost Structure | Revenue Streams
    { id: 'lc-c8', type: 'container', x: 50,  y: 730, width: 780, height: 220, zIndex: 0, label: 'Cost Structure',           tintColor: 'rose',    collapsed: false, locked: false, style: containerStyle },
    { id: 'lc-c9', type: 'container', x: 850, y: 730, width: 780, height: 220, zIndex: 0, label: 'Revenue Streams',          tintColor: 'sunset',  collapsed: false, locked: false, style: containerStyle },
    // Text labels inside each container
    { id: 'lc-t1', type: 'text', x: 70,   y: 110, width: 260, height: 40, zIndex: 1, locked: false, containerId: 'lc-c1', content: 'Top 3 problems your customers face', style: labelStyle, textAlign: 'left' },
    { id: 'lc-t2', type: 'text', x: 390,  y: 110, width: 260, height: 40, zIndex: 1, locked: false, containerId: 'lc-c2', content: 'Top 3 features or capabilities', style: labelStyle, textAlign: 'left' },
    { id: 'lc-t3', type: 'text', x: 710,  y: 110, width: 260, height: 40, zIndex: 1, locked: false, containerId: 'lc-c3', content: 'Single clear compelling message', style: labelStyle, textAlign: 'left' },
    { id: 'lc-t4', type: 'text', x: 1030, y: 110, width: 260, height: 40, zIndex: 1, locked: false, containerId: 'lc-c4', content: 'What can\'t be easily copied or bought', style: labelStyle, textAlign: 'left' },
    { id: 'lc-t5', type: 'text', x: 1350, y: 110, width: 260, height: 40, zIndex: 1, locked: false, containerId: 'lc-c5', content: 'Target customers and early adopters', style: labelStyle, textAlign: 'left' },
    { id: 'lc-t6', type: 'text', x: 70,   y: 500, width: 420, height: 40, zIndex: 1, locked: false, containerId: 'lc-c6', content: 'Key numbers that tell you how your business is doing', style: labelStyle, textAlign: 'left' },
    { id: 'lc-t7', type: 'text', x: 550,  y: 500, width: 420, height: 40, zIndex: 1, locked: false, containerId: 'lc-c7', content: 'Path to customers (online, direct, partners)', style: labelStyle, textAlign: 'left' },
    { id: 'lc-t8', type: 'text', x: 70,   y: 790, width: 740, height: 40, zIndex: 1, locked: false, containerId: 'lc-c8', content: 'Customer acquisition costs, hosting, salaries, fixed and variable costs', style: labelStyle, textAlign: 'left' },
    { id: 'lc-t9', type: 'text', x: 870,  y: 790, width: 740, height: 40, zIndex: 1, locked: false, containerId: 'lc-c9', content: 'Revenue model, pricing, lifetime value, gross margin', style: labelStyle, textAlign: 'left' },
  ] as CanvasElement[],
};

// 8. Brainstorm Board — 3 containers + 3 text prompts = 6 elements
const brainstormBoard: TemplateDefinition = {
  id: 'brainstorm',
  name: 'Brainstorm Board',
  description: 'Diverge, converge, and prioritize ideas into action items',
  emoji: '💡',
  category: 'creative',
  elements: [
    { id: 'bs-c1', type: 'container', x: 50,  y: 50,  width: 700, height: 420, zIndex: 0, label: 'Diverge — Generate Ideas', tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    { id: 'bs-c2', type: 'container', x: 780, y: 50,  width: 400, height: 420, zIndex: 0, label: 'Converge — Prioritize',    tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    { id: 'bs-c3', type: 'container', x: 50,  y: 500, width: 1130, height: 220, zIndex: 0, label: 'Action Items',            tintColor: 'sunset',  collapsed: false, locked: false, style: containerStyle },
    { id: 'bs-t1', type: 'text', x: 70,  y: 110, width: 660, height: 40, zIndex: 1, locked: false, containerId: 'bs-c1', content: 'No bad ideas! One card per idea. "How might we..." reframe the challenge as an open question.', style: promptStyle, textAlign: 'left' },
    { id: 'bs-t2', type: 'text', x: 800, y: 110, width: 360, height: 40, zIndex: 1, locked: false, containerId: 'bs-c2', content: 'Group similar ideas. Vote on top 3. Use Impact vs. Effort to prioritize.', style: promptStyle, textAlign: 'left' },
    { id: 'bs-t3', type: 'text', x: 70,  y: 560, width: 1090, height: 40, zIndex: 1, locked: false, containerId: 'bs-c3', content: 'For each chosen idea: Who owns it? What is the first step? When is the deadline?', style: promptStyle, textAlign: 'left' },
  ] as CanvasElement[],
};

// ─── Export all templates ───────────────────────────────────────────

export const TEMPLATES: TemplateDefinition[] = [
  // Experience Design
  experienceJourney,
  immersiveCanvas,
  eventBlueprint,
  // Product & Brand
  productCanvas,
  brandAssets,
  // Creative & General
  moodBoard,
  leanCanvas,
  brainstormBoard,
];
