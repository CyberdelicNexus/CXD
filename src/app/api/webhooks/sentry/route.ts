// Sentry webhook → self-correcting loop entrypoint.
//
// Configure in Sentry as an Internal Integration webhook (or an Issue Alert with a
// webhook action) pointing at POST /api/webhooks/sentry. The integration's client
// secret goes in SENTRY_WEBHOOK_SECRET; Sentry signs each delivery with it via the
// `sentry-hook-signature` header (HMAC-SHA256 of the raw body, hex).
//
// This route does the minimum synchronously: verify signature, extract the issue
// id, hand off to Inngest. All the slow work (Sentry fetch, AI triage, Telegram)
// happens durably in the triage function.

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { inngest } from '@/inngest/client';

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.SENTRY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  // Constant-time compare; guard against length mismatch (timingSafeEqual throws).
  const a = Buffer.from(digest);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Pull an issue id + permalink out of the various Sentry webhook payload shapes. */
function extractIssue(body: Record<string, unknown>): { issueId?: string; permalink?: string; projectSlug?: string } {
  const data = (body.data ?? {}) as Record<string, unknown>;
  const issue = data.issue as Record<string, unknown> | undefined;
  const eventObj = data.event as Record<string, unknown> | undefined;

  const issueId =
    (issue?.id as string | undefined) ??
    (eventObj?.issue_id as string | undefined) ??
    (eventObj?.groupID as string | undefined);

  const permalink =
    (issue?.permalink as string | undefined) ??
    (eventObj?.web_url as string | undefined);

  const projectSlug =
    (issue?.project as { slug?: string } | undefined)?.slug ??
    (eventObj?.project as string | undefined);

  return { issueId: issueId ? String(issueId) : undefined, permalink, projectSlug };
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const headersList = await headers();
  const signature =
    headersList.get('sentry-hook-signature') ?? headersList.get('sentry-hook-signature-256');

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // We only care about issue-bearing events (issue created/alert). Ignore the rest
  // (installation pings, metric alerts, etc.) with a 200 so Sentry doesn't retry.
  const { issueId, permalink, projectSlug } = extractIssue(body);
  if (!issueId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  await inngest.send({
    name: 'sentry/issue.flagged',
    data: { issueId, permalink, projectSlug },
  });

  return NextResponse.json({ ok: true, issueId });
}
