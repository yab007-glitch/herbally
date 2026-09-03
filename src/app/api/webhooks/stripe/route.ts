import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/utils/logger";

const stripeKey = process.env.STRIPE_SECRET_KEY;
let stripeInstance: Stripe | null = null;

if (stripeKey) {
  try {
    // L11 (audit 2026-06-22): pin the API version explicitly rather than
    // relying on the library default, so a stripe package bump can't silently
    // change webhook/event shapes under us. Stripe.API_VERSION is the
    // package's own LatestApiVersion constant, so the pin tracks the SDK.
    stripeInstance = new Stripe(stripeKey, {
      apiVersion: Stripe.API_VERSION,
    });
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

async function upsertDonation(
  session: Stripe.Checkout.Session,
  statusOverride?: string
) {
  const amountCents = session.amount_total ?? 0;
  const amountDisplay = `$${(amountCents / 100).toFixed(2)}`;
  const email = session.customer_details?.email ?? null;
  const name = session.customer_details?.name ?? null;
  const paymentIntentIdValue = paymentIntentId(session.payment_intent);

  // M7 (audit 2026-06-22): an explicit status override wins. The
  // `checkout.session.expired` event carries a session whose payment_status is
  // `unpaid`, so the derived status below would map it to `pending` forever and
  // the `expired` enum (00026/00040) was unreachable. The caller passes
  // "expired" for that event type.
  const status =
    statusOverride ??
    (session.payment_status === "paid"
      ? "completed"
      : session.payment_status === "unpaid"
        ? "pending"
        : "expired");

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
  if (!piId) {
    // L9 (audit 2026-06-22): previously this returned silently, so a refund
    // event on a charge with no expandable PI vanished without a trace and
    // the donation stayed "completed". Log it so operators can reconcile
    // manually instead of losing the signal entirely.
    logger.warn("stripe_refund_no_payment_intent", {
      chargeId: charge.id,
    });
    return;
  }

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
  if (!piId) {
    // L9: same rationale as markDonationRefunded — surface the skip rather
    // than silently dropping the dispute update.
    logger.warn("stripe_dispute_no_payment_intent", {
      chargeId: charge.id,
    });
    return;
  }

  const { error } = await createAdminClient()
    .from("donations")
    .update({ status: "disputed", updated_at: new Date().toISOString() })
    .eq("stripe_payment_intent_id", piId);

  if (error) {
    throw new Error(`mark_disputed_failed: ${error.message}`);
  }
}

/**
 * Idempotency guard for Stripe webhooks (C-2, audit 2026-06-22).
 *
 * Stripe redelivers an event on 5xx/timeout. We must process a redelivery
 * exactly once, but we must also NOT permanently swallow an event whose first
 * delivery failed mid-processing — otherwise a single transient DB error loses
 * the donation forever (the old code inserted the dedup row BEFORE processing
 * and treated any existing row as "already handled", a poison pill).
 *
 * Model (requires the `status` column from migration 00043):
 *   1. Insert (id, status='processing'). Three outcomes:
 *      • insert succeeds → this is the first delivery; claim it.
 *      • 23505 unique_violation → a row already exists; read its status:
 *          - 'done'    → already fully processed → skip (return false).
 *          - 'processing' (a prior delivery crashed mid-process) or
 *            'failed' (a prior delivery threw) → reprocess: re-stamp
 *            status='processing' and claim it.
 *      • any other error (e.g. table missing) → log and proceed without
 *        dedup (returns true; markDone/markFailed will no-op).
 *   2. On successful processing → markEventDone (status='done').
 *   3. On a thrown error → markEventFailed (status='failed') so the Stripe
 *      retry reprocesses, then return 500 so Stripe retries.
 *
 * Returns true if this delivery should process, false if it was already done.
 */
async function claimEvent(event: Stripe.Event): Promise<boolean> {
  const admin = createAdminClient();
  try {
    const { error } = await admin.from("webhook_events").insert({
      id: event.id,
      type: event.type,
      status: "processing",
    });
    if (!error) return true; // newly claimed — first delivery

    if (error.code === "23505") {
      // Row exists from a prior delivery. Only skip if it finished cleanly.
      const { data, error: readError } = await admin
        .from("webhook_events")
        .select("status")
        .eq("id", event.id)
        .maybeSingle();

      if (readError) {
        logger.error("stripe_webhook_dedup_read_error", {
          eventId: event.id,
          error: readError.message,
        });
        // Can't confirm done — safer to reprocess (donation upsert is idempotent).
        return true;
      }
      if (data?.status === "done") return false; // already handled — skip

      // 'processing' (stale crash) or 'failed' (prior throw) → reprocess.
      await admin
        .from("webhook_events")
        .update({
          status: "processing",
          processed_at: new Date().toISOString(),
        })
        .eq("id", event.id);
      return true;
    }

    // Anything else (e.g. table/column missing pre-00043) → proceed without dedup.
    logger.error("stripe_webhook_dedup_error", {
      eventId: event.id,
      error: error.message,
    });
    return true;
  } catch (e) {
    logger.error("stripe_webhook_dedup_exception", {
      eventId: event.id,
      error: e instanceof Error ? e.message : String(e),
    });
    return true; // proceed without dedup rather than dropping the event
  }
}

/** Mark a webhook event as fully processed. Swallows errors (e.g. missing
 * table pre-migration) — the donation upsert itself is the source of truth. */
async function markEventDone(eventId: string): Promise<void> {
  try {
    await createAdminClient()
      .from("webhook_events")
      .update({ status: "done", processed_at: new Date().toISOString() })
      .eq("id", eventId);
  } catch {
    /* no-op — dedup store unavailable */
  }
}

/** Mark a webhook event as failed so a Stripe retry reprocesses it. */
async function markEventFailed(eventId: string): Promise<void> {
  try {
    await createAdminClient()
      .from("webhook_events")
      .update({ status: "failed", processed_at: new Date().toISOString() })
      .eq("id", eventId);
  } catch {
    /* no-op — dedup store unavailable */
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

  // Bound body before buffering: Stripe events are KBs. Reject oversized
  // unsigned bodies to prevent memory/CPU DoS before signature verification.
  const contentLength = parseInt(
    request.headers.get("content-length") || "0",
    10
  );
  if (contentLength > 1024 * 1024) {
    return NextResponse.json(
      { error: "Request body too large" },
      { status: 413 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  if (!webhookSecret) {
    // L10 (audit 2026-06-22): a missing webhook secret is a configuration
    // error, not a transient failure. Returning 500 made Stripe retry forever
    // (pointlessly, since the secret won't appear mid-retry). 400 tells Stripe
    // the event is bad and stops the retry storm.
    logger.error("stripe_webhook_secret_missing");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 400 }
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

  // L-13 (audit 2026-06-22): reject test-mode events when running against live
  // keys, so a replayed/leaked test event can't mutate the donations table in
  // production. (Signature verification alone doesn't prevent this — a test
  // event signed with a leaked test secret would still verify.)
  if (
    (stripeKey?.startsWith("sk_live_") || stripeKey?.startsWith("rk_live_")) &&
    event.livemode === false
  ) {
    logger.error("stripe_webhook_test_event_on_live_key", {
      eventId: event.id,
      type: event.type,
    });
    return NextResponse.json(
      { error: "Test event received on live key" },
      { status: 400 }
    );
  }

  // Dedup before processing (Stripe may redeliver on 5xx or timeout).
  // claimEvent only returns false for events already fully processed ('done');
  // a prior failed/processing attempt is reprocessed (C-2).
  if (!(await claimEvent(event))) {
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
        // M7: pass "expired" explicitly — the session's payment_status is
        // `unpaid` here, so the default mapper would persist "pending" forever.
        await upsertDonation(session, "expired");
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
        // L12 (audit 2026-06-22): `dispute.charge` is typed as `string |
        // Stripe.Charge` — it's usually the charge id string, but it can be an
        // expanded Charge object. Coerce defensively instead of assuming a
        // string, so an expanded object doesn't get passed to charges.retrieve
        // as a bogus id.
        const chargeId =
          typeof dispute.charge === "string"
            ? dispute.charge
            : dispute.charge?.id;
        if (!chargeId) break;
        const charge = await stripeClient.charges.retrieve(chargeId);
        await markDonationDisputed(charge);
        break;
      }

      default:
        break;
    }

    await markEventDone(event.id);
    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error("stripe_webhook_processing_failed", {
      eventType: event.type,
      error: err instanceof Error ? err.message : String(err),
    });
    // Mark failed (not done) so a Stripe retry reprocesses instead of skipping.
    await markEventFailed(event.id);
    // 500 so Stripe retries — a DB failure here must not be silently swallowed.
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
