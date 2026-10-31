import type { CanvasElement, CanvasEdge, ElementStyle, ShapeElement } from '@/types/canvas-elements';
import type { FrameworkStep, TemplateDefinition } from './templates';
import {
  title, caption, note, block, shape, storyboard, edge, zone, stepStyle, FAM, type Fam,
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
    shape(`${prefix}-s${i + 1}`, x + i * 200, y, 160, 80, 'rectangle', `${i + 1} · ${s.title}`, stepStyle),
  );
}

/** edge() marks anchors auto, so the canvas ignores authored sides; pin any non-default (right to left) edge. */
function pinned(e: CanvasEdge): CanvasEdge {
  return { ...e, fromAutoAnchor: false, toAutoAnchor: false };
}

/** Page title + caption pair every framework opens with. */
function fwTitle(prefix: string, text: string, gradient: string, capText: string): CanvasElement[] {
  return [
    title(`${prefix}-title`, 40, 40, text, gradient),
    caption(`${prefix}-cap`, 40, 80, capText, 900),
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
void note; void block; void storyboard; void edge; void zone; void subjectStyle; void variableStyle;
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

const ICEBERG_LAYERS: { key: string; label: string; fam: Fam; cap: string; noteTitle: string; body: string; emoji: string; fill: string }[] = [
  { key: 'ev', label: 'Event', fam: 'glacier', cap: 'What happened? One visible moment, stated plainly.', noteTitle: 'The Event', body: 'What exactly happened, and who saw it? One sentence, no explanation yet.', emoji: '👁️', fill: NOTE_TEAL },
  { key: 'pa', label: 'Pattern', fam: 'ocean', cap: 'What keeps happening over time? Trends across sessions, audiences, seasons.', noteTitle: 'The Trend', body: 'When has this happened before? Note the rhythm: every run, one audience, one hour.', emoji: '📈', fill: NOTE_TEAL },
  { key: 'st', label: 'Structure', fam: 'violet', cap: 'What produces the pattern? Space, schedule, roles, rules, incentives, tech.', noteTitle: 'The Mechanism', body: 'What in the setup makes this likely? Name a rule, a space, a schedule or a role.', emoji: '⚙️', fill: NOTE_VIOLET },
  { key: 'mm', label: 'Mental model', fam: 'rose', cap: 'What beliefs hold the structure in place? Yours, the team\u2019s, the audience\u2019s.', noteTitle: 'The Belief', body: 'What must someone believe for this setup to feel normal or right?', emoji: '🧠', fill: NOTE_ROSE },
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
        note(`fwi-${l.key}-n`, 76, zy + 140, l.noteTitle, l.emoji, l.fill, l.body, `fwi-${l.key}`),
      ];
    }),
    block('fwi-anchor', 'desiredChange', 'Desired Change', 1120, 280),
  ] as CanvasElement[],
  edges: [
    pinned(edge('fwi-e1', 'fwi-ev', 'fwi-pa', 'glacier', 'bottom', 'top')),
    pinned(edge('fwi-e2', 'fwi-pa', 'fwi-st', 'ocean', 'bottom', 'top')),
    pinned(edge('fwi-e3', 'fwi-st', 'fwi-mm', 'violet', 'bottom', 'top')),
    pinned(edge('fwi-e4', 'fwi-anchor', 'fwi-mm', 'rose', 'left', 'right')),
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
    note('fwc-lv-n', 76, 1080, 'Intervention', '🎯', NOTE_EMERALD, 'Which loop does this weaken or strengthen? How long until it shows?', 'fwc-lv'),
  ] as CanvasElement[],
  edges: [
    { ...edge('fwc-e1', 'fwc-r1', 'fwc-r2', 'ocean'), label: { text: '+', fontSize: 18 } },
    { ...pinned(edge('fwc-e2', 'fwc-r2', 'fwc-r3', 'ocean', 'bottom', 'right')), label: { text: '+', fontSize: 18 } },
    { ...pinned(edge('fwc-e3', 'fwc-r3', 'fwc-r1', 'ocean', 'left', 'bottom')), label: { text: '+', fontSize: 18 } },
    { ...edge('fwc-e4', 'fwc-b1', 'fwc-b2', 'rose'), label: { text: '+', fontSize: 18 } },
    { ...pinned(edge('fwc-e5', 'fwc-b2', 'fwc-b3', 'rose', 'bottom', 'right')), label: { text: '−', fontSize: 18 } },
    { ...pinned(edge('fwc-e6', 'fwc-b3', 'fwc-b1', 'rose', 'left', 'bottom')), label: { text: '+', fontSize: 18 } },
  ],
};

// ─── 3. Theory of Change — RAIL read backwards: trait ← outcomes ← states ← inputs

const TOC_STEPS: FrameworkStep[] = [
  { title: 'Name the lasting trait', detail: 'The change that should still be there months later. One sentence, in the participant\u2019s life, not in the room.' },
  { title: 'Work back to the outcomes', detail: 'What changes in behaviour, relationships or decisions in the days and weeks after? These are changes in people, not counts of attendees.' },
  { title: 'Define the states that lead there', detail: 'Which temporary states, felt during the experience, make that trait possible?' },
  { title: 'List activities and their inputs', detail: 'What you actually do, moment by moment, to evoke each state, and the people, space, time and money each one depends on.' },
  { title: 'Write the assumptions', detail: 'Every arrow hides a belief. Say it out loud so it can be tested.' },
];

const TOC_ZONES: { key: string; label: string; fam: Fam; cap: string; noteTitle: string; body: string; emoji: string; fill: string }[] = [
  { key: 'in', label: 'Inputs & activities', fam: 'emerald', cap: 'What you bring and what you do. Pair each activity with the resources it needs.', noteTitle: 'Activity', body: 'Which activity, and what does it need? One line each.', emoji: '🛠️', fill: NOTE_EMERALD },
  { key: 'st', label: 'States', fam: 'ocean', cap: 'What participants feel or notice during the experience because of those activities.', noteTitle: 'State evoked', body: 'What should someone feel or notice at this moment?', emoji: '🌊', fill: NOTE_TEAL },
  { key: 'ou', label: 'Outcomes', fam: 'violet', cap: 'What changes in the days and weeks after. Behaviour, relationships, decisions.', noteTitle: 'Outcome', body: 'What will they do differently a few weeks on?', emoji: '🌱', fill: NOTE_VIOLET },
  { key: 'tr', label: 'Lasting trait', fam: 'rose', cap: 'The change that stays. Write it as the participant would describe themselves a year on.', noteTitle: 'Trait', body: 'A year on, I am someone who\u2026', emoji: '💎', fill: NOTE_ROSE },
];

const theoryOfChange: TemplateDefinition = {
  id: 'fw-theory-of-change',
  name: 'Theory of Change',
  description: 'Work backwards from the lasting trait to the states, activities and inputs that produce it',
  emoji: '🧭',
  category: 'framework',
  framework: {
    stage: 'think',
    origin: 'Popularised by Carol Weiss (1995) through the Aspen Institute Roundtable on Community Change',
    sourceUrl: 'https://www.theoryofchange.org/what-is-theory-of-change/toc-background/toc-origins/',
    whatItIs: 'A Theory of Change is an explicit chain from the long-term change you want back to what you will do to cause it, with every assumption written down. It starts at the end, with the lasting trait, and asks what must be true one step earlier, and earlier again. The result is a map you can test rather than a hope.',
    whenToUse: [
      'An experience claims transformation and you want to show how, not just that.',
      'Funders, partners or collaborators ask why this design will work.',
      'States and traits are set in Framing and you want the activities to earn them.',
    ],
    steps: TOC_STEPS,
    pitfalls: [
      'Starting with activities you already love and reverse-engineering a trait to justify them.',
      'Leaving assumptions implicit, so the chain cannot fail and cannot be learned from.',
      'Outcomes written as outputs ("40 people attended") instead of changes in people.',
    ],
    assistantBrief: 'Coach the Theory of Change. The canvas reads right to left: Lasting trait, Outcomes, States, Inputs & activities, with arrows pointing back toward causes. Start at the trait: if it is vague, make the designer write it as a participant describing themselves a year later. Then step leftward one zone at a time asking "what must be true just before this?". Reject outputs dressed as outcomes (counts of people or sessions are outputs). For every arrow, ask for the assumption behind it and record it on the Assumptions to test note. Use the Trait Mapping block when present as the source for the trait zone. Finish by asking which assumption is weakest and how they would test it cheaply.',
  },
  elements: [
    ...fwTitle('fwt', 'Theory of Change', FAM.rose.grad, 'Start on the right with the trait that lasts, then ask what must be true one step earlier. Arrows point back to causes.'),
    ...stepRail('fwt', TOC_STEPS),
    ...TOC_ZONES.flatMap((z, i) => {
      const zx = 40 + i * 460;
      return [
        ...zone(`fwt-${z.key}`, zx, 280, 420, 600, z.label, z.fam, z.cap),
        note(`fwt-${z.key}-n`, zx + 36, 420, z.noteTitle, z.emoji, z.fill, z.body, `fwt-${z.key}`),
      ];
    }),
    note('fwt-as', 40, 920, 'Assumptions to test', '🧪', WARM_SUN, 'Every arrow hides a belief. Which is weakest, and how would you test it cheaply?'),
    block('fwt-anchor', 'traitMapping', 'Trait Mapping', 1880, 280),
  ] as CanvasElement[],
  edges: [
    pinned(edge('fwt-e1', 'fwt-tr', 'fwt-ou', 'rose', 'left', 'right')),
    pinned(edge('fwt-e2', 'fwt-ou', 'fwt-st', 'violet', 'left', 'right')),
    pinned(edge('fwt-e3', 'fwt-st', 'fwt-in', 'ocean', 'left', 'right')),
    pinned(edge('fwt-e4', 'fwt-anchor', 'fwt-tr', 'rose', 'left', 'right')),
  ],
};

// ─── 4. How Might We + Crazy 8s — RAIL: questions → eight sketches → pick

const HMW_STEPS: FrameworkStep[] = [
  { title: 'Frame the challenge', detail: 'One sentence on what is hard, for whom, and why it matters. No solutions yet.' },
  { title: 'Write How Might We questions', detail: 'Turn the challenge into open questions. Several angles: amplify the good, remove the bad, flip the assumption.' },
  { title: 'Pick one question', detail: 'Choose the one that is neither so broad it says nothing nor so narrow it hides the answer.' },
  { title: 'Sketch eight ideas in eight minutes', detail: 'One frame per minute. Ugly is fine. Quantity now, judgement later.' },
  { title: 'Vote and develop', detail: 'Dot-vote the frames, then take the winner into a fuller sketch or storyboard.' },
];

const hmwCrazy8: TemplateDefinition = {
  id: 'fw-hmw-crazy8',
  name: 'How Might We + Crazy 8s',
  description: 'Reframe the challenge into open questions, then sketch eight answers in eight minutes',
  emoji: '✏️',
  category: 'framework',
  framework: {
    stage: 'ideate',
    origin: 'How Might We: coined by Min Basadur at Procter & Gamble in the 1970s, popularised by IDEO and the d.school. Crazy 8s: the Google Ventures Design Sprint (Jake Knapp)',
    sourceUrl: 'https://designsprintkit.withgoogle.com/methodology/phase3-sketch/crazy-8s',
    whatItIs: 'How Might We turns a problem statement into open, optimistic questions that invite many answers. Crazy 8s then forces eight rough sketches in eight minutes, so the first obvious idea does not win by default. Together they move a team from a stuck problem to a spread of candidate ideas in under an hour.',
    whenToUse: [
      'The team keeps circling the same one or two ideas.',
      'A framing is clear but no one has proposed what the experience actually does.',
      'You need many options fast before committing a storyboard.',
    ],
    steps: HMW_STEPS,
    pitfalls: [
      'Questions that contain the answer ("How might we add a VR headset?").',
      'Judging sketches during the eight minutes; the timer is the point.',
      'Voting on drawing quality rather than on the idea.',
    ],
    assistantBrief: 'Coach How Might We and Crazy 8s. The canvas has a How Might We zone with question notes, a Crazy 8s zone with eight storyboard frames, and a Pick & develop zone. First check the challenge is stated without a solution inside it. Help the designer generate several How Might We questions from different angles (amplify, remove, flip, break into pieces) and rewrite any that smuggle in an answer or are too broad. Encourage picking one question before sketching. During sketching, do not evaluate; remind them one frame per minute and that words count as sketches. After eight frames, help them vote on ideas not drawings, and move the winner into the Pick & develop zone with what it would need next.',
  },
  elements: [
    ...fwTitle('fwh', 'How Might We + Crazy 8s', FAM.sunset.grad, 'Open the problem into questions, then outrun your first idea with eight quick frames.'),
    ...stepRail('fwh', HMW_STEPS),

    ...zone('fwh-q', 40, 280, 1320, 480, 'How Might We…', 'sunset',
      'One question per note. Try several angles: amplify the good, remove the bad, flip an assumption, split it up.'),
    note('fwh-q1', 76, 410, 'How might we…', '❓', WARM_SUN, '…so that participants feel…', 'fwh-q'),
    note('fwh-q2', 376, 410, 'How might we…', '🔄', WARM_FIRE, '…without…', 'fwh-q'),

    ...zone('fwh-8', 40, 800, 1320, 620, 'Crazy 8s', 'violet',
      'Eight frames, eight minutes, one idea each. Drop a photo of your sketch or draw with words.'),
    ...Array.from({ length: 8 }, (_, i) =>
      ({ ...storyboard(`fwh-f${i + 1}`, 76 + (i % 4) * 320, i < 4 ? 930 : 1170, 280, 220), containerId: 'fwh-8' }),
    ),

    ...zone('fwh-p', 1400, 280, 520, 1140, 'Pick & develop', 'emerald',
      'The frame that won the vote, and what it needs to become a storyboard.'),
    note('fwh-p-n', 1436, 410, 'Winner', '⭐', NOTE_EMERALD, 'Why this one? What does it need next?', 'fwh-p'),
  ] as CanvasElement[],
  edges: [
    pinned(edge('fwh-e1', 'fwh-q', 'fwh-8', 'sunset', 'bottom', 'top')),
    edge('fwh-e2', 'fwh-8', 'fwh-p', 'violet'),
  ],
};

export const FRAMEWORK_TEMPLATES: TemplateDefinition[] = [
  iceberg,
  causalLoop,
  theoryOfChange,
  hmwCrazy8,
];

export { stepRail, fwTitle };
