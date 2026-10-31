# Frameworks Library: Design

**Status:** approved in brainstorming on 2026-10-31.
**Builds on:** the template system (`src/lib/templates.ts`, `src/lib/templates.design.md`), the Canvas Assistant (`2026-09-09-canvas-ai-assistant-design.md`), and the free-tier gating in `src/lib/plans.ts`.
**Branch:** `feat/frameworks-library`.

## 1. Problem

CXD has become a context-engineering tool for experience design: the canvas, the framing wizard and the assistant hold the project's thinking. Some users want more guidance on *how* to think. Today the template catalog offers starting layouts (19 templates, three categories) but nothing teaches a method. Lean Canvas and Brainstorm Board are framework-shaped, yet they ship with a one-line description and no explanation of what the framework is, when it applies, or how to run it. The assistant does not know a method is in play, so it cannot coach within it.

## 2. Goals

- A curated library of proven frameworks that help users think, ideate, plan, ship, market, distribute and sell experiences.
- Each framework ships three things that say the same thing: an **explainer** (what, when, steps, pitfalls, origin), a **canvas template** with numbered step cards, and an **assistant brief** that lets the Canvas Assistant coach inside that method.
- The library lives where templates already live, as a fourth tab, and follows the existing gating model.
- Non-goals for this release: a CMS for frameworks, user-authored frameworks, more than one layout per framework, framework-specific assistant tools. Each is possible later on top of this design.

## 3. Roster (12 frameworks, first release)

| Stage | id | Name | Fit for experience design | Free |
|---|---|---|---|---|
| think | fw-iceberg | Iceberg Model | Diagnose below the visible event: patterns, structures, mental models | yes |
| think | fw-causal-loop | Causal Loop Map | Reinforcing and balancing loops drawn with canvas edges | no |
| think | fw-theory-of-change | Theory of Change | Backward chain from the lasting trait to states, activities and inputs; mirrors CXD's state-to-trait core | no |
| ideate | fw-hmw-crazy8 | How Might We + Crazy 8s | Reframe the challenge into questions, then rapid sketch rounds | yes |
| ideate | fw-scamper | SCAMPER | Seven transformation lenses on an existing experience | no |
| plan | fw-impact-effort | Impact–Effort Matrix | Prioritise ideas in a 2×2 before committing | yes |
| plan | fw-premortem | Pre-mortem | Imagine the launch failed, list causes, convert to safeguards | no |
| ship | fw-workback | Work-back Plan | Backward schedule from the live date with milestones and owners | no |
| market | fw-audience-fit | Audience Fit Map | What the audience is trying to do, avoid and gain, matched to real moments in the experience | no |
| market | fw-narrative-arc | Narrative Messaging Arc | Seven-beat hero-story structure for pitches and landing pages, our own structure, inspired by hero's-journey storytelling | no |
| distribute | fw-aarrr | Pirate Metrics Funnel | Acquisition to revenue, one lane per stage with tactics and a metric | no |
| sell | fw-ecosystem-map | Partner & Channel Ecosystem Map | Venues, collaborators, platforms and gatekeepers by influence and reach | no |

Content rules:

- Every explainer carries an `origin` line crediting the originator.
- Protected frameworks are never copied. Strategyzer's Value Proposition Canvas is under copyright and needs Strategyzer AG's permission for use in software (https://strategyzer.com/legal/usage-of-our-tools, confirmed 2026-10-31), so the roster carries our own Audience Fit Map, with original wording and layout and a credit to the source book. "Narrative Messaging Arc" uses its own beat names and credits Building a StoryBrand once in its origin line; STORYBRAND is a US trademark, so that name, SB7 and BrandScript never appear in titles or beats.
- Explainers are written for a practitioner designing an experience, not a generic business reader: examples reference installations, retreats, events, performances.

## 4. Data model

### 4.1 Template type (`src/lib/templates.ts`)

```ts
export type TemplateCategory = 'experience' | 'product-brand' | 'creative' | 'framework';

export type FrameworkStage = 'think' | 'ideate' | 'plan' | 'ship' | 'market' | 'distribute' | 'sell';

export const FRAMEWORK_STAGE_LABELS: Record<FrameworkStage, string> = {
  think: 'Think', ideate: 'Ideate', plan: 'Plan', ship: 'Ship',
  market: 'Market', distribute: 'Distribute', sell: 'Sell',
};

export interface FrameworkStep { title: string; detail: string }

export interface FrameworkMeta {
  stage: FrameworkStage;
  origin: string;            // attribution line, e.g. "Gary Klein, 2007"
  sourceUrl?: string;        // canonical public reference when one exists
  whatItIs: string;          // 2–3 sentences
  whenToUse: string[];       // 3–4 bullets
  steps: FrameworkStep[];    // 4–7; the canvas template has one step card per entry, same titles
  pitfalls: string[];        // 2–4 bullets
  assistantBrief: string;    // ~150 words, imperative, for the system prompt
}

export interface TemplateDefinition {
  // existing fields unchanged
  framework?: FrameworkMeta;  // present iff category === 'framework'
}
```

`TEMPLATE_CATEGORY_LABELS` gains `framework: 'Frameworks'`.

### 4.2 Registry

- New file `src/lib/templates-frameworks.ts` exports `FRAMEWORK_TEMPLATES: TemplateDefinition[]` (12 entries) using the factories already exported from `templates-quickstart.ts` (`title`, `caption`, `zone`, `note`, `edge`, step cards). It is appended to `TEMPLATES` after the classics.
- `FREE_TEMPLATE_IDS` adds `fw-iceberg`, `fw-hmw-crazy8`, `fw-impact-effort`.
- Helpers added to `templates.ts`:
  - `getFrameworkTemplate(id): TemplateDefinition | undefined` (category must be `framework`).
  - `getFrameworkBrief(id): string | undefined` returns `framework.assistantBrief`.
  - `FRAMEWORK_TEMPLATES_BY_STAGE` for the grouped view.

### 4.3 Project (`src/types/cxd-schema.ts`)

```ts
frameworkIds?: string[];  // framework template ids this project was built from or had inserted; deduped, max 5, insertion order
```

- `createProject(name, ownerId, initialElements?, initialEdges?, options?: { frameworkIds?: string[] })`: the new fifth argument is optional so existing callers are untouched. `createDefaultProject` takes the same optional field.
- New store action `addProjectFramework(id: string)`: appends to the current project's `frameworkIds` with dedupe and cap, then persists through the normal save path. No Yjs schema change beyond a new optional scalar array on the project map.

### 4.4 Composer exclusion

`src/app/api/ai/suggest-template/route.ts` filters `t.category !== 'framework'` before building its catalog. The composer picks an experience structure after framing; it does not pick a thinking method.

## 5. UI

### 5.1 Templates page (`src/app/dashboard/templates/page.tsx`)

- `FILTER_TABS` gains `{ key: 'framework', label: 'Frameworks' }`.
- When the active filter is `framework`, grouping is by `FrameworkStage` in the fixed order think → sell, using `FRAMEWORK_STAGE_LABELS` as group headers. In the `all` view frameworks appear as one group "Frameworks" after Creative & General.
- Framework cards reuse the template card. Differences: a small stage pill (`text-[10px] uppercase`) next to the emoji, and the footer reads "Learn & use →" (locked: "Learn more →").
- Clicking a framework card opens the **Framework detail dialog** (below) instead of the naming dialog. Non-framework cards behave exactly as today.

### 5.2 Framework detail dialog (new `src/components/cxd/framework-detail-dialog.tsx`)

Props: `template: TemplateDefinition` (must have `framework`), `open`, `onClose`, `mode: 'create' | 'insert' | 'readonly'`, `locked: boolean`, `onCreate?(name)`, `onInsert?()`.

Layout (single column on mobile, two on `md+`):

- Header: emoji, name, stage pill, `origin` line in muted text with `sourceUrl` as a link when present.
- Body sections in order: **What it is**, **When to use it** (bullets), **How to run it** (numbered steps, title bold, detail below), **Watch out for** (bullets).
- Right/top: the existing `TemplatePreview` SVG so users see the layout they will get.
- Footer by mode:
  - `create`: project name input (prefilled with the framework name) + "Create canvas" button. Enter submits.
  - `insert`: "Insert into canvas" button.
  - `readonly`: "Close".
  - `locked` in any mode: the explainer stays readable; the primary button becomes "Upgrade to use" and opens `UpgradeModal` with `feature="templates"`.

Styling follows the existing dialog (`bg-zinc-900/95 border-white/10`), purple accents, amber for locked.

### 5.3 In-canvas picker (`src/components/cxd/template-picker-modal.tsx`)

- `FILTER_TABS` gains Frameworks; the list groups frameworks under one "Frameworks" header (stage shown as a pill, no sub-grouping, to keep the picker compact).
- Clicking a framework card inserts as today **and** calls `addProjectFramework(tpl.id)`.
- Each framework card has an info icon (`Info` from lucide, top-left) that opens the detail dialog in `insert` mode, so the user can read first and insert from there.

### 5.4 Create flow

The templates page's `handleCreate` passes `{ frameworkIds: [tpl.id] }` when the selected template is a framework. The project opens in canvas view as today because it has seed elements.

## 6. Assistant integration

- `AIProjectContext` (`src/types/ai-types.ts`) gains `frameworkIds?: string[]`. `getFullProjectContext` in `src/utils/ai-context-aggregator.ts` copies it from the project.
- The chat route (`src/app/api/ai/chat/route.ts`) resolves briefs **server-side** with `getFrameworkBrief` and appends a block to the system prompt in general, core and canvas modes. Client text is never trusted as a brief. At most three briefs, in insertion order.

```
## Active frameworks
The designer built this canvas with the following framework(s). Coach within them: use their vocabulary, keep the steps in order, and when the canvas shows which step they are on, name it and suggest the next one.

### Pre-mortem (Gary Klein, 2007)
<assistantBrief>
```

- Unknown or non-framework ids are ignored silently.
- No change to credits, tools or the apply-to-canvas path.

## 7. Canvas templates (authoring rules)

Each framework template follows `templates.design.md` in full, plus:

- **Spine matches the method.** Rail for sequential methods (Work-back Plan, Pre-mortem, Narrative Arc, AARRR), hub for comparative ones (Impact–Effort, Audience Fit, SCAMPER around the subject), vertical rail for the Iceberg's four layers.
- **Step cards.** A rail of small dark step cards, one per `framework.steps` entry, numbered in the title ("1 · Surface the events"), placed along the spine's top or left edge. Titles must equal `steps[i].title`; the verify script checks this.
- **Seeds.** Every zone ships one note seed with the zone's prompt as `noteTitle` and a one-line placeholder body.
- **Edges.** Causal Loop Map uses labelled gradient edges with `+`/`−` labels and two pre-drawn loops (one reinforcing, one balancing). Theory of Change runs edges right-to-left from the trait back to inputs.
- **Anchors.** Theory of Change anchors on the `traitMapping` experience block; Audience Fit Map on `humanContext`; Iceberg on `desiredChange`. Others have no framing anchor.
- Element count 18–32. Coordinates on the 20px grid, no overlapping root elements.

## 8. Research and authoring process

1. **Research** (first task of the implementation plan). One web-research pass per framework: originator and date, canonical steps, two or three widely cited failure modes, licence or trademark status. Written to `docs/superpowers/research/2026-10-31-frameworks-research.md` with one section per framework and source links. Explainers are written only from this document.
2. **Explainers and briefs** authored in `templates-frameworks.ts` first.
3. **Templates** authored second, step titles copied from the explainer.
4. **UI and assistant plumbing** last, since they are generic over the registry.

## 9. Verification

- **Registry check** `src/lib/__verify__/frameworks-registry.ts` (run with `npx tsx`): for every `category === 'framework'` template assert `framework` present; 4–7 steps; one step card per step with matching title; `whenToUse` 3–4 and `pitfalls` 2–4 entries; `assistantBrief` 80–220 words; `origin` non-empty; root elements do not overlap; coordinates multiples of 20; every edge endpoint resolves; id starts with `fw-`. Also assert the three free ids are in `FREE_TEMPLATE_IDS` and no framework id reaches the composer catalog.
- **Build**: `npm run build` passes.
- **Manual pass**: Frameworks tab renders grouped by stage; detail dialog shows all sections; create from a free framework opens a canvas with the step rail; locked framework shows explainer and Upgrade button; picker inserts and records `frameworkIds`; assistant answers a "where am I in this method?" question inside a framework canvas using the framework's step names.

## 10. Files touched

| File | Change |
|---|---|
| `src/lib/templates.ts` | category, stage, `FrameworkMeta`, helpers, free ids, append registry |
| `src/lib/templates-frameworks.ts` | new, 12 definitions |
| `src/types/cxd-schema.ts` | `frameworkIds`, `createDefaultProject` option |
| `src/store/cxd-store.ts` | `createProject` options arg, `addProjectFramework` |
| `src/types/ai-types.ts`, `src/utils/ai-context-aggregator.ts` | `frameworkIds` in context |
| `src/app/api/ai/chat/route.ts`, `src/lib/ai/system-prompts.ts` | active-frameworks block |
| `src/app/api/ai/suggest-template/route.ts` | exclude frameworks |
| `src/app/dashboard/templates/page.tsx` | tab, stage grouping, detail dialog hookup |
| `src/components/cxd/framework-detail-dialog.tsx` | new |
| `src/components/cxd/template-picker-modal.tsx` | tab, info icon, record framework |
| `src/lib/__verify__/frameworks-registry.ts` | new |
| `docs/superpowers/research/2026-10-31-frameworks-research.md` | new, research output |
| `src/data/changelog.ts` | entry for the release |
