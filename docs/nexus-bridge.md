# Cyberdelic Nexus ↔ CXD Canvas bridge

The Canvas side of the Nexus bridge (platform decision D182). Cyberdelic Nexus
(`https://cyberdelic.nexus`) is the one login for its members; a member who
opens the Canvas from Nexus arrives signed in, on the right canvas, with a plan
that follows their Nexus tier. The contract is shared with the platform repo;
neither side changes a name, claim, path or shape without the other.

Every piece is **inert while its env is unset**, so this can deploy before the
platform is configured.

## Routes

| Route | What it does | Unset env |
|---|---|---|
| `POST /auth/nexus-callback` | Form POST from the platform (field `token`). Verifies the ES256 handoff token against the platform JWKS (algorithm pinned, `aud=cxd-canvas`, `iss=NEXUS_ISSUER`, 60 s max age), claims its `jti` once, resolves the Canvas user (existing link → confirmed email match → pending link → new account), signs them in with a server-side magic link (no email), syncs the tier, then follows the intent (`/dashboard`, `/cxd?project=<id>`, or a new project at `/cxd?project=<id>&view=wizard`, or `/dashboard?upgrade=canvas` at the free limit). Any failure → `303 /sign-in?error=<code>`, no session. | `/sign-in?error=unavailable` |
| `GET /api/nexus/projects?member=<uuid>` | Server to server. `Authorization: Bearer NEXUS_BRIDGE_TOKEN` (or `_PREVIOUS`), timing-safe, rate-limited (`cxd:nexus-rl`, 60/min). Returns `{linked, plan, canCreate, projects[]}`: owned + shared-with-me, newest first, at most 60, `coverImage` only when `https:`. | `404` |
| `GET /api/cron/nexus-tier-sync` | Daily (04:00 UTC, `vercel.json`), `CRON_SECRET`. Re-syncs the tier of every linked user. | no-op (`skipped`) |
| `GET /api/projects` (existing) | For a linked user whose `nexus_checked_at` is over an hour old, refreshes the tier (2 s timeout, never fails the listing). | skipped |
| `/cxd?project=<id>[&view=wizard\|canvas\|focus]` | Loads that project into the store before the editor mounts, sets the view, strips `project` from the URL. `?id=` is an alias (the invite page and dashboard navbar already used it, and it was ignored before). | — |
| `/sign-in?nexus=link` | Shows "Sign in once with your Canvas login to connect it to your Cyberdelic Nexus account." Error codes from the callback show a short readable message. | — |

### Error codes (`/sign-in?error=`)

`unavailable` (bridge not configured, or the JWKS / database could not be
reached), `invalid` (bad token: signature, algorithm, audience, issuer or
claims), `expired`, `replayed`, `link_conflict` (that Canvas account is
already linked to another member), `failed` (anything else).

### Pending link

When the member's email matches a Canvas account whose email is **not
confirmed**, the callback stores `sha256(token)` in `nexus_pending_links`
(15 minutes) and sets the httpOnly, Secure, SameSite=Lax cookie
`cxd_nexus_link`. The next successful password sign-in (`signInAction`) or
Google / email-confirmation callback (`/auth/callback`) **as that same user
id** writes the link, deletes the row, clears the cookie and follows the
stored intent. Note: with email confirmation on, Supabase refuses a password
sign-in for an unconfirmed address, so in practice this completes through
Google or the confirmation email.

### Tier sync

`active && tier in (hacker, weaver, lifetime)` → `pro`, anything else → `free`.
A row with an active/trialing Stripe subscription, or a lifetime/beta plan not
granted by Nexus, is left alone (only `nexus_checked_at` moves). Nexus pro →
`plan_id='pro', status='active', plan_source='nexus'`. Nexus free on a row with
`plan_source='nexus'` → `plan_id='free', plan_source=null`. A failed or error
answer (including 404) changes nothing. `plan_id` is only written when it
changes, because the `on_subscription_change` trigger resets credits on any
update of that column. The Stripe webhook sets `plan_source='stripe'` on Pro
and Lifetime checkout, and `customer.subscription.deleted` no longer downgrades
a `plan_source='nexus'` row.

## Code

Pure logic (no network, no database) lives in `src/lib/nexus/` so the verify
script can run it: `handoff.ts` (verification, jti claim, intent parsing),
`tier.ts` (mapping and the sync rule), `listing.ts` (listing shape, cover
filter, new-project row, destinations), `config.ts` (env and credentials) and
`src/lib/project-deep-link.ts`. `server.ts` and `pending-link.ts` hold the
service-role code the routes call.

## Env

| Name | Value |
|---|---|
| `NEXUS_ISSUER` | `https://cyberdelic.nexus` |
| `NEXUS_JWKS_URL` | `https://cyberdelic.nexus/api/handoff/jwks` |
| `NEXUS_TIER_CREDENTIAL` | = the platform's `CANVAS_TIER_READ_CREDENTIAL` |
| `NEXUS_BRIDGE_TOKEN` | = the platform's `CANVAS_BRIDGE_CREDENTIAL` (unset = listing 404s) |
| `NEXUS_BRIDGE_TOKEN_PREVIOUS` | the old credential, only while rotating |
| `NEXUS_RATE_LIMIT_PER_MIN` | optional, default 60 |

Secrets are compared timing-safe and never logged; neither are tokens, emails
or payloads.

## Migration

`supabase/migrations/20261016000001_nexus_bridge.sql` (apply by hand):
`nexus_links`, `nexus_handoff_jti`, `nexus_pending_links` (RLS on, no
policies, no privileges for `anon`/`authenticated` — service role only),
`subscriptions.plan_source` (`'stripe' | 'nexus' | null`) and
`subscriptions.nexus_checked_at`, and the service-role-only function
`nexus_find_auth_user(p_email)`. The Stripe webhook keeps working before the
migration is applied (it retries without `plan_source`).

## How to test

1. Pure logic: `npx tsx src/lib/nexus/__verify__/handoff.verify.ts`.
2. Inert: with no `NEXUS_*` env, `POST /auth/nexus-callback` → `/sign-in?error=unavailable`,
   `GET /api/nexus/projects` → 404, the cron → `{"skipped":true}`.
3. End to end (preview + a platform preview with a key): apply the migration,
   set the env, open the Canvas from the Nexus dashboard with no Canvas account
   (one is created), with a confirmed one (linked by email), and with "New
   canvas" on a free account that already has one (→ upgrade modal). Replay the
   same form POST from the browser's network tab: `error=replayed`.
