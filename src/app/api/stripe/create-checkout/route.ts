import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe, PLANS } from '@/lib/stripe';
import { createClient } from '@/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { priceId, planType } = await request.json();

    if (!priceId || !planType) {
      return NextResponse.json(
        { error: 'Missing priceId or planType' },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id,
        },
      });
      customerId = customer.id;

      // Update subscription record with customer ID
      await supabase
        .from('subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id);
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvas.cyberdelic.design';

    // Determine if this is a subscription or one-time payment
    const isLifetime = planType === 'lifetime';

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      success_url: `${baseUrl}/canvas?checkout=success`,
      cancel_url: `${baseUrl}/pricing?checkout=canceled`,
      metadata: {
        user_id: user.id,
        plan_type: planType,
      },
    };

    if (isLifetime) {
      // One-time payment for lifetime
      sessionConfig.mode = 'payment';
      sessionConfig.line_items = [
        {
          price: priceId,
          quantity: 1,
        },
      ];
    } else {
      // Subscription with trial
      sessionConfig.mode = 'subscription';
      sessionConfig.line_items = [
        {
          price: priceId,
          quantity: 1,
        },
      ];
      sessionConfig.subscription_data = {
        trial_period_days: PLANS.PRO.trialDays,
        metadata: {
          user_id: user.id,
        },
      };
    }

    const idempotencyKey = `checkout_${user.id}_${priceId}_${Math.floor(Date.now() / 60000)}`;
    const session = await stripe.checkout.sessions.create(sessionConfig, {
      idempotencyKey,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
