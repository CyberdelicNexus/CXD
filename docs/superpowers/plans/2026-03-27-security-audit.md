# Security Audit & Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comprehensive security review of the CXD application to identify and fix vulnerabilities before production release.

**Architecture:** Systematic audit across 5 domains: authentication, API routes, client-side security, data security, and infrastructure. Each task produces findings, and fixes are applied inline. A final vulnerability report is generated.

**Tech Stack:** TypeScript, Next.js, Supabase, Vercel AI SDK

---

### Task 1: Dependency Vulnerability Scan

**Files:**
- Read: `package.json`, `package-lock.json`

- [ ] **Step 1: Run npm audit**

Run: `cd CXD && npm audit 2>&1`
Expected: Report of known vulnerabilities. Note severity levels.

- [ ] **Step 2: Run npm audit fix for safe updates**

Run: `npm audit fix 2>&1`
Note: Only apply non-breaking fixes. Do not run `--force`.

- [ ] **Step 3: Document remaining vulnerabilities**

For any unfixed vulnerabilities, document:
- Package name and version
- Severity (critical, high, medium, low)
- Whether it's a direct or transitive dependency
- Whether it affects production or dev-only

- [ ] **Step 4: Commit fixes**

```bash
git add package.json package-lock.json
git commit -m "security: fix npm audit vulnerabilities"
```

---

### Task 2: Audit Authentication & Authorization

**Files:**
- Read: `src/supabase/server.ts`
- Read: `src/supabase/client.ts`
- Read: `src/utils/auth.ts`
- Read: `src/app/(auth)/sign-in/page.tsx`
- Read: `src/app/(auth)/sign-up/page.tsx`
- Read: `src/middleware.ts` (if it exists)
- Read: All API routes in `src/app/api/`

- [ ] **Step 1: Verify all API routes check authentication**

Read every API route file and verify that each one:
1. Creates a Supabase server client
2. Calls `supabase.auth.getUser()` to verify the session
3. Returns 401 if user is not authenticated

Check these routes:
```
src/app/api/ai/chat/route.ts
src/app/api/ai/analyze/route.ts
src/app/api/ai/byok/route.ts
src/app/api/ai/credits/route.ts
src/app/api/ai/credits/ledger/route.ts
src/app/api/ai/threads/route.ts
src/app/api/canvas/collaborators/route.ts
src/app/api/canvas/invite/route.ts
src/app/api/canvas/invite/accept/route.ts
src/app/api/link-meta/route.ts
src/app/api/profile/route.ts
src/app/api/projects/route.ts
src/app/api/support/route.ts
```

Document any route that lacks authentication checks.

- [ ] **Step 2: Verify webhook routes have proper validation**

Check `src/app/api/webhooks/stripe/route.ts`:
- Verify it validates the Stripe webhook signature
- Verify it uses `stripe.webhooks.constructEvent()` with the webhook secret
- Verify it does NOT check for user auth (webhooks come from Stripe, not users)

- [ ] **Step 3: Verify Stripe routes check authentication**

Check all Stripe-related routes:
```
src/app/api/stripe/create-billing-portal/route.ts
src/app/api/stripe/create-checkout/route.ts
src/app/api/stripe/create-checkout-session/route.ts
src/app/api/stripe/create-credit-checkout/route.ts
src/app/api/stripe/create-portal/route.ts
```

Each should verify the user is authenticated before creating sessions.

- [ ] **Step 4: Check middleware for auth protection**

Read `src/middleware.ts` (if it exists). Verify:
- Protected routes redirect to sign-in if no session
- Auth routes redirect to dashboard if already signed in
- API routes are properly handled

- [ ] **Step 5: Document findings**

Create a findings list with severity ratings for any issues found.

- [ ] **Step 6: Fix any missing auth checks**

For any API route missing authentication:

```typescript
// Add at the top of the route handler:
const supabase = await createClient();
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

- [ ] **Step 7: Commit fixes**

```bash
git add -A
git commit -m "security: add missing authentication checks to API routes"
```

---

### Task 3: Audit API Input Validation

**Files:**
- Read: All API routes in `src/app/api/`

- [ ] **Step 1: Check for input validation on all POST/PATCH/DELETE routes**

For each API route that accepts user input, verify:
1. Request body is validated (expected fields present, correct types)
2. String inputs are sanitized or bounded (max length)
3. IDs are validated as UUIDs where expected
4. No raw user input is passed directly to database queries

- [ ] **Step 2: Check AI chat route for prompt injection risks**

In `src/app/api/ai/chat/route.ts`:
- Verify user messages are treated as user input (not system prompts)
- Check that system prompts are not user-controllable
- Verify the model selection is validated against allowed models

- [ ] **Step 3: Check rate limiting coverage**

Read `src/lib/ai/rate-limiter.ts`. Verify:
- Rate limits are applied to AI endpoints
- Limits cannot be easily bypassed (e.g., by changing headers)
- Rate limit state is server-side (not client-controllable)

Check if non-AI endpoints also need rate limiting (e.g., project creation, invitation sending).

- [ ] **Step 4: Validate BYOK key handling**

In `src/app/api/ai/byok/route.ts`:
- Verify `validateAPIKeyFormat()` rejects obviously invalid keys
- Verify keys are encrypted before storage (`encryptAPIKey()`)
- Verify decryption uses server-side secrets only
- Verify masked keys in GET responses don't leak full key data

Read `src/lib/encryption.ts` and verify:
- AES-256 encryption is used correctly
- The encryption key comes from environment variables (not hardcoded)
- IV is random per encryption (not reused)

- [ ] **Step 5: Document and fix findings**

Apply fixes for any validation gaps. Common fixes:

```typescript
// Validate string length:
if (typeof content !== 'string' || content.length > 10000) {
  return NextResponse.json({ error: 'Invalid content' }, { status: 400 });
}

// Validate UUID format:
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_REGEX.test(projectId)) {
  return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
}
```

- [ ] **Step 6: Commit fixes**

```bash
git add -A
git commit -m "security: add input validation to API routes"
```

---

### Task 4: Audit Client-Side Security

**Files:**
- Search: All `.tsx` files for XSS vectors
- Read: `src/components/cxd/canvas/canvas-element.tsx` (user content rendering)
- Read: Auth flow pages

- [ ] **Step 1: Search for dangerouslySetInnerHTML**

Run: `grep -r "dangerouslySetInnerHTML" src/ --include="*.tsx" --include="*.ts"`

For each occurrence:
- Verify the input is sanitized (DOMPurify or similar)
- Or verify the content comes from a trusted source (not user input)
- If user content is rendered unsanitized, flag as HIGH severity

- [ ] **Step 2: Check user-generated content rendering**

Canvas elements display user-typed content. Verify that:
- Text element content is rendered as text (not HTML)
- Freeform card content is rendered safely
- Project names are escaped in all rendering contexts
- Board titles are escaped

Look for any place where `element.content` or similar user data is rendered without React's automatic escaping.

- [ ] **Step 3: Check for open redirects**

In auth flows (`sign-in`, `sign-up`, `forgot-password`):
- Check if any `redirect` or `returnTo` parameter is used
- Verify redirects are validated against an allowlist or are relative-only
- Check OAuth callback URL handling

- [ ] **Step 4: Verify no secrets in client bundles**

Run: `grep -r "SUPABASE_SERVICE_ROLE\|SECRET_KEY\|PRIVATE_KEY" src/ --include="*.tsx" --include="*.ts" | grep -v ".env" | grep -v "process.env"`

Verify:
- Only `NEXT_PUBLIC_*` env vars are used in client components
- Server-only env vars (`STRIPE_SECRET_KEY`, `ENCRYPTION_KEY`, etc.) are only used in `src/app/api/` or server components
- The `src/lib/encryption.ts` encryption key is not bundled client-side

- [ ] **Step 5: Document and fix findings**

- [ ] **Step 6: Commit fixes**

```bash
git add -A
git commit -m "security: fix client-side security issues"
```

---

### Task 5: Audit Data Security & Collaboration

**Files:**
- Read: `src/contexts/collaboration-context.tsx`
- Read: `src/app/api/canvas/invite/route.ts`
- Read: `src/app/api/canvas/collaborators/route.ts`
- Read: AI-related routes for data leakage

- [ ] **Step 1: Verify collaboration access control**

In the collaboration system:
- Verify that only project owners can invite collaborators
- Verify that collaborators can only access projects they're invited to
- Check if there's RLS (Row Level Security) on the Supabase tables
- Verify the invite accept flow validates the invitation token

- [ ] **Step 2: Check AI data leakage**

In `src/app/api/ai/chat/route.ts` and `src/lib/ai/system-prompts.ts`:
- Review what project data is sent to AI providers
- Check if sensitive data (user emails, API keys, financial data) could leak into AI context
- Verify the knowledge retrieval (`knowledge-retrieval.ts`) only sends canvas content, not auth tokens

- [ ] **Step 3: Check file upload security**

Search for image upload handling:
- Verify file type validation (only accept image types)
- Verify file size limits
- Check if uploaded files are served through a CDN/Supabase storage (not directly from the app server)

- [ ] **Step 4: Review error response information disclosure**

Check API routes for error responses that might leak:
- Stack traces in production
- Database query details
- Internal file paths
- User data from other accounts

Ensure errors return generic messages:

```typescript
// BAD:
return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });

// GOOD:
console.error('API error:', err);
return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
```

- [ ] **Step 5: Document and fix findings**

- [ ] **Step 6: Commit fixes**

```bash
git add -A
git commit -m "security: fix data security and access control issues"
```

---

### Task 6: Infrastructure & Configuration Audit

**Files:**
- Read: `next.config.js` or `next.config.mjs`
- Read: `.env.example` or `.env.local.example`
- Check: CORS configuration, CSP headers

- [ ] **Step 1: Review Next.js configuration**

Check `next.config.js` for:
- Security headers (CSP, X-Frame-Options, etc.)
- Image domain allowlist
- API route CORS configuration
- Any `experimental` flags that could affect security

- [ ] **Step 2: Check for missing security headers**

If no security headers are configured, add them:

```javascript
// In next.config.js:
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
];

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  // ... rest of config
};
```

- [ ] **Step 3: Verify environment variable handling**

Check that `.env.example` (or equivalent) documents all required env vars without actual values. Verify that `.env`, `.env.local` are in `.gitignore`.

- [ ] **Step 4: Check for hardcoded secrets**

Run: `grep -rn "sk-\|pk_\|whsec_\|eyJ" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules`

Any matches are hardcoded secrets that need to be moved to environment variables.

- [ ] **Step 5: Commit fixes**

```bash
git add -A
git commit -m "security: add security headers and fix infrastructure issues"
```

---

### Task 7: Generate Vulnerability Report

**Files:**
- Create: `docs/security-audit-report.md`

- [ ] **Step 1: Compile all findings into a report**

Create `docs/security-audit-report.md`:

```markdown
# CXD Security Audit Report
**Date:** 2026-03-27
**Auditor:** Claude (automated review)
**Scope:** Full application — auth, API, client, data, infrastructure

## Summary
- **Critical:** [count]
- **High:** [count]
- **Medium:** [count]
- **Low:** [count]
- **Fixed:** [count]

## Findings

### [SEVERITY] [Title]
**Status:** Fixed / Open / Accepted Risk
**Location:** [file:line]
**Description:** [what the issue is]
**Impact:** [what could happen if exploited]
**Fix:** [what was done or recommended]

---

[Repeat for each finding]

## Recommendations
[Any remaining medium/low issues with recommended fixes]

## Dependencies
[npm audit results summary]
```

- [ ] **Step 2: Review the report for completeness**

Verify every audit area was covered:
- [ ] Dependency vulnerabilities
- [ ] Authentication on all API routes
- [ ] Authorization (ownership checks)
- [ ] Input validation
- [ ] XSS prevention
- [ ] Open redirects
- [ ] Secret handling
- [ ] Rate limiting
- [ ] Data leakage to AI providers
- [ ] Collaboration access control
- [ ] Error information disclosure
- [ ] Security headers
- [ ] CORS configuration

- [ ] **Step 3: Commit the report**

```bash
git add docs/security-audit-report.md
git commit -m "docs: add security audit report"
```
