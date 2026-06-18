import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { getClientIP } from "../client-ip";

function makeReq(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/", { headers });
}

describe("getClientIP", () => {
  it("prefers x-vercel-forwarded-for when VERCEL=1", () => {
    process.env.VERCEL = "1";
    const req = makeReq({
      "x-vercel-forwarded-for": "203.0.113.7",
      "x-forwarded-for": "10.0.0.1",
    });
    expect(getClientIP(req)).toBe("203.0.113.7");
    delete process.env.VERCEL;
  });

  it("uses cf-connecting-ip next", () => {
    const req = makeReq({
      "cf-connecting-ip": "198.51.100.4",
      "x-forwarded-for": "10.0.0.1",
    });
    expect(getClientIP(req)).toBe("198.51.100.4");
  });

  it("uses the rightmost x-forwarded-for entry", () => {
    const req = makeReq({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" });
    expect(getClientIP(req)).toBe("3.3.3.3");
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
