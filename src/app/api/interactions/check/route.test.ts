import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRateLimit, mockGetAnonClient, mockResolveHerb, mockGetHerbPairs } =
  vi.hoisted(() => ({
    mockRateLimit: vi.fn(),
    mockGetAnonClient: vi.fn(),
    mockResolveHerb: vi.fn(),
    mockGetHerbPairs: vi.fn(),
  }));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
  rateLimitKey: (ns: string, ip: string) => `${ns}:${ip}`,
}));

vi.mock("@/lib/supabase/anonymous", () => ({
  getAnonClient: mockGetAnonClient,
}));

vi.mock("@/lib/interactions/resolve-herb", () => ({
  resolveHerb: mockResolveHerb,
}));

vi.mock("@/lib/interactions/pairs", () => ({
  getHerbPairs: mockGetHerbPairs,
}));

import { GET } from "./route";

function makeReq(query: string, headers: Record<string, string> = {}) {
  return new NextRequest(
    `https://herbally.app/api/interactions/check${query}`,
    {
      headers,
    }
  );
}

describe("A5: GET /api/interactions/check route edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue({ success: true });
    mockGetAnonClient.mockReturnValue({});
    mockResolveHerb.mockResolvedValue({
      slug: "turmeric",
      name: "Turmeric",
      frName: "Curcuma",
      scientific_name: "Curcuma longa",
    });
    mockGetHerbPairs.mockResolvedValue([
      {
        id: "p1",
        herbSlug: "turmeric",
        herbName: "Turmeric",
        herbScientificName: "Curcuma longa",
        drugName: "Warfarin",
        drugSlug: "warfarin",
        severity: "severe",
        description: "Additive bleeding risk.",
        mechanism: "Antiplatelet effect",
        evidenceLevel: "B",
        source: "NIH NCCIH",
        sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/34062109/",
        evidenceNote: null,
        updatedAt: "2026-11-01T00:00:00Z",
        hasFr: true,
        publicationStatus: "published",
      },
      {
        id: "p2",
        herbSlug: "turmeric",
        herbName: "Turmeric",
        herbScientificName: "Curcuma longa",
        drugName: "RetractedDrug",
        drugSlug: "retracteddrug",
        severity: "moderate",
        description: "Withheld",
        mechanism: null,
        evidenceLevel: "C",
        source: "Old source",
        sourceUrl: null,
        evidenceNote: null,
        updatedAt: "2026-11-01T00:00:00Z",
        hasFr: false,
        publicationStatus: "retracted_hold",
      },
    ]);
  });

  it("returns 429 with Retry-After and rateLimited flag when quota is exceeded", async () => {
    mockRateLimit.mockResolvedValueOnce({ success: false });
    const res = await GET(makeReq("?herb=turmeric&drug=warfarin"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    const json = (await res.json()) as {
      found: boolean;
      unavailable: boolean;
      rateLimited: boolean;
    };
    expect(json.found).toBe(false);
    expect(json.unavailable).toBe(true);
    expect(json.rateLimited).toBe(true);
  });

  it("returns 400 on missing, 1-char, or oversized (>200 chars) inputs", async () => {
    for (const q of [
      "",
      "?herb=t&drug=warfarin",
      `?herb=${"a".repeat(201)}&drug=warfarin`,
    ]) {
      const res = await GET(makeReq(q));
      expect(res.status).toBe(400);
      const json = (await res.json()) as { found: boolean };
      expect(json.found).toBe(false);
    }
  });

  it("returns 503 unavailable=true when database client is missing", async () => {
    mockGetAnonClient.mockReturnValueOnce(null);
    const res = await GET(makeReq("?herb=turmeric&drug=warfarin"));
    expect(res.status).toBe(503);
    const json = (await res.json()) as { found: boolean; unavailable: boolean };
    expect(json.found).toBe(false);
    expect(json.unavailable).toBe(true);
  });

  it("returns found=false without fabricating safety for unknown herbs or unrecorded pairs (including XSS payloads)", async () => {
    mockResolveHerb.mockResolvedValueOnce(null);
    const unknownRes = await GET(
      makeReq("?herb=<script>alert(1)</script>&drug=warfarin")
    );
    expect(unknownRes.status).toBe(200);
    const unknownJson = (await unknownRes.json()) as {
      found: boolean;
      herb: unknown;
    };
    expect(unknownJson.found).toBe(false);
    expect(unknownJson.herb).toBeNull();

    const unrecordedRes = await GET(
      makeReq("?herb=turmeric&drug=atorvastatin")
    );
    expect(unrecordedRes.status).toBe(200);
    const unrecordedJson = (await unrecordedRes.json()) as {
      found: boolean;
      herb: { slug: string };
    };
    expect(unrecordedJson.found).toBe(false);
    expect(unrecordedJson.herb.slug).toBe("turmeric");
  });

  it("withholds retracted_hold pairs with Cache-Control: no-store in both EN and FR", async () => {
    const enRes = await GET(makeReq("?herb=turmeric&drug=RetractedDrug"));
    expect(enRes.status).toBe(200);
    expect(enRes.headers.get("Cache-Control")).toBe("no-store");
    const enJson = (await enRes.json()) as {
      found: boolean;
      withheld: boolean;
      reason: string;
    };
    expect(enJson.found).toBe(false);
    expect(enJson.withheld).toBe(true);
    expect(enJson.reason).toBe("retracted_hold");

    const frRes = await GET(
      makeReq("?herb=turmeric&drug=RetractedDrug&locale=fr")
    );
    const frJson = (await frRes.json()) as { message: string };
    expect(frJson.message).toContain("pharmacien");
  });

  it("returns matched pair details and cache headers on a valid lookup", async () => {
    const res = await GET(
      makeReq("?herb=turmeric&drug=warfarin", { "x-locale": "en" })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=3600");
    const json = (await res.json()) as {
      found: boolean;
      pair: { severity: string; pairUrl: string; sourceUrl: string };
    };
    expect(json.found).toBe(true);
    expect(json.pair.severity).toBe("severe");
    expect(json.pair.pairUrl).toBe("/interactions/turmeric/warfarin");
    expect(json.pair.sourceUrl).toContain("pubmed.ncbi.nlm.nih.gov");
  });
});
