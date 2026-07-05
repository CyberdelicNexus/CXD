-- Bridge write-back audit log (CXD-side half of the LifeOS Compass v3 bridge).
--
-- Every POST /api/bridge/task-writeback attempt that reaches the apply stage
-- (i.e. passed the feature flag, token check, body size cap, body validation,
-- idempotency lookup, rate limit, project allowlist, AND the owner assertion)
-- is recorded here — success ('applied'), a deliberate safety refusal
-- ('rejected', e.g. the empty-doc wipe guard tripped), or an unexpected
-- failure ('error'). Rows also serve as the idempotency ledger: a retried
-- idempotencyKey returns this stored result instead of re-applying
-- (docs/reviews/PS2_CANVAS_BRIDGE.md B5, in the LifeOS repo).
--
-- Requests rejected BEFORE the apply stage (bad/missing token, oversized or
-- malformed body, rate-limited, project not in BRIDGE_PROJECT_ALLOWLIST,
-- wrong owner) are NOT logged here — per PS2 B4, only operations that
-- actually reached the point of touching (or safety-refusing to touch) the
-- Y.Doc need an audit row.

create table if not exists public.bridge_ops_log (
  idempotency_key text primary key,
  project_id      uuid not null,
  element_id      text not null,
  task_key        text,
  patch           jsonb not null,
  result          text not null check (result in ('applied', 'rejected', 'error')),
  applied_at      timestamptz not null default now()
);

create index if not exists bridge_ops_log_project_id_idx
  on public.bridge_ops_log (project_id, applied_at desc);

-- Service-role only — same convention as stripe_events_processed
-- (20240425000002) / email_log (20240424000001): RLS enabled, zero policies,
-- so anon/authenticated sessions see and write nothing at all; only the
-- admin client (service role, used exclusively by the bridge route handler)
-- bypasses RLS. No customer or Jema-session client ever touches this table.
alter table public.bridge_ops_log enable row level security;
