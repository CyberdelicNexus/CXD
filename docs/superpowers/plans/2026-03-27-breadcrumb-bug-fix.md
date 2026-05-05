# Breadcrumb Bug Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the breadcrumb display bug where breadcrumb text duplicates in the navbar even though the canvas state is correct.

**Architecture:** The breadcrumbs render from `boardPath` in the Zustand store. The `enterBoard` function pushes entries, and the path is persisted via Zustand's persist middleware. The bug is likely duplicate entries in `boardPath` caused by either double-firing of `enterBoard`, Yjs sync replaying entries, or the persist middleware restoring stale state. We'll add deduplication guards, investigate the root cause, and add defensive rendering.

**Tech Stack:** TypeScript, React, Zustand, Yjs

---

### Task 1: Investigate and Reproduce the Bug

**Files:**
- Read: `src/store/cxd-store.ts` (enterBoard, exitBoard, navigateToBoardPath)
- Read: `src/components/cxd/cxd-navbar.tsx` (breadcrumb rendering)
- Read: `src/components/cxd/canvas/canvas-element.tsx` (board double-click handler)

- [ ] **Step 1: Add diagnostic logging to enterBoard**

In `src/store/cxd-store.ts`, add a console.warn inside the `enterBoard` action to log every call:

```typescript
enterBoard: (boardId, title) => {
  const { boardPath, saveCurrentViewport, restoreViewport } = get();

  // DEBUG: Track enterBoard calls
  console.warn('[BREADCRUMB DEBUG] enterBoard called:', {
    boardId,
    title,
    currentPathLength: boardPath.length,
    currentPath: boardPath.map(b => b.title),
    lastEntry: boardPath[boardPath.length - 1],
  });

  // Save current canvas viewport before entering new board
  saveCurrentViewport();

  set({
    activeBoardId: boardId,
    currentBoardId: boardId,
    boardPath: [...boardPath, { id: boardId, title }],
  });
},
```

- [ ] **Step 2: Test the reproduction**

Run the app, navigate into nested boards, and check the console for duplicate `enterBoard` calls. Look for:
- Same `boardId` appearing twice consecutively
- `enterBoard` firing more than once per board click
- Path length growing faster than expected

Run: `npm run dev`
Open browser console and navigate through boards.

- [ ] **Step 3: Document findings**

Note which scenario produces duplicates:
- Single board entry? Back-and-forth navigation? Page refresh?
- Is it the `enterBoard` firing twice or the persist middleware restoring old state on top?

- [ ] **Step 4: Commit diagnostic logging**

```bash
git add src/store/cxd-store.ts
git commit -m "debug: add breadcrumb diagnostic logging to enterBoard"
```

---

### Task 2: Add Deduplication Guard to enterBoard

**Files:**
- Modify: `src/store/cxd-store.ts`

- [ ] **Step 1: Add duplicate entry guard**

In the `enterBoard` action, add a check before pushing to `boardPath`. If the last entry already has the same `boardId`, skip the push:

```typescript
enterBoard: (boardId, title) => {
  const { boardPath, saveCurrentViewport, restoreViewport } = get();

  // Guard: skip if already at this board (prevents duplicate entries)
  const lastEntry = boardPath[boardPath.length - 1];
  if (lastEntry && lastEntry.id === boardId) {
    return;
  }

  // Save current canvas viewport before entering new board
  saveCurrentViewport();

  set({
    activeBoardId: boardId,
    currentBoardId: boardId,
    boardPath: [...boardPath, { id: boardId, title }],
  });

  // Restore viewport for the target board (or apply default)
  restoreViewport(boardId);
},
```

- [ ] **Step 2: Add deduplication to boardPath on restore**

The Zustand persist middleware restores `boardPath` from storage. Add a deduplication step in the rehydration or in a selector. Find where persist is configured (near the end of the store file) and add an `onRehydrateStorage` handler:

```typescript
// In the persist configuration, add:
onRehydrateStorage: () => (state) => {
  if (state && state.boardPath) {
    // Deduplicate boardPath on restore
    const seen = new Set<string>();
    state.boardPath = state.boardPath.filter(entry => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
  }
},
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/store/cxd-store.ts
git commit -m "fix: prevent duplicate breadcrumb entries in board navigation"
```

---

### Task 3: Add Defensive Rendering in Breadcrumbs

**Files:**
- Modify: `src/components/cxd/cxd-navbar.tsx`

- [ ] **Step 1: Deduplicate boardPath before rendering**

In the navbar component, add a `useMemo` that deduplicates the `boardPath` before rendering breadcrumbs. This is a defense-in-depth measure:

```typescript
// Add near the top of the component, after boardPath is destructured:
const dedupedBoardPath = useMemo(() => {
  if (!boardPath) return [];
  const seen = new Set<string>();
  return boardPath.filter(entry => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}, [boardPath]);
```

- [ ] **Step 2: Replace boardPath with dedupedBoardPath in the render**

In the breadcrumb rendering section (lines 394-469), replace all references to `boardPath` with `dedupedBoardPath`:

```typescript
{dedupedBoardPath && dedupedBoardPath.length > 0 && (
  <div className="flex items-center gap-1 ml-3 pl-3 border-l border-white/10 max-w-[300px] lg:max-w-[400px] xl:max-w-[500px] 2xl:max-w-[600px]">
    {/* ... SVG gradient ... */}
    <button
      onClick={() => navigateToBoardPath(-1)}
      className="flex items-center gap-1 transition-opacity hover:opacity-80 text-sm flex-shrink-0"
      title="Go to root canvas"
    >
      <Home className="w-5 h-5" style={{ stroke: 'url(#home-icon-grad)' }} />
    </button>
    {dedupedBoardPath.length <= 3 ? (
      dedupedBoardPath.map((board, index) => (
        <div key={board.id} className="flex items-center flex-shrink-0">
          <ChevronRight className="w-3.5 h-3.5 text-white/40 mx-0.5" />
          <button
            onClick={() => navigateToBoardPath(index)}
            className={`text-sm transition-colors truncate max-w-[100px] lg:max-w-[120px] xl:max-w-[150px] ${
              index === dedupedBoardPath.length - 1
                ? "text-primary font-medium"
                : "text-white/60 hover:text-white"
            }`}
            title={board.title}
          >
            {board.title}
          </button>
        </div>
      ))
    ) : (
      <>
        <div className="flex items-center flex-shrink-0">
          <ChevronRight className="w-3.5 h-3.5 text-white/40 mx-0.5" />
          <button
            onClick={() => navigateToBoardPath(0)}
            className="text-sm text-white/60 hover:text-white transition-colors truncate max-w-[80px]"
            title={dedupedBoardPath[0].title}
          >
            {dedupedBoardPath[0].title}
          </button>
        </div>
        <div className="flex items-center flex-shrink-0">
          <ChevronRight className="w-3.5 h-3.5 text-white/40 mx-0.5" />
          <span className="text-sm text-white/40">...</span>
        </div>
        {dedupedBoardPath.slice(-2).map((board, idx) => {
          const index = dedupedBoardPath.length - 2 + idx;
          return (
            <div key={board.id} className="flex items-center flex-shrink-0">
              <ChevronRight className="w-3.5 h-3.5 text-white/40 mx-0.5" />
              <button
                onClick={() => navigateToBoardPath(index)}
                className={`text-sm transition-colors truncate max-w-[100px] ${
                  index === dedupedBoardPath.length - 1
                    ? "text-primary font-medium"
                    : "text-white/60 hover:text-white"
                }`}
                title={board.title}
              >
                {board.title}
              </button>
            </div>
          );
        })}
      </>
    )}
  </div>
)}
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/cxd/cxd-navbar.tsx
git commit -m "fix: add defensive deduplication to breadcrumb rendering"
```

---

### Task 4: Remove Diagnostic Logging and Final Verification

**Files:**
- Modify: `src/store/cxd-store.ts`

- [ ] **Step 1: Remove debug console.warn**

Remove the `console.warn('[BREADCRUMB DEBUG]...')` line added in Task 1.

- [ ] **Step 2: Manual test**

Run: `npm run dev`
Test scenarios:
1. Enter a nested board — breadcrumbs show correct path, no duplicates
2. Go back via breadcrumb click — path truncates correctly
3. Use browser back button — path updates correctly
4. Refresh the page while in a nested board — breadcrumbs restore without duplicates
5. Rapidly double-click a board element — no duplicate entries

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/store/cxd-store.ts
git commit -m "fix: remove breadcrumb debug logging, finalize fix"
```
