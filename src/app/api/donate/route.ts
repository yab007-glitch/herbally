import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { logger } from "@/lib/utils/logger";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";

const stripeKey = process.env.STRIPE_SECRET_KEY;
let stripeInstance: Stripe | null = null;

if (stripeKey) {
  try {
    stripeInstance = new Stripe(stripeKey);
  } catch (e) {
    logger.error("stripe_donate_init_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

function getStripe(): Stripe | null {
  return stripeInstance;
}

export async function POST(req: NextRequest) {
  const { success } = await rateLimit(getClientIP(req), 10, 60_000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }
  const stripe = getStripe();

  if (!stripe) {
    logger.error("stripe_donate_not_configured");
    return NextResponse.json(
      {
        error: "Donations are not currently available. Please try again later.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    // Amount in cents: $1 min, $10,000 max. The schema enforces bounds, so no
    // redundant clamp is needed (the previous Math.max/Math.min could mask a
    // bad input as a valid donation).
    const schema = z.object({
      amount: z.number().int().min(100).max(1_000_000),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }
    const donationAmount = parsed.data.amount;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://herbally.app";

    // Checkout sessions are not charges — creating a duplicate session just
    // yields a second URL the user may never open, so no idempotency key is
    // required (and the previous client-supplied key was never sent).
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

    const session = await stripe.checkout.sessions.create(createParams);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const err = error as Error & { type?: string; code?: string };
    logger.error("stripe_checkout_error", {
      message: err.message || "Unknown error",
      type: err.type,
      code: err.code,
    });
    // Don't leak Stripe/internal error details to the client.
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
