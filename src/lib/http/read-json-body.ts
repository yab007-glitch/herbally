/**
 * Stream-bounded JSON body reader.
 *
 * Enforces `maxBytes` BEFORE buffering or JSON.parse on chunked/streaming
 * requests (where `Content-Length` may be absent or spoofed).
 */
export async function readJsonBodyWithLimit(
  request: Request,
  maxBytes: number
): Promise<
  | { ok: true; data: unknown }
  | { ok: false; reason: "too_large" | "invalid_json" }
> {
  const contentLengthHeader = request.headers?.get?.("content-length");
  if (contentLengthHeader) {
    const declared = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(declared) && declared > maxBytes) {
      return { ok: false, reason: "too_large" };
    }
  }

  let rawText: string;

  if (request.body && typeof request.body.getReader === "function") {
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    const chunks: string[] = [];
    let totalBytes = 0;

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > maxBytes) {
            void reader.cancel().catch(() => {});
            return { ok: false, reason: "too_large" };
          }
          chunks.push(decoder.decode(value, { stream: true }));
        }
      }
      chunks.push(decoder.decode());
      rawText = chunks.join("");
    } catch {
      return { ok: false, reason: "invalid_json" };
    }
  } else if (typeof request.text === "function") {
    try {
      rawText = await request.text();
    } catch {
      return { ok: false, reason: "invalid_json" };
    }
    if (new TextEncoder().encode(rawText).byteLength > maxBytes) {
      return { ok: false, reason: "too_large" };
    }
  } else if (typeof request.json === "function") {
    try {
      const data = await request.json();
      if (
        new TextEncoder().encode(JSON.stringify(data)).byteLength > maxBytes
      ) {
        return { ok: false, reason: "too_large" };
      }
      return { ok: true, data };
    } catch {
      return { ok: false, reason: "invalid_json" };
    }
  } else {
    return { ok: false, reason: "invalid_json" };
  }

  try {
    return { ok: true, data: JSON.parse(rawText) };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}
