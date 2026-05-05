# Pro→Free Downgrade UX

**Date:** 2026-04-24
**Scope:** When a Pro or Lifetime user drops to Free, give them a one-time choice of which canvas stays editable and lock the rest to an overview + read-only spatial view. Enforce the lock at every editing surface. Handle re-upgrade, deletion, and collaborator cases.

## Goal

Once `subscriptions.plan_id = 'free'` and the user has more than one canvas, prompt them on next login with a blocking modal to pick their single editable canvas. All other canvases lock to Project Overview + a read-only spatial canvas view. The choice is persisted and survives re-upgrade / re-downgrade. No email-level change (the existing `subscription-cancelled` template already tells users their account downgraded; this spec covers the in-app flow).

## Non-goals

- Ownership transfer ("let a Pro collaborator take over a locked canvas")
- Re-pick UX ("I want a different canvas as my free one") — deliberately excluded per the one-time-choice rule
- Changes to the Stripe webhook or cancellation email (both already ship)
- Free tier object/image quotas — separate spec

## Product rules (from brainstorm)

1. **Trigger:** modal appears on the next authenticated load after `customer.subscription.deleted` fires. Never mid-session.
2. **Skip modal when** the user has 0 canvases (nothing to pick) or exactly 1 canvas (auto-picked silently).
3. **The chosen canvas** is fully editable (within Free tier feature limits — no Plan View, no AI chat on non-chosen canvases, etc.).
4. **Locked canvases** show the Project Overview page by default; user can open the spatial canvas in read-only mode from there. No Plan / AI / collaborator / mutation tools.
5. **Re-upgrade unlocks everything.** The chosen-canvas tag stays in the DB silently. On re-downgrade, the same canvas becomes editable automatically with no second modal.
6. **Chosen canvas cannot be deleted** while Free. Delete button hidden/blocked.
7. **Collaborators follow the owner's tier.** On any locked canvas, collaborators also see only Overview + read-only spatial. On the chosen canvas, collaborators go read-only because Free has `maxCollaborators: 0`.
8. **Re-subscribe path from the modal:** a secondary link "Or re-subscribe to Pro" opens the upgrade flow and exits the modal when the subscription returns to active.

## Data model

New column on `subscriptions`:

```sql
alter table public.subscriptions
  add column free_primary_canvas_id uuid
  references public.cxd_projects(id) on delete set null;

create index if not exists subscriptions_free_primary_idx
  on public.subscriptions(free_primary_canvas_id)
  where free_primary_canvas_id is not null;
```

Semantics:
- `NULL` means the user has never picked (or never needed to — they were never Pro, or they never had >1 canvas).
- A non-null value is permanent for that user. Survives re-upgrade / re-downgrade / re-cancel cycles.
- `ON DELETE SET NULL` so hard-deleting the canvas (only possible while Pro) just clears the pointer — next time they downgrade, the modal appears again with whatever canvases they have at that point.

Why on `subscriptions` rather than a new boolean on `cxd_projects`: the state is per-user, one value per user. A project column would require enforcing "exactly one per user" via constraint or app logic. A subscription-level pointer is naturally unique.

## User-facing states

A user's canvases are in one of three states at any moment:

| State | When | Owner's view | Collaborator's view |
|---|---|---|---|
| `editable` | owner is Pro/Lifetime/Beta_tester, OR owner is Free AND canvas is their `free_primary_canvas_id` | Full editor + all features at the user's plan limits | Same — per their own plan's limits |
| `locked` | owner is Free AND canvas is NOT their `free_primary_canvas_id` | Project Overview + read-only spatial | Same as owner — Overview + read-only spatial |
| `orphan` | owner deletes their account | (covered by existing cascade) | n/a |

The `editable` / `locked` distinction is computed, not stored per-canvas. A single server helper derives state from `(project.owner_id → subscription.plan_id, subscription.free_primary_canvas_id, project.id)`.

## Helper: canvas permission resolution

New `src/lib/canvas-permissions.ts`:

```ts
type CanvasAccess = {
  canView: boolean;
  canEdit: boolean;
  canComment: boolean;
  canAddCollaborator: boolean;
  isLocked: boolean;        // canvas is locked because owner is Free + canvas ≠ free_primary
  isFreePrimary: boolean;   // this is the user's chosen free canvas
  reasonLocked?: 'owner_downgraded_not_chosen' | null;
};

export async function resolveCanvasAccess(opts: {
  canvasId: string;
  viewerUserId: string;  // may be owner or collaborator
}): Promise<CanvasAccess>;
```

Used by every mutation endpoint and the client-side permission hook.

## Components and routes

### Modal — `/dashboard` intercept

Client component `PickFreeCanvasModal` rendered from the dashboard layout when the subscription hook reports `needsPickFreeCanvas`. Derived client-side: `subscription.plan_id === 'free' && subscription.free_primary_canvas_id === null && userCanvasCount > 1`. When shown:

- Full-screen blocking modal (click-outside does nothing, no close button)
- Header: "Choose your editable canvas"
- Body copy: "Your Pro subscription has ended. Free accounts include one editable canvas. Pick which one stays unlocked — the others move to read-only. You can upgrade to Pro anytime to restore full editing."
- Grid of canvas cards (reuses existing dashboard canvas tile component) with a single "Choose this one" button per tile
- Secondary link at the bottom: "Re-subscribe to Pro instead" → opens the existing upgrade flow
- On pick: `POST /api/subscriptions/free-primary-canvas { canvasId }` → sets `free_primary_canvas_id`, invalidates the subscription query, modal closes.

### API — `POST /api/subscriptions/free-primary-canvas`

- Auth: standard Supabase session
- Body: `{ canvasId: string }`
- Validation: caller must be owner of the canvas; subscription plan_id must be 'free'; subscription.free_primary_canvas_id must be NULL (never overwrite; this is the "choose once" invariant enforced at the API layer).
- On success: updates `subscriptions.free_primary_canvas_id` and returns the new subscription row.

### Dashboard — locked canvas tile treatment

Modify `DashboardContent` canvas grid: each canvas tile passes through the permission resolver.

- `editable`: current behavior — click opens `/cxd?project=<id>`
- `locked`: tile shows a small lock icon overlay + muted thumbnail + "Read-only" badge. Click → `/cxd/overview/<id>`. Delete button hidden. Invite / Rename / Cover-image buttons hidden.
- `isFreePrimary`: tile gets a subtle "Your editable canvas" badge so the user knows which one is theirs.

### `/cxd` canvas route — hard redirect for locked canvases

Before rendering the editor, check access:

- If `isLocked`, server-side redirect to `/cxd/overview/<id>` with a query param `?locked=1` so the overview page can show a banner.
- If `canEdit`, render the full editor.
- If `canView` but not `canEdit` (Free user on their chosen canvas that has a separate restriction — e.g. expired tier mid-session), show the read-only spatial view with an "Upgrade to edit" banner.

### `/cxd/overview/<id>` — banner for locked canvases

If the incoming request has `?locked=1` or the permission resolver returns `isLocked`, render a banner at the top:

> "This canvas is archived on your Free plan. [Upgrade to Pro] to restore editing."

Plus a "View canvas (read-only)" button that opens the existing read-only spatial view in a modal/full-screen overlay.

### Read-only spatial canvas view

Reuses [cxd-canvas-readonly.tsx](CXD/src/components/cxd/cxd-canvas-readonly.tsx) (which already exists for share links). Passed `canEdit={false}` — no toolbar, no drag, no edge handles, no AI chat, no comments. Just pan + zoom + hypercube.

## Server-side enforcement

Every canvas-mutation endpoint must call `resolveCanvasAccess` and reject if `!canEdit`. The critical ones:

| Endpoint / action | Fix |
|---|---|
| Direct Zustand → Supabase writes via `saveProject` in `src/lib/supabase-projects.ts` | Wrap `saveProject` to check access first |
| `/api/projects` PATCH (rename, cover image) | Check access |
| `/api/projects` DELETE | Check access + extra check: refuse if canvas is this user's `free_primary_canvas_id` |
| `/api/canvas/invite` | Refuse if user is Free (both owner and viewer) |
| `/api/ai/*` endpoints | Refuse if the scoped canvas is locked or user is Free (AI is a Pro feature anyway, so this is mostly already gated) |
| Yjs / broadcast updates | Server-side Y.Doc sync needs to check permissions at the Supabase-auth-middleware layer before applying writes |

The Zustand store stays client-only; the backend is the source of truth. A client bypassing the UI still hits the permission gate at the API / Supabase RLS level.

### Supabase RLS

Add/update RLS policy on `cxd_projects` for UPDATE:

```sql
-- UPDATE: owner can update only if editable, else reject
create policy cxd_projects_owner_update on public.cxd_projects
  for update to authenticated using (
    owner_id = auth.uid()
    and (
      -- Pro/Lifetime/Beta_tester: full access
      exists (
        select 1 from public.subscriptions s
        where s.user_id = auth.uid()
          and s.plan_id in ('pro', 'lifetime', 'beta_tester')
      )
      -- Free: only their chosen canvas
      or exists (
        select 1 from public.subscriptions s
        where s.user_id = auth.uid()
          and s.plan_id = 'free'
          and s.free_primary_canvas_id = cxd_projects.id
      )
    )
  );
```

Similar policy update for `canvas_collaborators` inserts (refuse if the canvas owner is Free).

## Client-side permission hook

New `useCanvasPermissions(canvasId)` hook in `src/hooks/use-canvas-permissions.ts`:

- Subscribes to the Supabase RPC `get_canvas_access(canvas_id)` that mirrors `resolveCanvasAccess`
- Returns the same `CanvasAccess` shape
- Cache with SWR-like invalidation on subscription status changes

Used by:
- `CXDCanvas` — conditionally render the toolbar, hide AI chat button, disable element drag when `!canEdit`
- `CanvasElementRenderer` — strips resize/connect handles when `!canEdit`
- `DashboardContent` — for tile decoration

## Migration for existing Free users

On deployment, a one-time backfill job (or a `supabase/migrations/` SQL migration) sets `free_primary_canvas_id` for Free users who already have exactly 1 canvas:

```sql
update public.subscriptions s
set free_primary_canvas_id = (
  select id from public.cxd_projects p
  where p.owner_id = s.user_id
  limit 1
)
where s.plan_id = 'free'
  and s.free_primary_canvas_id is null
  and (select count(*) from public.cxd_projects p where p.owner_id = s.user_id) = 1;
```

Existing Free users with 2+ canvases (former Pros who downgraded pre-feature) will see the modal on next login. Acceptable.

## Error handling

- If the `free-primary-canvas` API is called with a canvas the user doesn't own: 403.
- If called when `free_primary_canvas_id` is already set: 409 ("already chosen").
- If called with a non-existent canvas id: 404.
- If the modal fails to load subscription data: show a retry UI, never lock the user out of the dashboard.
- If a mutation endpoint rejects due to read-only, the client shows a toast: "This canvas is read-only on your Free plan. Upgrade to Pro to edit."

## Testing plan

- **Unit:** `resolveCanvasAccess` across the matrix of (owner_plan × is_free_primary × viewer_role).
- **Integration:** a Supabase test user toggled between plans: verify the modal appears / doesn't appear / unlocks correctly.
- **Manual flow:** create 3 canvases as Pro in test mode, cancel the subscription via Stripe CLI (`stripe trigger customer.subscription.deleted`), log in, see the modal, pick one, verify the other two show locked in the dashboard, verify direct navigation to `/cxd?project=<locked>` redirects to overview. Re-subscribe, verify all three unlock. Cancel again, verify the same canvas auto-becomes the free one.

## Files delivered

Creation:
- `supabase/migrations/<timestamp>_free_primary_canvas.sql` — new column + RLS updates + backfill
- `src/lib/canvas-permissions.ts` — `resolveCanvasAccess` helper
- `src/hooks/use-canvas-permissions.ts` — client hook
- `src/components/pick-free-canvas-modal.tsx` — the blocking modal
- `src/app/api/subscriptions/free-primary-canvas/route.ts` — POST handler

Modification:
- `src/app/dashboard/page.tsx` or its client component — mount the modal
- `src/components/dashboard-content.tsx` — tile decoration (lock icon, badges, hidden actions)
- `src/app/cxd/page.tsx` — redirect for locked canvases
- `src/app/cxd/overview/[projectId]/page.tsx` — banner + "View read-only canvas" button
- `src/components/cxd/cxd-canvas.tsx` — respect `useCanvasPermissions` (hide tools, disable drag)
- `src/components/cxd/canvas/canvas-element.tsx` — disable handles when `!canEdit`
- `src/app/api/projects/*` — access checks on PATCH/DELETE
- `src/lib/supabase-projects.ts` — `saveProject` access check

No changes to:
- Stripe webhook handlers (already set subscription state correctly)
- Email templates (the `subscription-cancelled` template already communicates the downgrade)
- Billing / Stripe config

## Out of scope / Phase 2 candidates

- Admin UI to force-unlock a specific canvas (support escape hatch)
- A grace period before locking kicks in (explicitly rejected in brainstorm)
- Bulk canvas archive / export for locked canvases
- Transferring ownership of a locked canvas to a Pro collaborator
