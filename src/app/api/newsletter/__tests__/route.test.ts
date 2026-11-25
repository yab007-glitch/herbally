import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const subscribeMock = vi.fn();

vi.mock("@/lib/newsletter/subscribe", () => ({
  subscribe: (args: unknown) => subscribeMock(args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ success: true, remaining: 4 }),
  rateLimitKey: (route: string, ip: string) => `${route}:${ip}`,
}));

import { POST } from "../route";

describe("POST /api/newsletter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns uniform {ok:true, status:'accepted'} without leaking subscription state", async () => {
    subscribeMock.mockResolvedValueOnce({ ok: true, status: "accepted" });
    const req = new Request("https://herbally.app/api/newsletter", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", locale: "en" }),
    }) as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: "accepted" });
  });

  it("rejects oversized body > 4KB with 413", async () => {
    const req = new Request("https://herbally.app/api/newsletter", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "user@example.com",
        locale: "en",
        sourcePath: "x".repeat(5000),
      }),
    }) as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(413);
  });
});
