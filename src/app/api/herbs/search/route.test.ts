import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { rateLimitMock, loggerError, createClientMock } = vi.hoisted(() => ({
  rateLimitMock: vi.fn(),
  loggerError: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: rateLimitMock,
  rateLimitKey: (route: string, ip: string) => route + ":" + ip,
}));
vi.mock("@/lib/utils/client-ip", () => ({ getClientIP: () => "test-ip" }));
vi.mock("@/lib/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: loggerError },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { GET, POST } from "./route";

interface HerbRow {
  id: string;
  name: string;
  slug: string;
  scientific_name: string;
  evidence_level: string | null;
  translations: unknown;
}

const symptomRow: HerbRow = {
  id: "1",
  name: "Chamomile",
  slug: "chamomile",
  scientific_name: "Matricaria chamomilla",
  evidence_level: "A",
  translations: { fr: { name: "Camomille" } },
};

const textRow: HerbRow = {
  id: "2",
  name: "Turmeric",
  slug: "turmeric",
  scientific_name: "Curcuma longa",
  evidence_level: "B",
  translations: { fr: { name: "Curcuma" } },
};

/**
 * Install a fake Supabase client answering the four queries the route makes:
 * the symptom overlap, the precise name filter (its condition starts with
 * `and(`), the anchor filter, and the broad text filter. The broad query is
 * always constructed last, so its condition is the final `.or()` recorded;
 * everything else that is not precise is the anchor.
 */
function installSupabase(
  symptomData: HerbRow[],
  textData: HerbRow[],
  preciseData: HerbRow[] = textData,
  anchorData: HerbRow[] = []
) {
  const orConditions: string[] = [];

  createClientMock.mockResolvedValue({
    from: vi.fn(() => {
      let condition: string | undefined;
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        overlaps: vi.fn(() => builder),
        or: vi.fn((next: string) => {
          condition = next;
          orConditions.push(next);
          return builder;
        }),
        limit: vi.fn(() => {
          if (condition === undefined) {
            return Promise.resolve({ data: symptomData, error: null });
          }
          const own = condition;
          // Classify in a microtask, after every query has been constructed.
          return Promise.resolve().then(() => {
            if (own.startsWith("and(")) {
              return { data: preciseData, error: null };
            }
            const isText = orConditions[orConditions.length - 1] === own;
            return { data: isText ? textData : anchorData, error: null };
          });
        }),
      };
      return builder;
    }),
  });

  return { orConditions };
}

function postRequest(body: string, headers: Record<string, string> = {}) {
  return new NextRequest("https://example.test/api/herbs/search", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ success: true, remaining: 0 });
  createClientMock.mockReset();
});

describe("POST /api/herbs/search", () => {
  it("returns ranked results for a valid JSON body", async () => {
    installSupabase([symptomRow], [textRow]);

    const response = await POST(postRequest(JSON.stringify({ q: "turmeric" })));

    expect(response.status).toBe(200);
    const results = await response.json();
    expect(results).toEqual([
      expect.objectContaining({ id: "2", name: "Turmeric", matchedBy: "name" }),
      expect.objectContaining({
        id: "1",
        name: "Chamomile",
        matchedBy: "symptom",
      }),
    ]);
    expect(createClientMock).toHaveBeenCalledTimes(1);
  });

  it("lets the exact name win when two rows share a scientific name", async () => {
    const baiGuo: HerbRow = {
      id: "10",
      name: "Bai Guo",
      slug: "bai-guo",
      scientific_name: "Ginkgo biloba",
      evidence_level: "C",
      translations: null,
    };
    const ginkgo: HerbRow = {
      id: "11",
      name: "Ginkgo Biloba",
      slug: "ginkgo-biloba",
      scientific_name: "Ginkgo biloba",
      evidence_level: "C",
      translations: null,
    };
    installSupabase([], [baiGuo, ginkgo], [baiGuo, ginkgo]);

    const response = await GET(
      new NextRequest("https://example.test/api/herbs/search?q=ginkgo")
    );

    const results = await response.json();
    expect(results).toHaveLength(1);
    expect(results[0].slug).toBe("ginkgo-biloba");
  });

  it("finds the exact herb even when the anchor query returns forty unrelated rows", async () => {
    // Production on 2026-11-17: "st johns wort" matched 249 published names on
    // the two-letter anchor `st`, so the unordered limit window held none of
    // the rows whose name carries every typed word. The queries are separate
    // now, so anchor noise cannot displace the precise row.
    const stJohns: HerbRow = {
      id: "20",
      name: "St. John's Wort",
      slug: "st-johns-wort",
      scientific_name: "Hypericum perforatum",
      evidence_level: "B",
      translations: null,
    };
    const anchorNoise: HerbRow[] = Array.from({ length: 40 }, (_, i) => ({
      id: `noise-${i}`,
      name: `Sticta ${i}`,
      slug: `sticta-${i}`,
      scientific_name: `Sticta species ${i}`,
      evidence_level: null,
      translations: null,
    }));
    installSupabase([], anchorNoise, [stJohns], anchorNoise);

    const response = await GET(
      new NextRequest("https://example.test/api/herbs/search?q=st+johns+wort")
    );

    const results = await response.json();
    expect(results[0].slug).toBe("st-johns-wort");
  });

  it("uses the x-locale header to localize results", async () => {
    installSupabase([symptomRow], []);

    const response = await POST(
      postRequest(JSON.stringify({ q: "chamomile" }), { "x-locale": "fr" })
    );

    const results = await response.json();
    expect(results[0]).toEqual(expect.objectContaining({ name: "Camomille" }));
  });

  it("sanitizes PostgREST filter metacharacters before building the text query without slow description scanning", async () => {
    const { orConditions } = installSupabase([], []);

    await POST(postRequest(JSON.stringify({ q: "pain,danger" })));

    // The precise, anchor and broad queries each carry their own condition;
    // the broad one is always last and excludes description.ilike so PostgREST
    // never scans the PL/pgSQL sanitizer across 3,122 rows.
    expect(orConditions).toHaveLength(3);
    expect(orConditions.at(-1)).toBe(
      "name.ilike.%paindanger%,scientific_name.ilike.%paindanger%,name_fr.ilike.%paindanger%"
    );
  });

  it("flags dangerous plants with isDangerous=true and localizes French names via name_fr", async () => {
    const abrus: HerbRow = {
      id: "99",
      name: "Rosary Pea",
      slug: "abrus-precatorius",
      scientific_name: "Abrus precatorius",
      evidence_level: "D",
      translations: null,
    };
    const safeFrench = {
      ...symptomRow,
      translations: undefined,
      name_fr: "Camomille romaine",
    } as unknown as HerbRow;
    installSupabase([safeFrench], [abrus]);

    const res = await POST(
      postRequest(JSON.stringify({ q: "chamomile" }), { "x-locale": "fr" })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toContainEqual(
      expect.objectContaining({
        slug: "abrus-precatorius",
        isDangerous: true,
      })
    );
    expect(json).toContainEqual(
      expect.objectContaining({
        slug: "chamomile",
        name: "Camomille romaine",
        isDangerous: false,
      })
    );
  });

  it("asks for name-only matches of every typed word first", async () => {
    const { orConditions } = installSupabase([], []);

    await POST(postRequest(JSON.stringify({ q: "milk thistle" })));

    // Precise, anchor, broad — in that order, each as its own query.
    expect(orConditions).toHaveLength(3);
    expect(orConditions[0]).toContain(
      "and(name.ilike.%milk%,name.ilike.%thistle%),and(scientific_name.ilike.%milk%,scientific_name.ilike.%thistle%),and(name_fr.ilike.%milk%,name_fr.ilike.%thistle%)"
    );
    // The anchor is a separate request, so its loose rows can never crowd the
    // precise rows out of one unordered limit window.
    expect(orConditions[1]).not.toContain("and(");
    expect(orConditions[1]).toContain("name.ilike.%milk%");
    expect(orConditions[1]).toContain("name.ilike.%thistle%");
  });

  it("searches French translated names and ranks exact French matches first", async () => {
    const milkThistle: HerbRow = {
      id: "3",
      name: "Milk Thistle",
      slug: "milk-thistle",
      scientific_name: "Silybum marianum",
      evidence_level: "B",
      translations: { fr: { name: "Chardon-Marie" } },
    };
    const { orConditions } = installSupabase([symptomRow], [milkThistle]);

    const response = await GET(
      new NextRequest("https://example.test/api/herbs/search?q=chardon-marie")
    );

    expect(response.status).toBe(200);
    expect(orConditions.at(-1)).toContain("name_fr.ilike.%chardon-marie%");
    // A hyphenated name also has to be searchable without its hyphen, so the
    // precise filter splits it into two required words.
    expect(orConditions[0]).toContain(
      "and(name_fr.ilike.%chardon%,name_fr.ilike.%marie%)"
    );
    const results = await response.json();
    expect(results[0]).toEqual(
      expect.objectContaining({ slug: "milk-thistle", matchedBy: "name" })
    );
  });

  it("splits elided French articles such as l'ail into searchable tokens", async () => {
    const { orConditions } = installSupabase([], []);

    await GET(
      new NextRequest("https://example.test/api/herbs/search?q=l%27ail")
    );

    expect(orConditions.at(-1)).toContain("name_fr.ilike.%ail%");
  });

  it.each([
    ["invalid JSON", "{not json"],
    ["missing q", JSON.stringify({})],
    ["non-string q", JSON.stringify({ q: 123 })],
    ["too-short q", JSON.stringify({ q: "a" })],
    ["too-long q", JSON.stringify({ q: "a".repeat(201) })],
  ])("rejects %s with a 400 and no query work", async (_label, body) => {
    const response = await POST(postRequest(body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual([]);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized body even without a content-length header", async () => {
    const response = await POST(
      postRequest(JSON.stringify({ q: "a".repeat(11000) }))
    );
    expect(response.status).toBe(413);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns 429 and the retry window when rate limited", async () => {
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0 });

    const response = await POST(postRequest(JSON.stringify({ q: "insomnia" })));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(await response.json()).toEqual([]);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("does not log the query or a raw database error message", async () => {
    const query = "private symptom text";
    createClientMock.mockRejectedValue(
      new Error(`database failed while searching for ${query}`)
    );

    const response = await POST(postRequest(JSON.stringify({ q: query })));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(loggerError).toHaveBeenCalled();
    const logged = JSON.stringify(loggerError.mock.calls);
    expect(logged).not.toContain(query);
    expect(logged).not.toContain("database failed");
  });
});

describe("GET /api/herbs/search (legacy callers)", () => {
  it("still searches using the q query parameter", async () => {
    installSupabase([symptomRow], []);

    const response = await GET(
      new NextRequest("https://example.test/api/herbs/search?q=chamomile")
    );

    expect(response.status).toBe(200);
    const results = await response.json();
    expect(results).toEqual([expect.objectContaining({ name: "Chamomile" })]);
  });

  it("still rejects a too-short q with an empty 200 response", async () => {
    const response = await GET(
      new NextRequest("https://example.test/api/herbs/search?q=a")
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("still returns 429 when rate limited", async () => {
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0 });

    const response = await GET(
      new NextRequest("https://example.test/api/herbs/search?q=insomnia")
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(await response.json()).toEqual([]);
  });

  it("never returns dosage_child or pediatric dosing text from search responses", async () => {
    rateLimitMock.mockResolvedValue({ success: true, remaining: 10 });
    const leakyRow = {
      ...symptomRow,
      dosage_child: "50 mg child",
      dosage_adult: "Adults: 300 mg. For children 6-12: 50 mg.",
      translations: {
        fr: {
          name: "Camomille",
          dosage_child: "50 mg enfant",
        },
      },
    } as unknown as HerbRow;

    installSupabase([leakyRow], []);
    const response = await POST(
      postRequest(JSON.stringify({ q: "chamomile" }))
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("dosage_child");
    expect(serialized).not.toContain("50 mg");
  });
});
