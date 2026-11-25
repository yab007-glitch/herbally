import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const getAnonClientMock = vi.fn();
const resolveHerbMock = vi.fn();
const getHerbPairsMock = vi.fn();

vi.mock("@/lib/supabase/anonymous", () => ({
  getAnonClient: () => getAnonClientMock(),
}));

vi.mock("@/lib/interactions/resolve-herb", () => ({
  resolveHerb: (term: string) => resolveHerbMock(term),
}));

vi.mock("@/lib/interactions/pairs", () => ({
  getHerbPairs: (slug: string, locale: string) =>
    getHerbPairsMock(slug, locale),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ success: true, remaining: 29 }),
  rateLimitKey: (route: string, ip: string) => `${route}:${ip}`,
}));

import { GET } from "../check/route";
import { POST } from "../check-stack/route";
import { InteractionDataUnavailableError } from "@/lib/interactions/errors";

function makeGetReq(url: string): NextRequest {
  const parsed = new URL(url);
  return {
    nextUrl: parsed,
    headers: new Headers(),
  } as unknown as NextRequest;
}

function makePostReq(body: unknown): NextRequest {
  const json = JSON.stringify(body);
  return {
    headers: new Headers({ "content-type": "application/json" }),
    text: async () => json,
    json: async () => body,
  } as unknown as NextRequest;
}

describe("GET /api/interactions/check availability behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAnonClientMock.mockReturnValue({});
  });

  it("returns 503 unavailable:true when resolveHerb throws InteractionDataUnavailableError", async () => {
    resolveHerbMock.mockRejectedValueOnce(
      new InteractionDataUnavailableError("DB timeout")
    );
    const res = await GET(
      makeGetReq(
        "https://herbally.app/api/interactions/check?herb=turmeric&drug=warfarin"
      )
    );
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body).toEqual({ found: false, unavailable: true });
  });

  it("returns 503 unavailable:true when getHerbPairs throws InteractionDataUnavailableError", async () => {
    resolveHerbMock.mockResolvedValueOnce({
      slug: "turmeric",
      name: "Turmeric",
      scientific_name: "Curcuma longa",
    });
    getHerbPairsMock.mockRejectedValueOnce(
      new InteractionDataUnavailableError("DB timeout")
    );
    const res = await GET(
      makeGetReq(
        "https://herbally.app/api/interactions/check?herb=turmeric&drug=warfarin"
      )
    );
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body).toEqual({ found: false, unavailable: true });
  });

  it("returns 200 found:false when DB succeeds and no herb matches", async () => {
    resolveHerbMock.mockResolvedValueOnce(null);
    const res = await GET(
      makeGetReq(
        "https://herbally.app/api/interactions/check?herb=unknown&drug=warfarin"
      )
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );
    expect(res.headers.get("Vary")).toBe("x-locale");
    const body = await res.json();
    expect(body).toEqual({ found: false, herb: null });
  });
});

describe("POST /api/interactions/check-stack availability behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAnonClientMock.mockReturnValue({});
  });

  it("returns 503 unavailable:true when DB lookup fails", async () => {
    resolveHerbMock.mockRejectedValueOnce(
      new InteractionDataUnavailableError("DB down")
    );
    const res = await POST(
      makePostReq({ herbs: ["turmeric"], drugs: ["warfarin"] })
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.unavailable).toBe(true);
  });
});

describe("interaction check API collision handling via real matcher", () => {
  const collidingPairs = [
    {
      id: "row-mod",
      herbSlug: "sage",
      herbName: "Sage",
      herbScientificName: "Salvia officinalis",
      drugName: "Anticonvulsants",
      drugSlug: "anticonvulsants",
      severity: "moderate" as const,
      description: "Moderate anticonvulsants interaction.",
      mechanism: null,
      evidenceLevel: "moderate-evidence",
      source: "NCCIH",
      sourceUrl: null,
      evidenceNote: null,
      updatedAt: "2026-11-20T00:00:00Z",
      hasFr: false,
    },
    {
      id: "row-sev",
      herbSlug: "sage",
      herbName: "Sage",
      herbScientificName: "Salvia officinalis",
      drugName: "Anticonvulsants (Phenytoin, Valproate, Carbamazepine)",
      drugSlug: "anticonvulsants",
      severity: "severe" as const,
      description: "Severe anticonvulsants interaction.",
      mechanism: null,
      evidenceLevel: "well-documented",
      source: "PubMed",
      sourceUrl: null,
      evidenceNote: null,
      updatedAt: "2026-11-20T00:00:00Z",
      hasFr: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    getAnonClientMock.mockReturnValue({});
    resolveHerbMock.mockResolvedValue({
      slug: "sage",
      name: "Sage",
      scientific_name: "Salvia officinalis",
      frName: "Sauge",
    });
    getHerbPairsMock.mockResolvedValue(collidingPairs);
  });

  it("GET /api/interactions/check returns structured ambiguity/conflict outcome with all colliding rows", async () => {
    const res = await GET(
      makeGetReq(
        "https://herbally.app/api/interactions/check?herb=sage&drug=anticonvulsants"
      )
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.ambiguous).toBe(true);
    expect(body.conflict).toBe(true);
    expect(body.pair).toBeNull();
    expect(body.conflictingPairs).toHaveLength(2);
    expect(
      body.conflictingPairs.map((p: { severity: string }) => p.severity)
    ).toEqual(["moderate", "severe"]);
  });

  it("POST /api/interactions/check-stack returns structured conflicts with all colliding rows instead of picking one", async () => {
    const res = await POST(
      makePostReq({ herbs: ["sage"], drugs: ["anticonvulsants"] })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body.matches).toEqual([]);
    expect(body.unrecorded).toEqual([]);
    expect(body.summary.conflictCount).toBe(1);
    expect(body.summary.hasConflicts).toBe(true);
    expect(body.conflicts).toHaveLength(1);
    expect(body.conflicts[0].drugSlug).toBe("anticonvulsants");
    expect(body.conflicts[0].records).toHaveLength(2);
    expect(
      body.conflicts[0].records.map((r: { severity: string }) => r.severity)
    ).toEqual(["moderate", "severe"]);
  });
});
