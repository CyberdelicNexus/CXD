import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createClient } from '@/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { planId } = await request.json();

    if (!planId || !['pro', 'lifetime'].includes(planId)) {
      return NextResponse.json(
        { error: 'Invalid plan ID' },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Get or create Stripe customer from subscriptions table
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID to subscriptions table
      // Note: This requires service_role permissions, so we need to use a service client
      const { createClient: createServiceClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );

      await supabaseAdmin
        .from('subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id);
    }

    // Determine the price ID based on plan
    const priceId =
      planId === 'pro'
        ? process.env.STRIPE_PRO_PRICE_ID
        : process.env.STRIPE_LIFETIME_PRICE_ID;

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID not configured' },
        { status: 500 }
      );
    }

    // Create checkout session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvas.cyberdelic.design';
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: planId === 'pro' ? 'subscription' : 'payment',
      success_url: `${appUrl}/dashboard?upgrade=success`,
      cancel_url: `${appUrl}/dashboard?upgrade=cancelled`,
      metadata: {
        supabase_user_id: user.id,
        plan_id: planId,
      },
      subscription_data: planId === 'pro' ? {
        trial_period_days: 14,
        metadata: {
          supabase_user_id: user.id,
          plan_id: planId,
        },
      } : undefined,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout session error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
