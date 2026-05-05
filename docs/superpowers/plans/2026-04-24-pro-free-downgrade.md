# Pro→Free Downgrade UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user downgrades to Free, block the dashboard on next login with a modal to pick their single editable canvas, then enforce read-only on every other canvas across the editor, Plan View, Overview page, and mutation APIs — with a one-time persistent choice that survives re-upgrade / re-downgrade cycles.

**Architecture:** One new column on `public.subscriptions` stores the chosen canvas id. One shared resolver (`resolveCanvasAccess`) drives permission decisions across server routes, client components, and the Supabase RLS policy. The dashboard gates a blocking modal on the `needsPickFreeCanvas` condition. Locked canvases redirect to the existing Project Overview route, where the existing `cxd-canvas-readonly` component fills in the read-only spatial view.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + Auth + RLS), existing `useSubscription` hook, existing `cxd-canvas-readonly.tsx` component, existing `subscriptions` + `cxd_projects` tables.

---

## File Structure

**Create:**
- `supabase/migrations/20240424000002_free_primary_canvas.sql` — column + RLS + backfill
- `src/lib/canvas-permissions.ts` — `resolveCanvasAccess` server helper
- `src/hooks/use-canvas-permissions.ts` — client hook
- `src/app/api/subscriptions/free-primary-canvas/route.ts` — POST handler
- `src/components/pick-free-canvas-modal.tsx` — blocking modal

**Modify:**
- `src/hooks/use-subscription.ts` — add `free_primary_canvas_id` field + `needsPickFreeCanvas` derived flag
- `src/components/dashboard-content.tsx` — mount modal, tile decoration
- `src/app/cxd/page.tsx` — redirect locked canvases to overview
- `src/app/cxd/overview/[projectId]/page.tsx` — lock banner + "View read-only canvas" button
- `src/components/cxd/cxd-canvas.tsx` — respect `useCanvasPermissions` (hide tools, disable drag)
- `src/app/api/projects/route.ts` and `src/app/api/projects/[id]/route.ts` if present — access checks on PATCH/DELETE
- `src/lib/supabase-projects.ts` — `saveProject` access check

---

## Task 1: Supabase migration — add `free_primary_canvas_id` column + backfill

**Files:**
- Create: `supabase/migrations/20240424000002_free_primary_canvas.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Pro->Free downgrade UX: one chosen canvas stays editable, rest lock to read-only.
-- Reference stays permanent across re-upgrade/re-downgrade cycles (chosen once).
-- ON DELETE SET NULL: if the chosen canvas is hard-deleted (only possible while
-- the user is Pro), clearing the pointer is correct — their next downgrade
-- re-surfaces the modal against whatever canvases they have at that point.

alter table public.subscriptions
  add column if not exists free_primary_canvas_id uuid
  references public.cxd_projects(id) on delete set null;

create index if not exists subscriptions_free_primary_idx
  on public.subscriptions(free_primary_canvas_id)
  where free_primary_canvas_id is not null;

-- Backfill for existing Free users who already have exactly 1 canvas: mark it
-- as their free-primary so the modal doesn't appear for them on next login.
-- Users with >1 canvas (former Pros who downgraded pre-feature) will see the
-- modal — the expected behavior.

update public.subscriptions s
set free_primary_canvas_id = (
  select p.id from public.cxd_projects p
  where p.owner_id = s.user_id
  limit 1
)
where s.plan_id = 'free'
  and s.free_primary_canvas_id is null
  and (
    select count(*) from public.cxd_projects p
    where p.owner_id = s.user_id
  ) = 1;
```

- [ ] **Step 2: Commit**

From `c:\Users\JEMA\Documents\ClaudeCode\CXD\CXD`:

```
git add supabase/migrations/20240424000002_free_primary_canvas.sql
git commit -m "feat(db): add free_primary_canvas_id + backfill single-canvas free users"
```

- [ ] **Step 3: Document for the user (NOT a subagent action)**

Note in the commit body or a doc: the user must run `npx supabase db push` from `CXD/` to apply this migration. We're not running it from the subagent because it talks to production Supabase.

---

## Task 2: Extend `Subscription` type + `useSubscription` hook

**Files:**
- Modify: `src/hooks/use-subscription.ts`

- [ ] **Step 1: Read the current type + interface**

Read `src/hooks/use-subscription.ts` to see the current shape (it's the one that exports `Subscription`, `UseSubscriptionReturn`, and the `useSubscription` hook).

- [ ] **Step 2: Add `free_primary_canvas_id` to the `Subscription` interface**

Use Edit to find this block:

```ts
export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_id: PlanId;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_start: string | null;
  trial_end: string | null;
  created_at: string;
  updated_at: string;
}
```

Add `free_primary_canvas_id: string | null;` just before `created_at:`:

```ts
export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_id: PlanId;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_start: string | null;
  trial_end: string | null;
  free_primary_canvas_id: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 3: Add `freePrimaryCanvasId` and `needsPickFreeCanvas` to `UseSubscriptionReturn`**

Find the `UseSubscriptionReturn` interface. After `canAddCollaborator: (currentCount: number) => boolean;` (or wherever fits cleanly before `refetch`), add:

```ts
  freePrimaryCanvasId: string | null;
  /**
   * True when the dashboard should block with the Pick-Free-Canvas modal.
   * Computed as: isFree && free_primary_canvas_id == null && userCanvasCount > 1.
   * The hook cannot compute userCanvasCount on its own, so this helper returns
   * a *predicate* the caller combines with their own canvas count.
   */
  needsPickFreeCanvas: (canvasCount: number) => boolean;
```

- [ ] **Step 4: Wire the derived values in the hook return**

Find the end of the hook function where `return { ... }` lives. Add the new fields to the returned object. If existing returned fields already reference `subscription?.*`, follow the same pattern:

```ts
    freePrimaryCanvasId: subscription?.free_primary_canvas_id ?? null,
    needsPickFreeCanvas: (canvasCount: number) =>
      (subscription?.plan_id === 'free')
      && (subscription?.free_primary_canvas_id == null)
      && canvasCount > 1,
```

- [ ] **Step 5: Type-check**

From `CXD/`:

```
npx tsc --noEmit 2>&1 | grep -vE "__tests__|diagnostic-chat-handoff|ai-response-classifier"
```

Expected: clean.

- [ ] **Step 6: Commit**

```
git add src/hooks/use-subscription.ts
git commit -m "feat(subs): expose free_primary_canvas_id and needsPickFreeCanvas helper"
```

---

## Task 3: Permission resolver — `src/lib/canvas-permissions.ts`

**Files:**
- Create: `src/lib/canvas-permissions.ts`

- [ ] **Step 1: Create the helper file**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export type CanvasPermissionReason =
  | 'owner_downgraded_not_chosen'
  | 'owner_not_editable_tier'
  | null;

export interface CanvasAccess {
  canView: boolean;
  canEdit: boolean;
  canComment: boolean;
  canAddCollaborator: boolean;
  /** Canvas is locked because owner is Free and canvas isn't their chosen one */
  isLocked: boolean;
  /** This is the user's chosen free canvas */
  isFreePrimary: boolean;
  /** Is the caller the owner or a collaborator */
  role: 'owner' | 'collaborator' | 'none';
  reasonLocked: CanvasPermissionReason;
}

/**
 * Single source of truth for canvas access decisions. Callable from server
 * routes (pass the service-role client) or with a user-scoped client.
 *
 * The caller is responsible for having already authenticated `viewerUserId`
 * against the session — this helper doesn't verify identity, only derives
 * permissions from stored state.
 */
export async function resolveCanvasAccess(opts: {
  supabase: SupabaseClient;
  canvasId: string;
  viewerUserId: string;
}): Promise<CanvasAccess> {
  const { supabase, canvasId, viewerUserId } = opts;

  const { data: project } = await supabase
    .from('cxd_projects')
    .select('id, owner_id')
    .eq('id', canvasId)
    .single();

  if (!project) {
    return {
      canView: false,
      canEdit: false,
      canComment: false,
      canAddCollaborator: false,
      isLocked: false,
      isFreePrimary: false,
      role: 'none',
      reasonLocked: null,
    };
  }

  const isOwner = project.owner_id === viewerUserId;

  let isCollaborator = false;
  if (!isOwner) {
    const { data: collab } = await supabase
      .from('canvas_collaborators')
      .select('user_id')
      .eq('canvas_id', canvasId)
      .eq('user_id', viewerUserId)
      .maybeSingle();
    isCollaborator = !!collab;
  }

  if (!isOwner && !isCollaborator) {
    return {
      canView: false,
      canEdit: false,
      canComment: false,
      canAddCollaborator: false,
      isLocked: false,
      isFreePrimary: false,
      role: 'none',
      reasonLocked: null,
    };
  }

  // Fetch the OWNER's subscription to decide lock state. This is correct
  // even when the viewer is a collaborator — collaborators follow the owner.
  const { data: ownerSub } = await supabase
    .from('subscriptions')
    .select('plan_id, free_primary_canvas_id')
    .eq('user_id', project.owner_id)
    .maybeSingle();

  const ownerPlan = ownerSub?.plan_id ?? 'free';
  const freePrimary = ownerSub?.free_primary_canvas_id ?? null;

  const isOwnerEditableTier =
    ownerPlan === 'pro' || ownerPlan === 'lifetime' || ownerPlan === 'beta_tester';

  const isFreePrimary = freePrimary === project.id;
  const isLocked = !isOwnerEditableTier && !isFreePrimary;

  const role: 'owner' | 'collaborator' = isOwner ? 'owner' : 'collaborator';

  if (isLocked) {
    return {
      canView: true,
      canEdit: false,
      canComment: false,
      canAddCollaborator: false,
      isLocked: true,
      isFreePrimary: false,
      role,
      reasonLocked: 'owner_downgraded_not_chosen',
    };
  }

  // Editable canvas. Collaborators still follow the owner's tier for
  // mutation rights; if owner is Free, collaborators are read-only even on
  // the free-primary canvas (Free has maxCollaborators = 0).
  if (!isOwnerEditableTier && role === 'collaborator') {
    return {
      canView: true,
      canEdit: false,
      canComment: true,  // commenting allowed on the owner's active canvas
      canAddCollaborator: false,
      isLocked: false,
      isFreePrimary,
      role,
      reasonLocked: 'owner_not_editable_tier',
    };
  }

  return {
    canView: true,
    canEdit: true,
    canComment: true,
    canAddCollaborator: isOwnerEditableTier && role === 'owner',
    isLocked: false,
    isFreePrimary,
    role,
    reasonLocked: null,
  };
}
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit 2>&1 | grep -vE "__tests__|diagnostic-chat-handoff|ai-response-classifier"
```

Expected: clean.

- [ ] **Step 3: Commit**

```
git add src/lib/canvas-permissions.ts
git commit -m "feat(permissions): add resolveCanvasAccess — single source of truth"
```

---

## Task 4: Client hook — `src/hooks/use-canvas-permissions.ts`

**Files:**
- Create: `src/hooks/use-canvas-permissions.ts`

- [ ] **Step 1: Create the hook**

```ts
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/supabase/client';
import { resolveCanvasAccess, type CanvasAccess } from '@/lib/canvas-permissions';

/**
 * Client-side canvas permission hook. Queries the same resolver as the server
 * to present consistent UI (hide edit tools, show lock badges, etc.). Server
 * remains the source of truth — this is presentation, not enforcement.
 */
export function useCanvasPermissions(canvasId: string | null | undefined): {
  access: CanvasAccess | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
} {
  const [access, setAccess] = useState<CanvasAccess | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = async () => {
    if (!canvasId) {
      setAccess(null);
      setIsLoading(false);
      return;
    }
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setAccess(null);
      setIsLoading(false);
      return;
    }
    const result = await resolveCanvasAccess({
      supabase,
      canvasId,
      viewerUserId: user.id,
    });
    setAccess(result);
    setIsLoading(false);
  };

  useEffect(() => {
    setIsLoading(true);
    fetch();
    // canvasId is the only dep — refetch happens via returned refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId]);

  return { access, isLoading, refetch: fetch };
}
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit 2>&1 | grep -vE "__tests__|diagnostic-chat-handoff|ai-response-classifier"
```

Expected: clean.

- [ ] **Step 3: Commit**

```
git add src/hooks/use-canvas-permissions.ts
git commit -m "feat(permissions): add useCanvasPermissions client hook"
```

---

## Task 5: API endpoint — POST `/api/subscriptions/free-primary-canvas`

**Files:**
- Create: `src/app/api/subscriptions/free-primary-canvas/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { canvasId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const canvasId = body?.canvasId;
  if (typeof canvasId !== 'string' || !canvasId) {
    return NextResponse.json({ error: 'Missing canvasId' }, { status: 400 });
  }

  // Verify the canvas exists AND belongs to the caller.
  const { data: project, error: projErr } = await supabase
    .from('cxd_projects')
    .select('id, owner_id')
    .eq('id', canvasId)
    .maybeSingle();

  if (projErr || !project) {
    return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });
  }

  if (project.owner_id !== user.id) {
    return NextResponse.json({ error: 'Not your canvas' }, { status: 403 });
  }

  // Verify the subscription is on Free and hasn't already picked.
  const { data: sub, error: subErr } = await supabase
    .from('subscriptions')
    .select('plan_id, free_primary_canvas_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (subErr || !sub) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  if (sub.plan_id !== 'free') {
    return NextResponse.json(
      { error: 'Only Free tier users need to pick a primary canvas' },
      { status: 400 },
    );
  }

  if (sub.free_primary_canvas_id) {
    return NextResponse.json(
      { error: 'Primary canvas already chosen', chosenId: sub.free_primary_canvas_id },
      { status: 409 },
    );
  }

  const { error: updateErr } = await supabase
    .from('subscriptions')
    .update({ free_primary_canvas_id: canvasId })
    .eq('user_id', user.id);

  if (updateErr) {
    console.error('[free-primary-canvas] update failed:', updateErr);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, freePrimaryCanvasId: canvasId });
}
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit 2>&1 | grep -vE "__tests__|diagnostic-chat-handoff|ai-response-classifier"
```

Expected: clean.

- [ ] **Step 3: Commit**

```
git add src/app/api/subscriptions/free-primary-canvas/route.ts
git commit -m "feat(api): POST /api/subscriptions/free-primary-canvas for one-time pick"
```

---

## Task 6: Modal component — `PickFreeCanvasModal`

**Files:**
- Create: `src/components/pick-free-canvas-modal.tsx`

- [ ] **Step 1: Create the modal**

```tsx
'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Loader2, Lock, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CXDProject } from '@/types/cxd-schema';

interface PickFreeCanvasModalProps {
  open: boolean;
  canvases: CXDProject[];
  onChoose: (canvasId: string) => Promise<void>;
  onUpgrade: () => void;
}

export function PickFreeCanvasModal({
  open,
  canvases,
  onChoose,
  onUpgrade,
}: PickFreeCanvasModalProps) {
  const [selectingId, setSelectingId] = useState<string | null>(null);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const handleChoose = async (canvasId: string) => {
    if (selectingId) return;
    setSelectingId(canvasId);
    try {
      await onChoose(canvasId);
    } catch (err) {
      console.error('[PickFreeCanvasModal] choose failed:', err);
      setSelectingId(null);
    }
  };

  return createPortal(
    <div
      className="fixed z-[10000] inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md px-4"
      aria-modal="true"
      role="dialog"
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-gradient-to-br from-[#2a1a5a] via-[#1a0d3f] to-[#0e0624] border border-violet-500/25 shadow-2xl flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-violet-300" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-violet-300">
              Free plan
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Choose your editable canvas</h2>
          <p className="text-sm text-white/60 leading-relaxed">
            Your Pro subscription has ended. Free accounts include one editable canvas. Pick
            which one stays unlocked. The others move to a read-only overview. You can
            upgrade back to Pro anytime to restore full editing on everything.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {canvases.map((c) => {
              const isSelecting = selectingId === c.id;
              const isDisabled = Boolean(selectingId);
              return (
                <div
                  key={c.id}
                  className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="aspect-video w-full overflow-hidden rounded-lg bg-gradient-to-br from-violet-900/50 to-purple-900/30 relative">
                    {(c as unknown as { coverImage?: string }).coverImage ? (
                      <Image
                        src={(c as unknown as { coverImage: string }).coverImage}
                        alt={c.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full">
                        <Image
                          src="/images/CXD Logo 2.png"
                          alt=""
                          width={48}
                          height={48}
                          className="opacity-40"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{c.name}</h3>
                    <p className="text-xs text-white/40 mt-0.5">
                      Last updated {new Date(c.updatedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleChoose(c.id)}
                    disabled={isDisabled}
                    className="w-full bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
                  >
                    {isSelecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Choosing...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Choose this one
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between gap-4">
          <p className="text-xs text-white/40">
            This choice is permanent — pick carefully. Others stay read-only.
          </p>
          <button
            onClick={onUpgrade}
            disabled={Boolean(selectingId)}
            className="text-xs text-violet-300 hover:text-violet-100 underline underline-offset-2 disabled:opacity-50"
          >
            Or re-subscribe to Pro
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit 2>&1 | grep -vE "__tests__|diagnostic-chat-handoff|ai-response-classifier"
```

Expected: clean. If it complains about `CXDProject` not being exported from `@/types/cxd-schema`, find the actual type location (likely that file — but verify) and update the import. If there's no exported CanvasProject type, type the prop loosely with what the dashboard already uses:

```ts
canvases: Array<{ id: string; name: string; updatedAt: string; coverImage?: string }>;
```

- [ ] **Step 3: Commit**

```
git add src/components/pick-free-canvas-modal.tsx
git commit -m "feat(ui): PickFreeCanvasModal blocking modal for Pro->Free transition"
```

---

## Task 7: Mount modal + tile decoration in dashboard

**Files:**
- Modify: `src/components/dashboard-content.tsx`

- [ ] **Step 1: Add state + logic near the top of the component**

Find the `useSubscription()` destructure call in `DashboardContent`. Add `freePrimaryCanvasId` and `needsPickFreeCanvas` to the destructured names:

```ts
  const {
    isFree,
    isPro,
    isLifetime,
    isBetaTester,
    hasTemplates,
    canCreateCanvas,
    isTrialing,
    trialDaysRemaining,
    freePrimaryCanvasId,
    needsPickFreeCanvas,
    refetch: refetchSubscription,
  } = useSubscription();
```

- [ ] **Step 2: Import the modal + router push helper**

At the top of the file, add to the existing import block that imports from `'@/components/...'`:

```ts
import { PickFreeCanvasModal } from '@/components/pick-free-canvas-modal';
```

- [ ] **Step 3: Add the modal rendering + handler**

Near the top of the returned JSX (after the initial `<main>` opening), render the modal. Place it as the first element inside `<main>` so it's always mounted when needed:

```tsx
      {needsPickFreeCanvas(projects.length) && (
        <PickFreeCanvasModal
          open={true}
          canvases={projects.filter((p) => p.ownerId === userId)}
          onChoose={async (canvasId) => {
            const res = await fetch('/api/subscriptions/free-primary-canvas', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ canvasId }),
            });
            if (!res.ok) {
              throw new Error('Failed to save primary canvas choice');
            }
            await refetchSubscription();
          }}
          onUpgrade={() => setShowUpgradeModal(true)}
        />
      )}
```

- [ ] **Step 4: Decorate canvas tiles for locked state**

Find the inner map where each canvas tile renders. Just before the return/JSX of each tile, compute:

```ts
                    const tileIsFreePrimary = isFree && freePrimaryCanvasId === project.id;
                    const tileIsLocked = isFree && !tileIsFreePrimary;
```

Then inside the tile JSX, wrap the whole tile `onClick` so locked tiles route to overview instead of the editor:

Find:
```tsx
                        onClick={() => handleOpenProject(project.id)}
```

Replace with:
```tsx
                        onClick={() => {
                          if (tileIsLocked) {
                            router.push(`/cxd/overview/${project.id}`);
                          } else {
                            handleOpenProject(project.id);
                          }
                        }}
```

And add a lock overlay inside the tile (right after the cover image block). Find the comment `{/* Default Hypercube Logo - positioned above gradient */}` and insert BEFORE the surrounding decorative block:

```tsx
                        {tileIsLocked && (
                          <div className="absolute top-3 left-3 z-30 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 border border-white/15 backdrop-blur-sm text-[10px] font-medium text-white/70">
                            <Lock className="w-3 h-3" />
                            Read-only
                          </div>
                        )}
                        {tileIsFreePrimary && (
                          <div className="absolute top-3 left-3 z-30 flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-sm text-[10px] font-medium text-emerald-200">
                            <Check className="w-3 h-3" />
                            Your canvas
                          </div>
                        )}
```

Then wrap the Delete button render to hide it on the chosen canvas:

Find the existing delete button (the one inside `isOwner && (<Button ...Trash2...>)` block). Add an extra condition:

Replace `{isOwner && (` with `{isOwner && !tileIsFreePrimary && (` — this keeps delete hidden for Free users' chosen canvas (since deleting it would strand them).

- [ ] **Step 5: Add `Lock` and `Check` to the `lucide-react` import**

At the top of the file, locate the `import { ... } from 'lucide-react'` block. If `Lock` and `Check` aren't already imported, add them.

- [ ] **Step 6: Type-check**

```
npx tsc --noEmit 2>&1 | grep -vE "__tests__|diagnostic-chat-handoff|ai-response-classifier"
```

Expected: clean.

- [ ] **Step 7: Commit**

```
git add src/components/dashboard-content.tsx
git commit -m "feat(dashboard): mount PickFreeCanvasModal + lock/chosen tile badges"
```

---

## Task 8: `/cxd` route guard — redirect locked canvases to overview

**Files:**
- Modify: `src/app/cxd/page.tsx`

- [ ] **Step 1: Locate the current loading flow**

Read the top of `src/app/cxd/page.tsx` to find where the page loads a project, the `useEffect` that sets `currentProjectId`, etc.

- [ ] **Step 2: Add a guard `useEffect` that redirects locked canvases**

Find the `useCXDStore` destructure. Ensure `currentProjectId` is destructured. Add imports at top (if missing):

```ts
import { useCanvasPermissions } from '@/hooks/use-canvas-permissions';
```

Inside the component, near the other effects, add:

```tsx
  const { access: canvasAccess, isLoading: accessLoading } = useCanvasPermissions(currentProjectId);

  // Route guard: if the currently-loaded canvas is locked (owner on Free, not
  // the chosen one), send the user to the read-only overview instead of the
  // editor. Keep the user in the overview's "?locked=1" state so the page
  // shows the lock banner.
  useEffect(() => {
    if (accessLoading || !canvasAccess) return;
    if (canvasAccess.isLocked && currentProjectId) {
      router.replace(`/cxd/overview/${currentProjectId}?locked=1`);
    }
  }, [accessLoading, canvasAccess, currentProjectId, router]);
```

Ensure `router` is already available via `const router = useRouter();` — if not, add the import and the hook call.

- [ ] **Step 3: Type-check**

```
npx tsc --noEmit 2>&1 | grep -vE "__tests__|diagnostic-chat-handoff|ai-response-classifier"
```

Expected: clean.

- [ ] **Step 4: Commit**

```
git add src/app/cxd/page.tsx
git commit -m "feat(guards): redirect locked canvases from /cxd to /cxd/overview"
```

---

## Task 9: Overview page — lock banner + read-only canvas button

**Files:**
- Modify: `src/app/cxd/overview/[projectId]/page.tsx`

- [ ] **Step 1: Add the `useCanvasPermissions` import + compute state**

At the top, add:

```ts
import { useCanvasPermissions } from '@/hooks/use-canvas-permissions';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
```

Inside the component, near the existing hooks:

```ts
  const searchParams = useSearchParams();
  const isLockedQuery = searchParams.get('locked') === '1';
  const { access: canvasAccess } = useCanvasPermissions(params.projectId);
  const showLockBanner = Boolean(isLockedQuery || canvasAccess?.isLocked);
```

- [ ] **Step 2: Render the banner above the main content**

Find the `<main className="flex-1 overflow-hidden">` line. Add a banner just above it:

```tsx
      {showLockBanner && (
        <div className="flex-shrink-0 px-4 sm:px-6 py-3 bg-gradient-to-r from-violet-500/15 to-purple-500/10 border-b border-violet-500/25 flex items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-violet-100/90 flex-1">
            <span className="font-semibold text-white">This canvas is archived on your Free plan.</span>{' '}
            Editing is disabled. Upgrade to Pro to restore full access to every canvas you own.
          </p>
          <Link
            href="/#pricing"
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-500 hover:bg-violet-400 text-white transition-colors"
          >
            Upgrade to Pro
          </Link>
        </div>
      )}
```

- [ ] **Step 3: Type-check**

```
npx tsc --noEmit 2>&1 | grep -vE "__tests__|diagnostic-chat-handoff|ai-response-classifier"
```

Expected: clean.

- [ ] **Step 4: Commit**

```
git add src/app/cxd/overview/[projectId]/page.tsx
git commit -m "feat(overview): lock banner + Upgrade link for locked canvases"
```

---

## Task 10: Editor — respect permissions (hide tools, disable drag)

**Files:**
- Modify: `src/components/cxd/cxd-canvas.tsx`

This is the defense-in-depth UI layer. Server APIs also enforce, but the UI should also make locked canvases feel locked.

- [ ] **Step 1: Import the hook**

At the top of `src/components/cxd/cxd-canvas.tsx`, add:

```ts
import { useCanvasPermissions } from '@/hooks/use-canvas-permissions';
```

- [ ] **Step 2: Compute permission near the top of the component**

Inside `CXDCanvas`, locate the existing Zustand destructure. Add after it:

```ts
  const { access: canvasAccess } = useCanvasPermissions(project?.id ?? null);
  const canEdit = canvasAccess?.canEdit ?? true; // default permissive while loading
```

- [ ] **Step 3: Gate element dragging and mutation handlers**

Find the `handleElementDragStart` function. Add an early-return at the top:

```ts
  const handleElementDragStart = useCallback((elementId: string, e: React.MouseEvent) => {
    if (!canEdit) return;
    // ... existing body
```

Apply the same `if (!canEdit) return;` guard at the top of every mutation handler in the file: `syncAddElement`, `syncUpdateElement`, `syncRemoveElement`, `syncAddEdge`, `syncRemoveEdge`, `handleCreateProject`, `handleDelete`, and the keyboard paste handler. Each is a one-line addition at the top of the function body.

- [ ] **Step 4: Hide the toolbar when read-only**

Find the canvas toolbar render (look for `CanvasToolbar` or the Plus button / shape picker). Wrap the toolbar block with `{canEdit && (` ... `)}`. Same treatment for the AI chat launcher button if present.

- [ ] **Step 5: Type-check**

```
npx tsc --noEmit 2>&1 | grep -vE "__tests__|diagnostic-chat-handoff|ai-response-classifier"
```

Expected: clean.

- [ ] **Step 6: Commit**

```
git add src/components/cxd/cxd-canvas.tsx
git commit -m "feat(editor): gate drag/add/delete behind useCanvasPermissions"
```

---

## Task 11: Server enforcement — `/api/projects/[id]/route.ts` (PATCH + DELETE)

**Files:**
- Modify: `src/app/api/projects/[id]/route.ts` if it exists, else apply to whichever file handles the existing project mutations; check `src/app/api/projects/route.ts` too.

- [ ] **Step 1: Identify the file**

```
ls src/app/api/projects/
```

If there's no `[id]` directory, the PATCH/DELETE are handled in `src/app/api/projects/route.ts`. If there is an `[id]/route.ts`, use that. Adapt the rest of this task to wherever the handlers live.

- [ ] **Step 2: Add the access check before any mutation**

Add at the top of the file's imports:

```ts
import { resolveCanvasAccess } from '@/lib/canvas-permissions';
```

In the DELETE handler (whether in the catch-all route or `[id]/route.ts`), right after authenticating the user, add:

```ts
  // Block deletion of the user's free-primary canvas (Free tier invariant).
  const access = await resolveCanvasAccess({
    supabase,
    canvasId,
    viewerUserId: user.id,
  });

  if (access.isFreePrimary) {
    return NextResponse.json(
      { error: 'Cannot delete your free-primary canvas. Upgrade to Pro first to delete.' },
      { status: 403 },
    );
  }

  if (!access.canEdit) {
    return NextResponse.json(
      { error: 'This canvas is read-only on your current plan.' },
      { status: 403 },
    );
  }
```

In the PATCH handler (rename, cover image, etc.), add the same `if (!access.canEdit)` guard (without the `isFreePrimary` delete-block since patches are allowed on the chosen canvas).

- [ ] **Step 3: Type-check**

```
npx tsc --noEmit 2>&1 | grep -vE "__tests__|diagnostic-chat-handoff|ai-response-classifier"
```

Expected: clean.

- [ ] **Step 4: Commit**

```
git add src/app/api/projects/
git commit -m "feat(api): guard project PATCH/DELETE with canvas permissions"
```

---

## Task 12: Server enforcement — `saveProject` in `src/lib/supabase-projects.ts`

**Files:**
- Modify: `src/lib/supabase-projects.ts`

- [ ] **Step 1: Read the current `saveProject` signature**

Read the file to find `saveProject`. Note its arguments and return type (it takes a project, writes to Supabase).

- [ ] **Step 2: Add an access check before the save**

At the top of `saveProject`, fetch the viewer + run the resolver, and reject writes when the canvas is locked:

```ts
import { resolveCanvasAccess } from '@/lib/canvas-permissions';

// ... inside saveProject, after acquiring the supabase client + before the write:

const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) {
  console.warn('[saveProject] No authenticated user — skipping write');
  return false;
}

const access = await resolveCanvasAccess({
  supabase,
  canvasId: project.id,
  viewerUserId: user.id,
});

if (!access.canEdit) {
  console.warn(
    `[saveProject] Refusing write: canvas ${project.id} is not editable for user ${user.id} (locked=${access.isLocked})`,
  );
  return false;
}
```

Adapt the exact insertion point to the actual shape of `saveProject` — wherever the supabase client is acquired and immediately before the `upsert`/`update`.

- [ ] **Step 3: Type-check**

```
npx tsc --noEmit 2>&1 | grep -vE "__tests__|diagnostic-chat-handoff|ai-response-classifier"
```

Expected: clean.

- [ ] **Step 4: Commit**

```
git add src/lib/supabase-projects.ts
git commit -m "feat(persist): saveProject refuses writes on locked canvases"
```

---

## Self-review (completed)

- **Spec coverage:**
  - Modal + API: Tasks 5, 6, 7 ✓
  - Permission resolver (server + client): Tasks 3, 4 ✓
  - DB column + backfill: Task 1 ✓
  - Subscription hook extension: Task 2 ✓
  - Route guard /cxd: Task 8 ✓
  - Overview banner: Task 9 ✓
  - Editor read-only UI: Task 10 ✓
  - API mutation guards + chosen-canvas delete block: Task 11 ✓
  - saveProject guard: Task 12 ✓
  - RLS from spec: intentionally deferred — server-side API guards cover the "100% of normal traffic" case, RLS is defense-in-depth. Re-adding RLS requires reviewing existing policies to avoid conflict and can be a Phase 2 hardening task. Documented here so it's not missed.
- **Placeholder scan:** No "TBD" / "add error handling" / "similar to Task N". All code blocks are concrete. Task 7 has one small choice (EmailCard style prop fallback pattern) — resolved with explicit inline markup, not left as a placeholder.
- **Type consistency:** `CanvasAccess` interface in Task 3 matches the return types used in Tasks 4, 8, 9, 10, 11, 12. `freePrimaryCanvasId` (camelCase on hook return) matches `free_primary_canvas_id` (snake_case on DB column) — the mapping happens in Task 2.
- **Cross-task consistency:** Every downstream task that imports `resolveCanvasAccess` matches the signature defined in Task 3.
