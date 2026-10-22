import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * The health endpoint is an uptime-gate contract:
 *   - DB or core env broken        → 503
 *   - AI provider unreachable      → 200 (degraded, informational)
 *
 * Regression under test: an Ollama outage used to page the operator even
 * though every user-facing page still worked.
 */

const dbResult = { error: null as null | { message: string } };
const rateLimitResult = { success: true };

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        limit: async () => dbResult,
      }),
    }),
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => rateLimitResult,
}));

vi.mock("@/lib/utils/client-ip", () => ({
  getClientIP: () => "127.0.0.1",
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const ORIGINAL_ENV = { ...process.env };

function request() {
  return new NextRequest(new Request("http://localhost/api/health"));
}

beforeEach(() => {
  vi.resetModules();
  dbResult.error = null;
  rateLimitResult.success = true;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.OLLAMA_CLOUD_API_KEY = "test-ollama-key";
  process.env.OLLAMA_CLOUD_URL = "https://ollama.test/v1";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("GET /api/health gating", () => {
  it("returns 200 when Ollama is unreachable but the DB is healthy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED"))
    );

    const { GET } = await import("../health/route");
    const res = await GET(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("healthy");
    // Public shape is unchanged and still hides the per-service detail.
    expect(Object.keys(body).sort()).toEqual(
      ["status", "timestamp", "version"].sort()
    );
    expect(body.checks).toBeUndefined();
    expect(res.headers.get("cache-control")).toContain("no-store");
  }, 20_000);

  it("returns 200 when Ollama answers non-OK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("upstream down", { status: 502 }))
    );

    const { GET } = await import("../health/route");
    const res = await GET(request());

    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("healthy");
  });

  it("returns 503 when the database query fails", async () => {
    dbResult.error = { message: "connection refused" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));

    const { GET } = await import("../health/route");
    const res = await GET(request());

    expect(res.status).toBe(503);
    expect((await res.json()).status).toBe("unhealthy");
  });

  it("returns 503 when core Supabase env is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));

    const { GET } = await import("../health/route");
    const res = await GET(request());

    expect(res.status).toBe(503);
  });

  it("probes the AI provider at most once per cache window", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error("connect ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("../health/route");
    await GET(request());
    await GET(request());
    await GET(request());

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns 429 with no-store when rate limited", async () => {
    rateLimitResult.success = false;

    const { GET } = await import("../health/route");
    const res = await GET(request());

    expect(res.status).toBe(429);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
