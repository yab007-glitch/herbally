import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ success: true, remaining: 5 }),
  rateLimitKey: (route: string, ip: string) => `${route}:${ip}`,
}));

vi.mock("@/lib/ai/ollama-cloud-client", () => ({
  isOllamaCloudConfigured: () => true,
  getOllamaCloudModel: () => "deepseek-v4.1-flash",
  streamChatCompletion: vi.fn(),
}));

import { POST } from "../chat/route";

describe("POST /api/chat streaming body limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a chunked body exceeding 50KB (51,200 bytes) with 413 instead of allowing 10x", async () => {
    const oversizedText = JSON.stringify({
      messages: [{ role: "user", content: "x".repeat(60 * 1024) }],
    });
    const encoder = new TextEncoder();
    const bytes = encoder.encode(oversizedText);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 30 * 1024));
        controller.enqueue(bytes.slice(30 * 1024));
        controller.close();
      },
    });
    const req = Object.assign(
      new Request("https://herbally.app/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: stream,
        // @ts-expect-error -- Node Request duplex
        duplex: "half",
      }),
      { cookies: { getAll: () => [] } }
    ) as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(413);
  });
});
