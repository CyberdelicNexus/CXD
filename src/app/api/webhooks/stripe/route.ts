import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/supabase/server';
import { getSupabaseAdmin } from '@/supabase/admin';
import { enqueueEmail } from '@/lib/email-queue';
import { getCreditPack } from '@/lib/credit-packs';
import SubscriptionConfirmed from '../../../../../emails/subscription-confirmed';
import SubscriptionCancelled from '../../../../../emails/subscription-cancelled';
import CreditPurchaseReceipt from '../../../../../emails/credit-purchase-receipt';
import TrialEndingSoon from '../../../../../emails/trial-ending-soon';
import TrialConverted from '../../../../../emails/trial-converted';
import PaymentFailed from '../../../../../emails/payment-failed';
import { EMAIL_KINDS } from '@/lib/email-kinds';

// Helper to get user email and name
async function getUserInfo(userId: string): Promise<{ email: string; name: string | null } | null> {
  const admin = getSupabaseAdmin();
  const { data: user } = await admin
    .from('users')
    .select('email, full_name')
    .eq('id', userId)
    .single();

  if (!user) return null;

  return {
    email: user.email,
    name: user.full_name,
  };
}

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) {
    console.error('Missing Stripe environment variables');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  const stripe = new Stripe(stripeKey, { apiVersion: '2025-01-27.acacia', timeout: 10000 });

  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Event-level idempotency. Stripe retries on any 5xx (up to 72h, exponential
  // backoff). Without this, retries cause duplicate subscription updates and
  // double credit grants. We insert event.id; if the unique constraint fires,
  // we've already processed this event — return 200 and bail.
  {
    const admin = getSupabaseAdmin();
    const { error: dedupeError } = await admin
      .from('stripe_events_processed')
      .insert({ event_id: event.id, event_type: event.type });

    if (dedupeError) {
      // Unique-violation → already processed, ack and exit.
      if (dedupeError.code === '23505') {
        console.log(`[Stripe Webhook] Duplicate event ${event.id} (${event.type}) — skipping.`);
        return NextResponse.json({ received: true, duplicate: true });
      }
      // Table doesn't exist yet (migration not applied) → log and continue
      // so deploys aren't blocked, but flag loudly.
      const msg = dedupeError.message || '';
      const code = dedupeError.code || '';
      const isMissing =
        code === '42P01' || msg.includes('does not exist') || msg.includes('schema cache');
      if (isMissing) {
        console.warn('[Stripe Webhook] stripe_events_processed table missing — RUN MIGRATION. Idempotency disabled.');
      } else {
        console.error('[Stripe Webhook] Idempotency insert failed:', dedupeError);
        // Don't block — better to risk a duplicate than to drop a real event.
      }
    }
  }

  const supabase = await createClient();
  const eventId = event.id;

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (!userId) break;

        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (!subscriptionId && session.mode === 'payment') {
          // Lifetime purchase - check if already processed (idempotency)
          const { data: existingSub } = await supabase
            .from('subscriptions')
            .select('plan_id')
            .eq('user_id', userId)
            .single();

          if (existingSub?.plan_id === 'lifetime') {
            console.log('Lifetime subscription already active for user:', userId);
            return NextResponse.json({ received: true });
          }

          const { data: lifetimeCount } = await supabase
            .from('subscriptions')
            .select('founding_member_number')
            .eq('plan_id', 'lifetime')
            .order('founding_member_number', { ascending: false })
            .limit(1)
            .single();

          const nextFoundingNumber = (lifetimeCount?.founding_member_number || 0) + 1;

          if (nextFoundingNumber <= 250) {
            const { error: lifetimeUpdateError } = await supabase
              .from('subscriptions')
              .update({
                plan_id: 'lifetime',
                stripe_customer_id: customerId,
                founding_member_number: nextFoundingNumber,
                status: 'active',
              })
              .eq('user_id', userId);

            if (lifetimeUpdateError) {
              console.error('Failed to update subscription to lifetime:', lifetimeUpdateError);
              return NextResponse.json({ error: 'Database error' }, { status: 500 });
            }

            // Send lifetime confirmation email
            try {
              const userInfo = await getUserInfo(userId);
              if (userInfo?.email) {
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvas.cyberdelic.design';
                await enqueueEmail({
                  to: userInfo.email,
                  subject: `Welcome, Founding Member #${nextFoundingNumber}!`,
                  template: SubscriptionConfirmed({
                    userName: userInfo.name || 'there',
                    planName: 'Founding Member',
                    planPrice: '$399 one-time',
                    isLifetime: true,
                    foundingMemberNumber: nextFoundingNumber,
                    dashboardUrl: `${baseUrl}/dashboard`,
                  }),
                  userId,
                  emailKind: EMAIL_KINDS.SUBSCRIPTION_CONFIRMED_LIFETIME,
                  stripeEventId: event.id,
                });
              }
            } catch (emailError) {
              console.error('Failed to enqueue lifetime confirmation email:', emailError);
            }
          }
        } else if (subscriptionId) {
          // Pro subscription - get trial dates from Stripe
          const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

          const { error: proUpdateError } = await supabase
            .from('subscriptions')
            .update({
              plan_id: 'pro',
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              status: stripeSubscription.status as any,
              current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
              trial_start: stripeSubscription.trial_start
                ? new Date(stripeSubscription.trial_start * 1000).toISOString()
                : null,
              trial_end: stripeSubscription.trial_end
                ? new Date(stripeSubscription.trial_end * 1000).toISOString()
                : null,
            })
            .eq('user_id', userId);

          if (proUpdateError) {
            console.error('Failed to update subscription to pro:', proUpdateError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
          }

          // Add pro monthly credits
          const { error: proCreditsError } = await supabase
            .from('ai_credits')
            .update({
              monthly_allowance: 100,
            })
            .eq('user_id', userId);

          if (proCreditsError) {
            console.error('Failed to update pro monthly credits:', proCreditsError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
          }

          // Send Pro confirmation email
          try {
            const userInfo = await getUserInfo(userId);
            if (userInfo?.email) {
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvas.cyberdelic.design';
              await enqueueEmail({
                to: userInfo.email,
                subject: 'Your CXD Canvas Pro plan is confirmed!',
                template: SubscriptionConfirmed({
                  userName: userInfo.name || 'there',
                  planName: 'Pro',
                  planPrice: '$20/month',
                  isLifetime: false,
                  trialEndDate: stripeSubscription.trial_end
                    ? new Date(stripeSubscription.trial_end * 1000).toISOString()
                    : undefined,
                  dashboardUrl: `${baseUrl}/dashboard`,
                }),
                userId,
                emailKind: EMAIL_KINDS.SUBSCRIPTION_CONFIRMED_PRO,
                stripeEventId: event.id,
              });
            }
          } catch (emailError) {
            console.error('Failed to enqueue Pro confirmation email:', emailError);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string | null;
        if (!subscriptionId) break;

        const { data: row } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (!row) break;

        // Mark as past_due so our cron scan can find the user at day 5.
        await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('user_id', row.user_id);

        const userInfo = await getUserInfo(row.user_id);
        if (!userInfo?.email) break;

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvas.cyberdelic.design';

        // Best-effort card + retry info.
        let cardBrand: string | undefined;
        let cardLast4: string | undefined;
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ['default_payment_method'],
          });
          const pm = sub.default_payment_method as Stripe.PaymentMethod | null;
          if (pm && pm.card) {
            cardBrand = pm.card.brand;
            cardLast4 = pm.card.last4;
          }
        } catch (err) {
          console.warn('[webhook] Could not fetch card for payment_failed:', err);
        }

        const nextRetryDate = invoice.next_payment_attempt
          ? new Date(invoice.next_payment_attempt * 1000).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : undefined;

        await enqueueEmail({
          to: userInfo.email,
          subject: 'We could not charge your card',
          template: PaymentFailed({
            userName: userInfo.name || 'there',
            amountDue: `$${(invoice.amount_due / 100).toFixed(2)}`,
            cardBrand,
            cardLast4,
            nextRetryDate,
            updatePaymentUrl: `${baseUrl}/dashboard/profile`,
          }),
          userId: row.user_id,
          emailKind: EMAIL_KINDS.PAYMENT_FAILED,
          stripeEventId: event.id,
        });
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;

        // Only act on subscription cycle invoices — ignore one-off invoices.
        if (invoice.billing_reason !== 'subscription_cycle' && invoice.billing_reason !== 'subscription_create') {
          break;
        }

        const subscriptionId = invoice.subscription as string | null;
        if (!subscriptionId) break;

        const { data: row } = await supabase
          .from('subscriptions')
          .select('user_id, status')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (!row) break;

        // Only send trial-converted for the FIRST paid invoice after trial.
        // We detect this by checking Supabase's status — if it's still
        // 'trialing' at the moment this webhook fires, this is the post-trial
        // charge and we send the email. On subsequent monthly renewals the
        // status will already be 'active' and we skip.
        if (row.status !== 'trialing') break;

        const userInfo = await getUserInfo(row.user_id);
        if (!userInfo?.email) break;

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvas.cyberdelic.design';
        const nextBillingDate = invoice.period_end
          ? new Date(invoice.period_end * 1000).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : 'next month';

        await enqueueEmail({
          to: userInfo.email,
          subject: 'Welcome to CXD Canvas Pro',
          template: TrialConverted({
            userName: userInfo.name || 'there',
            amountCharged: `$${(invoice.amount_paid / 100).toFixed(2)}`,
            nextBillingDate,
            dashboardUrl: `${baseUrl}/dashboard`,
            receiptUrl: invoice.hosted_invoice_url || undefined,
          }),
          userId: row.user_id,
          emailKind: EMAIL_KINDS.TRIAL_CONVERTED,
          stripeEventId: event.id,
        });
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const { data: row } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!row) break;

        const userInfo = await getUserInfo(row.user_id);
        if (!userInfo?.email) break;

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvas.cyberdelic.design';
        const trialEndDate = sub.trial_end
          ? new Date(sub.trial_end * 1000).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : 'soon';

        // Best-effort card info from the default payment method.
        let cardBrand: string | undefined;
        let cardLast4: string | undefined;
        try {
          const pmId =
            (sub.default_payment_method as string | null) ??
            (typeof sub.default_payment_method === 'object'
              ? (sub.default_payment_method as Stripe.PaymentMethod)?.id
              : undefined);
          if (pmId) {
            const pm = await stripe.paymentMethods.retrieve(pmId);
            cardBrand = pm.card?.brand ?? undefined;
            cardLast4 = pm.card?.last4 ?? undefined;
          }
        } catch (err) {
          console.warn('[webhook] Could not retrieve payment method for trial_will_end:', err);
        }

        await enqueueEmail({
          to: userInfo.email,
          subject: `Your CXD Canvas Pro trial ends on ${trialEndDate}`,
          template: TrialEndingSoon({
            userName: userInfo.name || 'there',
            trialEndDate,
            cardBrand,
            cardLast4,
            manageBillingUrl: `${baseUrl}/dashboard/profile`,
          }),
          userId: row.user_id,
          emailKind: EMAIL_KINDS.TRIAL_ENDING_SOON,
          stripeEventId: event.id,
        });
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const { data: row, error: lookupErr } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (lookupErr || !row) {
          console.warn('[webhook] subscription.updated: no subscription row found for', customerId);
          break;
        }

        const { error: syncErr } = await supabase
          .from('subscriptions')
          .update({
            stripe_subscription_id: sub.id,
            status: sub.status,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            trial_start: sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null,
            trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
            cancel_at_period_end: sub.cancel_at_period_end,
            canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
            // plan_id only flips away from 'pro' on subscription.deleted; don't
            // clobber it here.
          })
          .eq('user_id', row.user_id);

        if (syncErr) {
          console.error('[webhook] Failed to sync subscription:', syncErr);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const { data: subscriptionRecord, error: subRecordError } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', subscription.customer as string)
          .single();

        if (subRecordError) {
          console.error('Failed to find subscription record:', subRecordError);
          return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        if (subscriptionRecord) {
          const { error: cancelUpdateError } = await supabase
            .from('subscriptions')
            .update({
              plan_id: 'free',
              stripe_subscription_id: null,
              status: 'canceled',
              canceled_at: new Date().toISOString(),
            })
            .eq('user_id', subscriptionRecord.user_id);

          if (cancelUpdateError) {
            console.error('Failed to update subscription to canceled:', cancelUpdateError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
          }

          // Reset monthly allowance to free tier
          const { error: resetCreditsError } = await supabase
            .from('ai_credits')
            .update({
              monthly_allowance: 0,
            })
            .eq('user_id', subscriptionRecord.user_id);

          if (resetCreditsError) {
            console.error('Failed to reset monthly credits:', resetCreditsError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
          }

          // Send cancellation email
          try {
            const userInfo = await getUserInfo(subscriptionRecord.user_id);
            if (userInfo?.email) {
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvas.cyberdelic.design';
              await enqueueEmail({
                to: userInfo.email,
                subject: 'Your CXD Canvas subscription has been cancelled',
                template: SubscriptionCancelled({
                  userName: userInfo.name || 'there',
                  planName: 'Pro',
                  accessEndDate: new Date(subscription.current_period_end * 1000).toISOString(),
                  feedbackUrl: `${baseUrl}/feedback`,
                  resubscribeUrl: `${baseUrl}/pricing`,
                }),
                userId: subscriptionRecord.user_id,
                emailKind: EMAIL_KINDS.SUBSCRIPTION_CANCELLED,
                stripeEventId: event.id,
              });
            }
          } catch (emailError) {
            console.error('Failed to enqueue cancellation email:', emailError);
          }
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const userId = paymentIntent.metadata?.userId;
        const creditAmount = paymentIntent.metadata?.creditAmount;
        const packId = paymentIntent.metadata?.packId;

        if (userId && creditAmount) {
          // Idempotency check - prevent duplicate credit additions on webhook retry
          const { data: existingTx } = await supabase
            .from('ai_credit_transactions')
            .select('id')
            .eq('stripe_event_id', eventId)
            .maybeSingle();

          if (existingTx) {
            console.log('Credit event already processed:', eventId);
            return NextResponse.json({ received: true });
          }

          // Add addon credits to ai_credits table
          const { data: credits, error: creditsSelectError } = await supabase
            .from('ai_credits')
            .select('addon_credits')
            .eq('user_id', userId)
            .single();

          if (creditsSelectError) {
            console.error('Failed to fetch ai_credits:', creditsSelectError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
          }

          if (credits) {
            const newBalance = (credits.addon_credits || 0) + parseInt(creditAmount, 10);

            const { error: addonUpdateError } = await supabase
              .from('ai_credits')
              .update({
                addon_credits: newBalance,
              })
              .eq('user_id', userId);

            if (addonUpdateError) {
              console.error('Failed to update addon credits:', addonUpdateError);
              return NextResponse.json({ error: 'Database error' }, { status: 500 });
            }

            // Log transaction (stripe_event_id enables idempotency - requires column in ai_credit_transactions table)
            const { error: transactionError } = await supabase
              .from('ai_credit_transactions')
              .insert({
                user_id: userId,
                amount: parseInt(creditAmount, 10),
                balance_after: newBalance,
                reason: 'addon_purchase',
                stripe_event_id: eventId,
              });

            if (transactionError) {
              console.error('Failed to log credit transaction:', transactionError);
              return NextResponse.json({ error: 'Database error' }, { status: 500 });
            }

            // Send credit purchase receipt email
            try {
              const userInfo = await getUserInfo(userId);
              const pack = packId ? getCreditPack(packId) : null;

              if (userInfo?.email) {
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvas.cyberdelic.design';
                await enqueueEmail({
                  to: userInfo.email,
                  subject: `Receipt: ${parseInt(creditAmount, 10)} AI credits added`,
                  template: CreditPurchaseReceipt({
                    userName: userInfo.name || 'there',
                    packName: pack?.name || 'Credit Pack',
                    creditsAmount: parseInt(creditAmount, 10),
                    priceFormatted: `$${(paymentIntent.amount / 100).toFixed(2)}`,
                    newBalance,
                    purchaseDate: new Date().toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    }),
                    dashboardUrl: `${baseUrl}/cxd`,
                  }),
                  userId,
                  emailKind: EMAIL_KINDS.CREDIT_PURCHASE_RECEIPT,
                  stripeEventId: event.id,
                });
              }
            } catch (emailError) {
              console.error('Failed to enqueue credit purchase receipt:', emailError);
            }
          }
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
