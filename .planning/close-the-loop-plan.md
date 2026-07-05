# Close the Loop — CXD Product Plan

**Date:** 2026-07-02
**Thesis:** CXD's moat is not the canvas — it's the opinionated pipeline
(intent → multi-dimensional design → production). Today the three pillars are
islands: the wizard doesn't populate the canvas, hypercube tagging is fully
manual, and canvas→plan sync is partial. Every handoff that works automatically
is a "no other tool does this" moment. This plan makes the handoffs real.

---

## Phase 1 — Wizard → Canvas population (fulfil the brief's promise)

The landing page says: *"Click 'Explore Canvas' and your framing populates the
workspace automatically."* Today `completeWizard()` only flips a flag.

**Build:**
- A `framingToCanvas(project)` generator that converts wizard answers into a
  tagged canvas structure: one tinted container per framing section, text
  elements seeded with the user's actual answers (not empty prompts), laid out
  in the CXD_SECTIONS spatial arrangement that already exists in
  `cxd-schema.ts`.
- Elements auto-tagged to their hypercube face via the existing
  `SECTION_TO_TAG` map (hexagon-view.tsx) — the moment the user opens the Map
  tab, the cube is already populated. This is the wow-moment demo.
- Insert through `addCanvasElements` (the batched `template-batch` path), so it
  reuses the freeze-proof template machinery.

**Effort:** ~3–5 days. **Dependency:** none — all machinery exists.
**Note:** this generator IS a template whose content comes from wizard answers —
design it together with the P2 template system so both use one element-composition
layer.

## Phase 2 — AI as methodology engine (shared with P2 templates)

The AI already knows the frameworks (per-face system prompts) but cannot act.
One capability unlocks three features:

**Build:**
- `/api/ai/generate-elements` using Vercel AI SDK `generateObject()` with a
  `CanvasElement[]` JSON schema (subset: containers, text, shapes, connectors,
  boards) + server-side validation + credit deduction like existing routes.
- Consumers:
  1. **Template generator** — "Generate a template for a 3-day retreat" in the
     template picker (P2).
  2. **Chat → canvas** — "place this on the canvas" action in the AI panel
     (extends the existing AIActionBar task/note extraction).
  3. **Wizard enrichment** — optional "let AI draft this section" inside the
     framing wizard.

**Effort:** ~1–2 weeks for the route + first two consumers.
**Dependency:** none technically; template design language from the P2
brainstorm (user is preparing exemplar templates) should inform the generation
prompts so AI output matches hand-made template quality.

## Phase 3 — AI-suggested hypercube tagging

Manual tagging is the adoption cliff for the Hypercube — most canvases stay
untagged, so the differentiator never lights up.

**Build:**
- Batch endpoint: given untagged elements' text, suggest face tags
  (classification, cheap model, low credits).
- UI: "Suggest tags" in the Map tab → review chips → accept all / per-element.
- Keep it propose-only (same philosophy as the auto-fix loop).

**Effort:** ~1 week. **Dependency:** Phase 2 route infrastructure.

## Phase 4 — Canvas ↔ Plan sync hardening

The brief promises bidirectional sync. Gaps found in review:
- Inbox tasks created from Plan view get position (0,0) and weak linkage.
- Version deletion / task metadata edge cases (partially fixed in P1 —
  `yjsDeleteVersion` now scrubs task tags).
- Gantt has no virtualization and timezone-naive date math
  (`setHours(0,0,0,0)`) — will misbehave for non-UTC-adjacent users and slow
  down at scale.

**Build:** task↔element identity audit, date-handling pass (store dates as
ISO date-only strings, format in user TZ), Gantt row virtualization.
**Effort:** ~1 week.

## Phase 5 — Own the deliverable (export / presentation mode)

The ICPs (facilitators, agencies, consultants) get paid to present experience
designs to clients. Make CXD produce that deliverable:
- Shareable, beautiful read-only "Experience Brief" page: framing summary,
  hypercube face views, journey flow, plan timeline.
- PDF export of the same.
- This is what durably justifies Pro pricing; it also markets the tool (every
  shared brief is a CXD ad, like Loom links).

**Effort:** ~2 weeks. **Dependency:** none; share-page infra exists.

---

## Sequencing vs. agreed priority ladder

- **P2 (templates + AI build)** = Phase 2 + template gallery/onboarding work.
- **P3 (hypercube responsive + wizard templates)** should fold in Phase 1 —
  wizard→canvas population and wizard template-ification touch the same files;
  do Phase 1 first (smaller, delivers the wow), then the ~800-LOC
  template-driven wizard refactor.
- Phase 3–5 slot after P3, before/alongside P4 (auto-fix loop), by appetite.

## Marketing tie-ins (from the product brief)

- Phase 1 delivers the demo the brief already sells ("framing populates the
  workspace"). Short-form video: wizard → canvas populates → cube rotates.
- Phase 2 makes the "AI Design Assistant" claim true.
- Phase 5 creates the case-study artifact the brief lists as a content gap
  ("what a Framing Wizard output looks like on Day 1 vs. production launch").
