import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit } from "./rate-limit";

// Force the in-memory backend. With UPSTASH_* set in .env.local the limiter talks
// to a real Redis, so counters survive between test runs and the "over the limit"
// case starts from a non-zero count. The unit under test here is the window logic,
// not Redis.
beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
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
