import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// --- Env must be set BEFORE the route module body runs (it reads
// STRIPE_SECRET_KEY at import time to construct the Stripe client), and the
// Stripe mock fns must exist before the vi.mock factory runs. vi.hoisted runs
// at hoist time, before any import executes. -----------------------------
const { constructEventMock, chargesRetrieveMock } = vi.hoisted(() => ({
  constructEventMock: vi.fn(),
  chargesRetrieveMock: vi.fn(),
}));

vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_key";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});

// --- Stripe mock ---------------------------------------------------------
// The route does `new Stripe(stripeKey)` at import time, so the mock default
// export must be a real constructor (a class) — an arrow-function vi.fn
// implementation is not constructable with `new`.
vi.mock("stripe", () => {
  class StripeMock {
    webhooks = { constructEvent: constructEventMock };
    charges = { retrieve: chargesRetrieveMock };
  }
  return { default: StripeMock };
});

// --- Thenable, chainable admin client mock (one queued response per await) ---
const responses: Array<{ data: unknown; error: unknown }> = [];
type Chain = {
  from: () => Chain;
  insert: () => Chain;
  upsert: () => Chain;
  update: () => Chain;
  select: () => Chain;
  eq: () => Chain;
  maybeSingle: () => Chain;
  then: (resolve: (v: { data: unknown; error: unknown }) => unknown) => unknown;
};
const chain: Chain = {
  from: () => chain,
  insert: () => chain,
  upsert: () => chain,
  update: () => chain,
  select: () => chain,
  eq: () => chain,
  maybeSingle: () => chain,
  then: (resolve: (v: { data: unknown; error: unknown }) => unknown) =>
    resolve(responses.shift() ?? { data: null, error: null }),
};

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => chain }));
vi.mock("@/lib/utils/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { POST } from "./route";

// Minimal fake NextRequest: the route only uses .text() and .headers.get().
function fakeRequest(body: string, signature?: string): NextRequest {
  return {
    text: async () => body,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "stripe-signature" ? (signature ?? null) : null,
    },
  } as unknown as NextRequest;
}

function event(type: string, object: Record<string, unknown>, id = "evt_1") {
  return { id, type, data: { object } };
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    responses.length = 0;
    constructEventMock.mockReset();
    chargesRetrieveMock.mockReset();
  });

  it("returns 400 when the stripe-signature header is missing", async () => {
    constructEventMock.mockReturnValue(event("checkout.session.completed", {}));
    const res = await POST(fakeRequest("payload"));
    expect(res.status).toBe(400);
  });

  it("returns 400 on an invalid signature (constructEvent throws)", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("signature mismatch");
    });
    const res = await POST(fakeRequest("payload", "bad-sig"));
    expect(res.status).toBe(400);
    // signature failure happens before any DB call
    expect(responses).toHaveLength(0);
  });

  it("returns 200 {duplicate:true} when the event was already processed", async () => {
    constructEventMock.mockReturnValue(event("checkout.session.completed", {}));
    // claimEvent: insert → unique_violation (23505) → read existing status
    responses.push({ data: null, error: { code: "23505", message: "dup" } });
    responses.push({ data: { status: "done" }, error: null }); // status read

    const res = await POST(fakeRequest("payload", "sig"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ received: true, duplicate: true });
    // duplicate short-circuits before the upsert → both dedup calls consumed
    expect(responses).toHaveLength(0);
  });

  it("reprocesses a previously failed event (status='failed') instead of skipping", async () => {
    constructEventMock.mockReturnValue(
      event("checkout.session.completed", {
        id: "cs_redo",
        amount_total: 1500,
        payment_status: "paid",
        payment_intent: "pi_redo",
      })
    );
    // claimEvent: insert → 23505 → read status='failed' → re-stamp processing
    responses.push({ data: null, error: { code: "23505", message: "dup" } });
    responses.push({ data: { status: "failed" }, error: null }); // status read
    responses.push({ data: null, error: null }); // re-stamp processing update
    // then process: upsert + markEventDone
    responses.push({ data: null, error: null }); // upsert
    responses.push({ data: null, error: null }); // markEventDone

    const res = await POST(fakeRequest("payload", "sig"));
    expect(res.status).toBe(200);
    expect(responses).toHaveLength(0);
  });

  it("upserts a donation on checkout.session.completed and returns 200", async () => {
    constructEventMock.mockReturnValue(
      event("checkout.session.completed", {
        id: "cs_1",
        amount_total: 2500,
        currency: "usd",
        payment_status: "paid",
        payment_intent: "pi_1",
        customer_details: { email: "a@b.com", name: "A B" },
        metadata: { source: "donate" },
      })
    );
    // 1. claim insert ok  2. upsert ok  3. markEventDone ok
    responses.push({ data: null, error: null });
    responses.push({ data: null, error: null });
    responses.push({ data: null, error: null });

    const res = await POST(fakeRequest("payload", "sig"));
    expect(res.status).toBe(200);
    expect(responses).toHaveLength(0);
  });

  it("returns 500 on DB upsert error so Stripe retries", async () => {
    constructEventMock.mockReturnValue(
      event("checkout.session.completed", {
        id: "cs_2",
        amount_total: 1000,
        payment_status: "paid",
        payment_intent: "pi_2",
      })
    );
    responses.push({ data: null, error: null }); // claim ok
    responses.push({ data: null, error: { message: "db down" } }); // upsert fails
    responses.push({ data: null, error: null }); // markEventFailed

    const res = await POST(fakeRequest("payload", "sig"));
    expect(res.status).toBe(500);
  });

  it("marks a donation failed on payment_intent.payment_failed", async () => {
    constructEventMock.mockReturnValue(
      event("payment_intent.payment_failed", { id: "pi_3" })
    );
    responses.push({ data: null, error: null }); // claim
    responses.push({ data: null, error: null }); // markDonationFailed update
    responses.push({ data: null, error: null }); // markEventDone

    const res = await POST(fakeRequest("payload", "sig"));
    expect(res.status).toBe(200);
    expect(responses).toHaveLength(0);
  });

  it("marks a full refund as 'refunded'", async () => {
    constructEventMock.mockReturnValue(
      event("charge.refunded", {
        payment_intent: "pi_4",
        amount_captured: 1000,
        amount_refunded: 1000,
      })
    );
    responses.push({ data: null, error: null }); // claim
    responses.push({ data: null, error: null }); // markDonationRefunded
    responses.push({ data: null, error: null }); // markEventDone

    const res = await POST(fakeRequest("payload", "sig"));
    expect(res.status).toBe(200);
    expect(responses).toHaveLength(0);
  });

  it("marks a partial refund as 'partially_refunded'", async () => {
    constructEventMock.mockReturnValue(
      event("charge.refunded", {
        payment_intent: "pi_5",
        amount_captured: 1000,
        amount_refunded: 400,
      })
    );
    responses.push({ data: null, error: null }); // claim
    responses.push({ data: null, error: null }); // markDonationRefunded
    responses.push({ data: null, error: null }); // markEventDone

    const res = await POST(fakeRequest("payload", "sig"));
    expect(res.status).toBe(200);
    expect(responses).toHaveLength(0);
  });

  it("retrieves the charge and marks disputed on charge.dispute.created", async () => {
    constructEventMock.mockReturnValue(
      event("charge.dispute.created", { charge: "ch_1" })
    );
    chargesRetrieveMock.mockResolvedValue({
      payment_intent: "pi_6",
    });
    responses.push({ data: null, error: null }); // claim
    responses.push({ data: null, error: null }); // markDonationDisputed
    responses.push({ data: null, error: null }); // markEventDone

    const res = await POST(fakeRequest("payload", "sig"));
    expect(res.status).toBe(200);
    expect(chargesRetrieveMock).toHaveBeenCalledWith("ch_1");
    expect(responses).toHaveLength(0);
  });

  it("returns 200 and ignores an unhandled event type", async () => {
    constructEventMock.mockReturnValue(event("invoice.paid", {}));
    responses.push({ data: null, error: null }); // claim
    responses.push({ data: null, error: null }); // markEventDone (no action)

    const res = await POST(fakeRequest("payload", "sig"));
    expect(res.status).toBe(200);
    expect(responses).toHaveLength(0);
  });
});
