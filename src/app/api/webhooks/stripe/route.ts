import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/utils/logger";


const stripeKey = process.env.STRIPE_SECRET_KEY;
let stripeInstance: Stripe | null = null;

if (stripeKey) {
  try {
    stripeInstance = new Stripe(stripeKey);
  } catch (e) {
    logger.error("stripe_init_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

function getStripe(): Stripe | null {
  return stripeInstance;
}

async function upsertDonation(session: Stripe.Checkout.Session) {
  const amountCents = session.amount_total ?? 0;
  const amountDisplay = `$${(amountCents / 100).toFixed(2)}`;
  const email = session.customer_details?.email ?? null;
  const name = session.customer_details?.name ?? null;
  const paymentIntentId = (session.payment_intent as string) ?? null;

  const status =
    session.payment_status === "paid"
      ? "completed"
      : session.payment_status === "unpaid"
        ? "pending"
        : "expired";

  const { error } = await createAdminClient().from("donations").upsert(
    {
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      amount_cents: amountCents,
      amount_display: amountDisplay,
      currency: session.currency ?? "usd",
      customer_email: email,
      customer_name: name,
      status,
      metadata: session.metadata ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_session_id" }
  );

  if (error) {
    logger.error("stripe_upsert_donation_failed", {
      sessionId: session.id,
      error: error.message,
    });
  }

  return { amountCents, email, status };
}

async function markDonationFailed(paymentIntent: Stripe.PaymentIntent) {
  const { error } = await createAdminClient()
    .from("donations")
    .update({ status: "failed", updated_at: new Date().toISOString() })
    .eq("stripe_payment_intent_id", paymentIntent.id);

  if (error) {
    logger.error("stripe_mark_failed_failed", {
      paymentIntentId: paymentIntent.id,
      error: error.message,
    });
  }
}

async function markDonationRefunded(charge: Stripe.Charge) {
  const piId = charge.payment_intent as string;
  if (!piId) return;

  const { error } = await createAdminClient()
    .from("donations")
    .update({ status: "refunded", updated_at: new Date().toISOString() })
    .eq("stripe_payment_intent_id", piId);

  if (error) {
    logger.error("stripe_mark_refunded_failed", {
      paymentIntentId: piId,
      error: error.message,
    });
  }
}

export async function POST(request: NextRequest) {
  const stripeClient = getStripe();

  if (!stripeClient) {
    logger.error("stripe_not_configured");
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  if (!webhookSecret) {
    logger.error("stripe_webhook_secret_missing");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripeClient.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch (err) {
    logger.error("stripe_webhook_signature_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const { amountCents, email, status } = await upsertDonation(session);
        logger.info("stripe_donation_completed", {
          email: email ?? "anonymous",
          amount: amountCents,
          status,
        });
        break;
      }

      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        await upsertDonation(session);
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await upsertDonation(session);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await markDonationFailed(paymentIntent);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await markDonationRefunded(charge);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error("stripe_webhook_processing_failed", {
      eventType: event.type,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
