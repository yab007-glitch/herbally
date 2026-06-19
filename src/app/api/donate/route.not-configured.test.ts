import { describe, it, expect, vi } from "vitest";
import type { NextRequest } from "next/server";

// STRIPE_SECRET_KEY unset at route import → Stripe client is null → 503.
vi.hoisted(() => {
  delete process.env.STRIPE_SECRET_KEY;
});

vi.mock("stripe", () => ({
  default: class {
    checkout = { sessions: { create: vi.fn() } };
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 9 }),
}));
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

describe("POST /api/donate (Stripe not configured)", () => {
  it("returns 503 when Stripe is not configured", async () => {
    const res = await POST(fakeReq({ amount: 500 }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toMatch(/not currently available/i);
  });
});
