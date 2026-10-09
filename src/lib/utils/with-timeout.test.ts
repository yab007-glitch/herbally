import { afterEach, describe, expect, it } from "vitest";
import { TimeoutError, withTimeout } from "./with-timeout";

describe("withTimeout", () => {
  afterEach(() => {
    delete process.env.CHAT_DB_TIMEOUT_MS;
  });

  it("resolves with the underlying value when it settles in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), "probe", 50)).resolves.toBe(
      "ok"
    );
  });

  it("rejects with TimeoutError when the promise never settles", async () => {
    // The production failure mode: a query that neither resolves nor rejects.
    const hanging = new Promise<never>(() => {});
    await expect(
      withTimeout(hanging, "chat_context_fetch", 25)
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it("propagates the original error rather than masking it as a timeout", async () => {
    const boom = Promise.reject(new Error("db down"));
    await expect(withTimeout(boom, "probe", 50)).rejects.toThrow("db down");
    await expect(withTimeout(boom, "probe", 50)).rejects.not.toBeInstanceOf(
      TimeoutError
    );
  });

  it("names the label and the bound it exceeded", async () => {
    const hanging = new Promise<never>(() => {});
    await expect(
      withTimeout(hanging, "chat_cache_lookup", 20)
    ).rejects.toThrow("chat_cache_lookup timed out after 20ms");
  });

  it("uses CHAT_DB_TIMEOUT_MS as the default bound", async () => {
    process.env.CHAT_DB_TIMEOUT_MS = "20";
    const hanging = new Promise<never>(() => {});

    const started = Date.now();
    await expect(withTimeout(hanging, "probe")).rejects.toBeInstanceOf(
      TimeoutError
    );
    // Would take the 3s default if the env override were ignored.
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("ignores a malformed CHAT_DB_TIMEOUT_MS and falls back to the default", async () => {
    process.env.CHAT_DB_TIMEOUT_MS = "not-a-number";
    const hanging = new Promise<never>(() => {});

    const started = Date.now();
    await expect(
      withTimeout(hanging, "probe", 20)
    ).rejects.toBeInstanceOf(TimeoutError);
    // Explicit bound still wins over the malformed env value.
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("does not surface a late rejection from the abandoned call", async () => {
    // If handlers weren't attached to the original promise, this rejection
    // would escape as an unhandled rejection and fail the test run.
    let rejectLate: (err: Error) => void = () => {};
    const late = new Promise<never>((_, reject) => {
      rejectLate = reject;
    });

    await expect(withTimeout(late, "probe", 20)).rejects.toBeInstanceOf(
      TimeoutError
    );
    rejectLate(new Error("late failure from the abandoned request"));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
});
