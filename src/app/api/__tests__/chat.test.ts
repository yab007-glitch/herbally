import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Unit tests for /api/chat. We stub:
 *   - `fetch` to control OpenRouter responses per-model
 *   - `rateLimit` to control rate-limit behavior
 *   - env vars for OPENROUTER_API_KEY, OPENROUTER_MODEL
 *
 * Goal: cover the error paths (auth, rate limit, body size, fallback chain,
 * streaming) without making real network calls.
 */

// Mocks must be declared before importing the route handler.
const fetchMock = vi
  .fn()
  .mockResolvedValue(new Response("{}", { status: 200 }));
vi.stubGlobal("fetch", fetchMock);

const rateLimitMock = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
}));
vi.mock("@/lib/supabase/anonymous", () => ({
  getAnonClient: vi.fn().mockReturnValue(null),
}));

async function loadRoute() {
  vi.resetModules();
  const mod = await import("../chat/route");
  return mod;
}

function makeRequest(
  body: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  const init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
  } = {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new NextRequest("http://localhost/api/chat", init);
}

function streamResponse(): Response {
  const enc = new TextEncoder();
  const response = new Response(null, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
  // Override body to allow multiple reads for testing
  Object.defineProperty(response, "body", {
    get: () =>
      new ReadableStream({
        start(controller) {
          controller.enqueue(
            enc.encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n')
          );
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
          controller.close();
        },
      }),
    configurable: true,
  });
  return response;
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.OPENROUTER_MODEL = "openrouter/free";
  delete process.env.OPENROUTER_BASE_URL;
  fetchMock.mockReset();
  rateLimitMock.mockReset();
  rateLimitMock.mockResolvedValue({
    success: true,
    limit: 20,
    remaining: 19,
    reset: 0,
  });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.clearAllMocks();
});

describe("POST /api/chat — error paths", () => {
  it("returns 503 when OPENROUTER_API_KEY is missing", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ messages: [{ role: "user", content: "hi" }] })
    );
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toMatch(/not configured/i);
  });

  it("returns 413 for oversized bodies", async () => {
    const { POST } = await loadRoute();
    const big = "x".repeat(60 * 1024);
    const res = await POST(
      makeRequest(
        { messages: [{ role: "user", content: big }] },
        { "content-length": String(60 * 1024) }
      )
    );
    expect(res.status).toBe(413);
  });

  it("returns 400 when the messages array is missing", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ herbContext: "x" }));
    expect(res.status).toBe(400);
  });
});
describe("POST /api/chat — model fallback chain", () => {
  it("falls back to the next model when primary 5xxs, then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("upstream busy", { status: 503 }))
      .mockResolvedValueOnce(streamResponse());

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ messages: [{ role: "user", content: "hi" }] })
    );
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // First call is to the configured primary.
    const firstBody = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string
    );
    expect(firstBody.model).toBe("openrouter/free");
    // Second call falls back to the first non-primary model in FALLBACK_MODELS.
    const secondBody = JSON.parse(
      (fetchMock.mock.calls[1][1] as RequestInit).body as string
    );
    expect(secondBody.model).not.toBe("openrouter/free");
  });

  it("falls back on 404 (model not found)", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(streamResponse());

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ messages: [{ role: "user", content: "hi" }] })
    );
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT fall back on 401 (auth error is the same key)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("bad key", { status: 401 }));

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ messages: [{ role: "user", content: "hi" }] })
    );
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/not configured/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT fall back on 429 (same key, would just retry and hit limit again)", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("rate limit", { status: 429 })
    );

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ messages: [{ role: "user", content: "hi" }] })
    );
    expect(res.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/chat — happy path", () => {
  it("streams back the assistant delta from the upstream response", async () => {
    fetchMock.mockResolvedValue(streamResponse());

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        messages: [{ role: "user", content: "hello" }],
        herbContext: "ginger is a root",
        medications: ["warfarin"],
        locale: "en",
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/text\/plain/);
    expect(res.body).toBeInstanceOf(ReadableStream);
  });

  it("strips unknown / untrusted body fields before forwarding to OpenRouter", async () => {
    fetchMock.mockResolvedValueOnce(streamResponse());

    const { POST } = await loadRoute();
    await POST(
      makeRequest({
        messages: [{ role: "user", content: "hi" }],
        rogue: "should not propagate",
      } as unknown as { messages: Array<{ role: string; content: string }> })
    );
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string
    );
    // The route only forwards `model`, `messages`, `stream`, `max_tokens`, `temperature`.
    expect(body.model).toBe("openrouter/free");
    expect(body.messages).toHaveLength(2); // system + user
    expect(body.rogue).toBeUndefined();
    expect(body.rogue).toBeUndefined();
  });
});
