import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe | null {
  if (stripeInstance) return stripeInstance;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("STRIPE_SECRET_KEY is not configured");
    return null;
  }

  try {
    stripeInstance = new Stripe(key);
    return stripeInstance;
  } catch (e) {
    console.error("Failed to initialize Stripe:", e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();

  if (!stripe) {
    return NextResponse.json(
      {
        error: "Donations are not currently available. Please try again later.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { amount, idempotencyKey } = body;

    // Validate amount (min $1, max $10000)
    const donationAmount = Math.max(
      100,
      Math.min(1_000_000, Number(amount) || 1000)
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://herbally.app";

    // Use idempotency key to prevent duplicate charge attempts on retry
    const createParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Support HerbAlly",
              description:
                "Help keep herbal medicine information free for everyone",
            },
            unit_amount: donationAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${appUrl}/donate?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/donate?canceled=true`,
      metadata: {
        type: "donation",
      },
    };

    const idempotencyKeyProvided =
      typeof idempotencyKey === "string" && idempotencyKey.length > 0;

    const session = idempotencyKeyProvided
      ? await stripe.checkout.sessions.create(createParams, {
          idempotencyKey,
        })
      : await stripe.checkout.sessions.create(createParams);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const err = error as Error & { type?: string; code?: string };
    console.error("Stripe checkout error:", {
      message: err.message || "Unknown error",
      type: err.type,
      code: err.code,
    });
    return NextResponse.json(
      {
        error: "Failed to create checkout session",
        details: err.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
