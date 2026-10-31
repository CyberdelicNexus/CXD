import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/supabase/server';
import { getSupabaseAdmin } from '@/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limiter';
import { composeTicketBody, resolveTicketType, ticketTitle } from '@/lib/admin/tickets';
import { enqueueEmail } from '@/lib/email-queue';
import { getPlan } from '@/lib/plans';
import BugReportNotification from '@emails/bug-report-notification';
import SupportConfirmation from '@emails/support-confirmation';

export async function POST(request: Request) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const {
      type: requestedType,
      sourcePath,
      title,
      description,
      stepsToReproduce,
      expectedBehavior,
      actualBehavior,
      browserInfo,
    } = body;

    // Validate required fields
    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      );
    }

    // Validate input lengths
    if (typeof title !== 'string' || title.length > 500) {
      return NextResponse.json({ error: 'Title must be under 500 characters' }, { status: 400 });
    }
    if (typeof description !== 'string' || description.length > 10000) {
      return NextResponse.json({ error: 'Description must be under 10,000 characters' }, { status: 400 });
    }

    // Rate-limit after validation, so a malformed request does not use up the allowance.
    const limit = checkRateLimit(user.id, 'support');
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    // Steps are optional free text: keep a string (capped) or nothing, once, for the ticket and the email.
    const steps: string | undefined =
      typeof stepsToReproduce === 'string' && stepsToReproduce.trim() ? stepsToReproduce.slice(0, 10000) : undefined;

    // Get user profile info
    const { data: userProfile } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    // Get user's subscription plan
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', user.id)
      .single();

    const plan = getPlan(subscription?.plan_id || 'free');
    const reporterName = userProfile?.full_name || user.email?.split('@')[0] || 'Unknown';
    // The auth-verified address comes first; the profile row is only a fallback.
    const reporterEmail = user.email || userProfile?.email || 'unknown@example.com';

    const ticketType = resolveTicketType(requestedType, title);
    // The email templates know two types; a feature request reads as support.
    const type: 'bug' | 'support' = ticketType === 'bug' ? 'bug' : 'support';
    const subjectPrefix =
      ticketType === 'bug' ? 'Bug Report' : ticketType === 'feature' ? 'Feature Request' : 'Support Request';

    // Stored first, but a failed insert must not lose the request: the emails
    // below still go out, and Sentry records the failure.
    try {
      const { error: ticketError } = await getSupabaseAdmin().from('support_tickets').insert({
        user_id: user.id,
        email: reporterEmail,
        type: ticketType,
        title: ticketTitle(title, description),
        description: composeTicketBody(description, steps),
        source_path: typeof sourcePath === 'string' ? sourcePath.slice(0, 500) : null,
      });
      if (ticketError) throw new Error(`${ticketError.code ?? 'error'}: ${ticketError.message}`);
    } catch (ticketErr) {
      // Code and message only: a constraint error's details can echo the row, which holds the user's text.
      const reason = ticketErr instanceof Error ? ticketErr.message : 'unknown';
      console.error('Failed to store support ticket:', reason);
      Sentry.captureException(new Error(`support ticket insert failed: ${reason}`), {
        tags: { route: 'support', phase: 'store-ticket' },
      });
    }

    // Log every user report to Sentry so it can be correlated with crash
    // events (same user, same timeframe) instead of living only in email.
    let sentryEventId: string | undefined;
    try {
      sentryEventId = Sentry.captureMessage(`${subjectPrefix}: ${title}`, {
        level: type === 'bug' ? 'warning' : 'info',
        tags: { source: 'user-report', reportType: ticketType, plan: plan.name },
        user: { id: user.id, email: reporterEmail },
        extra: {
          description,
          stepsToReproduce: steps,
          expectedBehavior,
          actualBehavior,
          browserInfo,
        },
      });
    } catch {
      // Sentry unavailability must never block a user report
    }

    // Queue admin notification + user confirmation through Inngest. Both are
    // delivered durably with retries. The request returns ~50ms instead of
    // holding for two Resend roundtrips.
    try {
      await Promise.all([
        enqueueEmail({
          to: 'contact@cyberdelic.design',
          subject: `${subjectPrefix}: ${title}`,
          template: BugReportNotification({
            reporterName,
            reporterEmail,
            reporterPlan: plan.name,
            bugTitle: title,
            bugDescription: description,
            stepsToReproduce: steps,
            expectedBehavior,
            actualBehavior,
            browserInfo,
            timestamp: new Date().toISOString(),
            type,
            sentryEventId,
          }),
        }),
        enqueueEmail({
          to: reporterEmail,
          subject: `We received your ${subjectPrefix.toLowerCase()}`,
          template: SupportConfirmation({
            userName: reporterName,
            type: ticketType,
            title,
            description,
          }),
        }),
      ]);
    } catch (emailErr) {
      console.error('Failed to enqueue support emails:', emailErr);
      Sentry.captureException(emailErr, { tags: { route: 'support', phase: 'enqueue-email' } });
      return NextResponse.json({ error: 'Failed to submit support request. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `${subjectPrefix} submitted successfully` });
  } catch (error) {
    console.error('Bug report submission error:', error);
    Sentry.captureException(error, { tags: { route: 'support' } });
    return NextResponse.json(
      { error: 'Failed to submit bug report' },
      { status: 500 }
    );
  }
}
