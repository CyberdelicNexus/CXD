# CXD Security Audit Report

**Date:** 2026-03-27
**Scope:** Full application audit (Dependencies, Auth, Client-Side, Data, Infrastructure)
**Auditor:** Automated Security Audit via Claude Code

## Summary

- Critical: 2
- High: 4
- Medium: 5
- Low: 3
- Fixed: 6

## Dependency Vulnerabilities

`npm audit` was run and `npm audit fix` applied for safe updates. The following were resolved automatically by `npm audit fix`:
- `axios` (SSRF/DoS) - updated
- `brace-expansion` (ReDoS) - updated
- `dompurify` (XSS) - updated
- `form-data` (weak randomness) - updated
- `glob` (command injection) - updated
- `jspdf` (injection/DoS) - updated
- `lodash` (prototype pollution) - updated
- `mailparser` (XSS) - updated
- `markdown-it` (ReDoS) - updated
- `react-router` / `@remix-run/router` (XSS via open redirect) - updated

Remaining (require `--force`, out of stated dependency range):
- `next` (critical - 9 advisories including middleware auth bypass, SSRF, DoS)
- `esbuild` via `vite`/`tempo-devtools` (moderate - dev server request access)

---

## Findings

### [CRITICAL] XSS via dangerouslySetInnerHTML without sanitization

**Status:** Fixed
**Location:** `src/components/cxd/canvas/canvas-element.tsx:4081`, `src/components/cxd/canvas/document-viewer-modal.tsx:156`, `src/components/cxd/canvas/quick-view-modal.tsx:46`
**Description:** User-generated and AI-generated HTML content (note body from `marked.parse()` markdown-to-HTML conversion) was rendered via `dangerouslySetInnerHTML` without any sanitization. Malicious markdown input (e.g., from collaboration or crafted AI responses) could inject arbitrary scripts.
**Impact:** Full XSS - session hijacking, data theft, account takeover for any user viewing the malicious canvas element.
**Fix:** Added `DOMPurify.sanitize()` with `{ USE_PROFILES: { html: true }, ADD_ATTR: ['target'] }` to all three locations. DOMPurify was already installed as a dependency but was not imported or used anywhere in the codebase.

### [CRITICAL] Next.js framework vulnerabilities (9 advisories)

**Status:** Open - Requires manual upgrade
**Location:** `package.json` (next@15.x)
**Description:** The installed Next.js version has 9 known vulnerabilities including authorization bypass in middleware (GHSA-f82v-jwr5-mffw), SSRF via middleware redirects, HTTP request smuggling, cache poisoning, and multiple DoS vectors.
**Impact:** Middleware authentication bypass could allow unauthenticated access to protected routes. SSRF could allow server-side request forgery.
**Fix:** Upgrade Next.js to the latest patched version. This requires `npm audit fix --force` which is a major version change and should be tested thoroughly. Recommended: `npm install next@latest` followed by full regression testing.

### [HIGH] Open redirect in auth callback

**Status:** Fixed
**Location:** `src/app/auth/callback/route.ts:52-53`
**Description:** The `redirect_to` query parameter was used directly in `NextResponse.redirect()` without validation. An attacker could craft a URL like `/auth/callback?code=...&redirect_to=https://evil.com` to redirect users to a malicious site after authentication.
**Impact:** Phishing attacks - users could be redirected to credential-harvesting pages after legitimate authentication, believing they are still on the CXD platform.
**Fix:** Added validation to ensure `redirect_to` only accepts relative paths starting with `/`. Rejects absolute URLs, protocol-relative URLs (`//`), and non-path values.

### [HIGH] Unauthenticated link-meta endpoint (SSRF vector)

**Status:** Fixed
**Location:** `src/app/api/link-meta/route.ts`
**Description:** The `/api/link-meta` endpoint allowed unauthenticated requests to fetch arbitrary URLs from the server. While it had SSRF protections (private IP blocking, protocol validation), the lack of authentication meant anyone could use the server as an HTTP proxy without rate limiting per user.
**Impact:** Server-side request forgery, potential abuse as a proxy for scanning/attacking other services, DoS via resource exhaustion.
**Fix:** Added Supabase authentication check (createClient + getUser) that returns 401 for unauthenticated requests.

### [HIGH] Information disclosure in API error responses

**Status:** Fixed
**Location:** `src/app/api/ai/analyze/route.ts:180-184`, `src/app/api/canvas/invite/route.ts:58`
**Description:** The AI analyze endpoint returned partial internal error messages to clients (`Generation failed: ${message.substring(0, 150)}`). The canvas invite endpoint returned raw database error messages (`Database error: ${canvasError.message}`). These could leak internal implementation details, database schema information, or API provider error messages.
**Impact:** Information disclosure aiding further attacks - internal paths, database table names, API key validation errors.
**Fix:** Replaced with generic error messages that do not leak internal details. Server-side `console.error` logging is preserved for debugging.

### [HIGH] Missing security headers

**Status:** Fixed
**Location:** `next.config.js`
**Description:** No security headers were configured. Missing X-Frame-Options (clickjacking), X-Content-Type-Options (MIME sniffing), Referrer-Policy (URL leakage), and Permissions-Policy.
**Impact:** Clickjacking attacks, MIME-type confusion attacks, referrer information leakage.
**Fix:** Added headers configuration to `next.config.js`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-DNS-Prefetch-Control: on`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

### [MEDIUM] Unvalidated redirect in signInAction

**Status:** Open
**Location:** `src/app/actions.ts:82`
**Description:** The `signInAction` server action uses `redirect(redirectTo || "/dashboard")` where `redirectTo` comes from form data. While this is a server action (not directly URL-accessible), a malicious form submission could potentially redirect to an external URL.
**Impact:** Similar to the auth callback open redirect but lower risk since it requires POST form submission.
**Fix Recommended:** Apply the same relative-path validation used in the auth callback fix.

### [MEDIUM] ERD generator markdown-to-HTML without sanitization

**Status:** Open
**Location:** `src/components/cxd/canvas/erd-generator.tsx:204-208, 239-243`
**Description:** The ERD generator converts markdown to HTML using `marked.parse()` and stores the result as `noteBody` which is then rendered via `dangerouslySetInnerHTML` in the canvas element. The content originates from AI-generated text, which has lower risk than user input, but should still be sanitized.
**Impact:** Potential XSS if AI response contains malicious content (prompt injection via project data).
**Fix Recommended:** Add DOMPurify sanitization in the ERD generator before storing as noteBody, consistent with the canvas-element fix.

### [MEDIUM] Note creation service markdown-to-HTML without sanitization

**Status:** Open
**Location:** `src/lib/ai/note-creation-service.ts:55-59`
**Description:** Similar to ERD generator - `marked.parse()` output stored directly as `noteBody`. Runs server-side where DOMPurify requires `jsdom` or `isomorphic-dompurify`. The content is sanitized at render time by the canvas-element fix, so the immediate XSS risk is mitigated.
**Impact:** Defense-in-depth gap - relies on client-side sanitization only.
**Fix Recommended:** Install `isomorphic-dompurify` and sanitize at creation time as well, or ensure all rendering paths use DOMPurify.

### [MEDIUM] SSRF protection incomplete for DNS rebinding

**Status:** Open
**Location:** `src/app/api/link-meta/route.ts:10-37`
**Description:** The `isPrivateIP` function checks hostname strings but does not resolve DNS before checking. An attacker could use DNS rebinding (e.g., a domain that resolves to 127.0.0.1) to bypass the private IP check and make the server fetch internal resources.
**Impact:** Potential access to internal services/metadata endpoints (e.g., cloud provider metadata at 169.254.169.254).
**Fix Recommended:** Resolve the hostname to an IP address using `dns.resolve()` before checking against private ranges, or use a library like `ssrf-req-filter`.

### [MEDIUM] Middleware excludes API routes from session refresh

**Status:** Open
**Location:** `middleware.ts:19`
**Description:** The middleware matcher explicitly excludes `api` routes (`"/((?!_next/static|_next/image|favicon.ico|api|...)"`) which means Supabase session cookies are not refreshed on API calls. Each API route handles its own auth, which is correct, but expired sessions may not be caught until the API route checks.
**Impact:** Low - each API route independently validates auth. This is an architectural observation, not a vulnerability.
**Fix Recommended:** No action needed. Document this pattern.

### [LOW] In-memory cache in link-meta without per-user scoping

**Status:** Open
**Location:** `src/app/api/link-meta/route.ts:6-7`
**Description:** The metadata cache is shared across all users. While the data (OG metadata from public URLs) is not sensitive, one user's cached results could be served to another user.
**Impact:** Minimal - the cached data is public metadata from public URLs.
**Fix Recommended:** Acceptable risk. Cache is appropriate for public metadata.

### [LOW] Console.log statements with potentially sensitive data

**Status:** Open
**Location:** Multiple API routes (e.g., `src/app/api/ai/chat/route.ts:67,103,149`)
**Description:** Several `console.log` statements output information like model selections, BYOK status, and knowledge retrieval details. In production, these could appear in server logs.
**Impact:** Information disclosure via server logs if logs are not properly secured.
**Fix Recommended:** Use a structured logging library with log levels. Set production to `warn`/`error` only.

### [LOW] DOMPurify version has known XSS bypass (CVE in 3.1.3-3.3.1)

**Status:** Open (dependency updated by npm audit fix)
**Location:** `node_modules/dompurify`
**Description:** The installed DOMPurify 3.3.3 was updated by npm audit fix. Verify the version is >= 3.3.2 to include the fix for GHSA-v2wj-7wpq-c8vv.
**Impact:** Potential XSS bypass in older versions.
**Fix Recommended:** Verify version after npm audit fix. Currently resolved.

---

## Authentication & Authorization Summary

All API routes were reviewed. Every route creates a Supabase server client, calls `supabase.auth.getUser()`, and returns 401 if the user is not authenticated:

| Route | Auth | Notes |
|-------|------|-------|
| `/api/ai/chat` | Yes | |
| `/api/ai/analyze` | Yes | |
| `/api/ai/byok` (GET/POST/DELETE/PATCH) | Yes | Also checks BYOK capability |
| `/api/ai/credits` (GET/PUT) | Yes | |
| `/api/ai/credits/ledger` (GET/POST) | Yes | |
| `/api/ai/threads` (GET/PATCH/PUT/DELETE) | Yes | |
| `/api/canvas/collaborators` (GET/DELETE) | Yes | Also checks canvas ownership/membership |
| `/api/canvas/invite` (POST/GET/DELETE) | Yes | Also checks canvas ownership |
| `/api/canvas/invite/accept` (GET/POST) | Yes | Validates invite token and email match |
| `/api/link-meta` | Yes (Fixed) | Was unauthenticated before this audit |
| `/api/profile` (GET/PUT) | Yes | |
| `/api/projects` (GET) | Yes | |
| `/api/support` (POST) | Yes | |
| `/api/stripe/create-billing-portal` | Yes | |
| `/api/stripe/create-checkout` | Yes | |
| `/api/stripe/create-checkout-session` | Yes | |
| `/api/stripe/create-credit-checkout` | Yes | |
| `/api/stripe/create-portal` | Yes | |
| `/api/webhooks/stripe` | Webhook signature | Correctly validates Stripe webhook signature |

## Data Security Summary

- **AI System Prompts:** Sent to AI providers (Gemini, Claude, Kimi) as part of normal operation. System prompts contain project context but no user credentials.
- **Knowledge Retrieval:** Semantic search results are appended to system prompts. Results are scoped to the knowledge base, not to user-private data.
- **BYOK Keys:** Encrypted with AES-256-GCM + PBKDF2 key derivation. Good implementation using random IV, salt, and auth tags.
- **Error Responses:** Fixed - no longer leak internal details to clients.
- **Collaboration Access Control:** Canvas collaborators are checked via ownership or collaborator table lookups. Invitations require email match.

## Infrastructure Summary

- **Security Headers:** Fixed - now configured in next.config.js.
- **`.env` in `.gitignore`:** Yes - both `.env` and `.env*.local` are gitignored.
- **No hardcoded secrets found** in source code. All secrets accessed via `process.env`.
- **ENCRYPTION_KEY:** Used for BYOK key encryption. Properly loaded from environment.

## Files Changed

| File | Change |
|------|--------|
| `src/components/cxd/canvas/canvas-element.tsx` | Added DOMPurify import and sanitization for renderedNoteBody |
| `src/components/cxd/canvas/document-viewer-modal.tsx` | Added DOMPurify import and sanitization for noteBody |
| `src/components/cxd/canvas/quick-view-modal.tsx` | Added DOMPurify import and sanitization for noteBody |
| `src/app/auth/callback/route.ts` | Added open redirect validation for redirect_to parameter |
| `src/app/api/link-meta/route.ts` | Added authentication check (createClient + getUser) |
| `src/app/api/ai/analyze/route.ts` | Replaced error message with generic text |
| `src/app/api/canvas/invite/route.ts` | Replaced database error message with generic text |
| `next.config.js` | Added security headers configuration |
| `package-lock.json` | Updated by npm audit fix |
