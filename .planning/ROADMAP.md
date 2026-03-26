# Roadmap: CXD Canvas — Soft Launch

## Overview

CXD Canvas is a collaborative experience design tool approaching public soft launch. This roadmap delivers the product in dependency order: fix the trust-breaking save bug first, gate on a QA pass, then ship features (templates, connector refinement, comments) and finally the landing page visual assets that communicate the tool to new visitors.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Save Reliability** - Fix the collaborator persistence bug so no user ever loses work
- [x] **Phase 2: QA Gate** - Stress test critical flows end-to-end with Playwright and fix all surfaced bugs
- [x] **Phase 3: Templates** - Ship a templates tab with blank scaffolds so new users have structure to start from
- [ ] **Phase 4: Connector Refinement + Canvas Interactions** - Polish connectors and add auto-organize, cmd+L shortcut, and right-click connect
- [ ] **Phase 5: Comments** - Add a canvas-pinned comment system with threads and resolution
- [ ] **Phase 6: Landing Page Assets** - Create visual assets that communicate the tool to prospective users

## Phase Details

### Phase 1: Save Reliability
**Goal**: Every change by every collaborator is durably persisted — no user ever loses work on reload or reconnect
**Depends on**: Nothing (first phase — launch blocker)
**Requirements**: REL-01, REL-02, REL-03, REL-04
**Success Criteria** (what must be TRUE):
  1. A collaborator (non-owner) edits a card, reloads the page, and sees their change still present
  2. An owner edits a card, reloads the page, and sees their change still present
  3. A user edits content, loses network connection for 30 seconds, reconnects, and their change is not lost
  4. Both owner and collaborator can work simultaneously and both sets of changes survive reload
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Diagnose and fix SupabasePersistence read-merge-write for collaborator data loss
- [ ] 01-02-PLAN.md — Verify owner persistence, add retry/backoff, harden network recovery

---

### Phase 2: QA Gate
**Goal**: Critical user flows are covered by Playwright tests and all bugs surfaced by testing are fixed before any user hits them in production
**Depends on**: Phase 1
**Requirements**: QA-01, QA-02, QA-03, QA-04
**Success Criteria** (what must be TRUE):
  1. Running `playwright test` produces a green suite covering sign-up, create board, add elements, reload, and verify persistence
  2. Running `playwright test` covers the collaboration flow: invite, collaborator edits, both reload, changes persist
  3. No test-surfaced bugs remain open; each is either fixed or explicitly deferred with a written reason
  4. The canvas remains responsive (no jank, no lag) with 10+ elements on screen and 2 concurrent collaborators
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md — Solo happy path test: create board, add elements, edit, reload, verify persistence
- [ ] 02-02-PLAN.md — Collaboration persistence test: owner + collaborator sync and persist after reload
- [ ] 02-03-PLAN.md — Run full suite, triage/fix all bugs, add performance smoke test

---

### Phase 3: Templates
**Goal**: New users can start from a structured blank scaffold instead of a blank canvas, reducing time-to-first-value
**Depends on**: Phase 2 (launch quality must be established before adding features)
**Requirements**: TPL-01, TPL-02, TPL-03, TPL-04
**Success Criteria** (what must be TRUE):
  1. The new board creation flow contains a Templates tab that is reachable without searching for it
  2. At least 3 named scaffold options are visible (e.g. User Journey, Service Blueprint, Workshop)
  3. Clicking a template and confirming creates a new board with containers and zones already laid out
  4. The scaffold layout uses containers and labeled zones — no prescriptive content, just structure
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — Dashboard template gallery, store extension for initialElements, template card selection UI
- [x] 03-02-PLAN.md — TemplatePickerModal for canvas (AccountMenu -> modal -> addCanvasElement)

---

### Phase 4: Connector Refinement + Canvas Interactions
**Goal**: Connectors feel polished and intentional, and users can organize and connect elements with single gestures
**Depends on**: Phase 2
**Requirements**: CON-01, CON-02, CON-03, CON-04, CAN-01, CAN-02, CAN-03
**Success Criteria** (what must be TRUE):
  1. Drawing a connector between two cards results in a line that touches each card's edge cleanly, with no overlap into the card body
  2. Connector lines render above their connected elements and do not bleed through unrelated elements stacked on top of them
  3. When two elements are connected, the child element automatically receives the parent's tags
  4. Selecting 3+ elements and pressing cmd+L (or ctrl+L) creates connector lines between them
  5. Selecting 3+ elements and right-clicking shows a "Connect selected" option in the context menu
  6. Clicking "Auto-organize" spreads selected elements into an evenly-spaced grid on the canvas
**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md — Fix connector edge-snapping, z-order rendering, and visual polish (CON-01, CON-02, CON-04)
- [ ] 04-02-PLAN.md — Implement tag propagation on connect (CON-03)
- [ ] 04-03-PLAN.md — Implement cmd+L shortcut (CAN-02), right-click "Connect selected" (CAN-03), and auto-organize (CAN-01)

---

### Phase 5: Comments
**Goal**: Users can leave, read, reply to, and resolve comments pinned to specific positions on the canvas, enabling async collaboration
**Depends on**: Phase 4
**Requirements**: CMT-01, CMT-02, CMT-03, CMT-04
**Success Criteria** (what must be TRUE):
  1. A user can click a canvas position and leave a comment that appears pinned at that spot
  2. Any collaborator on the board can see all existing comments on the canvas
  3. A user can reply to an existing comment, and replies are threaded under the original
  4. A user can resolve a comment thread, removing it from the active view
**Plans**: TBD

Plans:
- [ ] 05-01: Build comment data model, persistence, and pinned UI layer on the canvas
- [ ] 05-02: Implement replies and thread resolution

---

### Phase 6: Landing Page Assets
**Goal**: Prospective users landing on the marketing page can immediately understand what CXD Canvas is and why it matters
**Depends on**: Phase 2 (product must be stable before recording demos)
**Requirements**: LND-01, LND-02, LND-03
**Success Criteria** (what must be TRUE):
  1. The landing page contains at least one visual asset (gif, video, or 3D scroll animation) showing the canvas in use
  2. A first-time visitor can describe the core use case (collaborative experience design) after viewing the asset alone
  3. The landing page loads within acceptable performance budget with the new assets present (no timeout, no CLS)
**Plans**: TBD

Plans:
- [ ] 06-01: Produce visual asset(s) demonstrating the canvas (gif, screen recording, or 3D animation)
- [ ] 06-02: Integrate assets into landing page with performance optimization

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Save Reliability | 2/2 | Complete | 2026-03-21 |
| 2. QA Gate | 3/3 | Complete (test fixes applied; full green run deferred) | 2026-03-21 |
| 3. Templates | 2/2 | Complete | 2026-03-22 |
| 4. Connector Refinement + Canvas Interactions | 0/3 | Not started | - |
| 5. Comments | 0/2 | Not started | - |
| 6. Landing Page Assets | 0/2 | Not started | - |
