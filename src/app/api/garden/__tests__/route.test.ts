import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const getUserMock = vi.fn();
const upsertMock = vi.fn();
const deleteEqMock = vi.fn();
const guestUpsertMock = vi.fn();
const guestDeleteEqMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: () => getUserMock() },
    from: () => ({
      upsert: (row: unknown, opts: unknown) => upsertMock(row, opts),
      delete: () => ({
        eq: () => ({
          eq: () => deleteEqMock(),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      upsert: (row: unknown, opts: unknown) => guestUpsertMock(row, opts),
      delete: () => ({
        eq: () => ({
          eq: () => guestDeleteEqMock(),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/actions/guest-id", () => ({
  getGuestId: async () => "guest-123",
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ success: true, remaining: 29 }),
  rateLimitKey: (route: string, ip: string) => `${route}:${ip}`,
}));

import { POST, DELETE } from "../route";

function makePost(body: unknown): NextRequest {
  const text = JSON.stringify(body);
  return {
    headers: new Headers({ "content-type": "application/json" }),
    text: async () => text,
    json: async () => body,
  } as unknown as NextRequest;
}

function makeDelete(slug: string): NextRequest {
  return {
    url: `https://herbally.app/api/garden?slug=${encodeURIComponent(slug)}`,
    headers: new Headers(),
  } as unknown as NextRequest;
}

describe("/api/garden write acknowledgments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("POST returns 500 with saved:0 and savedSlugs:[] when all upserts fail", async () => {
    upsertMock.mockResolvedValue({ error: { message: "db error" } });
    const res = await POST(
      makePost({
        herbs: [
          {
            slug: "ginger",
            name: "Ginger",
            scientific_name: "Zingiber officinale",
          },
        ],
      })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.saved).toBe(0);
    expect(body.savedSlugs).toEqual([]);
    expect(body.errors).toEqual(["ginger"]);
  });

  it("POST returns 207 with per-slug savedSlugs and errors on partial failure", async () => {
    upsertMock
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "rls error" } });

    const res = await POST(
      makePost({
        herbs: [
          {
            slug: "ginger",
            name: "Ginger",
            scientific_name: "Zingiber officinale",
          },
          {
            slug: "turmeric",
            name: "Turmeric",
            scientific_name: "Curcuma longa",
          },
        ],
      })
    );
    expect(res.status).toBe(207);
    const body = await res.json();
    expect(body).toEqual({
      saved: 1,
      savedSlugs: ["ginger"],
      errors: ["turmeric"],
    });
  });

  it("DELETE returns 500 on failure and 200 {removed:true, slug} on success", async () => {
    deleteEqMock.mockResolvedValueOnce({ error: { message: "db error" } });
    const failRes = await DELETE(makeDelete("ginger"));
    expect(failRes.status).toBe(500);

    deleteEqMock.mockResolvedValueOnce({ error: null });
    const okRes = await DELETE(makeDelete("ginger"));
    expect(okRes.status).toBe(200);
    expect(okRes.headers.get("cache-control")).toBe("private, no-store");
    expect(await okRes.json()).toEqual({ removed: true, slug: "ginger" });
  });
});
