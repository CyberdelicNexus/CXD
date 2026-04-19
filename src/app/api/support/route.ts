import { NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/render';
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
    const reporterEmail = userProfile?.email || user.email || 'unknown@example.com';

    // Determine type based on title
    const type: 'bug' | 'support' = title === 'Bug Report' ? 'bug' : 'support';
    const subjectPrefix = type === 'bug' ? 'Bug Report' : 'Support Request';

    // Render notification email to admin
    const adminEmailHtml = await render(
      BugReportNotification({
        reporterName,
        reporterEmail,
        reporterPlan: plan.name,
        bugTitle: title,
        bugDescription: description,
        stepsToReproduce,
        expectedBehavior,
        actualBehavior,
        browserInfo,
        timestamp: new Date().toISOString(),
        type,
      })
    );

    // Render confirmation email to user
    const confirmationEmailHtml = await render(
      SupportConfirmation({
        userName: reporterName,
        type,
        title,
        description,
      })
    );

    // Send to admin
    let adminEmailSent = false;
    try {
      await Promise.race([
        sendEmail({
          to: 'contact@cyberdelic.design',
          subject: `${subjectPrefix}: ${title}`,
          html: adminEmailHtml,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Email timeout')), 5000)),
      ]);
      adminEmailSent = true;
    } catch (emailErr) {
      console.error('Failed to send admin notification email:', emailErr);
    }

    if (!adminEmailSent) {
      return NextResponse.json({ error: 'Failed to submit support request. Please try again.' }, { status: 500 });
    }

    // Send confirmation to user - best effort
    try {
      await Promise.race([
        sendEmail({
          to: reporterEmail,
          subject: `We received your ${subjectPrefix.toLowerCase()}`,
          html: confirmationEmailHtml,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Email timeout')), 5000)),
      ]);
    } catch (emailErr) {
      console.error('Failed to send user confirmation email:', emailErr);
      // Don't fail the request for user confirmation
    }

    return NextResponse.json({ success: true, message: `${subjectPrefix} submitted successfully` });
  } catch (error) {
    console.error('Bug report submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit bug report' },
      { status: 500 }
    );
  }
}
