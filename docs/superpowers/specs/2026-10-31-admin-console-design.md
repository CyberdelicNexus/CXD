# Admin Console Design

**Date:** 2026-10-31
**Status:** Awaiting owner review
**Branch:** `feat/admin-console` (worktree `CXD-admin`, from `origin/main` at `44a5dfb`)

## Goal

Give the team one protected place at `/admin` to manage users, work bug reports, feature requests and support requests, and send notifications and emails. Only people explicitly granted a role can reach it.

All four areas ship in one release. They are built in order: access, users, support, comms.

## Facts checked on live CXD

Checked read-only on project `sstllhsrmcvijyokykwp` on 2026-10-31. The local `supabase` MCP points at a different project (Nexus Core), so implementation must use the CXD project explicitly.

| Fact | Consequence |
|---|---|
| No roles, admin gate or audit log exist | All are new |
| 38 auth users; `jose@cyberdelic.nexus` has no account | One Owner at launch |
| `notifications` RLS is own-rows only, with 0 global rows | `is_global` rows are invisible to everyone, so broadcasts must not use them |
| `/api/support` stores nothing | Tickets need new tables |
| `add_ai_credits` writes the legacy `users.ai_credits_balance`, not `ai_credits` | Do not reuse it for admin credit edits |
| `plan_source` allows only `stripe` and `nexus` | Needs an `admin` value |
| `email_log` has no unique constraint | Deduplication is the worker's check, not a database guarantee |
| Email layout has an unsubscribe slot but no postal address | Needs a configured address (see Comms) |
| Edge function `supabase-functions-push-notification` is deployed with `verify_jwt: false`, CORS `*`, and writes with the service role with no auth check | Live security hole (see Known risk) |

## Known risk: open notification endpoint

The deployed `supabase-functions-push-notification` function lets anyone on the internet insert a notification for any user ID, or a global row, with no login. It has no callers in `src/`. An attacker who has a user's ID can put fake messages in that user's bell.

**Decision (2026-10-31):** the owner chose not to delete it for now. The function, its repo copy and its guide section stay in place, and the risk remains open. The admin composer does not use it.

## Architecture

Roles live in a service-role-only table (`staff_roles` and `admin_audit_log` grant `service_role` less than ALL, as the Access section describes) and are checked on the server for every page and API route. All admin data is read and written through `/api/admin/*` and server components using `getSupabaseAdmin()`. No admin table is exposed to the browser client.

New code lives in:

- `src/app/admin/` for pages, with a real `layout.tsx` that runs the gate
- `src/app/api/admin/` for routes, using zod `safeParse` (template: `src/app/api/lab/votes/route.ts`)
- `src/lib/admin/` for `permissions.ts`, `gate.ts`, `audit.ts` and domain logic that `__verify__` scripts can test without a request
- `src/app/api/me/staff-role/` for the caller's own role, which drives the nav link and stays outside `/api/admin` so ordinary members get a 200

New migrations follow the service-role-only convention in `20261016000001_nexus_bridge.sql`: RLS on, no policies, `REVOKE ALL FROM anon, authenticated`, `GRANT ALL TO service_role`. Migrations are applied by hand, and the code tolerates their absence until then.

Use `@/supabase/server`, not the root `supabase/server.ts`.

## Access

### Roles

| Permission | Key | Staff | Admin | Owner |
|---|---|---|---|---|
| View users | `users.view` | x | x | x |
| Work support cards | `tickets.work` | x | x | x |
| View Sentry triage | `errors.view` | x | x | x |
| Edit plans and credits, send resets, suspend | `users.edit` | | x | x |
| Send notifications and bulk email | `comms.send` | | x | x |
| View audit log | `audit.view` | | x | x |
| Assign roles | `roles.assign` | | | x |

The matrix is a single constant in `src/lib/admin/permissions.ts`. Code checks permissions, never role names.

### `staff_roles`

`user_id` (primary key, references `auth.users`), `role` (`owner`, `admin` or `staff`), `granted_by`, `granted_at`.

- Owner rows are inserted by migration only, by account ID, never by email. The launch Owner is `322d15dd-8477-41ff-8980-f344fda14164` (connect@cyberdelic.nexus).
- The app cannot create, change or delete an Owner row. A database trigger enforces this for the app's writes, so a bug in a route cannot remove the Owner. Adding an Owner later, such as jose@, is a new migration.
- Removing a role deletes the row. The audit log keeps the history.

Because no decision reads an email address, registering or changing to one grants nothing.

### Gate

`requirePermission(key)` and `requirePagePermission(key)` live in `src/lib/admin/gate.ts`. They call `supabase.auth.getUser()`, then read `staff_roles` with the service-role client. A suspended account is denied even while its session is still valid.

- Pages: anyone without access gets `notFound()`, including signed-out visitors, so `/admin` does not reveal itself.
- API routes: 401 when signed out, 403 when the role lacks the permission.
- A failed role lookup denies access.

Every `/api/admin` route calls the gate first. `/api` is outside the middleware matcher, so middleware cannot protect it. The Admin link appears for staff only, in the user menu, and is cosmetic. The admin layout does not protect child pages: Next 14 renders layout and page concurrently, so every page calls `requirePagePermission` itself.

### `admin_audit_log`

Append-only: `id`, `actor_id`, `action`, `target_type`, `target_id`, `before`, `after`, `reason`, `outcome`, `created_at`. No update or delete grant exists, including for routes, enforced by a trigger.

Sensitive database changes (roles, plans, credits) go through `SECURITY DEFINER` RPCs that write the change and the audit row in one transaction, so neither can exist without the other.

Actions that call outside services (suspend, password reset, sends, ticket replies) write an `attempted` row first and abort if that write fails, then a `succeeded` or `failed` row afterward.

Secrets and message bodies longer than needed for review are not copied into `before` or `after`.

## Users

### List: `/admin/users`

Server-paged table with search by name or email and filters for plan and role. Columns: name, email, plan, credits used, last sign-in, role. Adds a `table` component to `src/components/ui/`.

### Detail: `/admin/users/[id]`

Profile, subscription, credits, canvas count, Nexus link, Stripe customer and subscription IDs linking to the Stripe dashboard, support cards and, for roles with `audit.view` only, audit history. Staff never receive the history: the page does not fetch it for them. Read-only for Staff.

### Actions

Plan change (`users.edit`):

- Allowed values are `free`, `pro` and `beta_tester`. `lifetime` is excluded because it carries a founding member number.
- Blocked, with the reason shown, when the row has a Stripe subscription that has not ended (any status except `canceled` and `incomplete_expired`, so `past_due` is included), when `plan_source = 'nexus'`, or when the plan is `lifetime`. The first would leave the user being charged and be overwritten by the next webhook. The second would be overwritten by the tier sync. The third was paid for.
- Handled by RPC `admin_set_plan`, which writes `plan_id` only if it changed, because the `on_subscription_change` trigger resets the credit allowance. The UI warns about that reset first.
- Sets `plan_source = 'admin'`, or clears it when the plan is set to `free`. It also clears `stripe_subscription_id`, which is only reachable when that subscription had ended.
- `isProtected` in `src/lib/nexus/tier.ts` and the Stripe webhook treat `admin` rows as protected from sync. A real Stripe purchase by that user takes over the row and sets `plan_source = 'stripe'`, because they are now paying.

Credit adjustment (`users.edit`):

- New RPC `admin_adjust_credits(target, amount, reason, actor)` locks the `ai_credits` row, changes `addon_credits`, and inserts an `ai_credit_transactions` row with `transaction_type = 'manual_adjustment'` and `balance_after`.
- A reason is required and is saved to the audit log. The member-readable `ai_credit_transactions` row carries the fixed text `Admin adjustment`, because members can read their own rows. The balance cannot go below zero.

Password reset (`users.edit`): the standard flow is PKCE, so a link requested from an admin's session would fail for the user. Instead, the server generates a recovery token and emails a link directly through Resend, bypassing Inngest so the token is not stored in its event history. The token is in the URL fragment (`/auth/recovery#token_hash=...`), so it never reaches a server log or a Sentry request URL; Sentry's `beforeSend` also redacts it. The page reads it in the browser, removes it from the address bar and shows a button that posts it to `/auth/recovery/confirm`, which starts the recovery session and continues to `/dashboard/reset-password`. The confirm route accepts only same-origin posts. Opening the link changes nothing, because mail scanners open links and the token works once. Only an Owner may send a reset to someone who holds a role.

Suspend and restore (`users.edit`):

- Uses `auth.admin.updateUserById` with `ban_duration`, with a required reason. All data is kept.
- Cannot target an Owner or yourself. Only an Owner can suspend someone holding a role.
- The page warns that suspension does not cancel Stripe billing.
- `src/app/auth/nexus-callback/route.ts` refuses suspended accounts explicitly, rather than relying on the magic-link step to do so.
- To verify on preview: whether an existing session ends at once or at token expiry.

Assign role (`roles.assign`): grants or removes `admin` and `staff`, through RPC `admin_set_role`.

### Out of scope

Deleting users, impersonation, per-user limit overrides, and canvas preferences (stored in browser `localStorage`).

## Support

### Tables

`support_tickets`: `id`, `user_id`, `email`, `type` (`bug`, `feature`, `support`), `title`, `description`, `status` (`new`, `in_progress`, `waiting`, `done`), `priority` (`low`, `normal`, `high`), `assignee_id`, `source_path`, `sentry_issue_url`, `created_at`, `updated_at`.

`support_ticket_events`: `id`, `ticket_id`, `actor_id`, `kind` (`note`, `reply`, `status`, `assignment`), `body`, `created_at`. Append-only.

Both are service-role-only.

### Intake

`POST /api/support` keeps its current auth and emails, and changes as follows:

1. Accept an explicit `type` instead of inferring it from the title.
2. Insert the ticket first.
3. Send the existing Sentry message and emails whether or not the insert succeeded, so a database failure loses nothing. Report an insert failure to Sentry.
4. Add a per-user rate limit using `src/lib/rate-limiter.ts`.

The dialogs in `src/components/dashboard-navbar.tsx` gain a Feature Request option and send the current path.

### Board: `/admin/support`

Columns: New, In progress, Waiting on user, Done. Filters: type, assignee, priority. Status changes through a control on the card, not drag and drop.

### Card detail

- Internal notes, visible to staff only.
- Reply by email: uses a new `emails/support-reply.tsx` template with reply-to `contact@cyberdelic.design`, records a `reply` event, and moves the card to `waiting`. The user's response arrives in that inbox and is not added to the card.
- Assign, change priority, attach a Sentry link, and link to the user's page.

Existing support emails are not imported.

### Errors: `/admin/errors`

Read-only list of `fix_pipeline` rows with severity and status. Acknowledge and snooze stay in Telegram.

## Comms

### In-app

A send inserts one `notifications` row per recipient through the service role, with `is_global = false`. This works with live RLS and gives each user their own read state, so the bell needs no redesign.

`src/hooks/use-notifications.ts` gains a `user_id=eq.<id>` realtime filter, which spares the per-subscriber RLS check on every row of a broadcast. Realtime cannot filter DELETE events, so clearing notifications on one device stops updating other open devices until they reload. `createGlobalAnnouncement` is removed because it cannot work.

### Email categories

- **Product update:** skips users who opted out.
- **Service notice:** sends to everyone, for essential account or service messages only. The composer states this.

### Unsubscribe

- `email_preferences`: `user_id` (primary key), `marketing_opt_out`, `opted_out_at`. Service-role-only.
- A signed token using new env var `EMAIL_UNSUBSCRIBE_SECRET` identifies the user, with no login. Tokens do not expire.
- `/unsubscribe` shows a confirmation button. Opening the link changes nothing, because mail scanners open links.
- `POST /api/email/unsubscribe` performs the opt-out and also serves one-click `List-Unsubscribe-Post`.
- `enqueueEmail` and the worker gain a `headers` option. Product updates carry `List-Unsubscribe` and `List-Unsubscribe-Post`.
- New env var `EMAIL_POSTAL_ADDRESS` is shown in the product update footer. The composer refuses product updates while it is unset.

### Composer: `/admin/comms`

Requires `comms.send`.

- Channel: in-app, email, or both.
- Audience: everyone, one plan, or chosen users.
- Body: plain formatted text, placed in a new `emails/broadcast.tsx` template based on `emails/feature-announcement.tsx`.
- Suspended users are excluded, and users with unconfirmed email addresses get in-app messages only.
- Before sending: preview, and the exact recipient count after opt-outs.
- Email sends require a test send to yourself for that exact content, then typing the recipient count to confirm.

### Sending

`broadcasts`: `id`, `sender_id`, `channels`, `category`, `audience`, `subject`, `body`, `recipient_count`, `sent_count`, `failed_count`, `created_at`. Service-role-only.

The route resolves recipients, then enqueues one Inngest event per email and returns. It calls `enqueueEmail` with `emailKind = 'broadcast:<id>'` so the worker's `email_log` check prevents duplicates per user, and with `fallbackOnMissing: false`, because the direct-send fallback skips that check and the headers. The worker throttles to Resend's rate limit and updates the broadcast's counts.

### Out of scope

Scheduled sends, open and click tracking, advanced segments, and processing replies.

## Errors and edge cases

- A failed action changes nothing and shows its error. RPC-backed actions are atomic.
- Actions that hit two systems record `failed` in the audit log, and the UI says what did and did not happen.
- Partial broadcast failures appear in the history as a failed count. There is no automatic resend beyond worker retries.
- The last-Owner case cannot arise, because the app cannot alter Owner rows.
- Non-staff always get 404 on pages and 403 on APIs, even for IDs that exist.

## Testing

The repo has no test runner. The gates are `npm run build` and `__verify__/*.verify.ts` run with `npx tsx`.

- `admin-roles.verify.ts`: the full permission matrix, and failed lookups denying access.
- `admin-routes.verify.ts`: walks every file in `src/app/api/admin/` and fails if a route handler does not call the gate first, so a new route cannot ship unprotected.
- `admin-plan-guard.verify.ts`: plan edit blocking, and `isProtected` for `admin` rows.
- `unsubscribe-token.verify.ts`: valid, tampered and wrong-secret tokens.
- `broadcast-audience.verify.ts`: opt-outs by category, suspended users excluded, and the test-send proof failing when content changes.
- `admin-tickets.verify.ts`: ticket type, title and body shaping.

Then browser-test on a preview deployment as signed-out, member, Staff, Admin and Owner, using test accounts and test sends only. No broadcast goes to real users as part of testing.

## Rollout

1. Build access, users, support and comms on `feat/admin-console`.
2. Owner approves the migrations, which are then applied by hand.
3. Set `EMAIL_UNSUBSCRIBE_SECRET` and `EMAIL_POSTAL_ADDRESS` in Vercel.
4. Verify on preview, then merge.

Commits must not contain `Co-Authored-By` trailers and must be authored as `Jose <connect@cyberdelic.nexus>`, per `CLAUDE.md`.
