import { describe, expect, it } from "vitest";
import { GET } from "../region/route";

function requestWith(headers: Record<string, string>) {
  return new Request("https://herbally.app/api/ads/region", { headers });
}

describe("GET /api/ads/region", () => {
  it("returns a coarse rest-of-world answer for a known country", async () => {
    const response = await GET(requestWith({ "x-vercel-ip-country": "CA" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ region: "row" });
  });

  it("returns eea for an EU member state, the UK and Switzerland", async () => {
    for (const country of ["FR", "DE", "GB", "CH"]) {
      const response = await GET(requestWith({ "x-vercel-ip-country": country }));
      expect(await response.json(), country).toEqual({ region: "eea" });
    }
  });

  it("accepts the Cloudflare header when Vercel's is absent", async () => {
    const response = await GET(requestWith({ "cf-ipcountry": "NO" }));
    expect(await response.json()).toEqual({ region: "eea" });
  });

  it("fails closed when no geo header is present", async () => {
    const response = await GET(requestWith({}));
    expect(await response.json()).toEqual({ region: "unknown" });
  });

  it("treats a Cloudflare XX / T1 lookup as unknown rather than rest-of-world", async () => {
    for (const country of ["XX", "T1"]) {
      const response = await GET(requestWith({ "cf-ipcountry": country }));
      expect(await response.json(), country).toEqual({ region: "unknown" });
    }
  });

  it("fails closed when the two geo headers disagree", async () => {
    // A client-supplied cf-ipcountry must not upgrade a restricted visitor.
    const response = await GET(
      requestWith({ "x-vercel-ip-country": "FR", "cf-ipcountry": "US" })
    );
    expect(await response.json()).toEqual({ region: "unknown" });
  });

  it("accepts agreeing headers from both layers", async () => {
    const response = await GET(
      requestWith({ "x-vercel-ip-country": "CA", "cf-ipcountry": "US" })
    );
    expect(await response.json()).toEqual({ region: "row" });
  });

  it("never echoes the country code back", async () => {
    const response = await GET(requestWith({ "x-vercel-ip-country": "CA" }));
    const body = await response.text();
    expect(body).not.toContain("CA");
    expect(body).toBe(JSON.stringify({ region: "row" }));
  });

  it("is private and uncacheable, and varies on the geo headers", async () => {
    const response = await GET(requestWith({ "x-vercel-ip-country": "CA" }));
    const cacheControl = response.headers.get("cache-control") ?? "";
    expect(cacheControl).toContain("no-store");
    expect(cacheControl).toContain("private");
    expect(response.headers.get("vary")).toContain("x-vercel-ip-country");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("sets no cookie", async () => {
    const response = await GET(requestWith({ "x-vercel-ip-country": "CA" }));
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
