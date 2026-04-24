import { NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { sendEmail } from '@/lib/email';

// New automated templates (the ones added in the email-automation Phase 1 batch)
import TrialDay1 from '../../../../../emails/trial-day-1';
import TrialEndingSoon from '../../../../../emails/trial-ending-soon';
import TrialConverted from '../../../../../emails/trial-converted';
import PaymentFailed from '../../../../../emails/payment-failed';
import PaymentFinalWarning from '../../../../../emails/payment-final-warning';

// Existing lifecycle templates — helpful to supervise alongside the new ones
import SubscriptionConfirmed from '../../../../../emails/subscription-confirmed';
import SubscriptionCancelled from '../../../../../emails/subscription-cancelled';
import CreditPurchaseReceipt from '../../../../../emails/credit-purchase-receipt';

export const dynamic = 'force-dynamic';

/**
 * Dev/admin helper: renders every pro-lifecycle email with realistic mock
 * props and sends one copy of each to the address in ?to= (default:
 * connect@cyberdelic.nexus). Protected by CRON_SECRET so anonymous traffic
 * can't spam real addresses.
 *
 * Usage:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://canvas.cyberdelic.design/api/test/preview-emails?to=your@email"
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured on server' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const to = url.searchParams.get('to') ?? 'connect@cyberdelic.nexus';

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvas.cyberdelic.design';
  const userName = 'Design Lead';
  const dashboardUrl = `${baseUrl}/dashboard`;
  const manageBillingUrl = `${baseUrl}/dashboard/profile`;

  // Each entry: [subject prefix, render input, subject]
  const plan: Array<{ key: string; subject: string; template: React.ReactElement }> = [
    {
      key: 'trial-day-1',
      subject: '[PREVIEW · trial-day-1] Your Pro trial is live — let\'s get started',
      template: TrialDay1({
        userName,
        trialEndDate: 'May 8, 2026',
        dashboardUrl,
      }),
    },
    {
      key: 'trial-ending-soon',
      subject: '[PREVIEW · trial-ending-soon] Your CXD Canvas Pro trial ends on May 8, 2026',
      template: TrialEndingSoon({
        userName,
        trialEndDate: 'May 8, 2026',
        cardBrand: 'Visa',
        cardLast4: '4242',
        manageBillingUrl,
      }),
    },
    {
      key: 'trial-converted',
      subject: '[PREVIEW · trial-converted] Welcome to CXD Canvas Pro',
      template: TrialConverted({
        userName,
        amountCharged: '$20.00',
        nextBillingDate: 'June 8, 2026',
        dashboardUrl,
        receiptUrl: 'https://stripe.com/receipts/example',
      }),
    },
    {
      key: 'payment-failed',
      subject: '[PREVIEW · payment-failed] We could not charge your card',
      template: PaymentFailed({
        userName,
        amountDue: '$20.00',
        cardBrand: 'Visa',
        cardLast4: '4242',
        nextRetryDate: 'April 27, 2026',
        updatePaymentUrl: manageBillingUrl,
      }),
    },
    {
      key: 'payment-final-warning',
      subject: '[PREVIEW · payment-final-warning] Last chance to restore your Pro access',
      template: PaymentFinalWarning({
        userName,
        amountDue: '$20.00',
        accessEndsDate: 'April 30, 2026',
        updatePaymentUrl: manageBillingUrl,
      }),
    },
    // Existing lifecycle templates (included so you can supervise the full set)
    {
      key: 'subscription-confirmed-pro',
      subject: '[PREVIEW · subscription-confirmed · Pro] Your CXD Canvas Pro plan is confirmed!',
      template: SubscriptionConfirmed({
        userName,
        planName: 'Pro',
        planPrice: '$20/month',
        isLifetime: false,
        trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        dashboardUrl,
      }),
    },
    {
      key: 'subscription-confirmed-lifetime',
      subject: '[PREVIEW · subscription-confirmed · Lifetime] Welcome, Founding Member #42!',
      template: SubscriptionConfirmed({
        userName,
        planName: 'Lifetime',
        planPrice: '$199',
        isLifetime: true,
        foundingMemberNumber: 42,
        dashboardUrl,
      }),
    },
    {
      key: 'subscription-cancelled',
      subject: '[PREVIEW · subscription-cancelled] Your CXD Canvas subscription has been cancelled',
      template: SubscriptionCancelled({
        userName,
        planName: 'Pro',
        accessEndDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
        feedbackUrl: `${baseUrl}/feedback`,
        resubscribeUrl: `${baseUrl}/pricing`,
      }),
    },
    {
      key: 'credit-purchase-receipt',
      subject: '[PREVIEW · credit-purchase-receipt] Credits added to your CXD account',
      template: CreditPurchaseReceipt({
        userName,
        packName: 'Popular',
        creditsAmount: 250,
        priceFormatted: '$10.00',
        newBalance: 350,
        purchaseDate: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        dashboardUrl: `${baseUrl}/cxd`,
      }),
    },
  ];

  const results: Array<{ key: string; ok: boolean; error?: string }> = [];

  for (const entry of plan) {
    try {
      const html = await render(entry.template);
      await sendEmail({ to, subject: entry.subject, html });
      results.push({ key: entry.key, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[preview-emails] Failed to send ${entry.key}:`, err);
      results.push({ key: entry.key, ok: false, error: message });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: true,
    to,
    total: plan.length,
    sent: okCount,
    failed: plan.length - okCount,
    results,
  });
}
