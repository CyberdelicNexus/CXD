---
phase: "03-templates"
plan: "01"
subsystem: "templates"
tags: ["templates", "dashboard", "canvas", "zustand", "next.js"]

dependency-graph:
  requires:
    - "01-save-reliability"
    - "02-qa-gate"
  provides:
    - "Template scaffold definitions (User Journey, Service Blueprint, Workshop Canvas)"
    - "Extended createProject accepting initialElements"
    - "Template gallery UI in dashboard"
  affects:
    - "03-02 (future template plans)"

tech-stack:
  added: []
  patterns:
    - "Template definitions as plain data arrays in src/lib/"
    - "Optional param forwarding through factory function to store action"
    - "UUID refresh pattern for template element IDs on instantiation"

key-files:
  created:
    - "src/lib/templates.ts"
    - ".planning/phases/03-templates/03-01-SUMMARY.md"
  modified:
    - "src/types/cxd-schema.ts"
    - "src/store/cxd-store.ts"
    - "src/components/dashboard-content.tsx"

decisions:
  - id: "template-element-id-refresh"
    decision: "Reassign all element IDs via crypto.randomUUID() at instantiation time"
    rationale: "Template definitions use stable IDs (uj-1, sb-1 etc.) — two projects from same template would share element IDs causing collisions in Yjs/Zustand"
  - id: "viewmode-conditional"
    decision: "Set viewMode to 'canvas' when initialElements provided, 'wizard' otherwise"
    rationale: "Templates pre-populate the canvas so wizard flow is redundant; skip to canvas directly"
  - id: "containerStyle-typed"
    decision: "Use ElementStyle type for containerStyle constant rather than inline object"
    rationale: "Ensures borderStyle literal 'dashed' is typed correctly without 'as const' casting"

metrics:
  duration: "~8 min"
  completed: "2026-03-22"
  tasks-completed: 3
  tasks-total: 3
---

# Phase 3 Plan 01: Template Scaffold Definitions Summary

**One-liner:** Three scaffold templates (User Journey, Service Blueprint, Workshop Canvas) as ContainerElement arrays, instantiated via extended createProject with UUID refresh and direct canvas entry.

## What Was Built

### Task 1 - Template Definitions (`src/lib/templates.ts`)

Created `TemplateDefinition` interface and `TEMPLATES` array with 3 entries:

- **User Journey** - 5 horizontal stage containers (Awareness → Reflection), each 350x500
- **Service Blueprint** - 4 horizontal layer containers (Customer Actions → Support Processes), each 1800x200
- **Workshop Canvas** - 6 containers in 2 rows of 3 (Objective/Participants/Outputs + 3 Activities)

All containers use `ElementStyle` with dashed white border and near-transparent background for scaffold appearance. Verified `ContainerElement` supports `label?` and `style?: ElementStyle` before writing.

### Task 2 - Extended createProject (`cxd-schema.ts`, `cxd-store.ts`)

- `createDefaultProject` accepts optional 4th param `initialElements?: CanvasElement[]`
- `canvasLayout` initialized with `elements: initialElements ? [...initialElements] : []` and `edges: []`
- Store `createProject` interface and implementation updated to forward `initialElements`
- `viewMode` set to `'canvas'` when elements provided (skip wizard), `'wizard'` otherwise

### Task 3 - Template Gallery Dashboard (`dashboard-content.tsx`)

- Added `LayoutTemplate` icon and template imports
- Added 3 state vars for template dialog management
- Added `handleCreateFromTemplate` function that refreshes element IDs via `crypto.randomUUID()` before creating project
- Added "Start from a Template" section after the 70/30 grid with 3 card grid (emoji, name, description, "Use template →" CTA)
- Added template name dialog (pre-filled with template name, editable) with Enter key support

## Verification

- `npx tsc --noEmit`: no errors in new/modified files (pre-existing test file errors unrelated)
- `npm run build`: succeeded, all routes compiled cleanly
- `Blank canvas creation`: unchanged - createProject with no initialElements still sets viewMode to 'wizard'

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] containerStyle type annotation**

- **Found during:** Task 1
- **Issue:** Plan used `borderStyle: 'dashed' as const` inline cast; cleaner to type the constant as `ElementStyle` directly
- **Fix:** Added `: ElementStyle` type annotation to `containerStyle` constant, removed inline `as const` cast
- **Files modified:** `src/lib/templates.ts`

None other - plan executed as written.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| UUID refresh on instantiation | Prevents element ID collisions between projects from same template |
| viewMode='canvas' when elements provided | Templates pre-populate canvas; wizard flow redundant |
| ElementStyle typed containerStyle | Avoids 'as const' cast gymnastics for borderStyle literal |

## Next Phase Readiness

Phase 03-02 can build on:
- `TEMPLATES` array from `src/lib/templates.ts` (add more templates)
- `createProject` now accepts `initialElements` (usable from any future template entry point)
- Dashboard gallery pattern established (can extend with categories, search, preview thumbnails)

No blockers.
