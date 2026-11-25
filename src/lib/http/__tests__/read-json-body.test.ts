import { describe, it, expect } from "vitest";
import { readJsonBodyWithLimit } from "../read-json-body";

function streamRequest(
  chunks: string[],
  headers?: Record<string, string>
): Request {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) {
        controller.enqueue(encoder.encode(c));
      }
      controller.close();
    },
  });
  return new Request("https://herbally.app/api/test", {
    method: "POST",
    headers,
    body: stream,
    // @ts-expect-error -- Node fetch Request requires duplex for ReadableStream
    duplex: "half",
  });
}

describe("readJsonBodyWithLimit", () => {
  it("parses valid JSON within byte cap", async () => {
    const req = streamRequest(['{"hello":"world"}']);
    const res = await readJsonBodyWithLimit(req, 1024);
    expect(res).toEqual({ ok: true, data: { hello: "world" } });
  });

  it("rejects oversized content-length before reading stream", async () => {
    const req = new Request("https://herbally.app/api/test", {
      method: "POST",
      headers: { "content-length": "50000" },
      body: JSON.stringify({ a: 1 }),
    });
    const res = await readJsonBodyWithLimit(req, 1024);
    expect(res).toEqual({ ok: false, reason: "too_large" });
  });

  it("rejects chunked/streamed payloads exceeding maxBytes without content-length", async () => {
    const chunk = "a".repeat(600);
    const req = streamRequest([`{"p":"${chunk}`, `${chunk}"}`]);
    const res = await readJsonBodyWithLimit(req, 1024);
    expect(res).toEqual({ ok: false, reason: "too_large" });
  });

  it("returns invalid_json on malformed JSON within cap", async () => {
    const req = streamRequest(["{bad json"]);
    const res = await readJsonBodyWithLimit(req, 1024);
    expect(res).toEqual({ ok: false, reason: "invalid_json" });
  });
});
