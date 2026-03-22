---
phase: 02-qa-gate
plan: 02-03
subsystem: testing
tags: [playwright, triage, bug-fixes, deferred]

# Dependency graph
requires: ["02-01", "02-02"]
provides:
  - Bug triage document with all known test failures documented
  - Canvas viewport interaction fixes across all e2e test files
  - force:true added to all canvas element clicks
  - fitAll() updated to use waitFor() instead of count() check
  - scrollIntoViewIfNeeded() removed from all typeOnNoteCard functions

affects:
  - Phase 3 (Templates) — proceeding without full green suite; test infrastructure built

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canvas viewport fix: force:true on all dblclick/click for CSS-transformed elements"
    - "fitAll reliability: waitFor({ state: 'visible', timeout: 5000 }) instead of count() > 0"
    - "scrollIntoViewIfNeeded() removed — does not work for CSS transform-positioned canvas elements"

key-files:
  created:
    - .planning/phases/02-qa-gate/02-BUG-TRIAGE.md
  modified:
    - e2e/solo-happy-path.spec.ts
    - e2e/collab-persistence.spec.ts
    - e2e/collab-realtime.spec.ts
    - e2e/persistence.spec.ts

key-decisions:
  - "Deferred full green run — test fixes applied but not re-verified; moving to Phase 3 per user decision"
  - "Root cause: canvas CSS transforms prevent viewport-based interactions without force:true or fitAll"
  - "collab-realtime.spec.ts deferred: Edge IS installed but test has same canvas interaction issue; covered by collab-persistence.spec.ts"

# Metrics
duration: ~30min
completed: 2026-03-21
---

# Phase 2 Plan 3: Run Suite + Triage — Summary

**Applied targeted fixes to all e2e test files to resolve canvas viewport interaction failures. Full green run deferred per user decision to proceed to Phase 3.**

## Accomplishments

### Fixes Applied to All Test Files

1. **`fitAll()` reliability**: Changed from `count() > 0` instant check to `waitFor({ state: 'visible', timeout: 5000 })` — the navigation toolkit renders asynchronously after Canvas mode switch and wasn't available when checked immediately.

2. **`force: true` on all canvas clicks**: Added to `titleInput.click()` in `solo-happy-path.spec.ts` and `persistence.spec.ts` — canvas elements positioned via CSS transforms are outside the viewport; `force: true` bypasses the viewport check.

3. **Removed `scrollIntoViewIfNeeded()`**: Removed from `typeOnNoteCard()` in `collab-persistence.spec.ts`, `collab-realtime.spec.ts`, and `persistence.spec.ts` — native `scrollIntoView` does not work for elements positioned via CSS transforms on a canvas container.

### Triage Document

Created `.planning/phases/02-qa-gate/02-BUG-TRIAGE.md` documenting:
- All 5 bugs found and fixed
- 4 deferred issues with reasons
- Root cause analysis (canvas CSS transform viewport issue)
- Phase 2 QA summary

## Deviations from Plan

Full green run was deferred per user decision. Test infrastructure is built and fixes are applied; verification will be done when returning to QA after Phase 3.

## Next Phase Readiness

- Save reliability verified (Phase 1) ✓
- Test infrastructure built (Phase 2) ✓
- Moving to Phase 3: Templates
