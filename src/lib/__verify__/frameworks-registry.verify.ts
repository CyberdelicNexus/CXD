// Run: npx tsx src/lib/__verify__/frameworks-registry.verify.ts
// The frameworks library end to end: every framework template carries a full
// explainer, its canvas step cards mirror the explainer's steps, the brief is
// the right size, the layout is sound, and gating/composer rules hold.
import {
  TEMPLATES, FREE_TEMPLATE_IDS, COMPOSER_TEMPLATES, FRAMEWORK_STAGES,
  getFrameworkTemplate, getFrameworkBrief, frameworkTemplatesByStage,
  instantiateTemplate, offsetTemplateElements, templateBounds, templateInsertOffset, templateInsertSurface,
} from '../templates';
import { FRAMEWORK_TEMPLATES, FREE_FRAMEWORK_IDS } from '../templates-frameworks';
import { getActiveFrameworksBlock, MAX_ACTIVE_FRAMEWORK_BRIEFS } from '../ai/system-prompts';
import { checkLayout } from '../canvas-layout-rules';
import { resolveEdgePoints } from '../maps/connector-geometry';
import type { CanvasElement, LineElement } from '../../types/canvas-elements';

const EXPECTED_IDS = [
  'fw-iceberg', 'fw-causal-loop', 'fw-theory-of-change',
  'fw-hmw-crazy8', 'fw-scamper',
  'fw-impact-effort', 'fw-premortem',
  'fw-workback',
  'fw-audience-fit', 'fw-narrative-arc',
  'fw-aarrr',
  'fw-ecosystem-map',
];

let failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
};
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

console.log('Registry');
check('12 framework templates registered', FRAMEWORK_TEMPLATES.length === 12, `got ${FRAMEWORK_TEMPLATES.length}`);
for (const id of EXPECTED_IDS) {
  check(`${id} present`, FRAMEWORK_TEMPLATES.some((t) => t.id === id));
}
check('all framework ids start with fw-', FRAMEWORK_TEMPLATES.every((t) => t.id.startsWith('fw-')));
check('every framework is in TEMPLATES', FRAMEWORK_TEMPLATES.every((t) => TEMPLATES.some((x) => x.id === t.id)));
check('only frameworks carry framework meta', TEMPLATES.every((t) => (t.category === 'framework') === !!t.framework));
check('stage grouping covers every framework once',
  frameworkTemplatesByStage().reduce((n, g) => n + g.templates.length, 0) === FRAMEWORK_TEMPLATES.length);
check('stage grouping order follows FRAMEWORK_STAGES',
  frameworkTemplatesByStage().every((g, i, arr) => i === 0 || FRAMEWORK_STAGES.indexOf(arr[i - 1].stage) < FRAMEWORK_STAGES.indexOf(g.stage)));

console.log('Gating & composer');
check('three free frameworks', FREE_FRAMEWORK_IDS.length === 3);
check('free frameworks are in FREE_TEMPLATE_IDS', FREE_FRAMEWORK_IDS.every((id) => FREE_TEMPLATE_IDS.has(id)));
check('free frameworks exist', FREE_FRAMEWORK_IDS.every((id) => getFrameworkTemplate(id)));
check('composer catalog has no frameworks', COMPOSER_TEMPLATES.every((t) => t.category !== 'framework'));
check('composer catalog keeps every non-framework', COMPOSER_TEMPLATES.length === TEMPLATES.length - FRAMEWORK_TEMPLATES.length);
check('getFrameworkTemplate rejects non-frameworks', getFrameworkTemplate('lean-canvas') === undefined);
check('getFrameworkBrief unknown id is undefined', getFrameworkBrief('nope') === undefined);

for (const t of FRAMEWORK_TEMPLATES) {
  console.log(`\n${t.id} · ${t.name}`);
  const fw = t.framework;
  if (!fw) { check('has framework meta', false); continue; }
  check('stage valid', FRAMEWORK_STAGES.includes(fw.stage));
  check('origin present', fw.origin.trim().length > 0);
  const sentences = (fw.whatItIs.match(/[.!?](\s|$)/g) ?? []).length;
  check('whatItIs 2–3 sentences', sentences >= 2 && sentences <= 3, `got ${sentences}`);
  check('whenToUse 3–4 bullets', fw.whenToUse.length >= 3 && fw.whenToUse.length <= 4, `got ${fw.whenToUse.length}`);
  check('steps 4–7', fw.steps.length >= 4 && fw.steps.length <= 7, `got ${fw.steps.length}`);
  check('pitfalls 2–4', fw.pitfalls.length >= 2 && fw.pitfalls.length <= 4, `got ${fw.pitfalls.length}`);
  const w = words(fw.assistantBrief);
  check('assistantBrief 80–220 words', w >= 80 && w <= 220, `got ${w}`);
  check('getFrameworkBrief returns the brief', getFrameworkBrief(t.id) === fw.assistantBrief);

  // Step cards: shapes whose content is "N · Title", in order, one per step.
  const stepCards = t.elements
    .filter((el) => el.type === 'shape' && /^\d+ · /.test((el as { content?: string }).content ?? ''))
    .map((el) => (el as { content: string }).content)
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  check('one step card per step', stepCards.length === fw.steps.length, `${stepCards.length} cards vs ${fw.steps.length} steps`);
  fw.steps.forEach((s, i) => {
    check(`step card ${i + 1} title matches`, stepCards[i] === `${i + 1} · ${s.title}`, `card "${stepCards[i]}"`);
  });

  // Layout: element count (all elements, including board interiors), grid, overlaps, dangling refs.
  const roots = t.elements.filter((el) => !el.boardId);
  check('18–32 elements', t.elements.length >= 18 && t.elements.length <= 32, `got ${t.elements.length}`);
  check('coordinates on the 20px grid', roots.filter((el) => el.type !== 'line' && (!el.containerId || el.type === 'shape')).every((el) => el.x % 20 === 0 && el.y % 20 === 0));
  const violations = checkLayout(t.elements, t.edges ?? []);
  const errors = violations.filter((v) => v.severity === 'error');
  check('no layout errors', errors.length === 0, errors.map((e) => e.message).join('; '));
  const ids = new Set(t.elements.map((el) => el.id));
  const byId = new Map(t.elements.map((el) => [el.id, el]));
  const explicit = (t.edges ?? []).filter((e) => e.fromAnchor !== 'right' || e.toAnchor !== 'left');
  check('edges with explicit anchors are pinned and honoured', explicit.every((e) => {
    const a = byId.get(e.fromNodeId); const b = byId.get(e.toNodeId);
    if (!a || !b || e.fromAutoAnchor !== false || e.toAutoAnchor !== false) return false;
    const r = resolveEdgePoints(e, a, b);
    return r.fromSide === e.fromAnchor && r.toSide === e.toAnchor;
  }), explicit.map((e) => e.id).join(','));
  check('every edge endpoint resolves', (t.edges ?? []).every((e) => ids.has(e.fromNodeId) && ids.has(e.toNodeId)));
}

console.log('\nAssistant block');
check('empty for undefined', getActiveFrameworksBlock(undefined) === '');
check('empty for no known ids', getActiveFrameworksBlock(['nope', 'lean-canvas']) === '');
const one = getActiveFrameworksBlock(['fw-premortem']);
check('names the framework and origin', one.includes('### Pre-mortem (') && one.includes('Gary Klein'));
check('contains the brief', one.includes(getFrameworkBrief('fw-premortem')!));
check('starts with the heading', one.startsWith('## Active frameworks'));
const many = getActiveFrameworksBlock(EXPECTED_IDS);
check(`caps at ${MAX_ACTIVE_FRAMEWORK_BRIEFS} briefs`, (many.match(/^### /gm) ?? []).length === MAX_ACTIVE_FRAMEWORK_BRIEFS);
check('keeps the most recent, in insertion order', !many.includes('### Iceberg Model') && many.indexOf('### Narrative Messaging Arc') < many.indexOf('### Pirate Metrics Funnel') && many.includes('### Partner & Channel Ecosystem Map'));
check('unknown ids do not take a slot', getActiveFrameworksBlock(['fw-premortem', 'nope', 'nope2', 'nope3']).includes('### Pre-mortem'));
check('safe for non-array input', [null, 'fw-premortem', 42, {}, { length: 1, 0: 'fw-premortem' }].every((v) => getActiveFrameworksBlock(v) === ''));
check('ignores non-string entries', getActiveFrameworksBlock([null, 7, {}, ['fw-premortem'], 'fw-premortem']).includes('### Pre-mortem'));

check('tells the assistant to drop a framework gone from the canvas',
  one.includes('If the canvas no longer shows a framework, do not coach from it.'));

console.log('\nInsert offset');
const box = (id: string, x: number, y: number, extra: Partial<CanvasElement> = {}) =>
  ({ id, type: 'shape', x, y, width: 100, height: 60, zIndex: 1, ...extra }) as CanvasElement;
const line = (id: string, boardId?: string): LineElement =>
  ({ id, type: 'line', x: 0, y: 0, width: 0, height: 0, zIndex: 1, boardId,
    start: { x: 40, y: 80 }, end: { x: 240, y: 80 }, bend: { x: 140, y: 120 } }) as LineElement;

const sample = [box('root', 40, 80), line('ln'), box('inner', 500, 500, { boardId: 'b1' }), line('inner-ln', 'b1')];
const shifted = offsetTemplateElements(sample, 1000, 200);
const lineAfter = shifted[1] as LineElement;
const innerLineAfter = shifted[3] as LineElement;
check('root element shifted', shifted[0].x === 1040 && shifted[0].y === 280);
check('line start and end shifted', lineAfter.start.x === 1040 && lineAfter.start.y === 280 && lineAfter.end.x === 1240 && lineAfter.end.y === 280);
check('line bend and x/y shifted, as a canvas drag does', lineAfter.bend?.x === 1140 && lineAfter.bend?.y === 320 && lineAfter.x === 1000 && lineAfter.y === 200);
check('board interior untouched', shifted[2].x === 500 && shifted[2].y === 500 && innerLineAfter.start.x === 40 && innerLineAfter.end.y === 80);
check('ids untouched', shifted.every((el, i) => el.id === sample[i].id));
check('input not mutated', sample[0].x === 40 && (sample[1] as LineElement).start.x === 40);

const real = TEMPLATES.find((t) => t.elements.some((el) => el.boardId) && t.elements.some((el) => el.type === 'line'));
check('a real template has board interiors and lines', !!real);
if (real) {
  const inst = instantiateTemplate(real);
  const edgesBefore = JSON.stringify(inst.edges);
  const offset = templateInsertOffset([box('old', 0, 100, { width: 1037, height: 40 })], inst.elements);
  const placed = offsetTemplateElements(inst.elements, offset.dx, offset.dy);
  const before = templateBounds(inst.elements)!;
  const after = templateBounds(placed)!;
  check('offset is on the 20px grid', offset.dx % 20 === 0 && offset.dy % 20 === 0);
  check('grid preserved', placed.every((el, i) => (el.x - inst.elements[i].x) % 20 === 0 && (el.y - inst.elements[i].y) % 20 === 0));
  check('left edge at least 200 past the existing right edge, within one grid step', after.minX >= 1237 && after.minX < 1257, `left ${after.minX}`);
  check('top aligned with the existing top', Math.abs(after.minY - 100) <= 10, `top ${after.minY}`);
  check('bounds move with the offset', after.maxX - before.maxX === offset.dx && after.maxY - before.maxY === offset.dy);
  check('ids of a real template untouched', placed.every((el, i) => el.id === inst.elements[i].id));
  check('every edge endpoint still resolves', inst.edges.every((e) => placed.some((el) => el.id === e.fromNodeId) && placed.some((el) => el.id === e.toNodeId)));
  check('edges unaffected', JSON.stringify(inst.edges) === edgesBefore);
}
check('no template carries an absolute edge bend', TEMPLATES.every((t) => (t.edges ?? []).every((e) => !e.bend)));

const noOffset = templateInsertOffset([], [box('a', 40, 80)]);
check('empty surface: no offset', noOffset.dx === 0 && noOffset.dy === 0);
const lineLike = templateInsertOffset([line('old-ln')], [box('a', 0, 0)]);
check('existing lines count by start/end, not their zero box', lineLike.dx === 440 && lineLike.dy === 80, JSON.stringify(lineLike));
check('sizeless legacy elements do not produce NaN', Number.isFinite(templateInsertOffset([{ ...box('x', 40, 40), width: undefined } as unknown as CanvasElement], [box('a', 0, 0)]).dx));
const live = [
  box('on-root', 0, 0),
  box('legacy-root', 400, 0, { boardId: undefined, surface: undefined }),
  box('inbox', 9000, 0, { inInbox: true }),
  box('hyper', 8000, 0, { surface: 'hypercube' }),
  box('on-board', 7000, 0, { boardId: 'b1' }),
];
check('root surface skips inbox, hypercube and board elements', templateInsertSurface(live, null).map((el) => el.id).join() === 'on-root,legacy-root');
const inBoardOffset = templateInsertOffset(templateInsertSurface(live, 'b1'), [box('a', 0, 0)]);
check('inside a board the offset comes from that board', inBoardOffset.dx === 7300 && inBoardOffset.dy === 0, JSON.stringify(inBoardOffset));

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
