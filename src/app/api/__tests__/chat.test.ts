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

// The real safety guard is used by every suite. This wrapper only allows one
// test to force it to throw, proving the route fails closed (localized refusal)
// instead of delivering unguarded model text when the guard itself breaks.
const guardFailure = vi.hoisted(() => ({ enabled: false }));
vi.mock("@/lib/chat/safety-guard", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/chat/safety-guard")>();
  return {
    ...actual,
    evaluateAssistantContent: (
      ...args: Parameters<typeof actual.evaluateAssistantContent>
    ) => {
      if (guardFailure.enabled) throw new Error("synthetic guard failure");
      return actual.evaluateAssistantContent(...args);
    },
  };
});

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
  delete process.env.CHAT_STREAM_IDLE_TIMEOUT_MS;
  guardFailure.enabled = false;
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
 * The chat route buffers the whole upstream answer, guards it, and only then
 * sends it. The client cannot see the upstream exchange, so the route is the
 * only place that knows whether an answer actually finished. A stream that
 * errors, idles out, or closes without a completion signal leaves a partial
 * medical answer in hand: it must be labelled incomplete and must never be
 * written to the shared cache, where it would be served later as a finished
 * answer. All prompts below are synthetic and non-sensitive.
 */
describe("POST /api/chat — stream completeness and cache safety", () => {
  type CacheRow = { prompt_hash: string; response: string; expires_at: string };

  function cacheSpy() {
    const rows: CacheRow[] = [];
    const insert = vi.fn(async (row: CacheRow) => {
      rows.push(row);
      return { error: null };
    });
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
    return { insert, rows };
  }

  function sseChunk(content: string, finishReason: string | null = null) {
    return `data: ${JSON.stringify({
      choices: [{ delta: { content }, finish_reason: finishReason }],
    })}\n\n`;
  }

  function bodyStream(
    source: (controller: ReadableStreamDefaultController<Uint8Array>) => void
  ) {
    const response = new Response(null, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
    Object.defineProperty(response, "body", {
      get: () =>
        new ReadableStream<Uint8Array>({
          start(controller) {
            source(controller);
          },
        }),
      configurable: true,
    });
    return response;
  }

  const PARTIAL =
    "Turmeric tea is traditionally used for digestion. Some early research suggests";

  it("labels an answer incomplete and does not cache it when the upstream stream errors mid-answer", async () => {
    const { insert } = cacheSpy();
    fetchMock.mockResolvedValue(
      bodyStream((controller) => {
        controller.enqueue(new TextEncoder().encode(sseChunk(PARTIAL)));
        // The next read fails, exactly like a dropped upstream socket.
        queueMicrotask(() =>
          controller.error(new Error("upstream socket reset"))
        );
      })
    );

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        messages: [{ role: "user", content: "synthetic turmeric question" }],
      })
    );
    const text = await res.text();

    expect(res.status).toBe(200);
    // A truncated answer must never reach the shared cache: this is the exact
    // production defect — the fragment was stored and served as finished.
    expect(insert).not.toHaveBeenCalled();
    expect(res.headers.get("X-HerbAlly-Answer-Status")).toBe("incomplete");
    expect(text).toContain(PARTIAL);
    // The recipient must be told the answer is truncated, not handed a
    // fragment that reads like a finished sentence.
    expect(text).toMatch(/interrupted/i);
  });

  it("does not cache a stream that closes without a completion signal", async () => {
    const { insert } = cacheSpy();
    fetchMock.mockResolvedValue(
      bodyStream((controller) => {
        controller.enqueue(new TextEncoder().encode(sseChunk(PARTIAL)));
        controller.close();
      })
    );

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        messages: [{ role: "user", content: "synthetic turmeric question" }],
      })
    );
    const text = await res.text();

    expect(res.headers.get("X-HerbAlly-Answer-Status")).toBe("incomplete");
    expect(text).toMatch(/interrupted/i);
    expect(insert).not.toHaveBeenCalled();
  });

  it("caches and labels complete only when the upstream sends the [DONE] sentinel", async () => {
    const { insert } = cacheSpy();
    fetchMock.mockResolvedValue(
      bodyStream((controller) => {
        controller.enqueue(new TextEncoder().encode(sseChunk(PARTIAL)));
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      })
    );

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        messages: [{ role: "user", content: "synthetic turmeric question" }],
      })
    );
    const text = await res.text();

    expect(res.headers.get("X-HerbAlly-Answer-Status")).toBe("complete");
    expect(text).toBe(PARTIAL);
    expect(insert).toHaveBeenCalledOnce();
    expect(insert.mock.calls[0][0].response).toBe(PARTIAL);
  });

  it("treats a final finish_reason as completion when no [DONE] sentinel is sent", async () => {
    const { insert } = cacheSpy();
    fetchMock.mockResolvedValue(
      bodyStream((controller) => {
        controller.enqueue(new TextEncoder().encode(sseChunk(PARTIAL, "stop")));
        controller.close();
      })
    );

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        messages: [{ role: "user", content: "synthetic turmeric question" }],
      })
    );
    await res.text();

    expect(res.headers.get("X-HerbAlly-Answer-Status")).toBe("complete");
    expect(insert).toHaveBeenCalledOnce();
  });

  it("does not treat a max_tokens truncation as a complete answer", async () => {
    // finish_reason "length" means the model was cut off mid-answer. The
    // stream itself ended normally, but the answer did not.
    const { insert } = cacheSpy();
    fetchMock.mockResolvedValue(
      bodyStream((controller) => {
        controller.enqueue(
          new TextEncoder().encode(sseChunk(PARTIAL, "length"))
        );
        controller.close();
      })
    );

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        messages: [{ role: "user", content: "synthetic turmeric question" }],
      })
    );
    const text = await res.text();

    expect(res.headers.get("X-HerbAlly-Answer-Status")).toBe("incomplete");
    expect(res.headers.get("X-HerbAlly-Answer-Reason")).toBe(
      "truncated-max-tokens"
    );
    expect(text).toContain(PARTIAL);
    expect(text).toMatch(/interrupted/i);
    expect(insert).not.toHaveBeenCalled();
  });

  it("labels an answer incomplete and skips the cache when the upstream stalls mid-answer", async () => {
    // The socket stays open but goes silent — the idle timeout case that used
    // to end in a normal-looking reply (and a cache write).
    process.env.CHAT_STREAM_IDLE_TIMEOUT_MS = "25";
    const { insert } = cacheSpy();
    fetchMock.mockResolvedValue(
      bodyStream((controller) => {
        controller.enqueue(new TextEncoder().encode(sseChunk(PARTIAL)));
        // Never closes, never sends another chunk.
      })
    );

    const started = Date.now();
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        messages: [{ role: "user", content: "synthetic turmeric question" }],
      })
    );
    const text = await res.text();

    expect(Date.now() - started).toBeLessThan(2000);
    expect(res.headers.get("X-HerbAlly-Answer-Status")).toBe("incomplete");
    expect(res.headers.get("X-HerbAlly-Answer-Reason")).toBe("idle-timeout");
    expect(text).toContain(PARTIAL);
    expect(text).toMatch(/interrupted/i);
    expect(insert).not.toHaveBeenCalled();
  });

  it("fails closed with a 502 when the upstream has no body", async () => {
    const { insert } = cacheSpy();
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        messages: [{ role: "user", content: "synthetic turmeric question" }],
      })
    );

    // A blank 200 used to render as an empty finished answer.
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toMatch(/could not be completed/i);
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns 502 instead of an empty finished answer when the stream carries no content", async () => {
    const { insert } = cacheSpy();
    fetchMock.mockResolvedValue(
      bodyStream((controller) => {
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      })
    );

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        messages: [{ role: "user", content: "synthetic turmeric question" }],
      })
    );

    expect(res.status).toBe(502);
    expect(insert).not.toHaveBeenCalled();
  });

  it("accepts a trailing [DONE] sentinel that arrives without a newline", async () => {
    // Real servers sometimes end the body right after `data: [DONE]`. The old
    // line splitter dropped that last unterminated line and saw a bare close.
    const { insert } = cacheSpy();
    fetchMock.mockResolvedValue(
      bodyStream((controller) => {
        controller.enqueue(
          new TextEncoder().encode(sseChunk(PARTIAL) + "data: [DONE]")
        );
        controller.close();
      })
    );

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        messages: [{ role: "user", content: "synthetic turmeric question" }],
      })
    );
    await res.text();

    expect(res.headers.get("X-HerbAlly-Answer-Status")).toBe("complete");
    expect(insert).toHaveBeenCalledOnce();
  });

  it("labels the interruption in French for a French session", async () => {
    // Synthetic, non-sensitive prompt; the upstream drops mid-answer.
    cacheSpy();
    fetchMock.mockResolvedValue(
      bodyStream((controller) => {
        controller.enqueue(new TextEncoder().encode(sseChunk(PARTIAL)));
        controller.close();
      })
    );

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        messages: [
          { role: "user", content: "question synthétique sur le curcuma" },
        ],
        locale: "fr",
      })
    );
    const text = await res.text();

    expect(res.headers.get("X-HerbAlly-Answer-Status")).toBe("incomplete");
    expect(text).toMatch(/interrompue/i);
  });

  it("still applies the safety guard to an interrupted answer", async () => {
    // A partial answer must not escape the guard just because it never
    // finished. The unsafe line is synthetic and the response must not carry
    // it to the user (or the cache) either way.
    const { insert } = cacheSpy();
    fetchMock.mockResolvedValue(
      bodyStream((controller) => {
        controller.enqueue(
          new TextEncoder().encode(
            sseChunk("You should stop taking your warfarin immediately.")
          )
        );
        // Socket closes with no completion signal: the answer is truncated.
        controller.close();
      })
    );

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        messages: [{ role: "user", content: "synthetic warfarin question" }],
      })
    );
    const text = await res.text();

    expect(res.headers.get("X-HerbAlly-Answer-Status")).toBe("blocked");
    expect(text).not.toMatch(/stop taking your warfarin/i);
    expect(text).toMatch(/can't responsibly answer/i);
    expect(insert).not.toHaveBeenCalled();
  });

  it("fails closed to the localized refusal when the safety guard throws", async () => {
    // A broken guard must never become a bypass: the model text is discarded.
    const { insert } = cacheSpy();
    guardFailure.enabled = true;
    fetchMock.mockResolvedValue(
      bodyStream((controller) => {
        controller.enqueue(new TextEncoder().encode(sseChunk(PARTIAL)));
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      })
    );

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        messages: [{ role: "user", content: "synthetic turmeric question" }],
      })
    );
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("X-HerbAlly-Answer-Status")).toBe("blocked");
    expect(text).toMatch(/can't responsibly answer/i);
    expect(text).not.toContain(PARTIAL);
    expect(insert).not.toHaveBeenCalled();
  });

  it("labels a cache hit as complete and never calls the model", async () => {
    const cached =
      "A synthetic cached answer that was proven complete when it was written.";
    createAdminClientMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            gt: () => ({
              single: async () => ({ data: { response: cached }, error: null }),
            }),
          }),
        }),
      }),
    });
    fetchMock.mockResolvedValue(streamResponse());

    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({
        messages: [{ role: "user", content: "synthetic peppermint question" }],
      })
    );

    expect(await res.text()).toBe(cached);
    expect(res.headers.get("X-HerbAlly-Answer-Status")).toBe("complete");
    expect(res.headers.get("X-HerbAlly-Answer-Reason")).toBe("cache");
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
