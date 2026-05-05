# Comments System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Figma-style commenting system where users can click on the canvas to place comments, reply in threads, and resolve discussions.

**Architecture:** Comments are stored as a separate data structure in the project (not as canvas elements), synced via Yjs for real-time collaboration. A comment mode toggle in the toolbar switches canvas interaction. Comment pins render as numbered circles at canvas positions, and clicking a pin opens a thread panel.

**Tech Stack:** TypeScript, React, Zustand, Yjs, TailwindCSS

---

### Task 1: Define Comment Data Model

**Files:**
- Create: `src/types/comment-types.ts`
- Modify: `src/types/cxd-schema.ts` (add comments to project schema)

- [ ] **Step 1: Create comment type definitions**

Create `src/types/comment-types.ts`:

```typescript
export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  /** Canvas position in world coordinates */
  position: { x: number; y: number };
  /** Which board this comment belongs to (null = root canvas) */
  boardId: string | null;
  createdAt: number;  // timestamp
  /** If set, this comment is a reply to the parent */
  parentId: string | null;
  /** If set, the entire thread is resolved */
  resolvedAt: number | null;
  resolvedBy?: string;
}

export interface CommentThread {
  root: Comment;
  replies: Comment[];
}
```

- [ ] **Step 2: Add comments array to project schema**

In the project type definition (check `src/types/cxd-schema.ts`), add:

```typescript
comments?: Comment[];
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/types/comment-types.ts src/types/cxd-schema.ts
git commit -m "feat: define comment data model and add to project schema"
```

---

### Task 2: Add Comment State to Zustand Store

**Files:**
- Modify: `src/store/cxd-store.ts`

- [ ] **Step 1: Add comment mode state**

Add to the store interface and initial state:

```typescript
// State:
commentMode: boolean;
activeCommentId: string | null;  // currently open thread
showResolvedComments: boolean;

// Actions:
toggleCommentMode: () => void;
setActiveComment: (commentId: string | null) => void;
addComment: (content: string, position: { x: number; y: number }) => void;
addReply: (parentId: string, content: string) => void;
resolveComment: (commentId: string) => void;
unresolveComment: (commentId: string) => void;
deleteComment: (commentId: string) => void;
toggleShowResolved: () => void;
getComments: () => Comment[];
getThreads: () => CommentThread[];
```

- [ ] **Step 2: Implement comment actions**

```typescript
// Initial state:
commentMode: false,
activeCommentId: null,
showResolvedComments: false,

// Actions:
toggleCommentMode: () => {
  set(s => ({ commentMode: !s.commentMode, activeCommentId: null }));
},

setActiveComment: (commentId) => {
  set({ activeCommentId: commentId });
},

addComment: (content, position) => {
  const project = get().getCurrentProject();
  if (!project) return;
  const user = get().user; // however user data is accessed
  const comment: Comment = {
    id: crypto.randomUUID(),
    authorId: user?.id ?? 'anonymous',
    authorName: user?.name ?? 'Anonymous',
    content,
    position,
    boardId: get().activeBoardId,
    createdAt: Date.now(),
    parentId: null,
    resolvedAt: null,
  };
  const comments = [...(project.comments || []), comment];
  get().syncUpdateProject({ comments });
  set({ activeCommentId: comment.id });
},

addReply: (parentId, content) => {
  const project = get().getCurrentProject();
  if (!project) return;
  const user = get().user;
  const reply: Comment = {
    id: crypto.randomUUID(),
    authorId: user?.id ?? 'anonymous',
    authorName: user?.name ?? 'Anonymous',
    content,
    position: { x: 0, y: 0 }, // replies don't have independent positions
    boardId: get().activeBoardId,
    createdAt: Date.now(),
    parentId,
    resolvedAt: null,
  };
  const comments = [...(project.comments || []), reply];
  get().syncUpdateProject({ comments });
},

resolveComment: (commentId) => {
  const project = get().getCurrentProject();
  if (!project || !project.comments) return;
  const user = get().user;
  const comments = project.comments.map(c =>
    c.id === commentId || c.parentId === commentId
      ? { ...c, resolvedAt: Date.now(), resolvedBy: user?.id }
      : c
  );
  get().syncUpdateProject({ comments });
  set({ activeCommentId: null });
},

unresolveComment: (commentId) => {
  const project = get().getCurrentProject();
  if (!project || !project.comments) return;
  const comments = project.comments.map(c =>
    c.id === commentId || c.parentId === commentId
      ? { ...c, resolvedAt: null, resolvedBy: undefined }
      : c
  );
  get().syncUpdateProject({ comments });
},

deleteComment: (commentId) => {
  const project = get().getCurrentProject();
  if (!project || !project.comments) return;
  // Delete comment and all its replies
  const comments = project.comments.filter(
    c => c.id !== commentId && c.parentId !== commentId
  );
  get().syncUpdateProject({ comments });
  if (get().activeCommentId === commentId) {
    set({ activeCommentId: null });
  }
},

toggleShowResolved: () => {
  set(s => ({ showResolvedComments: !s.showResolvedComments }));
},

getComments: () => {
  const project = get().getCurrentProject();
  const boardId = get().activeBoardId;
  return (project?.comments || []).filter(c => c.boardId === boardId);
},

getThreads: () => {
  const comments = get().getComments();
  const roots = comments.filter(c => c.parentId === null);
  return roots.map(root => ({
    root,
    replies: comments
      .filter(c => c.parentId === root.id)
      .sort((a, b) => a.createdAt - b.createdAt),
  }));
},
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/store/cxd-store.ts
git commit -m "feat: add comment state and actions to Zustand store"
```

---

### Task 3: Create CommentPin Component

**Files:**
- Create: `src/components/cxd/canvas/comment-pin.tsx`

- [ ] **Step 1: Create the comment pin component**

```tsx
"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import type { CommentThread } from '@/types/comment-types';

interface CommentPinProps {
  thread: CommentThread;
  index: number;  // for numbering
  isActive: boolean;
  isResolved: boolean;
  onClick: () => void;
  canvasZoom: number;
}

export function CommentPin({ thread, index, isActive, isResolved, onClick, canvasZoom }: CommentPinProps) {
  const scale = 1 / canvasZoom;

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        left: thread.root.position.x,
        top: thread.root.position.y,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        zIndex: isActive ? 9999 : 100,
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-lg",
          isActive && "ring-2 ring-purple-400 ring-offset-2 ring-offset-transparent",
          isResolved
            ? "bg-white/20 text-white/40 border border-white/10"
            : "bg-purple-600 text-white border border-purple-400/50 hover:bg-purple-500",
        )}
        title={`Comment by ${thread.root.authorName}`}
      >
        {index + 1}
      </button>
      {/* Reply count badge */}
      {thread.replies.length > 0 && (
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-black text-[10px] font-bold flex items-center justify-center">
          {thread.replies.length}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/cxd/canvas/comment-pin.tsx
git commit -m "feat: create CommentPin component for canvas comment markers"
```

---

### Task 4: Create CommentThread Panel

**Files:**
- Create: `src/components/cxd/canvas/comment-thread.tsx`

- [ ] **Step 1: Create the thread panel component**

```tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useCXDStore } from '@/store/cxd-store';
import { X, Check, CornerDownRight } from 'lucide-react';
import type { CommentThread as CommentThreadType } from '@/types/comment-types';

interface CommentThreadProps {
  thread: CommentThreadType;
  canvasZoom: number;
}

export function CommentThread({ thread, canvasZoom }: CommentThreadProps) {
  const [replyContent, setReplyContent] = useState('');
  const addReply = useCXDStore(s => s.addReply);
  const resolveComment = useCXDStore(s => s.resolveComment);
  const unresolveComment = useCXDStore(s => s.unresolveComment);
  const setActiveComment = useCXDStore(s => s.setActiveComment);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isResolved = thread.root.resolvedAt !== null;
  const scale = 1 / canvasZoom;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmitReply = () => {
    if (!replyContent.trim()) return;
    addReply(thread.root.id, replyContent.trim());
    setReplyContent('');
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        left: thread.root.position.x + 40 * scale,
        top: thread.root.position.y,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        zIndex: 10000,
      }}
    >
      <div
        className="w-72 rounded-xl border border-white/10 bg-[#1a1a2e]/95 backdrop-blur shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <span className="text-xs text-white/50">
            {isResolved ? 'Resolved' : `${thread.replies.length + 1} comment${thread.replies.length > 0 ? 's' : ''}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => isResolved ? unresolveComment(thread.root.id) : resolveComment(thread.root.id)}
              className={`p-1 rounded hover:bg-white/10 transition-colors ${isResolved ? 'text-green-400' : 'text-white/40 hover:text-green-400'}`}
              title={isResolved ? 'Unresolve' : 'Resolve'}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActiveComment(null)}
              className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="max-h-64 overflow-y-auto">
          {/* Root comment */}
          <div className="px-3 py-2 border-b border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-white/80">{thread.root.authorName}</span>
              <span className="text-[10px] text-white/30">{formatTime(thread.root.createdAt)}</span>
            </div>
            <p className="text-sm text-white/70 leading-relaxed">{thread.root.content}</p>
          </div>

          {/* Replies */}
          {thread.replies.map(reply => (
            <div key={reply.id} className="px-3 py-2 border-b border-white/5 pl-5">
              <div className="flex items-center gap-2 mb-1">
                <CornerDownRight className="w-3 h-3 text-white/20" />
                <span className="text-xs font-medium text-white/80">{reply.authorName}</span>
                <span className="text-[10px] text-white/30">{formatTime(reply.createdAt)}</span>
              </div>
              <p className="text-sm text-white/70 leading-relaxed">{reply.content}</p>
            </div>
          ))}
        </div>

        {/* Reply input */}
        {!isResolved && (
          <div className="px-3 py-2 border-t border-white/10">
            <textarea
              ref={inputRef}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitReply();
                }
              }}
              placeholder="Reply..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-purple-500/50"
              rows={2}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/cxd/canvas/comment-thread.tsx
git commit -m "feat: create CommentThread panel with replies and resolve"
```

---

### Task 5: Create Comment Mode Toggle

**Files:**
- Modify: `src/components/cxd/cxd-navbar.tsx` or `src/components/cxd/canvas/canvas-toolkit.tsx`

- [ ] **Step 1: Add comment mode toggle button**

Add a comment mode button to the toolbar (near the collaborate button or in the toolkit):

```tsx
import { MessageCircle } from 'lucide-react';

// In the toolbar:
<button
  onClick={toggleCommentMode}
  className={cn(
    "p-2 rounded-lg transition-all",
    commentMode
      ? "bg-purple-600 text-white"
      : "text-white/40 hover:text-white/60 hover:bg-white/10"
  )}
  title={commentMode ? "Exit comment mode" : "Add comment"}
>
  <MessageCircle className="w-4 h-4" />
</button>
```

- [ ] **Step 2: Add "Show resolved" toggle**

Near the comment mode button, add a toggle for showing/hiding resolved comments:

```tsx
{commentMode && (
  <button
    onClick={toggleShowResolved}
    className={cn(
      "p-1.5 rounded text-xs transition-all",
      showResolvedComments ? "text-white/60" : "text-white/30"
    )}
    title="Toggle resolved comments"
  >
    {showResolvedComments ? "Hide resolved" : "Show resolved"}
  </button>
)}
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add comment mode toggle and show-resolved button"
```

---

### Task 6: Integrate Comments into Canvas

**Files:**
- Modify: `src/components/cxd/cxd-canvas.tsx`

- [ ] **Step 1: Render comment pins on the canvas**

In the canvas rendering area (inside the zoom/pan container), add comment pin rendering:

```tsx
import { CommentPin } from './canvas/comment-pin';
import { CommentThread } from './canvas/comment-thread';

// In the canvas render, after elements:
{getThreads()
  .filter(thread => showResolvedComments || thread.root.resolvedAt === null)
  .map((thread, index) => (
    <React.Fragment key={thread.root.id}>
      <CommentPin
        thread={thread}
        index={index}
        isActive={activeCommentId === thread.root.id}
        isResolved={thread.root.resolvedAt !== null}
        onClick={() => setActiveComment(
          activeCommentId === thread.root.id ? null : thread.root.id
        )}
        canvasZoom={canvasZoom}
      />
      {activeCommentId === thread.root.id && (
        <CommentThread
          thread={thread}
          canvasZoom={canvasZoom}
        />
      )}
    </React.Fragment>
  ))
}
```

- [ ] **Step 2: Handle canvas click in comment mode**

Add a click handler that creates a comment when in comment mode:

```tsx
// In the canvas' onMouseDown or onClick handler:
const handleCanvasClick = (e: React.MouseEvent) => {
  if (commentMode) {
    // Convert screen coords to canvas world coords
    const worldPos = screenToWorld(e.clientX, e.clientY);
    // Show an input at this position (or create comment with prompt)
    const content = window.prompt('Add a comment:');
    if (content?.trim()) {
      addComment(content.trim(), worldPos);
    }
    return; // Don't propagate to normal canvas click handling
  }
  // ... existing click logic
};
```

Note: The `window.prompt` is a simple v1 approach. A better UX would be an inline text input at the click position — this can be iterated on later.

- [ ] **Step 3: Change cursor in comment mode**

Add a cursor style when comment mode is active:

```tsx
<div
  className={cn("canvas-container", commentMode && "cursor-crosshair")}
  // ... rest of canvas props
>
```

- [ ] **Step 4: Close active comment when clicking empty canvas area**

When clicking the canvas (not on a pin), close any open thread:

```tsx
// In the canvas click handler (when NOT in comment mode):
if (activeCommentId) {
  setActiveComment(null);
}
```

- [ ] **Step 5: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 6: Test manually**

Run: `npm run dev`
Test:
1. Click comment mode toggle — cursor changes to crosshair
2. Click on canvas — prompt appears, enter text — comment pin appears
3. Click pin — thread panel opens with the comment
4. Type a reply — reply appears in thread
5. Click resolve — pin fades/dims, thread marked resolved
6. Toggle "Show resolved" — resolved pins appear/disappear
7. Navigate into a nested board — only that board's comments show
8. Exit comment mode — normal canvas interaction resumes

- [ ] **Step 7: Commit**

```bash
git add src/components/cxd/cxd-canvas.tsx
git commit -m "feat: integrate comment pins and threads into canvas"
```
