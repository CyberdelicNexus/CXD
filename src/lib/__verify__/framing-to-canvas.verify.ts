/**
 * Verification for framingToCanvas (hub + satellite node-graph output).
 * Run: npx tsx src/lib/__verify__/framing-to-canvas.verify.ts
 *
 * Asserts: one Experience-block hub per answered section with a gradient
 * title + two-part guidance caption above it (no em-dashes), a section-
 * specific satellite cluster (boards / reflection notes, never stacked
 * tight, real component minimums respected), flanking sections centered
 * with left/right columns, no divider lines, every edge references real
 * element ids, NO overlaps anywhere (worst-case content), empty sections
 * skipped.
 */
import { framingToCanvas, framingInsertionOrigin, elementsBoundingBox } from '../framing-to-canvas';
import { createDefaultProject } from '@/types/cxd-schema';
import { SECTION_TO_FACE_TAG } from '@/types/canvas-elements';
import type {
  CanvasElement,
  CanvasEdge,
  ExperienceBlockElement,
  BoardElement,
  FreeformElement,
  ContainerElement,
  TextElement,
} from '@/types/canvas-elements';

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) { failures++; console.error(`  ✗ ${msg}`); }
  else console.log(`  ✓ ${msg}`);
}
function overlaps(a: CanvasElement, b: CanvasElement): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
function isContainment(a: CanvasElement, b: CanvasElement): boolean {
  const aId = 'containerId' in a ? (a as { containerId?: string }).containerId : undefined;
  const bId = 'containerId' in b ? (b as { containerId?: string }).containerId : undefined;
  return aId === b.id || bId === a.id;
}
// The REAL rendered minimums the browser enforces regardless of stored size
// (see canvas-element.tsx) — the overlap check must use these, not the
// generator's stored width/height, or it would pass while production overlaps.
function realBounds(el: CanvasElement): CanvasElement {
  if (el.type === 'freeform' && el.cardType === 'note') {
    return { ...el, height: Math.max(el.height, 300), width: Math.max(el.width, 200) };
  }
  return el;
}
function checkNoUnintendedOverlaps(elements: CanvasElement[], label: string) {
  // Text (titles/captions) is decorative/zero-footprint by design and
  // legitimately sits near or across other elements' bounds.
  const boxed = elements.filter((e) => e.type !== 'text').map(realBounds);
  let bad = 0;
  for (let i = 0; i < boxed.length; i++) {
    for (let j = i + 1; j < boxed.length; j++) {
      const a = boxed[i], b = boxed[j];
      if (isContainment(a, b)) continue;
      if (overlaps(a, b)) {
        bad++;
        const at = 'title' in a ? a.title : 'noteTitle' in a ? a.noteTitle : a.id;
        const bt = 'title' in b ? b.title : 'noteTitle' in b ? b.noteTitle : b.id;
        console.error(`    overlap: "${at}" (${a.type}) vs "${bt}" (${b.type})`);
      }
    }
  }
  check(bad === 0, `${label}: no overlaps using REAL rendered minimums (${boxed.length} boxed elements)`);
}
function checkEdgeIntegrity(elements: CanvasElement[], edges: CanvasEdge[], label: string) {
  const ids = new Set(elements.map((e) => e.id));
  const bad = edges.filter((e) => !ids.has(e.fromNodeId) || !ids.has(e.toNodeId));
  check(bad.length === 0, `${label}: every edge references a real element (${edges.length} edges)`);
}

// ── Fully answered project (worst case: all 7 reality planes enabled) ──
const project = createDefaultProject('p1', 'Cyberdelic Retreat', 'owner1');
project.intentionCore = { projectName: 'Cyberdelic Retreat', mainConcept: 'A liminal reset', coreMessage: 'Return changed' };
project.desiredChange = { insights: 'x', feelings: 'y', states: 'z', knowledge: 'w' };
project.humanContext = { audienceNeeds: 'a', audienceDesires: 'b', userRole: 'c' };
project.contextAndMeaning = { world: 'w', story: 's', magic: 'm' };
project.realityPlanesV2 = project.realityPlanesV2!.map((p) => ({ ...p, enabled: true }));
project.sensoryDomains = { visual: 80, auditory: 70, olfactory: 30, gustatory: 20, haptic: 60 };
project.presenceTypes = { mental: 70, emotional: 90, social: 50, embodied: 60, environmental: 40, active: 30 };
project.stateMapping = { cognitive: 'a', emotional: 'b', somatic: 'c', relational: 'd' };
project.traitMapping = { cognitive: 'a', emotional: 'b', somatic: 'c', relational: 'd' };

console.log('Fully answered project:');
const graph = framingToCanvas(project);
const hubs = graph.elements.filter((e): e is ExperienceBlockElement => e.type === 'experienceBlock');
const boards = graph.elements.filter((e): e is BoardElement => e.type === 'board');
const notes = graph.elements.filter((e): e is FreeformElement => e.type === 'freeform');
const containers = graph.elements.filter((e): e is ContainerElement => e.type === 'container');
const texts = graph.elements.filter((e): e is TextElement => e.type === 'text');

check(hubs.length === 9, `9 hubs, one per answered block-capable section (got ${hubs.length})`);
check(hubs.every((b) => b.width === 420), 'hubs use the standard 420-wide inline card');
check(new Set(hubs.map((b) => b.componentKey)).size === hubs.length, 'hub componentKeys unique');
check(!hubs.some((b) => (b.componentKey as string) === 'experienceFlow'), 'experienceFlow (no block type) skipped');

// No divider lines at all
check(graph.elements.every((e) => e.type !== 'line'), 'no divider lines (removed — they capped growth)');

// Titles + captions: 2 text elements per hub (title, caption); no em-dashes anywhere
check(texts.length === hubs.length * 2, `one gradient title + one caption per hub (got ${texts.length} text elements for ${hubs.length} hubs)`);
check(texts.filter((t) => t.style?.fontSize === 26).every((t) => (t.style?.bgColor || '').startsWith('linear-gradient')), 'every title uses a gradient bgColor (rendered as gradient text)');
check(!texts.some((t) => t.content.includes('—')), 'no em-dashes in any generated text');
const captions = texts.filter((t) => t.style?.fontStyle === 'italic');
check(captions.length === hubs.length, `one caption per hub (got ${captions.length})`);
check(captions.every((c) => (c.content.match(/\./g) || []).length >= 2), 'every caption has two sentences (conceptual action + technical action)');

// Satellite shape per section — side-by-side, not stacked
check(notes.some((n) => n.noteTitle === 'Design Incentives') && notes.some((n) => n.noteTitle === 'Antivision'), 'Intention Core → Design Incentives + Antivision notes');
const incentives = notes.find((n) => n.noteTitle === 'Design Incentives')!;
const antivision = notes.find((n) => n.noteTitle === 'Antivision')!;
check(incentives.y === antivision.y && incentives.x !== antivision.x, 'Intention Core notes are side-by-side (same y), not stacked');

// Human Context: hub centered, personas stacked RIGHT, notes stacked LEFT, notes linked to persona not hub
const humanHub = hubs.find((h) => h.componentKey === 'humanContext')!;
const p1 = boards.find((b) => b.title === 'Persona 1')!;
const p2 = boards.find((b) => b.title === 'Persona 2')!;
const painPoints = notes.find((n) => n.noteTitle === 'Core Pain Points')!;
const opportunities = notes.find((n) => n.noteTitle === 'Opportunities')!;
check(p1.x > humanHub.x + humanHub.width && p2.x > humanHub.x + humanHub.width, 'Human Context personas sit to the RIGHT of the hub');
check(painPoints.x + painPoints.width <= humanHub.x && opportunities.x + opportunities.width <= humanHub.x, 'Human Context notes sit to the LEFT of the hub');
check(p1.x === p2.x && p1.y !== p2.y, 'personas are stacked vertically (same x, different y)');
check(painPoints.x === opportunities.x && painPoints.y !== opportunities.y, 'notes are stacked vertically (same x, different y)');
const humanEdges = graph.edges.filter((e) => e.fromNodeId === humanHub.id || e.toNodeId === humanHub.id || [p1.id, p2.id].includes(e.fromNodeId));
check(!humanEdges.some((e) => e.fromNodeId === humanHub.id && (e.toNodeId === painPoints.id || e.toNodeId === opportunities.id)), 'notes are NOT wired to the hub');
check(
  graph.edges.some((e) => e.fromNodeId === p1.id && e.toNodeId === painPoints.id) &&
  graph.edges.some((e) => e.fromNodeId === p2.id && e.toNodeId === opportunities.id),
  'each note is wired to its own persona instead'
);

// Reality/Sensory/Presence board grids unchanged in shape
check(containers.some((c) => c.label === 'Reality Layers'), 'Reality Planes → "Reality Layers" container');
const realityContainer = containers.find((c) => c.label === 'Reality Layers')!;
const realityBoards = boards.filter((b) => b.containerId === realityContainer.id);
check(realityBoards.length === 7, 'Reality Layers holds a board per ENABLED plane (7)');
check(
  realityBoards.every((b) => b.x >= realityContainer.x && b.y >= realityContainer.y &&
    b.x + b.width <= realityContainer.x + realityContainer.width &&
    b.y + b.height <= realityContainer.y + realityContainer.height),
  'every Reality Layers board fits fully inside its container'
);
check(containers.some((c) => c.label === 'Sensory Affordances'), 'Sensory Domains → "Sensory Affordances" container');
check(boards.filter((b) => b.containerId === containers.find((c) => c.label === 'Sensory Affordances')!.id).length === 5, 'Sensory Affordances holds all 5 domain boards');
check(containers.some((c) => c.label === 'Presence Practices'), 'Presence → "Presence Practices" container');
check(boards.filter((b) => b.containerId === containers.find((c) => c.label === 'Presence Practices')!.id).length === 6, 'Presence Practices holds all 6 type boards');

// State/Trait Mapping: hub centered, cognitive+somatic LEFT, emotional+relational RIGHT
const stateHub = hubs.find((h) => h.componentKey === 'stateMapping')!;
const stateNotes = notes.filter((n) => n.noteBody === 'Breakdown how you plan to trigger this state');
check(stateNotes.length === 4, `State Mapping → 4 quadrant prompt notes (got ${stateNotes.length})`);
const stateCognitive = stateNotes.find((n) => n.noteTitle === 'Cognitive')!;
const stateSomatic = stateNotes.find((n) => n.noteTitle === 'Somatic')!;
const stateEmotional = stateNotes.find((n) => n.noteTitle === 'Emotional')!;
const stateRelational = stateNotes.find((n) => n.noteTitle === 'Relational')!;
check(!!stateCognitive && !!stateSomatic && !!stateEmotional && !!stateRelational, 'all 4 state quadrants present by label');
check(
  stateCognitive.x + stateCognitive.width <= stateHub.x && stateSomatic.x + stateSomatic.width <= stateHub.x,
  'State Mapping: Cognitive + Somatic sit to the LEFT of the hub'
);
check(
  stateEmotional.x >= stateHub.x + stateHub.width && stateRelational.x >= stateHub.x + stateHub.width,
  'State Mapping: Emotional + Relational sit to the RIGHT of the hub'
);
check(stateCognitive.x === stateSomatic.x && stateCognitive.y !== stateSomatic.y, 'left column stacked vertically');
check(stateEmotional.x === stateRelational.x && stateEmotional.y !== stateRelational.y, 'right column stacked vertically');

const traitNotes = notes.filter((n) => n.noteBody === 'Breakdown how you plan to reinforce this trait');
check(traitNotes.length === 4, `Trait Mapping → 4 quadrant prompt notes (got ${traitNotes.length})`);

// Every board has a childBoardId + hex (real navigable mini-board)
check(boards.every((b) => !!b.childBoardId), 'every board satellite has a childBoardId');
check(boards.every((b) => !!b.hexColor), 'every board satellite has a hex color');
check(boards.every((b) => b.width === 170 && b.height === 230), 'boards sized to the real hex+label footprint (170x230)');
check(notes.every((n) => n.width === 260 && n.height >= 320), 'notes sized to at least the real 300px floor + buffer');

// Tags follow SECTION_TO_FACE_TAG — satellites inherit their hub's face tag
const coreHub = hubs.find((b) => b.componentKey === 'intentionCore');
check(coreHub?.hypercubeTags?.[0] === SECTION_TO_FACE_TAG.intentionCore, 'intentionCore hub tagged Core');
check(antivision.hypercubeTags?.[0] === SECTION_TO_FACE_TAG.intentionCore, 'Antivision satellite inherits Core tag');

check(graph.elements.every((e) => e.boardId === null && e.surface === 'canvas'), 'all elements root-level canvas surface');
check(new Set(graph.elements.map((e) => e.id)).size === graph.elements.length, 'element ids unique');
check(new Set(graph.edges.map((e) => e.id)).size === graph.edges.length, 'edge ids unique');

checkEdgeIntegrity(graph.elements, graph.edges, 'Fully answered');
checkNoUnintendedOverlaps(graph.elements, 'Fully answered');

// ── Default (untouched) project ──
console.log('Default (untouched) project:');
const fresh = createDefaultProject('p2', 'Fresh', 'owner1');
const freshGraph = framingToCanvas(fresh);
const freshHubs = freshGraph.elements.filter((e): e is ExperienceBlockElement => e.type === 'experienceBlock');
check(
  freshHubs.map((h) => h.componentKey).sort().join(',') === ['presenceTypes', 'realityPlanes', 'sensoryDomains'].sort().join(','),
  `default project renders only numeric-default sections (got ${freshHubs.map((h) => h.componentKey).join(', ')})`
);
checkEdgeIntegrity(freshGraph.elements, freshGraph.edges, 'Default project');
checkNoUnintendedOverlaps(freshGraph.elements, 'Default project');

// ── Insertion origin (unchanged behavior) ──
console.log('Insertion origin:');
check(framingInsertionOrigin(fresh).x === 0, 'empty canvas → origin x 0');
fresh.canvasLayout!.elements = [
  { id: 'x1', type: 'text', x: 100, y: 50, width: 300, height: 40, zIndex: 1, content: 'existing' } as CanvasElement,
];
check(framingInsertionOrigin(fresh).x === 640, 'busy canvas → origin right of content');

// ── Bounding box for viewport auto-fit ──
console.log('Bounding box (viewport auto-fit):');
const bbox = elementsBoundingBox(graph.elements);
check(bbox !== null, 'bounding box computed for a populated graph');
check(elementsBoundingBox([]) === null, 'bounding box is null for an empty set');
if (bbox) {
  check(bbox.maxX > bbox.minX && bbox.maxY > bbox.minY, 'bounding box has positive extent');
  check(hubs.every((h) => h.x >= bbox.minX && h.x <= bbox.maxX), 'bounding box contains every hub');
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
