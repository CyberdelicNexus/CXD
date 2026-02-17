import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
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

  const supabase = createClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (!userId) break;

        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (!subscriptionId && session.mode === 'payment') {
          // Lifetime purchase
          const { data: lifetimeCount } = await supabase
            .from('subscriptions')
            .select('founding_member_number')
            .eq('plan_id', 'lifetime')
            .order('founding_member_number', { ascending: false })
            .limit(1)
            .single();

          const nextFoundingNumber = (lifetimeCount?.founding_member_number || 0) + 1;

          if (nextFoundingNumber <= 250) {
            await supabase
              .from('subscriptions')
              .update({
                plan_id: 'lifetime',
                stripe_customer_id: customerId,
                founding_member_number: nextFoundingNumber,
                status: 'active',
              })
              .eq('user_id', userId);
          }
        } else if (subscriptionId) {
          // Pro subscription - get trial dates from Stripe
          const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

          await supabase
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

          // Add pro monthly credits
          await supabase
            .from('ai_credits')
            .update({
              monthly_allowance: 100,
            })
            .eq('user_id', userId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const { data: subscriptionRecord } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', subscription.customer as string)
          .single();

        if (subscriptionRecord) {
          await supabase
            .from('subscriptions')
            .update({
              plan_id: 'free',
              stripe_subscription_id: null,
              status: 'canceled',
              canceled_at: new Date().toISOString(),
            })
            .eq('user_id', subscriptionRecord.user_id);

          // Reset monthly allowance to free tier
          await supabase
            .from('ai_credits')
            .update({
              monthly_allowance: 0,
            })
            .eq('user_id', subscriptionRecord.user_id);
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const userId = paymentIntent.metadata?.userId;
        const creditAmount = paymentIntent.metadata?.creditAmount;

        if (userId && creditAmount) {
          // Add addon credits to ai_credits table
          const { data: credits } = await supabase
            .from('ai_credits')
            .select('addon_credits')
            .eq('user_id', userId)
            .single();

          if (credits) {
            await supabase
              .from('ai_credits')
              .update({
                addon_credits: (credits.addon_credits || 0) + parseInt(creditAmount, 10),
              })
              .eq('user_id', userId);

            // Log transaction
            await supabase
              .from('ai_credit_transactions')
              .insert({
                user_id: userId,
                amount: parseInt(creditAmount, 10),
                balance_after: (credits.addon_credits || 0) + parseInt(creditAmount, 10),
                reason: 'addon_purchase',
              });
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
