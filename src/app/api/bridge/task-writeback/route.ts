/**
 * POST /api/bridge/task-writeback
 *
 * CXD-side write-back endpoint for the LifeOS Compass v3 bridge (Phase B,
 * "single-field" write-back — status/dueDate only). Binding spec:
 * docs/reviews/PS2_CANVAS_BRIDGE.md ("Q3 — Write-back endpoint" / "Blocks
 * Phase B flag-on") and docs/contracts/C2_CANVAS_BRIDGE.md §1 Direction 2 / §4
 * (in the LifeOS repo). This is one of the 5 files C2 §5 authorizes this
 * workstream to touch in the CXD repo — everything else here is additive and
 * inert while BRIDGE_ENABLED is unset.
 *
 * Step order is mandatory (PS2 B2) and must not be reordered:
 *   a. kill switch          → 404
 *   b. token (timing-safe)  → 401
 *   c. body size cap        → 413 (before JSON.parse)
 *   d. parse + validate     → 422
 *   e. idempotency replay   → return stored result, no reapply
 *   f. rate limit           → 429
 *   g. project allowlist    → 403 (BEFORE any DB read of the project row)
 *   h. owner assertion      → 403 (id/owner_id read only — yjs_state not
 *                              touched until this passes)
 *   i-k. load/apply/wipe-guard/persist/broadcast (apply-task-writeback.ts)
 *   l. audit log — only for 'applied' | 'rejected' | 'error' outcomes;
 *      everything rejected above (401/404/413/422/403/429) is NOT logged,
 *      per PS2 B4's scope for this table.
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/supabase/admin';
import { verifyBridgeToken } from '@/lib/bridge/bridge-auth';
import { validateWritebackBody } from '@/lib/bridge/bridge-validate';
import { checkBridgeRateLimit } from '@/lib/bridge/bridge-rate-limit';
import { applyTaskWriteback } from '@/lib/bridge/apply-task-writeback';

// Node.js runtime (default for this app's route handlers — see e.g.
// src/app/api/webhooks/stripe/route.ts, src/app/api/cron/spend-monitor/route.ts,
// none of which set `runtime = 'edge'`). We need Node's `crypto.timingSafeEqual`
// and the service-role Supabase admin client, so this must NOT run on Edge.
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 2048; // ~2KB cap (PS2 B6)

/**
 * Read the request body while enforcing MAX_BODY_BYTES as a true streaming
 * cap — aborts the read (rather than buffering an arbitrarily large body
 * and rejecting only after the fact) once the cap is exceeded.
 */
async function readBodyCapped(req: Request, maxBytes: number): Promise<{ text: string } | { tooLarge: true }> {
  const reader = req.body?.getReader();
  if (!reader) {
    // No streaming body reader available (shouldn't happen for a POST with a
    // body under Node's fetch Request, but fall back safely if it does).
    const text = await req.text();
    return Buffer.byteLength(text, 'utf8') > maxBytes ? { tooLarge: true } : { text };
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        reader.cancel().catch(() => {});
        return { tooLarge: true };
      }
      chunks.push(Buffer.from(value));
    }
  }
  return { text: Buffer.concat(chunks).toString('utf8') };
}

export async function POST(req: Request): Promise<NextResponse> {
  // ── (a) Kill switch (PS2 B7) ──
  // Checked first, before any other work. This route runs on Vercel's Node.js
  // runtime as part of the standard Next.js build output: `process.env.*`
  // values are inlined/read from the deployed function's environment at
  // COLD START, not from a live-reloading config store. Flipping
  // BRIDGE_ENABLED in the Vercel dashboard alone does not affect already-warm
  // serverless instances — a REDEPLOY (or at minimum waiting for all warm
  // instances to recycle, which Vercel does not guarantee on any fixed
  // schedule) is required for the new value to take effect everywhere.
  // Document the kill-switch runbook honestly as "flip the env var AND
  // trigger a redeploy" — not a true sub-second per-request read. This has
  // NOT been rehearsed against a live deployment as part of this build; PS2
  // B7 requires that rehearsal before Phase B flag-on.
  if (process.env.BRIDGE_ENABLED !== 'true') {
    return new NextResponse(null, { status: 404 });
  }

  // ── (b) Token — timing-safe, before touching the body ──
  const tokenHeader = req.headers.get('x-bridge-token');
  const tokenCheck = verifyBridgeToken(tokenHeader);
  if (!tokenCheck.ok) {
    // Never log tokenHeader or the reason at anything above debug — avoid
    // leaking which failure mode occurred (missing vs invalid vs
    // misconfigured) to anyone tailing logs.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── (c) Body size cap — before JSON.parse ──
  const bodyResult = await readBodyCapped(req, MAX_BODY_BYTES);
  if ('tooLarge' in bodyResult) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  // ── (d) Parse + validate ──
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(bodyResult.text);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 422 });
  }

  const validation = validateWritebackBody(parsedBody);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 422 });
  }
  const { idempotencyKey, projectId, elementId, taskKey, patch } = validation.value;

  const admin = getSupabaseAdmin();

  // ── (e) Idempotency (PS2 B5) — replay returns the stored result, no reapply ──
  const { data: existingOp, error: idempotencyLookupError } = await admin
    .from('bridge_ops_log')
    .select('result, applied_at')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (idempotencyLookupError) {
    // Fail closed on an audit-log read error rather than risk a double-apply.
    console.error('[bridge/task-writeback] idempotency lookup failed:', idempotencyLookupError.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  if (existingOp) {
    return NextResponse.json({
      ok: existingOp.result === 'applied',
      replay: true,
      result: existingOp.result,
      appliedAt: existingOp.applied_at,
    });
  }

  // ── (f) Rate limit (PS2 B6) ──
  const rateLimit = await checkBridgeRateLimit(tokenHeader as string);
  if (!rateLimit.allowed) {
    const init: ResponseInit = { status: 429 };
    if (rateLimit.retryAfterMs !== undefined) {
      init.headers = { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) };
    }
    return NextResponse.json({ error: 'Rate limited' }, init);
  }

  // ── (g) Project allowlist (PS2 B2/A3) — BEFORE any DB read of the project row ──
  const allowlist = (process.env.BRIDGE_PROJECT_ALLOWLIST ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!allowlist.includes(projectId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── (h) Owner assertion — id/owner_id columns only, NOT yjs_state ──
  const bridgeOwnerUid = process.env.BRIDGE_OWNER_UID;
  const { data: projectRow, error: ownerLookupError } = await admin
    .from('cxd_projects')
    .select('id, owner_id')
    .eq('id', projectId)
    .maybeSingle();

  if (ownerLookupError) {
    console.error('[bridge/task-writeback] owner lookup failed:', ownerLookupError.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
  if (!bridgeOwnerUid || !projectRow || projectRow.owner_id !== bridgeOwnerUid) {
    // Deliberately identical response whether the project doesn't exist or
    // simply isn't Jema's — don't leak which.
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── (i)-(k) Load yjs_state, apply, wipe-guard, persist, broadcast ──
  const result = await applyTaskWriteback({ projectId, elementId, taskKey, patch });

  // ── (l) Audit log ──
  // Only 'applied' | 'rejected' | 'error' reach here — every rejection above
  // this point in the route (401/404/413/422/403/429) already returned
  // without falling through to this insert, per PS2's scope for this table.
  // `not_found` (element/project missing post-owner-assertion) is logged as
  // 'error' — the column only allows applied/rejected/error, and a missing
  // element after passing every prior gate is itself an operational anomaly
  // worth an audit row.
  const loggedResult: 'applied' | 'rejected' | 'error' = result.outcome === 'not_found' ? 'error' : result.outcome;
  const { error: logError } = await admin.from('bridge_ops_log').insert({
    idempotency_key: idempotencyKey,
    project_id: projectId,
    element_id: elementId,
    task_key: taskKey,
    patch,
    result: loggedResult,
    applied_at: new Date().toISOString(),
  });
  if (logError) {
    // The apply already happened (or didn't) — don't let a logging failure
    // change the response, but surface it loudly since B4 requires this
    // audit trail to be populated.
    console.error('[bridge/task-writeback] FAILED TO WRITE AUDIT LOG:', logError.message, { idempotencyKey, projectId, elementId });
  }

  if (result.outcome === 'applied') {
    return NextResponse.json({ ok: true, newElementUpdatedAt: result.newUpdatedAt });
  }
  if (result.outcome === 'not_found') {
    return NextResponse.json({ error: result.reason }, { status: 404 });
  }
  if (result.outcome === 'rejected') {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }
  console.error('[bridge/task-writeback] apply error:', result.reason);
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}
