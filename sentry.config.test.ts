import * as Sentry from "@sentry/nextjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  init: vi.fn(),
  replayIntegration: vi.fn(() => ({})),
  captureRouterTransitionStart: vi.fn(),
}));

describe.each([
  ["server", () => import("./sentry.server.config")],
  ["edge", () => import("./sentry.edge.config")],
  ["browser", () => import("./instrumentation-client")],
])("%s Sentry config", (_name, loadConfig) => {
  beforeEach(async () => {
    vi.resetModules();
    vi.mocked(Sentry.init).mockClear();
    await loadConfig();
  });

  it("removes short request bodies", async () => {
    const beforeSend = vi.mocked(Sentry.init).mock.calls[0][0]?.beforeSend;
    expect(beforeSend).toBeDefined();
    const event: Sentry.ErrorEvent = {
      type: undefined,
      request: { data: "sensitive" },
    };
    const result = await beforeSend!(event, {});
    expect(result).not.toBeNull();
    expect(result?.request).not.toHaveProperty("data");
  });

  it.each([
    ["long string", "sensitive".repeat(100)],
    ["object", { symptom: "sensitive" }],
    ["array", ["sensitive"]],
    ["empty string", ""],
  ])("removes a %s request body", async (_label, data) => {
    const beforeSend = vi.mocked(Sentry.init).mock.calls[0][0]!.beforeSend!;
    const event: Sentry.ErrorEvent = { type: undefined, request: { data } };
    const result = await beforeSend(event, {});
    expect(result).not.toBeNull();
    expect(result?.request).not.toHaveProperty("data");
  });

  it("removes the separate query string and strips URL query and fragment", async () => {
    const beforeSend = vi.mocked(Sentry.init).mock.calls[0][0]!.beforeSend!;
    const event: Sentry.ErrorEvent = {
      type: undefined,
      request: {
        url: "https://example.com/path?q=sensitive#private",
        query_string: "q=sensitive",
        method: "POST",
      },
    };
    const result = await beforeSend(event, {});
    // Path is redacted too: with no route template available, only the origin
    // survives. Health slugs live in the path (/herbs/[slug], /symptoms/[x]).
    expect(result?.request).toEqual({
      url: "https://example.com/[redacted-path]",
      method: "POST",
    });
  });

  it("drops the event if scrubbing throws", async () => {
    const beforeSend = vi.mocked(Sentry.init).mock.calls[0][0]!.beforeSend!;
    const event: Sentry.ErrorEvent = {
      type: undefined,
      get breadcrumbs(): never {
        throw new Error("scrub failure");
      },
    };
    expect(await beforeSend(event, {})).toBeNull();
  });

  it("drops the event if the body cannot be removed", async () => {
    const beforeSend = vi.mocked(Sentry.init).mock.calls[0][0]!.beforeSend!;
    const request = Object.defineProperty({}, "data", {
      value: "sensitive",
      configurable: false,
    });
    expect(await beforeSend({ type: undefined, request }, {})).toBeNull();
  });

  it("preserves other fields and redacts breadcrumb data", async () => {
    const beforeSend = vi.mocked(Sentry.init).mock.calls[0][0]!.beforeSend!;
    const event: Sentry.ErrorEvent = {
      type: undefined,
      message: "failure",
      breadcrumbs: [{ message: "step", data: { symptom: "sensitive" } }],
    };
    expect(await beforeSend(event, {})).toEqual({
      type: undefined,
      message: "failure",
      breadcrumbs: [{ message: "step", data: { redacted: true } }],
    });
  });

  it("redacts invalid URLs", async () => {
    const beforeSend = vi.mocked(Sentry.init).mock.calls[0][0]!.beforeSend!;
    const event: Sentry.ErrorEvent = {
      type: undefined,
      request: { url: "/path?q=sensitive#private" },
    };
    expect((await beforeSend(event, {}))?.request?.url).toBe("[redacted]");
  });

  it("removes request headers, cookies and env", async () => {
    const beforeSend = vi.mocked(Sentry.init).mock.calls[0][0]!.beforeSend!;
    const event = {
      type: undefined,
      request: {
        url: "https://example.com/api?q=sensitive",
        headers: { authorization: "Bearer sensitive", cookie: "sb=sensitive" },
        cookies: { sb: "sensitive" },
        env: { REMOTE_ADDR: "sensitive" },
      },
    } as unknown as Sentry.ErrorEvent;
    const result = await beforeSend(event, {});
    expect(
      (result?.request as Record<string, unknown>).headers
    ).toBeUndefined();
    expect(
      (result?.request as Record<string, unknown>).cookies
    ).toBeUndefined();
    expect((result?.request as Record<string, unknown>).env).toBeUndefined();
  });

  it("replaces the concrete path with the route template", async () => {
    const beforeSend = vi.mocked(Sentry.init).mock.calls[0][0]!.beforeSend!;
    const event = {
      type: undefined,
      request: {
        url: "https://example.com/en/interactions/warfarin/ashwagandha?q=x#y",
      },
      contexts: {
        nextjs: { router_path: "/[locale]/(main)/interactions/[herb]/[drug]" },
      },
    } as unknown as Sentry.ErrorEvent;
    const result = await beforeSend(event, {});
    expect(result?.request?.url).toBe(
      "https://example.com/[locale]/(main)/interactions/[herb]/[drug]"
    );
    expect(JSON.stringify(result)).not.toContain("warfarin");
    expect(JSON.stringify(result)).not.toContain("ashwagandha");
  });

  it("redacts contexts.nextjs.request_path but keeps router_path", async () => {
    const beforeSend = vi.mocked(Sentry.init).mock.calls[0][0]!.beforeSend!;
    const event = {
      type: undefined,
      contexts: {
        nextjs: {
          request_path: "/en/interactions/warfarin/ashwagandha",
          router_path: "/[locale]/(main)/interactions/[herb]/[drug]",
        },
      },
    } as unknown as Sentry.ErrorEvent;
    const result = await beforeSend(event, {});
    expect(
      (result?.contexts?.nextjs as Record<string, unknown>).request_path
    ).toBe("[redacted]");
    expect(
      (result?.contexts?.nextjs as Record<string, unknown>).router_path
    ).toBe("/[locale]/(main)/interactions/[herb]/[drug]");
    expect(JSON.stringify(result)).not.toContain("ashwagandha");
  });

  it("registers a transaction hook so sampled transactions are scrubbed", async () => {
    const opts = vi.mocked(Sentry.init).mock.calls[0][0]!;
    expect(typeof (opts as Record<string, unknown>).beforeSendTransaction).toBe(
      "function"
    );
  });

  it("lets no sentinel survive a kitchen-sink event", async () => {
    const SENTINEL = "CANARY_9f3a2b7c5d";
    const beforeSend = vi.mocked(Sentry.init).mock.calls[0][0]!.beforeSend!;
    const event = {
      type: undefined,
      // Free-text message is app-authored (no user input interpolated). A generic
      // scrubber cannot judge it; it is a documented residual, not a field leak.
      message: "boom",
      request: {
        url: `https://example.com/en/interactions/${SENTINEL}-herb/${SENTINEL}-drug?q=${SENTINEL}#${SENTINEL}`,
        method: "POST",
        data: { message: SENTINEL },
        query_string: `q=${SENTINEL}`,
        cookies: { sb: SENTINEL },
        headers: {
          cookie: `sb=${SENTINEL}`,
          authorization: `Bearer ${SENTINEL}`,
        },
        env: { REMOTE_ADDR: SENTINEL },
      },
      breadcrumbs: [
        { category: "fetch", data: { url: `https://x/?q=${SENTINEL}` } },
      ],
      contexts: {
        nextjs: {
          request_path: `/en/interactions/${SENTINEL}-herb/${SENTINEL}-drug`,
          router_path: "/[locale]/(main)/interactions/[herb]/[drug]",
        },
      },
    } as unknown as Sentry.ErrorEvent;
    const result = await beforeSend(event, {});
    expect(result).not.toBeNull();
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });
});
