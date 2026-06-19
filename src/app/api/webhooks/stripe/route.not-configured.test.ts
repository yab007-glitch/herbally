import { describe, it, expect, vi } from "vitest";
import type { NextRequest } from "next/server";

// STRIPE_SECRET_KEY must be UNSET when the route module body runs (it
// constructs the Stripe client at import time only if the key is present).
// Deleting it in vi.hoisted guarantees that, even if another test file in the
// same worker set it earlier.
vi.hoisted(() => {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

// Mock stripe so the real (heavy) SDK is never imported in this file.
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    webhooks: { constructEvent: vi.fn() },
    charges: { retrieve: vi.fn() },
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}) as never,
}));
vi.mock("@/lib/utils/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { POST } from "./route";

function fakeRequest(): NextRequest {
  return {
    text: async () => "payload",
    headers: { get: () => "sig" },
  } as unknown as NextRequest;
}

describe("POST /api/webhooks/stripe (Stripe not configured)", () => {
  it("returns 500 when Stripe is not configured (no STRIPE_SECRET_KEY)", async () => {
    const res = await POST(fakeRequest());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/not configured/i);
  });
});
