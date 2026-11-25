import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const revalidatePathMock = vi.fn();
const revalidateTagMock = vi.fn();
const rateLimitMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
  rateLimitKey: (route: string, ip: string) => `${route}:${ip}`,
}));

import { POST } from "../route";

function makeReq(body: unknown): NextRequest {
  return new Request("https://herbally.app/api/revalidate-herb", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/revalidate-herb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVALIDATE_SECRET = "super-secret-token";
    rateLimitMock.mockResolvedValue({ success: true, remaining: 4 });
  });

  it("returns 429 with Cache-Control: private, no-store when rate limited", async () => {
    rateLimitMock.mockResolvedValueOnce({ success: false, remaining: 0 });
    const res = await POST(
      makeReq({ slugs: ["ginger"], secret: "super-secret-token" })
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns 503 when REVALIDATE_SECRET is unset", async () => {
    delete process.env.REVALIDATE_SECRET;
    const res = await POST(
      makeReq({ slugs: ["ginger"], secret: "super-secret-token" })
    );
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns 400 on malformed JSON and 413 on oversized bodies > 32KB", async () => {
    const badRes = await POST(makeReq("{not-json"));
    expect(badRes.status).toBe(400);
    expect(badRes.headers.get("cache-control")).toBe("private, no-store");

    const bigRes = await POST(
      makeReq({ slugs: ["a".repeat(35 * 1024)], secret: "super-secret-token" })
    );
    expect(bigRes.status).toBe(413);
    expect(bigRes.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns 401 when secret mismatches", async () => {
    const res = await POST(makeReq({ slugs: ["ginger"], secret: "wrong" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("purges all 9 per-slug tags, localized herb/compare/symptoms paths, and sitemap.xml", async () => {
    const res = await POST(
      makeReq({ slugs: ["ginger", "ginger"], secret: "super-secret-token" })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ ok: true, revalidated: 1 });

    const expectedTags = [
      "herb-ginger",
      "herb-meta-ginger",
      "herb-page-bundle-ginger",
      "herb-faqs-ginger",
      "herb-regulatory-evidence-ginger",
      "sources-ginger",
      "monograph-ginger",
      "pubmed-sheet-ginger",
      "related-herbs-ginger",
    ];
    for (const tag of expectedTags) {
      expect(revalidateTagMock).toHaveBeenCalledWith(tag, { expire: 0 });
    }
    expect(revalidatePathMock).toHaveBeenCalledWith("/herbs/ginger");
    expect(revalidatePathMock).toHaveBeenCalledWith("/en/herbs/ginger");
    expect(revalidatePathMock).toHaveBeenCalledWith("/fr/herbs/ginger");
    expect(revalidatePathMock).toHaveBeenCalledWith("/compare", "layout");
    expect(revalidatePathMock).toHaveBeenCalledWith("/en/compare", "layout");
    expect(revalidatePathMock).toHaveBeenCalledWith("/fr/compare", "layout");
    expect(revalidatePathMock).toHaveBeenCalledWith("/symptoms", "layout");
    expect(revalidatePathMock).toHaveBeenCalledWith("/en/symptoms", "layout");
    expect(revalidatePathMock).toHaveBeenCalledWith("/fr/symptoms", "layout");
    expect(revalidatePathMock).toHaveBeenCalledWith("/sitemap.xml");
  });
});
