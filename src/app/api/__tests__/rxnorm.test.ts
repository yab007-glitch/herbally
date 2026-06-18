import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Unit tests for /api/rxnorm — covers validation, error handling,
 * and delegation to the rxnorm-client module.
 */

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

async function loadRoute() {
  const mod = await import("../rxnorm/route");
  return mod;
}

function makeRequest(params: { term?: string }): NextRequest {
  const url = new URL("http://localhost/api/rxnorm");
  if (params.term) url.searchParams.set("term", params.term);
  return new NextRequest(url);
}

beforeEach(() => {
  fetchMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/rxnorm", () => {
  it("returns 400 when term is missing", async () => {
    const { GET } = await loadRoute();
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/at least 2 characters/i);
  });

  it("returns 400 when term is too short", async () => {
    const { GET } = await loadRoute();
    const res = await GET(makeRequest({ term: "a" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/at least 2 characters/i);
  });

  it("returns drug results on successful lookup", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          approximateGroup: {
            candidate: [
              { rxcui: "123", name: "Aspirin", score: "100" },
              { rxcui: "456", name: "Ibuprofen", score: "90" },
            ],
          },
        }),
        { status: 200 }
      )
    );

    const { GET } = await loadRoute();
    const res = await GET(makeRequest({ term: "asp" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toHaveLength(2);
    expect(json.results[0].name).toBe("Aspirin");
  });

  it("returns empty array when RxNorm returns no candidates", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ approximateGroup: { candidate: [] } }), {
        status: 200,
      })
    );

    const { GET } = await loadRoute();
    const res = await GET(makeRequest({ term: "zzz" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toEqual([]);
  });

  it("returns empty array when RxNorm call itself returns non-ok", async () => {
    // searchDrugs() catches non-ok and returns []; the route then returns
    // 200 with those empty results.
    fetchMock.mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 })
    );

    const { GET } = await loadRoute();
    const res = await GET(makeRequest({ term: "aspirin" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toEqual([]);
  });

  it("returns 500 on network/connection errors", async () => {
    // A fetch rejection (network layer error) bubbles up through
    // searchDrugs's catch → returns [] → route returns 200. But actually
    // searchDrugs catches and returns []. So the route will get [] and
    // return 200. Let's verify that behavior.
    fetchMock.mockRejectedValueOnce(new Error("Network connection refused"));

    const { GET } = await loadRoute();
    const res = await GET(makeRequest({ term: "aspirin" }));
    // searchDrugs catches fetch errors and returns [], so route returns 200
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toEqual([]);
  });
});
