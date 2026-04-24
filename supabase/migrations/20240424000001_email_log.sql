-- Email log for idempotency-guarded automated emails.
-- Every automated send inserts one row; handlers check for existing rows
-- before sending so cron re-runs and webhook retries never double-send.

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_kind text not null,
  sent_at timestamptz not null default now(),
  stripe_event_id text,
  metadata jsonb
);

create index if not exists email_log_user_kind_idx
  on public.email_log(user_id, email_kind);

create index if not exists email_log_stripe_event_idx
  on public.email_log(stripe_event_id)
  where stripe_event_id is not null;

-- Service-role only. Clients never read or write this table directly.
alter table public.email_log enable row level security;

-- No policies for anon/authenticated — service role bypasses RLS by default.
-- Leaving RLS on with no policies means only service role clients can access.
