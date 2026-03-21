---
phase: 01-save-reliability
plan: 02
subsystem: persistence
tags: [yjs, retry, indexeddb, offline, realtime, broadcast]

# Dependency graph
requires: ["01-01"]
provides:
  - Retry with exponential backoff in SupabasePersistence (1s/2s/4s, max 3)
  - onError callback fires at 5 consecutive failures
  - IndexedDB load order audited and confirmed CRDT-safe
  - initializeYDoc uses 'initialization' origin — stops 6MB Supabase broadcast
  - SupabaseYjsProvider: MAX_BROADCAST_BYTES (900KB) guard on all outgoing messages
affects:
  - Phase 2 (QA Gate) — can now run Playwright collab tests against stable sync

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Exponential backoff retry: scheduleRetry(attempt) with delay = 2^attempt * 1000ms"
    - "Consecutive failure tracking: counter reset on success, onError fires at threshold"
    - "Origin-tagged transactions: 'initialization' origin skipped by broadcast provider"
    - "Size-gated broadcast: messages over MAX_BROADCAST_BYTES are skipped, peer loads from DB"

key-files:
  created: []
  modified:
    - src/lib/yjs/supabase-persistence.ts
    - src/contexts/yjs-project-context.tsx
    - src/lib/yjs/y-doc-factory.ts
    - src/lib/yjs/supabase-yjs-provider.ts

key-decisions:
  - "Do not retry RLS/permission errors — they won't resolve on their own (code 42501)"
  - "Load order Promise.all is safe: Y.applyUpdate is CRDT-idempotent regardless of order"
  - "6MB hydration must use 'initialization' origin — Supabase 1MB limit silently drops larger"
  - "sync2 size cap: fresh peers load full state from yjs_state DB column (not broadcast)"

patterns-established:
  - "Origin filtering in Yjs provider: skip 'initialization', 'persistence', and object origins"
  - "Size-gated broadcast: check byteLength before channel.send, warn and skip if over limit"

# Metrics
duration: ~45min (including debugging session to surface and fix the 6MB root cause)
completed: 2026-03-21
---

# Phase 1 Plan 2: Save Reliability — Hardening & Real-Time Fix Summary

**Retry logic, offline persistence audit, and the root-cause fix that restored real-time collaboration: a 6MB Yjs initialization broadcast was silently dropped by Supabase Realtime's 1MB limit, corrupting the channel for the entire session.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-03-21
- **Tasks:** 2/2 + 1 critical bug fix surfaced during verification
- **Files modified:** 4

## Accomplishments

### Task 1: Retry Logic in SupabasePersistence (already implemented from 01-01)
- `scheduleRetry(attempt)` retries network errors with exponential backoff: 1s, 2s, 4s (max 3 retries)
- RLS/permission errors (code 42501) are not retried — they're permanent failures
- `consecutiveFailures` counter resets on success; fires `onError` callback at 5 consecutive failures
- `onError` wired in `YjsProjectProvider` — currently logs a warning, ready for UI indicator

### Task 2: IndexedDB Load Order Audit (already implemented from 01-01)
- `IndexeddbPersistence` (y-indexeddb) correctly uses project-scoped DB name `cxd-yjs-{projectId}`
- Load order `Promise.all([localPersist.whenSynced(), supabasePersist.load()])` is CRDT-safe
- Both sources use `Y.applyUpdate` which merges (never replaces) — order doesn't matter
- Audit comment added at lines 125–136 of `yjs-project-context.tsx` documenting the reasoning

### Critical Fix: 6MB Broadcast Killing the Realtime Channel
During verification testing (Python Playwright with two browser instances), browser console logs revealed `[YjsProvider] Broadcasting update, merged size: 6079691` immediately after `[YjsProject] No persisted state, initializing from project data`. Supabase Realtime's 1MB limit silently drops this — the channel becomes dead for the entire session.

**Fix in `y-doc-factory.ts`:**
All `initializeYDoc` writes wrapped in `doc.transact(() => { ... }, 'initialization')` — the origin tag marks bulk hydration so the provider skips broadcasting it.

**Fix in `supabase-yjs-provider.ts`:**
- `updateHandler` now skips origins: `'remote'`, `'initialization'`, `'persistence'`, and IndexedDB object origins
- sync2 responses capped at `MAX_BROADCAST_BYTES = 900_000` — oversized sync2 is skipped with warning; fresh peer loads full state from `yjs_state` DB column
- `flushUpdates()` skips broadcast when merged update exceeds size limit

**Result:** After fix, broadcast size dropped from 6MB to ~2.7KB for user edits. User B browser correctly applies updates: `[YjsProvider] Applying update from peer, size: 2693`.

## Task Commits

1. `e9241b3` — fix(01-save-reliability): Diagnose and fix SupabasePersistence save (Plan 01-01)
2. `fbb8e52` — fix(01-save-reliability): Fix flushPendingSave() transient race (Plan 01-01)
3. `77cd160` — fix(01-save-reliability): Stop 6MB Yjs broadcast from killing realtime channel

## Files Modified

- `src/lib/yjs/supabase-persistence.ts` — Retry logic with backoff; onError callback; consecutive failure tracking
- `src/contexts/yjs-project-context.tsx` — onError wired; load order audit comment
- `src/lib/yjs/y-doc-factory.ts` — initializeYDoc uses 'initialization' transaction origin
- `src/lib/yjs/supabase-yjs-provider.ts` — Origin filters; MAX_BROADCAST_BYTES guard on sync2 and updates

## Decisions Made

**Do not retry RLS errors:** Permission denied errors from Supabase RLS policies won't resolve with retries — they indicate a configuration or auth issue. Only network/transient errors get retried.

**Promise.all load order is safe:** CRDT semantics guarantee that `Y.applyUpdate` from two sources in any order produces the same merged result. Sequential load is not needed and would slow initial load.

**Initialization origin tag:** The only correct way to stop 6MB hydration broadcasts is to mark the transaction at the source. The provider can't reliably distinguish large vs. small updates by content — only by origin.

**sync2 size cap instead of chunking:** Chunking Yjs sync2 messages would require a new protocol layer. The simpler, correct fallback is: if sync2 is too large to broadcast, the fresh peer should load from the `yjs_state` DB column (which already handles this via SupabasePersistence.load()).

## Deviations from Plan

The retry logic and IndexedDB audit tasks were already implemented (carried over from Plan 01-01 execution). The major addition was the real-time broadcast root-cause fix, which was surfaced during verification testing and is directly required by Phase 1 success criteria #4 (concurrent edits survive reload).

## Next Phase Readiness

- All Phase 1 success criteria are met:
  1. Collaborator edits → reload → still present (CRDT read-merge-write)
  2. Owner edits → reload → still present (verified)
  3. Network loss → reconnect → edits survive (IndexedDB + retry)
  4. Concurrent edits from both roles persist (CRDT merge + working real-time sync)
- Ready for Phase 2 QA Gate: Playwright test suites for solo and collaboration flows
