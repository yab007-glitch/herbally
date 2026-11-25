import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const rateLimitMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
  rateLimitKey: (route: string, ip: string) => `${route}:${ip}`,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: (...args: unknown[]) => rpcMock(...args),
  }),
}));

import { POST } from "../route";

function makeReq(body: unknown): NextRequest {
  return new Request("https://herbally.app/api/herbs/view", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/herbs/view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMock.mockResolvedValue({ success: true, remaining: 29 });
    rpcMock.mockResolvedValue({ error: null });
  });

  it("returns 429 with Cache-Control: no-store when rate limited", async () => {
    rateLimitMock.mockResolvedValueOnce({ success: false, remaining: 0 });
    const res = await POST(makeReq({ slug: "ginger" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 413 for oversized body and 400 for invalid slug characters", async () => {
    const bigRes = await POST(makeReq({ slug: "a".repeat(3000) }));
    expect(bigRes.status).toBe(413);
    expect(bigRes.headers.get("cache-control")).toBe("no-store");

    const badRes = await POST(makeReq({ slug: "Ginger/../../" }));
    expect(badRes.status).toBe(400);
    expect(badRes.headers.get("cache-control")).toBe("no-store");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("records view and returns 204 with Cache-Control: no-store", async () => {
    const res = await POST(makeReq({ slug: "st-johns-wort" }));
    expect(res.status).toBe(204);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(rpcMock).toHaveBeenCalledWith("increment_herb_view_by_slug", {
      p_slug: "st-johns-wort",
    });
  });

  it("degrades silently to 204 even when the view RPC errors", async () => {
    rpcMock.mockResolvedValueOnce({ error: { message: "db error" } });
    const res = await POST(makeReq({ slug: "ginger" }));
    expect(res.status).toBe(204);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
