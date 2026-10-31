// Run: npx tsx src/lib/__verify__/frameworks-registry.verify.ts
// The frameworks library end to end: every framework template carries a full
// explainer, its canvas step cards mirror the explainer's steps, the brief is
// the right size, the layout is sound, and gating/composer rules hold.
import {
  TEMPLATES, FREE_TEMPLATE_IDS, COMPOSER_TEMPLATES, FRAMEWORK_STAGES,
  getFrameworkTemplate, getFrameworkBrief, frameworkTemplatesByStage,
} from '../templates';
import { FRAMEWORK_TEMPLATES, FREE_FRAMEWORK_IDS } from '../templates-frameworks';
import { checkLayout } from '../canvas-layout-rules';

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
  check('coordinates on the 20px grid', roots.filter((el) => el.type !== 'line').every((el) => el.x % 20 === 0 && el.y % 20 === 0));
  const violations = checkLayout(t.elements, t.edges ?? []);
  const errors = violations.filter((v) => v.severity === 'error');
  check('no layout errors', errors.length === 0, errors.map((e) => e.message).join('; '));
  const ids = new Set(t.elements.map((el) => el.id));
  check('every edge endpoint resolves', (t.edges ?? []).every((e) => ids.has(e.fromNodeId) && ids.has(e.toNodeId)));
}

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
