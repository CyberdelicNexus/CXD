import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { requirePermission } from '@/lib/admin/gate';
import { parseBody } from '@/lib/admin/http';
import { contentSchema, signContent } from '@/lib/admin/comms';
import { emailConfigProblem, testSecret, unsubscribeLinks } from '@/lib/admin/broadcast';
import { enqueueEmail } from '@/lib/email-queue';
import Broadcast from '@emails/broadcast';

export async function POST(request: Request) {
  const gate = await requirePermission('comms.send');
  if (!gate.ok) return gate.response;
  const body = await parseBody(request, contentSchema);
  if (!body.ok) return body.response;
  const { subject, category } = body.data;
  const text = body.data.body;

  if (!gate.staff.email) {
    return NextResponse.json({ error: 'Your account has no email address to send the test to.' }, { status: 409 });
  }

  // No secret means no proof can be signed, so no token is issued and nothing is sent.
  const secret = testSecret();
  const problem = emailConfigProblem(category);
  if (problem || !secret) {
    return NextResponse.json({ error: problem ?? 'Email needs EMAIL_UNSUBSCRIBE_SECRET (or CRON_SECRET) to be set.' }, { status: 409 });
  }

  // The same headers and links a real product update carries, so the test shows what recipients get.
  const links = category === 'product' ? unsubscribeLinks(gate.staff.userId) : null;
  try {
    await enqueueEmail({
      to: gate.staff.email,
      subject: `[Test] ${subject}`,
      headers: links
        ? {
            'List-Unsubscribe': `<${links.oneClickUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          }
        : undefined,
      template: Broadcast({
        userName: 'there',
        subject,
        body: text,
        unsubscribeUrl: links?.pageUrl,
        postalAddress: category === 'product' ? process.env.EMAIL_POSTAL_ADDRESS : undefined,
      }),
    });
  } catch (err) {
    // Never the message body or a token.
    Sentry.captureException(err, { tags: { route: 'admin-comms-test' } });
    return NextResponse.json({ error: 'The test email could not be sent. Try again.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    testToken: signContent({ subject, body: text, category }, gate.staff.userId, secret),
  });
}
