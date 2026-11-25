import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("fetch-with-timeout & boundedFetch circuit breaker", () => {
  const originalEnv = process.env.SUPABASE_FETCH_TIMEOUT_MS;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    delete process.env.SUPABASE_FETCH_TIMEOUT_MS;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    if (originalEnv === undefined) {
      delete process.env.SUPABASE_FETCH_TIMEOUT_MS;
    } else {
      process.env.SUPABASE_FETCH_TIMEOUT_MS = originalEnv;
    }
  });

  it("reads default or env override timeout and rejects invalid env values", async () => {
    const mod = await import("../fetch-with-timeout");
    expect(mod.getSupabaseFetchTimeoutMs()).toBe(
      mod.DEFAULT_SUPABASE_FETCH_TIMEOUT_MS
    );

    process.env.SUPABASE_FETCH_TIMEOUT_MS = "4500";
    expect(mod.getSupabaseFetchTimeoutMs()).toBe(4500);

    process.env.SUPABASE_FETCH_TIMEOUT_MS = "-5";
    expect(mod.getSupabaseFetchTimeoutMs()).toBe(
      mod.DEFAULT_SUPABASE_FETCH_TIMEOUT_MS
    );
  });

  it("opens the circuit breaker after 3 fetch timeouts and closes again after 30s on success", async () => {
    process.env.SUPABASE_FETCH_TIMEOUT_MS = "50";
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Timed out", "TimeoutError"));
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { boundedFetch } = await import("../fetch-with-timeout");

    // Trigger 3 consecutive request timeouts
    for (let i = 0; i < 3; i++) {
      const p = boundedFetch("https://api.herbally.app/rest/v1/herbs");
      const expectation = expect(p).rejects.toThrow(/Timed out/);
      await vi.advanceTimersByTimeAsync(60);
      await expectation;
    }

    // Circuit breaker is now open: calls reject immediately without calling fetch
    const callsBefore = fetchMock.mock.calls.length;
    await expect(
      boundedFetch("https://api.herbally.app/rest/v1/herbs")
    ).rejects.toThrow("Supabase circuit breaker is open");
    expect(fetchMock.mock.calls.length).toBe(callsBefore);

    // After 30s cooldown, requests pass through again and a success closes it
    await vi.advanceTimersByTimeAsync(30_000);
    fetchMock.mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const okRes = await boundedFetch("https://api.herbally.app/rest/v1/herbs");
    expect(okRes.status).toBe(200);
  });

  it("preserves caller-initiated AbortSignal without tripping the timeout breaker", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Caller aborted", "AbortError"));
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { boundedFetch } = await import("../fetch-with-timeout");

    for (let i = 0; i < 4; i++) {
      const caller = new AbortController();
      const p = boundedFetch("https://api.herbally.app/rest/v1/herbs", {
        signal: caller.signal,
      });
      caller.abort();
      await expect(p).rejects.toThrow(/Caller aborted/);
    }

    // Breaker must still be closed because none were timeouts
    fetchMock.mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const res = await boundedFetch("https://api.herbally.app/rest/v1/herbs");
    expect(res.status).toBe(200);
  });
});
