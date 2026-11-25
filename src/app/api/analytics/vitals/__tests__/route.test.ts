import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const rateLimitMock = vi.fn();
const insertMock = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
  rateLimitKey: (route: string, ip: string) => `${route}:${ip}`,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (rows: unknown) => insertMock(rows),
    }),
  }),
}));

import { POST } from "../route";

function makeReq(body: unknown): NextRequest {
  return new Request("https://herbally.app/api/analytics/vitals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/analytics/vitals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://api.herbally.app";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    rateLimitMock.mockResolvedValue({ success: true, remaining: 59 });
    insertMock.mockResolvedValue({ error: null });
  });

  it("returns 429 with Cache-Control: no-store when rate limited", async () => {
    rateLimitMock.mockResolvedValueOnce({ success: false, remaining: 0 });
    const res = await POST(makeReq({ metrics: [] }));
    expect(res.status).toBe(429);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects out-of-range timestamps and non-relative pathnames with 400", async () => {
    const res = await POST(
      makeReq({
        metrics: [
          {
            name: "LCP",
            value: 1200,
            rating: "good",
            delta: 1200,
            id: "v1-1",
            pathname: "https://evil.com/phish",
            timestamp: Date.now() - 7 * 86_400_000,
          },
        ],
      })
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects oversized payloads > 10KB with 413", async () => {
    const res = await POST(
      makeReq({
        metrics: [
          {
            name: "LCP",
            value: 1200,
            rating: "good",
            delta: 1200,
            id: "x".repeat(11 * 1024),
            pathname: "/",
            timestamp: Date.now(),
          },
        ],
      })
    );
    expect(res.status).toBe(413);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("inserts valid web vitals batch and returns 200 with Cache-Control: no-store", async () => {
    const ts = Date.now();
    const res = await POST(
      makeReq({
        metrics: [
          {
            name: "LCP",
            value: 950,
            rating: "good",
            delta: 950,
            id: "v4-1",
            pathname: "/herbs/turmeric",
            timestamp: ts,
          },
        ],
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ success: true });
    expect(insertMock).toHaveBeenCalledTimes(1);
  });
});
