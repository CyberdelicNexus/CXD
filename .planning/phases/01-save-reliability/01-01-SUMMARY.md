---
phase: 01-save-reliability
plan: 01
subsystem: database
tags: [yjs, crdt, supabase, persistence, collaboration]

# Dependency graph
requires: []
provides:
  - CRDT-safe read-merge-write save in SupabasePersistence
  - flush() method for immediate tab-close persistence
  - Fixed destroy() lifecycle (save completes before teardown)
  - visibilitychange and beforeunload listeners in YjsProjectProvider
  - Race-free flushPendingSave() in use-project-sync
affects:
  - 01-save-reliability plan 02 (any further reliability work)
  - Any feature using SupabasePersistence or flushPendingSave

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-merge-write for CRDT persistence: always fetch current state, merge with local, write merged result"
    - "Async destroy pattern: await final I/O operation before setting destroyed flag"
    - "Flush on tab-hide: visibilitychange + beforeunload wired at Y.Doc provider level"

key-files:
  created: []
  modified:
    - src/lib/yjs/supabase-persistence.ts
    - src/contexts/yjs-project-context.tsx
    - src/hooks/use-project-sync.ts

key-decisions:
  - "Use read-merge-write (not optimistic overwrite) in save() to preserve concurrent edits from all collaborators"
  - "destroy() must be async and await save() before setting destroyed=true to guarantee final flush completes"
  - "flushPendingSave uses await persist.destroy() as the single sequenced call rather than save+destroy separately"

patterns-established:
  - "CRDT merge pattern: create mergeDoc, apply persisted state, apply local state, encode merged result, write back"
  - "flush() = cancel debounce timer + call save() immediately"

# Metrics
duration: 8min
completed: 2026-03-18
---

# Phase 1 Plan 1: Save Reliability — Persistence Fix Summary

**CRDT read-merge-write replaces blind overwrite in SupabasePersistence, eliminating the root cause of collaborator changes being lost on page reload.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-18T18:59:30Z
- **Completed:** 2026-03-18T19:08:00Z
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments

- Replaced blind `encodeStateAsUpdate → update()` save with a read-merge-write cycle: fetch DB state, merge with local CRDT, write merged result — no concurrent changes from any client are ever lost
- Fixed `destroy()` lifecycle bug where `destroyed = true` was set before the final `save()` call, making the final save a no-op
- Added `flush()` method to `SupabasePersistence` and wired `visibilitychange`/`beforeunload` listeners in `YjsProjectProvider` so Yjs state is persisted immediately when the tab is hidden or the page unloads
- Eliminated the `flushPendingSave()` race where `persist.save()` was called without await, then `persist.destroy()` ran immediately and terminated the in-flight save

## Task Commits

Each task was committed atomically:

1. **Task 1: Diagnose the persistence failure and fix SupabasePersistence save** - `e9241b3` (fix)
2. **Task 2: Fix flushPendingSave() transient SupabasePersistence race** - `fbb8e52` (fix)

## Files Created/Modified

- `src/lib/yjs/supabase-persistence.ts` - Replaced blind overwrite with CRDT read-merge-write in save(); added flush(); made destroy() async to await final save before setting destroyed=true
- `src/contexts/yjs-project-context.tsx` - Wired visibilitychange and beforeunload listeners calling flush(); updated cleanup() comment noting async destroy pattern
- `src/hooks/use-project-sync.ts` - Replaced unsequenced save()+destroy() with await persist.destroy() to eliminate race condition

## Decisions Made

**Read-merge-write instead of optimistic overwrite:**
The old `save()` encoded only local Y.Doc state and wrote it directly. If collaborator A saved at T=1 and owner B saved at T=2 using only their local state, A's changes were silently erased. CRDT merging means both states are always preserved regardless of save order.

**async destroy() pattern:**
Setting `destroyed = true` first and then calling `save()` is a classic guard-before-action bug — `save()` checks `if (this.destroyed) return` immediately. The fix reverses the order: detach the listener, await the save, then set destroyed. This guarantees the final flush succeeds.

**Single await destroy() in flushPendingSave:**
The transient SupabasePersistence instance created in flushPendingSave only needs to do one thing: save and clean up. `await persist.destroy()` sequences these correctly in a single call, relying on the fixed destroy() implementation.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — all three bugs were clearly diagnosed from code inspection before any changes were made.

## Next Phase Readiness

- Both owner and collaborator saves now use CRDT merge — changes from concurrent sessions survive reload
- Tab-close and page-hide now trigger immediate Yjs flush
- Ready for Phase 1 Plan 2 (if any further save reliability work is planned)
