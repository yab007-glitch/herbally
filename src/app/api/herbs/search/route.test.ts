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
 * Install a fake Supabase client answering the three queries the route makes:
 * the symptom overlap, the precise name filter (its condition starts with
 * `and(`), and the broad text filter. Each records its own condition so a
 * test can assert on the filter that was actually built.
 */
function installSupabase(
  symptomData: HerbRow[],
  textData: HerbRow[],
  preciseData: HerbRow[] = textData
) {
  const preciseConditions: string[] = [];
  const textConditions: string[] = [];

  createClientMock.mockResolvedValue({
    from: vi.fn(() => {
      let kind: "symptom" | "precise" | "text" = "symptom";
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        overlaps: vi.fn(() => builder),
        or: vi.fn((condition: string) => {
          if (condition.startsWith("and(")) {
            kind = "precise";
            preciseConditions.push(condition);
          } else {
            kind = "text";
            textConditions.push(condition);
          }
          return builder;
        }),
        limit: vi.fn(() =>
          Promise.resolve({
            data:
              kind === "precise"
                ? preciseData
                : kind === "text"
                  ? textData
                  : symptomData,
            error: null,
          })
        ),
      };
      return builder;
    }),
  });

  return { preciseConditions, textConditions };
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

  it("uses the x-locale header to localize results", async () => {
    installSupabase([symptomRow], []);

    const response = await POST(
      postRequest(JSON.stringify({ q: "chamomile" }), { "x-locale": "fr" })
    );

    const results = await response.json();
    expect(results[0]).toEqual(expect.objectContaining({ name: "Camomille" }));
  });

  it("sanitizes PostgREST filter metacharacters before building the text query", async () => {
    const { textConditions } = installSupabase([], []);

    await POST(postRequest(JSON.stringify({ q: "pain,danger" })));

    expect(textConditions).toHaveLength(1);
    expect(textConditions[0]).toBe(
      "name.ilike.%paindanger%,scientific_name.ilike.%paindanger%,description.ilike.%paindanger%,translations->fr->>name.ilike.%paindanger%"
    );
  });

  it("asks for name-only matches of every typed word first", async () => {
    const { preciseConditions } = installSupabase([], []);

    await POST(postRequest(JSON.stringify({ q: "milk thistle" })));

    expect(preciseConditions).toHaveLength(1);
    expect(preciseConditions[0]).toContain(
      "and(name.ilike.%milk%,name.ilike.%thistle%),and(scientific_name.ilike.%milk%,scientific_name.ilike.%thistle%),and(translations->fr->>name.ilike.%milk%,translations->fr->>name.ilike.%thistle%)"
    );
    // …and it also carries the anchor words, so a qualified name still
    // brings the herb into the candidate set.
    expect(preciseConditions[0]).toContain("name.ilike.%milk%");
    expect(preciseConditions[0]).toContain("name.ilike.%thistle%");
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
    const { textConditions, preciseConditions } = installSupabase(
      [symptomRow],
      [milkThistle]
    );

    const response = await GET(
      new NextRequest("https://example.test/api/herbs/search?q=chardon-marie")
    );

    expect(response.status).toBe(200);
    expect(textConditions[0]).toContain(
      "translations->fr->>name.ilike.%chardon-marie%"
    );
    // A hyphenated name also has to be searchable without its hyphen, so the
    // precise filter splits it into two required words.
    expect(preciseConditions[0]).toContain(
      "and(translations->fr->>name.ilike.%chardon%,translations->fr->>name.ilike.%marie%)"
    );
    const results = await response.json();
    expect(results[0]).toEqual(
      expect.objectContaining({ slug: "milk-thistle", matchedBy: "name" })
    );
  });

  it("splits elided French articles such as l'ail into searchable tokens", async () => {
    const { textConditions } = installSupabase([], []);

    await GET(
      new NextRequest("https://example.test/api/herbs/search?q=l%27ail")
    );

    expect(textConditions[0]).toContain("translations->fr->>name.ilike.%ail%");
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
});
