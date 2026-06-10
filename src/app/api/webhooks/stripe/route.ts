import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * NOTE: The `donations` table is defined in migration 00026_create_donations.sql.
 * Until applied, regenerate types:
 *   supabase gen types typescript --linked > src/lib/types/database.ts
 */

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe | null {
  if (stripeInstance) return stripeInstance;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  try {
    stripeInstance = new Stripe(key);
    return stripeInstance;
  } catch (e) {
    console.error("Failed to initialize Stripe:", e);
    return null;
  }
}

function db() {
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: (table: string) => (supabase.from as any)(table) };
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

  const { error } = await db().from("donations").upsert(
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
    console.error("Failed to upsert donation:", error);
  }

  return { amountCents, email, status };
}

async function markDonationFailed(paymentIntent: Stripe.PaymentIntent) {
  const { error } = await db()
    .from("donations")
    .update({ status: "failed", updated_at: new Date().toISOString() })
    .eq("stripe_payment_intent_id", paymentIntent.id);

  if (error) {
    console.error("Failed to mark donation as failed:", error);
  }
}

async function markDonationRefunded(charge: Stripe.Charge) {
  const piId = charge.payment_intent as string;
  if (!piId) return;

  const { error } = await db()
    .from("donations")
    .update({ status: "refunded", updated_at: new Date().toISOString() })
    .eq("stripe_payment_intent_id", piId);

  if (error) {
    console.error("Failed to mark donation as refunded:", error);
  }
}

export async function POST(request: NextRequest) {
  const stripeClient = getStripe();

  if (!stripeClient) {
    console.error("STRIPE_SECRET_KEY is not configured");
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
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
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
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const { amountCents, email, status } = await upsertDonation(session);
        console.log(
          `Donation completed: ${email ?? "anonymous"} $${(amountCents / 100).toFixed(2)} (${status})`
        );
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
    console.error("Error processing webhook:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
