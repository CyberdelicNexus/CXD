# Requirements: CXD Canvas — Soft Launch

**Defined:** 2026-03-18
**Core Value:** Teams should never lose their work — every change by every collaborator must be saved reliably.

## v1 Requirements

### Reliability

- [x] **REL-01**: Collaborator changes are persisted to the database (not just synced in-session)
- [x] **REL-02**: Owner changes are persisted reliably after every edit
- [x] **REL-03**: Changes survive page reload for both owner and collaborator roles
- [x] **REL-04**: No progress is lost on network interruption (reconnection recovers pending changes)

### Quality Assurance

- [ ] **QA-01**: Playwright tests cover the critical happy path: sign up → create board → add elements → save → reload → verify persistence
- [ ] **QA-02**: Playwright tests cover collaboration: owner invites collaborator → collaborator edits → both see changes → both reload → changes persist
- [ ] **QA-03**: Bugs surfaced by stress testing are triaged and fixed before launch
- [ ] **QA-04**: Canvas performance is acceptable under realistic load (10+ elements, 2+ collaborators)

### Templates

- [x] **TPL-01**: Templates tab is accessible from the new board creation flow
- [x] **TPL-02**: At least 3 blank structure scaffolds are available (e.g. User Journey, Service Blueprint, Workshop)
- [x] **TPL-03**: Selecting a template creates a new board pre-populated with the scaffold layout
- [x] **TPL-04**: Scaffolds use containers and zones to define structure without prescribing content

### Connectors

- [ ] **CON-01**: Connector lines snap to the outside edge of elements (not center/overlapping)
- [ ] **CON-02**: Connector lines render above the elements they connect, but respect z-order of unrelated elements layered above them (connectors do not bleed through everything)
- [ ] **CON-03**: Connecting two elements automatically propagates the parent element's tags to the child
- [ ] **CON-04**: Visual style of connectors is polished (smooth curves, clean arrowheads)

### Canvas Interactions

- [ ] **CAN-01**: Auto-organize button spreads selected elements into a grid layout on the canvas
- [ ] **CAN-02**: cmd+L (or ctrl+L) connects currently selected elements with a connector line
- [ ] **CAN-03**: Right-click context menu includes "Connect selected" option when multiple elements are selected

### Comments

- [ ] **CMT-01**: User can leave a comment pinned to a position on the canvas
- [ ] **CMT-02**: User can view all comments on a board
- [ ] **CMT-03**: User can reply to an existing comment
- [ ] **CMT-04**: Comment threads can be resolved/dismissed

### Landing Page

- [ ] **LND-01**: Landing page includes at least one visual asset (gif, video, or 3D scroll animation) demonstrating the canvas
- [ ] **LND-02**: Visual asset clearly communicates the core use case (collaborative experience design)
- [ ] **LND-03**: Landing page loads within acceptable performance budget with new assets

## v2 Requirements

### Drawing & Annotation

- **DRW-01**: User can draw freehand annotations on the canvas
- **DRW-02**: Annotations can be erased or cleared
- **DRW-03**: Annotation layer can be toggled on/off

### Connector Logic

- **CLOG-01**: Connectors have typed inputs/outputs (condition, trigger, etc.)
- **CLOG-02**: AI can traverse the connector graph to reason about element relationships
- **CLOG-03**: Connector paths can be labeled

### Templates (Extended)

- **TPL-05**: Curated example boards with real content (not just blank scaffolds)
- **TPL-06**: Community-contributed templates

## Out of Scope

| Feature | Reason |
|---------|--------|
| Freehand drawing/annotation | Deferred to v2 — comments are higher priority for launch |
| Full node-based logic engine | Complex; v1 scope is visual + tag propagation only |
| Mobile app | Web-first; mobile deferred |
| OAuth login | Email/password + Supabase auth is sufficient for launch |

## Traceability

See: .planning/ROADMAP.md for full phase goals and success criteria.

| Requirement | Phase | Phase Name | Status |
|-------------|-------|------------|--------|
| REL-01 | Phase 1 | Save Reliability | Complete |
| REL-02 | Phase 1 | Save Reliability | Complete |
| REL-03 | Phase 1 | Save Reliability | Complete |
| REL-04 | Phase 1 | Save Reliability | Complete |
| QA-01 | Phase 2 | QA Gate | Pending |
| QA-02 | Phase 2 | QA Gate | Pending |
| QA-03 | Phase 2 | QA Gate | Pending |
| QA-04 | Phase 2 | QA Gate | Pending |
| TPL-01 | Phase 3 | Templates | Pending |
| TPL-02 | Phase 3 | Templates | Pending |
| TPL-03 | Phase 3 | Templates | Pending |
| TPL-04 | Phase 3 | Templates | Pending |
| CON-01 | Phase 4 | Connector Refinement + Canvas Interactions | Complete |
| CON-02 | Phase 4 | Connector Refinement + Canvas Interactions | Complete |
| CON-03 | Phase 4 | Connector Refinement + Canvas Interactions | Complete |
| CON-04 | Phase 4 | Connector Refinement + Canvas Interactions | Complete |
| CAN-01 | Phase 4 | Connector Refinement + Canvas Interactions | Complete |
| CAN-02 | Phase 4 | Connector Refinement + Canvas Interactions | Complete |
| CAN-03 | Phase 4 | Connector Refinement + Canvas Interactions | Complete |
| CMT-01 | Phase 5 | Comments | Pending |
| CMT-02 | Phase 5 | Comments | Pending |
| CMT-03 | Phase 5 | Comments | Pending |
| CMT-04 | Phase 5 | Comments | Pending |
| LND-01 | Phase 6 | Landing Page Assets | Pending |
| LND-02 | Phase 6 | Landing Page Assets | Pending |
| LND-03 | Phase 6 | Landing Page Assets | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-21 after Phase 1 completion*
