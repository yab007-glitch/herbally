import { describe, it, expect } from "vitest";
import { scrubEvent, type ScrubbableEvent } from "../scrub-event";

describe("scrubEvent", () => {
  it("strips request secrets and redacts concrete herb paths using contexts.nextjs.router_path", () => {
    const event: ScrubbableEvent = {
      request: {
        url: "https://herbally.app/herbs/turmeric?search=insomnia#dosage",
        data: { password: "secret" },
        query_string: "search=insomnia",
        headers: { cookie: "sb=123" },
        cookies: { sb: "123" },
        env: { SECRET: "x" },
      },
      contexts: {
        nextjs: {
          router_path: "/herbs/[slug]",
          request_path: "/herbs/turmeric",
        },
      },
      breadcrumbs: [{ data: { query: "ashwagandha anxiety" } }],
    };

    const scrubbed = scrubEvent(event);
    expect(scrubbed).not.toBeNull();
    expect(scrubbed?.request?.data).toBeUndefined();
    expect(scrubbed?.request?.query_string).toBeUndefined();
    expect(scrubbed?.request?.headers).toBeUndefined();
    expect(scrubbed?.request?.cookies).toBeUndefined();
    expect(scrubbed?.request?.env).toBeUndefined();
    expect(scrubbed?.request?.url).toBe("https://herbally.app/herbs/[slug]");
    expect(
      (scrubbed?.contexts?.nextjs as Record<string, unknown>).request_path
    ).toBe("[redacted]");
    expect(scrubbed?.breadcrumbs?.[0]?.data).toEqual({ redacted: true });
  });

  it("falls back to transaction route template or /[redacted-path]", () => {
    const fromTx = scrubEvent({
      transaction: "GET /interactions/[herb]/[drug]",
      request: { url: "https://herbally.app/interactions/ginger/warfarin" },
    });
    expect(fromTx?.request?.url).toBe(
      "https://herbally.app/interactions/[herb]/[drug]"
    );

    const noTemplate = scrubEvent({
      request: { url: "https://herbally.app/symptoms/insomnia" },
    });
    expect(noTemplate?.request?.url).toBe(
      "https://herbally.app/[redacted-path]"
    );

    const badUrl = scrubEvent({
      request: { url: "not a valid url" },
    });
    expect(badUrl?.request?.url).toBe("[redacted]");
  });

  it("fails closed (returns null) if scrubbing throws", () => {
    const poisoned = {
      get request() {
        throw new Error("getter boom");
      },
    } as unknown as ScrubbableEvent;
    expect(scrubEvent(poisoned)).toBeNull();
  });
});
