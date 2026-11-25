import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

const resolveHerbMock = vi.fn();
const getHerbPairsMock = vi.fn();

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

import { GET } from "../lookup/route";
import { InteractionDataUnavailableError } from "@/lib/interactions/errors";

function makeReq(npn = "80000001", locale = "en"): NextRequest {
  const parsed = new URL(
    `https://herbally.app/api/npn/lookup?npn=${npn}&locale=${locale}`
  );
  return {
    nextUrl: parsed,
    headers: new Headers(),
  } as unknown as NextRequest;
}

describe("GET /api/npn/lookup partial upstream failure handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveHerbMock.mockResolvedValue({
      slug: "flaxseed",
      name: "Flaxseed",
      scientific_name: "Linum usitatissimum",
    });
    getHerbPairsMock.mockResolvedValue([{ id: "p1" }]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sets public cache and partial:false when all LNHPD sections and herb matching succeed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("productlicence")) {
          return {
            ok: true,
            json: async () => ({
              data: [
                {
                  lnhpd_id: 123,
                  licence_number: "80000001",
                  product_name: "Test Flax",
                  flag_product_status: 1,
                },
              ],
            }),
          };
        }
        if (url.includes("medicinalingredient")) {
          return {
            ok: true,
            json: async () => ({
              data: [{ ingredient_name: "Flaxseed" }],
            }),
          };
        }
        if (url.includes("productpurpose")) {
          return {
            ok: true,
            json: async () => ({ data: [{ purpose: "Source of omega-3" }] }),
          };
        }
        if (url.includes("productrisk")) {
          return {
            ok: true,
            json: async () => ({
              data: [{ risk_type_desc: "Cautions", risk_text: "Keep cool." }],
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({ data: [] }),
        };
      })
    );

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=3600");
    const body = await res.json();
    expect(body.partial).toBe(false);
    expect(body.unavailableSections).toEqual([]);
    expect(body.herbMatchingUnavailable).toBe(false);
    expect(body.sectionStatus).toEqual({
      ingredients: "ok",
      purposes: "ok",
      risks: "ok",
      doses: "ok",
    });
  });

  it("flags partial:true, reports unavailable risks, and suppresses public caching when productrisk fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("productlicence")) {
          return {
            ok: true,
            json: async () => ({
              data: [
                {
                  lnhpd_id: 123,
                  licence_number: "80000001",
                  product_name: "Test Flax",
                  flag_product_status: 1,
                },
              ],
            }),
          };
        }
        if (url.includes("productrisk")) {
          return { ok: false, status: 503 };
        }
        return {
          ok: true,
          json: async () => ({ data: [] }),
        };
      })
    );

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body.partial).toBe(true);
    expect(body.unavailableSections).toEqual(["risks"]);
    expect(body.sectionStatus.risks).toBe("unavailable");
  });

  it("returns 502 with no-store when all 4 detail sections fail upstream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("productlicence")) {
          return {
            ok: true,
            json: async () => ({
              data: [
                {
                  lnhpd_id: 123,
                  licence_number: "80000001",
                  product_name: "Test Flax",
                  flag_product_status: 1,
                },
              ],
            }),
          };
        }
        return { ok: false, status: 502 };
      })
    );

    const res = await GET(makeReq());
    expect(res.status).toBe(502);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("flags herbMatchingUnavailable and disables caching when DB interaction check fails", async () => {
    resolveHerbMock.mockRejectedValueOnce(
      new InteractionDataUnavailableError("DB down")
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("productlicence")) {
          return {
            ok: true,
            json: async () => ({
              data: [
                {
                  lnhpd_id: 123,
                  licence_number: "80000001",
                  product_name: "Test Flax",
                  flag_product_status: 1,
                },
              ],
            }),
          };
        }
        if (url.includes("medicinalingredient")) {
          return {
            ok: true,
            json: async () => ({
              data: [{ ingredient_name: "Flaxseed" }],
            }),
          };
        }
        return { ok: true, json: async () => ({ data: [] }) };
      })
    );

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body.partial).toBe(true);
    expect(body.herbMatchingUnavailable).toBe(true);
  });

  it("marks unrecognized HTTP 200 section payload as unavailable with partial:true and Cache-Control: no-store", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("productlicence")) {
          return {
            ok: true,
            json: async () => ({
              data: [
                {
                  lnhpd_id: 123,
                  licence_number: "80000001",
                  product_name: "Test Flax",
                  flag_product_status: 1,
                },
              ],
            }),
          };
        }
        if (url.includes("productrisk")) {
          return {
            ok: true,
            json: async () => ({ error: "temporary format mismatch" }),
          };
        }
        return { ok: true, json: async () => ({ data: [] }) };
      })
    );

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body.partial).toBe(true);
    expect(body.unavailableSections).toEqual(["risks"]);
    expect(body.sectionStatus.risks).toBe("unavailable");
  });

  it("returns 502 with no-store instead of 404 when productlicence returns HTTP 200 with an unrecognized shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: "upstream maintenance" }),
      }))
    );

    const res = await GET(makeReq());
    expect(res.status).toBe(502);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
