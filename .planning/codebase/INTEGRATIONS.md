# External Integrations

**Analysis Date:** 2026-03-18

## APIs & External Services

**AI Models (Multi-Provider):**
- OpenAI (GPT-4o, GPT-4o Mini)
  - SDK: `@ai-sdk/openai` package
  - Auth: `OPENAI_API_KEY` env var
  - Used by: `/src/app/api/ai/chat` route and `/src/lib/ai/provider-registry.ts`
  - Supports BYOK (Bring Your Own Key) for Pro+ users

- Anthropic Claude (Haiku 4.5, Sonnet 4.5, Opus 4.6)
  - SDK: `@ai-sdk/anthropic` package
  - Auth: `ANTHROPIC_API_KEY` env var
  - Used by: AI chat endpoint with model fallback to Haiku
  - Supports BYOK for Pro+ users

- Google Generative AI (Gemini 2.0 Flash, 2.5 Pro)
  - SDK: `@ai-sdk/google` package
  - Auth: `GOOGLE_GENERATIVE_AI_API_KEY` env var
  - Used by: AI chat endpoint (default model: Gemini 2.0 Flash)
  - Supports BYOK for Pro+ users

- NVIDIA API (Kimi K2.5 via NVIDIA inference)
  - SDK: OpenAI-compatible endpoint wrapper
  - Auth: `NVIDIA_API_KEY` or `MOONSHOT_API_KEY` env var
  - Base URL: `https://integrate.api.nvidia.com/v1`
  - Model ID: `moonshotai/kimi-k2.5`
  - Implementation: `/src/lib/ai/provider-registry.ts` lines 31-34
  - Supports BYOK for Pro+ users

**Email Service:**
- Resend - Transactional email delivery
  - SDK: `resend` package (v6.9.1)
  - Auth: `RESEND_API_KEY` env var
  - From Email: `RESEND_FROM_EMAIL` env var (configured: `contact@auth.cyberdelic.design`)
  - Implementation: `/src/lib/email.ts` handles all outbound email
  - Used for subscription confirmations, cancellations, credit purchase receipts

## Data Storage

**Primary Database:**
- Supabase PostgreSQL
  - URL: `NEXT_PUBLIC_SUPABASE_URL` (https://sstllhsrmcvijyokykwp.supabase.co)
  - Anon Key: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public, safe for browser)
  - Service Role: `SUPABASE_SERVICE_ROLE_KEY` (admin operations only)
  - Server client: `/src/supabase/server.ts` (uses SSR with cookies)
  - Browser client: `/src/supabase/client.ts` (uses Supabase SSR)
  - Tables: projects, users, subscriptions, ai_credits, canvas_uploads, notifications, collaborators, knowledge_cache, ai_credit_transactions, user_api_keys
  - Migrations: `supabase/migrations/` directory
  - RPC Functions: `deduct_ai_credits` (credit system), custom authorization functions

**File Storage:**
- Supabase Storage (canvas_uploads bucket)
  - Remote Pattern: `sstllhsrmcvijyokykwp.supabase.co` in Next.js config
  - MIME Types: Standard document and image types
  - Used for: Project files, cover images, canvas exports

**Browser Storage:**
- IndexedDB (via Yjs)
  - Provider: `y-indexeddb` package
  - Purpose: Local state persistence for real-time collaboration
  - Used by: Yjs CRDT for canvas state

**Caching:**
- No external caching service detected
- Likely using Next.js built-in caching and browser caching

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (built-in PostgreSQL auth)
  - Implementation: `/src/supabase/server.ts` and `/src/supabase/client.ts`
  - Method: Password-based with optional SSO (inferred from auth routes)
  - Session management: Cookie-based via `@supabase/ssr`
  - Auth routes: `/src/app/(auth)/` directory
    - Sign up: `(auth)/sign-up/`
    - Sign in: `(auth)/sign-in/`
    - Forgot password: `(auth)/forgot-password/`
  - User table: Extended with `full_name`, `email` fields
  - Protected endpoints: Verify user via `supabase.auth.getUser()`

**User API Keys (BYOK Support):**
- Custom API keys stored in Supabase `user_api_keys` table
  - Encryption: Uses `/src/lib/encryption.ts` (AES encryption of user API keys)
  - Providers supported: openai, anthropic, google, moonshot (Kimi)
  - Status: `is_active` boolean flag
  - Usage: AI chat route checks BYOK availability before using default keys

## Payment & Billing

**Payment Processor:**
- Stripe
  - SDK: `stripe` package (v17.6.0)
  - API Version: `2025-01-27.acacia`
  - Keys:
    - Secret: `STRIPE_SECRET_KEY` (server-only)
    - Publishable: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client-safe)
  - Subscriptions:
    - Pro Plan: `STRIPE_PRO_PRICE_ID` (monthly subscription with trial)
    - Lifetime Plan: `STRIPE_LIFETIME_PRICE_ID` (one-time payment)
  - Trial Period: Configured in plans config (7 days inferred)
  - Implementation: `/src/lib/stripe.ts` for lazy-loaded Stripe instance
  - API Routes:
    - POST `/api/stripe/create-checkout` - Create checkout session
    - POST `/api/stripe/create-billing-portal` - Customer portal
    - POST `/api/stripe/create-checkout-session` - Generic checkout
    - POST `/api/stripe/create-credit-checkout` - Credit pack purchases
    - GET `/api/stripe/create-portal` - Billing management portal

**Plan Configuration:**
- Stored in `/src/lib/plans.ts`
- Free, Pro, Lifetime tiers
- Feature access controlled by plan_id in subscriptions table
- Founding member tracking: Limited to 250 lifetime licenses with `founding_member_number`

## Webhooks & Callbacks

**Incoming Webhooks:**

**Stripe Webhooks:**
- Endpoint: POST `/api/webhooks/stripe`
- Secret: `STRIPE_WEBHOOK_SECRET` env var
- Events handled in `/src/app/api/webhooks/stripe/route.ts`:
  - `checkout.session.completed` - Process subscription or one-time purchase
    - Updates `subscriptions` table with plan_id, stripe_customer_id, subscription dates
    - Adds monthly AI credits for Pro plan (100 credits)
    - Sends confirmation email via Resend
    - Assigns founding member number (up to 250) for lifetime purchases
  - `customer.subscription.deleted` - Handle subscription cancellation
    - Updates subscriptions to `plan_id: 'free'` and `status: 'canceled'`
    - Resets monthly_allowance to 0
    - Sends cancellation email via Resend
  - `payment_intent.succeeded` - Process one-time credit purchases
    - Adds addon_credits to ai_credits table
    - Logs transaction in ai_credit_transactions
    - Sends purchase receipt email

**Outgoing Webhooks:**
- Not detected in codebase (one-directional integrations only)

## Third-Party APIs Used

**Image Services:**
- Unsplash
  - Remote pattern allowed: `images.unsplash.com`
  - Used for: Background images, design assets
  - Implementation: Next.js image optimization

**Link Preview/Metadata:**
- Unknown provider (endpoint exists at `/api/link-meta`)
- Purpose: Fetch metadata from external links for previews

## Credit System Integration

**AI Credit Ledger:**
- Table: `ai_credit_transactions`
- Credit costs defined in `/src/lib/ai-credit-config.ts`
- RPC function: `deduct_ai_credits(p_user_id, p_cost)` in Supabase
- Credit types:
  - `monthly_allowance` - Recurring credits for paid plans
  - `addon_credits` - One-time purchased credits
- Rate limiting: Implemented in `/src/lib/ai/rate-limiter.ts`

## Knowledge Retrieval System

**Semantic Search:**
- Database: Supabase PostgreSQL with pgvector extension (inferred)
- Tables:
  - `knowledge_cache` - Stores embeddings and content
- Functions:
  - `/src/lib/ai/knowledge-retrieval.ts` - Retrieval logic
  - `/supabase/functions/sync-knowledge/` - Background sync function
- Integration: AI chat endpoint includes retrieved context in system prompt (non-blocking, graceful fallback)

## Monitoring & Observability

**Error Logging:**
- Console logging via `console.error()` and `console.warn()`
- No external error tracking service detected
- Includes detailed error context in API responses

**Analytics/Telemetry:**
- Not detected in codebase

**Request Logging:**
- Console logging for AI chat requests including model, provider, BYOK status
- Rate limit tracking via in-memory store

## Real-Time Collaboration

**CRDT Implementation:**
- Yjs (v13.6.29) - Conflict-free replicated data type
- Storage: IndexedDB via `y-indexeddb`
- Protocol: `y-protocols` utilities
- Purpose: Multi-user canvas editing without central server synchronization
- Note: Active sync mechanism not visible (likely handled by client-side only or via Supabase realtime)

## Environment Configuration

**Required env vars for integrations:**
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Stripe
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_PRO_PRICE_ID
STRIPE_LIFETIME_PRICE_ID
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
NEXT_PUBLIC_STRIPE_LIFETIME_PRICE_ID
STRIPE_WEBHOOK_SECRET

# AI Providers
OPENAI_API_KEY
ANTHROPIC_API_KEY
GOOGLE_GENERATIVE_AI_API_KEY
NVIDIA_API_KEY (or MOONSHOT_API_KEY)

# Email
RESEND_API_KEY
RESEND_FROM_EMAIL

# App Config
NEXT_PUBLIC_APP_URL (https://canvas.cyberdelic.design)
```

**Secrets location:**
- Development: `.env.local` (Git ignored)
- Production: Vercel environment variables or Supabase secrets
- Service role key: Server-only, never exposed to browser

---

*Integration audit: 2026-03-18*
