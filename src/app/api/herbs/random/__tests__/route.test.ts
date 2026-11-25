import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { rateLimitMock, createClientMock, loggerErrorMock } = vi.hoisted(() => ({
  rateLimitMock: vi.fn(),
  createClientMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: rateLimitMock,
  rateLimitKey: (route: string, ip: string) => `${route}:${ip}`,
}));

vi.mock("@/lib/utils/client-ip", () => ({
  getClientIP: () => "test-ip",
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: loggerErrorMock },
}));

import { GET } from "../route";

describe("GET /api/herbs/random", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMock.mockResolvedValue({ success: true, remaining: 19 });
  });

  it("returns a random herb slug with Cache-Control: no-store", async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: { slug: "turmeric" },
      error: null,
    });
    const orderMock = vi.fn(() => ({
      range: vi.fn(() => ({
        limit: vi.fn(() => ({ single: singleMock })),
      })),
    }));

    createClientMock.mockResolvedValue({
      from: () => ({
        select: (_cols: string, opts?: { head?: boolean }) => {
          if (opts?.head) {
            return {
              eq: vi.fn().mockResolvedValue({ count: 10, error: null }),
            };
          }
          return {
            eq: vi.fn(() => ({ order: orderMock })),
          };
        },
      }),
    });

    const res = await GET(
      new NextRequest("https://herbally.app/api/herbs/random")
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ slug: "turmeric" });
    expect(orderMock).toHaveBeenCalledWith("id", { ascending: true });
  });

  it("returns 404 when no published herbs exist", async () => {
    createClientMock.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
        }),
      }),
    });

    const res = await GET(
      new NextRequest("https://herbally.app/api/herbs/random")
    );
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 503 when count query fails", async () => {
    createClientMock.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: vi.fn().mockResolvedValue({
            count: null,
            error: { message: "connection timeout" },
          }),
        }),
      }),
    });

    const res = await GET(
      new NextRequest("https://herbally.app/api/herbs/random")
    );
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(loggerErrorMock).toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    rateLimitMock.mockResolvedValueOnce({ success: false, remaining: 0 });
    const res = await GET(
      new NextRequest("https://herbally.app/api/herbs/random")
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
