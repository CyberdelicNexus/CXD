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
        ...zone(`fwt-${z.key}`, zx, 280, 380, 600, z.label, z.fam, z.cap),
        note(`fwt-${z.key}-n`, zx + 36, 420, z.noteTitle, z.emoji, z.fill, z.body, `fwt-${z.key}`),
      ];
    }),
    note('fwt-as', 800, 960, 'Assumptions to test', '🧪', WARM_SUN, 'Every arrow hides a belief. Which is weakest, and how would you test it cheaply?'),
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
    assistantBrief: 'Coach How Might We and Crazy 8s. The canvas has a How Might We zone with question notes, a Crazy 8s zone with eight storyboard frames, and a Pick & develop zone. First check the challenge is stated without a solution inside it. Help the designer generate several How Might We questions from different angles (amplify, remove, flip, break into pieces) and rewrite any that smuggle in an answer or are too broad. Encourage picking one question before sketching. During sketching, do not evaluate; remind them one frame per minute and that sketching happens on paper first, then they upload a photo of each frame and caption it. After eight frames, help them vote on ideas not drawings, and move the winner into the Pick & develop zone with what it would need next.',
  },
  elements: [
    ...fwTitle('fwh', 'How Might We + Crazy 8s', FAM.sunset.grad, 'Open the problem into questions, then outrun your first idea with eight quick frames.'),
    ...stepRail('fwh', HMW_STEPS),

    ...zone('fwh-q', 40, 280, 1320, 480, 'How Might We…', 'sunset',
      'One question per note. Try several angles: amplify the good, remove the bad, flip an assumption, split it up.'),
    note('fwh-q1', 76, 410, 'How might we…', '❓', WARM_SUN, '…so that participants feel…', 'fwh-q'),
    note('fwh-q2', 376, 410, 'How might we…', '🔄', WARM_FIRE, '…without…', 'fwh-q'),

    ...zone('fwh-8', 40, 800, 1320, 620, 'Crazy 8s', 'violet',
      'Eight frames, eight minutes, one idea each. Sketch on paper, then upload a photo of each and caption it.'),
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

// ─── 5. SCAMPER — HUB: the experience in the centre, seven lenses around it

const SCAMPER_STEPS: FrameworkStep[] = [
  { title: 'Substitute', detail: 'Swap a material, a role, a place, a sense, a time. What takes its place?' },
  { title: 'Combine', detail: 'Merge two moments, two audiences, two media. What new thing appears?' },
  { title: 'Adapt', detail: 'What does another field, culture or ritual do that could be borrowed here?' },
  { title: 'Modify', detail: 'Magnify or shrink it. Louder, slower, longer, darker, tinier.' },
  { title: 'Put to other use', detail: 'Who else could this serve? What else could this moment do?' },
  { title: 'Eliminate', detail: 'Remove a step, a prop, a rule, an explanation. What survives?' },
  { title: 'Reverse', detail: 'Flip the order, the roles, the direction. End at the beginning.' },
];

const SCAMPER_LENSES: { key: string; title: string; emoji: string; fill: string; x: number; y: number }[] = [
  { key: 's', title: 'Substitute', emoji: '🔄', fill: NOTE_VIOLET, x: 200, y: 280 },
  { key: 'c', title: 'Combine', emoji: '🧬', fill: NOTE_TEAL, x: 560, y: 280 },
  { key: 'a', title: 'Adapt', emoji: '🦎', fill: NOTE_EMERALD, x: 920, y: 280 },
  { key: 'm', title: 'Modify', emoji: '🔍', fill: WARM_SUN, x: 40, y: 640 },
  { key: 'p', title: 'Put to other use', emoji: '🎁', fill: NOTE_ROSE, x: 1080, y: 640 },
  { key: 'e', title: 'Eliminate', emoji: '✂️', fill: WARM_FIRE, x: 200, y: 1000 },
  { key: 'r', title: 'Reverse', emoji: '🔃', fill: NOTE_TEAL, x: 920, y: 1000 },
];

const scamper: TemplateDefinition = {
  id: 'fw-scamper',
  name: 'SCAMPER',
  description: 'Seven lenses that twist an existing experience into new variants',
  emoji: '🎛️',
  category: 'framework',
  framework: {
    stage: 'ideate',
    origin: 'Bob Eberle (1971), building on Alex Osborn\u2019s brainstorming checklists',
    whatItIs: 'SCAMPER is a checklist of seven operations you apply to something that already exists: Substitute, Combine, Adapt, Modify, Put to other use, Eliminate, Reverse. Each lens forces a different kind of change, so you stop polishing and start transforming. It is fastest when you already have an experience, a scene or a ritual to work on.',
    whenToUse: [
      'An experience works but feels safe, and you want variants worth testing.',
      'You are adapting a format to a new audience, venue or budget.',
      'A brainstorm has stalled and needs mechanical prompts.',
    ],
    steps: SCAMPER_STEPS,
    pitfalls: [
      'Answering each lens once and moving on; the third answer per lens is usually the interesting one.',
      'Applying the lenses to the whole experience instead of one concrete moment.',
      'Treating every result as a proposal; most are stepping stones.',
    ],
    assistantBrief: 'Coach SCAMPER. The canvas has the subject card in the centre, seven lens notes around it (Substitute, Combine, Adapt, Modify, Put to other use, Eliminate, Reverse) and a Keepers zone. First make sure the subject card names one concrete moment or element, not the whole experience. Then walk the lenses in order; for each, offer one provocative example drawn from the project and ask for at least three answers before moving on. Do not judge during a lens. After all seven, help the designer move the two or three strongest variants into Keepers and say what would need to be true for each to work. If they stall, pick the lens least like their habits, usually Eliminate or Reverse.',
  },
  elements: [
    ...fwTitle('fws', 'SCAMPER', FAM.violet.grad, 'Put one concrete moment in the centre. Run every lens at it, three answers each. Keep what surprises you.'),
    ...stepRail('fws', SCAMPER_STEPS),
    shape('fws-subject', 560, 700, 260, 200, 'hexagon', 'The moment we are twisting', subjectStyle),
    ...SCAMPER_LENSES.map((l) => note(`fws-${l.key}`, l.x, l.y, l.title, l.emoji, l.fill, 'Three answers, fast.')),
    ...zone('fws-k', 1420, 280, 520, 1040, 'Keepers', 'emerald',
      'Variants worth testing. Say what must be true for each to work.'),
    note('fws-k-n', 1456, 420, 'Keeper', '💎', NOTE_EMERALD, 'Which variant, and what must be true for it to work?', 'fws-k'),
  ] as CanvasElement[],
  // Spokes leave the hexagon by distinct points: three share the top side and two the bottom,
  // so they are pinned at spread offsets; Modify and Put to other use take the left and right.
  edges: SCAMPER_LENSES.map((l, i) => {
    const spokes: { from: 'top' | 'bottom' | 'left' | 'right'; to: 'top' | 'bottom' | 'left' | 'right'; off: number }[] = [
      { from: 'top', to: 'bottom', off: 0.3 }, { from: 'top', to: 'bottom', off: 0.5 }, { from: 'top', to: 'bottom', off: 0.7 },
      { from: 'left', to: 'right', off: 0.5 }, { from: 'right', to: 'left', off: 0.5 },
      { from: 'bottom', to: 'top', off: 0.3 }, { from: 'bottom', to: 'top', off: 0.7 },
    ];
    const s = spokes[i];
    return {
      ...pinned(edge(`fws-e${i + 1}`, 'fws-subject', `fws-${l.key}`, (['violet', 'ocean', 'emerald', 'sunset', 'rose', 'glacier', 'ocean'] as const)[i], s.from, s.to)),
      fromAnchorOffset: s.off,
    };
  }),
};

// ─── 6. Impact–Effort Matrix — HUB 2×2 + idea inbox

const IMPACT_STEPS: FrameworkStep[] = [
  { title: 'List the ideas', detail: 'Everything on the table, one per note, in the inbox. No ranking yet.' },
  { title: 'Score impact', detail: 'How much does it move the experience toward its intended states and traits? High or low.' },
  { title: 'Score effort', detail: 'Time, money, people, risk. High or low, relative to the rest of the list.' },
  { title: 'Place and decide', detail: 'Drag each note into its quadrant. Do quick wins now, schedule big bets, drop time sinks.' },
];

const IMPACT_QUADS: { key: string; label: string; fam: Fam; cap: string; noteTitle: string; body: string; emoji: string; fill: string; x: number; y: number }[] = [
  { key: 'qw', label: 'Quick wins', fam: 'emerald', cap: 'High impact, low effort. Do these first.', noteTitle: 'Quick win', body: 'One idea that pays off fast and is cheap. Why is it easy?', emoji: '⚡', fill: NOTE_EMERALD, x: 40, y: 340 },
  { key: 'bb', label: 'Big bets', fam: 'violet', cap: 'High impact, high effort. Schedule and resource them deliberately.', noteTitle: 'Big bet', body: 'One idea worth the investment. What will it need in time and people?', emoji: '🎯', fill: NOTE_VIOLET, x: 700, y: 340 },
  { key: 'fi', label: 'Fill-ins', fam: 'ocean', cap: 'Low impact, low effort. Only when there is slack.', noteTitle: 'Fill-in', body: 'One small, easy idea. Do it only when there is slack.', emoji: '🧩', fill: NOTE_TEAL, x: 40, y: 900 },
  { key: 'ts', label: 'Time sinks', fam: 'rose', cap: 'Low impact, high effort. Say no, kindly.', noteTitle: 'Time sink', body: 'One idea that costs a lot and moves little. Why say no?', emoji: '🕳️', fill: NOTE_ROSE, x: 700, y: 900 },
];

const impactEffort: TemplateDefinition = {
  id: 'fw-impact-effort',
  name: 'Impact–Effort Matrix',
  description: 'Sort ideas into quick wins, big bets, fill-ins and time sinks before committing',
  emoji: '📐',
  category: 'framework',
  framework: {
    stage: 'plan',
    origin: 'A widely used prioritisation 2×2 with no single originator; similar in shape, but not in axes, to the Eisenhower matrix',
    whatItIs: 'The Impact–Effort Matrix is a 2×2 that sorts ideas by how much they move the goal and how much they cost to do. Quick wins get done first, big bets get scheduled, fill-ins wait for slack, and time sinks get dropped. It turns a long wishlist into a short plan in one session.',
    whenToUse: [
      'There are more ideas than budget or time.',
      'A team disagrees about what to build next and needs a shared picture.',
      'After an ideation session, before anything goes on the timeline.',
    ],
    steps: IMPACT_STEPS,
    pitfalls: [
      'Scoring effort optimistically; estimates for novel work are usually low by half.',
      'Confusing impact with excitement. Score against the experience\u2019s intended states and traits.',
      'Keeping time sinks "just in case". The matrix is for saying no.',
    ],
    assistantBrief: 'Coach the Impact–Effort Matrix. The canvas has four quadrant zones (Quick wins, Big bets, Fill-ins, Time sinks) and an Idea inbox. Help the designer get every idea into the inbox first, one per note, without ranking. Then score each idea on impact against the project\u2019s intended states and traits from Framing, not against excitement, and on effort relative to the other ideas, nudging estimates up for anything novel. Suggest where each note belongs and let them drag it. When the matrix is full, summarise: what to do this week (quick wins), what to schedule and resource (big bets), what to park (fill-ins) and what to drop (time sinks). Encourage saying no to time sinks explicitly.',
  },
  elements: [
    ...fwTitle('fwm', 'Impact–Effort Matrix', FAM.emerald.grad, 'Impact high on the top row, low on the bottom. Effort grows left to right. Drag notes from the inbox into their quadrant.'),
    ...stepRail('fwm', IMPACT_STEPS),
    caption('fwm-axis', 40, 280, '↑ Impact on the top row   ·   Effort grows left → right', 1280, 12),
    ...IMPACT_QUADS.flatMap((q) => [
      ...zone(`fwm-${q.key}`, q.x, q.y, 620, 520, q.label, q.fam, q.cap),
      note(`fwm-${q.key}-n`, q.x + 36, q.y + 140, q.noteTitle, q.emoji, q.fill, q.body, `fwm-${q.key}`),
    ]),
    ...zone('fwm-in', 1360, 340, 520, 1080, 'Idea inbox', 'sunset',
      'Everything on the table, one per note. Score, then drag into a quadrant.'),
    note('fwm-in-n', 1396, 480, 'Idea', '💡', WARM_SUN, 'Impact: high / low. Effort: high / low.', 'fwm-in'),
  ] as CanvasElement[],
  edges: [],
};

// ─── 7. Pre-mortem — RAIL: failure → causes → safeguards → owners

const PREMORTEM_STEPS: FrameworkStep[] = [
  { title: 'Set the scene', detail: 'It is the day after the experience. It failed badly. Everyone agrees this is fact, not a risk.' },
  { title: 'Imagine the failure', detail: 'Each person writes, alone and in two minutes, what the failure looked like.' },
  { title: 'List every cause', detail: 'Go round the room, one cause each, until the list is exhausted. No debating, no fixing.' },
  { title: 'Rank the causes', detail: 'Which are likely and severe? Mark the top five.' },
  { title: 'Convert to safeguards with owners', detail: 'For each top cause, one concrete safeguard, one owner, one date.' },
];

const premortem: TemplateDefinition = {
  id: 'fw-premortem',
  name: 'Pre-mortem',
  description: 'Assume the launch failed, list why, and turn the causes into safeguards',
  emoji: '🪦',
  category: 'framework',
  framework: {
    stage: 'plan',
    origin: 'Gary Klein, "Performing a Project Premortem", Harvard Business Review, 2007',
    sourceUrl: 'https://hbr.org/2007/09/performing-a-project-premortem',
    whatItIs: 'A pre-mortem imagines that the project has already failed and asks the team to explain why. Because the failure is treated as fact, people name risks they would otherwise keep quiet about. Research on prospective hindsight (Mitchell, Russo and Pennington, 1989) found that imagining an event has already happened helped people generate about 30 percent more reasons for it.',
    whenToUse: [
      'A plan is set and the team is confident; that is exactly when blind spots hide.',
      'Before a launch, a premiere or an opening night.',
      'When one strong voice has shaped the plan and others have gone quiet.',
    ],
    steps: PREMORTEM_STEPS,
    pitfalls: [
      'Letting people defend the plan during the causes round; defence comes later or never.',
      'Writing vague causes ("bad luck", "low turnout") instead of mechanisms.',
      'Ending with a list of worries and no owners or dates.',
    ],
    assistantBrief: 'Coach the Pre-mortem. The canvas is a rail: The launch failed, Causes, Safeguards, Owners & dates. Hold the frame: the failure has happened, it is not a possibility. If the designer slips into defending the plan or fixing things early, bring them back to listing causes. Push every cause toward a mechanism: who did or did not do what, and why. Help them rank by likelihood and severity and pick about five. Then, cause by cause, demand one concrete safeguard, a named owner and a date; a safeguard without an owner is a wish. If the project has tasks on the Plan view, suggest turning safeguards into task cards.',
  },
  // Four zones on a 520/760/760/520 rail, every gutter 80px so the arrows read.
  elements: [
    ...fwTitle('fwp', 'Pre-mortem', FAM.rose.grad, 'It is the morning after and it went badly. Explain why, then make sure it cannot.'),
    ...stepRail('fwp', PREMORTEM_STEPS),

    ...zone('fwp-f', 40, 280, 520, 560, 'The launch failed', 'rose',
      'Describe the failure as if it has already happened. What did people see and say?'),
    note('fwp-f-n', 76, 420, 'It flopped because…', '🪦', NOTE_ROSE, 'Write it in the past tense.', 'fwp-f'),

    ...zone('fwp-c', 640, 280, 760, 560, 'Causes', 'sunset',
      'One cause per note, mechanism not blame. Keep going until the room is empty, then mark the five likeliest and most severe.'),
    note('fwp-c-n1', 676, 420, 'Cause', '⚠️', WARM_FIRE, 'Who did or did not do what, and why?', 'fwp-c'),
    note('fwp-c-n2', 976, 420, 'Cause', '⚠️', WARM_SUN, 'What did the plan assume that turned out false?', 'fwp-c'),

    ...zone('fwp-s', 1480, 280, 760, 560, 'Safeguards', 'emerald',
      'For each top cause, the concrete thing that prevents or catches it.'),
    note('fwp-s-n1', 1516, 420, 'Safeguard', '🛡️', NOTE_EMERALD, 'Prevents or catches which cause?', 'fwp-s'),
    note('fwp-s-n2', 1816, 420, 'Safeguard', '🛡️', NOTE_TEAL, 'If prevention fails, what would catch it early?', 'fwp-s'),

    ...zone('fwp-o', 2320, 280, 520, 560, 'Owners & dates', 'violet',
      'A safeguard without an owner is a wish. Name and date each one.'),
    note('fwp-o-n', 2356, 420, 'Owner · date', '📅', NOTE_VIOLET, 'Which safeguard, who owns it, and by what date?', 'fwp-o'),
  ] as CanvasElement[],
  edges: [
    edge('fwp-e1', 'fwp-f', 'fwp-c', 'rose'),
    edge('fwp-e2', 'fwp-c', 'fwp-s', 'sunset'),
    edge('fwp-e3', 'fwp-s', 'fwp-o', 'emerald'),
  ],
};

// ─── 8. Work-back Plan — RAIL from today to the live date

const WORKBACK_STEPS: FrameworkStep[] = [
  { title: 'Fix the live date', detail: 'The one date that does not move. Everything else is derived from it.' },
  { title: 'Name the non-negotiable milestones', detail: 'Venue confirmed, cast locked, tech rehearsal, doors open. The few that everything hangs on.' },
  { title: 'Work back the dependencies', detail: 'For each milestone, what must be finished before it, and how long does that take?' },
  { title: 'Assign owners', detail: 'One name per milestone. Shared ownership is no ownership.' },
  { title: 'Add buffer', detail: 'Put slack before the milestones that cannot slip. Novel work usually takes longer than planned.' },
];

const WORKBACK_ZONES: { key: string; label: string; fam: Fam; cap: string; noteTitle: string; body: string; emoji: string; fill: string }[] = [
  { key: 'now', label: 'Today', fam: 'glacier', cap: 'What is already true, decided or booked. Start from reality.', noteTitle: 'Already in place', body: 'Owner: · Due: · Depends on:', emoji: '📍', fill: NOTE_TEAL },
  { key: 'm3', label: 'T − 3 months', fam: 'ocean', cap: 'The long-lead items: venue, partners, funding, permits, key people.', noteTitle: 'Long-lead milestone', body: 'Owner: · Due: · Depends on: · Buffer:', emoji: '🏗️', fill: NOTE_TEAL },
  { key: 'm1', label: 'T − 1 month', fam: 'violet', cap: 'Content locked, materials ordered, rehearsals scheduled, comms drafted.', noteTitle: 'Lock milestone', body: 'Owner: · Due: · Depends on: · Buffer:', emoji: '🔒', fill: NOTE_VIOLET },
  { key: 'live', label: 'Live date', fam: 'sunset', cap: 'The date that does not move. Doors open. Everything else is derived from this.', noteTitle: 'Doors open', body: 'Date: · Owner: · What must be true before doors open:', emoji: '🎬', fill: WARM_SUN },
];

const workback: TemplateDefinition = {
  id: 'fw-workback',
  name: 'Work-back Plan',
  description: 'Schedule backwards from the live date: milestones, dependencies, owners, buffer',
  emoji: '⏳',
  category: 'framework',
  framework: {
    stage: 'ship',
    origin: 'Event production and project-management practice; backward scheduling from a fixed deadline',
    whatItIs: 'A work-back plan starts from the date that cannot move and walks backwards, placing every milestone where it must land for the next one to be possible. It exposes long-lead items early and shows where slack has to live. Production teams use it because the opening night does not negotiate.',
    whenToUse: [
      'There is a fixed date: an opening, a festival slot, a premiere, a launch.',
      'Several workstreams must converge and nobody can see the whole picture.',
      'A plan keeps slipping and you need to find where the buffer should have been.',
    ],
    steps: WORKBACK_STEPS,
    pitfalls: [
      'Planning forward from today and discovering the long-lead items too late.',
      'Milestones without a single owner.',
      'No buffer before the milestones that cannot slip; buffer at the end is useless.',
    ],
    assistantBrief: 'Coach the Work-back Plan. The canvas is a timeline rail: Today, T − 3 months, T − 1 month, Live date. Begin at the Live date and make sure it is fixed and written. Then ask, column by column moving left, what must already be finished for the next column to be possible, and how long each item takes. Flag long-lead items (venues, permits, partners, key people) and push them into the earliest column. Insist on one named owner per milestone. Before finishing, ask where buffer lives and suggest adding it before the milestones that cannot slip. If the project uses the Plan view, offer to turn milestones into task cards with due dates.',
  },
  // Zones are 380 wide on a 460 pitch: 80px gutters so the arrows read.
  elements: [
    ...fwTitle('fww', 'Work-back Plan', FAM.sunset.grad, 'Start from the right. The live date does not move; everything to its left is what must already be true.'),
    ...stepRail('fww', WORKBACK_STEPS),
    ...WORKBACK_ZONES.flatMap((z, i) => {
      const zx = 40 + i * 460;
      return [
        ...zone(`fww-${z.key}`, zx, 280, 380, 600, z.label, z.fam, z.cap),
        note(`fww-${z.key}-n`, zx + 36, 420, z.noteTitle, z.emoji, z.fill, z.body, `fww-${z.key}`),
      ];
    }),
  ] as CanvasElement[],
  edges: [
    edge('fww-e1', 'fww-now', 'fww-m3', 'glacier'),
    edge('fww-e2', 'fww-m3', 'fww-m1', 'ocean'),
    edge('fww-e3', 'fww-m1', 'fww-live', 'violet'),
  ],
};

export const FRAMEWORK_TEMPLATES: TemplateDefinition[] = [
  iceberg,
  causalLoop,
  theoryOfChange,
  hmwCrazy8,
  scamper,
  impactEffort,
  premortem,
  workback,
];

export { stepRail, fwTitle };
