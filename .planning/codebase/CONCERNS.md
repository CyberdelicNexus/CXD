# Codebase Concerns

**Analysis Date:** 2025-02-18

## Tech Debt

### In-Place Project Mutations During Migration
- Issue: `getCurrentProject()` in `src/store/cxd-store.ts` (lines 421-499) mutates the project object in-place during migration, rather than creating a new object. This causes `getCurrentProject()` to return a new reference on subsequent calls even when the project hasn't changed, breaking memoization and selector stability.
- Files: `src/store/cxd-store.ts`
- Impact: Infinite re-render loops in components using selectors with `getCurrentProject()` as a dependency. Previously caused "Maximum update depth exceeded" errors.
- Fix approach: Create immutable copy via `structuredClone()` before mutations, or wrap migration in a setter that updates the projects array with the mutated copy.

### Snapshot-Based Undo/Redo with Full Deep Clone
- Issue: `pushCanvasHistory()` in `src/store/cxd-store.ts` (lines 2448-2476) uses `JSON.parse(JSON.stringify(elements/edges))` for deep cloning, which is inefficient for large canvases. This blocks the UI thread during serialization/deserialization of complex graph structures.
- Files: `src/store/cxd-store.ts`
- Impact: UI lag on undo/redo operations with large projects. Performance degrades with canvas size.
- Fix approach: Replace with structured cloning via `structuredClone()` or implement CRDT-based undo (already partially implemented with Yjs UndoManager path).

### Dual History Systems (Snapshot + Yjs UndoManager)
- Issue: `undo()` and `redo()` in `src/store/cxd-store.ts` (lines 2478-2535) maintain two parallel undo/redo systems: snapshot-based and CRDT-based. The snapshot system is a fallback but adds maintenance complexity and potential for state divergence.
- Files: `src/store/cxd-store.ts`
- Impact: Confusion about which undo path is active, potential inconsistencies if Yjs bridge is partially initialized, doubled state management burden.
- Fix approach: Fully migrate to Yjs UndoManager and remove snapshot-based fallback, or commit fully to snapshot-based approach by deprecating Yjs integration.

## Known Bugs

### Canvas Drag-and-Drop Inbox Items Not Reactive
- Symptoms: Inbox items don't update when added/removed from the canvas during drag operations. Stale `inboxItems` list causes drops to fail or create duplicates.
- Files: `src/components/cxd/cxd-canvas.tsx` (drag-drop handler around line ~700), `src/store/cxd-store.ts` (inbox item filtering)
- Trigger: Drag an item from the inbox to the canvas. New items added to inbox during the drag won't be selectable.
- Workaround: Currently mitigated by having `placeItem` read directly from `useCXDStore.getState()` instead of relying on closure-captured state.
- Root cause: `getAllInboxItems()` is a stable Zustand function reference. When wrapped in `useMemo([], [])`, it returns stale data forever. Using `useMemo(() => ..., [project])` creates infinite loop due to project mutation.

### CanvasElementRenderer onUpdate Re-Fire Cascade
- Symptoms: Sub-components (FreeformCard, TextCard, etc.) trigger multiple renders on every parent render because `onUpdate` prop is an inline arrow function with new reference each time.
- Files: `src/components/cxd/canvas/canvas-element.tsx` (prop definition at component level)
- Trigger: Any parent re-render causes all sub-components to re-fire their `useEffect` hooks that depend on `onUpdate`.
- Workaround: Create stable `onUpdate` via `useRef` and `useCallback` pattern (documented in memory.md).
- Root cause: Inline `(updates) => syncUpdateElement(el.id, updates)` creates new closure every render.

### Zustand Selector Infinite Loop on Undefined Arrays
- Symptoms: Infinite re-renders when selectors return fallback empty arrays (`elements || []`, `edges || []`) because Zustand treats each returned array as a new reference.
- Files: `src/store/cxd-store.ts`, any selector using `getCurrentProject()?.canvasLayout?.elements || []`
- Trigger: Any component using such a selector when `elements` is undefined.
- Workaround: Fixed by ensuring `getCurrentProject()` initializes `elements: []` and `edges: []` during migration (lines 480-485).
- Root cause: Zustand's shallow equality doesn't detect that `new [] === new []` is false.

## Security Considerations

### API Key Encryption and Storage
- Risk: User API keys (OpenAI, Anthropic, Google, Moonshot) stored encrypted in database. If encryption key leaks, all keys are compromised.
- Files: `src/app/api/ai/chat/route.ts` (lines 95-105), `src/lib/encryption.ts`, `src/lib/ai/provider-registry.ts`
- Current mitigation: Keys encrypted with `decryptAPIKey()` using environment variable key. BYOK feature gates on plan tier.
- Recommendations: Implement key rotation policy. Add audit logging for API key access. Consider using envelope encryption with per-user key derivation. Document key management procedures.

### Supabase Authentication Bypass Risk
- Risk: All API routes check `supabase.auth.getUser()` but don't validate session token expiry or refresh token validity. If session is compromised, attacker can access all user data.
- Files: All routes in `src/app/api/` (e.g., `src/app/api/stripe/create-checkout/route.ts` line 8, `src/app/api/ai/chat/route.ts` line 19)
- Current mitigation: Supabase handles session management server-side. RLS policies on database tables.
- Recommendations: Add explicit session validation with maximum age. Log auth failures. Implement rate limiting per user ID.

### Stripe Webhook Signature Validation Missing
- Risk: Stripe webhook handler doesn't validate webhook signature, allowing attacker to forge payment/subscription events.
- Files: `src/app/api/webhooks/stripe/route.ts`
- Current mitigation: None detected in webhook route.
- Recommendations: Implement `stripe.webhooks.constructEvent()` with webhook secret. Verify event signature before processing.

### Sensitive Data in Error Messages
- Risk: Console error logs may contain user IDs, project IDs, or PII. Error responses sent to client may leak internal system details.
- Files: `src/app/api/` routes (generic error responses present), `src/store/cxd-store.ts` (console.error calls)
- Current mitigation: Most errors are generic ("Failed to create checkout session"), some log to console for debugging.
- Recommendations: Use structured logging with separate debug vs. production error levels. Strip PII from client-facing errors. Never log request bodies containing sensitive data.

## Performance Bottlenecks

### Large Canvas Rendering with Many Elements
- Problem: Canvas with 100+ elements and edges renders all at once. No viewport culling or virtualization.
- Files: `src/components/cxd/cxd-canvas.tsx` (main render loop), `src/components/cxd/canvas/line-layer.tsx`
- Cause: Every element and edge is rendered regardless of visibility. Line layer recalculates all edge paths on every project change.
- Improvement path: Implement viewport-based culling to skip rendering elements outside visible bounds. Use React.memo with deep equality checks on element props. Implement edge path memoization.

### Deep Cloning in State Updates
- Problem: `JSON.parse(JSON.stringify())` used for cloning in multiple places (undo/redo, OKR carry-forward in lines 2414-2434). Blocks UI on large data structures.
- Files: `src/store/cxd-store.ts` (lines 2414-2434, 2458)
- Cause: JSON serialization/deserialization is synchronous and can't handle circular references or certain data types (e.g., Map, Set).
- Improvement path: Use `structuredClone()` for better performance. Consider implementing a custom deep clone with early termination. For undo/redo, use CRDT-based approach.

### Zustand Store with 50+ State Slices
- Problem: `cxd-store.ts` is 2579 lines with deeply nested selectors and actions. Every selector runs on every store update.
- Files: `src/store/cxd-store.ts`
- Cause: Single monolithic store without sectioning. No selector optimization (e.g., `reselect` or manual memoization).
- Improvement path: Split store into logical slices (canvas state, project state, UI state) using Zustand's combine or separate stores. Add selector factory with memoization. Profile with React DevTools Profiler to identify re-render hotspots.

### Yjs Awareness Updates on Every Cursor Move
- Problem: Collaboration awareness updates fire on every mousemove, sending network traffic for cursor updates even when cursor hasn't moved much.
- Files: `src/lib/yjs/y-zustand-bridge.ts`, `src/components/collaboration/collaborator-cursors.tsx`
- Cause: No throttling or debouncing of awareness updates.
- Improvement path: Throttle awareness updates (e.g., 100ms). Only send update if cursor moved >10px. Use requestAnimationFrame to batch updates.

## Fragile Areas

### Inbox Drag-and-Drop State Management
- Files: `src/components/cxd/cxd-canvas.tsx` (drag handlers ~line 700-900)
- Why fragile: Drag handlers read from `experienceDropCtxRef` (updated every render) but `inboxItems` list is captured at drag start. If items added to inbox during drag, drop handler doesn't know about them. Current code calls `placeItem` unconditionally and reads fresh state, but this is a workaround not a fix.
- Safe modification: Keep `handleDrop` reading from `useCXDStore.getState()` for fresh inbox items. Add bounds checking before accessing element properties. Test with rapid add/delete of inbox items during drag.
- Test coverage: No test coverage for drag-drop interactions.

### Canvas History and Undo/Redo
- Files: `src/store/cxd-store.ts` (lines 2447-2535)
- Why fragile: Two undo systems (snapshot + Yjs). History array has fixed max size (50 entries). If history is at max and new entry added, oldest is shifted off without cleanup. On redo after undo, future history is discarded (lines 2464).
- Safe modification: Before modifying undo logic, add comprehensive tests for: undo/redo sequences, history limits, project switches (history should reset or be scoped per project). Add guards checking `canvasHistoryIndex` bounds.
- Test coverage: No test coverage for undo/redo state machine.

### Experience Flow Stage Migrations
- Files: `src/store/cxd-store.ts` (lines 425-456)
- Why fragile: Multiple migrations stacked (old stage format → new, old presence keys → new, missing fields). Each migration modifies `project` object in-place. If migration logic changes, old projects may have partially-applied state.
- Safe modification: Create a versioned migration system (v1, v2, v3) that's idempotent. Test migrations with actual old project data. Add a migration rollback/reset option for debugging.
- Test coverage: No test coverage for migrations.

### Yjs Bridge Synchronization
- Files: `src/lib/yjs/y-zustand-bridge.ts`, `src/contexts/yjs-project-context.tsx` (lines 101-128)
- Why fragile: Bridge initialization is async (loads from IndexedDB, then Supabase). Between load completion and bridge start, state could diverge. If Supabase load fails, fallback to project data, but bridge may not reflect all changes from other clients.
- Safe modification: Add explicit state reconciliation after bridge starts. Implement conflict resolution for simultaneous local and remote changes. Test with simulated network failures.
- Test coverage: No test coverage for CRDT synchronization.

### Real-Time Collaboration with Awareness
- Files: `src/components/collaboration/collaborator-cursors.tsx`, `src/lib/yjs/y-zustand-bridge.ts`
- Why fragile: Awareness updates depend on network connectivity. If connection drops, stale cursors remain visible. No heartbeat or cleanup of dead clients.
- Safe modification: Implement awareness cleanup with timeout (e.g., 30s without update = remove cursor). Add reconnection logic with exponential backoff. Test with network latency simulations.
- Test coverage: No test coverage for collaboration.

## Scaling Limits

### Zustand Store Memory with Large Projects
- Current capacity: Tested up to ~1000 canvas elements before noticeable slowdown. No known upper limit tested.
- Limit: At ~5000+ elements, entire project stored in memory causes browser tab to use 500MB+ RAM. Store mutations trigger full object re-creation in Zustand.
- Scaling path: Implement pagination/lazy-loading for canvas elements. Split elements into "viewport chunks" fetched on demand. Implement Supabase stream subscriptions for real-time partial updates instead of full project syncs.

### Yjs Document Size and WebSocket Overhead
- Current capacity: Yjs documents with 10K+ operations sync fine over local network. Remote (cloud) sync may lag with >100KB Y.Doc binary size.
- Limit: No built-in compression or cleanup of old operations. Y.Doc grows monotonically as operations accumulate (no garbage collection of old deletions).
- Scaling path: Implement periodic Y.Doc snapshots + garbage collection to truncate operation history. Use WebSocket compression (e.g., permessage-deflate). Implement client-side operation batching.

### Database Queries on Large Projects
- Current capacity: Projects with 1000+ canvas elements and 100+ versions load ~2-3 seconds from Supabase.
- Limit: No query optimization (no indexes on frequently-filtered columns like `user_id`, `project_id`). No pagination of results. Entire project fetched on every load.
- Scaling path: Add database indexes on `user_id`, `project_id`, `created_at`. Implement incremental sync (delta updates) instead of full project re-fetches. Add query caching with TTL.

## Test Coverage Gaps

### Canvas State Management
- What's not tested: Element CRUD operations, drag-drop interactions, undo/redo state machine, multi-selection logic, z-order operations.
- Files: `src/components/cxd/cxd-canvas.tsx`, `src/store/cxd-store.ts`
- Risk: Bugs in core canvas operations silently accumulate. Regressions on undo/redo not caught until user reports.
- Priority: **High** - Core user interaction path.

### Collaboration and Yjs Synchronization
- What's not tested: Bridge synchronization, awareness updates, conflict resolution, network failure recovery, concurrent edits from multiple clients.
- Files: `src/lib/yjs/y-zustand-bridge.ts`, `src/contexts/yjs-project-context.tsx`, `src/components/collaboration/`
- Risk: Collaboration features untested in development. Users discover bugs in production. Data corruption possible if sync logic has race conditions.
- Priority: **High** - Safety-critical for multi-user editing.

### API Authentication and Authorization
- What's not tested: Rate limiting, Stripe webhook validation, API key encryption/decryption, session expiry, RLS policy enforcement.
- Files: `src/app/api/`, `src/lib/stripe.ts`
- Risk: Security vulnerabilities not caught before deployment. Unauthorized access possible if auth checks are missing.
- Priority: **Critical** - Security-sensitive.

### Data Migrations
- What's not tested: Project version migrations, schema upgrades, rollback scenarios, migration idempotency.
- Files: `src/store/cxd-store.ts` (getCurrentProject migrations)
- Risk: Old projects corrupt on upgrade. Migration code runs multiple times, causing duplicate data.
- Priority: **High** - Data integrity at risk.

### Error Handling and Edge Cases
- What's not tested: Network failures, missing required fields, invalid data types, database connection failures, file upload errors.
- Files: All API routes, async operations in store
- Risk: Unhandled errors crash the app or leave it in inconsistent state. Users lose work.
- Priority: **Medium** - User experience impact.

---

*Concerns audit: 2025-02-18*
