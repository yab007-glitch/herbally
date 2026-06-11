import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Unit tests for /api/openfda — covers validation, error handling,
 * and the Next.js fetch cache behavior.
 */

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

async function loadRoute() {
  const mod = await import("../openfda/route");
  return mod;
}

function makeRequest(params: { term?: string }): NextRequest {
  const url = new URL("http://localhost/api/openfda");
  if (params.term) url.searchParams.set("term", params.term);
  return new NextRequest(url);
}

beforeEach(() => {
  process.env.OPENFDA_BASE_URL = "https://api.fda.gov";
  fetchMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/openfda", () => {
  it("returns 400 when term is missing", async () => {
    const { GET } = await loadRoute();
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Missing term/i);
  });

  it("returns OpenFDA results on successful lookup", async () => {
    const mockResponse = {
      meta: { results: { total: 5 } },
      results: [{ safetyreportid: "123" }],
    };

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    );

    const { GET } = await loadRoute();
    const res = await GET(makeRequest({ term: "ibuprofen" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.meta.results.total).toBe(5);
    expect(json.results[0].safetyreportid).toBe("123");
  });

  it("returns empty results when OpenFDA responds with error", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Not Found", { status: 404 })
    );

    const { GET } = await loadRoute();
    const res = await GET(makeRequest({ term: "unknown" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toEqual([]);
  });

  it("returns empty results on network errors", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Connection timeout"));

    const { GET } = await loadRoute();
    const res = await GET(makeRequest({ term: "aspirin" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toEqual([]);
  });

  it("calls the correct OpenFDA endpoint URL", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [] }), { status: 200 })
    );

    const { GET } = await loadRoute();
    await GET(makeRequest({ term: "aspirin" }));

    const url = (fetchMock.mock.calls[0][0] as string);
    expect(url).toContain("api.fda.gov/drug/event.json");
    expect(url).toContain("patient.drug.medicinalproduct");
    expect(url).toContain("aspirin");
  });

  it("includes the Next.js fetch cache revalidation option", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [] }), { status: 200 })
    );

    const { GET } = await loadRoute();
    await GET(makeRequest({ term: "aspirin" }));

    const init = fetchMock.mock.calls[0][1] as RequestInit & {
      next?: { revalidate?: number };
    };
    expect(init).toBeDefined();
    // 24-hour revalidation for adverse event data
    expect(init.next?.revalidate).toBe(86400);
  });
});
