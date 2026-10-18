-- Sentry self-correcting loop (Phase 1) — pipeline state table.
--
-- Sentry remains the record of truth for issue status/snooze; this table records
-- only the loop's OWN lifecycle per issue: when we first triaged it, what the AI
-- recommended, what the human decided, and (later phases) the fix PR/deploy.
-- One row per Sentry issue id, so re-fired webhooks dedupe against it.

create table if not exists public.fix_pipeline (
  id                uuid primary key default gen_random_uuid(),
  sentry_issue_id   text not null unique,
  sentry_short_id   text,
  project_slug      text,
  title             text,
  culprit           text,
  permalink         text,

  -- Lifecycle: triaged -> notified -> (acknowledged|snoozed|ignored) -> [phase2: fixing -> deployed -> verified|regressed]
  status            text not null default 'triaged',

  -- AI triage output (see src/lib/sentry-loop/triage.ts)
  triage_tier       smallint,           -- 0 noise, 1 low-risk, 2 human-only
  triage_action     text,               -- fix_now | wait | snooze | ignore
  triage_confidence real,
  triage_rationale  text,
  is_critical_surface boolean default false,
  is_known_noise    boolean default false,
  event_count       integer,
  user_count        integer,
  level             text,

  -- Human decision (via Telegram callback)
  decided_by        text,               -- telegram user id
  decision          text,               -- ack | snooze | ignore
  decided_at        timestamptz,

  -- Telegram message we posted (so we can edit it in place on decision)
  telegram_message_id text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists fix_pipeline_status_idx on public.fix_pipeline (status);
create index if not exists fix_pipeline_created_idx on public.fix_pipeline (created_at desc);

-- Service-role only. This table is written exclusively from server contexts
-- (webhooks, Inngest). RLS on with no policies = no client access at all.
alter table public.fix_pipeline enable row level security;

comment on table public.fix_pipeline is
  'Sentry self-correcting loop pipeline state. One row per Sentry issue. Sentry stays the record of truth for issue status; this tracks the loop lifecycle + AI triage + human decision.';
