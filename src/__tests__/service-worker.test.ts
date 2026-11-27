import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";

function loadServiceWorker(fetchImpl: (req: Request) => Promise<Response>) {
  const swSource = fs.readFileSync(
    path.resolve(process.cwd(), "public/sw.js"),
    "utf-8"
  );

  const cacheStore = new Map<string, Map<string, Response>>();
  const ensureCache = (name: string) => {
    let c = cacheStore.get(name);
    if (!c) {
      c = new Map();
      cacheStore.set(name, c);
    }
    return c;
  };

  const cachesMock = {
    open: vi.fn(async (name: string) => {
      const store = ensureCache(name);
      return {
        addAll: vi.fn(async () => {}),
        put: vi.fn(async (req: Request | string, res: Response) => {
          const key = typeof req === "string" ? req : req.url;
          store.set(key, res);
        }),
        match: vi.fn(async (req: Request | string) => {
          const key = typeof req === "string" ? req : req.url;
          return store.get(key);
        }),
      };
    }),
    match: vi.fn(async (req: Request | string) => {
      const key = typeof req === "string" ? req : req.url;
      for (const store of cacheStore.values()) {
        if (store.has(key)) return store.get(key);
      }
      return undefined;
    }),
    keys: vi.fn(async () => [...cacheStore.keys()]),
    delete: vi.fn(async (name: string) => cacheStore.delete(name)),
  };

  const listeners: Record<string, Array<(e: unknown) => void>> = {};
  const selfMock = {
    location: { origin: "https://herbally.app" },
    addEventListener: (type: string, cb: (e: unknown) => void) => {
      listeners[type] = listeners[type] ?? [];
      listeners[type].push(cb);
    },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
  };

  vm.runInNewContext(swSource, {
    self: selfMock,
    caches: cachesMock,
    fetch: fetchImpl,
    URL,
    Response,
    Request,
    Headers,
    Promise,
    Set,
  });

  async function dispatchFetch(
    url: string,
    opts?: { method?: string; mode?: string; headers?: Record<string, string> }
  ): Promise<{ intercepted: boolean; response?: Response }> {
    const req = new Request(url, {
      method: opts?.method ?? "GET",
      headers: opts?.headers,
    });
    if (opts?.mode) {
      Object.defineProperty(req, "mode", { value: opts.mode });
    }
    let respondedWith: Promise<Response> | null = null;
    const event = {
      request: req,
      respondWith: (p: Promise<Response> | Response) => {
        respondedWith = Promise.resolve(p);
      },
    };
    for (const cb of listeners.fetch ?? []) cb(event);
    if (!respondedWith) return { intercepted: false };
    return { intercepted: true, response: await respondedWith };
  }

  async function dispatchMessage(data: unknown): Promise<unknown> {
    let reply: unknown;
    const port = {
      postMessage: (msg: unknown) => {
        reply = msg;
      },
    };
    let waited: Promise<unknown> = Promise.resolve();
    const event = {
      data,
      ports: [port],
      waitUntil: (p: Promise<unknown>) => {
        waited = p;
      },
    };
    for (const cb of listeners.message ?? []) cb(event);
    await waited;
    return reply;
  }

  return { cacheStore, cachesMock, dispatchFetch, dispatchMessage };
}

describe("public/sw.js security and offline honesty", () => {
  it("never intercepts or caches private routes or non-allowlisted APIs", async () => {
    const fetchMock = vi.fn(
      async () => new Response('{"secret":1}', { status: 200 })
    );
    const sw = loadServiceWorker(fetchMock);

    for (const privateUrl of [
      "https://herbally.app/api/garden",
      "https://herbally.app/api/admin/stats",
      "https://herbally.app/admin",
      "https://herbally.app/fr/admin/herbs",
      "https://herbally.app/profile",
      "https://herbally.app/garden",
      "https://herbally.app/fr/garden",
      "https://herbally.app/auth/callback",
      "https://herbally.app/login",
    ]) {
      const res = await sw.dispatchFetch(privateUrl);
      expect(res.intercepted, privateUrl).toBe(false);
    }

    expect(sw.cacheStore.size).toBe(0);
  });

  it("returns HTTP 503 JSON on offline miss for allowlisted API instead of HTTP 200 []", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("Network offline");
    });
    const sw = loadServiceWorker(fetchMock);

    const res = await sw.dispatchFetch(
      "https://herbally.app/api/herbs/search?q=ginger"
    );
    expect(res.intercepted).toBe(true);
    expect(res.response?.status).toBe(503);
    const body = await res.response?.json();
    expect(body.offline).toBe(true);
    expect(body.unavailable).toBe(true);
  });

  it("refuses to cache responses marked private, no-store, or carrying Set-Cookie", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("<html>public-url-but-private</html>", {
          status: 200,
          headers: { "Cache-Control": "private, no-store" },
        })
    );
    const sw = loadServiceWorker(fetchMock);

    await sw.dispatchFetch("https://herbally.app/herbs/ginger");
    // Allow async cache checks to settle
    await new Promise((r) => setTimeout(r, 0));

    for (const store of sw.cacheStore.values()) {
      expect(store.size).toBe(0);
    }
  });

  it("clears all caches when receiving CLEAR_CACHES message", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('{"results":[]}', {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
    );
    const sw = loadServiceWorker(fetchMock);

    await sw.dispatchFetch("https://herbally.app/api/herbs/search?q=ginger");
    await new Promise((r) => setTimeout(r, 0));
    expect(sw.cacheStore.size).toBeGreaterThan(0);

    const reply = await sw.dispatchMessage({ type: "CLEAR_CACHES" });
    expect(reply).toEqual({ ok: true });
    expect(sw.cacheStore.size).toBe(0);
  });

  it("returns an explicit 503 Response on uncached offline EN and FR herb navigation", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("Network offline");
    });
    const sw = loadServiceWorker(fetchMock);

    for (const url of [
      "https://herbally.app/herbs/ginger",
      "https://herbally.app/fr/herbs/ginger",
    ]) {
      const res = await sw.dispatchFetch(url, { mode: "navigate" });
      expect(res.intercepted, url).toBe(true);
      expect(res.response, url).toBeInstanceOf(Response);
      expect(res.response?.status, url).toBe(503);
      expect(res.response?.headers.get("Cache-Control"), url).toBe("no-store");
    }
  });

  it("returns cached herb page immediately even if background refresh fails offline", async () => {
    let online = true;
    const fetchMock = vi.fn(async () => {
      if (!online) throw new Error("Network offline");
      return new Response("<html>cached-ginger</html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    });
    const sw = loadServiceWorker(fetchMock);

    const first = await sw.dispatchFetch("https://herbally.app/herbs/ginger", {
      mode: "navigate",
    });
    expect(first.response?.status).toBe(200);
    await new Promise((r) => setTimeout(r, 0));

    online = false;
    const second = await sw.dispatchFetch("https://herbally.app/herbs/ginger", {
      mode: "navigate",
    });
    expect(second.intercepted).toBe(true);
    expect(second.response?.status).toBe(200);
    expect(await second.response?.text()).toBe("<html>cached-ginger</html>");
  });

  it("serves fresh network HTML on online reload of herb pages so deployments do not serve stale chunks", async () => {
    let version = 1;
    const fetchMock = vi.fn(
      async () =>
        new Response(`<html>ginger-v${version}</html>`, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        })
    );
    const sw = loadServiceWorker(fetchMock);

    const first = await sw.dispatchFetch("https://herbally.app/herbs/ginger", {
      mode: "navigate",
    });
    expect(await first.response?.text()).toBe("<html>ginger-v1</html>");

    version = 2;
    const second = await sw.dispatchFetch("https://herbally.app/herbs/ginger", {
      mode: "navigate",
    });
    expect(await second.response?.text()).toBe("<html>ginger-v2</html>");
  });
});
