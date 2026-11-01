# Admin Analytics Dashboard Design

**Date:** 2026-11-01
**Status:** Awaiting owner review
**Branch:** `feat/admin-analytics` (worktree `CXD-admin`, from `origin/main` at `cf6d994`)

## Goal

Make `/admin` a home page that shows what needs attention, how the business is doing, how the product is used, and whether the system is healthy. It replaces the redirect to `/admin/support`.

## Facts checked on live CXD

Checked read-only on project `sstllhsrmcvijyokykwp` on 2026-11-01.

| Fact | Consequence |
|---|---|
| No `subscriptions` row has a `stripe_subscription_id` | MRR reads $0 today, so the page also shows one-time revenue |
| 32 subscription rows: 24 beta testers, 2 Pro, 1 lifetime, 5 free | Paying and comped users must be separate numbers |
| `auth.users` keeps only the last sign-in | Active-user history cannot be rebuilt, so it needs snapshots |
| `ai_credit_transactions` has no usage rows | Credit trends cannot come from the ledger, so they need snapshots |
| `ai_credits.used_this_period` totals 177 | Current period usage is available live |
| `fix_pipeline` is empty | Errors panel must have a clear empty state |
| The app has Speed Insights but not Web Analytics | Visitor data needs Web Analytics enabled first |

Vercel's [public Web Analytics API](https://vercel.com/docs/analytics/web-analytics-api) exists, but its availability on the Hobby plan is unconfirmed, so visitors are optional.

## Architecture

The page reads live sources on load with a 5-minute server cache. One nightly job saves a row of numbers that cannot be rebuilt later. Trends for active users, MRR and credits therefore start on the day this ships.

Each source is isolated, so one failing source shows "Unavailable" on its own panels and the rest of the page still loads.

New code:

- `src/lib/admin/analytics/metrics.ts`: pure calculations, so `__verify__` scripts can test them without a request
- `src/lib/admin/analytics/sources.ts`: one reader per source (Supabase, Stripe, Vercel), each returning `{ ok: true, data }` or `{ ok: false }`
- `src/app/api/cron/admin-metrics/route.ts`: nightly snapshot
- `src/components/admin/dashboard/`: panels and charts

Charts use `recharts`, already installed. The stat panels and charts load on the server except for the chart components themselves.

## Access

| Section | Permission | Staff | Admin | Owner |
|---|---|---|---|---|
| Needs attention | `tickets.work` | x | x | x |
| Business, Growth, Product usage, System | `analytics.view` (new) | | x | x |

`analytics.view` is added to the matrix in `src/lib/admin/permissions.ts`. The page checks the permission before calling any analytics reader, so Staff requests never fetch revenue. `requirePagePermission('tickets.work')` remains the page gate.

Cached values are shared between viewers, so the permission check must run before the cached read, never inside it. Cached data never leaves the server except through the gated page.

## Page

A 7, 30 or 90-day selector sets `?range=`, defaulting to 30. Any other value falls back to 30.

### 1. Needs attention

Each number links to where it is handled. The strip reads "All clear" when all are zero.

- Open support cards: `support_tickets` where status is not `done`, with high-priority count
- Unresolved errors: `fix_pipeline` rows where `decision` is null
- Failed payments: `subscriptions` with status `past_due` or `unpaid`
- Failed emails: sum of `broadcasts.failed_count` plus `delivery_failed` ticket events, within the selected range

### 2. Business

- MRR
- Revenue in the selected range
- Paying users: Stripe subscriptions with status `active` or `past_due`, plus `lifetime` plans whose `plan_source` is null or `stripe` (the checkout webhook sets `stripe` on lifetime purchases). Trialing subscriptions are counted apart and shown as a hint on the Paying card; they are not comped
- Comped users: a non-free plan with no Stripe subscription, or with `plan_source` `nexus` or `admin`, which covers beta testers and Nexus or admin grants. A lapsed Stripe customer (canceled, unpaid, paused, incomplete) is neither paying nor comped and falls into the Free remainder
- New and cancelled subscribers in the range. New excludes `incomplete` and `incomplete_expired` and includes trials; cancelled uses the subscription's `ended_at`, when it actually stopped

MRR is the list price of Stripe subscriptions with status `active`. Yearly prices divide by 12, weekly multiply by 52 and divide by 12, and quantity applies. Trials, past-due subscriptions and metered prices are excluded, and discounts are ignored, so it is labelled "MRR (list price)".

Revenue is succeeded Stripe charges minus refunds, created within the range. This covers lifetime plans and credit packs.

Amounts stay in their own currency and are never converted. Zero-decimal currencies (JPY, KRW and the rest of Stripe's list) are not divided by 100. More than one currency shows one line each.

### 3. Growth

- Signups per day, from `auth.users.created_at`
- Active users in 7 and 30 days
- Visitors, when the Vercel source is available

A user is active in a window if they signed in, or own a canvas updated, within it. The active-user trend comes from snapshots. Until two real snapshots exist, the chart reads "Collecting since <date>". If the snapshot read fails, the trend panels read "Unavailable" instead. Snapshots are read by date for the selected range, and a night with no row is a gap in the chart.

### 4. Product usage

- Canvases created per day, from `cxd_projects.created_at`
- Total canvases
- AI credits used this period, with the trend from snapshots
- Plan mix, a small list of plans with user counts, labelled "Plan mix (subscription rows)" because it counts subscription rows and not users without one
- Assistant feedback count in the range, from `canvas_assistant_feedback`

### 5. System

- Recent triaged errors from `fix_pipeline`, linking to `/admin/errors`
- Emails logged in the range, from `email_log`, labelled as tracked emails because only kind-tracked sends are logged
- Last broadcast with its counts

## Nightly snapshot

`admin_daily_metrics`: `day` (date, primary key), `active_7d`, `active_30d`, `mrr_cents` (jsonb by currency), `paying_users`, `comped_users`, `free_users`, `credits_used_period`, `created_at`. It follows the service-role-only convention: RLS on, no policies, `REVOKE ALL` from `PUBLIC`, `anon`, `authenticated` and `service_role`, then `GRANT SELECT, INSERT, UPDATE` to `service_role`.

`GET /api/cron/admin-metrics` checks `CRON_SECRET` the way `src/app/api/cron/spend-monitor/route.ts` does, then upserts today's row, so a rerun is safe. It runs daily at 03:00 UTC through `vercel.json`, which stays within Hobby's daily schedule limit.

A failed Stripe read leaves `mrr_cents` out of the upsert. A new row keeps the column's null default, so the trend shows a gap and never a false zero, and a rerun cannot erase a value saved earlier the same day. The Stripe read gets 30 seconds in the cron. Cron failures go to Sentry.

Credit usage resets each period, so the trend plots the snapshot total as stored and does not calculate daily differences.

Supabase counts come from two `SECURITY DEFINER` RPCs with an empty `search_path` and `EXECUTE` for `service_role` only: `admin_attention_summary(p_days integer)` for Needs attention, and `admin_analytics_summary(p_days integer)` for everything else. They avoid loading rows into the app, and Staff only ever trigger the first.

## Visitors (optional)

- Add `@vercel/analytics` and render `<PrivacyAnalytics />` (a client wrapper around `<Analytics />`) beside `<SpeedInsights />` in `src/app/layout.tsx`.
- Privacy: the wrapper's `beforeSend` runs `redactAnalyticsUrl`, which removes every query string and fragment (invite and unsubscribe links carry secrets there) and replaces the token in `/cxd/share/<token>` and the ids in `/cxd/overview/<id>`, `/admin/users/<id>` and `/admin/support/<id>` with a fixed placeholder, so no secret path reaches Vercel.
- The owner enables Web Analytics in the Vercel dashboard and sets `VERCEL_ANALYTICS_TOKEN` and `VERCEL_ANALYTICS_PROJECT_ID`, plus `VERCEL_TEAM_ID` for a team-owned project.
- The reader calls `https://api.vercel.com/v1/query/web-analytics/visits/count`. Vercel's docs show two response shapes, so anything else counts as unavailable.
- With no token, a rejected token, a plan refusal or an unknown response, the panel shows "Available in Vercel" with a link to that dashboard.

Visitor history starts on the day Web Analytics is enabled.

## Errors and edge cases

- Each reader catches its own failure, reports to Sentry with a tag and returns `{ ok: false }`. No secret or user data goes in the report.
- A timeout of 8 seconds applies to each outside call, so a slow source cannot hold up the page.
- A failed source is shown as "Unavailable", never as zero.
- Cached reads carry a time bucket (60 seconds for Needs attention, 300 for the rest) in their cache key. `unstable_cache` otherwise serves a stale entry with no age limit and hides refresh failures, which would leave "All clear" on screen after a source broke.
- Stripe reads page through all results. A failure partway reports the source as failed, never a partial total.
- An unset `STRIPE_SECRET_KEY` reports the source as unavailable.

## Testing

The gates are `npm run build` and `__verify__/*.verify.ts` run with `npx tsx`.

- `admin-analytics.verify.ts`: MRR for monthly, yearly, weekly, quantity, mixed currency, trial and past-due inputs; revenue minus refunds; range parsing; paying versus comped classification; the "All clear" rule; a failed source staying distinct from zero
- `admin-roles.verify.ts`: the `analytics.view` row
- `analytics-url.verify.ts`: share tokens, project ids, query strings and fragments are redacted
- Also in `admin-analytics.verify.ts`: lifetime bought through Stripe, trialing and past-due classification, metered prices, zero-decimal currencies, plan mix and day filling
- `admin-routes.verify.ts`: unchanged rules cover the page

Then browser-test `/admin` as Staff and as Owner on production after deploy. Staff must see only Needs attention, and must not receive revenue in the page payload.

## Rollout

1. Build on `feat/admin-analytics`.
2. Owner applies the one migration, or approves it being applied.
3. Merge. The nightly job starts, and trends start from its first run.
4. Optional: enable Web Analytics and set `VERCEL_ANALYTICS_TOKEN`.

Commits must not contain `Co-Authored-By` trailers and must be authored as `Jose <connect@cyberdelic.nexus>`, per `CLAUDE.md`.

## Out of scope

Exports, custom date ranges, cohort or retention charts, alerts, and historical backfill of snapshots.
