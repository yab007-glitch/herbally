import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockCreateClient, mockGetUser, mockSingle } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockGetUser: vi.fn(),
  mockSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

import { GET } from "../route";

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue({
      auth: { getUser: mockGetUser },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: mockSingle,
          }),
        }),
      }),
    });
  });

  it("fast-paths anonymous requests without invoking Supabase and returns Cache-Control: private, no-store", async () => {
    const req = new NextRequest("https://herbally.app/api/auth/me");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ user: null });
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("returns user metadata and admin flag when Supabase auth cookie resolves", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u-1", email: "reviewer@example.org" } },
    });
    mockSingle.mockResolvedValue({ data: { role: "admin" } });

    const req = new NextRequest("https://herbally.app/api/auth/me", {
      headers: { Cookie: "sb-test-auth-token=jwt-value" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({
      user: {
        id: "u-1",
        email: "reviewer@example.org",
        isAdmin: true,
      },
    });
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });
});
