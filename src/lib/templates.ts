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

const experienceJourney: TemplateDefinition = {
  id: 'experience-journey',
  name: 'Experience Journey',
  description: 'Map the end-to-end experience across five lifecycle stages',
  emoji: '🗺️',
  category: 'experience',
  elements: [
    // Containers
    { id: 'ej-awareness',     type: 'container', x: 50,   y: 200, width: 350, height: 500, zIndex: 0, label: 'Awareness',     tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    { id: 'ej-consideration', type: 'container', x: 430,  y: 200, width: 350, height: 500, zIndex: 0, label: 'Consideration', tintColor: 'ocean',   collapsed: false, locked: false, style: containerStyle },
    { id: 'ej-engagement',    type: 'container', x: 810,  y: 200, width: 350, height: 500, zIndex: 0, label: 'Engagement',    tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    { id: 'ej-experience',    type: 'container', x: 1190, y: 200, width: 350, height: 500, zIndex: 0, label: 'Experience',    tintColor: 'sunset',  collapsed: false, locked: false, style: containerStyle },
    { id: 'ej-reflection',    type: 'container', x: 1570, y: 200, width: 350, height: 500, zIndex: 0, label: 'Reflection',    tintColor: 'rose',    collapsed: false, locked: false, style: containerStyle },
    // Prompt cards
    { id: 'ej-p1', type: 'freeform', x: 70,   y: 260, width: 200, height: 120, zIndex: 1, locked: false, containerId: 'ej-awareness',     cardType: 'note', content: 'How does the audience first discover this experience? What channels or triggers create awareness?' },
    { id: 'ej-p2', type: 'freeform', x: 450,  y: 260, width: 200, height: 120, zIndex: 1, locked: false, containerId: 'ej-consideration', cardType: 'note', content: 'What motivates someone to commit? What barriers or hesitations exist at this stage?' },
    { id: 'ej-p3', type: 'freeform', x: 830,  y: 260, width: 200, height: 120, zIndex: 1, locked: false, containerId: 'ej-engagement',    cardType: 'note', content: 'What is the core interaction? Describe the peak moment of participation.' },
    { id: 'ej-p4', type: 'freeform', x: 1210, y: 260, width: 200, height: 120, zIndex: 1, locked: false, containerId: 'ej-experience',    cardType: 'note', content: 'What sensory and emotional elements define the lived experience? How is the environment designed?' },
    { id: 'ej-p5', type: 'freeform', x: 1590, y: 260, width: 200, height: 120, zIndex: 1, locked: false, containerId: 'ej-reflection',    cardType: 'note', content: 'How do participants reflect on and share the experience? What lasting impression remains?' },
    // Example content card in Engagement
    { id: 'ej-ex1', type: 'freeform', x: 830, y: 420, width: 200, height: 100, zIndex: 1, locked: false, containerId: 'ej-engagement', cardType: 'note', content: 'Example: Guests enter a projection-mapped tunnel that responds to their movement, building anticipation before the main reveal.' },
  ] as CanvasElement[],
};

const immersiveCanvas: TemplateDefinition = {
  id: 'immersive-canvas',
  name: 'Immersive Experience Canvas',
  description: 'Design multi-sensory immersive environments and narratives',
  emoji: '🌀',
  category: 'experience',
  elements: [
    // Containers
    { id: 'ic-concept',  type: 'container', x: 350,  y: 50,  width: 600, height: 280, zIndex: 0, label: 'Concept',         tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    { id: 'ic-audience', type: 'container', x: 50,   y: 50,  width: 270, height: 280, zIndex: 0, label: 'Audience',        tintColor: 'ocean',   collapsed: false, locked: false, style: containerStyle },
    { id: 'ic-sensory',  type: 'container', x: 980,  y: 50,  width: 300, height: 280, zIndex: 0, label: 'Sensory Domains', tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    { id: 'ic-spatial',  type: 'container', x: 50,   y: 370, width: 600, height: 320, zIndex: 0, label: 'Spatial Layout',  tintColor: 'sunset',  collapsed: false, locked: false, style: containerStyle },
    { id: 'ic-narrative',type: 'container', x: 680,  y: 370, width: 600, height: 320, zIndex: 0, label: 'Narrative Arc',   tintColor: 'rose',    collapsed: false, locked: false, style: containerStyle },
    // Prompt cards
    { id: 'ic-p1', type: 'freeform', x: 370,  y: 110, width: 220, height: 100, zIndex: 1, locked: false, containerId: 'ic-concept',   cardType: 'note', content: 'What is the central concept or theme? What world are you creating and why does it matter?' },
    { id: 'ic-p2', type: 'freeform', x: 70,   y: 110, width: 220, height: 100, zIndex: 1, locked: false, containerId: 'ic-audience',  cardType: 'note', content: 'Who is the intended audience? What prior knowledge or expectations do they bring?' },
    { id: 'ic-p3', type: 'freeform', x: 1000, y: 110, width: 220, height: 100, zIndex: 1, locked: false, containerId: 'ic-sensory',   cardType: 'note', content: 'Which senses are engaged? Map visual, audio, haptic, olfactory, and taste elements.' },
    { id: 'ic-p4', type: 'freeform', x: 70,   y: 430, width: 220, height: 100, zIndex: 1, locked: false, containerId: 'ic-spatial',   cardType: 'note', content: 'How is the physical or virtual space organized? Describe zones, flow paths, and transition points.' },
    { id: 'ic-p5', type: 'freeform', x: 700,  y: 430, width: 220, height: 100, zIndex: 1, locked: false, containerId: 'ic-narrative', cardType: 'note', content: 'What is the narrative structure? Map the beginning, rising tension, climax, and resolution.' },
  ] as CanvasElement[],
};

const eventBlueprint: TemplateDefinition = {
  id: 'event-blueprint',
  name: 'Event Blueprint',
  description: 'Plan live events from pre-production through post-experience',
  emoji: '🎪',
  category: 'experience',
  elements: [
    // Main phase containers
    { id: 'eb-pre',  type: 'container', x: 50,   y: 100, width: 550, height: 600, zIndex: 0, label: 'Pre-Production',  tintColor: 'ocean',   collapsed: false, locked: false, style: containerStyle },
    { id: 'eb-live', type: 'container', x: 630,  y: 100, width: 550, height: 600, zIndex: 0, label: 'Live Experience', tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    { id: 'eb-post', type: 'container', x: 1210, y: 100, width: 550, height: 600, zIndex: 0, label: 'Post-Experience', tintColor: 'sunset',  collapsed: false, locked: false, style: containerStyle },
    // Sub-containers
    { id: 'eb-tasks',   type: 'container', x: 70,   y: 180, width: 500, height: 220, zIndex: 1, label: 'Planning Tasks',    collapsed: false, locked: false, containerId: 'eb-pre',  style: containerStyle },
    { id: 'eb-moments', type: 'container', x: 650,  y: 180, width: 500, height: 220, zIndex: 1, label: 'Key Moments',       collapsed: false, locked: false, containerId: 'eb-live', style: containerStyle },
    { id: 'eb-follow',  type: 'container', x: 1230, y: 180, width: 500, height: 220, zIndex: 1, label: 'Follow-Up Actions', collapsed: false, locked: false, containerId: 'eb-post', style: containerStyle },
    // Prompt cards
    { id: 'eb-p1', type: 'freeform', x: 90,   y: 230, width: 200, height: 110, zIndex: 2, locked: false, containerId: 'eb-tasks',   cardType: 'note', content: 'What are the critical milestones? List venue, vendors, permits, and rehearsal dates.' },
    { id: 'eb-p2', type: 'freeform', x: 670,  y: 230, width: 200, height: 110, zIndex: 2, locked: false, containerId: 'eb-moments', cardType: 'note', content: 'What are the signature moments? Map the guest journey from arrival to finale.' },
    { id: 'eb-p3', type: 'freeform', x: 1250, y: 230, width: 200, height: 110, zIndex: 2, locked: false, containerId: 'eb-follow',  cardType: 'note', content: 'How will you gather feedback? Plan surveys, thank-yous, and content sharing.' },
    { id: 'eb-p4', type: 'freeform', x: 70,   y: 460, width: 240, height: 100, zIndex: 1, locked: false, containerId: 'eb-pre',  cardType: 'note', content: 'Budget and resource allocation: What is the cost breakdown across categories?' },
    { id: 'eb-p5', type: 'freeform', x: 650,  y: 460, width: 240, height: 100, zIndex: 1, locked: false, containerId: 'eb-live', cardType: 'note', content: 'Contingency plan: What happens if weather, tech, or attendance changes?' },
    { id: 'eb-p6', type: 'freeform', x: 1230, y: 460, width: 240, height: 100, zIndex: 1, locked: false, containerId: 'eb-post', cardType: 'note', content: 'Metrics: How will you measure success? Attendance, NPS, social reach, revenue?' },
  ] as CanvasElement[],
};

const serviceBlueprint: TemplateDefinition = {
  id: 'service-blueprint',
  name: 'Service Blueprint',
  description: 'Visualize frontstage and backstage service layers',
  emoji: '🏗️',
  category: 'experience',
  elements: [
    // Containers
    { id: 'sb-customer', type: 'container', x: 100, y: 150,  width: 1800, height: 200, zIndex: 0, label: 'Customer Actions',  collapsed: false, locked: false, style: containerStyle },
    { id: 'sb-front',    type: 'container', x: 100, y: 400,  width: 1800, height: 200, zIndex: 0, label: 'Frontstage',        collapsed: false, locked: false, style: containerStyle },
    { id: 'sb-back',     type: 'container', x: 100, y: 650,  width: 1800, height: 200, zIndex: 0, label: 'Backstage',         collapsed: false, locked: false, style: containerStyle },
    { id: 'sb-support',  type: 'container', x: 100, y: 900,  width: 1800, height: 200, zIndex: 0, label: 'Support Processes', collapsed: false, locked: false, style: containerStyle },
    // Prompt cards
    { id: 'sb-p1', type: 'freeform', x: 130, y: 210, width: 220, height: 100, zIndex: 1, locked: false, containerId: 'sb-customer', cardType: 'note', content: 'What actions does the customer take at each touchpoint? List them left-to-right chronologically.' },
    { id: 'sb-p2', type: 'freeform', x: 130, y: 460, width: 220, height: 100, zIndex: 1, locked: false, containerId: 'sb-front',   cardType: 'note', content: 'What does the customer see, hear, and interact with? These are the visible service elements.' },
    { id: 'sb-p3', type: 'freeform', x: 130, y: 710, width: 220, height: 100, zIndex: 1, locked: false, containerId: 'sb-back',    cardType: 'note', content: 'What internal processes support the frontstage? Map the invisible operations behind the scenes.' },
    { id: 'sb-p4', type: 'freeform', x: 130, y: 960, width: 220, height: 100, zIndex: 1, locked: false, containerId: 'sb-support', cardType: 'note', content: 'What systems, tools, and infrastructure keep everything running? Database, CRM, logistics, etc.' },
  ] as CanvasElement[],
};

// ─── Product & Brand ────────────────────────────────────────────────

const productCanvas: TemplateDefinition = {
  id: 'product-canvas',
  name: 'Product Canvas',
  description: 'Define your product from problem to metrics in a structured grid',
  emoji: '📦',
  category: 'product-brand',
  elements: [
    // Containers  (grid layout)
    { id: 'pc-problem',  type: 'container', x: 50,   y: 50,  width: 400, height: 280, zIndex: 0, label: 'Problem',           tintColor: 'rose',    collapsed: false, locked: false, style: containerStyle },
    { id: 'pc-solution', type: 'container', x: 480,  y: 50,  width: 400, height: 280, zIndex: 0, label: 'Solution',          tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    { id: 'pc-audience', type: 'container', x: 50,   y: 360, width: 300, height: 280, zIndex: 0, label: 'Audience',          tintColor: 'ocean',   collapsed: false, locked: false, style: containerStyle },
    { id: 'pc-value',    type: 'container', x: 380,  y: 360, width: 380, height: 280, zIndex: 0, label: 'Value Proposition', tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    { id: 'pc-channels', type: 'container', x: 790,  y: 360, width: 300, height: 280, zIndex: 0, label: 'Channels',          tintColor: 'sunset',  collapsed: false, locked: false, style: containerStyle },
    { id: 'pc-metrics',  type: 'container', x: 50,   y: 670, width: 1040, height: 220, zIndex: 0, label: 'Metrics',          tintColor: 'glacier', collapsed: false, locked: false, style: containerStyle },
    // Prompt cards
    { id: 'pc-p1', type: 'freeform', x: 70,  y: 110, width: 200, height: 100, zIndex: 1, locked: false, containerId: 'pc-problem',  cardType: 'note', content: 'What problem are you solving? Who feels this pain most acutely and how do they cope today?' },
    { id: 'pc-p2', type: 'freeform', x: 500, y: 110, width: 200, height: 100, zIndex: 1, locked: false, containerId: 'pc-solution', cardType: 'note', content: 'How does your product solve it? What is the core mechanism or innovation?' },
    { id: 'pc-p3', type: 'freeform', x: 70,  y: 420, width: 200, height: 100, zIndex: 1, locked: false, containerId: 'pc-audience', cardType: 'note', content: 'Describe your ideal customer. What are their demographics, behaviors, and goals?' },
    { id: 'pc-p4', type: 'freeform', x: 400, y: 420, width: 220, height: 100, zIndex: 1, locked: false, containerId: 'pc-value',    cardType: 'note', content: 'What unique value do you deliver? Complete: "We help [audience] to [outcome] by [method]."' },
    { id: 'pc-p5', type: 'freeform', x: 810, y: 420, width: 200, height: 100, zIndex: 1, locked: false, containerId: 'pc-channels', cardType: 'note', content: 'How do customers find and access the product? List acquisition, activation, and retention channels.' },
    { id: 'pc-p6', type: 'freeform', x: 70,  y: 720, width: 240, height: 100, zIndex: 1, locked: false, containerId: 'pc-metrics',  cardType: 'note', content: 'What numbers prove success? Define your North Star metric and 3-5 supporting KPIs.' },
  ] as CanvasElement[],
};

const brandMap: TemplateDefinition = {
  id: 'brand-map',
  name: 'Brand Experience Map',
  description: 'Align brand values with touchpoints and emotional journeys',
  emoji: '✨',
  category: 'product-brand',
  elements: [
    // Containers
    { id: 'bm-values',    type: 'container', x: 50,   y: 50,  width: 1200, height: 200, zIndex: 0, label: 'Brand Values',      tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    { id: 'bm-touch1',    type: 'container', x: 50,   y: 290, width: 380,  height: 280, zIndex: 0, label: 'Digital Touchpoints',tintColor: 'ocean',   collapsed: false, locked: false, style: containerStyle },
    { id: 'bm-touch2',    type: 'container', x: 460,  y: 290, width: 380,  height: 280, zIndex: 0, label: 'Physical Touchpoints',tintColor: 'emerald',collapsed: false, locked: false, style: containerStyle },
    { id: 'bm-touch3',    type: 'container', x: 870,  y: 290, width: 380,  height: 280, zIndex: 0, label: 'Human Touchpoints', tintColor: 'sunset',  collapsed: false, locked: false, style: containerStyle },
    { id: 'bm-emotional', type: 'container', x: 50,   y: 610, width: 600,  height: 280, zIndex: 0, label: 'Emotional Journey', tintColor: 'rose',    collapsed: false, locked: false, style: containerStyle },
    { id: 'bm-visual',    type: 'container', x: 680,  y: 610, width: 570,  height: 280, zIndex: 0, label: 'Visual Identity',   tintColor: 'glacier', collapsed: false, locked: false, style: containerStyle },
    // Prompt cards
    { id: 'bm-p1', type: 'freeform', x: 70,   y: 110, width: 240, height: 100, zIndex: 1, locked: false, containerId: 'bm-values',    cardType: 'note', content: 'What are your 3-5 core brand values? How do they translate into customer-facing behaviors?' },
    { id: 'bm-p2', type: 'freeform', x: 70,   y: 350, width: 200, height: 100, zIndex: 1, locked: false, containerId: 'bm-touch1',    cardType: 'note', content: 'Website, app, social media, email: How does the brand show up digitally?' },
    { id: 'bm-p3', type: 'freeform', x: 480,  y: 350, width: 200, height: 100, zIndex: 1, locked: false, containerId: 'bm-touch2',    cardType: 'note', content: 'Packaging, retail space, signage, events: What physical artifacts carry the brand?' },
    { id: 'bm-p4', type: 'freeform', x: 890,  y: 350, width: 200, height: 100, zIndex: 1, locked: false, containerId: 'bm-touch3',    cardType: 'note', content: 'Sales calls, support, onboarding: How do people represent the brand in conversation?' },
    { id: 'bm-p5', type: 'freeform', x: 70,   y: 670, width: 220, height: 100, zIndex: 1, locked: false, containerId: 'bm-emotional', cardType: 'note', content: 'Map the emotional arc: What should customers feel at first contact, during use, and long-term?' },
    { id: 'bm-p6', type: 'freeform', x: 700,  y: 670, width: 220, height: 100, zIndex: 1, locked: false, containerId: 'bm-visual',    cardType: 'note', content: 'Colors, typography, imagery, logo usage: What are the visual rules and how are they applied?' },
  ] as CanvasElement[],
};

// ─── Creative & General ─────────────────────────────────────────────

const moodBoard: TemplateDefinition = {
  id: 'mood-board',
  name: 'Mood Board',
  description: 'Collect visual inspiration, colors, typography, and references',
  emoji: '🎨',
  category: 'creative',
  elements: [
    // Containers
    { id: 'mb-visual', type: 'container', x: 50,   y: 50,  width: 1100, height: 350, zIndex: 0, label: 'Visual Inspiration', tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    { id: 'mb-color',  type: 'container', x: 50,   y: 430, width: 350,  height: 280, zIndex: 0, label: 'Color Palette',      tintColor: 'sunset',  collapsed: false, locked: false, style: containerStyle },
    { id: 'mb-type',   type: 'container', x: 430,  y: 430, width: 350,  height: 280, zIndex: 0, label: 'Typography',         tintColor: 'ocean',   collapsed: false, locked: false, style: containerStyle },
    { id: 'mb-refs',   type: 'container', x: 810,  y: 430, width: 340,  height: 280, zIndex: 0, label: 'References',         tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    { id: 'mb-notes',  type: 'container', x: 50,   y: 740, width: 1100, height: 200, zIndex: 0, label: 'Notes',              tintColor: 'glacier', collapsed: false, locked: false, style: containerStyle },
    // Prompt cards
    { id: 'mb-p1', type: 'freeform', x: 70,  y: 110, width: 220, height: 100, zIndex: 1, locked: false, containerId: 'mb-visual', cardType: 'note', content: 'Drag images here that capture the mood, texture, and aesthetic you are aiming for.' },
    { id: 'mb-p2', type: 'freeform', x: 70,  y: 490, width: 200, height: 100, zIndex: 1, locked: false, containerId: 'mb-color',  cardType: 'note', content: 'Add swatches or describe your color palette. Consider primary, secondary, and accent colors.' },
    { id: 'mb-p3', type: 'freeform', x: 450, y: 490, width: 200, height: 100, zIndex: 1, locked: false, containerId: 'mb-type',   cardType: 'note', content: 'What typefaces define the voice? Pair a heading and body font. Note weights and sizes.' },
    { id: 'mb-p4', type: 'freeform', x: 830, y: 490, width: 200, height: 100, zIndex: 1, locked: false, containerId: 'mb-refs',   cardType: 'note', content: 'Links, articles, competitor examples, and other reference material.' },
    { id: 'mb-p5', type: 'freeform', x: 70,  y: 790, width: 240, height: 100, zIndex: 1, locked: false, containerId: 'mb-notes',  cardType: 'note', content: 'Capture decisions, open questions, and direction notes here.' },
  ] as CanvasElement[],
};

const workshopCanvas: TemplateDefinition = {
  id: 'workshop',
  name: 'Workshop Canvas',
  description: 'Structure a collaborative workshop with activities and outputs',
  emoji: '🛠️',
  category: 'creative',
  elements: [
    // Containers
    { id: 'ws-objective',    type: 'container', x: 100,  y: 150, width: 550, height: 300, zIndex: 0, label: 'Objective',            tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    { id: 'ws-participants', type: 'container', x: 700,  y: 150, width: 550, height: 300, zIndex: 0, label: 'Participants',         tintColor: 'ocean',   collapsed: false, locked: false, style: containerStyle },
    { id: 'ws-activity1',    type: 'container', x: 100,  y: 500, width: 550, height: 350, zIndex: 0, label: 'Activity 1',           tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    { id: 'ws-activity2',    type: 'container', x: 700,  y: 500, width: 550, height: 350, zIndex: 0, label: 'Activity 2',           tintColor: 'sunset',  collapsed: false, locked: false, style: containerStyle },
    { id: 'ws-activity3',    type: 'container', x: 1300, y: 500, width: 550, height: 350, zIndex: 0, label: 'Activity 3',           tintColor: 'rose',    collapsed: false, locked: false, style: containerStyle },
    { id: 'ws-outcomes',     type: 'container', x: 1300, y: 150, width: 550, height: 300, zIndex: 0, label: 'Outcomes & Next Steps',tintColor: 'glacier', collapsed: false, locked: false, style: containerStyle },
    // Facilitator prompt cards
    { id: 'ws-p1', type: 'freeform', x: 120,  y: 210, width: 220, height: 100, zIndex: 1, locked: false, containerId: 'ws-objective',    cardType: 'note', content: 'What is the single most important outcome of this workshop? Frame it as a clear goal statement.' },
    { id: 'ws-p2', type: 'freeform', x: 720,  y: 210, width: 220, height: 100, zIndex: 1, locked: false, containerId: 'ws-participants', cardType: 'note', content: 'Who needs to be in the room? List roles, expertise, and what each person brings.' },
    { id: 'ws-p3', type: 'freeform', x: 120,  y: 560, width: 220, height: 100, zIndex: 1, locked: false, containerId: 'ws-activity1',    cardType: 'note', content: 'Warm-up or icebreaker: What exercise builds trust and gets people engaged? (10-15 min)' },
    { id: 'ws-p4', type: 'freeform', x: 720,  y: 560, width: 220, height: 100, zIndex: 1, locked: false, containerId: 'ws-activity2',    cardType: 'note', content: 'Core exercise: What is the main collaborative activity? Define the process and time box.' },
    { id: 'ws-p5', type: 'freeform', x: 1320, y: 560, width: 220, height: 100, zIndex: 1, locked: false, containerId: 'ws-activity3',    cardType: 'note', content: 'Synthesis: How do you converge ideas? Dot voting, affinity mapping, or prioritization matrix?' },
    { id: 'ws-p6', type: 'freeform', x: 1320, y: 210, width: 220, height: 100, zIndex: 1, locked: false, containerId: 'ws-outcomes',     cardType: 'note', content: 'What are the tangible deliverables? Who owns each action item and by when?' },
    // Example content in Activity 1
    { id: 'ws-ex1', type: 'freeform', x: 120, y: 700, width: 220, height: 100, zIndex: 1, locked: false, containerId: 'ws-activity1', cardType: 'note', content: 'Example: "Two Truths and a Lie" — each participant shares 3 statements. The group guesses the lie. Builds rapport in 10 minutes.' },
  ] as CanvasElement[],
};

const brainstormBoard: TemplateDefinition = {
  id: 'brainstorm',
  name: 'Brainstorm Board',
  description: 'Diverge, converge, and prioritize ideas into action items',
  emoji: '💡',
  category: 'creative',
  elements: [
    // Containers
    { id: 'bs-diverge',  type: 'container', x: 50,   y: 50,  width: 800,  height: 500, zIndex: 0, label: 'Diverge — Generate Ideas',      tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    { id: 'bs-converge', type: 'container', x: 880,  y: 50,  width: 400,  height: 500, zIndex: 0, label: 'Converge — Prioritize',          tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    { id: 'bs-actions',  type: 'container', x: 50,   y: 580, width: 1230, height: 250, zIndex: 0, label: 'Action Items',                   tintColor: 'sunset',  collapsed: false, locked: false, style: containerStyle },
    // Prompt cards
    { id: 'bs-p1', type: 'freeform', x: 70,  y: 110, width: 220, height: 120, zIndex: 1, locked: false, containerId: 'bs-diverge',  cardType: 'note', content: 'No bad ideas! Generate as many ideas as possible. Use one card per idea. Aim for quantity over quality.' },
    { id: 'bs-p2', type: 'freeform', x: 320, y: 110, width: 220, height: 120, zIndex: 1, locked: false, containerId: 'bs-diverge',  cardType: 'note', content: 'Prompt: "How might we..." — reframe the challenge as an open question to spark creative solutions.' },
    { id: 'bs-p3', type: 'freeform', x: 900, y: 110, width: 220, height: 120, zIndex: 1, locked: false, containerId: 'bs-converge', cardType: 'note', content: 'Group similar ideas. Vote on the top 3. Use an Impact vs. Effort matrix to prioritize.' },
    { id: 'bs-p4', type: 'freeform', x: 900, y: 280, width: 220, height: 120, zIndex: 1, locked: false, containerId: 'bs-converge', cardType: 'note', content: 'High Impact / Low Effort = Quick Wins. High Impact / High Effort = Big Bets. Decide which to pursue.' },
    { id: 'bs-p5', type: 'freeform', x: 70,  y: 640, width: 240, height: 120, zIndex: 1, locked: false, containerId: 'bs-actions',  cardType: 'note', content: 'For each chosen idea: Who owns it? What is the first step? When is the deadline?' },
  ] as CanvasElement[],
};

// ─── Export all templates ───────────────────────────────────────────

export const TEMPLATES: TemplateDefinition[] = [
  // Experience Design
  experienceJourney,
  immersiveCanvas,
  eventBlueprint,
  serviceBlueprint,
  // Product & Brand
  productCanvas,
  brandMap,
  // Creative & General
  moodBoard,
  workshopCanvas,
  brainstormBoard,
];
