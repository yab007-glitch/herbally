import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock("@/lib/utils/logger", () => ({ logger: { warn, error: vi.fn() } }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/lib/utils/client-ip", () => ({ getClientIP: () => "test" }));
vi.mock("@/lib/ai/ollama-cloud-client", () => ({
  getOllamaCloudApiKey: () => "test-key",
  getOllamaCloudBaseUrl: () => "https://example.test",
  getOllamaCloudModel: () => "test-model",
}));
import { POST } from "./route";

describe("symptom search privacy", () => {
  it("does not log sensitive query text on upstream timeout", async () => {
    const query = "private symptom text testing";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("timeout", "TimeoutError");
      })
    );
    try {
      const response = await POST(
        new NextRequest("https://example.test/api/interpret-search", {
          method: "POST",
          body: JSON.stringify({ query }),
          headers: { "Content-Type": "application/json" },
        })
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ keywords: [query] });
      expect(warn).toHaveBeenCalled();
      expect(JSON.stringify(warn.mock.calls)).not.toContain(query);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not log arbitrary error messages that may contain user input", async () => {
    const query = "private symptom text testing";
    const logger = await import("@/lib/utils/logger");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error(query);
      })
    );
    try {
      const response = await POST(
        new NextRequest("https://example.test/api/interpret-search", {
          method: "POST",
          body: JSON.stringify({ query }),
          headers: { "Content-Type": "application/json" },
        })
      );
      expect(response.status).toBe(200);
      expect(
        JSON.stringify(vi.mocked(logger.logger.error).mock.calls)
      ).not.toContain(query);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
