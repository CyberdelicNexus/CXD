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
 * Re-map element IDs to fresh UUIDs while preserving containerId and childBoardId references.
 * Call this before adding template elements to a project.
 */
export function remapTemplateIds(elements: CanvasElement[]): CanvasElement[] {
  const idMap = new Map<string, string>();
  // First pass: assign new IDs
  for (const el of elements) {
    idMap.set(el.id, crypto.randomUUID());
    // Also map childBoardId for board elements
    if (el.type === 'board' && 'childBoardId' in el) {
      idMap.set((el as any).childBoardId, crypto.randomUUID());
    }
  }
  // Second pass: apply new IDs and remap containerId + childBoardId
  return elements.map((el) => {
    const remapped: any = {
      ...el,
      id: idMap.get(el.id)!,
    };
    if ('containerId' in el && el.containerId) {
      remapped.containerId = idMap.get(el.containerId) ?? el.containerId;
    }
    if (el.type === 'board' && 'childBoardId' in el) {
      remapped.childBoardId = idMap.get((el as any).childBoardId) ?? (el as any).childBoardId;
    }
    return remapped;
  });
}

// ─── Experience Design ──────────────────────────────────────────────

// 1. Experience Journey — 20 elements
const experienceJourney: TemplateDefinition = {
  id: 'experience-journey',
  name: 'Experience Journey',
  description: 'Map the end-to-end experience across five lifecycle stages',
  emoji: '🗺️',
  category: 'experience',
  elements: [
    // 5 containers
    { id: 'ej-c1', type: 'container', x: 50,   y: 100, width: 340, height: 420, zIndex: 0, label: 'Awareness',     tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    { id: 'ej-c2', type: 'container', x: 430,  y: 100, width: 340, height: 420, zIndex: 0, label: 'Consideration', tintColor: 'ocean',   collapsed: false, locked: false, style: containerStyle },
    { id: 'ej-c3', type: 'container', x: 810,  y: 100, width: 340, height: 420, zIndex: 0, label: 'Engagement',    tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    { id: 'ej-c4', type: 'container', x: 1190, y: 100, width: 340, height: 420, zIndex: 0, label: 'Experience',    tintColor: 'sunset',  collapsed: false, locked: false, style: containerStyle },
    { id: 'ej-c5', type: 'container', x: 1570, y: 100, width: 340, height: 420, zIndex: 0, label: 'Reflection',    tintColor: 'rose',    collapsed: false, locked: false, style: containerStyle },
    // 5 freeform notes (one per container)
    { id: 'ej-n1', type: 'freeform', x: 90,   y: 160, width: 260, height: 140, zIndex: 1, locked: false, containerId: 'ej-c1', content: 'How does the audience first discover this experience? What channels or triggers create awareness?', cardType: 'note' },
    { id: 'ej-n2', type: 'freeform', x: 470,  y: 160, width: 260, height: 140, zIndex: 1, locked: false, containerId: 'ej-c2', content: 'What motivates someone to commit? What barriers or hesitations exist at this stage?', cardType: 'note' },
    { id: 'ej-n3', type: 'freeform', x: 850,  y: 160, width: 260, height: 140, zIndex: 1, locked: false, containerId: 'ej-c3', content: 'What is the core interaction? Describe the peak moment of participation.', cardType: 'note' },
    { id: 'ej-n4', type: 'freeform', x: 1230, y: 160, width: 260, height: 140, zIndex: 1, locked: false, containerId: 'ej-c4', content: 'What sensory and emotional elements define the lived experience?', cardType: 'note' },
    { id: 'ej-n5', type: 'freeform', x: 1610, y: 160, width: 260, height: 140, zIndex: 1, locked: false, containerId: 'ej-c5', content: 'How do participants reflect on and share the experience afterward?', cardType: 'note' },
    // 3 circle shapes (emotion markers between containers)
    { id: 'ej-s1', type: 'shape', x: 385,  y: 290, width: 50, height: 50, zIndex: 1, locked: false, shapeType: 'circle', content: '😊', style: { bgColor: 'rgba(139,92,246,0.3)', textColor: '#c084fc' } },
    { id: 'ej-s2', type: 'shape', x: 765,  y: 290, width: 50, height: 50, zIndex: 1, locked: false, shapeType: 'circle', content: '🔥', style: { bgColor: 'rgba(34,211,238,0.3)', textColor: '#22d3ee' } },
    { id: 'ej-s3', type: 'shape', x: 1145, y: 290, width: 50, height: 50, zIndex: 1, locked: false, shapeType: 'circle', content: '✨', style: { bgColor: 'rgba(251,146,60,0.3)', textColor: '#fb923c' } },
    // 4 arrow lines connecting containers left-to-right
    { id: 'ej-l1', type: 'line', x: 0, y: 0, width: 0, height: 0, zIndex: 1, locked: false, start: { x: 390, y: 310 }, end: { x: 430, y: 310 }, style: { kind: 'solid', widthPx: 2, color: 'rgba(139,92,246,0.4)', endCap: 'arrow' } },
    { id: 'ej-l2', type: 'line', x: 0, y: 0, width: 0, height: 0, zIndex: 1, locked: false, start: { x: 770, y: 310 }, end: { x: 810, y: 310 }, style: { kind: 'solid', widthPx: 2, color: 'rgba(34,211,238,0.4)', endCap: 'arrow' } },
    { id: 'ej-l3', type: 'line', x: 0, y: 0, width: 0, height: 0, zIndex: 1, locked: false, start: { x: 1150, y: 310 }, end: { x: 1190, y: 310 }, style: { kind: 'solid', widthPx: 2, color: 'rgba(251,146,60,0.4)', endCap: 'arrow' } },
    { id: 'ej-l4', type: 'line', x: 0, y: 0, width: 0, height: 0, zIndex: 1, locked: false, start: { x: 1530, y: 310 }, end: { x: 1570, y: 310 }, style: { kind: 'solid', widthPx: 2, color: 'rgba(244,114,182,0.4)', endCap: 'arrow' } },
    // 2 image placeholders (Engagement + Experience)
    { id: 'ej-i1', type: 'image', x: 850,  y: 340, width: 260, height: 150, zIndex: 1, locked: false, containerId: 'ej-c3', src: '', alt: 'Peak moment reference' },
    { id: 'ej-i2', type: 'image', x: 1230, y: 340, width: 260, height: 150, zIndex: 1, locked: false, containerId: 'ej-c4', src: '', alt: 'Experience mood image' },
    // 1 text label
    { id: 'ej-t1', type: 'text', x: 50, y: 60, width: 250, height: 30, zIndex: 1, locked: false, content: 'Journey Stages →', style: labelStyle, textAlign: 'left' },
  ] as CanvasElement[],
};

// 2. Immersive Experience Canvas — 20 elements
const immersiveCanvas: TemplateDefinition = {
  id: 'immersive-canvas',
  name: 'Immersive Experience Canvas',
  description: 'Design multi-sensory immersive environments and narratives',
  emoji: '🌀',
  category: 'experience',
  elements: [
    // 5 containers: Concept (center, larger), Audience (top-left), Sensory (top-right), Spatial (bottom-left), Narrative (bottom-right)
    { id: 'ic-c1', type: 'container', x: 380, y: 180, width: 480, height: 340, zIndex: 0, label: 'Concept & Theme',  tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    { id: 'ic-c2', type: 'container', x: 50,  y: 50,  width: 300, height: 280, zIndex: 0, label: 'Audience',         tintColor: 'ocean',   collapsed: false, locked: false, style: containerStyle },
    { id: 'ic-c3', type: 'container', x: 890, y: 50,  width: 400, height: 280, zIndex: 0, label: 'Sensory Domains',  tintColor: 'rose',    collapsed: false, locked: false, style: containerStyle },
    { id: 'ic-c4', type: 'container', x: 50,  y: 380, width: 300, height: 280, zIndex: 0, label: 'Spatial Layout',   tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    { id: 'ic-c5', type: 'container', x: 890, y: 380, width: 400, height: 280, zIndex: 0, label: 'Narrative Arc',    tintColor: 'glacier', collapsed: false, locked: false, style: containerStyle },
    // 1 diamond shape inside Concept (central focal point)
    { id: 'ic-s1', type: 'shape', x: 580, y: 260, width: 80, height: 80, zIndex: 1, locked: false, containerId: 'ic-c1', shapeType: 'diamond', content: '💎', style: { bgColor: 'rgba(139,92,246,0.35)', textColor: '#c084fc' } },
    // 5 hexagon shapes inside Sensory Domains (arranged in a row)
    { id: 'ic-s2', type: 'shape', x: 910,  y: 120, width: 55, height: 55, zIndex: 1, locked: false, containerId: 'ic-c3', shapeType: 'hexagon', content: '👁️', style: { bgColor: 'rgba(139,92,246,0.25)', textColor: '#c084fc' } },
    { id: 'ic-s3', type: 'shape', x: 975,  y: 120, width: 55, height: 55, zIndex: 1, locked: false, containerId: 'ic-c3', shapeType: 'hexagon', content: '👂', style: { bgColor: 'rgba(34,211,238,0.25)', textColor: '#22d3ee' } },
    { id: 'ic-s4', type: 'shape', x: 1040, y: 120, width: 55, height: 55, zIndex: 1, locked: false, containerId: 'ic-c3', shapeType: 'hexagon', content: '✋', style: { bgColor: 'rgba(52,211,153,0.25)', textColor: '#34d399' } },
    { id: 'ic-s5', type: 'shape', x: 1105, y: 120, width: 55, height: 55, zIndex: 1, locked: false, containerId: 'ic-c3', shapeType: 'hexagon', content: '👃', style: { bgColor: 'rgba(251,146,60,0.25)', textColor: '#fb923c' } },
    { id: 'ic-s6', type: 'shape', x: 1170, y: 120, width: 55, height: 55, zIndex: 1, locked: false, containerId: 'ic-c3', shapeType: 'hexagon', content: '👅', style: { bgColor: 'rgba(244,114,182,0.25)', textColor: '#f472b6' } },
    // 3 freeform notes (Audience, Concept, Narrative Arc)
    { id: 'ic-n1', type: 'freeform', x: 70,  y: 110, width: 260, height: 140, zIndex: 1, locked: false, containerId: 'ic-c2', content: 'Who is the intended audience? What prior knowledge or expectations do they bring?', cardType: 'note' },
    { id: 'ic-n2', type: 'freeform', x: 400, y: 360, width: 260, height: 140, zIndex: 1, locked: false, containerId: 'ic-c1', content: 'What is the central concept? What world are you creating and why does it matter?', cardType: 'note' },
    { id: 'ic-n3', type: 'freeform', x: 910, y: 440, width: 260, height: 140, zIndex: 1, locked: false, containerId: 'ic-c5', content: 'Map the narrative arc: beginning, rising tension, climax, and resolution.', cardType: 'note' },
    // 1 board "Personas" inside Audience
    { id: 'ic-b1', type: 'board', x: 70, y: 260, width: 160, height: 50, zIndex: 1, locked: false, containerId: 'ic-c2', childBoardId: 'ic-board-personas', title: 'Personas' },
    // 1 image placeholder inside Spatial Layout
    { id: 'ic-i1', type: 'image', x: 70, y: 440, width: 260, height: 150, zIndex: 1, locked: false, containerId: 'ic-c4', src: '', alt: 'Spatial layout diagram' },
    // 1 text label
    { id: 'ic-t1', type: 'text', x: 420, y: 200, width: 200, height: 30, zIndex: 1, locked: false, containerId: 'ic-c1', content: 'Core Experience', style: labelStyle, textAlign: 'left' },
    // 4 arrow lines radiating from center to outer containers
    { id: 'ic-l1', type: 'line', x: 0, y: 0, width: 0, height: 0, zIndex: 1, locked: false, start: { x: 450, y: 300 }, end: { x: 350, y: 200 }, style: { kind: 'solid', widthPx: 2, color: 'rgba(139,92,246,0.4)', endCap: 'arrow' } },
    { id: 'ic-l2', type: 'line', x: 0, y: 0, width: 0, height: 0, zIndex: 1, locked: false, start: { x: 790, y: 300 }, end: { x: 890, y: 200 }, style: { kind: 'solid', widthPx: 2, color: 'rgba(244,114,182,0.4)', endCap: 'arrow' } },
    { id: 'ic-l3', type: 'line', x: 0, y: 0, width: 0, height: 0, zIndex: 1, locked: false, start: { x: 450, y: 450 }, end: { x: 350, y: 500 }, style: { kind: 'solid', widthPx: 2, color: 'rgba(52,211,153,0.4)', endCap: 'arrow' } },
    { id: 'ic-l4', type: 'line', x: 0, y: 0, width: 0, height: 0, zIndex: 1, locked: false, start: { x: 790, y: 450 }, end: { x: 890, y: 500 }, style: { kind: 'solid', widthPx: 2, color: 'rgba(34,211,238,0.4)', endCap: 'arrow' } },
  ] as CanvasElement[],
};

// 3. Event Blueprint — 14 elements
const eventBlueprint: TemplateDefinition = {
  id: 'event-blueprint',
  name: 'Event Blueprint',
  description: 'Plan live events from pre-production through post-experience',
  emoji: '🎪',
  category: 'experience',
  elements: [
    // 3 containers
    { id: 'eb-c1', type: 'container', x: 50,  y: 100, width: 500, height: 450, zIndex: 0, label: 'Pre-Production',  tintColor: 'ocean',   collapsed: false, locked: false, style: containerStyle },
    { id: 'eb-c2', type: 'container', x: 590, y: 100, width: 500, height: 450, zIndex: 0, label: 'Live Experience', tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    { id: 'eb-c3', type: 'container', x: 1130, y: 100, width: 500, height: 450, zIndex: 0, label: 'Post-Experience', tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    // 2 freeform tasks inside Pre-Production
    { id: 'eb-ft1', type: 'freeform', x: 70,  y: 160, width: 260, height: 80, zIndex: 1, locked: false, containerId: 'eb-c1', content: 'Venue scouting & logistics planning', cardType: 'task' },
    { id: 'eb-ft2', type: 'freeform', x: 70,  y: 260, width: 260, height: 80, zIndex: 1, locked: false, containerId: 'eb-c1', content: 'Technical setup & equipment checklist', cardType: 'task' },
    // 2 freeform notes (Live + Post)
    { id: 'eb-n1', type: 'freeform', x: 610, y: 160, width: 260, height: 140, zIndex: 1, locked: false, containerId: 'eb-c2', content: 'What is the peak moment? Map the guest journey from arrival to finale.', cardType: 'note' },
    { id: 'eb-n2', type: 'freeform', x: 1150, y: 160, width: 260, height: 140, zIndex: 1, locked: false, containerId: 'eb-c3', content: 'How will you gather feedback and measure success? Plan surveys and thank-yous.', cardType: 'note' },
    // 2 arrow lines connecting the 3 phases
    { id: 'eb-l1', type: 'line', x: 0, y: 0, width: 0, height: 0, zIndex: 1, locked: false, start: { x: 550, y: 325 }, end: { x: 590, y: 325 }, style: { kind: 'solid', widthPx: 2, color: 'rgba(34,211,238,0.4)', endCap: 'arrow' } },
    { id: 'eb-l2', type: 'line', x: 0, y: 0, width: 0, height: 0, zIndex: 1, locked: false, start: { x: 1090, y: 325 }, end: { x: 1130, y: 325 }, style: { kind: 'solid', widthPx: 2, color: 'rgba(52,211,153,0.4)', endCap: 'arrow' } },
    // 1 board "Vendor Contacts" inside Pre-Production
    { id: 'eb-b1', type: 'board', x: 70, y: 380, width: 160, height: 100, zIndex: 1, locked: false, containerId: 'eb-c1', childBoardId: 'eb-board-vendors', title: 'Vendor Contacts' },
    // 1 image placeholder inside Live Experience
    { id: 'eb-i1', type: 'image', x: 610, y: 340, width: 260, height: 150, zIndex: 1, locked: false, containerId: 'eb-c2', src: '', alt: 'Mood reference image' },
    // 1 freeform task inside Post-Experience
    { id: 'eb-ft3', type: 'freeform', x: 1150, y: 340, width: 260, height: 80, zIndex: 1, locked: false, containerId: 'eb-c3', content: 'Collect attendee feedback & compile metrics', cardType: 'task' },
    // 1 text label
    { id: 'eb-t1', type: 'text', x: 50, y: 60, width: 250, height: 30, zIndex: 1, locked: false, content: 'Event Timeline →', style: labelStyle, textAlign: 'left' },
  ] as CanvasElement[],
};

// ─── Product & Brand ────────────────────────────────────────────────

// 4. Product Canvas — 20 elements
const productCanvas: TemplateDefinition = {
  id: 'product-canvas',
  name: 'Product Canvas',
  description: 'Define your product from problem to metrics in a structured grid',
  emoji: '📦',
  category: 'product-brand',
  elements: [
    // 6 containers
    { id: 'pc-c1', type: 'container', x: 50,  y: 50,  width: 400, height: 280, zIndex: 0, label: 'Problem',           tintColor: 'ocean',   collapsed: false, locked: false, style: containerStyle },
    { id: 'pc-c2', type: 'container', x: 480, y: 50,  width: 400, height: 280, zIndex: 0, label: 'Solution',          tintColor: 'sunset',  collapsed: false, locked: false, style: containerStyle },
    { id: 'pc-c3', type: 'container', x: 50,  y: 360, width: 280, height: 280, zIndex: 0, label: 'Audience',          tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    { id: 'pc-c4', type: 'container', x: 360, y: 360, width: 340, height: 280, zIndex: 0, label: 'Value Proposition', tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    { id: 'pc-c5', type: 'container', x: 730, y: 360, width: 280, height: 280, zIndex: 0, label: 'Channels',          tintColor: 'rose',    collapsed: false, locked: false, style: containerStyle },
    { id: 'pc-c6', type: 'container', x: 50,  y: 670, width: 960, height: 200, zIndex: 0, label: 'Key Metrics',       tintColor: 'glacier', collapsed: false, locked: false, style: containerStyle },
    // 1 diamond shape inside Value Proposition
    { id: 'pc-s1', type: 'shape', x: 490, y: 430, width: 70, height: 70, zIndex: 1, locked: false, containerId: 'pc-c4', shapeType: 'diamond', content: '💎', style: { bgColor: 'rgba(139,92,246,0.35)', textColor: '#c084fc' } },
    // 4 freeform notes (Problem, Solution, Channels, Metrics)
    { id: 'pc-n1', type: 'freeform', x: 70,  y: 110, width: 260, height: 140, zIndex: 1, locked: false, containerId: 'pc-c1', content: 'What problem are you solving? Who feels this pain most acutely?', cardType: 'note' },
    { id: 'pc-n2', type: 'freeform', x: 500, y: 110, width: 260, height: 140, zIndex: 1, locked: false, containerId: 'pc-c2', content: 'How does your product solve it? What is the core mechanism?', cardType: 'note' },
    { id: 'pc-n3', type: 'freeform', x: 750, y: 420, width: 240, height: 140, zIndex: 1, locked: false, containerId: 'pc-c5', content: 'How do customers find and access the product?', cardType: 'note' },
    { id: 'pc-n4', type: 'freeform', x: 380, y: 520, width: 260, height: 80, zIndex: 1, locked: false, containerId: 'pc-c4', content: '"We help [audience] to [outcome] by [method]."', cardType: 'note' },
    // 1 board "User Research" inside Audience
    { id: 'pc-b1', type: 'board', x: 70, y: 560, width: 160, height: 50, zIndex: 1, locked: false, containerId: 'pc-c3', childBoardId: 'pc-board-research', title: 'User Research' },
    // 1 image placeholder inside Solution
    { id: 'pc-i1', type: 'image', x: 790, y: 110, width: 70, height: 140, zIndex: 1, locked: false, containerId: 'pc-c2', src: '', alt: 'Solution screenshot' },
    // 1 freeform task (KPI tracking) inside Metrics
    { id: 'pc-ft1', type: 'freeform', x: 70, y: 720, width: 260, height: 80, zIndex: 1, locked: false, containerId: 'pc-c6', content: 'Define North Star metric and 3-5 supporting KPIs', cardType: 'task' },
    // 1 freeform note inside Audience
    { id: 'pc-n5', type: 'freeform', x: 70, y: 420, width: 240, height: 120, zIndex: 1, locked: false, containerId: 'pc-c3', content: 'Describe your ideal customer persona and early adopters.', cardType: 'note' },
    // Additional elements to reach 20
    // Line from Problem to Value Prop
    { id: 'pc-l1', type: 'line', x: 0, y: 0, width: 0, height: 0, zIndex: 1, locked: false, start: { x: 250, y: 330 }, end: { x: 430, y: 400 }, style: { kind: 'solid', widthPx: 2, color: 'rgba(139,92,246,0.4)', endCap: 'arrow' } },
    // Line from Solution to Value Prop
    { id: 'pc-l2', type: 'line', x: 0, y: 0, width: 0, height: 0, zIndex: 1, locked: false, start: { x: 680, y: 330 }, end: { x: 630, y: 400 }, style: { kind: 'solid', widthPx: 2, color: 'rgba(251,146,60,0.4)', endCap: 'arrow' } },
    // Line from Value Prop to Metrics
    { id: 'pc-l3', type: 'line', x: 0, y: 0, width: 0, height: 0, zIndex: 1, locked: false, start: { x: 530, y: 640 }, end: { x: 530, y: 670 }, style: { kind: 'solid', widthPx: 2, color: 'rgba(139,92,246,0.4)', endCap: 'arrow' } },
    // 1 text label
    { id: 'pc-t1', type: 'text', x: 380, y: 380, width: 200, height: 30, zIndex: 1, locked: false, containerId: 'pc-c4', content: 'Value-Driven Design', style: labelStyle, textAlign: 'left' },
  ] as CanvasElement[],
};

// 5. Brand Assets — 13 elements
const brandAssets: TemplateDefinition = {
  id: 'brand-assets',
  name: 'Brand Assets',
  description: 'Organize primary colors, logo, typography, and photographic style',
  emoji: '✨',
  category: 'product-brand',
  elements: [
    // 4 containers
    { id: 'ba-c1', type: 'container', x: 50,  y: 50,  width: 480, height: 340, zIndex: 0, label: 'Colors',          tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    { id: 'ba-c2', type: 'container', x: 560, y: 50,  width: 480, height: 340, zIndex: 0, label: 'Logo',            tintColor: 'ocean',   collapsed: false, locked: false, style: containerStyle },
    { id: 'ba-c3', type: 'container', x: 50,  y: 420, width: 480, height: 340, zIndex: 0, label: 'Typography',      tintColor: 'glacier', collapsed: false, locked: false, style: containerStyle },
    { id: 'ba-c4', type: 'container', x: 560, y: 420, width: 480, height: 340, zIndex: 0, label: 'Photo Style',     tintColor: 'rose',    collapsed: false, locked: false, style: containerStyle },
    // 3 circle shapes inside Colors (color swatches)
    { id: 'ba-s1', type: 'shape', x: 80,  y: 140, width: 60, height: 60, zIndex: 1, locked: false, containerId: 'ba-c1', shapeType: 'circle', content: '', style: { bgColor: 'rgba(139,92,246,0.6)', textColor: '#c084fc' } },
    { id: 'ba-s2', type: 'shape', x: 160, y: 140, width: 60, height: 60, zIndex: 1, locked: false, containerId: 'ba-c1', shapeType: 'circle', content: '', style: { bgColor: 'rgba(34,211,238,0.6)', textColor: '#22d3ee' } },
    { id: 'ba-s3', type: 'shape', x: 240, y: 140, width: 60, height: 60, zIndex: 1, locked: false, containerId: 'ba-c1', shapeType: 'circle', content: '', style: { bgColor: 'rgba(244,114,182,0.6)', textColor: '#f472b6' } },
    // 3 image placeholders (1 in Logo, 2 in Photo Style)
    { id: 'ba-i1', type: 'image', x: 580, y: 120, width: 440, height: 240, zIndex: 1, locked: false, containerId: 'ba-c2', src: '', alt: 'Upload logo' },
    { id: 'ba-i2', type: 'image', x: 580, y: 490, width: 210, height: 150, zIndex: 1, locked: false, containerId: 'ba-c4', src: '', alt: 'Photo style example 1' },
    { id: 'ba-i3', type: 'image', x: 810, y: 490, width: 210, height: 150, zIndex: 1, locked: false, containerId: 'ba-c4', src: '', alt: 'Photo style example 2' },
    // 1 freeform note inside Typography
    { id: 'ba-n1', type: 'freeform', x: 70, y: 490, width: 260, height: 140, zIndex: 1, locked: false, containerId: 'ba-c3', content: 'Define heading and body typefaces. Note weights, sizes, and line-height guidelines.', cardType: 'note' },
    // 1 board "Font Samples" inside Typography
    { id: 'ba-b1', type: 'board', x: 70, y: 670, width: 160, height: 60, zIndex: 1, locked: false, containerId: 'ba-c3', childBoardId: 'ba-board-fonts', title: 'Font Samples' },
    // 1 text label
    { id: 'ba-t1', type: 'text', x: 50, y: 10, width: 200, height: 30, zIndex: 1, locked: false, content: 'Brand Identity', style: labelStyle, textAlign: 'left' },
  ] as CanvasElement[],
};

// ─── Creative & General ─────────────────────────────────────────────

// 6. Mood Board — 17 elements
const moodBoard: TemplateDefinition = {
  id: 'mood-board',
  name: 'Mood Board',
  description: 'Collect visual inspiration, colors, and references',
  emoji: '🎨',
  category: 'creative',
  elements: [
    // 4 containers
    { id: 'mb-c1', type: 'container', x: 50,  y: 50,  width: 1000, height: 320, zIndex: 0, label: 'Visual Inspiration', tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    { id: 'mb-c2', type: 'container', x: 50,  y: 400, width: 480,  height: 280, zIndex: 0, label: 'Color Palette',      tintColor: 'sunset',  collapsed: false, locked: false, style: containerStyle },
    { id: 'mb-c3', type: 'container', x: 560, y: 400, width: 490,  height: 280, zIndex: 0, label: 'References',         tintColor: 'glacier', collapsed: false, locked: false, style: containerStyle },
    { id: 'mb-c4', type: 'container', x: 50,  y: 710, width: 1000, height: 200, zIndex: 0, label: 'Notes & Keywords',   tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    // 4 image placeholders inside Visual Inspiration (2x2 grid)
    { id: 'mb-i1', type: 'image', x: 70,  y: 110, width: 230, height: 150, zIndex: 1, locked: false, containerId: 'mb-c1', src: '', alt: 'Inspiration image 1' },
    { id: 'mb-i2', type: 'image', x: 320, y: 110, width: 230, height: 150, zIndex: 1, locked: false, containerId: 'mb-c1', src: '', alt: 'Inspiration image 2' },
    { id: 'mb-i3', type: 'image', x: 570, y: 110, width: 230, height: 150, zIndex: 1, locked: false, containerId: 'mb-c1', src: '', alt: 'Inspiration image 3' },
    { id: 'mb-i4', type: 'image', x: 800, y: 110, width: 230, height: 150, zIndex: 1, locked: false, containerId: 'mb-c1', src: '', alt: 'Inspiration image 4' },
    // 5 circle shapes inside Color Palette (color swatches)
    { id: 'mb-s1', type: 'shape', x: 80,  y: 470, width: 55, height: 55, zIndex: 1, locked: false, containerId: 'mb-c2', shapeType: 'circle', content: '', style: { bgColor: 'rgba(139,92,246,0.6)', textColor: '#c084fc' } },
    { id: 'mb-s2', type: 'shape', x: 155, y: 470, width: 55, height: 55, zIndex: 1, locked: false, containerId: 'mb-c2', shapeType: 'circle', content: '', style: { bgColor: 'rgba(34,211,238,0.6)', textColor: '#22d3ee' } },
    { id: 'mb-s3', type: 'shape', x: 230, y: 470, width: 55, height: 55, zIndex: 1, locked: false, containerId: 'mb-c2', shapeType: 'circle', content: '', style: { bgColor: 'rgba(52,211,153,0.6)', textColor: '#34d399' } },
    { id: 'mb-s4', type: 'shape', x: 305, y: 470, width: 55, height: 55, zIndex: 1, locked: false, containerId: 'mb-c2', shapeType: 'circle', content: '', style: { bgColor: 'rgba(251,146,60,0.6)', textColor: '#fb923c' } },
    { id: 'mb-s5', type: 'shape', x: 380, y: 470, width: 55, height: 55, zIndex: 1, locked: false, containerId: 'mb-c2', shapeType: 'circle', content: '', style: { bgColor: 'rgba(244,114,182,0.6)', textColor: '#f472b6' } },
    // 1 link element inside References
    { id: 'mb-lk1', type: 'link', x: 580, y: 470, width: 260, height: 80, zIndex: 1, locked: false, containerId: 'mb-c3', url: '', linkMode: 'bookmark', title: 'Reference link', description: 'Add a reference URL' },
    // 2 freeform notes (one in References, one in Notes & Keywords)
    { id: 'mb-n1', type: 'freeform', x: 580, y: 570, width: 260, height: 80, zIndex: 1, locked: false, containerId: 'mb-c3', content: 'Describe design references, inspirations, and mood keywords.', cardType: 'note' },
    { id: 'mb-n2', type: 'freeform', x: 70,  y: 770, width: 260, height: 100, zIndex: 1, locked: false, containerId: 'mb-c4', content: 'Key words: warm, organic, bold, minimal... capture the feeling here.', cardType: 'note' },
    // 1 text label
    { id: 'mb-t1', type: 'text', x: 50, y: 10, width: 250, height: 30, zIndex: 1, locked: false, content: 'Mood & Inspiration', style: labelStyle, textAlign: 'left' },
  ] as CanvasElement[],
};

// 7. Lean Canvas — 20 elements
const leanCanvas: TemplateDefinition = {
  id: 'lean-canvas',
  name: 'Lean Canvas',
  description: 'One-page business model adapted from Ash Maurya\'s Lean Canvas',
  emoji: '📊',
  category: 'creative',
  elements: [
    // 9 containers (classic Lean Canvas grid)
    // Row 1: Problem | Solution | UVP | Unfair Advantage | Customer Segments
    { id: 'lc-c1', type: 'container', x: 50,   y: 50,  width: 300, height: 360, zIndex: 0, label: 'Problem',                 tintColor: 'ocean',   collapsed: false, locked: false, style: containerStyle },
    { id: 'lc-c2', type: 'container', x: 370,  y: 50,  width: 300, height: 160, zIndex: 0, label: 'Solution',                tintColor: 'sunset',  collapsed: false, locked: false, style: containerStyle },
    { id: 'lc-c3', type: 'container', x: 690,  y: 50,  width: 300, height: 360, zIndex: 0, label: 'Unique Value Proposition', tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    { id: 'lc-c4', type: 'container', x: 1010, y: 50,  width: 300, height: 160, zIndex: 0, label: 'Unfair Advantage',        tintColor: 'rose',    collapsed: false, locked: false, style: containerStyle },
    { id: 'lc-c5', type: 'container', x: 1330, y: 50,  width: 300, height: 360, zIndex: 0, label: 'Customer Segments',       tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    // Row 2: Key Metrics (under Solution) | Channels (under Unfair Advantage)
    { id: 'lc-c6', type: 'container', x: 370,  y: 230, width: 300, height: 180, zIndex: 0, label: 'Key Metrics',             tintColor: 'glacier', collapsed: false, locked: false, style: containerStyle },
    { id: 'lc-c7', type: 'container', x: 1010, y: 230, width: 300, height: 180, zIndex: 0, label: 'Channels',                tintColor: 'ocean',   collapsed: false, locked: false, style: containerStyle },
    // Row 3: Cost Structure | Revenue Streams
    { id: 'lc-c8', type: 'container', x: 50,   y: 440, width: 780, height: 200, zIndex: 0, label: 'Cost Structure',          tintColor: 'sunset',  collapsed: false, locked: false, style: containerStyle },
    { id: 'lc-c9', type: 'container', x: 850,  y: 440, width: 780, height: 200, zIndex: 0, label: 'Revenue Streams',         tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    // 9 freeform notes (one per container)
    { id: 'lc-n1', type: 'freeform', x: 70,   y: 110, width: 260, height: 140, zIndex: 1, locked: false, containerId: 'lc-c1', content: 'Top 3 problems your customers face', cardType: 'note' },
    { id: 'lc-n2', type: 'freeform', x: 390,  y: 110, width: 260, height: 80,  zIndex: 1, locked: false, containerId: 'lc-c2', content: 'Top 3 features or capabilities', cardType: 'note' },
    { id: 'lc-n3', type: 'freeform', x: 710,  y: 110, width: 260, height: 140, zIndex: 1, locked: false, containerId: 'lc-c3', content: 'Single clear compelling message that states why you are different and worth paying attention to', cardType: 'note' },
    { id: 'lc-n4', type: 'freeform', x: 1030, y: 110, width: 260, height: 80,  zIndex: 1, locked: false, containerId: 'lc-c4', content: 'What can\'t be easily copied or bought', cardType: 'note' },
    { id: 'lc-n5', type: 'freeform', x: 1350, y: 110, width: 260, height: 140, zIndex: 1, locked: false, containerId: 'lc-c5', content: 'Target customers and early adopters', cardType: 'note' },
    { id: 'lc-n6', type: 'freeform', x: 390,  y: 290, width: 260, height: 80,  zIndex: 1, locked: false, containerId: 'lc-c6', content: 'Key numbers that tell you how your business is doing', cardType: 'note' },
    { id: 'lc-n7', type: 'freeform', x: 1030, y: 290, width: 260, height: 80,  zIndex: 1, locked: false, containerId: 'lc-c7', content: 'Path to customers (online, direct, partners)', cardType: 'note' },
    { id: 'lc-n8', type: 'freeform', x: 70,   y: 500, width: 260, height: 100, zIndex: 1, locked: false, containerId: 'lc-c8', content: 'Customer acquisition costs, hosting, salaries, fixed and variable costs', cardType: 'note' },
    { id: 'lc-n9', type: 'freeform', x: 870,  y: 500, width: 260, height: 100, zIndex: 1, locked: false, containerId: 'lc-c9', content: 'Revenue model, pricing, lifetime value, gross margin', cardType: 'note' },
    // 1 diamond shape inside UVP
    { id: 'lc-s1', type: 'shape', x: 810, y: 280, width: 60, height: 60, zIndex: 1, locked: false, containerId: 'lc-c3', shapeType: 'diamond', content: '💎', style: { bgColor: 'rgba(139,92,246,0.35)', textColor: '#c084fc' } },
    // 1 board "Customer Research" inside Customer Segments
    { id: 'lc-b1', type: 'board', x: 1350, y: 320, width: 160, height: 60, zIndex: 1, locked: false, containerId: 'lc-c5', childBoardId: 'lc-board-customers', title: 'Customer Research' },
  ] as CanvasElement[],
};

// 8. Brainstorm Board — 14 elements
const brainstormBoard: TemplateDefinition = {
  id: 'brainstorm',
  name: 'Brainstorm Board',
  description: 'Diverge, converge, and prioritize ideas into action items',
  emoji: '💡',
  category: 'creative',
  elements: [
    // 3 containers
    { id: 'bs-c1', type: 'container', x: 50,  y: 50,  width: 700, height: 420, zIndex: 0, label: 'Diverge — Generate Ideas', tintColor: 'violet',  collapsed: false, locked: false, style: containerStyle },
    { id: 'bs-c2', type: 'container', x: 780, y: 50,  width: 400, height: 420, zIndex: 0, label: 'Converge — Prioritize',    tintColor: 'emerald', collapsed: false, locked: false, style: containerStyle },
    { id: 'bs-c3', type: 'container', x: 50,  y: 500, width: 1130, height: 220, zIndex: 0, label: 'Action Items',            tintColor: 'ocean',   collapsed: false, locked: false, style: containerStyle },
    // 3 freeform notes inside Diverge (idea starters)
    { id: 'bs-n1', type: 'freeform', x: 70,  y: 110, width: 200, height: 140, zIndex: 1, locked: false, containerId: 'bs-c1', content: 'How might we reframe the core challenge?', cardType: 'note' },
    { id: 'bs-n2', type: 'freeform', x: 290, y: 110, width: 200, height: 140, zIndex: 1, locked: false, containerId: 'bs-c1', content: 'What if we removed every constraint?', cardType: 'note' },
    { id: 'bs-n3', type: 'freeform', x: 510, y: 110, width: 200, height: 140, zIndex: 1, locked: false, containerId: 'bs-c1', content: 'What would the opposite approach look like?', cardType: 'note' },
    // 4 rectangle shapes inside Converge (priority zones)
    { id: 'bs-s1', type: 'shape', x: 800,  y: 120, width: 80, height: 60, zIndex: 1, locked: false, containerId: 'bs-c2', shapeType: 'rectangle', content: 'High', style: { bgColor: 'rgba(52,211,153,0.35)', textColor: '#34d399' } },
    { id: 'bs-s2', type: 'shape', x: 900,  y: 120, width: 80, height: 60, zIndex: 1, locked: false, containerId: 'bs-c2', shapeType: 'rectangle', content: 'Maybe', style: { bgColor: 'rgba(250,204,21,0.35)', textColor: '#facc15' } },
    { id: 'bs-s3', type: 'shape', x: 1000, y: 120, width: 80, height: 60, zIndex: 1, locked: false, containerId: 'bs-c2', shapeType: 'rectangle', content: 'Low', style: { bgColor: 'rgba(248,113,113,0.35)', textColor: '#f87171' } },
    { id: 'bs-s4', type: 'shape', x: 1100, y: 120, width: 80, height: 60, zIndex: 1, locked: false, containerId: 'bs-c2', shapeType: 'rectangle', content: 'Park', style: { bgColor: 'rgba(139,92,246,0.35)', textColor: '#c084fc' } },
    // 2 freeform tasks inside Action Items
    { id: 'bs-ft1', type: 'freeform', x: 70,  y: 560, width: 260, height: 80, zIndex: 1, locked: false, containerId: 'bs-c3', content: 'Define owner, first step, and deadline for top idea', cardType: 'task' },
    { id: 'bs-ft2', type: 'freeform', x: 360, y: 560, width: 260, height: 80, zIndex: 1, locked: false, containerId: 'bs-c3', content: 'Schedule follow-up review session', cardType: 'task' },
    // 1 arrow line from Diverge to Converge
    { id: 'bs-l1', type: 'line', x: 0, y: 0, width: 0, height: 0, zIndex: 1, locked: false, start: { x: 750, y: 260 }, end: { x: 780, y: 260 }, style: { kind: 'solid', widthPx: 2, color: 'rgba(139,92,246,0.4)', endCap: 'arrow' } },
    // 1 text label
    { id: 'bs-t1', type: 'text', x: 50, y: 10, width: 250, height: 30, zIndex: 1, locked: false, content: 'Ideas → Priorities', style: labelStyle, textAlign: 'left' },
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
