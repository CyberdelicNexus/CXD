import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/supabase/server";
import { getCreditPack } from "@/lib/credit-packs";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { packId } = await request.json();

    const pack = getCreditPack(packId);
    if (!pack) {
      return NextResponse.json(
        { error: "Invalid credit pack" },
        { status: 400 },
      );
    }

    // Get or create Stripe customer (same pattern as create-checkout)
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      const customer = await getStripe().customers.create(
        {
          email: user.email,
          metadata: { user_id: user.id },
        },
        { idempotencyKey: `cust:${user.id}` },
      );
      customerId = customer.id;

      await supabase
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://canvas.cyberdelic.design";

    const idempotencyKey = `credit_checkout_${user.id}_${pack.id}_${Math.floor(Date.now() / 60000)}`;
    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `CXD AI Credits - ${pack.name} Pack`,
              description: `${pack.credits} AI credits for CXD Canvas`,
            },
            unit_amount: pack.price,
          },
          quantity: 1,
        },
      ],
      metadata: {
        user_id: user.id,
        purchase_type: "credit_topup",
        pack_id: pack.id,
        credits_amount: String(pack.credits),
      },
      success_url: `${baseUrl}/cxd?credits_topup=success&pack=${pack.id}`,
      cancel_url: `${baseUrl}/cxd?credits_topup=canceled`,
    }, {
      idempotencyKey,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Credit checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
