import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { getClientIP } from "../client-ip";

function makeReq(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/", { headers });
}

afterEach(() => {
  delete process.env.VERCEL;
  delete process.env.TRUST_PROXY_HEADERS;
});

describe("getClientIP — on Vercel (trusted proxy)", () => {
  it("prefers x-vercel-forwarded-for when VERCEL=1", () => {
    process.env.VERCEL = "1";
    const req = makeReq({
      "x-vercel-forwarded-for": "203.0.113.7",
      "x-forwarded-for": "10.0.0.1",
    });
    expect(getClientIP(req)).toBe("203.0.113.7");
  });

  it("uses cf-connecting-ip on Vercel", () => {
    process.env.VERCEL = "1";
    const req = makeReq({
      "cf-connecting-ip": "198.51.100.4",
      "x-forwarded-for": "10.0.0.1",
    });
    expect(getClientIP(req)).toBe("198.51.100.4");
  });

  it("uses the leftmost x-forwarded-for entry on Vercel", () => {
    process.env.VERCEL = "1";
    const req = makeReq({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" });
    expect(getClientIP(req)).toBe("1.1.1.1");
  });
});

describe("getClientIP — off-Vercel without TRUST_PROXY_HEADERS (L4)", () => {
  // The whole point of L4: off-Vercel, XFF/cf-connecting-ip are client-
  // controllable and MUST NOT be trusted, otherwise a caller rotates the
  // header to bypass per-IP rate limits.
  it("ignores cf-connecting-ip and x-forwarded-for and returns 'unknown'", () => {
    const req = makeReq({
      "cf-connecting-ip": "198.51.100.4",
      "x-forwarded-for": "1.1.1.1, 2.2.2.2",
    });
    expect(getClientIP(req)).toBe("unknown");
  });

  it("returns 'unknown' when no IP headers are present", () => {
    const req = makeReq({});
    expect(getClientIP(req)).toBe("unknown");
  });

  it("returns 'unknown' for an empty x-forwarded-for", () => {
    const req = makeReq({ "x-forwarded-for": "" });
    expect(getClientIP(req)).toBe("unknown");
  });
});

describe("getClientIP — off-Vercel with TRUST_PROXY_HEADERS=1", () => {
  it("honors cf-connecting-ip when the operator opts in", () => {
    process.env.TRUST_PROXY_HEADERS = "1";
    const req = makeReq({
      "cf-connecting-ip": "198.51.100.4",
      "x-forwarded-for": "10.0.0.1",
    });
    expect(getClientIP(req)).toBe("198.51.100.4");
  });

  it("honors the leftmost x-forwarded-for entry when opted in", () => {
    process.env.TRUST_PROXY_HEADERS = "1";
    const req = makeReq({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" });
    expect(getClientIP(req)).toBe("1.1.1.1");
  });
});
