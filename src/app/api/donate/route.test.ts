import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Env + mocks must be ready before the route module body runs (it constructs
// the Stripe client at import time). vi.hoisted runs at hoist time.
const { createSessionMock, rateLimitMock } = vi.hoisted(() => ({
  createSessionMock: vi.fn(),
  rateLimitMock: vi.fn(),
}));

vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_key";
  delete process.env.VERCEL; // so getClientIP doesn't read x-vercel-forwarded-for
});

// Stripe mock as a constructable class (the route does `new Stripe(key)`).
vi.mock("stripe", () => {
  class StripeMock {
    checkout = { sessions: { create: createSessionMock } };
  }
  return { default: StripeMock };
});

vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }));
vi.mock("@/lib/utils/client-ip", () => ({ getClientIP: () => "test-ip" }));
vi.mock("@/lib/utils/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { POST } from "./route";

function fakeReq(body: unknown): NextRequest {
  return {
    json: async () => body,
    headers: { get: () => null },
  } as unknown as NextRequest;
}

describe("POST /api/donate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSessionMock.mockReset();
    rateLimitMock.mockReset();
    // Default: not rate-limited.
    rateLimitMock.mockResolvedValue({ success: true, remaining: 9 });
  });

  it("returns 429 when rate-limited", async () => {
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0 });
    const res = await POST(fakeReq({ amount: 500 }));
    expect(res.status).toBe(429);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the amount is below the $1 minimum", async () => {
    const res = await POST(fakeReq({ amount: 50 }));
    expect(res.status).toBe(400);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the amount is above the $10,000 maximum", async () => {
    const res = await POST(fakeReq({ amount: 2_000_000 }));
    expect(res.status).toBe(400);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the amount is missing or non-integer", async () => {
    expect((await POST(fakeReq({}))).status).toBe(400);
    expect((await POST(fakeReq({ amount: 5.5 }))).status).toBe(400);
    expect((await POST(fakeReq({ amount: "100" }))).status).toBe(400);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("creates a checkout session and returns the url on a valid amount", async () => {
    createSessionMock.mockResolvedValue({
      url: "https://checkout.example/sess_1",
    });
    const res = await POST(fakeReq({ amount: 2500 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toBe("https://checkout.example/sess_1");
    expect(createSessionMock).toHaveBeenCalledTimes(1);
    // unit_amount passed through to Stripe equals the donated amount (cents).
    const params = createSessionMock.mock.calls[0][0];
    expect(params.line_items[0].price_data.unit_amount).toBe(2500);
  });

  it("returns 500 (without leaking details) when Stripe create rejects", async () => {
    createSessionMock.mockRejectedValue(new Error("stripe down"));
    const res = await POST(fakeReq({ amount: 1000 }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to create checkout session");
  });
});
