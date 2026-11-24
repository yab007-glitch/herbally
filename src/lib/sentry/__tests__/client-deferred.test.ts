import fs from "node:fs";
import path from "node:path";
import * as Sentry from "@sentry/nextjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}));

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.test\.|\.spec\./.test(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
}

describe("deferred client Sentry", () => {
  const prevDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const addedListeners: Array<{
    type: string;
    listener: EventListenerOrEventListenerObject;
    options?: boolean | AddEventListenerOptions;
  }> = [];
  const origAddEventListener = window.addEventListener.bind(window);

  beforeEach(() => {
    vi.resetModules();
    vi.mocked(Sentry.init).mockClear();
    vi.mocked(Sentry.captureException).mockClear();
    vi.mocked(Sentry.captureRouterTransitionStart).mockClear();
    process.env.NEXT_PUBLIC_SENTRY_DSN =
      "https://public@example.ingest.sentry.io/1";
    vi.spyOn(window, "addEventListener").mockImplementation(
      (
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
      ) => {
        addedListeners.push({ type, listener, options });
        return origAddEventListener(type, listener, options);
      }
    );
  });

  afterEach(() => {
    for (const { type, listener, options } of addedListeners.splice(0)) {
      window.removeEventListener(type, listener, options);
    }
    vi.restoreAllMocks();
    if (prevDsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    else process.env.NEXT_PUBLIC_SENTRY_DSN = prevDsn;
    vi.useRealTimers();
  });

  it("does not initialize Sentry synchronously or on idle when the page is untouched", async () => {
    await import("../../../../instrumentation-client");
    await new Promise((r) => setTimeout(r, 25));
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it("initializes Sentry after a user interaction (pointerdown)", async () => {
    await import("../../../../instrumentation-client");
    expect(Sentry.init).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("pointerdown"));

    await vi.waitFor(() => {
      expect(Sentry.init).toHaveBeenCalledTimes(1);
    });
  });

  it("captures an early browser error before interaction, initializes Sentry once, and detaches early listener", async () => {
    await import("../../../../instrumentation-client");
    expect(Sentry.init).not.toHaveBeenCalled();

    const thrown = new Error("early-boot-crash");
    window.dispatchEvent(new ErrorEvent("error", { error: thrown }));

    await vi.waitFor(() => {
      expect(Sentry.init).toHaveBeenCalledTimes(1);
      expect(Sentry.captureException).toHaveBeenCalledWith(thrown);
    });

    // Early listener is removed once Sentry initializes so GlobalHandlers won't double-report.
    vi.mocked(Sentry.captureException).mockClear();
    window.dispatchEvent(
      new ErrorEvent("error", { message: "post-init-window-event" })
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("captures exceptions through captureClientException after dynamic import", async () => {
    const { captureClientException } = await import("../client-deferred");
    const err = new Error("boundary-error");
    await captureClientException(err);

    expect(Sentry.init).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(err);
  });

  it("has no static value imports of @sentry/nextjs or sentry-sdk-entry in client files or instrumentation-client.ts", () => {
    const clientCandidates = [
      "instrumentation-client.ts",
      ...walkTsFiles("src").filter((f) =>
        /^\s*["']use client["']/.test(fs.readFileSync(f, "utf8"))
      ),
    ];

    for (const file of clientCandidates) {
      const src = fs.readFileSync(file, "utf8");
      const staticSentryImports = [
        ...src.matchAll(
          /^\s*import\s+(?!type\b)[\s\S]*?from\s+["'](?:@sentry\/nextjs|[^"']*sentry-sdk-entry)["']/gm
        ),
      ];
      expect(
        staticSentryImports,
        `Static Sentry import found in ${file}`
      ).toEqual([]);
    }

    for (const file of walkTsFiles("src")) {
      if (file === "src/lib/sentry/sentry-sdk-entry.ts") continue;
      const src = fs.readFileSync(file, "utf8");
      const staticEntryImports = [
        ...src.matchAll(
          /^\s*import\s+(?!type\b)[\s\S]*?from\s+["'][^"']*sentry-sdk-entry["']/gm
        ),
      ];
      expect(
        staticEntryImports,
        `Static sentry-sdk-entry import found in ${file}`
      ).toEqual([]);
    }
  });
});
