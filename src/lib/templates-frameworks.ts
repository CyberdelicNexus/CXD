import type { CanvasElement, ElementStyle, ShapeElement } from '@/types/canvas-elements';
import type { FrameworkStep, TemplateDefinition } from './templates';
import {
  title, caption, divider, container, note, block, shape, storyboard, edge, stepStyle, FAM, type Fam,
  NOTE_TEAL, NOTE_ROSE, NOTE_VIOLET, NOTE_EMERALD, WARM_SUN, WARM_FIRE,
} from './templates-quickstart';

// ─── Framework templates ──────────────────────────────────────────────────────
// Each entry is a method, not just a layout: `framework` holds the explainer the
// Frameworks tab shows and the brief the Canvas Assistant coaches from, and the
// canvas carries one numbered step card per explainer step (same titles — the
// verify script enforces it). Layouts follow templates.design.md: title at
// (40,40), caption at (40,80), step rail at y=160, zones from y=280, 20px grid.
// Content is checked against docs/superpowers/research/2026-10-31-frameworks-research.md.

/** Numbered step cards along the top of the template, 200px pitch. */
function stepRail(prefix: string, steps: FrameworkStep[], x = 40, y = 160): ShapeElement[] {
  return steps.map((s, i) =>
    shape(`${prefix}-s${i + 1}`, x + i * 200, y, 160, 70, 'rectangle', `${i + 1} · ${s.title}`, stepStyle),
  );
}

/** Page title + caption pair every framework opens with. */
function fwTitle(prefix: string, text: string, gradient: string, capText: string): CanvasElement[] {
  return [
    title(`${prefix}-title`, 40, 40, text, gradient),
    caption(`${prefix}-cap`, 40, 80, capText, 900),
  ];
}

/** Tinted zone like quickstart's zone(), but with the header inset on the 20px
 *  grid (x+40, y+20, caption y+80) because the registry verify snaps every
 *  non-line element, headers included. Contents sit at x+40. */
function zone(prefix: string, x: number, y: number, w: number, h: number, label: string, fam: Fam, capText: string): CanvasElement[] {
  return [
    container(prefix, x, y, w, h, label, fam, true),
    { ...title(`${prefix}-h-title`, x + 40, y + 20, label, FAM[fam].grad, 20, Math.min(360, w - 80)), containerId: prefix },
    { ...divider(`${prefix}-h-div`, x + 40, y + 72, x + w - 40, y + 72, FAM[fam].accent), containerId: prefix },
    { ...caption(`${prefix}-h-cap`, x + 40, y + 80, capText, w - 80, 12), containerId: prefix },
  ];
}

/** A shape that belongs to a zone (moves with it, counts as its content). */
function inZone(containerId: string, el: ShapeElement): ShapeElement {
  return { ...el, containerId };
}

/** The subject card at the centre of hub layouts. */
const subjectStyle: ElementStyle = {
  bgColor: 'rgba(12,10,22,0.92)',
  borderColor: 'rgba(192,132,252,0.55)',
  borderWidth: 2,
  textColor: 'rgba(255,255,255,0.9)',
  fontSize: 15,
  textAlign: 'center',
};

/** Variable cards in the causal loop map. */
const variableStyle: ElementStyle = {
  bgColor: 'rgba(12,10,22,0.9)',
  borderColor: 'rgba(96,165,250,0.5)',
  borderWidth: 1,
  textColor: 'rgba(255,255,255,0.85)',
  fontSize: 13,
  textAlign: 'center',
};

// Silence unused-import warnings until the authoring tasks use everything.
void note; void block; void storyboard; void edge; void subjectStyle; void variableStyle;
void NOTE_TEAL; void NOTE_ROSE; void NOTE_VIOLET; void NOTE_EMERALD; void WARM_SUN; void WARM_FIRE;
type _Fam = Fam;

/** Frameworks insertable on the free tier: one Think, one Ideate, one Plan. */
export const FREE_FRAMEWORK_IDS: readonly string[] = ['fw-iceberg', 'fw-hmw-crazy8', 'fw-impact-effort'];

// ─── 1. Iceberg Model — VERTICAL RAIL: event → pattern → structure → mental model

const ICEBERG_STEPS: FrameworkStep[] = [
  { title: 'Name the event', detail: 'Write the single visible thing that happened, as a participant or a critic would describe it.' },
  { title: 'Trace the pattern', detail: 'Look back across several runs or moments. What repeats? Plot the trend, not the instance.' },
  { title: 'Expose the structure', detail: 'Which rules, incentives, spaces, schedules or roles make the pattern happen?' },
  { title: 'Surface the mental model', detail: 'What do you, the team or the audience believe that keeps that structure in place?' },
  { title: 'Choose the leverage point', detail: 'Pick the deepest layer you can realistically change. Deeper layers move more with less force.' },
];

const ICEBERG_LAYERS: { key: string; label: string; fam: Fam; cap: string; noteTitle: string; emoji: string; fill: string }[] = [
  { key: 'ev', label: 'Event', fam: 'glacier', cap: 'What happened? One visible moment, stated plainly.', noteTitle: 'The Event', emoji: '👁️', fill: NOTE_TEAL },
  { key: 'pa', label: 'Pattern', fam: 'ocean', cap: 'What keeps happening over time? Trends across sessions, audiences, seasons.', noteTitle: 'The Trend', emoji: '📈', fill: NOTE_TEAL },
  { key: 'st', label: 'Structure', fam: 'violet', cap: 'What produces the pattern? Space, schedule, roles, rules, incentives, tech.', noteTitle: 'The Mechanism', emoji: '⚙️', fill: NOTE_VIOLET },
  { key: 'mm', label: 'Mental model', fam: 'rose', cap: 'What beliefs hold the structure in place? Yours, the team\u2019s, the audience\u2019s.', noteTitle: 'The Belief', emoji: '🧠', fill: NOTE_ROSE },
];

const iceberg: TemplateDefinition = {
  id: 'fw-iceberg',
  name: 'Iceberg Model',
  description: 'See below the visible event: patterns, structures and the beliefs that hold them',
  emoji: '🧊',
  category: 'framework',
  framework: {
    stage: 'think',
    origin: 'A widely used systems-thinking tool, often associated with Peter Senge\u2019s The Fifth Discipline (1990); no single originator is documented',
    sourceUrl: 'https://www.thinknpc.org/resource-hub/the-iceberg-model/',
    whatItIs: 'The Iceberg Model is a systems-thinking tool for looking beneath a single event to the patterns, structures and mental models that produce it. Only the event is visible; the layers below explain why it keeps happening. The deeper the layer you change, the more leverage you have.',
    whenToUse: [
      'Something in an experience keeps going wrong and quick fixes have not held.',
      'Feedback is contradictory and you suspect a deeper cause.',
      'Before redesigning, to decide whether to change the content, the structure or the premise.',
    ],
    steps: ICEBERG_STEPS,
    pitfalls: [
      'Stopping at the pattern layer and calling a trend an explanation.',
      'Writing structures as blame ("the facilitator was tired") instead of mechanisms.',
      'Choosing the shallow fix because the deep one feels uncomfortable.',
    ],
    assistantBrief: 'Coach the Iceberg Model. The canvas has four zones stacked top to bottom: Event, Pattern, Structure, Mental model. Keep the designer moving downward: when they describe an event, ask what repeats; when they name a pattern, ask which structure produces it; when they name a structure, ask what belief keeps it in place. Push for mechanisms, not blame, and for one concrete statement per layer. When all four layers hold something, help them choose a leverage point and prefer the deepest layer they can realistically change. Use the Desired Change block when present: the states and traits the experience aims for are usually the mental-model layer in disguise. Never let a trend stand as an explanation.',
  },
  elements: [
    ...fwTitle('fwi', 'Iceberg Model', FAM.glacier.grad, 'Four layers, top to bottom. Each one explains the one above it. Change the deepest layer you can reach.'),
    ...stepRail('fwi', ICEBERG_STEPS),
    ...ICEBERG_LAYERS.flatMap((l, i) => {
      const zy = 280 + i * 520;
      return [
        ...zone(`fwi-${l.key}`, 40, zy, 1000, 480, l.label, l.fam, l.cap),
        note(`fwi-${l.key}-n`, 80, zy + 140, l.noteTitle, l.emoji, l.fill, '', `fwi-${l.key}`),
      ];
    }),
    block('fwi-anchor', 'desiredChange', 'Desired Change', 1120, 280),
  ] as CanvasElement[],
  edges: [
    edge('fwi-e1', 'fwi-ev', 'fwi-pa', 'glacier', 'bottom', 'top'),
    edge('fwi-e2', 'fwi-pa', 'fwi-st', 'ocean', 'bottom', 'top'),
    edge('fwi-e3', 'fwi-st', 'fwi-mm', 'violet', 'bottom', 'top'),
    edge('fwi-e4', 'fwi-anchor', 'fwi-mm', 'rose', 'left', 'right'),
  ],
};

// ─── 2. Causal Loop Map — TWO LOOPS + leverage zone ───────────────────────────

const CAUSAL_STEPS: FrameworkStep[] = [
  { title: 'Name the variables', detail: 'Things that can go up or down: attendance, trust, energy, cost, word of mouth. Nouns, not actions.' },
  { title: 'Draw the causal links', detail: 'Arrow from cause to effect. Only draw links you could defend to a sceptic.' },
  { title: 'Mark each link + or −', detail: '+ when both move the same way, − when one rises as the other falls.' },
  { title: 'Find the loops', detail: 'Reinforcing loops amplify (growth or collapse). Balancing loops stabilise or stall.' },
  { title: 'Pick where to intervene', detail: 'Weaken a loop that hurts, strengthen one that helps. Note delays: effects arrive late.' },
];

const causalLoop: TemplateDefinition = {
  id: 'fw-causal-loop',
  name: 'Causal Loop Map',
  description: 'Draw the reinforcing and balancing loops that drive an experience up or down',
  emoji: '🔁',
  category: 'framework',
  framework: {
    stage: 'think',
    origin: 'System dynamics, founded by Jay Forrester at MIT in the 1950s; causal loop diagrams popularised for managers by Peter Senge\u2019s The Fifth Discipline (1990)',
    sourceUrl: 'https://thesystemsthinker.com/causal-loop-construction-the-basics/',
    whatItIs: 'A causal loop map shows how the variables in a system push on each other and close into loops. Reinforcing loops amplify change in one direction; balancing loops resist it. Seeing the loops tells you why an experience grows, plateaus or collapses, and where a small push would travel furthest.',
    whenToUse: [
      'Word of mouth, attendance or energy behave in ways a straight plan cannot explain.',
      'Two goals seem to fight each other and you want to see the mechanism.',
      'Before scaling an experience, to find what will stall it.',
    ],
    steps: CAUSAL_STEPS,
    pitfalls: [
      'Drawing links you merely suspect; every arrow should be defensible.',
      'Forgetting delays, so an effect that arrives months later gets read as "no effect".',
      'Mapping everything. Six to ten variables is a map; thirty is a hairball.',
    ],
    assistantBrief: 'Coach the Causal Loop Map. The canvas has a Reinforcing loop zone, a Balancing loop zone and a Leverage points zone, each loop drawn with variable cards and labelled edges. Insist that variables are quantities that can rise or fall, not actions. For each link ask the designer to say the direction aloud: "more of this means more (or less) of that". Help them trace each loop and classify it: an odd number of minus signs makes it balancing, otherwise reinforcing. Ask about delays whenever an effect is slow. When both loops are drawn, steer them to the Leverage points zone and ask which loop to weaken or strengthen, and what the smallest intervention would be. Keep the map to six to ten variables.',
  },
  elements: [
    ...fwTitle('fwc', 'Causal Loop Map', FAM.ocean.grad, 'Variables are nouns that rise or fall. Arrows say what pushes what; the sign says which way. Loops explain the behaviour.'),
    ...stepRail('fwc', CAUSAL_STEPS),

    ...zone('fwc-r', 40, 280, 760, 620, 'Reinforcing loop', 'ocean',
      'A loop that feeds itself. Rename the three variables to yours and keep the arrows honest.'),
    inZone('fwc-r', shape('fwc-r1', 120, 420, 200, 80, 'pill', 'Word of mouth', variableStyle)),
    inZone('fwc-r', shape('fwc-r2', 520, 420, 200, 80, 'pill', 'Attendance', variableStyle)),
    inZone('fwc-r', shape('fwc-r3', 320, 700, 200, 80, 'pill', 'Peak moments shared', variableStyle)),

    ...zone('fwc-b', 840, 280, 760, 620, 'Balancing loop', 'rose',
      'A loop that pushes back. Something grows, something else limits it.'),
    inZone('fwc-b', shape('fwc-b1', 920, 420, 200, 80, 'pill', 'Attendance', variableStyle)),
    inZone('fwc-b', shape('fwc-b2', 1320, 420, 200, 80, 'pill', 'Crowding', variableStyle)),
    inZone('fwc-b', shape('fwc-b3', 1120, 700, 200, 80, 'pill', 'Intimacy felt', variableStyle)),

    ...zone('fwc-lv', 40, 940, 1560, 480, 'Leverage points', 'emerald',
      'Where would a small push travel furthest? One note per candidate intervention, with the delay you expect.'),
    note('fwc-lv-n', 80, 1080, 'Intervention', '🎯', NOTE_EMERALD, 'Which loop does this weaken or strengthen? How long until it shows?', 'fwc-lv'),
  ] as CanvasElement[],
  edges: [
    { ...edge('fwc-e1', 'fwc-r1', 'fwc-r2', 'ocean'), label: { text: '+' } },
    { ...edge('fwc-e2', 'fwc-r2', 'fwc-r3', 'ocean', 'bottom', 'right'), label: { text: '+' } },
    { ...edge('fwc-e3', 'fwc-r3', 'fwc-r1', 'ocean', 'left', 'bottom'), label: { text: '+' } },
    { ...edge('fwc-e4', 'fwc-b1', 'fwc-b2', 'rose'), label: { text: '+' } },
    { ...edge('fwc-e5', 'fwc-b2', 'fwc-b3', 'rose', 'bottom', 'right'), label: { text: '−' } },
    { ...edge('fwc-e6', 'fwc-b3', 'fwc-b1', 'rose', 'left', 'bottom'), label: { text: '+' } },
  ],
};

export const FRAMEWORK_TEMPLATES: TemplateDefinition[] = [
  iceberg,
  causalLoop,
];

export { stepRail, fwTitle };
