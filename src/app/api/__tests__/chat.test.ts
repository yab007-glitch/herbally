import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Unit tests for /api/chat. We stub:
 *   - `fetch` to control Ollama Cloud responses per-model
 *   - `rateLimit` to control rate-limit behavior
 *   - env vars for OLLAMA_CLOUD_API_KEY, OLLAMA_CLOUD_MODEL
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
// The cache is server-only data: reads AND writes must go through the
// service-role client. The anon client is kept mockable so the cache suites can
// prove the route never reaches for it.
const getAnonClientMock = vi.fn().mockReturnValue(null);
vi.mock("@/lib/supabase/anonymous", () => ({
  getAnonClient: (...args: unknown[]) => getAnonClientMock(...args),
}));

// Defaults to throwing (service key not configured) so the ordinary suites
// exercise the cache-miss path without touching a database; cache-specific
// suites swap in a real (fake) client or a never-settling one.
const createAdminClientMock = vi.fn().mockImplementation(() => {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin operations");
});
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => createAdminClientMock(...args),
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

/**
 * A Supabase-like client whose query builder NEVER settles.
 *
 * This reproduces the 2026-10-08 production outage: the instance accepted
 * requests (a bad API key was rejected at the edge in ~60ms) but no response
 * ever came back, so every query hung. supabase-js configures no request
 * timeout, so `await` waited forever. A thenable whose `then` never calls back
 * mirrors that exactly — it neither resolves nor rejects.
 */
function hangingClient() {
  const query: Record<string, unknown> = {};
  const chain = () => query;
  for (const method of [
    "from",
    "select",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "or",
    "and",
    "ilike",
    "like",
    "is",
    "in",
    "not",
    "limit",
    "order",
    "range",
    "single",
    "maybeSingle",
    "insert",
    "update",
    "upsert",
    "delete",
    "match",
    "filter",
    "contains",
    "textSearch",
    "returns",
  ]) {
    query[method] = chain;
  }
  query.then = () => new Promise(() => {});
  return query;
}

beforeEach(() => {
  process.env.OLLAMA_CLOUD_API_KEY = "test-key";
  delete process.env.OLLAMA_CLOUD_MODEL;
  delete process.env.OLLAMA_CLOUD_URL;
  fetchMock.mockReset();
  rateLimitMock.mockReset();
  getAnonClientMock.mockReset();
  getAnonClientMock.mockReturnValue(null);
  createAdminClientMock.mockReset();
  createAdminClientMock.mockImplementation(() => {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for admin operations"
    );
  });
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
  it("returns 503 when OLLAMA_CLOUD_API_KEY is missing", async () => {
    delete process.env.OLLAMA_CLOUD_API_KEY;
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
    expect(firstBody.model).toBe("deepseek-v4.1-flash");
    // The reasoning model must run with reasoning disabled or it returns
    // empty content (see ollama-cloud-client.ts).
    expect(firstBody.reasoning_effort).toBe("none");
    // Second call falls back to the first non-primary model in FALLBACK_MODELS.
    const secondBody = JSON.parse(
      (fetchMock.mock.calls[1][1] as RequestInit).body as string
    );
    expect(secondBody.model).not.toBe("deepseek-v4.1-flash");
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

  it("strips unknown / untrusted body fields before forwarding upstream", async () => {
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
    // The route only forwards `model`, `messages`, `stream`, `max_tokens`,
    // `temperature`, `reasoning_effort`.
    expect(body.model).toBe("deepseek-v4.1-flash");
    expect(body.messages).toHaveLength(2); // system + user
    expect(body.rogue).toBeUndefined();
  });
});

/**
 * Regression for the 2026-10-08 outage: Supabase accepted requests but never
 * answered. The route's DB calls had no timeout, so those awaits never
 * settled — the `try/catch` fallbacks around them never ran (a hang is not an
 * exception) and the route rode Vercel's maxDuration into a 504 without ever
 * calling the model. Chat stayed dead for as long as the database did.
 */
describe("POST /api/chat — hung database", () => {
  beforeEach(() => {
    // Keep the bound small so the test stays fast; production default is 3000ms.
    process.env.CHAT_DB_TIMEOUT_MS = "30";
  });

  it("still answers from the model when Supabase never responds", async () => {
    createAdminClientMock.mockReturnValue(hangingClient());
    fetchMock.mockResolvedValue(streamResponse());

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ messages: [{ role: "user", content: "hi" }] })
    );

    // The cache lookup is attempted through the service-role client, then the
    // request completes instead of hanging and the model is reached.
    expect(createAdminClientMock).toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(ReadableStream);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stays bounded rather than stalling on the unbounded await", async () => {
    createAdminClientMock.mockReturnValue(hangingClient());
    fetchMock.mockResolvedValue(streamResponse());

    const started = Date.now();
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ messages: [{ role: "user", content: "hi" }] })
    );
    await res.text();

    expect(res.status).toBe(200);
    // Two bounded awaits (context fetch + cache lookup) at 30ms each. Loose
    // enough not to flake on a slow CI box, tight enough to fail if either
    // await is left unbounded.
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("still serves a cache hit when the database is healthy", async () => {
    // Guards the opposite direction — bounding the lookup must not break the
    // normal cache path.
    createAdminClientMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            gt: () => ({
              single: () =>
                Promise.resolve({
                  data: { response: "A cached answer, long enough to serve." },
                  error: null,
                }),
            }),
          }),
        }),
      }),
    });
    fetchMock.mockResolvedValue(streamResponse());

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ messages: [{ role: "user", content: "hi" }] })
    );

    expect(res.status).toBe(200);
    expect((await res.text()).length).toBeGreaterThan(0);
    // Served from cache — the model was never called.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/**
 * ai_response_cache holds shared, prompt-hash-keyed answers. Once the public
 * SELECT policy is removed, an anon/authenticated read fails; cache access must
 * therefore use the service-role client only. Both directions matter: a read
 * must succeed with the admin client, and an unavailable service key must
 * degrade to a cache MISS (live generation), never to an error.
 */
describe("POST /api/chat — service-role-only cache access", () => {
  function cacheHitClient(response: string) {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            gt: () => ({
              single: () =>
                Promise.resolve({ data: { response }, error: null }),
            }),
          }),
        }),
      }),
    };
  }

  it("reads the cache with the service-role client, never the anon client", async () => {
    createAdminClientMock.mockReturnValue(
      cacheHitClient("A cached answer from the service-role client.")
    );
    fetchMock.mockResolvedValue(streamResponse());

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ messages: [{ role: "user", content: "hi" }] })
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(
      "A cached answer from the service-role client."
    );
    expect(createAdminClientMock).toHaveBeenCalled();
    // The context fetcher may independently use the anonymous client for public
    // herb data; it is mocked to null here and cannot access the response cache.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("writes a long generated response via the admin client and serves the next identical request from that cache", async () => {
    const answer =
      "Peppermint is an aromatic plant traditionally used in teas and other preparations.";
    let stored: {
      prompt_hash: string;
      response: string;
      expires_at: string;
    } | null = null;
    const insert = vi.fn(async (row: typeof stored) => {
      stored = row;
      return { error: null };
    });
    const from = vi.fn((table: string) => {
      expect(table).toBe("ai_response_cache");
      return {
        select: () => ({
          eq: () => ({
            gt: () => ({ single: async () => ({ data: stored, error: null }) }),
          }),
        }),
        insert,
      };
    });
    createAdminClientMock.mockReturnValue({ from });
    fetchMock.mockResolvedValue(
      new Response(
        `data: ${JSON.stringify({ choices: [{ delta: { content: answer } }] })}\n\ndata: [DONE]\n\n`,
        { status: 200, headers: { "content-type": "text/event-stream" } }
      )
    );
    const { POST } = await loadRoute();
    const body = {
      messages: [{ role: "user", content: "What is peppermint?" }],
    };
    const first = await POST(makeRequest(body));
    expect(await first.text()).toBe(answer);
    expect(insert).toHaveBeenCalledOnce();
    expect(insert.mock.calls[0][0]).toMatchObject({ response: answer });
    const second = await POST(makeRequest(body));
    expect(await second.text()).toBe(answer);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(from).toHaveBeenCalledWith("ai_response_cache");
  });

  it("returns the live answer when the admin cache write fails", async () => {
    const answer =
      "Peppermint is an aromatic plant traditionally used in teas and other preparations.";
    const insert = vi
      .fn()
      .mockRejectedValue(new Error("synthetic write failure"));
    createAdminClientMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            gt: () => ({ single: async () => ({ data: null, error: null }) }),
          }),
        }),
        insert,
      }),
    });
    fetchMock.mockResolvedValue(
      new Response(
        `data: ${JSON.stringify({ choices: [{ delta: { content: answer } }] })}\n\ndata: [DONE]\n\n`,
        { status: 200, headers: { "content-type": "text/event-stream" } }
      )
    );
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        messages: [{ role: "user", content: "What is peppermint?" }],
      })
    );
    expect(await res.text()).toBe(answer);
    expect(insert).toHaveBeenCalledOnce();
  });

  it("treats an unavailable service-role client as a cache miss and answers live", async () => {
    fetchMock.mockResolvedValue(streamResponse());

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ messages: [{ role: "user", content: "hi" }] })
    );

    // createAdminClient() throws when SUPABASE_SERVICE_ROLE_KEY is absent.
    // That must be swallowed as a miss rather than failing the chat request.
    expect(createAdminClientMock).toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(ReadableStream);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
