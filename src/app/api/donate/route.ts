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
    const schema = z.object({
      amount: z.number().min(100).max(1000000),
      idempotencyKey: z.string().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { amount, idempotencyKey } = parsed.data;

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
    logger.error("stripe_checkout_error", {
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
