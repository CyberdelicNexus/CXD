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
