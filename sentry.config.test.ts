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
    expect(result?.request).toEqual({
      url: "https://example.com/path",
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
});
