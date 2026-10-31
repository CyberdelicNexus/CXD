import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/supabase/admin';
import { verifyUnsubscribeToken } from '@/lib/email-unsubscribe';

// A link opened in a browser or by a mail scanner changes nothing: it only forwards to the
// confirmation page, where a person presses the button.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://canvas.cyberdelic.design').replace(/\/+$/, '');
  return NextResponse.redirect(`${base}/unsubscribe?token=${encodeURIComponent(token)}`, 303);
}

// Handles both the page's button and a mailbox's one-click List-Unsubscribe-Post,
// so it reads the token from the query and ignores the body.
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const userId = verifyUnsubscribeToken(token, process.env.EMAIL_UNSUBSCRIBE_SECRET ?? '');
  if (!userId) return NextResponse.json({ error: 'Invalid link' }, { status: 400 });

  const { error } = await getSupabaseAdmin().from('email_preferences').upsert({
    user_id: userId,
    marketing_opt_out: true,
    opted_out_at: new Date().toISOString(),
  });
  if (error) {
    // Error code and text only, never the token.
    Sentry.captureException(new Error(`unsubscribe failed: ${error.code ?? 'error'}: ${error.message}`), {
      tags: { route: 'email-unsubscribe' },
    });
    return NextResponse.json({ error: 'Could not unsubscribe' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
