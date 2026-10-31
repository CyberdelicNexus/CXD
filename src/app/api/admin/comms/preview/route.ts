import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { requirePermission } from '@/lib/admin/gate';
import { parseBody } from '@/lib/admin/http';
import { contentSchema } from '@/lib/admin/comms';
import { emailConfigProblem, resolveRecipients } from '@/lib/admin/broadcast';

export async function POST(request: Request) {
  const gate = await requirePermission('comms.send');
  if (!gate.ok) return gate.response;
  const body = await parseBody(request, contentSchema);
  if (!body.ok) return body.response;

  let recipients;
  try {
    recipients = await resolveRecipients(body.data.audience, body.data.category);
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'admin-comms-preview', step: 'recipients' } });
    return NextResponse.json({ error: 'The recipients could not be loaded. Try again.' }, { status: 500 });
  }

  const wantsEmail = body.data.channels.includes('email');
  return NextResponse.json({
    inAppCount: body.data.channels.includes('in_app') ? recipients.inApp.length : 0,
    emailCount: wantsEmail ? recipients.email.length : 0,
    problem: wantsEmail ? emailConfigProblem(body.data.category) : null,
  });
}
