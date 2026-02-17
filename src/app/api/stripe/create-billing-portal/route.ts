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

    const stripe = getStripe();

    // Get Stripe customer ID from subscriptions table
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found' },
        { status: 404 }
      );
    }

    // Create billing portal session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${appUrl}/dashboard`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Billing portal error:', error);
    return NextResponse.json(
      { error: 'Failed to create billing portal session' },
      { status: 500 }
    );
  }
}
