# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Teams should never lose their work — every change by every collaborator must be saved reliably.
**Current focus:** Phase 3 — Templates

## Current Position

Phase: 3 of 6 (Templates)
Plan: 1 of TBD in current phase
Status: In progress
Last activity: 2026-03-22 — Completed 03-01-PLAN.md (template scaffold definitions + dashboard gallery)

Progress: [█████░░░░░] ~50%

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: ~19 min
- Total execution time: ~96 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-save-reliability | 2/2 | ~53 min | ~27 min |
| 02-qa-gate | 2/3 | ~35 min | ~18 min |
| 03-templates | 1/TBD | ~8 min | ~8 min |

**Recent Trend:**
- Last 5 plans: ~19 min avg
- Trend: accelerating (simpler feature work vs infrastructure)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Fix save bug before any new features — users losing work is a launch-blocking trust issue
- Playwright for stress testing — already in pipeline, surfaces real bugs pre-launch
- Templates as blank scaffolds — faster to build, gives structure without prescribing content
- Connector v1 = visual refinement + tag propagation — nail the feel before full logic engine
- Comments before drawing/annotation — more collaborative utility for the launch audience
- Create board selector: 'Create New Canvas' button on dashboard; add note selector: toolbar Card > Note Card dropdown

**From 01-01 execution:**
- Use read-merge-write (not optimistic overwrite) in SupabasePersistence.save() — CRDT merge preserves all concurrent edits
- destroy() must be async and await save() before setting destroyed=true to guarantee final flush completes
- flushPendingSave() uses await persist.destroy() as the single sequenced call rather than save+destroy separately

**From 01-02 execution:**
- 6MB Yjs initialization broadcast was the root cause of all realtime collaboration failure — fixed via 'initialization' origin tag in initializeYDoc transact()
- Supabase Realtime silently drops messages over 1MB — MAX_BROADCAST_BYTES = 900KB guard added to all outgoing Yjs messages
- sync2 size cap: oversized sync2 responses skip broadcast; fresh peer loads full state from yjs_state DB column
- Promise.all load order (IndexedDB + Supabase) is CRDT-safe — audited and documented in context file
- Do not retry RLS/permission errors (code 42501) — they won't resolve on their own

**From 03-01 execution:**
- UUID refresh on template instantiation: reassign all element IDs via crypto.randomUUID() to prevent ID collisions between projects from the same template
- viewMode='canvas' when initialElements provided: template projects skip wizard, go straight to canvas
- containerStyle typed as ElementStyle (not inline with 'as const') — avoids cast gymnastics for borderStyle literal

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-22
Stopped at: Completed 03-01-PLAN.md (template scaffold definitions + dashboard gallery)
Resume file: None
