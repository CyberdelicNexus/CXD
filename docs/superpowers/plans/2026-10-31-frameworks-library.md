# Frameworks Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a "Frameworks" tab in the template catalog: 12 proven thinking, planning, marketing and sales frameworks, each with an explainer, a guided canvas template with step cards, and a brief the Canvas Assistant uses to coach inside that method.

**Architecture:** Frameworks are templates with `category: 'framework'` and an optional `framework` block (stage, explainer, steps, assistant brief), so the templates page, the in-canvas picker and the free-tier gating work on them with small additions. Projects record which frameworks they were built from in `frameworkIds`; the chat route resolves those ids server-side into system-prompt briefs. A verify script keeps the explainer, the step cards on the canvas and the brief in agreement.

**Tech Stack:** Next.js 15 app router, TypeScript, Zustand store with Yjs sync, Radix UI dialogs, Tailwind, lucide-react icons, `npx tsx` for verify scripts.

**Spec:** `docs/superpowers/specs/2026-10-31-frameworks-library-design.md`. Read it first.

**Repo root:** the worktree `C:\Users\JEMA\Documents\ClaudeCode\CXD\CXD-frameworks` on branch `feat/frameworks-library`, based on `origin/main`. Do not touch `C:\Users\JEMA\Documents\ClaudeCode\CXD\CXD`: it holds uncommitted assistant work on another branch. Line numbers in this plan were read from that folder, so treat them as approximate here and locate edits by the surrounding code.

**Type-check baseline:** `npx tsc --noEmit -p tsconfig.json` reports 58 existing errors, all in `src/utils/__tests__/diagnostic-chat-handoff.test.ts` and `src/lib/ai/__tests__/ai-response-classifier.test.ts`. "No errors" below means no errors outside those two files.

**Commit trailer:** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` on every commit. Stage named paths only.

**Research corrections:** Task 1 is done. The draft content below already includes its corrections (`docs/superpowers/research/2026-10-31-frameworks-research.md`).

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/templates.ts` (modify) | Template types grow `FrameworkMeta`; stage labels; framework helpers; registry concatenation; free ids; `COMPOSER_TEMPLATES` |
| `src/lib/templates-frameworks.ts` (create) | The 12 framework templates: explainer content, assistant briefs, canvas layouts. Local helpers `stepRail`, `fwTitle` |
| `src/lib/__verify__/frameworks-registry.verify.ts` (create) | Asserts every framework's explainer, step cards, brief, layout and gating agree with the spec |
| `src/types/cxd-schema.ts` (modify) | `frameworkIds` on `CXDProject`; `createDefaultProject` option |
| `src/lib/yjs/y-doc-types.ts`, `src/lib/yjs/y-doc-factory.ts` (modify) | `frameworkIds` round-trips through the Y.Doc meta map |
| `src/store/cxd-store.ts` (modify) | `createProject` options arg; `addProjectFramework` action |
| `src/types/ai-types.ts`, `src/utils/ai-context-aggregator.ts` (modify) | `frameworkIds` in `AIProjectContext` |
| `src/lib/ai/system-prompts.ts` (modify) | `getActiveFrameworksBlock` |
| `src/app/api/ai/chat/route.ts` (modify) | Appends the active-frameworks block |
| `src/app/api/ai/suggest-template/route.ts` (modify) | Uses `COMPOSER_TEMPLATES` (no frameworks) |
| `src/components/cxd/framework-detail-dialog.tsx` (create) | Explainer dialog with create / insert / readonly footers and locked state |
| `src/app/dashboard/templates/page.tsx` (modify) | Frameworks tab, stage grouping, detail dialog, `frameworkIds` on create |
| `src/components/cxd/template-picker-modal.tsx` (modify) | Frameworks tab, info icon, records framework on insert |
| `src/components/dashboard-content.tsx` (modify) | Passes `frameworkIds` when creating from a framework |
| `src/data/changelog.ts` (modify) | Release note |
| `docs/superpowers/research/2026-10-31-frameworks-research.md` (create) | Research output the explainers are checked against |

---

### Task 1: Research pass on the 12 frameworks

**Files:**
- Create: `docs/superpowers/research/2026-10-31-frameworks-research.md`

Tasks 4 to 9 contain **draft** explainer text written from general knowledge. This task produces the document those drafts are checked against. Where the research disagrees with a draft (originator, date, step names or order, a well-known pitfall), the research document wins and the author of Tasks 4 to 9 amends the draft.

- [ ] **Step 1: Load the web search tool**

Run ToolSearch with query `select:WebSearch`. Use `mode: "standard"`; switch to `"extended"` only for a framework whose first result set is thin.

- [ ] **Step 2: Research each framework**

For each row, run one search for the origin and canonical steps and one for pitfalls or critiques. Suggested queries:

| id | Query 1 | Query 2 |
|---|---|---|
| fw-iceberg | `iceberg model systems thinking events patterns structures mental models origin` | `iceberg model systems thinking common mistakes` |
| fw-causal-loop | `causal loop diagram reinforcing balancing loops how to draw steps` | `causal loop diagram pitfalls mistakes` |
| fw-theory-of-change | `theory of change framework steps backward mapping Weiss Aspen Institute` | `theory of change common weaknesses assumptions` |
| fw-hmw-crazy8 | `how might we questions origin Procter Gamble Min Basadur IDEO` and `crazy 8s design sprint Google Ventures method` | `how might we questions too broad too narrow mistakes` |
| fw-scamper | `SCAMPER technique Bob Eberle Alex Osborn origin seven lenses` | `SCAMPER limitations critique` |
| fw-impact-effort | `impact effort matrix prioritization origin quick wins` | `impact effort matrix problems estimation bias` |
| fw-premortem | `pre-mortem Gary Klein 2007 Harvard Business Review steps` | `premortem technique prospective hindsight research Mitchell Russo Pennington` |
| fw-workback | `work back plan backward scheduling milestones event production` | `backward planning pitfalls buffer dependencies` |
| fw-audience-fit | `value proposition canvas Strategyzer Osterwalder customer profile value map licence` | `value proposition canvas mistakes fit` |
| fw-narrative-arc | `StoryBrand seven part framework Donald Miller trademark` | `hero's journey marketing messaging framework alternatives` |
| fw-aarrr | `AARRR pirate metrics Dave McClure 2007 stages` | `pirate metrics criticism vanity metrics` |
| fw-ecosystem-map | `stakeholder mapping influence interest grid Mendelow origin` | `partnership ecosystem map channel partners framework events` |

- [ ] **Step 3: Write the research document**

Use this exact structure, one section per framework, in roster order:

```markdown
# Frameworks research — 2026-10-31

Source of truth for the explainers in `src/lib/templates-frameworks.ts`. Each section: who, when, the canonical steps, failure modes worth warning about, licence or trademark status, and the sources read.

## fw-iceberg · Iceberg Model
- **Origin:** <person or institution, year, one sentence on provenance>
- **Canonical steps:** <numbered list as the source gives them>
- **Failure modes:** <2–3 bullets, each one sentence>
- **Licence / trademark:** <public domain / CC / trademarked by whom>
- **Adaptation notes for CXD:** <what we rename or reword and why>
- **Sources:** <2–4 URLs>

## fw-causal-loop · Causal Loop Map
...
```

Every section must have all six fields filled. If a fact cannot be confirmed, write "unconfirmed; drafts keep <claim>" rather than leaving it blank.

- [ ] **Step 4: Commit**

```bash
git add -f docs/superpowers/research/2026-10-31-frameworks-research.md
git commit -m "docs(research): frameworks library research pass for the 12 explainers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`docs/superpowers` is gitignored; the repo's existing specs were force-added, so `-f` follows precedent.)

---

### Task 2: Framework types, helpers, empty registry and the verify script

**Files:**
- Modify: `src/lib/templates.ts`
- Create: `src/lib/templates-frameworks.ts`
- Create: `src/lib/__verify__/frameworks-registry.verify.ts`

- [ ] **Step 1: Write the verify script (it will fail until Task 9 completes)**

Create `src/lib/__verify__/frameworks-registry.verify.ts`:

```ts
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
  check('whatItIs 2–3 sentences', (fw.whatItIs.match(/[.!?](\s|$)/g) ?? []).length >= 2 && (fw.whatItIs.match(/[.!?](\s|$)/g) ?? []).length <= 4);
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

  // Layout: root element count, grid, overlaps, dangling refs.
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
```

- [ ] **Step 2: Add types, labels and helpers to `src/lib/templates.ts`**

Replace the top of the file (through the `TemplateDefinition` interface) with:

```ts
import type { CanvasElement, CanvasEdge } from '@/types/canvas-elements';
import { QUICKSTART_TEMPLATES } from './templates-quickstart';
import { CLASSIC_TEMPLATES } from './templates-classics';
import { EXPERIENCE_TEMPLATES } from './templates-experience';
import { FRAMEWORK_TEMPLATES, FREE_FRAMEWORK_IDS } from './templates-frameworks';

export type TemplateCategory = 'experience' | 'product-brand' | 'creative' | 'framework';

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  experience: 'Experience Design',
  'product-brand': 'Product & Brand',
  creative: 'Creative & General',
  framework: 'Frameworks',
};

/** Where in the life of an experience a framework earns its keep. Order = display order. */
export type FrameworkStage = 'think' | 'ideate' | 'plan' | 'ship' | 'market' | 'distribute' | 'sell';

export const FRAMEWORK_STAGES: readonly FrameworkStage[] = ['think', 'ideate', 'plan', 'ship', 'market', 'distribute', 'sell'];

export const FRAMEWORK_STAGE_LABELS: Record<FrameworkStage, string> = {
  think: 'Think',
  ideate: 'Ideate',
  plan: 'Plan',
  ship: 'Ship',
  market: 'Market',
  distribute: 'Distribute',
  sell: 'Sell',
};

export interface FrameworkStep {
  title: string;
  detail: string;
}

/**
 * The explainer and coaching brief that turn a template into a framework.
 * The canvas template carries one numbered step card per `steps` entry with the
 * same title (checked by src/lib/__verify__/frameworks-registry.verify.ts).
 */
export interface FrameworkMeta {
  stage: FrameworkStage;
  /** Attribution line, e.g. "Gary Klein, 2007". */
  origin: string;
  /** Canonical public reference when one exists. */
  sourceUrl?: string;
  /** 2–3 sentences. */
  whatItIs: string;
  /** 3–4 bullets. */
  whenToUse: string[];
  /** 4–7 steps. */
  steps: FrameworkStep[];
  /** 2–4 bullets. */
  pitfalls: string[];
  /** ~150 words, imperative. Appended to the assistant's system prompt server-side. */
  assistantBrief: string;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: TemplateCategory;
  elements: CanvasElement[];
  /** Curved gradient connectors between template elements (endpoints reference
   *  element ids; remapped alongside them by instantiateTemplate). */
  edges?: CanvasEdge[];
  /** Present iff category === 'framework'. */
  framework?: FrameworkMeta;
}
```

Then replace everything from `export const TEMPLATES` to the end of the file with:

```ts
export const TEMPLATES: TemplateDefinition[] = [
  // Quickstart set — authored against src/lib/templates.design.md (gradient
  // edges, tinted zones, hexagon portals, experience-block anchors). Listed
  // first so they lead the picker.
  ...QUICKSTART_TEMPLATES,
  // One per experience element + the generic flow/timeline pair.
  ...EXPERIENCE_TEMPLATES,
  // Classic templates, rebuilt against the same design system.
  ...CLASSIC_TEMPLATES,
  // Frameworks: method explainer + guided layout + assistant brief.
  ...FRAMEWORK_TEMPLATES,
];

/**
 * Templates insertable on the free tier (templateAccess 'quickstart').
 * The full catalog stays VISIBLE to free users in the picker — deliberately,
 * as a showroom — but only these ids can be inserted. The AI Composer route
 * (/api/ai/suggest-template) filters its candidate catalog with this same
 * set so it never recommends a template the caller can't insert.
 */
export const FREE_TEMPLATE_IDS: ReadonlySet<string> = new Set([
  ...QUICKSTART_TEMPLATES.map((t) => t.id),
  ...FREE_FRAMEWORK_IDS,
]);

export function isTemplateFree(templateId: string): boolean {
  return FREE_TEMPLATE_IDS.has(templateId);
}

/**
 * What the AI Composer may recommend after framing: experience structures,
 * never thinking methods. Frameworks are reached from the Frameworks tab.
 */
export const COMPOSER_TEMPLATES: TemplateDefinition[] = TEMPLATES.filter((t) => t.category !== 'framework');

export function getFrameworkTemplate(id: string): TemplateDefinition | undefined {
  const t = TEMPLATES.find((x) => x.id === id);
  return t && t.category === 'framework' && t.framework ? t : undefined;
}

export function getFrameworkBrief(id: string): string | undefined {
  return getFrameworkTemplate(id)?.framework?.assistantBrief;
}

export interface FrameworkStageGroup {
  stage: FrameworkStage;
  label: string;
  templates: TemplateDefinition[];
}

/** Frameworks grouped by stage in FRAMEWORK_STAGES order; empty stages omitted. */
export function frameworkTemplatesByStage(list: TemplateDefinition[] = FRAMEWORK_TEMPLATES): FrameworkStageGroup[] {
  return FRAMEWORK_STAGES
    .map((stage) => ({
      stage,
      label: FRAMEWORK_STAGE_LABELS[stage],
      templates: list.filter((t) => t.framework?.stage === stage),
    }))
    .filter((g) => g.templates.length > 0);
}
```

Leave `remapTemplateIds`, `instantiateTemplate` and `templateBounds` untouched between the two replaced regions.

- [ ] **Step 3: Create the registry file with shared helpers and an empty list**

Create `src/lib/templates-frameworks.ts`:

```ts
import type { CanvasElement, ElementStyle, ShapeElement } from '@/types/canvas-elements';
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
// (40,40), caption at (40,88), step rail at y=160, zones from y=280, 20px grid.
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
    caption(`${prefix}-cap`, 40, 88, capText, 900),
  ];
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

export const FRAMEWORK_TEMPLATES: TemplateDefinition[] = [];

export { stepRail, fwTitle };
```

(The `void` lines and `_Fam` alias are removed in Task 9 once every helper is in use.)

- [ ] **Step 4: Type-check and run the verify script**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. If `dashboard-content.tsx` or another file complains about an exhaustive `Record<TemplateCategory, …>`, add the `framework` key there with the label `'Frameworks'`.

Run: `npx tsx src/lib/__verify__/frameworks-registry.verify.ts`
Expected: `12 framework templates registered` ✗ and each `fw-… present` ✗; the gating and composer checks ✓ except `three free frameworks` ✓ and `free frameworks are in FREE_TEMPLATE_IDS` ✓. Exit code 1. That is the expected failing state.

- [ ] **Step 5: Commit**

```bash
git add src/lib/templates.ts src/lib/templates-frameworks.ts src/lib/__verify__/frameworks-registry.verify.ts
git commit -m "feat(templates): framework category, FrameworkMeta, stage helpers and registry verify script" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Projects remember their frameworks

**Files:**
- Modify: `src/types/cxd-schema.ts` (interface near line 331; `createDefaultProject` at line 334)
- Modify: `src/lib/yjs/y-doc-types.ts:33-46` (`META_SCALAR_FIELDS`)
- Modify: `src/lib/yjs/y-doc-factory.ts:672` (project assembly)
- Modify: `src/store/cxd-store.ts:162` (interface) and `:499` (action), plus a new action after `setFramingType` (line 715)
- Modify: `src/app/dashboard/templates/page.tsx:121`
- Modify: `src/components/dashboard-content.tsx:238`

- [ ] **Step 1: Add the field and the option to the schema**

In `src/types/cxd-schema.ts`, after the `framingType?: string;` line inside `CXDProject`, add:

```ts
  /** Framework template ids this project was created from or had inserted.
   *  Deduped, insertion order, capped at MAX_PROJECT_FRAMEWORKS. The chat
   *  route turns these into coaching briefs. */
  frameworkIds?: string[];
```

Above `createDefaultProject` add:

```ts
export const MAX_PROJECT_FRAMEWORKS = 5;

export interface CreateProjectOptions {
  frameworkIds?: string[];
}

/** Dedupe, keep insertion order, keep the most recent MAX_PROJECT_FRAMEWORKS. */
export function normalizeFrameworkIds(ids: readonly string[] | undefined): string[] | undefined {
  if (!ids || ids.length === 0) return undefined;
  const unique = Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.length > 0)));
  return unique.length ? unique.slice(-MAX_PROJECT_FRAMEWORKS) : undefined;
}
```

Change the `createDefaultProject` signature to:

```ts
export function createDefaultProject(
  id: string,
  name: string,
  ownerId: string,
  initialElements?: import('./canvas-elements').CanvasElement[],
  initialEdges?: import('./canvas-elements').CanvasEdge[],
  options?: CreateProjectOptions,
): CXDProject {
```

and inside the returned object, directly after the `ownerId,` line, add:

```ts
    frameworkIds: normalizeFrameworkIds(options?.frameworkIds),
```

- [ ] **Step 2: Round-trip through the Y.Doc**

In `src/lib/yjs/y-doc-types.ts`, add `'frameworkIds',` to `META_SCALAR_FIELDS` after `'framingType',`.

In `src/lib/yjs/y-doc-factory.ts`, after the line `framingType: meta.framingType as string | undefined,` add:

```ts
    frameworkIds: Array.isArray(meta.frameworkIds) ? (meta.frameworkIds as string[]) : undefined,
```

- [ ] **Step 3: Store: options on `createProject`, new `addProjectFramework`**

In `src/store/cxd-store.ts`, change the interface line 162 to:

```ts
  createProject: (name: string, ownerId: string, initialElements?: CanvasElement[], initialEdges?: CanvasEdge[], options?: CreateProjectOptions) => string;
  /** Record that a framework template was inserted into the current project (deduped, capped). */
  addProjectFramework: (frameworkId: string) => void;
```

Add `CreateProjectOptions` and `normalizeFrameworkIds` to the existing `import … from '@/types/cxd-schema'` line.

Change the action at line 499 to:

```ts
      createProject: (name, ownerId, initialElements, initialEdges, options) => {
        const id = uuidv4();
        const project = createDefaultProject(id, name, ownerId, initialElements, initialEdges, options);
```

(the rest of the action is unchanged.)

After the `setFramingType` action (ends around line 729) add:

```ts
      addProjectFramework: (frameworkId) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;
        const frameworkIds = normalizeFrameworkIds([...(currentProject.frameworkIds ?? []), frameworkId]);
        if (!frameworkIds || frameworkIds.join('|') === (currentProject.frameworkIds ?? []).join('|')) return;
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === currentProject.id
              ? { ...p, frameworkIds, updatedAt: new Date().toISOString() }
              : p
          ),
        }));
        const { yDoc } = get();
        if (yDoc) {
          yjsSetMetaField(yDoc, 'frameworkIds', frameworkIds);
        }
      },
```

- [ ] **Step 4: Pass the option from the two create paths**

`src/app/dashboard/templates/page.tsx` line 121 becomes:

```ts
    createProject(
      projectName.trim(),
      userId,
      freshElements,
      freshEdges,
      selectedTemplate.framework ? { frameworkIds: [selectedTemplate.id] } : undefined,
    );
```

`src/components/dashboard-content.tsx` line 238 becomes:

```ts
    const projectId = createProject(
      templateProjectName.trim(),
      userId,
      freshElements,
      freshEdges,
      selectedTemplate.framework ? { frameworkIds: [selectedTemplate.id] } : undefined,
    );
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/types/cxd-schema.ts src/lib/yjs/y-doc-types.ts src/lib/yjs/y-doc-factory.ts src/store/cxd-store.ts src/app/dashboard/templates/page.tsx src/components/dashboard-content.tsx
git commit -m "feat(project): frameworkIds on projects, Y.Doc round-trip, createProject options, addProjectFramework" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Author Iceberg Model and Causal Loop Map (Think)

**Files:**
- Modify: `src/lib/templates-frameworks.ts`

Before writing, read the matching sections of `docs/superpowers/research/2026-10-31-frameworks-research.md` and amend the draft text below where the research disagrees.

- [ ] **Step 1: Add the two definitions above `FRAMEWORK_TEMPLATES`**

```ts
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
        note(`fwi-${l.key}-n`, 76, zy + 140, l.noteTitle, l.emoji, l.fill, '', `fwi-${l.key}`),
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
    shape('fwc-r1', 120, 420, 200, 80, 'pill', 'Word of mouth', variableStyle),
    shape('fwc-r2', 520, 420, 200, 80, 'pill', 'Attendance', variableStyle),
    shape('fwc-r3', 320, 700, 200, 80, 'pill', 'Peak moments shared', variableStyle),

    ...zone('fwc-b', 840, 280, 760, 620, 'Balancing loop', 'rose',
      'A loop that pushes back. Something grows, something else limits it.'),
    shape('fwc-b1', 920, 420, 200, 80, 'pill', 'Attendance', variableStyle),
    shape('fwc-b2', 1320, 420, 200, 80, 'pill', 'Crowding', variableStyle),
    shape('fwc-b3', 1120, 700, 200, 80, 'pill', 'Intimacy felt', variableStyle),

    ...zone('fwc-lv', 40, 940, 1560, 480, 'Leverage points', 'emerald',
      'Where would a small push travel furthest? One note per candidate intervention, with the delay you expect.'),
    note('fwc-lv-n', 76, 1080, 'Intervention', '🎯', NOTE_EMERALD, 'Which loop does this weaken or strengthen? How long until it shows?', 'fwc-lv'),
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
```

Then change the registry line to:

```ts
export const FRAMEWORK_TEMPLATES: TemplateDefinition[] = [
  iceberg,
  causalLoop,
];
```

- [ ] **Step 2: Run the verify script**

Run: `npx tsx src/lib/__verify__/frameworks-registry.verify.ts`
Expected: the `fw-iceberg` and `fw-causal-loop` sections all ✓ (step cards match, 18–32 elements, no layout errors, edges resolve). The registry count and the ten missing-id checks still ✗. If `no layout errors` fails, print the messages and move the offending element by multiples of 20px until clean; do not loosen the check.

- [ ] **Step 3: Commit**

```bash
git add src/lib/templates-frameworks.ts
git commit -m "feat(frameworks): Iceberg Model and Causal Loop Map" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Author Theory of Change (Think) and How Might We + Crazy 8s (Ideate)

**Files:**
- Modify: `src/lib/templates-frameworks.ts`

Check the research document first; the research wins over the draft text.

- [ ] **Step 1: Add the two definitions above `FRAMEWORK_TEMPLATES`**

```ts
// ─── 3. Theory of Change — RAIL read backwards: trait ← outcomes ← states ← inputs

const TOC_STEPS: FrameworkStep[] = [
  { title: 'Name the lasting trait', detail: 'The change that should still be there months later. One sentence, in the participant\u2019s life, not in the room.' },
  { title: 'Define the states that lead there', detail: 'Which temporary states, felt during the experience, make that trait possible?' },
  { title: 'List the activities that produce the states', detail: 'What you actually do, moment by moment, that reliably evokes each state.' },
  { title: 'Gather the inputs', detail: 'People, space, time, money, partners, materials each activity depends on.' },
  { title: 'Write the assumptions', detail: 'Every arrow hides a belief. Say it out loud so it can be tested.' },
];

const TOC_ZONES: { key: string; label: string; fam: Fam; cap: string; noteTitle: string; emoji: string; fill: string }[] = [
  { key: 'in', label: 'Inputs & activities', fam: 'emerald', cap: 'What you bring and what you do. Pair each activity with the resources it needs.', noteTitle: 'Activity', emoji: '🛠️', fill: NOTE_EMERALD },
  { key: 'st', label: 'States', fam: 'ocean', cap: 'What participants feel or notice during the experience because of those activities.', noteTitle: 'State evoked', emoji: '🌊', fill: NOTE_TEAL },
  { key: 'ou', label: 'Outcomes', fam: 'violet', cap: 'What changes in the days and weeks after. Behaviour, relationships, decisions.', noteTitle: 'Outcome', emoji: '🌱', fill: NOTE_VIOLET },
  { key: 'tr', label: 'Lasting trait', fam: 'rose', cap: 'The change that stays. Write it as the participant would describe themselves a year on.', noteTitle: 'Trait', emoji: '💎', fill: NOTE_ROSE },
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
    assistantBrief: 'Coach the Theory of Change. The canvas reads right to left: Lasting trait, Outcomes, States, Inputs & activities, with arrows pointing back toward causes. Start at the trait: if it is vague, make the designer write it as a participant describing themselves a year later. Then step leftward one zone at a time asking "what must be true just before this?". Reject outputs dressed as outcomes (counts of people or sessions are outputs). For every arrow, ask for the assumption behind it and suggest recording it on the edge label or a note. Use the Trait Mapping block when present as the source for the trait zone. Finish by asking which assumption is weakest and how they would test it cheaply.',
  },
  elements: [
    ...fwTitle('fwt', 'Theory of Change', FAM.rose.grad, 'Start on the right with the trait that lasts, then ask what must be true one step earlier. Arrows point back to causes.'),
    ...stepRail('fwt', TOC_STEPS),
    ...TOC_ZONES.flatMap((z, i) => {
      const zx = 40 + i * 460;
      return [
        ...zone(`fwt-${z.key}`, zx, 280, 420, 600, z.label, z.fam, z.cap),
        note(`fwt-${z.key}-n`, zx + 36, 420, z.noteTitle, z.emoji, z.fill, '', `fwt-${z.key}`),
      ];
    }),
    block('fwt-anchor', 'traitMapping', 'Trait Mapping', 1880, 280),
  ] as CanvasElement[],
  edges: [
    edge('fwt-e1', 'fwt-tr', 'fwt-ou', 'rose', 'left', 'right'),
    edge('fwt-e2', 'fwt-ou', 'fwt-st', 'violet', 'left', 'right'),
    edge('fwt-e3', 'fwt-st', 'fwt-in', 'ocean', 'left', 'right'),
    edge('fwt-e4', 'fwt-anchor', 'fwt-tr', 'rose', 'left', 'right'),
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
    edge('fwh-e1', 'fwh-q', 'fwh-8', 'sunset', 'bottom', 'top'),
    edge('fwh-e2', 'fwh-8', 'fwh-p', 'violet'),
  ],
};
```

Add `theoryOfChange, hmwCrazy8,` to `FRAMEWORK_TEMPLATES` after `causalLoop,`.

- [ ] **Step 2: Run the verify script**

Run: `npx tsx src/lib/__verify__/frameworks-registry.verify.ts`
Expected: all per-framework checks ✓ for the four authored so far; eight missing-id checks and the count still ✗.

- [ ] **Step 3: Commit**

```bash
git add src/lib/templates-frameworks.ts
git commit -m "feat(frameworks): Theory of Change and How Might We + Crazy 8s" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Author SCAMPER (Ideate) and Impact–Effort Matrix (Plan)

**Files:**
- Modify: `src/lib/templates-frameworks.ts`

Check the research document first; the research wins over the draft text.

- [ ] **Step 1: Add the two definitions above `FRAMEWORK_TEMPLATES`**

```ts
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
    note('fws-k-n', 1456, 420, 'Keeper', '💎', NOTE_EMERALD, '', 'fws-k'),
  ] as CanvasElement[],
  edges: SCAMPER_LENSES.map((l, i) =>
    edge(`fws-e${i + 1}`, 'fws-subject', `fws-${l.key}`, (['violet', 'ocean', 'emerald', 'sunset', 'rose', 'glacier', 'ocean'] as const)[i]),
  ),
};

// ─── 6. Impact–Effort Matrix — HUB 2×2 + idea inbox

const IMPACT_STEPS: FrameworkStep[] = [
  { title: 'List the ideas', detail: 'Everything on the table, one per note, in the inbox. No ranking yet.' },
  { title: 'Score impact', detail: 'How much does it move the experience toward its intended states and traits? High or low.' },
  { title: 'Score effort', detail: 'Time, money, people, risk. High or low, relative to the rest of the list.' },
  { title: 'Place and decide', detail: 'Drag each note into its quadrant. Do quick wins now, schedule big bets, drop time sinks.' },
];

const IMPACT_QUADS: { key: string; label: string; fam: Fam; cap: string; noteTitle: string; emoji: string; fill: string; x: number; y: number }[] = [
  { key: 'qw', label: 'Quick wins', fam: 'emerald', cap: 'High impact, low effort. Do these first.', noteTitle: 'Quick win', emoji: '⚡', fill: NOTE_EMERALD, x: 40, y: 340 },
  { key: 'bb', label: 'Big bets', fam: 'violet', cap: 'High impact, high effort. Schedule and resource them deliberately.', noteTitle: 'Big bet', emoji: '🎯', fill: NOTE_VIOLET, x: 700, y: 340 },
  { key: 'fi', label: 'Fill-ins', fam: 'ocean', cap: 'Low impact, low effort. Only when there is slack.', noteTitle: 'Fill-in', emoji: '🧩', fill: NOTE_TEAL, x: 40, y: 900 },
  { key: 'ts', label: 'Time sinks', fam: 'rose', cap: 'Low impact, high effort. Say no, kindly.', noteTitle: 'Time sink', emoji: '🕳️', fill: NOTE_ROSE, x: 700, y: 900 },
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
      note(`fwm-${q.key}-n`, q.x + 36, q.y + 140, q.noteTitle, q.emoji, q.fill, '', `fwm-${q.key}`),
    ]),
    ...zone('fwm-in', 1360, 340, 520, 1080, 'Idea inbox', 'sunset',
      'Everything on the table, one per note. Score, then drag into a quadrant.'),
    note('fwm-in-n', 1396, 480, 'Idea', '💡', WARM_SUN, 'Impact: high / low. Effort: high / low.', 'fwm-in'),
  ] as CanvasElement[],
  edges: [],
};
```

Add `scamper, impactEffort,` to `FRAMEWORK_TEMPLATES`.

- [ ] **Step 2: Run the verify script**

Run: `npx tsx src/lib/__verify__/frameworks-registry.verify.ts`
Expected: per-framework checks ✓ for six frameworks; six missing ids and the count ✗.

- [ ] **Step 3: Commit**

```bash
git add src/lib/templates-frameworks.ts
git commit -m "feat(frameworks): SCAMPER and Impact-Effort Matrix" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Author Pre-mortem (Plan) and Work-back Plan (Ship)

**Files:**
- Modify: `src/lib/templates-frameworks.ts`

Check the research document first; the research wins over the draft text.

- [ ] **Step 1: Add the two definitions above `FRAMEWORK_TEMPLATES`**

```ts
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
  elements: [
    ...fwTitle('fwp', 'Pre-mortem', FAM.rose.grad, 'It is the morning after and it went badly. Explain why, then make sure it cannot.'),
    ...stepRail('fwp', PREMORTEM_STEPS),

    ...zone('fwp-f', 40, 280, 520, 560, 'The launch failed', 'rose',
      'Describe the failure as if it has already happened. What did people see and say?'),
    note('fwp-f-n', 76, 420, 'It flopped because…', '🪦', NOTE_ROSE, 'Write it in the past tense.', 'fwp-f'),

    ...zone('fwp-c', 600, 280, 760, 560, 'Causes', 'sunset',
      'One cause per note, mechanism not blame. Keep going until the room is empty.'),
    note('fwp-c-n1', 636, 420, 'Cause', '⚠️', WARM_FIRE, 'Who did or did not do what, and why?', 'fwp-c'),
    note('fwp-c-n2', 936, 420, 'Cause', '⚠️', WARM_SUN, '', 'fwp-c'),

    ...zone('fwp-s', 1400, 280, 760, 560, 'Safeguards', 'emerald',
      'For each top cause, the concrete thing that prevents or catches it.'),
    note('fwp-s-n1', 1436, 420, 'Safeguard', '🛡️', NOTE_EMERALD, 'Prevents or catches which cause?', 'fwp-s'),
    note('fwp-s-n2', 1736, 420, 'Safeguard', '🛡️', NOTE_TEAL, '', 'fwp-s'),

    ...zone('fwp-o', 2200, 280, 520, 560, 'Owners & dates', 'violet',
      'A safeguard without an owner is a wish. Name and date each one.'),
    note('fwp-o-n', 2236, 420, 'Owner · date', '📅', NOTE_VIOLET, '', 'fwp-o'),
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
  { title: 'Add buffer', detail: 'Put slack before the milestones that cannot slip. Novel work takes twice as long.' },
];

const WORKBACK_ZONES: { key: string; label: string; fam: Fam; cap: string; noteTitle: string; emoji: string; fill: string }[] = [
  { key: 'now', label: 'Today', fam: 'glacier', cap: 'What is already true, decided or booked. Start from reality.', noteTitle: 'Already in place', emoji: '📍', fill: NOTE_TEAL },
  { key: 'm3', label: 'T − 3 months', fam: 'ocean', cap: 'The long-lead items: venue, partners, funding, permits, key people.', noteTitle: 'Long-lead milestone', emoji: '🏗️', fill: NOTE_TEAL },
  { key: 'm1', label: 'T − 1 month', fam: 'violet', cap: 'Content locked, materials ordered, rehearsals scheduled, comms drafted.', noteTitle: 'Lock milestone', emoji: '🔒', fill: NOTE_VIOLET },
  { key: 'live', label: 'Live date', fam: 'sunset', cap: 'The date that does not move. Doors open. Everything else is derived from this.', noteTitle: 'Doors open', emoji: '🎬', fill: WARM_SUN },
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
  elements: [
    ...fwTitle('fww', 'Work-back Plan', FAM.sunset.grad, 'Start from the right. The live date does not move; everything to its left is what must already be true.'),
    ...stepRail('fww', WORKBACK_STEPS),
    ...WORKBACK_ZONES.flatMap((z, i) => {
      const zx = 40 + i * 460;
      return [
        ...zone(`fww-${z.key}`, zx, 280, 420, 600, z.label, z.fam, z.cap),
        note(`fww-${z.key}-n`, zx + 36, 420, z.noteTitle, z.emoji, z.fill, 'Owner: · Due: · Depends on:', `fww-${z.key}`),
      ];
    }),
  ] as CanvasElement[],
  edges: [
    edge('fww-e1', 'fww-now', 'fww-m3', 'glacier'),
    edge('fww-e2', 'fww-m3', 'fww-m1', 'ocean'),
    edge('fww-e3', 'fww-m1', 'fww-live', 'violet'),
  ],
};
```

Add `premortem, workback,` to `FRAMEWORK_TEMPLATES`.

- [ ] **Step 2: Run the verify script**

Run: `npx tsx src/lib/__verify__/frameworks-registry.verify.ts`
Expected: per-framework checks ✓ for eight frameworks; four missing ids and the count ✗.

- [ ] **Step 3: Commit**

```bash
git add src/lib/templates-frameworks.ts
git commit -m "feat(frameworks): Pre-mortem and Work-back Plan" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Author Audience Fit Map and Narrative Messaging Arc (Market)

**Files:**
- Modify: `src/lib/templates-frameworks.ts`

Check the research document first, especially the licence note: Strategyzer's Value Proposition Canvas is under copyright and needs permission for use in software, so this task builds our own Audience Fit Map instead. The beat names below deliberately avoid StoryBrand's: never use StoryBrand, SB7 or BrandScript in titles or beats. The book is credited once, in `origin`.

- [ ] **Step 1: Add the two definitions above `FRAMEWORK_TEMPLATES`**

```ts
// ─── 9. Audience Fit Map — TWO HALVES: audience ↔ experience
// Our own map. Strategyzer's Value Proposition Canvas is under copyright and
// needs permission for use in software: do not reuse its name, its shapes or
// its "pain relievers" / "gain creators" terms here.

const FIT_STEPS: FrameworkStep[] = [
  { title: 'Hear what they are trying to do', detail: 'What are they hoping to get done, feel or become when they come to you? Use their words.' },
  { title: 'Name what stands in the way', detail: 'What frustrates, blocks or scares them before, during and after? Rank by intensity.' },
  { title: 'Name what they hope for', detail: 'What would delight them, beyond the obvious? Rank by how much it matters.' },
  { title: 'Match real moments', detail: 'For the top items, which specific moment in your experience answers them?' },
  { title: 'Draw the fit lines', detail: 'Connect each moment to what it answers. Anything unconnected is decoration.' },
];

const audienceFit: TemplateDefinition = {
  id: 'fw-audience-fit',
  name: 'Audience Fit Map',
  description: 'Match what your audience is trying to do, avoid and gain with what the experience delivers',
  emoji: '🤝',
  category: 'framework',
  framework: {
    stage: 'market',
    origin: 'Our own map, drawing on jobs-to-be-done thinking and on Value Proposition Design (Osterwalder et al., 2014; Strategyzer.com, Strategyzer AG)',
    whatItIs: 'The Audience Fit Map sets what your audience is trying to do, avoid and gain beside the specific moments your experience offers, then asks where the two connect. Fit exists only where a moment answers something that matters to them. It turns "who is this for" into a claim you can test.',
    whenToUse: [
      'Writing the first marketing copy and you cannot yet say why someone would come.',
      'Attendance is lower than the quality deserves.',
      'Adapting an experience to a new audience.',
    ],
    steps: FIT_STEPS,
    pitfalls: [
      'Writing the audience side from the inside ("they want immersion") instead of from interviews.',
      'Mixing several audiences on one map; make one map per audience.',
      'Skipping ranking, so a minor annoyance gets the same attention as the one thing that stops people coming.',
    ],
    assistantBrief: 'Coach the Audience Fit Map. The canvas has an Audience zone (Trying to do, In the way, Hoping for) and an Experience zone (Moments we offer, What eases it, What lifts it). Start on the audience side and keep the designer in the audience\u2019s own words; when a statement sounds like the designer\u2019s wish, ask what evidence or interview it came from. Keep to one audience per map. Push for ranking: which obstacle stops people coming, which hope they would tell a friend about. Use the Human Context block when present as a source. Then move to the experience side and insist each entry names a concrete moment. Finish by checking fit: propose edges from each moment to what it answers, and point out anything left unconnected.',
  },
  elements: [
    ...fwTitle('fwv', 'Audience Fit Map', FAM.ocean.grad, 'Left: the audience in their own words. Right: what the experience does about it. Fit is where lines connect.'),
    ...stepRail('fwv', FIT_STEPS),

    ...zone('fwv-a', 40, 280, 900, 1160, 'Audience', 'ocean',
      'What they are trying to do, what stands in the way, what they hope for. Rank each list.'),
    note('fwv-a-j', 76, 420, 'Trying to do', '🎯', NOTE_TEAL, 'What are they hoping to get done, feel or become?', 'fwv-a'),
    note('fwv-a-p', 76, 760, 'In the way', '🌧️', NOTE_ROSE, 'What frustrates, blocks or scares them?', 'fwv-a'),
    note('fwv-a-g', 76, 1100, 'Hoping for', '🌤️', NOTE_EMERALD, 'What would delight them beyond the obvious?', 'fwv-a'),

    ...zone('fwv-o', 1000, 280, 900, 1160, 'Experience', 'violet',
      'Name concrete moments, not features. Connect each one to what it answers.'),
    note('fwv-o-e', 1036, 420, 'Moments we offer', '✨', NOTE_VIOLET, 'The moments and elements you offer.', 'fwv-o'),
    note('fwv-o-r', 1036, 760, 'What eases it', '🩹', WARM_FIRE, 'Which obstacle does this moment remove or soften?', 'fwv-o'),
    note('fwv-o-c', 1036, 1100, 'What lifts it', '🎁', WARM_SUN, 'Which hope does this moment deliver?', 'fwv-o'),

    block('fwv-anchor', 'humanContext', 'Human Context', 1960, 280),
  ] as CanvasElement[],
  edges: [
    edge('fwv-e1', 'fwv-a', 'fwv-o', 'ocean'),
    edge('fwv-e2', 'fwv-anchor', 'fwv-a', 'glacier', 'left', 'right'),
  ],
};

// ─── 10. Narrative Messaging Arc — RAIL of seven beats + one-liner + placements

const ARC_STEPS: FrameworkStep[] = [
  { title: 'The hero', detail: 'Your audience, not you. What do they want? One desire, stated simply.' },
  { title: 'The tension', detail: 'What stands in their way: the outer obstacle, the inner feeling, the bigger wrong.' },
  { title: 'The ally', detail: 'You enter as the one who understands and has a way. Empathy first, then credibility.' },
  { title: 'The path', detail: 'Three steps that make saying yes feel safe. Simple enough to remember.' },
  { title: 'The invitation', detail: 'The direct ask (book, join, come) and the soft one (learn more, follow).' },
  { title: 'The stakes', detail: 'What they lose by doing nothing. Said once, without fear-mongering.' },
  { title: 'The transformation', detail: 'Who they are afterwards. Paint it concretely; this is what they are buying.' },
];

const ARC_BEATS: { key: string; title: string; emoji: string; fill: string }[] = [
  { key: 'h', title: 'The hero', emoji: '🧑‍🚀', fill: NOTE_VIOLET },
  { key: 't', title: 'The tension', emoji: '⛈️', fill: WARM_FIRE },
  { key: 'g', title: 'The ally', emoji: '🧙', fill: NOTE_TEAL },
  { key: 'p', title: 'The path', emoji: '🪜', fill: NOTE_EMERALD },
  { key: 'i', title: 'The invitation', emoji: '✉️', fill: WARM_SUN },
  { key: 's', title: 'The stakes', emoji: '⚖️', fill: NOTE_ROSE },
  { key: 'x', title: 'The transformation', emoji: '🦋', fill: NOTE_VIOLET },
];

const narrativeArc: TemplateDefinition = {
  id: 'fw-narrative-arc',
  name: 'Narrative Messaging Arc',
  description: 'A seven-beat story structure for pitches, pages and invitations, with your audience as the hero',
  emoji: '📜',
  category: 'framework',
  framework: {
    stage: 'market',
    origin: 'Our own structure, inspired by hero\u2019s-journey storytelling and by Donald Miller\u2019s Building a StoryBrand (2017)',
    whatItIs: 'The Narrative Messaging Arc arranges your marketing message as a story in which the audience is the hero and you are the ally. Seven beats carry a reader from a desire through tension to an invitation and a transformation. Because the structure is a story, people remember it, and because the hero is them, they lean in.',
    whenToUse: [
      'Writing a landing page, pitch deck, invitation or funding narrative.',
      'The current copy talks mostly about you and your method.',
      'Different channels tell slightly different stories and you want one spine.',
    ],
    steps: ARC_STEPS,
    pitfalls: [
      'Casting yourself as the hero. The audience is the hero; you are the ally.',
      'Stakes that threaten; stakes should clarify what is lost by inaction, once.',
      'A path with seven steps. Three is the limit people remember.',
    ],
    assistantBrief: 'Coach the Narrative Messaging Arc. The canvas is a rail of seven beat cards (The hero, The tension, The ally, The path, The invitation, The stakes, The transformation) plus a One-liner zone and a Where it lives zone. Keep the audience as the hero: whenever the designer writes about themselves in the hero slot, move it to the ally slot. Push each beat to one or two concrete sentences in the audience\u2019s language, using Framing for the hero\u2019s desire and the transformation (states and traits). Keep the path to three steps and the stakes to a single calm statement. When all seven beats hold text, help them compress into a one-liner (hero, tension, transformation in one breath) and list where the message lives: page, deck, invitation, social.',
  },
  elements: [
    ...fwTitle('fwn', 'Narrative Messaging Arc', FAM.violet.grad, 'Seven beats, left to right. The audience is the hero; you are the ally. Compress it into one line at the end.'),
    ...stepRail('fwn', ARC_STEPS),
    ...ARC_BEATS.map((b, i) => note(`fwn-${b.key}`, 40 + i * 300, 280, b.title, b.emoji, b.fill, 'One or two sentences, in their words.')),
    ...zone('fwn-1', 40, 680, 2060, 480, 'The one-liner', 'sunset',
      'Hero, tension, transformation in one breath. This goes at the top of every page.'),
    note('fwn-1-n', 76, 820, 'One-liner', '🗣️', WARM_SUN, '"For people who… who feel… this is… so they…"', 'fwn-1'),
    ...zone('fwn-2', 40, 1200, 2060, 480, 'Where it lives', 'emerald',
      'Pages, decks, invitations, posts. Which beats each one carries.'),
    note('fwn-2-n', 76, 1340, 'Placement', '📍', NOTE_EMERALD, 'Landing page: beats 1–7. Invitation: 1, 5, 7.', 'fwn-2'),
  ] as CanvasElement[],
  edges: ARC_BEATS.slice(0, -1).map((b, i) =>
    edge(`fwn-e${i + 1}`, `fwn-${b.key}`, `fwn-${ARC_BEATS[i + 1].key}`, (['violet', 'rose', 'ocean', 'emerald', 'sunset', 'rose'] as const)[i]),
  ),
};
```

Add `audienceFit, narrativeArc,` to `FRAMEWORK_TEMPLATES`.

- [ ] **Step 2: Run the verify script**

Run: `npx tsx src/lib/__verify__/frameworks-registry.verify.ts`
Expected: per-framework checks ✓ for ten frameworks; two missing ids and the count ✗.

- [ ] **Step 3: Commit**

```bash
git add src/lib/templates-frameworks.ts
git commit -m "feat(frameworks): Audience Fit Map and Narrative Messaging Arc" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Author Pirate Metrics Funnel (Distribute) and Partner & Channel Ecosystem Map (Sell); registry complete

**Files:**
- Modify: `src/lib/templates-frameworks.ts`

Check the research document first; the research wins over the draft text.

- [ ] **Step 1: Add the two definitions above `FRAMEWORK_TEMPLATES`**

```ts
// ─── 11. Pirate Metrics Funnel — RAIL of five lanes, one metric each

const AARRR_STEPS: FrameworkStep[] = [
  { title: 'Acquisition', detail: 'How do people first hear of this? One tactic per note, with the number you will watch.' },
  { title: 'Activation', detail: 'What is the first good moment, and how many who arrive actually reach it?' },
  { title: 'Retention', detail: 'Who comes back, or stays in touch, and what brings them?' },
  { title: 'Referral', detail: 'What makes someone bring a friend, and how do you make it easy?' },
  { title: 'Revenue', detail: 'Where money enters: tickets, memberships, commissions, partners. One metric.' },
];

const AARRR_LANES: { key: string; label: string; fam: Fam; cap: string; noteTitle: string; emoji: string; fill: string }[] = [
  { key: 'acq', label: 'Acquisition', fam: 'violet', cap: 'Metric: people who hear of it. Tactics: channels, partners, press, search.', noteTitle: 'Tactic', emoji: '📣', fill: NOTE_VIOLET },
  { key: 'act', label: 'Activation', fam: 'ocean', cap: 'Metric: share who reach the first good moment. What is that moment?', noteTitle: 'First good moment', emoji: '✨', fill: NOTE_TEAL },
  { key: 'ret', label: 'Retention', fam: 'emerald', cap: 'Metric: share who return or stay in touch. What brings them back?', noteTitle: 'Return reason', emoji: '🔁', fill: NOTE_EMERALD },
  { key: 'ref', label: 'Referral', fam: 'sunset', cap: 'Metric: invites per participant. How do you make bringing a friend easy?', noteTitle: 'Share moment', emoji: '🤝', fill: WARM_SUN },
  { key: 'rev', label: 'Revenue', fam: 'rose', cap: 'Metric: revenue per participant. Tickets, memberships, partners, commissions.', noteTitle: 'Revenue path', emoji: '💰', fill: NOTE_ROSE },
];

const aarrr: TemplateDefinition = {
  id: 'fw-aarrr',
  name: 'Pirate Metrics Funnel',
  description: 'Acquisition to revenue in five lanes, each with its tactics and the one metric that matters',
  emoji: '🏴‍☠️',
  category: 'framework',
  framework: {
    stage: 'distribute',
    origin: 'Dave McClure, "Startup Metrics for Pirates", Ignite Seattle talk, around 2007',
    sourceUrl: 'https://www.slideshare.net/dmc500hats/startup-metrics-for-pirates-long-version',
    whatItIs: 'Pirate Metrics (AARRR) breaks how people find, try, keep, share and pay for something into five stages, each with one metric. It replaces vanity numbers with a funnel you can act on: the stage with the worst conversion is where to work next. For experiences, it links distribution to the moments that actually make people come back.',
    whenToUse: [
      'You are deciding where to spend limited marketing time.',
      'Attendance numbers look fine but revenue or return visits do not.',
      'Planning distribution for a series, a season or a membership.',
    ],
    steps: AARRR_STEPS,
    pitfalls: [
      'Tracking totals instead of conversion between stages.',
      'Pouring effort into acquisition while activation leaks.',
      'Choosing metrics you cannot actually measure with the tools you have.',
    ],
    assistantBrief: 'Coach Pirate Metrics. The canvas has five lane zones: Acquisition, Activation, Retention, Referral, Revenue. For each lane help the designer name one measurable metric they can really collect and one or two tactics as notes. Insist on conversion between stages rather than totals: of those who hear, how many come; of those who come, how many reach the first good moment. Ask what the first good moment is and whether the experience design makes it early enough. When all lanes are filled, help them find the leakiest stage and recommend working there before adding acquisition. Tie referral to a specific share-worthy moment in the Experience Flow when present.',
  },
  elements: [
    ...fwTitle('fwa', 'Pirate Metrics Funnel', FAM.violet.grad, 'Five lanes, left to right. One metric per lane, measured as conversion from the lane before. Fix the leakiest lane first.'),
    ...stepRail('fwa', AARRR_STEPS),
    ...AARRR_LANES.flatMap((l, i) => {
      const zx = 40 + i * 440;
      return [
        ...zone(`fwa-${l.key}`, zx, 280, 400, 620, l.label, l.fam, l.cap),
        note(`fwa-${l.key}-n`, zx + 36, 420, l.noteTitle, l.emoji, l.fill, 'Metric: …  Target: …', `fwa-${l.key}`),
      ];
    }),
  ] as CanvasElement[],
  edges: [
    edge('fwa-e1', 'fwa-acq', 'fwa-act', 'violet'),
    edge('fwa-e2', 'fwa-act', 'fwa-ret', 'ocean'),
    edge('fwa-e3', 'fwa-ret', 'fwa-ref', 'emerald'),
    edge('fwa-e4', 'fwa-ref', 'fwa-rev', 'sunset'),
  ],
};

// ─── 12. Partner & Channel Ecosystem Map — 2×2 by influence × reach + candidates

const ECO_STEPS: FrameworkStep[] = [
  { title: 'List every partner and channel', detail: 'Venues, collaborators, platforms, press, communities, gatekeepers, funders. One per note in Candidates.' },
  { title: 'Rate influence', detail: 'How much can they shape whether this happens or how it is perceived? High or low.' },
  { title: 'Rate reach', detail: 'How many of your intended audience can they put it in front of? High or low.' },
  { title: 'Place them', detail: 'Drag each note into its quadrant: Champions, Amplifiers, Gatekeepers, Allies.' },
  { title: 'Plan the first three asks', detail: 'For the champions and gatekeepers, what exactly do you ask, and what do they get?' },
];

const ECO_QUADS: { key: string; label: string; fam: Fam; cap: string; noteTitle: string; emoji: string; fill: string; x: number; y: number }[] = [
  { key: 'ch', label: 'Champions', fam: 'violet', cap: 'High influence, high reach. Court them personally; they can make the season.', noteTitle: 'Champion', emoji: '👑', fill: NOTE_VIOLET, x: 40, y: 340 },
  { key: 'am', label: 'Amplifiers', fam: 'ocean', cap: 'Low influence, high reach. Give them something easy to share.', noteTitle: 'Amplifier', emoji: '📡', fill: NOTE_TEAL, x: 700, y: 340 },
  { key: 'ga', label: 'Gatekeepers', fam: 'rose', cap: 'High influence, low reach. Permits, venues, funders. Keep them informed and unsurprised.', noteTitle: 'Gatekeeper', emoji: '🗝️', fill: NOTE_ROSE, x: 40, y: 900 },
  { key: 'al', label: 'Allies', fam: 'emerald', cap: 'Low influence, low reach. Goodwill to maintain with light touch.', noteTitle: 'Ally', emoji: '🌿', fill: NOTE_EMERALD, x: 700, y: 900 },
];

const ecosystemMap: TemplateDefinition = {
  id: 'fw-ecosystem-map',
  name: 'Partner & Channel Ecosystem Map',
  description: 'Place venues, collaborators, platforms and gatekeepers by influence and reach, then plan the asks',
  emoji: '🕸️',
  category: 'framework',
  framework: {
    stage: 'sell',
    origin: 'Our adaptation of stakeholder power–interest mapping, attributed to Aubrey Mendelow (1991), for partnerships and distribution channels',
    whatItIs: 'The Partner & Channel Ecosystem Map sorts everyone who could help an experience reach its audience by two questions: how much influence they have over whether it happens, and how many of the right people they can reach. The four quadrants tell you how to treat each one. It turns a vague "we should partner" into three concrete asks.',
    whenToUse: [
      'Selling an experience into venues, festivals, institutions or brands.',
      'You have more potential partners than time to court them.',
      'A launch depends on permissions or endorsements you do not yet have.',
    ],
    steps: ECO_STEPS,
    pitfalls: [
      'Mistaking friendliness for influence.',
      'Spending the courting effort on allies because they are comfortable to talk to.',
      'Asks with nothing in them for the partner.',
    ],
    assistantBrief: 'Coach the Partner & Channel Ecosystem Map. The canvas has four quadrant zones (Champions, Amplifiers, Gatekeepers, Allies) and a Candidates zone. Help the designer list every venue, collaborator, platform, press contact, community and gatekeeper into Candidates first, one per note. Then rate each on influence over whether and how the experience happens, and on reach into the intended audience, challenging ratings that confuse friendliness with influence. Suggest the quadrant for each note. When placed, focus the designer on champions and gatekeepers: for each, draft a specific ask and what the partner gets in return, and recommend the first three asks to make this month. Suggest turning those asks into task cards when the Plan view is in use.',
  },
  elements: [
    ...fwTitle('fwe', 'Partner & Channel Ecosystem Map', FAM.glacier.grad, 'Influence high on the top row. Reach grows left to right. Drag candidates into place, then plan the asks.'),
    ...stepRail('fwe', ECO_STEPS),
    ...ECO_QUADS.flatMap((q) => [
      ...zone(`fwe-${q.key}`, q.x, q.y, 620, 520, q.label, q.fam, q.cap),
      note(`fwe-${q.key}-n`, q.x + 36, q.y + 140, q.noteTitle, q.emoji, q.fill, 'The ask: …  What they get: …', `fwe-${q.key}`),
    ]),
    ...zone('fwe-c', 1360, 340, 520, 1080, 'Candidates', 'sunset',
      'Everyone who could help this reach its audience. Rate, then drag into a quadrant.'),
    note('fwe-c-n', 1396, 480, 'Candidate', '🧩', WARM_SUN, 'Influence: high / low. Reach: high / low.', 'fwe-c'),
  ] as CanvasElement[],
  edges: [],
};
```

Set the registry to its final order and remove the temporary `void` lines and the `_Fam` alias from Task 2:

```ts
export const FRAMEWORK_TEMPLATES: TemplateDefinition[] = [
  // Think
  iceberg,
  causalLoop,
  theoryOfChange,
  // Ideate
  hmwCrazy8,
  scamper,
  // Plan
  impactEffort,
  premortem,
  // Ship
  workback,
  // Market
  audienceFit,
  narrativeArc,
  // Distribute
  aarrr,
  // Sell
  ecosystemMap,
];
```

Also delete the `export { stepRail, fwTitle };` line if nothing outside the file imports them (nothing in this plan does).

- [ ] **Step 2: Run the verify script and the type-check**

Run: `npx tsx src/lib/__verify__/frameworks-registry.verify.ts`
Expected: `ALL PASS`, exit code 0.

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors (unused-import errors mean a helper from Task 2 is unused; remove the import rather than re-adding a `void`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/templates-frameworks.ts
git commit -m "feat(frameworks): Pirate Metrics Funnel and Partner & Channel Ecosystem Map; registry complete" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Assistant knows the active frameworks; composer ignores them

**Files:**
- Modify: `src/types/ai-types.ts:7-16`
- Modify: `src/utils/ai-context-aggregator.ts:116-134`
- Modify: `src/lib/ai/system-prompts.ts` (new export)
- Modify: `src/app/api/ai/chat/route.ts:244-266`
- Modify: `src/app/api/ai/suggest-template/route.ts:10,122-126`
- Modify: `src/lib/__verify__/frameworks-registry.verify.ts`

- [ ] **Step 1: Extend the verify script first**

At the top of `frameworks-registry.verify.ts` add the import:

```ts
import { getActiveFrameworksBlock, MAX_ACTIVE_FRAMEWORK_BRIEFS } from '../ai/system-prompts';
```

Before the final `console.log(failed === 0 …)` line add:

```ts
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
```

Run: `npx tsx src/lib/__verify__/frameworks-registry.verify.ts`
Expected: fails to compile or run because `getActiveFrameworksBlock` does not exist yet.

- [ ] **Step 2: Add `frameworkIds` to the AI context**

`src/types/ai-types.ts`, inside `AIProjectContext` after `plan: PlanContext;`:

```ts
  /** Framework template ids the project was built from; resolved to briefs server-side. */
  frameworkIds?: string[];
```

`src/utils/ai-context-aggregator.ts`, inside `getFullProjectContext`'s returned object after `plan: buildPlanContext(elements),`:

```ts
    frameworkIds: project.frameworkIds?.length ? [...project.frameworkIds] : undefined,
```

- [ ] **Step 3: Add the block builder to `system-prompts.ts`**

Add the import at the top of `src/lib/ai/system-prompts.ts`:

```ts
import { getFrameworkTemplate } from '@/lib/templates';
```

Add after `getCanvasSystemPrompt`:

```ts
export const MAX_ACTIVE_FRAMEWORK_BRIEFS = 3;

/**
 * Coaching briefs for the most recent frameworks on a project. Ids come from
 * the client; the briefs are resolved here from the static catalog so no
 * method text is ever trusted from the request. Unknown ids are ignored.
 */
export function getActiveFrameworksBlock(frameworkIds: readonly string[] | undefined): string {
  if (!frameworkIds || frameworkIds.length === 0) return '';
  const frameworks = frameworkIds
    .map((id) => getFrameworkTemplate(id))
    .filter((t): t is NonNullable<ReturnType<typeof getFrameworkTemplate>> => !!t)
    .slice(-MAX_ACTIVE_FRAMEWORK_BRIEFS);
  if (frameworks.length === 0) return '';
  const sections = frameworks
    .map((t) => `### ${t.name} (${t.framework!.origin})\n${t.framework!.assistantBrief}`)
    .join('\n\n');
  return `## Active frameworks
The designer built this canvas with the following framework(s). Coach within them: use their vocabulary, keep the steps in order, and when the canvas shows which step they are on, name it and suggest the next one.

${sections}`;
}
```

- [ ] **Step 4: Append the block in the chat route**

In `src/app/api/ai/chat/route.ts`, extend the import on line 8:

```ts
import { getFaceSystemPrompt, getCoreSystemPrompt, getGeneralSystemPrompt, getCanvasSystemPrompt, getActiveFrameworksBlock } from "@/lib/ai/system-prompts";
```

Directly before the `// Append knowledge context if available` comment add:

```ts
    // Frameworks the project was built from: coaching briefs, resolved server-side.
    const frameworksBlock = getActiveFrameworksBlock(projectContext.frameworkIds);
    if (frameworksBlock) {
      systemPrompt += '\n\n' + frameworksBlock;
    }
```

- [ ] **Step 5: Composer uses the framework-free catalog**

In `src/app/api/ai/suggest-template/route.ts` change the import on line 10 to:

```ts
import { COMPOSER_TEMPLATES, FREE_TEMPLATE_IDS } from "@/lib/templates";
```

and the catalog selection to:

```ts
    const availableTemplates =
      getTemplateAccess(callerPlan) === "full"
        ? COMPOSER_TEMPLATES
        : COMPOSER_TEMPLATES.filter((t) => FREE_TEMPLATE_IDS.has(t.id));
```

Search the rest of the file for `TEMPLATES.` (the sanitize step near line 167 looks the id up); replace any remaining `TEMPLATES` reference with `COMPOSER_TEMPLATES`.

- [ ] **Step 6: Verify and type-check**

Run: `npx tsx src/lib/__verify__/frameworks-registry.verify.ts`
Expected: `ALL PASS` including the eight Assistant block checks.

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/types/ai-types.ts src/utils/ai-context-aggregator.ts src/lib/ai/system-prompts.ts src/app/api/ai/chat/route.ts src/app/api/ai/suggest-template/route.ts src/lib/__verify__/frameworks-registry.verify.ts
git commit -m "feat(assistant): coach inside the project's active frameworks; composer skips framework templates" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Framework detail dialog component

**Files:**
- Create: `src/components/cxd/framework-detail-dialog.tsx`

The templates page's `TemplatePreview` is a local function there; this dialog gets its own copy of the same SVG so the component is self-contained.

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Crown, ExternalLink, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FRAMEWORK_STAGE_LABELS } from '@/lib/templates';
import type { TemplateDefinition } from '@/lib/templates';

export type FrameworkDialogMode = 'create' | 'insert' | 'readonly';

interface FrameworkDetailDialogProps {
  /** Must have `framework`; the dialog renders nothing otherwise. */
  template: TemplateDefinition | null;
  open: boolean;
  onClose: () => void;
  mode: FrameworkDialogMode;
  /** Pro-gated and the viewer is on the free tier. Explainer stays readable. */
  locked: boolean;
  onCreate?: (projectName: string) => void;
  onInsert?: () => void;
  onUpgrade?: () => void;
}

/** Root-level layout miniature (containers only), same look as the templates page. */
function LayoutPreview({ template }: { template: TemplateDefinition }) {
  const containers = template.elements.filter(
    (el) => el.type === 'container' && !('containerId' in el && el.containerId),
  );
  if (containers.length === 0) return null;
  const minX = Math.min(...containers.map((c) => c.x));
  const minY = Math.min(...containers.map((c) => c.y));
  const maxX = Math.max(...containers.map((c) => c.x + c.width));
  const maxY = Math.max(...containers.map((c) => c.y + c.height));
  const bw = maxX - minX || 1;
  const bh = maxY - minY || 1;
  const unit = Math.max(bw, bh);
  return (
    <svg viewBox={`0 0 ${bw} ${bh}`} className="w-full h-28" preserveAspectRatio="xMidYMid meet" aria-hidden>
      {containers.map((c) => (
        <rect
          key={c.id}
          x={c.x - minX}
          y={c.y - minY}
          width={c.width}
          height={c.height}
          rx={unit * 0.012}
          fill="rgba(139,92,246,0.10)"
          stroke="rgba(139,92,246,0.30)"
          strokeWidth={unit * 0.005}
          strokeDasharray={`${unit * 0.012} ${unit * 0.008}`}
        />
      ))}
    </svg>
  );
}

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2">{heading}</h3>
      {children}
    </section>
  );
}

export function FrameworkDetailDialog({
  template, open, onClose, mode, locked, onCreate, onInsert, onUpgrade,
}: FrameworkDetailDialogProps) {
  const [projectName, setProjectName] = useState('');

  // Prefill the project name with the framework name each time a template opens.
  useEffect(() => {
    if (open && template) setProjectName(template.name);
  }, [open, template]);

  const fw = template?.framework;
  if (!template || !fw) return null;

  const canSubmit = mode !== 'create' || projectName.trim().length > 0;

  const primary = () => {
    if (locked) { onUpgrade?.(); return; }
    if (mode === 'create') onCreate?.(projectName.trim());
    else if (mode === 'insert') onInsert?.();
    else onClose();
  };

  const primaryLabel = locked
    ? 'Upgrade to use'
    : mode === 'create' ? 'Create canvas'
    : mode === 'insert' ? 'Insert into canvas'
    : 'Close';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }} modal={false}>
      <DialogContent
        className="bg-zinc-900/95 border-white/10 text-white sm:max-w-3xl max-h-[88vh] overflow-hidden flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="text-3xl leading-none shrink-0">{template.emoji}</span>
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                {template.name}
                <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-400/30 text-[10px] font-semibold text-purple-200 uppercase tracking-wide">
                  {FRAMEWORK_STAGE_LABELS[fw.stage]}
                </span>
                {locked && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-[10px] font-semibold text-amber-300 uppercase tracking-wide">
                    <Crown className="w-3 h-3" /> Pro
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-white/50 text-xs mt-1">
                {fw.origin}
                {fw.sourceUrl && (
                  <>
                    {' · '}
                    <a
                      href={fw.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-purple-300 hover:text-purple-200 underline-offset-2 hover:underline"
                    >
                      Source <ExternalLink className="w-3 h-3" />
                    </a>
                  </>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 -mx-1 px-1 py-2">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-6">
            <div className="space-y-6">
              <Section heading="What it is">
                <p className="text-sm text-white/75 leading-relaxed">{fw.whatItIs}</p>
              </Section>
              <Section heading="When to use it">
                <ul className="space-y-1.5">
                  {fw.whenToUse.map((item) => (
                    <li key={item} className="text-sm text-white/70 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-[0.55em] before:w-1.5 before:h-1.5 before:rounded-full before:bg-purple-400/70">
                      {item}
                    </li>
                  ))}
                </ul>
              </Section>
              <Section heading="How to run it">
                <ol className="space-y-3">
                  {fw.steps.map((step, i) => (
                    <li key={step.title} className="flex gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 text-xs font-semibold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">{step.title}</p>
                        <p className="text-sm text-white/60 leading-relaxed">{step.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Section>
              <Section heading="Watch out for">
                <ul className="space-y-1.5">
                  {fw.pitfalls.map((item) => (
                    <li key={item} className="text-sm text-white/70 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-[0.55em] before:w-1.5 before:h-1.5 before:rounded-full before:bg-amber-400/70">
                      {item}
                    </li>
                  ))}
                </ul>
              </Section>
            </div>

            <aside className="md:border-l md:border-white/10 md:pl-6">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2">The canvas you get</h3>
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <LayoutPreview template={template} />
              </div>
              <p className="text-xs text-white/50 mt-3 leading-relaxed">{template.description}. Step cards along the top mirror the steps here, and the Canvas Assistant coaches inside this method.</p>
            </aside>
          </div>
        </div>

        <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-end gap-3">
          {mode === 'create' && !locked && (
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="fw-project-name" className="text-white/70 text-xs">Project name</Label>
              <Input
                id="fw-project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) primary(); }}
                placeholder="Enter project name…"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                autoFocus
              />
            </div>
          )}
          <div className="flex gap-2 justify-end sm:ml-auto">
            <Button variant="ghost" onClick={onClose} className="text-white/60 hover:text-white">
              {mode === 'readonly' ? 'Done' : 'Cancel'}
            </Button>
            {mode !== 'readonly' && (
              <Button
                onClick={primary}
                disabled={!canSubmit}
                className={locked ? 'bg-amber-500/20 border border-amber-400/40 text-amber-200 hover:bg-amber-500/30' : 'btn-primary-glow'}
              >
                {locked ? <Crown className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                {primaryLabel}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/cxd/framework-detail-dialog.tsx
git commit -m "feat(frameworks): framework detail dialog with explainer, layout preview and create/insert footers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Frameworks tab on the templates page

**Files:**
- Modify: `src/app/dashboard/templates/page.tsx`

- [ ] **Step 1: Imports and tabs**

Replace the `@/lib/templates` imports with:

```ts
import {
  TEMPLATES,
  TEMPLATE_CATEGORY_LABELS,
  FRAMEWORK_STAGE_LABELS,
  frameworkTemplatesByStage,
  instantiateTemplate,
  isTemplateFree,
} from '@/lib/templates';
import type { TemplateCategory, TemplateDefinition } from '@/lib/templates';
import { FrameworkDetailDialog } from '@/components/cxd/framework-detail-dialog';
```

Add to `FILTER_TABS`:

```ts
  { key: 'framework', label: 'Frameworks' },
```

- [ ] **Step 2: State and grouping**

After the existing `useState` lines add:

```ts
  const [detailTemplate, setDetailTemplate] = useState<TemplateDefinition | null>(null);
```

Replace the `grouped` memo with:

```ts
  type Group = { key: string; label: string; templates: TemplateDefinition[] };
  const grouped = useMemo<Group[]>(() => {
    if (activeFilter === 'framework') {
      return frameworkTemplatesByStage().map((g) => ({ key: `stage-${g.stage}`, label: g.label, templates: g.templates }));
    }
    const cats: TemplateCategory[] = ['experience', 'product-brand', 'creative', 'framework'];
    return cats
      .map((cat) => ({
        key: cat,
        label: TEMPLATE_CATEGORY_LABELS[cat],
        templates: filtered.filter((t) => t.category === cat),
      }))
      .filter((g) => g.templates.length > 0);
  }, [filtered, activeFilter]);
```

- [ ] **Step 3: Shared create path**

Replace `handleCreate` with:

```ts
  const createFromTemplate = (tpl: TemplateDefinition, name: string) => {
    if (!name.trim()) return;
    if (isLocked(tpl.id)) {
      setShowUpgrade(true);
      return;
    }
    const { elements: freshElements, edges: freshEdges } = instantiateTemplate(tpl);
    // Dashboard pages are protected so the user is authed; the server sync
    // resolves the owner id when no project exists yet.
    const userId = useCXDStore.getState().projects[0]?.ownerId ?? 'pending';
    createProject(name.trim(), userId, freshElements, freshEdges, tpl.framework ? { frameworkIds: [tpl.id] } : undefined);
    setProjectName('');
    setSelectedTemplate(null);
    setDialogOpen(false);
    setDetailTemplate(null);
    router.push('/cxd');
  };

  const handleCreate = () => {
    if (!selectedTemplate) return;
    createFromTemplate(selectedTemplate, projectName);
  };
```

- [ ] **Step 4: Card click, group keys and footer**

In the grid, change `grouped.map((group) => (<div key={group.category} …` to `key={group.key}`.

Replace the card's `onClick` with:

```ts
                    onClick={() => {
                      if (tpl.framework) {
                        setDetailTemplate(tpl);
                        return;
                      }
                      if (locked) {
                        setShowUpgrade(true);
                        return;
                      }
                      setSelectedTemplate(tpl);
                      setProjectName(tpl.name);
                      setDialogOpen(true);
                    }}
```

Inside the card, next to the emoji row, show the stage pill for frameworks. Replace the `<div className="flex items-start gap-3">` block's inner `<p className="text-sm font-semibold …">{tpl.name}</p>` with:

```tsx
                        <p className="text-sm font-semibold text-white group-hover:text-purple-200 transition-colors flex items-center gap-2 flex-wrap">
                          {tpl.name}
                          {tpl.framework && (
                            <span className="px-1.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-400/30 text-[10px] font-semibold text-purple-200 uppercase tracking-wide">
                              {FRAMEWORK_STAGE_LABELS[tpl.framework.stage]}
                            </span>
                          )}
                        </p>
```

Replace the footer text expression `{locked ? 'Upgrade to use' : 'Use template →'}` with:

```tsx
                        {tpl.framework
                          ? (locked ? 'Learn more →' : 'Learn & use →')
                          : (locked ? 'Upgrade to use' : 'Use template →')}
```

- [ ] **Step 5: Mount the detail dialog**

Before `<UpgradeModal` at the end of the JSX add:

```tsx
      <FrameworkDetailDialog
        template={detailTemplate}
        open={detailTemplate !== null}
        onClose={() => setDetailTemplate(null)}
        mode="create"
        locked={detailTemplate ? isLocked(detailTemplate.id) : false}
        onCreate={(name) => detailTemplate && createFromTemplate(detailTemplate, name)}
        onUpgrade={() => { setDetailTemplate(null); setShowUpgrade(true); }}
      />
```

- [ ] **Step 6: Type-check and run the dev server for a visual pass**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

Run: `npm run dev` and open `http://localhost:3000/dashboard/templates`. Check:
- A "Frameworks" tab appears; selecting it shows groups Think, Ideate, Plan, Ship, Market, Distribute, Sell with 3/2/2/1/2/1/1 cards.
- "All Templates" shows a "Frameworks" group after Creative & General.
- Clicking Iceberg Model opens the detail dialog with all four sections and the numbered steps; "Create canvas" with a name lands on a canvas showing the step rail and four zones.
- Clicking a Pro framework as a free user opens the dialog with the explainer readable and an amber "Upgrade to use" button that opens the upgrade modal.
Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/templates/page.tsx
git commit -m "feat(templates): Frameworks tab grouped by stage, detail dialog, framework-aware create" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Frameworks in the in-canvas picker

**Files:**
- Modify: `src/components/cxd/template-picker-modal.tsx`

- [ ] **Step 1: Imports, tab and state**

Change the lucide import to `import { Crown, Info } from 'lucide-react';` and add:

```ts
import { FrameworkDetailDialog } from '@/components/cxd/framework-detail-dialog';
import { FRAMEWORK_STAGE_LABELS } from '@/lib/templates';
```

Add to `FILTER_TABS`:

```ts
  { key: 'framework', label: 'Frameworks' },
```

Inside the component, after `const [showUpgrade, setShowUpgrade] = useState(false);` add:

```ts
  const [detailTemplate, setDetailTemplate] = useState<TemplateDefinition | null>(null);
  const addProjectFramework = useCXDStore((s) => s.addProjectFramework);
```

- [ ] **Step 2: Record the framework on insert**

Inside `handleSelectTemplate`, after `if (edges.length > 0) addCanvasEdges(edges);` add:

```ts
      if (tpl.framework) addProjectFramework(tpl.id);
```

Also at the start of `handleSelectTemplate`, after the `if (!tpl) return;` line, add `setDetailTemplate(null);` so an insert started from the detail dialog closes it.

- [ ] **Step 3: Info icon on framework cards**

Wrap each card so the info button is a sibling of the card button (nested buttons are invalid HTML). Replace the `{filtered.map((tpl) => { … })}` body's returned JSX: change the outer `<button key={tpl.id} …>` to have no `key`, and wrap it:

```tsx
              return (
                <div key={tpl.id} className="relative">
                  {tpl.framework && (
                    <button
                      type="button"
                      aria-label={`About ${tpl.name}`}
                      title="How this framework works"
                      onClick={(e) => { e.stopPropagation(); setDetailTemplate(tpl); }}
                      className="absolute top-3 left-3 z-10 w-6 h-6 rounded-full bg-black/60 border border-white/15 text-white/60 hover:text-purple-200 hover:border-purple-400/40 flex items-center justify-center"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSelectTemplate(tpl.id)}
                    className={`relative w-full flex flex-col rounded-xl border p-4 text-left transition-all group ${
                      locked
                        ? 'border-white/10 bg-white/[0.02] hover:border-amber-400/40 hover:bg-amber-500/5'
                        : 'border-white/10 bg-white/[0.02] hover:border-purple-500/40 hover:bg-purple-500/5'
                    }`}
                  >
                    {/* existing card contents unchanged, except the name row below */}
                  </button>
                </div>
              );
```

Keep the existing card contents inside the inner button. In the name row, replace `<p className="text-sm font-medium text-white group-hover:text-purple-200 transition-colors truncate">{tpl.name}</p>` with:

```tsx
                      <p className="text-sm font-medium text-white group-hover:text-purple-200 transition-colors flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{tpl.name}</span>
                        {tpl.framework && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-400/30 text-[9px] font-semibold text-purple-200 uppercase tracking-wide">
                            {FRAMEWORK_STAGE_LABELS[tpl.framework.stage]}
                          </span>
                        )}
                      </p>
```

- [ ] **Step 4: Mount the detail dialog in insert mode**

Before `<UpgradeModal` add:

```tsx
      <FrameworkDetailDialog
        template={detailTemplate}
        open={detailTemplate !== null}
        onClose={() => setDetailTemplate(null)}
        mode="insert"
        locked={detailTemplate ? isLocked(detailTemplate.id) : false}
        onInsert={() => detailTemplate && handleSelectTemplate(detailTemplate.id)}
        onUpgrade={() => { setDetailTemplate(null); setShowUpgrade(true); }}
      />
```

- [ ] **Step 5: Type-check and visual pass**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

Run: `npm run dev`, open any canvas, open the template picker (the "Add a Template" action). Check:
- Frameworks tab lists 12 cards, each with a stage pill and an info icon top-left.
- Info icon opens the detail dialog; "Insert into canvas" inserts the layout and the picker closes.
- Clicking a framework card directly inserts as before.
- In the browser console run `useCXDStore.getState().getCurrentProject().frameworkIds` if the store is exposed, or reload the project and ask the Canvas Assistant "which step of this framework am I on?". The answer should use the framework's step names.
Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/components/cxd/template-picker-modal.tsx
git commit -m "feat(picker): Frameworks tab, info icon to the detail dialog, record framework on insert" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Changelog, build, final verification

**Files:**
- Modify: `src/data/changelog.ts`

- [ ] **Step 1: Changelog entry**

In `src/data/changelog.ts`, remove `isLatest: true,` from the current first entry (`1.5.0` on this branch) and insert a new first entry. Use the real date of the day you run this task in the same format as the others (for example `'November 3, 2026'`):

```ts
  {
    version: '1.6.0',
    date: '<the date you run this, e.g. November 3, 2026>',
    isLatest: true,
    changes: [
      {
        category: 'feature',
        description: 'Frameworks: a new tab in Templates with 12 guided methods for thinking, ideating, planning, shipping, marketing and selling experiences. Each one explains what it is, when to use it and how to run it, builds a canvas with numbered step cards, and the Canvas Assistant coaches inside it',
      },
      {
        category: 'feature',
        description: 'Iceberg Model, How Might We + Crazy 8s and the Impact–Effort Matrix are free; the rest are Pro, with every explainer readable on any plan',
      },
    ],
  },
```

- [ ] **Step 2: Full verification**

Run: `npx tsx src/lib/__verify__/frameworks-registry.verify.ts`
Expected: `ALL PASS`.

Run: `npm run build`
Expected: build completes with no type or lint errors. Fix anything it reports, re-run.

- [ ] **Step 3: Manual pass (spec §9)**

With `npm run dev`:
1. Templates page, Frameworks tab: groups in stage order, 12 cards, stage pills.
2. Detail dialog on a free framework shows What it is, When to use it, How to run it (numbered), Watch out for, origin line, source link where present, layout preview.
3. Create canvas from Iceberg Model: canvas opens with title, caption, five step cards, four stacked zones with a note each, the Desired Change block, four gradient edges.
4. Pro framework as a free user: explainer readable, amber Upgrade button opens the upgrade modal.
5. In an existing canvas, picker → Frameworks → info icon → Insert: layout lands and the viewport frames it.
6. Canvas Assistant in that canvas: ask "Where am I in this framework and what is next?" The reply uses the framework's step titles.
7. Reload the page: the assistant still knows the framework (ids persisted through the Y.Doc and project_data).

Record anything that fails as a bug and fix it before the final commit.

- [ ] **Step 4: Commit**

```bash
git add src/data/changelog.ts
git commit -m "chore(changelog): 1.6.0 frameworks library" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Hand off**

Push the branch and open a PR against `main` with a summary of the feature, the verification steps run, and a note that this branch is based on `origin/main`, so it will need merging with the uncommitted assistant work (`system-prompts.ts`, `chat/route.ts`, `y-doc-factory.ts`, `changelog.ts`). End the PR body with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do not merge; the user merges via GitHub.
