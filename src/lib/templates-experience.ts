import type { CanvasElement, TableElement } from '@/types/canvas-elements';
import { makeEmptyTableCells } from '@/types/canvas-elements';
import type { TemplateDefinition } from './templates';
import {
  title, caption, divider, note, board, shape, storyboard, edge, zone, block,
  moodboardInterior, researchInterior, personaInterior, inspirationInterior,
  NOTE_TEAL, NOTE_ROSE, NOTE_VIOLET, NOTE_EMERALD, WARM_SUN, WARM_FIRE,
  BOARD_W, BOARD_H, NOTE_W, NOTE_H, BLOCK_W,
  type Fam,
} from './templates-quickstart';

// ─── One template per experience element, plus the generic flow/timeline pair ─
// Each anchors an experienceBlock (live framing data) and radiates the
// structures that section actually needs — hexagon walls for enumerable
// dimensions, quadrant cards for mapping sections, stage rails for flow.
// Authored against src/lib/templates.design.md.

const PAD_X = 36;
const GAP = 32;
const HEADER_H = 140; // clears zoneHeader (title + divider + caption)
const PAD_BOTTOM = 36;

/** Width/height of a hexagon wall container holding `cols` x `rows` boards. */
const wallW = (cols: number) => PAD_X * 2 + cols * BOARD_W + (cols - 1) * GAP;
const wallH = (rows: number) => HEADER_H + rows * BOARD_H + (rows - 1) * 40 + PAD_BOTTOM;

/** Grid of hexagon boards inside a zone container. */
function hexWall(
  prefix: string, zx: number, zy: number, cols: number,
  items: { title: string; hex: string }[],
): CanvasElement[] {
  return items.map((it, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return board(
      `${prefix}-b${i}`,
      zx + PAD_X + col * (BOARD_W + GAP),
      zy + HEADER_H + row * (BOARD_H + 40),
      it.title, it.hex, prefix,
    );
  });
}

/** Block anchor + 2x2 grid of gradient cards to its right (the Trait Mapping shape). */
function quadrantTemplate(
  id: string, name: string, description: string, emoji: string,
  key: 'stateMapping' | 'traitMapping' | 'desiredChange',
  blockTitle: string, pageTitle: string, gradient: string, cap: string,
  cards: { title: string; emoji: string; fill: string; body: string }[],
  gradients: Fam[],
): TemplateDefinition {
  const p = id.replace(/^qs-/, '');
  return {
    id, name, description, emoji,
    category: 'experience',
    elements: [
      title(`${p}-t`, 40, 40, pageTitle, gradient),
      caption(`${p}-c`, 40, 88, cap),
      block(`${p}-hub`, key, blockTitle, 40, 200),
      ...cards.map((c, i) =>
        note(
          `${p}-n${i}`,
          560 + (i % 2) * (NOTE_W + 80),
          200 + Math.floor(i / 2) * (NOTE_H + 40),
          c.title, c.emoji, c.fill, c.body,
        ),
      ),
    ] as CanvasElement[],
    edges: cards.map((_, i) => edge(`${p}-e${i}`, `${p}-hub`, `${p}-n${i}`, gradients[i % gradients.length])),
  };
}

// ─── 1. Desired Change ───────────────────────────────────────────────────────

const desiredChange = quadrantTemplate(
  'qs-desired-change', 'Desired Change',
  'What should shift in people — insight, feeling, state, and knowledge',
  '🦋', 'desiredChange', 'Desired Change', 'Desired Change',
  'linear-gradient(90deg, #34D399, #22D3EE)',
  'Name the shift you are designing for. One card per kind of change — write the evidence you would accept as proof.',
  [
    { title: 'Insights', emoji: '💡', fill: NOTE_EMERALD, body: 'What should they realise that they did not before?' },
    { title: 'Feelings', emoji: '💗', fill: NOTE_ROSE, body: 'What should they feel, during and after?' },
    { title: 'States', emoji: '🌀', fill: NOTE_VIOLET, body: 'What state should they move into?' },
    { title: 'Knowledge', emoji: '📚', fill: NOTE_TEAL, body: 'What should they be able to do or explain afterwards?' },
  ],
  ['emerald', 'rose', 'violet', 'ocean'],
);

// ─── 2. Human Context ────────────────────────────────────────────────────────

const humanContext: TemplateDefinition = {
  id: 'qs-human-context',
  name: 'Human Context',
  description: 'Who this is for: needs, desires, role, and full persona sheets',
  emoji: '🧑‍🤝‍🧑',
  category: 'experience',
  elements: [
    title('hc-t', 40, 40, 'Human Context', 'linear-gradient(90deg, #60A5FA, #34D399)'),
    caption('hc-c', 40, 88, 'Start from the person, not the product. Fill the three cards, then open a persona hexagon to build them out.'),
    block('hc-hub', 'humanContext', 'Human Context', 40, 200),
    note('hc-n1', 560, 200, 'Audience Needs', '🧩', NOTE_TEAL, 'What do they actually need — not what we want to give them?'),
    note('hc-n2', 900, 200, 'Audience Desires', '✨', NOTE_ROSE, 'What do they wish for, even if they would not say it out loud?'),
    note('hc-n3', 1240, 200, 'Their Role', '🎭', NOTE_VIOLET, 'Observer, participant, co-creator, architect? How much agency?'),
    divider('hc-div', 560, 600, 1500, 600, 'rgba(96,165,250,0.25)'),
    board('hc-p1', 620, 660, 'Persona A', '#F472B6'),
    board('hc-p2', 900, 660, 'Persona B', '#8B5CF6'),
    board('hc-p3', 1180, 660, 'Interviews', '#22D3EE'),
    ...personaInterior('hci-a', 'hc-p1-child', 'Persona A'),
    ...personaInterior('hci-b', 'hc-p2-child', 'Persona B'),
    ...researchInterior('hci-r', 'hc-p3-child'),
  ] as CanvasElement[],
  edges: [
    edge('hc-e1', 'hc-hub', 'hc-n1', 'ocean'),
    edge('hc-e2', 'hc-hub', 'hc-n2', 'rose'),
    edge('hc-e3', 'hc-hub', 'hc-n3', 'violet'),
    edge('hc-e4', 'hc-n1', 'hc-p1', 'emerald', 'bottom', 'top'),
  ],
};

// ─── 3. Reality Planes ───────────────────────────────────────────────────────

const REALITY_HEX = ['#8B5CF6', '#22D3EE', '#F97316', '#EC4899', '#34D399', '#6366F1', '#F472B6'];
const REALITY_ITEMS = [
  { title: 'Physical', hex: REALITY_HEX[0] },
  { title: 'Virtual', hex: REALITY_HEX[1] },
  { title: 'Augmented', hex: REALITY_HEX[2] },
  { title: 'Mixed', hex: REALITY_HEX[3] },
  { title: 'Generative', hex: REALITY_HEX[4] },
  { title: 'Biological', hex: REALITY_HEX[5] },
  { title: 'Cognitive', hex: REALITY_HEX[6] },
];

const realityPlanes: TemplateDefinition = {
  id: 'qs-reality-planes',
  name: 'Reality Planes',
  description: 'One portal per layer of reality your experience runs on',
  emoji: '🧊',
  category: 'experience',
  elements: [
    title('rp-t', 40, 40, 'Reality Planes', 'linear-gradient(90deg, #6D28D9, #22D3EE)'),
    caption('rp-c', 40, 88, 'Every layer your experience touches gets a portal. Open one to plan how that layer actually gets delivered.'),
    block('rp-hub', 'realityPlanes', 'Reality Planes', 40, 220),
    ...zone('rp-wall', 560, 200, wallW(4), wallH(2), 'Layers', 'violet',
      'Physical through cognitive — plan the ones you enabled, ignore the rest.'),
    ...hexWall('rp-wall', 560, 200, 4, REALITY_ITEMS),
  ] as CanvasElement[],
  edges: [edge('rp-e1', 'rp-hub', 'rp-wall', 'violet')],
};

// ─── 4. Sensory Domains ──────────────────────────────────────────────────────

const SENSORY_ITEMS = [
  { title: 'Visual', hex: '#EC4899' },
  { title: 'Auditory', hex: '#8B5CF6' },
  { title: 'Olfactory', hex: '#22D3EE' },
  { title: 'Gustatory', hex: '#6366F1' },
  { title: 'Haptic', hex: '#F97316' },
];

const sensoryDomains: TemplateDefinition = {
  id: 'qs-sensory-domains',
  name: 'Sensory Domains',
  description: 'A portal per sense, plus a reference wall for the overall palette',
  emoji: '👁️',
  category: 'experience',
  elements: [
    title('sd-t', 40, 40, 'Sensory Domains', 'linear-gradient(90deg, #F472B6, #60A5FA)'),
    caption('sd-c', 40, 88, 'Design every sense deliberately, including the ones you leave quiet. Open a hexagon to collect references for that sense.'),
    block('sd-hub', 'sensoryDomains', 'Sensory Domains', 40, 220),
    ...zone('sd-wall', 560, 200, wallW(5), wallH(1), 'The Five Senses', 'rose',
      'One portal per sense — references, materials, and cues live inside.'),
    ...hexWall('sd-wall', 560, 200, 5, SENSORY_ITEMS),
    ...zone('sd-pal', 560, 660, 700, 400, 'Sensory Palette', 'glacier',
      'The overall feel in one place — upload references that set the tone.'),
    { ...storyboard('sd-sb1', 596, 800, 300, 220), containerId: 'sd-pal' },
    { ...storyboard('sd-sb2', 920, 800, 300, 220), containerId: 'sd-pal' },
    ...moodboardInterior('sdi-v', 'sd-wall-b0-child'),
  ] as CanvasElement[],
  edges: [
    edge('sd-e1', 'sd-hub', 'sd-wall', 'rose'),
    edge('sd-e2', 'sd-hub', 'sd-pal', 'glacier'),
  ],
};

// ─── 5. Presence Types ───────────────────────────────────────────────────────

const PRESENCE_ITEMS = [
  { title: 'Mental', hex: '#22D3EE' },
  { title: 'Emotional', hex: '#F472B6' },
  { title: 'Social', hex: '#8B5CF6' },
  { title: 'Embodied', hex: '#34D399' },
  { title: 'Environmental', hex: '#F97316' },
  { title: 'Active', hex: '#60A5FA' },
];

const presenceTypes: TemplateDefinition = {
  id: 'qs-presence-types',
  name: 'Presence Types',
  description: 'Six ways a person can be present — one portal each',
  emoji: '📡',
  category: 'experience',
  elements: [
    title('pt-t', 40, 40, 'Presence Types', 'linear-gradient(90deg, #22D3EE, #A78BFA)'),
    caption('pt-c', 40, 88, 'Presence is not one thing. Decide which kinds you are designing for, and what each looks like in practice.'),
    block('pt-hub', 'presenceTypes', 'Presence Types', 40, 220),
    ...zone('pt-wall', 560, 200, wallW(3), wallH(2), 'Modes of Presence', 'glacier',
      'Open a portal and describe what that presence feels like here.'),
    ...hexWall('pt-wall', 560, 200, 3, PRESENCE_ITEMS),
    note('pt-n1', 1360, 260, 'Presence Goal', '🎯', NOTE_TEAL, 'If someone remembers one kind of presence, which should it be?'),
  ] as CanvasElement[],
  edges: [
    edge('pt-e1', 'pt-hub', 'pt-wall', 'glacier'),
    edge('pt-e2', 'pt-wall', 'pt-n1', 'ocean'),
  ],
};

// ─── 6 & 7. State / Trait Mapping ────────────────────────────────────────────

const stateMapping = quadrantTemplate(
  'qs-state-mapping', 'State Mapping',
  'The four states you want to trigger in the moment',
  '🧠', 'stateMapping', 'State Mapping', 'State Mapping',
  'linear-gradient(90deg, #10B981, #6366F1)',
  'States are what happens DURING. Write how you will trigger each one — the cue, the moment, the mechanism.',
  [
    { title: 'Cognitive', emoji: '🧠', fill: NOTE_TEAL, body: 'Mental states and thought patterns. How do you trigger this?' },
    { title: 'Emotional', emoji: '💗', fill: NOTE_ROSE, body: 'Feeling states and affects. How do you trigger this?' },
    { title: 'Somatic', emoji: '🫀', fill: NOTE_EMERALD, body: 'Body states and sensations. How do you trigger this?' },
    { title: 'Relational', emoji: '🫂', fill: NOTE_VIOLET, body: 'Connection with self, others, world. How do you trigger this?' },
  ],
  ['ocean', 'rose', 'emerald', 'violet'],
);

const traitMapping = quadrantTemplate(
  'qs-trait-mapping', 'Trait Mapping',
  'What stays after — and how you reinforce it',
  '💗', 'traitMapping', 'Trait Mapping', 'Trait Mapping',
  'linear-gradient(90deg, #F97316, #C084FC)',
  'Traits are what REMAINS. Map what they carry home, and how the experience reinforces it.',
  [
    { title: 'Cognitive', emoji: '🧠', fill: NOTE_VIOLET, body: 'Lasting mental patterns. How do you reinforce this?' },
    { title: 'Emotional', emoji: '💗', fill: NOTE_ROSE, body: 'Enduring emotional capacities. How do you reinforce this?' },
    { title: 'Somatic', emoji: '🫀', fill: WARM_SUN, body: 'Embodied habits and responses. How do you reinforce this?' },
    { title: 'Relational', emoji: '🫂', fill: NOTE_TEAL, body: 'Transformed ways of relating. How do you reinforce this?' },
  ],
  ['sunset', 'rose', 'violet', 'ocean'],
);

// ─── 8. Experience Flow ──────────────────────────────────────────────────────

const FLOW_STAGES: { key: string; label: string; fam: Fam; cap: string; emoji: string; fill: string }[] = [
  { key: 'prep', label: 'Preparation', fam: 'violet', cap: 'Before it begins: expectation, arrival, priming.', emoji: '🎒', fill: NOTE_VIOLET },
  { key: 'ind', label: 'Induction', fam: 'ocean', cap: 'Crossing the threshold. How does ordinary become other?', emoji: '🚪', fill: NOTE_TEAL },
  { key: 'jrn', label: 'Journey', fam: 'emerald', cap: 'The body of the experience — build, vary, sustain.', emoji: '🧭', fill: NOTE_EMERALD },
  { key: 'peak', label: 'Peak', fam: 'sunset', cap: 'The moment everything is built toward.', emoji: '🔥', fill: WARM_FIRE },
  { key: 'int', label: 'Integration', fam: 'rose', cap: 'Coming back. What do they carry out with them?', emoji: '🌅', fill: NOTE_ROSE },
];

const experienceFlow: TemplateDefinition = {
  id: 'qs-experience-flow',
  name: 'Experience Flow',
  description: 'The five-stage arc from preparation through integration',
  emoji: '🌊',
  category: 'experience',
  elements: [
    title('ef-t', 40, 40, 'Experience Flow', 'linear-gradient(90deg, #A78BFA, #22D3EE, #F472B6)'),
    caption('ef-c', 40, 88, 'Design the arc, not just the peak. Each stage gets a note for the beat and a frame for the visual.'),
    ...FLOW_STAGES.flatMap((s, i) => {
      const zx = 40 + i * 560;
      return [
        ...zone(`ef-${s.key}`, zx, 200, 500, 800, s.label, s.fam, s.cap),
        note(`ef-${s.key}-n`, zx + 36, 340, s.label, s.emoji, s.fill, '', `ef-${s.key}`),
        { ...storyboard(`ef-${s.key}-sb`, zx + 36, 700, 300, 250), containerId: `ef-${s.key}` },
      ];
    }),
  ] as CanvasElement[],
  edges: FLOW_STAGES.slice(0, -1).map((s, i) =>
    edge(`ef-e${i}`, `ef-${s.key}`, `ef-${FLOW_STAGES[i + 1].key}`, FLOW_STAGES[i].fam),
  ),
};

// ─── 9. UX Flow Chart — decision flow with waypoints ─────────────────────────

const flowNode = (fill: string, border: string) => ({
  bgColor: fill,
  borderColor: border,
  borderWidth: 2,
  textColor: 'rgba(255,255,255,0.85)',
  fontSize: 13,
  textAlign: 'center' as const,
});

const uxFlowChart: TemplateDefinition = {
  id: 'qs-ux-flow',
  name: 'UX Flow Chart',
  description: 'Entry, steps, a decision fork, and both outcomes',
  emoji: '🔀',
  category: 'product-brand',
  elements: [
    title('ux-t', 40, 40, 'UX Flow', 'linear-gradient(90deg, #60A5FA, #A78BFA)'),
    caption('ux-c', 40, 88, 'Map the path a user actually takes. Rename each node; the diamond is where the flow forks.'),
    shape('ux-start', 40, 380, 150, 150, 'circle', 'Entry', flowNode('linear-gradient(135deg, #1A1230 0%, #2B1C52 100%)', '#8B5CF6')),
    shape('ux-s1', 280, 405, 200, 100, 'rectangle', 'Step 1', flowNode('rgba(12,10,22,0.85)', 'linear-gradient(90deg, #60A5FA, #A78BFA)')),
    shape('ux-s2', 580, 405, 200, 100, 'rectangle', 'Step 2', flowNode('rgba(12,10,22,0.85)', 'linear-gradient(90deg, #22D3EE, #60A5FA)')),
    shape('ux-dec', 880, 370, 180, 180, 'diamond', 'Decision?', flowNode('rgba(12,10,22,0.85)', 'linear-gradient(90deg, #F97316, #F472B6)')),
    shape('ux-yes', 1160, 180, 200, 100, 'rectangle', 'Happy path', flowNode('rgba(12,10,22,0.85)', 'linear-gradient(90deg, #34D399, #22D3EE)')),
    shape('ux-no', 1160, 630, 200, 100, 'rectangle', 'Fallback', flowNode('rgba(12,10,22,0.85)', 'linear-gradient(90deg, #FB7185, #F472B6)')),
    shape('ux-end', 1460, 380, 150, 150, 'circle', 'Done', flowNode('linear-gradient(135deg, #0F2230 0%, #0F3A3A 100%)', '#34D399')),
    note('ux-n', 1700, 330, 'Edge Cases', '⚠️', WARM_FIRE, 'What breaks this flow? List the states you still owe a design.'),
  ] as CanvasElement[],
  edges: [
    edge('ux-e1', 'ux-start', 'ux-s1', 'violet'),
    edge('ux-e2', 'ux-s1', 'ux-s2', 'ocean'),
    edge('ux-e3', 'ux-s2', 'ux-dec', 'ocean'),
    edge('ux-e4', 'ux-dec', 'ux-yes', 'emerald'),
    edge('ux-e5', 'ux-dec', 'ux-no', 'rose'),
    edge('ux-e6', 'ux-yes', 'ux-end', 'emerald'),
    edge('ux-e7', 'ux-no', 'ux-end', 'rose'),
  ],
};

// ─── 10. Campaign Timeline — phases + schedule tables ────────────────────────

function scheduleTable(id: string, x: number, y: number, containerId: string): TableElement {
  const cells = makeEmptyTableCells(4, 3);
  cells[0] = [
    { text: 'When', bold: true },
    { text: 'What', bold: true },
    { text: 'Channel', bold: true },
  ];
  return {
    id, x, y, width: 520, height: 220, zIndex: 1,
    locked: false, boardId: null, surface: 'canvas',
    type: 'table', rows: 4, cols: 3, cells, headerRow: true,
    containerId,
  } as TableElement;
}

const CAMPAIGN_PHASES: { key: string; label: string; fam: Fam; cap: string }[] = [
  { key: 'tease', label: 'Tease', fam: 'violet', cap: 'Build curiosity before you explain anything.' },
  { key: 'launch', label: 'Launch', fam: 'sunset', cap: 'The reveal. Everything lands at once.' },
  { key: 'echo', label: 'Echo', fam: 'rose', cap: 'Sustain it — recaps, testimonials, the long tail.' },
];

const campaignTimeline: TemplateDefinition = {
  id: 'qs-campaign-timeline',
  name: 'Campaign Timeline',
  description: 'Tease, launch, and echo — each with a schedule and key visual',
  emoji: '📅',
  category: 'creative',
  elements: [
    title('ct-t', 40, 40, 'Campaign Timeline', 'linear-gradient(90deg, #F97316, #C084FC)'),
    caption('ct-c', 40, 88, 'Three phases, left to right. Fill the schedule table and drop the key visual for each beat.'),
    ...CAMPAIGN_PHASES.flatMap((p, i) => {
      const zx = 40 + i * 660;
      return [
        ...zone(`ct-${p.key}`, zx, 200, 600, 860, p.label, p.fam, p.cap),
        scheduleTable(`ct-${p.key}-tbl`, zx + 40, 340, `ct-${p.key}`),
        { ...storyboard(`ct-${p.key}-sb`, zx + 40, 620, 320, 250), containerId: `ct-${p.key}` },
      ];
    }),
    board('ct-assets', 2060, 260, 'Assets', '#8B5CF6'),
    ...moodboardInterior('cti-a', 'ct-assets-child'),
  ] as CanvasElement[],
  edges: [
    edge('ct-e1', 'ct-tease', 'ct-launch', 'violet'),
    edge('ct-e2', 'ct-launch', 'ct-echo', 'sunset'),
    edge('ct-e3', 'ct-echo', 'ct-assets', 'rose'),
  ],
};

export const EXPERIENCE_TEMPLATES: TemplateDefinition[] = [
  desiredChange,
  humanContext,
  realityPlanes,
  sensoryDomains,
  presenceTypes,
  stateMapping,
  traitMapping,
  experienceFlow,
  uxFlowChart,
  campaignTimeline,
];
