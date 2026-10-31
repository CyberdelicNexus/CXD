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
