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

/**
 * Coerce a Stripe `payment_intent` field (which may be a string id OR an
 * expanded PaymentIntent object) to its id string.
 */
function paymentIntentId(
  pi: string | Stripe.PaymentIntent | null | undefined
): string | null {
  if (!pi) return null;
  if (typeof pi === "string") return pi;
  return pi.id ?? null;
}

async function upsertDonation(session: Stripe.Checkout.Session) {
  const amountCents = session.amount_total ?? 0;
  const amountDisplay = `$${(amountCents / 100).toFixed(2)}`;
  const email = session.customer_details?.email ?? null;
  const name = session.customer_details?.name ?? null;
  const paymentIntentIdValue = paymentIntentId(session.payment_intent);

  const status =
    session.payment_status === "paid"
      ? "completed"
      : session.payment_status === "unpaid"
        ? "pending"
        : "expired";

  // Throw on DB error so the outer handler returns 500 and Stripe retries the
  // webhook. Previously errors were swallowed and a 200 was returned, losing
  // donations on transient DB failures.
  const { error } = await createAdminClient()
    .from("donations")
    .upsert(
      {
        stripe_session_id: session.id,
        stripe_payment_intent_id: paymentIntentIdValue,
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
    throw new Error(`upsert_donation_failed: ${error.message}`);
  }

  return { amountCents, email, status };
}

async function markDonationFailed(paymentIntent: Stripe.PaymentIntent) {
  const { error } = await createAdminClient()
    .from("donations")
    .update({ status: "failed", updated_at: new Date().toISOString() })
    .eq("stripe_payment_intent_id", paymentIntent.id);

  if (error) {
    throw new Error(`mark_failed_failed: ${error.message}`);
  }
}

async function markDonationRefunded(charge: Stripe.Charge) {
  const piId = paymentIntentId(charge.payment_intent);
  if (!piId) return;

  // Distinguish full vs partial refunds so the donation record stays accurate.
  const refunded = charge.amount_refunded ?? 0;
  const captured = charge.amount_captured ?? 0;
  const status =
    captured > 0 && refunded > 0 && refunded < captured
      ? "partially_refunded"
      : "refunded";

  const { error } = await createAdminClient()
    .from("donations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("stripe_payment_intent_id", piId);

  if (error) {
    throw new Error(`mark_refunded_failed: ${error.message}`);
  }
}

async function markDonationDisputed(charge: Stripe.Charge) {
  const piId = paymentIntentId(charge.payment_intent);
  if (!piId) return;

  const { error } = await createAdminClient()
    .from("donations")
    .update({ status: "disputed", updated_at: new Date().toISOString() })
    .eq("stripe_payment_intent_id", piId);

  if (error) {
    throw new Error(`mark_disputed_failed: ${error.message}`);
  }
}

/**
 * Idempotency guard: record the Stripe event id so a redelivered webhook
 * doesn't double-process. Returns true if this event was already handled.
 * Falls back to non-dedup behavior only if the table is unavailable (e.g. the
 * migration hasn't been applied yet), logging the issue.
 */
async function isDuplicateEvent(event: Stripe.Event): Promise<boolean> {
  const admin = createAdminClient();
  try {
    const { error } = await admin
      .from("webhook_events")
      .insert({ id: event.id, type: event.type });
    if (error) {
      // 23505 = unique_violation → already processed.
      if (error.code === "23505") return true;
      // Anything else (e.g. table missing) → log and proceed without dedup.
      logger.error("stripe_webhook_dedup_error", {
        eventId: event.id,
        error: error.message,
      });
    }
  } catch (e) {
    logger.error("stripe_webhook_dedup_exception", {
      eventId: event.id,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  return false;
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

  // Dedup before processing (Stripe may redeliver on 5xx or timeout).
  if (await isDuplicateEvent(event)) {
    return NextResponse.json({ received: true, duplicate: true });
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

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        // dispute.charge is the charge id; fetch the charge to resolve the
        // payment intent. We update by payment intent id below.
        const charge = await stripeClient.charges.retrieve(
          dispute.charge as string
        );
        await markDonationDisputed(charge);
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
    // 500 so Stripe retries — a DB failure here must not be silently swallowed.
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
