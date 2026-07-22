import type {
  CanvasElement,
  CanvasEdge,
  ContainerElement,
  BoardElement,
  FreeformElement,
  TextElement,
  ImageElement,
  ShapeElement,
  LineElement,
  ExperienceBlockElement,
  InspectorSectionId,
  ElementStyle,
} from '@/types/canvas-elements';
import type { TemplateDefinition } from './templates';

// ─── Quickstart templates (design-system generation) ─────────────────────────
//
// Authored against src/lib/templates.design.md — the design language distilled
// from the user's exemplar layouts. Key conventions:
//   - Spine compositions (rail / hub / gallery), gradient-text titles + guidance
//     captions, tinted zones with seeds, hexagon-board portals, curved gradient
//     edges with waypoint shapes, experienceBlock anchors into live framing data.
//   - All dimensions are REAL rendered footprints (from framing-to-canvas.ts):
//     note cards have a hard 300px CSS height floor (stored 320), board nodes
//     need 170x230 for hex + label, experience blocks are 420 wide with
//     content-measured height (satellites top-align to block.y, never depend on
//     its height).
//
// Ids are readable strings — instantiateTemplate() remaps everything (elements,
// containerId, childBoardId, boardId, edge endpoints) to fresh UUIDs at insert.

export const NOTE_W = 260;
export const NOTE_H = 320;
export const BOARD_W = 170;
export const BOARD_H = 230;
export const BLOCK_W = 420;

export const containerStyle: ElementStyle = {
  borderColor: 'rgba(255,255,255,0.15)',
  borderWidth: 1,
  borderStyle: 'dashed',
  bgColor: 'rgba(255,255,255,0.03)',
};

// Note fills — the shared dark-gradient families (PRESET_COLORS palette) plus
// the two bespoke warm "polarity" gradients proven in framing-to-canvas.
export const WARM_SUN = 'linear-gradient(135deg, #4A2E05 0%, #92400E 60%, #1a0f02 100%)';
export const WARM_FIRE = 'linear-gradient(135deg, #450A0A 0%, #991B1B 60%, #1a0505 100%)';
export const NOTE_TEAL = 'linear-gradient(135deg, #11202D 0%, #1E3E4D 100%)';
export const NOTE_ROSE = 'linear-gradient(135deg, #3B0764 0%, #831843 100%)';
export const NOTE_VIOLET = 'linear-gradient(135deg, #1A1230 0%, #2B1C52 100%)';
export const NOTE_EMERALD = 'linear-gradient(135deg, #0F2230 0%, #0F3A3A 100%)';

// Transition/action shapes between storyboard frames (user-requested pattern):
// small gradient-bordered rectangles the user writes the beat/transition into.
export const transitionStyle = (border: string): ElementStyle => ({
  bgColor: 'rgba(12,10,22,0.85)',
  borderColor: border,
  borderWidth: 2,
  textColor: 'rgba(255,255,255,0.7)',
  fontSize: 12,
  textAlign: 'center',
});

export type Gradient = 'violet' | 'ocean' | 'emerald' | 'sunset' | 'rose' | 'glacier';
type Anchor = 'top' | 'right' | 'bottom' | 'left';

// ─── Factories ────────────────────────────────────────────────────────────────

const base = (id: string, x: number, y: number, width: number, height: number, zIndex = 1) => ({
  id, x, y, width, height, zIndex,
  locked: false,
  boardId: null as string | null,
  surface: 'canvas' as const,
});

/** Gradient page/zone title — TextElement renders style.bgColor gradients as background-clip text. */
export function title(id: string, x: number, y: number, text: string, gradient: string, fontSize = 24, width = 520): TextElement {
  return {
    ...base(id, x, y, width, 40),
    type: 'text',
    content: text,
    textAlign: 'left',
    style: { fontSize, fontWeight: 'bold', bgColor: gradient },
  };
}

export function caption(id: string, x: number, y: number, text: string, width = 620, fontSize = 13): TextElement {
  return {
    ...base(id, x, y, width, 40),
    type: 'text',
    content: text,
    textAlign: 'left',
    style: { fontSize, textColor: 'rgba(255,255,255,0.55)' },
  };
}

/** Thin accent divider (straight line). NOT locked — locked elements are
 *  excluded from group drags, which left template dividers behind when the
 *  user marquee-selected a whole template and moved it. Zone dividers still
 *  travel with their zone via containerId. */
export function divider(id: string, x1: number, y1: number, x2: number, y2: number, color: string): LineElement {
  return {
    ...base(id, 0, 0, 0, 0),
    type: 'line',
    locked: false,
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    style: { kind: 'solid', widthPx: 2, color },
  };
}

export function note(id: string, x: number, y: number, noteTitle: string, emoji: string, bg: string, body = '', containerId?: string): FreeformElement {
  return {
    ...base(id, x, y, NOTE_W, NOTE_H),
    type: 'freeform',
    cardType: 'note',
    noteTitle,
    noteBody: body,
    content: '',
    emoji: emoji || undefined,
    containerId,
    style: { bgColor: bg, textColor: '#ffffff' },
  };
}

export function doc(id: string, x: number, y: number, docTitle: string, containerId?: string): FreeformElement {
  return {
    ...base(id, x, y, 100, 130),
    type: 'freeform',
    cardType: 'note',
    isDocument: true,
    noteTitle: docTitle,
    noteBody: '',
    content: docTitle,
    containerId,
    style: {},
  };
}

export function board(id: string, x: number, y: number, boardTitle: string, hex: string, containerId?: string): BoardElement {
  return {
    ...base(id, x, y, BOARD_W, BOARD_H),
    type: 'board',
    childBoardId: `${id}-child`,
    title: boardTitle,
    hexColor: hex,
    containerId,
  };
}

export function container(
  id: string, x: number, y: number, width: number, height: number,
  label: string, tint: ContainerElement['tintColor'], hideLabel = true,
): ContainerElement {
  return {
    ...base(id, x, y, width, height, 0),
    type: 'container',
    label,
    hideLabel,
    tintColor: tint,
    collapsed: false,
    style: containerStyle,
  };
}

export function block(id: string, key: InspectorSectionId, blockTitle: string, x: number, y: number): ExperienceBlockElement {
  return {
    ...base(id, x, y, BLOCK_W, 360), // height nominal — card measures real content on mount
    type: 'experienceBlock',
    componentKey: key,
    title: blockTitle,
    viewMode: 'inline',
  };
}

/** Storyboard frame seed — empty src shows the upload affordance inside the framed card. */
export function storyboard(id: string, x: number, y: number, width = 320, height = 250): ImageElement {
  return {
    ...base(id, x, y, width, height),
    type: 'image',
    src: '',
    storyboard: true,
    description: '',
  };
}

export function shape(id: string, x: number, y: number, w: number, h: number, shapeType: ShapeElement['shapeType'], content: string, style: ElementStyle): ShapeElement {
  return {
    ...base(id, x, y, w, h),
    type: 'shape',
    shapeType,
    content,
    style,
  };
}

export function edge(id: string, from: string, to: string, gradient: Gradient, fromAnchor: Anchor = 'right', toAnchor: Anchor = 'left'): CanvasEdge {
  return {
    id,
    fromNodeId: from,
    toNodeId: to,
    fromAnchor,
    toAnchor,
    fromAutoAnchor: true,
    toAutoAnchor: true,
    fromAnchorOffset: 0.5,
    toAnchorOffset: 0.5,
    boardId: null,
    surface: 'canvas',
    style: { thickness: 2, lineStyle: 'solid', gradientName: gradient, arrowStyle: 'end' },
  };
}

// ─── Multilayer interiors ─────────────────────────────────────────────────────
// Pre-seeded BOARD contents: elements stamped with boardId = the template
// board's childBoardId (instantiateTemplate remaps both together), so double-
// clicking a hexagon lands in a ready-to-fill layout instead of a blank board.

/** Stamp a set of elements into a board's coordinate space. */
function inBoard(boardRef: string, els: CanvasElement[]): CanvasElement[] {
  return els.map((e) => ({ ...e, boardId: boardRef }));
}

function inBoardEdge(boardRef: string, e: CanvasEdge): CanvasEdge {
  return { ...e, boardId: boardRef };
}

/** Mini storyboard sequence: 3 frames + a writable transition card. */
function storyboardInterior(prefix: string, boardRef: string): { elements: CanvasElement[]; edges: CanvasEdge[] } {
  return {
    elements: inBoard(boardRef, [
      title(`${prefix}-t`, 60, 40, 'Storyboard', 'linear-gradient(90deg, #8B5CF6, #60A5FA)', 22),
      storyboard(`${prefix}-s1`, 60, 140),
      shape(`${prefix}-tr`, 440, 205, 140, 100, 'rectangle', 'Transition', transitionStyle('linear-gradient(90deg, #60A5FA, #A78BFA)')),
      storyboard(`${prefix}-s2`, 640, 140),
      storyboard(`${prefix}-s3`, 1020, 140),
    ]),
    edges: [
      inBoardEdge(boardRef, edge(`${prefix}-e1`, `${prefix}-s1`, `${prefix}-tr`, 'ocean')),
      inBoardEdge(boardRef, edge(`${prefix}-e2`, `${prefix}-tr`, `${prefix}-s2`, 'ocean')),
      inBoardEdge(boardRef, edge(`${prefix}-e3`, `${prefix}-s2`, `${prefix}-s3`, 'violet')),
    ],
  };
}

/** 2×2 reference wall. */
function moodboardInterior(prefix: string, boardRef: string): CanvasElement[] {
  return inBoard(boardRef, [
    title(`${prefix}-t`, 60, 40, 'Moodboard', 'linear-gradient(90deg, #F472B6, #A78BFA)', 22),
    storyboard(`${prefix}-s1`, 60, 140),
    storyboard(`${prefix}-s2`, 404, 140),
    storyboard(`${prefix}-s3`, 60, 414),
    storyboard(`${prefix}-s4`, 404, 414),
  ]);
}

/** Evidence shelf: documents + a key-insight note. */
function researchInterior(prefix: string, boardRef: string): CanvasElement[] {
  return inBoard(boardRef, [
    title(`${prefix}-t`, 60, 40, 'Research', 'linear-gradient(90deg, #60A5FA, #22D3EE)', 22),
    caption(`${prefix}-c`, 60, 88, 'Drop sources here — one document per finding.', 480, 12),
    doc(`${prefix}-d1`, 60, 160, 'Source A'),
    doc(`${prefix}-d2`, 200, 160, 'Source B'),
    doc(`${prefix}-d3`, 340, 160, 'Source C'),
    note(`${prefix}-n`, 520, 160, 'Key Insight', '💡', NOTE_TEAL, 'What do the sources agree on?'),
  ]);
}

/** Row of inspiration frames. */
function inspirationInterior(prefix: string, boardRef: string): CanvasElement[] {
  return inBoard(boardRef, [
    title(`${prefix}-t`, 60, 40, 'Inspiration', 'linear-gradient(90deg, #EC4899, #F472B6)', 22),
    storyboard(`${prefix}-s1`, 60, 140),
    storyboard(`${prefix}-s2`, 404, 140),
    storyboard(`${prefix}-s3`, 748, 140),
  ]);
}

/** Persona sheet: portrait frame + bio / goals / pains notes. */
function personaInterior(prefix: string, boardRef: string, name: string): CanvasElement[] {
  return inBoard(boardRef, [
    title(`${prefix}-t`, 60, 40, name, 'linear-gradient(90deg, #60A5FA, #34D399)', 22),
    storyboard(`${prefix}-p`, 60, 140, 260, 250),
    note(`${prefix}-bio`, 400, 140, 'Bio', '🙂', NOTE_TEAL, 'Who are they? Age, role, context.'),
    note(`${prefix}-goal`, 700, 140, 'Goals', '🎯', NOTE_EMERALD, 'What are they trying to achieve?'),
    note(`${prefix}-pain`, 1000, 140, 'Pain Points', '😖', NOTE_ROSE, 'What gets in their way today?'),
  ]);
}

/** Zone header trio: gradient title + accent divider + guidance caption,
 *  parented to the container so the whole zone moves as one unit. */
export function zoneHeader(prefix: string, zx: number, zy: number, zw: number, text: string, gradient: string, accent: string, captionText: string, containerId: string): CanvasElement[] {
  return [
    { ...title(`${prefix}-title`, zx + 36, zy + 24, text, gradient, 20, Math.min(360, zw - 72)), containerId },
    { ...divider(`${prefix}-div`, zx + 36, zy + 72, zx + zw - 36, zy + 72, accent), containerId },
    { ...caption(`${prefix}-cap`, zx + 36, zy + 84, captionText, zw - 72, 12), containerId },
  ];
}

// ─── 1. Intention Core Starter — RAIL ────────────────────────────────────────
// anchor block → polarity notes (incentives / antivision) → evidence locker →
// divider → reference hexagons.

const intentionCore: TemplateDefinition = {
  id: 'qs-intention-core',
  name: 'Intention Core Starter',
  description: 'Anchor the experience: pulls, anti-vision, and the evidence behind both',
  emoji: '🎯',
  category: 'experience',
  elements: [
    title('qic-title', 40, 40, 'Intention Core', 'linear-gradient(90deg, #C084FC, #F472B6)'),
    caption('qic-cap', 40, 88, 'Anchor the experience: what pulls people in, what you refuse to build, and the evidence behind both. Click any card to edit it.'),
    block('qic-hub', 'intentionCore', 'Intention Core', 40, 160),
    note('qic-n1', 550, 160, 'Design Incentives', '🔆', WARM_SUN, 'What draws people in? List the pulls, promises, and rewards.'),
    note('qic-n2', 550, 520, 'Antivision', '🔥', WARM_FIRE, 'What must this never become? Name the failure modes to design against.'),
    container('qic-evidence', 900, 160, 300, 560, 'Evidence', 'violet', false),
    doc('qic-d1', 1000, 250, 'Interviews', 'qic-evidence'),
    doc('qic-d2', 1000, 410, 'References', 'qic-evidence'),
    doc('qic-d3', 1000, 570, 'Prior Art', 'qic-evidence'),
    divider('qic-vdiv', 1290, 160, 1290, 720, 'rgba(139,92,246,0.25)'),
    board('qic-b1', 1360, 160, 'Research', '#8B5CF6'),
    board('qic-b2', 1360, 450, 'Inspiration', '#EC4899'),
    // Multilayer: pre-seeded interiors behind the hexagons
    ...researchInterior('qici-r', 'qic-b1-child'),
    ...inspirationInterior('qici-i', 'qic-b2-child'),
  ] as CanvasElement[],
  edges: [
    edge('qic-e1', 'qic-hub', 'qic-n1', 'sunset'),
    edge('qic-e2', 'qic-hub', 'qic-n2', 'rose'),
    edge('qic-e3', 'qic-n1', 'qic-evidence', 'violet'),
  ],
};

// ─── 2. Meaning Architecture Portals — ANCHOR + PORTAL CONTAINERS ────────────
// block → World / Story / Magic portal walls, each a row of pre-colored hexagon
// boards behind a gradient title.

const qmaStoryboardInt = storyboardInterior('qmai-sb', 'qma-sb1-child');

const meaningArchitecture: TemplateDefinition = {
  id: 'qs-meaning-architecture',
  name: 'World · Story · Magic',
  description: 'Meaning Architecture portals: hexagon walls for world, story, and magic',
  emoji: '🌐',
  category: 'experience',
  elements: [
    title('qma-title', 40, 40, 'Meaning Architecture', 'linear-gradient(90deg, #A78BFA, #22D3EE, #F472B6)'),
    caption('qma-cap', 40, 88, 'World, story, and magic each get a portal wall. Double-click a hexagon to step inside and fill that dimension.'),
    block('qma-hub', 'contextAndMeaning', 'Meaning Architecture', 40, 160),

    container('qma-world', 550, 160, 660, 400, 'World', 'emerald'),
    ...zoneHeader('qma-wh', 550, 160, 660, 'World', 'linear-gradient(90deg, #34D399, #22D3EE)', 'rgba(52,211,153,0.35)',
      'Environment, tools, demographics, and situations shaping the experience.', 'qma-world'),
    board('qma-wb1', 586, 300, 'Inspiration', '#EC4899', 'qma-world'),
    board('qma-wb2', 788, 300, 'Context', '#22D3EE', 'qma-world'),
    board('qma-wb3', 990, 300, 'Environment', '#34D399', 'qma-world'),

    container('qma-story', 550, 620, 660, 400, 'Story', 'ocean'),
    ...zoneHeader('qma-sh', 550, 620, 660, 'Story', 'linear-gradient(90deg, #22D3EE, #A78BFA)', 'rgba(34,211,238,0.35)',
      'Narrative beats, references, and the arc participants move through.', 'qma-story'),
    board('qma-sb1', 586, 760, 'Storyboard', '#8B5CF6', 'qma-story'),
    board('qma-sb2', 788, 760, 'Moodboard', '#60A5FA', 'qma-story'),
    board('qma-sb3', 990, 760, 'Research', '#6D28D9', 'qma-story'),

    container('qma-magic', 550, 1080, 460, 400, 'Magic', 'violet'),
    ...zoneHeader('qma-mh', 550, 1080, 460, 'Magic', 'linear-gradient(90deg, #C084FC, #F472B6)', 'rgba(192,132,252,0.35)',
      'The mechanism for transformation.', 'qma-magic'),
    board('qma-mb1', 586, 1220, 'Mechanics', '#A78BFA', 'qma-magic'),
    board('qma-mb2', 788, 1220, 'Rituals', '#F472B6', 'qma-magic'),
    // Multilayer: pre-seeded interiors behind key hexagons
    ...inspirationInterior('qmai-insp', 'qma-wb1-child'),
    ...qmaStoryboardInt.elements,
    ...moodboardInterior('qmai-mb', 'qma-sb2-child'),
    ...researchInterior('qmai-r', 'qma-sb3-child'),
  ] as CanvasElement[],
  edges: [
    edge('qma-e1', 'qma-hub', 'qma-world', 'emerald'),
    edge('qma-e2', 'qma-hub', 'qma-story', 'ocean'),
    edge('qma-e3', 'qma-hub', 'qma-magic', 'rose'),
    ...qmaStoryboardInt.edges,
  ],
};

// ─── 3. User Persona Engine — PROCESS RAIL + WORK ZONES ──────────────────────
// numbered step chain across the top, four tinted research zones (each seeded
// with one note), persona hexagon column past a divider as the output shelf.

export const stepStyle: ElementStyle = {
  bgColor: 'rgba(12,10,22,0.9)',
  borderColor: 'rgba(139,92,246,0.35)',
  borderWidth: 1,
  textColor: 'rgba(255,255,255,0.78)',
  fontSize: 13,
  textAlign: 'center',
};

const personaEngine: TemplateDefinition = {
  id: 'qs-persona-engine',
  name: 'User Persona Engine',
  description: 'Gather real signals in four zones, then distill them into persona boards',
  emoji: '👥',
  category: 'product-brand',
  elements: [
    title('qpe-title', 40, 40, 'User Personas', 'linear-gradient(90deg, #60A5FA, #34D399)'),
    caption('qpe-cap', 40, 88, 'Work left to right: gather real signals in the four zones, then distill them into persona boards. Double-click a persona to build it out.'),

    // Compact step chain (user-tuned: three small steps, first one wired down
    // into the Research zone).
    shape('qpe-s1', 40, 150, 160, 70, 'rectangle', '1 · Gather inputs', stepStyle),
    shape('qpe-s2', 240, 150, 160, 70, 'rectangle', '2 · Cluster signals', stepStyle),
    shape('qpe-s3', 440, 150, 160, 70, 'rectangle', '3 · Draft personas', stepStyle),

    container('qpe-z1', 40, 320, 620, 480, 'Research findings', 'ocean'),
    ...zoneHeader('qpe-z1h', 40, 320, 620, 'Research findings', 'linear-gradient(90deg, #60A5FA, #22D3EE)', 'rgba(96,165,250,0.35)',
      'Add research insights, quotes, or data that show who your users are.', 'qpe-z1'),
    note('qpe-z1n', 76, 450, 'Research Note', '💬', NOTE_TEAL, 'Drop one observation per note.', 'qpe-z1'),

    container('qpe-z2', 700, 320, 620, 480, 'User actions & pains', 'rose'),
    ...zoneHeader('qpe-z2h', 700, 320, 620, 'User actions & pains', 'linear-gradient(90deg, #F472B6, #FB7185)', 'rgba(244,114,182,0.35)',
      'Note what users do today, the challenges they face, and what frustrates them most.', 'qpe-z2'),
    note('qpe-z2n', 736, 450, 'Pain Point', '😖', NOTE_ROSE, 'One friction per note keeps clustering easy.', 'qpe-z2'),

    container('qpe-z3', 40, 840, 620, 480, 'Goals & motivations', 'emerald'),
    ...zoneHeader('qpe-z3h', 40, 840, 620, 'Goals & motivations', 'linear-gradient(90deg, #34D399, #22D3EE)', 'rgba(52,211,153,0.35)',
      'List what users want to achieve, what drives them, and what success means to them.', 'qpe-z3'),
    note('qpe-z3n', 76, 970, 'Goal', '🎯', NOTE_EMERALD, 'What outcome are they really after?', 'qpe-z3'),

    container('qpe-z4', 700, 840, 620, 480, 'More context', 'violet'),
    ...zoneHeader('qpe-z4h', 700, 840, 620, 'More context', 'linear-gradient(90deg, #A78BFA, #C084FC)', 'rgba(167,139,250,0.35)',
      'Environment, tools, demographics, or situations shaping the user’s experience.', 'qpe-z4'),
    note('qpe-z4n', 736, 970, 'Context Note', '🌍', NOTE_VIOLET, 'Where, when, and with what constraints?', 'qpe-z4'),

    divider('qpe-vdiv', 1400, 320, 1400, 1320, 'rgba(96,165,250,0.25)'),
    board('qpe-p1', 1460, 320, 'Persona A', '#F472B6'),
    board('qpe-p2', 1460, 610, 'Persona B', '#8B5CF6'),
    board('qpe-p3', 1460, 900, 'Persona C', '#22D3EE'),
    // Multilayer: each persona hexagon opens onto a ready persona sheet
    ...personaInterior('qpei-a', 'qpe-p1-child', 'Persona A'),
    ...personaInterior('qpei-b', 'qpe-p2-child', 'Persona B'),
    ...personaInterior('qpei-c', 'qpe-p3-child', 'Persona C'),
  ] as CanvasElement[],
  edges: [
    edge('qpe-e1', 'qpe-s1', 'qpe-s2', 'violet'),
    edge('qpe-e2', 'qpe-s2', 'qpe-s3', 'ocean'),
    edge('qpe-e3', 'qpe-s1', 'qpe-z1', 'ocean', 'bottom', 'top'),
  ],
};

// ─── 4. Storyboard Flow — BRANCHING RAIL ─────────────────────────────────────
// opening shot → hub circle → two parallel storyboard lanes → convergence
// diamond. Each branch takes its own gradient family (the exemplar look).

const storyboardFlow: TemplateDefinition = {
  id: 'qs-storyboard-flow',
  name: 'Storyboard Flow',
  description: 'One opening shot branches into two sequences and reconverges',
  emoji: '🎬',
  category: 'creative',
  elements: [
    title('qsf-title', 40, 40, 'Storyboard Flow', 'linear-gradient(90deg, #F472B6, #60A5FA)'),
    caption('qsf-cap', 40, 84, 'Upload stills into each frame and caption the beat. Write actions or transitions into the small connector cards.', 600),
    note('qsf-scenes', 40, 310, 'Scenes', '🎬', NOTE_VIOLET, 'List the beats you need to cover — one line per scene.'),
    storyboard('qsf-src', 360, 320),
    shape('qsf-hub', 760, 395, 100, 100, 'circle', '', {
      bgColor: 'linear-gradient(135deg, #24113D 0%, #3D1E66 100%)',
      borderColor: '#8B5CF6',
      borderWidth: 2,
    }),
    storyboard('qsf-a1', 940, 120),
    shape('qsf-ta', 1330, 190, 150, 110, 'rectangle', 'Transition', transitionStyle('linear-gradient(90deg, #60A5FA, #A78BFA)')),
    storyboard('qsf-a2', 1560, 120),
    storyboard('qsf-b1', 940, 520),
    shape('qsf-tb', 1330, 590, 150, 110, 'rectangle', 'Transition', transitionStyle('linear-gradient(90deg, #F97316, #F472B6)')),
    storyboard('qsf-b2', 1560, 520),
    shape('qsf-end', 1960, 375, 140, 140, 'rectangle', '', {
      bgColor: 'transparent',
      borderColor: 'linear-gradient(90deg, #A78BFA, #34D399)',
      borderWidth: 3,
      fillOpacity: 0,
    }),
    storyboard('qsf-final', 2180, 320),
  ] as CanvasElement[],
  edges: [
    edge('qsf-e1', 'qsf-src', 'qsf-hub', 'violet'),
    edge('qsf-e2', 'qsf-hub', 'qsf-a1', 'rose'),
    edge('qsf-e3', 'qsf-a1', 'qsf-ta', 'ocean'),
    edge('qsf-e4', 'qsf-ta', 'qsf-a2', 'ocean'),
    edge('qsf-e5', 'qsf-hub', 'qsf-b1', 'emerald'),
    edge('qsf-e6', 'qsf-b1', 'qsf-tb', 'sunset'),
    edge('qsf-e7', 'qsf-tb', 'qsf-b2', 'sunset'),
    edge('qsf-e8', 'qsf-a2', 'qsf-end', 'glacier'),
    edge('qsf-e9', 'qsf-b2', 'qsf-end', 'violet'),
    edge('qsf-e10', 'qsf-end', 'qsf-final', 'rose'),
  ],
};

export const QUICKSTART_TEMPLATES: TemplateDefinition[] = [
  intentionCore,
  meaningArchitecture,
  personaEngine,
  storyboardFlow,
];
