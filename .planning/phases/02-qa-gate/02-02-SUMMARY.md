---
phase: 02-qa-gate
plan: 02-02
subsystem: testing
tags: [playwright, e2e, collaboration, persistence, realtime]

requires: []
provides:
  - Collaboration persistence Playwright test suite (Chrome-only, two contexts)
  - Real-time sync + reload persistence verified
affects:
  - 02-03 (triage plan can now run this suite)

tech-stack:
  added: []
  patterns:
    - "browser.newContext() with different storageState for multi-user testing"
    - "self-contained spec files — helpers copied not imported"

key-files:
  created:
    - e2e/collab-persistence.spec.ts
  modified: []

key-decisions:
  - "Two Chrome contexts instead of Chrome + Edge — avoids Edge installation dependency"
  - "Self-contained spec — helpers copied from collab-realtime.spec.ts, not imported"
  - "6s wait after edits for Yjs debounce + Supabase write before reload"

patterns-established:
  - "browser.newContext({ storageState: AUTH_B }) for collaborator context"
  - "waitForLiveText polls body text for real-time sync verification"

duration: ~15min
completed: 2026-03-21
---

# Phase 2 Plan 02: Collaboration Persistence Test Suite

This plan delivers Playwright coverage for the multi-user collaboration flow, filling a gap left by the existing `collab-realtime.spec.ts` which required Microsoft Edge and never verified persistence after reload. The new suite uses two Chromium browser contexts (user-a as owner, user-b as collaborator) to verify that edits propagate live between users AND survive a hard reload — the full collaboration lifecycle end-to-end.

## Accomplishments

- Created `e2e/collab-persistence.spec.ts` with two tests covering the collaboration lifecycle
- Test 1: Collaborator edits a note card, owner sees the edit in real-time (no reload), both users reload, edit is still present for both
- Test 2: Bidirectional editing — owner and collaborator each edit different cards, both reload, both edits survive
- Both tests use two `browser.newContext()` calls with `user-a.json` and `user-b.json` storage states — no Edge browser required
- Helper functions (`openNamedCanvas`, `typeOnNoteCard`, `waitForLiveText`) copied directly into the spec file, not imported — each spec is self-contained
- 3-minute test timeout with generous per-step waits: 3s for Yjs channel establishment, 6s for save debounce + Supabase write, 5s after reload for Yjs + Supabase load
- Falls back to first available shared board if "Collab Test 2" is not found
- Human-verified: test suite ran headed, all assertions passed, persistence confirmed for both users after hard reload

## Task Commits

1. Task 1: `feat(02-02): add Chrome-only collab-persistence Playwright test` — 3021e16

## Files Created/Modified

- `e2e/collab-persistence.spec.ts` — Collaboration persistence test: two Chrome contexts (owner + collaborator) open shared board, collaborator edits note card, owner sees live sync, both reload, edit persists for both. Also covers bidirectional editing. All helpers defined locally (self-contained).

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Two Chrome contexts instead of Chrome + Edge | Edge may not be installed in all environments; two Chromium contexts achieve the same multi-user isolation without cross-browser dependency |
| Copy helpers, do not import | Each spec file must be self-contained — Playwright imports between spec files are fragile and create hidden coupling |
| 6s wait before reload | Yjs save debounce is ~2s, Supabase write adds 1-2s, plus margin — 6s ensures persistence before reload without being flaky |
| 5s wait after reload | Collaborator context reloads from Supabase (no IndexedDB cache from other user) — takes longer than solo reload |
| 180s test timeout | Full flow: two board opens + Yjs establishment (3s) + edit + real-time wait (20s) + 6s debounce + dual reload (5s each) + assertions |
| REALTIME_TIMEOUT = 20s | Yjs Supabase Realtime broadcast latency in test environment; consistent with existing collab-realtime.spec.ts |

## Deviations from Plan

None - plan executed exactly as written. Helper functions were copied from `collab-realtime.spec.ts` as specified, and the test structure matches the plan template exactly.

## Authentication Gates

None. Existing `e2e/.auth/user-a.json` and `e2e/.auth/user-b.json` auth states (from `global.setup.ts`) were reused without any additional authentication steps.

## Next Phase Readiness

Ready for Plan 02-03 (triage run). Both the solo happy path suite (02-01) and the collaboration persistence suite (02-02) are committed and human-verified green. The full QA gate test coverage is in place for the triage execution run.
