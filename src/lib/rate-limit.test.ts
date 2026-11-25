import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rateLimit, rateLimitKey, hashRateLimitKey } from "./rate-limit";

beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.RATE_LIMIT_BACKEND;
  delete process.env.RATE_LIMIT_HASH_SECRET;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("rate limiting", () => {
  it("allows requests under the limit", async () => {
    const ip = "127.0.0.1";
    for (let i = 0; i < 5; i++) {
      const result = await rateLimit(ip, 10, 60_000);
      expect(result.success).toBe(true);
    }
  });

  it("blocks requests over the limit", async () => {
    const ip = "127.0.0.2";
    for (let i = 0; i < 10; i++) {
      await rateLimit(ip, 10, 60_000);
    }
    const result = await rateLimit(ip, 10, 60_000);
    expect(result.success).toBe(false);
  });
});

describe("route scoping", () => {
  it("keeps one route's traffic out of another route's bucket", async () => {
    const ip = "198.51.100.7";
    for (let i = 0; i < 5; i++) {
      await rateLimit(rateLimitKey("interactions-check", ip), 5, 60_000);
    }
    const blocked = await rateLimit(
      rateLimitKey("interactions-check", ip),
      5,
      60_000
    );
    expect(blocked.success).toBe(false);

    const other = await rateLimit(rateLimitKey("health", ip), 30, 60_000);
    expect(other.success).toBe(true);
  });
});

describe("upstash backend", () => {
  it("hashes client IPs with HMAC, uses atomic EVAL with AbortSignal, and blocks when Lua returns [0, 0]", async () => {
    process.env.RATE_LIMIT_BACKEND = "upstash";
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    process.env.RATE_LIMIT_HASH_SECRET = "test-hmac-secret";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: [0, 0] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const rawIp = "203.0.113.9";
    const key = rateLimitKey("chat", rawIp);
    const result = await rateLimit(key, 10, 60_000);

    expect(result).toEqual({ success: false, remaining: 0 });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.upstash.io");
    expect(init.signal).toBeDefined();

    const bodyText = String(init.body);
    // Literal IP must never be sent to Redis
    expect(bodyText).not.toContain(rawIp);
    const parsedCmd = JSON.parse(bodyText) as unknown[];
    expect(parsedCmd[0]).toBe("EVAL");
    expect(parsedCmd[3]).toBe(`ratelimit:v1:${hashRateLimitKey(key)}`);
  });

  it("falls back to memory limiter on Upstash timeout/error", async () => {
    process.env.RATE_LIMIT_BACKEND = "upstash";
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    process.env.RATE_LIMIT_HASH_SECRET = "test-hmac-secret";

    const fetchMock = vi
      .fn()
      .mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await rateLimit("198.51.100.88", 5, 60_000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("refuses public HMAC fallback when no server secret is configured", async () => {
    expect(() => hashRateLimitKey("chat:203.0.113.10")).toThrow(
      /secret is not configured/i
    );

    process.env.RATE_LIMIT_BACKEND = "upstash";
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await rateLimit("chat:203.0.113.10", 5, 60_000);
    expect(res.success).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("memory limiter mixed-window cleanup", () => {
  it("preserves 15-minute keys when an unrelated 60-second route triggers cleanup", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-01T12:00:00.000Z"));

    const longKey = "newsletter-window:203.0.113.55";
    const shortKey = "health-window:203.0.113.99";

    expect((await rateLimit(longKey, 2, 15 * 60_000)).success).toBe(true);
    expect((await rateLimit(longKey, 2, 15 * 60_000)).success).toBe(true);
    expect((await rateLimit(longKey, 2, 15 * 60_000)).success).toBe(false);

    // Advance 90s (> CLEANUP_INTERVAL and > 60s short window, < 15m long window)
    vi.advanceTimersByTime(90_000);

    // Trigger cleanup via an unrelated 60-second route
    expect((await rateLimit(shortKey, 5, 60_000)).success).toBe(true);

    // 15-minute key must STILL be blocked!
    expect((await rateLimit(longKey, 2, 15 * 60_000)).success).toBe(false);

    // Advance past the 15-minute window -> allowed again
    vi.advanceTimersByTime(14 * 60_000);
    expect((await rateLimit(longKey, 2, 15 * 60_000)).success).toBe(true);
  });
});
