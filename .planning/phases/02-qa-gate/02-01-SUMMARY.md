---
phase: 02-qa-gate
plan: 02-01
subsystem: testing
tags: [playwright, e2e, solo, persistence, happy-path]

requires: []
provides:
  - Solo happy path Playwright test suite (create board, add elements, edit, reload, verify)
  - playwright.config.ts updated for CI headless mode
affects:
  - 02-03 (triage plan can now run this suite)

tech-stack:
  added: []
  patterns:
    - "selector discovery from source before writing tests"
    - "headless CI via process.env.CI || process.env.HEADLESS"

key-files:
  created:
    - e2e/solo-happy-path.spec.ts
  modified:
    - playwright.config.ts

key-decisions:
  - "Skip sign-up automation — email confirmation blocks e2e without inbox access"
  - "Board creation uses 'Create New Canvas' button discovered from dashboard source"
  - "Add note via toolbar Card button > Note Card dropdown, then click canvas to place"

patterns-established:
  - "test.skip(true, 'reason') pattern for documenting manually-verified flows"
  - "Selector constants as named consts at top of file with source discovery comments"

duration: ~20min
completed: 2026-03-21
---

# Phase 2 Plan 01: Solo Happy Path Test Suite

This plan delivers the first end-to-end coverage of the critical solo user journey: navigate to the dashboard, create a fresh board, add three note cards via the toolbar, edit each card with unique timestamped text, hard-reload the page, and assert every edited text is still present. This fills the gap left by the existing `persistence.spec.ts`, which only edited pre-existing cards on a pre-existing board and never exercised board creation or element addition through the UI.

## Accomplishments

- Created `e2e/solo-happy-path.spec.ts` covering the full solo flow from dashboard to persistence verification
- Discovered concrete selectors from app source (`dashboard-content.tsx`, `canvas-toolkit.tsx`, `FreeformCard`) before writing any test code — no placeholder strings
- Board creation uses the "Create New Canvas" dialog (trigger button + `#project-name` input + "Create Map" submit)
- Note cards added via the two-step toolbar interaction: Card tool button opens dropdown, "Note Card" option selected, then canvas clicked to place
- Editing uses `dblclick` to enter editing mode and `input[data-no-drag]` as the title input selector
- Sign-up flow documented as manually verified with `test.skip(true, 'reason')` inside a normal `test()` block — explains email confirmation limitation and future automation path
- Updated `playwright.config.ts` headless flag to `!!process.env.CI || !!process.env.HEADLESS` for CI pipeline support
- Test uses 180s timeout with generous per-step waits (5s canvas init, 6s persistence debounce, 5s Yjs reload)
- Human-verified: test suite ran headed, all assertions passed, persistence confirmed after hard reload

## Task Commits

1. Task 1: `feat(02-01): add solo happy path Playwright test suite` — 16dd04a

## Files Created/Modified

- `e2e/solo-happy-path.spec.ts` — Solo happy path test: create board from dashboard, add 3 note cards via toolbar, edit with timestamped text, reload, assert persistence. Includes skipped sign-up stub with documented reason.
- `playwright.config.ts` — Updated headless option to `!!process.env.CI || !!process.env.HEADLESS` for CI and local headless mode support.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Skip sign-up automation | Supabase email confirmation cannot be automated in e2e tests without inbox access (Mailhog/Mailtrap or admin API needed) |
| Board creation selector: `button:has-text("Create New Canvas")` | Discovered from `dashboard-content.tsx` — the DialogTrigger button text |
| Note card selector: toolbar Card button > "Note Card" dropdown | Discovered from `canvas-toolkit.tsx` — two-step dropdown interaction required |
| Title input: `input[data-no-drag]` | Discovered from `FreeformCard` — data attribute used to prevent drag interference with input |
| 180s test timeout | Multi-step flow: dashboard load + canvas init (5s) + 3 card placements + 6s debounce + 5s reload |
| No cleanup of test boards | Cleanup logic is fragile and out of scope for v1; test boards left in dashboard |

## Deviations from Plan

None - plan executed exactly as written. All selectors were discovered from source and replaced the placeholder `'...'` strings before committing.

## Authentication Gates

None. Existing `e2e/.auth/user.json` auth state (from `global.setup.ts`) was reused without any additional authentication steps.

## Next Phase Readiness

Ready for Plan 02-02 (collab smoke test) and Plan 02-03 (triage run). The solo happy path suite is committed and human-verified green. The `playwright.config.ts` CI headless support is in place for 02-03's triage run.
