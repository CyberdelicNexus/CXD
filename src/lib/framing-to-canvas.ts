import type {
  CanvasElement,
  CanvasEdge,
  ExperienceBlockElement,
  ContainerElement,
  BoardElement,
  FreeformElement,
  TextElement,
  HypercubeFaceTag,
  InspectorSectionId,
  ElementStyle,
} from '@/types/canvas-elements';
import { SECTION_TO_FACE_TAG } from '@/types/canvas-elements';
import type { CXDProject, CXDSectionId } from '@/types/cxd-schema';
import {
  CXD_SECTIONS,
  REALITY_PLANES,
  SENSORY_DOMAINS,
  PRESENCE_TYPES,
  STATE_QUADRANTS,
  TRAIT_QUADRANTS,
} from '@/types/cxd-schema';

// ─── Layout ──────────────────────────────────────────────────────────
// Each answered section becomes a HUB — the same Experience-block card users
// drag from the right rail — radiating curved connectors to a small, PURPOSE-
// BUILT set of satellites: mini-boards for sub-collections the user will fill
// in (personas, sensory categories, enabled reality planes...) and reflection
// notes for the open question that section raises.
//
// Every size below is measured from the REAL rendered components, not
// assumed — the canvas enforces its own minimums regardless of what an
// element's stored width/height says, so laying out against wrong numbers
// causes real overlaps once the browser corrects them:
//   - A note card (FreeformElement, cardType 'note') always renders at
//     height:auto with a hard CSS floor of minHeight:300px, and a
//     ResizeObserver overwrites the stored height to match shortly after
//     mount (canvas-element.tsx). NOTE_H below reflects that floor + buffer.
//   - A board node's hex glyph is a fixed 128px graphic centered on the
//     element box, with a title+count label starting 72px below that
//     center — real footprint is taller/wider than a small stored box
//     allows, and nothing clips it. BOARD_W/BOARD_H below are sized to
//     actually contain the hex + label with room to breathe.
//   - An Experience-block hub's WIDTH is a hard 420px constant (matches
//     BLOCK_W exactly), but its HEIGHT is measured live from content and
//     can vary a lot by section (3 short fields vs. 4 longer ones). Rather
//     than guess it, every satellite is TOP-ALIGNED to the hub's y — only
//     hub.x/hub.y are ever relied on, both fully controlled at generation
//     time, so nothing here depends on predicting the hub's real height.
// Sections are placed in a flow-grid with generous fixed cells (not tightly
// packed, and with no boundary lines) so the layout can keep growing without
// limit, and a title + guidance caption sits above each hub.
//
// Most sections anchor the hub at the cell's left edge and radiate satellites
// to the right. Three sections (Human Context, State Mapping, Trait Mapping)
// instead CENTER the hub with satellites flanking it left and right — this
// pairs up naturally-related items (e.g. cognitive+somatic on one side,
// emotional+relational on the other) and avoids one long rightward row.
const BLOCK_W = 420;
const NOTE_W = 260;
const NOTE_H = 320; // real CSS floor is 300px; +20 buffer for connector clearance
const BOARD_W = 170;
const BOARD_H = 230; // hex (128px, centered) + label starting 72px below center + text
const SAT_GAP = 90; // hub → first satellite cluster, horizontal
const SAT_ROW_GAP = 40; // gap between stacked/grid satellite rows
const SAT_COL_GAP = 32; // gap between satellite columns within a grid
const TITLE_OFFSET_Y = 16; // title's y within its cell, from the cell's top
const CAPTION_OFFSET_Y = 58; // caption's y within its cell
const HUB_OFFSET_Y = 130; // hub's y within its cell — clears the two-line caption with room
const HEADER_W = 900; // width of the title/caption text elements
const CELL_W = 1700;
const CELL_H = 950;
const COLS = 3;

// Sections whose hub is centered with left/right flanking satellites instead
// of anchored at the cell's left edge with satellites only to the right.
const FLANKING_SECTIONS = new Set<CXDSectionId>(['humanContext', 'stateMapping', 'traitMapping']);

type ConnectorGradient = 'violet' | 'ocean' | 'emerald' | 'sunset' | 'rose' | 'glacier';

// CXDSectionId → ExperienceBlock componentKey (InspectorSectionId).
// Note the one rename: 'presence' (schema) → 'presenceTypes' (block).
// 'experienceFlow' has no block type, so it is intentionally omitted.
const SECTION_TO_COMPONENT_KEY: Partial<Record<CXDSectionId, InspectorSectionId>> = {
  intentionCore: 'intentionCore',
  desiredChange: 'desiredChange',
  humanContext: 'humanContext',
  contextAndMeaning: 'contextAndMeaning',
  realityPlanes: 'realityPlanes',
  sensoryDomains: 'sensoryDomains',
  presence: 'presenceTypes',
  stateMapping: 'stateMapping',
  traitMapping: 'traitMapping',
};

// Gradient title text per section (values drawn from the shared TEXT_GRADIENTS
// palette in canvas-elements.ts). A TextElement renders `style.bgColor` as a
// background-clip:text gradient when it's a linear-gradient string.
const SECTION_TITLE_GRADIENT: Partial<Record<CXDSectionId, string>> = {
  intentionCore: 'linear-gradient(90deg, #C084FC, #F472B6)',
  desiredChange: 'linear-gradient(90deg, #34D399, #22D3EE)',
  humanContext: 'linear-gradient(90deg, #60A5FA, #34D399)',
  contextAndMeaning: 'linear-gradient(90deg, #A78BFA, #22D3EE, #F472B6)',
  realityPlanes: 'linear-gradient(90deg, #6D28D9, #22D3EE)',
  sensoryDomains: 'linear-gradient(90deg, #F472B6, #60A5FA)',
  presence: 'linear-gradient(90deg, #22D3EE, #A78BFA)',
  stateMapping: 'linear-gradient(90deg, #10B981, #6366F1)',
  traitMapping: 'linear-gradient(90deg, #F97316, #C084FC)',
};

// Guidance caption per section: a conceptual action (what to add or explore)
// paired with a technical action (a specific thing to click, drag, or type
// on this canvas), so the cluster teaches its own next step.
const SECTION_CAPTION: Partial<Record<CXDSectionId, string>> = {
  intentionCore: 'Fill each note with what draws you in and what you are avoiding. Click a note and start typing to save it.',
  desiredChange: 'Add another note if one signal is not enough to capture success. Drag a Card from the toolbar and connect it to this block.',
  humanContext: 'Sketch a real person in each persona board, then link their pain points and opportunities. Double-click a board to step inside it.',
  contextAndMeaning: 'Capture the symbols and phrases that repeat through the experience. Drag in more notes and connect them for a fuller motif map.',
  realityPlanes: 'Each board is one layer you turned on. Double-click a board to plan how that layer actually gets delivered.',
  sensoryDomains: 'Every sense gets its own board, used or not. Open one and drag in reference notes or images for that sense.',
  presence: 'Six ways someone can be present, each with room to grow. Double-click a board to define what that presence looks like here.',
  stateMapping: 'Cognitive and somatic sit on the left, emotional and relational on the right. Type your trigger plan directly into each note.',
  traitMapping: 'The same four angles, now for what should last. Type how you will reinforce each trait directly into its note.',
};

const hasText = (s: string | undefined | null): boolean => !!s && s.trim().length > 0;

const containerStyle: ElementStyle = {
  borderColor: 'rgba(255,255,255,0.15)',
  borderWidth: 1,
  borderStyle: 'dashed',
  bgColor: 'rgba(255,255,255,0.03)',
};

// Hand-authored note gradients. No warm-amber preset exists in the shared
// PRESET_COLORS palette (it's all purple/blue/teal), so the two "polarity"
// notes below (incentive vs. antivision) are bespoke warm hex gradients.
const WARM_SUN = 'linear-gradient(135deg, #4A2E05 0%, #92400E 60%, #1a0f02 100%)';
const WARM_FIRE = 'linear-gradient(135deg, #450A0A 0%, #991B1B 60%, #1a0505 100%)';
const NOTE_TEAL = 'linear-gradient(135deg, #11202D 0%, #1E3E4D 100%)';
const NOTE_ROSE = 'linear-gradient(135deg, #3B0764 0%, #831843 100%)';
const NOTE_VIOLET = 'linear-gradient(135deg, #1A1230 0%, #2B1C52 100%)';
const NOTE_EMERALD = 'linear-gradient(135deg, #0F2230 0%, #0F3A3A 100%)';

const SENSORY_HEX: Record<string, string> = {
  visual: '#EC4899',
  auditory: '#8B5CF6',
  olfactory: '#22D3EE',
  gustatory: '#6366F1',
  haptic: '#F97316',
};
const PRESENCE_HEX = ['#22D3EE', '#F472B6', '#8B5CF6', '#34D399', '#F97316', '#60A5FA'];
const REALITY_HEX = ['#8B5CF6', '#22D3EE', '#F97316', '#EC4899', '#34D399', '#6366F1', '#F472B6'];

// ─── Element factories ───────────────────────────────────────────────

type Anchor = 'top' | 'right' | 'bottom' | 'left';

function makeEdge(
  fromId: string,
  toId: string,
  gradient: ConnectorGradient,
  fromAnchor: Anchor = 'right',
  toAnchor: Anchor = 'left'
): CanvasEdge {
  return {
    id: crypto.randomUUID(),
    fromNodeId: fromId,
    toNodeId: toId,
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

function makeNote(
  x: number,
  y: number,
  title: string,
  emoji: string,
  bgColor: string,
  tag: HypercubeFaceTag | undefined,
  body = ''
): FreeformElement {
  return {
    id: crypto.randomUUID(),
    type: 'freeform',
    cardType: 'note',
    noteTitle: title,
    noteBody: body,
    content: '',
    x,
    y,
    width: NOTE_W,
    height: NOTE_H,
    zIndex: 1,
    locked: false,
    boardId: null,
    surface: 'canvas',
    hypercubeTags: tag ? [tag] : undefined,
    emoji: emoji || undefined,
    style: { bgColor, textColor: '#ffffff' },
  };
}

function makeBoard(
  x: number,
  y: number,
  title: string,
  hex: string,
  tag: HypercubeFaceTag | undefined,
  containerId?: string
): BoardElement {
  return {
    id: crypto.randomUUID(),
    type: 'board',
    x,
    y,
    width: BOARD_W,
    height: BOARD_H,
    zIndex: 1,
    locked: false,
    containerId,
    boardId: null,
    surface: 'canvas',
    hypercubeTags: tag ? [tag] : undefined,
    childBoardId: crypto.randomUUID(),
    title,
    hexColor: hex,
  };
}

interface Hub {
  id: string;
  x: number;
  y: number;
  width: number;
}
interface Satellites {
  elements: CanvasElement[];
  edges: CanvasEdge[];
}

/**
 * A grid of mini-board nodes wrapped in a labeled container, one edge from
 * the hub. Top-aligned to the hub's y — container sizing is derived from the
 * REAL board footprint (BOARD_W/BOARD_H), so it always fully contains its
 * children with even padding (no cramped or oversized boxes).
 */
function boardGridSatellite(
  hub: Hub,
  label: string,
  items: { title: string; hex: string }[],
  tag: HypercubeFaceTag | undefined,
  tint: ContainerElement['tintColor'],
  gradient: ConnectorGradient,
  maxPerRow = 4
): Satellites {
  if (items.length === 0) return { elements: [], edges: [] };
  const cols = Math.min(maxPerRow, items.length);
  const rows = Math.ceil(items.length / cols);
  const padX = 36;
  const headerH = 64;
  const padBottom = 36;
  const containerW = cols * BOARD_W + (cols - 1) * SAT_COL_GAP + padX * 2;
  const containerH = headerH + rows * BOARD_H + (rows - 1) * SAT_ROW_GAP + padBottom;
  const containerX = hub.x + hub.width + SAT_GAP;
  const containerY = hub.y;

  const containerId = crypto.randomUUID();
  const container: ContainerElement = {
    id: containerId,
    type: 'container',
    x: containerX,
    y: containerY,
    width: containerW,
    height: containerH,
    zIndex: 0,
    locked: false,
    boardId: null,
    surface: 'canvas',
    hypercubeTags: tag ? [tag] : undefined,
    label,
    tintColor: tint,
    collapsed: false,
    style: containerStyle,
  };

  const boards = items.map((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return makeBoard(
      containerX + padX + col * (BOARD_W + SAT_COL_GAP),
      containerY + headerH + row * (BOARD_H + SAT_ROW_GAP),
      item.title,
      item.hex,
      tag,
      containerId
    );
  });

  return { elements: [container, ...boards], edges: [makeEdge(hub.id, containerId, gradient)] };
}

/**
 * Hub centered, with two flanking vertical stacks of notes — left and right,
 * generally two each — instead of one row extending only rightward. Lets
 * naturally-paired items sit on the same side (e.g. cognitive+somatic left,
 * emotional+relational right) and centers the whole cluster for easier
 * side-by-side comparison. The caller must offset the hub's own x by
 * `NOTE_W + SAT_GAP` within its cell so the left column has room (see
 * FLANKING_SECTIONS in the main generator).
 */
function flankingNoteSatellite(
  hub: Hub,
  left: { label: string }[],
  right: { label: string }[],
  promptText: string,
  colorLeft: string,
  colorRight: string,
  tag: HypercubeFaceTag | undefined,
  gradient: ConnectorGradient
): Satellites {
  const leftX = hub.x - SAT_GAP - NOTE_W;
  const rightX = hub.x + hub.width + SAT_GAP;
  const leftEls = left.map((q, i) =>
    makeNote(leftX, hub.y + i * (NOTE_H + SAT_ROW_GAP), q.label, '', colorLeft, tag, promptText)
  );
  const rightEls = right.map((q, i) =>
    makeNote(rightX, hub.y + i * (NOTE_H + SAT_ROW_GAP), q.label, '', colorRight, tag, promptText)
  );
  const edges = [
    ...leftEls.map((e) => makeEdge(hub.id, e.id, gradient, 'left', 'right')),
    ...rightEls.map((e) => makeEdge(hub.id, e.id, gradient, 'right', 'left')),
  ];
  return { elements: [...leftEls, ...rightEls], edges };
}

// ─── Per-section satellite recipes ────────────────────────────────────
// Bespoke per section — the satellite KIND changes to fit what that section's
// data actually needs: board collections for things you'll gather multiple
// of, reflection notes for the open question that section raises. All
// satellites are top-aligned to hub.y (see file header for why).

function intentionCoreSatellites(_project: CXDProject, hub: Hub, tag?: HypercubeFaceTag): Satellites {
  // Side by side, not stacked — two distinct polarity notes with real breathing room.
  const x1 = hub.x + hub.width + SAT_GAP;
  const x2 = x1 + NOTE_W + SAT_COL_GAP;
  const n1 = makeNote(x1, hub.y, 'Design Incentives', '☀️', WARM_SUN, tag);
  const n2 = makeNote(x2, hub.y, 'Antivision', '🔥', WARM_FIRE, tag);
  return { elements: [n1, n2], edges: [makeEdge(hub.id, n1.id, 'sunset'), makeEdge(hub.id, n2.id, 'sunset')] };
}

function desiredChangeSatellites(_project: CXDProject, hub: Hub, tag?: HypercubeFaceTag): Satellites {
  const x = hub.x + hub.width + SAT_GAP;
  const n = makeNote(
    x,
    hub.y,
    'Signals of Success',
    '📈',
    NOTE_EMERALD,
    tag,
    'How will you know this change actually happened?'
  );
  return { elements: [n], edges: [makeEdge(hub.id, n.id, 'emerald')] };
}

function humanContextSatellites(_project: CXDProject, hub: Hub, tag?: HypercubeFaceTag): Satellites {
  // Personas stacked on the right, reflection notes stacked on the left.
  // Notes are NOT wired to the hub — each is wired to its own persona, since
  // the pain points and opportunities belong to that person, not the section.
  const rightX = hub.x + hub.width + SAT_GAP;
  const b1 = makeBoard(rightX, hub.y, 'Persona 1', '#8B5CF6', tag);
  const b2 = makeBoard(rightX, hub.y + BOARD_H + SAT_ROW_GAP, 'Persona 2', '#22D3EE', tag);

  const leftX = hub.x - SAT_GAP - NOTE_W;
  const n1 = makeNote(leftX, hub.y, 'Core Pain Points', '💢', NOTE_ROSE, tag);
  const n2 = makeNote(leftX, hub.y + NOTE_H + SAT_ROW_GAP, 'Opportunities', '💡', NOTE_EMERALD, tag);

  return {
    elements: [b1, b2, n1, n2],
    edges: [
      makeEdge(hub.id, b1.id, 'ocean', 'right', 'left'),
      makeEdge(hub.id, b2.id, 'ocean', 'right', 'left'),
      makeEdge(b1.id, n1.id, 'rose', 'left', 'right'),
      makeEdge(b2.id, n2.id, 'emerald', 'left', 'right'),
    ],
  };
}

function meaningSatellites(_project: CXDProject, hub: Hub, tag?: HypercubeFaceTag): Satellites {
  const x = hub.x + hub.width + SAT_GAP;
  const n = makeNote(
    x,
    hub.y,
    'Narrative Motifs',
    '🎭',
    NOTE_VIOLET,
    tag,
    'Recurring symbols, phrases, or images to weave through the experience.'
  );
  return { elements: [n], edges: [makeEdge(hub.id, n.id, 'violet')] };
}

function realityPlanesSatellites(project: CXDProject, hub: Hub, tag?: HypercubeFaceTag): Satellites {
  const enabled = (project.realityPlanesV2 || []).filter((p) => p.enabled);
  const items = enabled.map((p, i) => {
    const meta = REALITY_PLANES.find((r) => r.code === p.code);
    return { title: meta?.label || p.code, hex: REALITY_HEX[i % REALITY_HEX.length] };
  });
  return boardGridSatellite(hub, 'Reality Layers', items, tag, 'ocean', 'ocean', 4);
}

function sensoryDomainsSatellites(_project: CXDProject, hub: Hub, tag?: HypercubeFaceTag): Satellites {
  const items = SENSORY_DOMAINS.map((s) => ({ title: s.label, hex: SENSORY_HEX[s.code] }));
  return boardGridSatellite(hub, 'Sensory Affordances', items, tag, 'rose', 'rose', 5);
}

function presenceSatellites(_project: CXDProject, hub: Hub, tag?: HypercubeFaceTag): Satellites {
  const items = PRESENCE_TYPES.map((p, i) => ({ title: p.label, hex: PRESENCE_HEX[i % PRESENCE_HEX.length] }));
  return boardGridSatellite(hub, 'Presence Practices', items, tag, 'violet', 'violet', 3);
}

function stateMappingSatellites(_project: CXDProject, hub: Hub, tag?: HypercubeFaceTag): Satellites {
  const byCode = (code: string) => STATE_QUADRANTS.find((q) => q.code === code)!;
  const left = [byCode('cognitive'), byCode('somatic')];
  const right = [byCode('emotional'), byCode('relational')];
  return flankingNoteSatellite(
    hub,
    left,
    right,
    'Breakdown how you plan to trigger this state',
    NOTE_TEAL,
    NOTE_VIOLET,
    tag,
    'emerald'
  );
}

function traitMappingSatellites(_project: CXDProject, hub: Hub, tag?: HypercubeFaceTag): Satellites {
  const byCode = (code: string) => TRAIT_QUADRANTS.find((q) => q.code === code)!;
  const left = [byCode('cognitive'), byCode('somatic')];
  const right = [byCode('emotional'), byCode('relational')];
  return flankingNoteSatellite(
    hub,
    left,
    right,
    'Breakdown how you plan to reinforce this trait',
    NOTE_VIOLET,
    NOTE_ROSE,
    tag,
    'rose'
  );
}

const SATELLITE_RECIPES: Partial<
  Record<CXDSectionId, (project: CXDProject, hub: Hub, tag?: HypercubeFaceTag) => Satellites>
> = {
  intentionCore: intentionCoreSatellites,
  desiredChange: desiredChangeSatellites,
  humanContext: humanContextSatellites,
  contextAndMeaning: meaningSatellites,
  realityPlanes: realityPlanesSatellites,
  sensoryDomains: sensoryDomainsSatellites,
  presence: presenceSatellites,
  stateMapping: stateMappingSatellites,
  traitMapping: traitMappingSatellites,
};

// ─── Section header (gradient title + guidance caption) ──────────────

function sectionHeader(cellX: number, cellY: number, sectionId: CXDSectionId): TextElement[] {
  const section = CXD_SECTIONS.find((s) => s.id === sectionId);
  const gradient = SECTION_TITLE_GRADIENT[sectionId];
  const caption = SECTION_CAPTION[sectionId];
  const elements: TextElement[] = [];

  if (section && gradient) {
    elements.push({
      id: crypto.randomUUID(),
      type: 'text',
      x: cellX,
      y: cellY + TITLE_OFFSET_Y,
      width: HEADER_W,
      height: 40,
      zIndex: 2,
      locked: false,
      boardId: null,
      surface: 'canvas',
      content: section.label,
      style: { bgColor: gradient, fontSize: 26, fontWeight: 'bold' },
      textAlign: 'left',
    });
  }
  if (caption) {
    elements.push({
      id: crypto.randomUUID(),
      type: 'text',
      x: cellX,
      y: cellY + CAPTION_OFFSET_Y,
      width: HEADER_W,
      height: 40, // two lines: a conceptual action + a technical one
      zIndex: 2,
      locked: false,
      boardId: null,
      surface: 'canvas',
      content: caption,
      style: { fontSize: 13, fontWeight: 'normal', fontStyle: 'italic', textColor: 'rgba(255,255,255,0.5)' },
      textAlign: 'left',
    });
  }
  return elements;
}

// ─── Content detection (does the user's framing touch this section?) ───

function sectionHasContent(project: CXDProject, sectionId: CXDSectionId): boolean {
  switch (sectionId) {
    case 'intentionCore': {
      const { mainConcept, coreMessage } = project.intentionCore;
      // projectName defaults to the project name, so it alone doesn't count.
      return hasText(mainConcept) || hasText(coreMessage);
    }
    case 'desiredChange': {
      const d = project.desiredChange;
      return hasText(d.insights) || hasText(d.feelings) || hasText(d.states) || hasText(d.knowledge);
    }
    case 'humanContext': {
      const h = project.humanContext;
      return hasText(h.audienceNeeds) || hasText(h.audienceDesires) || hasText(h.userRole);
    }
    case 'contextAndMeaning': {
      const c = project.contextAndMeaning;
      return hasText(c.world) || hasText(c.story) || hasText(c.magic);
    }
    case 'realityPlanes': {
      if (project.realityPlanesV2 && project.realityPlanesV2.length > 0) {
        return project.realityPlanesV2.some((p) => p.enabled);
      }
      return REALITY_PLANES.some((r) => (project.realityPlanes[r.code] ?? 0) > 0);
    }
    case 'sensoryDomains':
      return SENSORY_DOMAINS.some((s) => (project.sensoryDomains[s.code] ?? 0) > 0);
    case 'presence':
      return PRESENCE_TYPES.some((p) => (project.presenceTypes[p.code] ?? 0) > 0);
    case 'stateMapping':
      return STATE_QUADRANTS.some((q) => hasText(project.stateMapping[q.code]));
    case 'traitMapping':
      return TRAIT_QUADRANTS.some((q) => hasText(project.traitMapping[q.code]));
    default:
      return false;
  }
}

// ─── Generator ───────────────────────────────────────────────────────

export interface FramingCanvasResult {
  elements: CanvasElement[];
  edges: CanvasEdge[];
}

/**
 * Convert the framing wizard's answers into a node graph: one Experience-
 * block hub per answered section (the same rich, editable card users drag
 * from the right rail), each radiating curved connectors to a small,
 * section-specific set of satellites — mini-boards for sub-collections to
 * fill in, reflection notes for the open question that section raises —
 * under a gradient title and a two-part guidance caption (a conceptual
 * action plus a concrete technical one).
 *
 * Sections are placed in a flow-grid (fixed generous cells sized from the
 * REAL rendered footprint of every element type — see file header) so no
 * section's cluster can ever collide with a neighbor, nothing is cramped
 * or stacked tight regardless of content length, and there are no boundary
 * lines capping how far the layout can keep growing.
 *
 * Returns `{ elements, edges }` — elements go through addCanvasElements,
 * edges through addCanvasEdges (both batched, freeze-proof paths). Returns
 * empty arrays when no section has content.
 *
 * @param origin top-left offset for the whole layout (placed clear of any
 *               pre-existing canvas content by framingInsertionOrigin)
 */
export function framingToCanvas(
  project: CXDProject,
  origin: { x: number; y: number } = { x: 0, y: 0 }
): FramingCanvasResult {
  const allElements: CanvasElement[] = [];
  const allEdges: CanvasEdge[] = [];
  let cellIndex = 0;

  for (const section of CXD_SECTIONS) {
    const componentKey = SECTION_TO_COMPONENT_KEY[section.id];
    if (!componentKey) continue; // no block type for this section (e.g. experienceFlow)
    if (!sectionHasContent(project, section.id)) continue;

    const tag: HypercubeFaceTag | undefined = SECTION_TO_FACE_TAG[section.id];
    const col = cellIndex % COLS;
    const row = Math.floor(cellIndex / COLS);
    cellIndex++;

    const cellX = origin.x + col * CELL_W;
    const cellY = origin.y + row * CELL_H;
    // Flanking sections center the hub with room for a left column of
    // satellites; everyone else anchors the hub at the cell's left edge.
    const hubX = FLANKING_SECTIONS.has(section.id) ? cellX + NOTE_W + SAT_GAP : cellX;
    const hubY = cellY + HUB_OFFSET_Y;
    const hubId = crypto.randomUUID();

    allElements.push(...sectionHeader(cellX, cellY, section.id));

    const hub: ExperienceBlockElement = {
      id: hubId,
      type: 'experienceBlock',
      componentKey,
      title: section.label,
      x: hubX,
      y: hubY,
      width: BLOCK_W,
      height: 360, // nominal — ExperienceBlockCard measures real content height on mount
      zIndex: 1,
      viewMode: 'inline',
      locked: false,
      boardId: null,
      surface: 'canvas',
      hypercubeTags: tag ? [tag] : undefined,
    };
    allElements.push(hub);

    const recipe = SATELLITE_RECIPES[section.id];
    if (recipe) {
      const { elements, edges } = recipe(project, { id: hubId, x: hubX, y: hubY, width: BLOCK_W }, tag);
      allElements.push(...elements);
      allEdges.push(...edges);
    }
  }

  return { elements: allElements, edges: allEdges };
}

/**
 * Summarize the framing answers as a prompt for AI features that draft
 * content from the framing (e.g. a chat "draft this section" action).
 */
export function framingSummaryPrompt(project: CXDProject): string {
  const lines: string[] = [];
  const push = (label: string, value: string | undefined | null) => {
    if (hasText(value)) lines.push(`${label}: ${value!.trim()}`);
  };

  push('Project', project.intentionCore.projectName || project.name);
  push('Main concept', project.intentionCore.mainConcept);
  push('Core message', project.intentionCore.coreMessage);
  push('Desired insights', project.desiredChange.insights);
  push('Desired feelings', project.desiredChange.feelings);
  push('Desired states', project.desiredChange.states);
  push('Knowledge to impart', project.desiredChange.knowledge);
  push('Audience needs', project.humanContext.audienceNeeds);
  push('Audience desires', project.humanContext.audienceDesires);
  push('Participant role', project.humanContext.userRole);
  push('World', project.contextAndMeaning.world);
  push('Story', project.contextAndMeaning.story);
  push('Magic mechanism', project.contextAndMeaning.magic);

  const planes = (project.realityPlanesV2 || [])
    .filter((p) => p.enabled)
    .map((p) => p.code)
    .join(', ');
  if (planes) lines.push(`Reality planes: ${planes}`);

  return (
    'Draft a working canvas for this experience design based on its framing. ' +
    'Create a container per major theme with concrete, specific starter content ' +
    'drawn from the framing (not generic placeholders):\n\n' +
    lines.join('\n')
  );
}

/**
 * Bounding box of existing (placed, root-level) canvas elements, so the
 * framing layout can be inserted clear of user content.
 */
export function framingInsertionOrigin(project: CXDProject): { x: number; y: number } {
  const existing = (project.canvasLayout?.elements || []).filter(
    (el) => !el.inInbox && !el.boardId && el.surface !== 'hypercube'
  );
  if (existing.length === 0) return { x: 0, y: 120 };
  const maxX = Math.max(...existing.map((el) => el.x + (el.width || 0)));
  const minY = Math.min(...existing.map((el) => el.y));
  return { x: maxX + 240, y: Math.max(minY, 120) };
}

/**
 * Bounding box of a set of elements (world coordinates), used to auto-fit
 * the canvas viewport onto newly generated content right after insertion.
 */
export function elementsBoundingBox(
  elements: CanvasElement[]
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const sizeable = elements.filter((el) => el.type !== 'line' && el.width > 0 && el.height > 0);
  if (sizeable.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of sizeable) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }
  return { minX, minY, maxX, maxY };
}
