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

import { POST } from "./route";

function makeReq(body: string, headers: Record<string, string> = {}) {
  return new NextRequest("https://herbally.app/api/interactions/check-stack", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("A5: POST /api/interactions/check-stack route edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue({ success: true });
    mockGetAnonClient.mockReturnValue({});
    mockResolveHerb.mockImplementation(async (name: string) => {
      if (name.toLowerCase() === "turmeric") {
        return {
          slug: "turmeric",
          name: "Turmeric",
          frName: "Curcuma",
          scientific_name: "Curcuma longa",
        };
      }
      return null;
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
        description: "Increased bleeding risk.",
        mechanism: "Antiplatelet modulation",
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
        drugName: "RetractedMed",
        drugSlug: "retractedmed",
        severity: "moderate",
        description: "Withheld",
        mechanism: null,
        evidenceLevel: "C",
        source: "Withheld",
        sourceUrl: null,
        evidenceNote: null,
        updatedAt: "2026-11-01T00:00:00Z",
        hasFr: false,
        publicationStatus: "retracted_hold",
      },
    ]);
  });

  it("returns 429 with Retry-After when rate limit triggers", async () => {
    mockRateLimit.mockResolvedValueOnce({ success: false });
    const res = await POST(
      makeReq(JSON.stringify({ herbs: ["turmeric"], drugs: ["warfarin"] }))
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("returns 400 for malformed JSON, empty arrays, or >10 herbs", async () => {
    const badJson = await POST(makeReq("{not-json"));
    expect(badJson.status).toBe(400);

    const emptyArrays = await POST(
      makeReq(JSON.stringify({ herbs: [], drugs: ["warfarin"] }))
    );
    expect(emptyArrays.status).toBe(400);

    const tooMany = await POST(
      makeReq(
        JSON.stringify({
          herbs: Array.from({ length: 11 }, (_, i) => `herb-${i + 1}`),
          drugs: ["warfarin"],
        })
      )
    );
    expect(tooMany.status).toBe(400);
  });

  it("returns 413 when JSON payload exceeds 16 KB", async () => {
    const res = await POST(
      makeReq(
        JSON.stringify({ herbs: ["a".repeat(20_000)], drugs: ["warfarin"] })
      )
    );
    expect(res.status).toBe(413);
  });

  it("returns 503 when DB is unavailable", async () => {
    mockGetAnonClient.mockReturnValueOnce(null);
    const res = await POST(
      makeReq(JSON.stringify({ herbs: ["turmeric"], drugs: ["warfarin"] }))
    );
    expect(res.status).toBe(503);
  });

  it("deduplicates repeated entries and separates matches, withheld, and unrecorded pairs", async () => {
    const res = await POST(
      makeReq(
        JSON.stringify({
          herbs: ["Turmeric", "turmeric", "UnknownPlant"],
          drugs: ["Warfarin", "RetractedMed"],
          locale: "fr",
        })
      )
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      locale: string;
      summary: {
        totalCombinations: number;
        matchedCount: number;
        withheldCount: number;
        unrecordedCount: number;
        highestSeverity: string;
        unresolvedHerbs: string[];
      };
      matches: Array<{ herbName: string; severity: string }>;
      withheld: Array<{ reason: string }>;
    };
    expect(json.locale).toBe("fr");
    expect(json.summary.totalCombinations).toBe(4);
    expect(json.summary.matchedCount).toBe(1);
    expect(json.summary.withheldCount).toBe(1);
    expect(json.summary.unrecordedCount).toBe(2);
    expect(json.summary.highestSeverity).toBe("severe");
    expect(json.summary.unresolvedHerbs).toEqual(["UnknownPlant"]);
    expect(json.matches[0].herbName).toBe("Curcuma");
    expect(json.withheld[0].reason).toBe("retracted_hold");
  });
});
