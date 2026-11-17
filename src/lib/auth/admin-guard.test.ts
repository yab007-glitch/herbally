import { describe, expect, it, vi, beforeEach } from "vitest";

const { getUserMock, singleMock, getAalMock, listFactorsMock } = vi.hoisted(
  () => ({
    getUserMock: vi.fn(),
    singleMock: vi.fn(),
    getAalMock: vi.fn(),
    listFactorsMock: vi.fn(),
  })
);

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: getUserMock,
      mfa: {
        getAuthenticatorAssuranceLevel: getAalMock,
        listFactors: listFactorsMock,
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: singleMock,
        }),
      }),
    }),
  }),
}));

import { getAdminAccess } from "./admin-guard";

describe("getAdminAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthenticated when no user session exists", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    expect(await getAdminAccess()).toEqual({ status: "unauthenticated" });
  });

  it("returns forbidden for signed-in non-admin users", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    singleMock.mockResolvedValue({ data: { role: "user" } });
    expect(await getAdminAccess()).toEqual({ status: "forbidden" });
  });

  it("requires MFA enrollment when admin has no verified TOTP factor", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "a1" } } });
    singleMock.mockResolvedValue({ data: { role: "admin" } });
    getAalMock.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal1" },
    });
    listFactorsMock.mockResolvedValue({ data: { totp: [] } });

    const res = await getAdminAccess();
    expect(res.status).toBe("mfa_enroll_required");
  });

  it("requires MFA challenge when verified TOTP exists but session is aal1", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "a1" } } });
    singleMock.mockResolvedValue({ data: { role: "admin" } });
    getAalMock.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
    });
    listFactorsMock.mockResolvedValue({
      data: {
        totp: [{ id: "f1", status: "verified", friendly_name: "Phone" }],
      },
    });

    const res = await getAdminAccess();
    expect(res).toMatchObject({ status: "mfa_required", factorId: "f1" });
  });

  it("authorizes admin when verified TOTP exists and session is aal2", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "a1" } } });
    singleMock.mockResolvedValue({ data: { role: "admin" } });
    getAalMock.mockResolvedValue({
      data: { currentLevel: "aal2", nextLevel: "aal2" },
    });
    listFactorsMock.mockResolvedValue({
      data: {
        totp: [
          {
            id: "f1",
            status: "verified",
            friendly_name: "Admin TOTP",
            created_at: "2026-11-16T00:00:00Z",
          },
        ],
      },
    });

    const res = await getAdminAccess();
    expect(res.status).toBe("authorized");
  });
});
