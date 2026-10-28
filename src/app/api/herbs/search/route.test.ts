import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { rateLimitMock, loggerError, createClientMock } = vi.hoisted(() => ({
  rateLimitMock: vi.fn(),
  loggerError: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }));
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

/** Install a fake Supabase client that answers the symptom and text queries. */
function installSupabase(symptomData: HerbRow[], textData: HerbRow[]) {
  const orConditions: string[] = [];

  createClientMock.mockResolvedValue({
    from: vi.fn(() => {
      let hasOrCondition = false;
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        overlaps: vi.fn(() => builder),
        or: vi.fn((condition: string) => {
          hasOrCondition = true;
          orConditions.push(condition);
          return builder;
        }),
        limit: vi.fn(() =>
          Promise.resolve({
            data: hasOrCondition ? textData : symptomData,
            error: null,
          })
        ),
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

  it("uses the x-locale header to localize results", async () => {
    installSupabase([symptomRow], []);

    const response = await POST(
      postRequest(JSON.stringify({ q: "chamomile" }), { "x-locale": "fr" })
    );

    const results = await response.json();
    expect(results[0]).toEqual(expect.objectContaining({ name: "Camomille" }));
  });

  it("sanitizes PostgREST filter metacharacters before building the text query", async () => {
    const { orConditions } = installSupabase([], []);

    await POST(postRequest(JSON.stringify({ q: "pain,danger" })));

    expect(orConditions).toHaveLength(1);
    expect(orConditions[0]).toBe(
      "name.ilike.%paindanger%,scientific_name.ilike.%paindanger%,description.ilike.%paindanger%"
    );
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
