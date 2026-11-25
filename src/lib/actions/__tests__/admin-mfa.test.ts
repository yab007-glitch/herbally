import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const profileSingleMock = vi.fn();
const listFactorsMock = vi.fn();
const getAalMock = vi.fn();
const enrollMock = vi.fn();
const unenrollMock = vi.fn();
const challengeAndVerifyMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ success: true, remaining: 9 }),
  rateLimitKey: (route: string, ip: string) => `${route}:${ip}`,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: () => getUserMock(),
      mfa: {
        listFactors: () => listFactorsMock(),
        getAuthenticatorAssuranceLevel: () => getAalMock(),
        enroll: (args: unknown) => enrollMock(args),
        unenroll: (args: unknown) => unenrollMock(args),
        challengeAndVerify: (args: unknown) => challengeAndVerifyMock(args),
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => profileSingleMock(),
        }),
      }),
    }),
  }),
}));

import { startAdminTotpEnrollment, verifyAdminTotpCode } from "../admin-mfa";

describe("admin MFA enrollment and verification boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "admin" } });
  });

  it("blocks startAdminTotpEnrollment at AAL1 when a verified TOTP factor already exists", async () => {
    listFactorsMock.mockResolvedValue({
      data: {
        totp: [{ id: "f-verified", status: "verified" }],
      },
      error: null,
    });
    getAalMock.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    });

    const res = await startAdminTotpEnrollment();
    expect(res.success).toBe(false);
    expect(enrollMock).not.toHaveBeenCalled();
    expect(unenrollMock).not.toHaveBeenCalled();
  });

  it("blocks verifyAdminTotpCode on an unverified factor at AAL1 when a verified factor already exists", async () => {
    listFactorsMock.mockResolvedValue({
      data: {
        totp: [
          { id: "f-verified", status: "verified" },
          { id: "f-unverified", status: "unverified" },
        ],
      },
      error: null,
    });
    getAalMock.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    });

    const res = await verifyAdminTotpCode("f-unverified", "123456");
    expect(res.success).toBe(false);
    expect(challengeAndVerifyMock).not.toHaveBeenCalled();
  });

  it("allows verifyAdminTotpCode on the existing verified factor at AAL1", async () => {
    listFactorsMock.mockResolvedValue({
      data: {
        totp: [{ id: "f-verified", status: "verified" }],
      },
      error: null,
    });
    getAalMock.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    });
    challengeAndVerifyMock.mockResolvedValue({ error: null });

    const res = await verifyAdminTotpCode("f-verified", "123456");
    expect(res.success).toBe(true);
    expect(challengeAndVerifyMock).toHaveBeenCalledWith({
      factorId: "f-verified",
      code: "123456",
    });
  });

  it("allows initial enrollment at AAL1 when no verified factor exists", async () => {
    listFactorsMock.mockResolvedValue({
      data: {
        totp: [{ id: "f-stale", status: "unverified" }],
      },
      error: null,
    });
    getAalMock.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal1" },
      error: null,
    });
    unenrollMock.mockResolvedValue({ error: null });
    enrollMock.mockResolvedValue({
      data: {
        id: "f-new",
        type: "totp",
        totp: { qr_code: "data:image/svg+xml;base64,abc", secret: "SECRET" },
      },
      error: null,
    });

    const res = await startAdminTotpEnrollment();
    expect(res.success).toBe(true);
    expect(unenrollMock).toHaveBeenCalledWith({ factorId: "f-stale" });
    expect(enrollMock).toHaveBeenCalledOnce();
  });

  it("allows backup factor enrollment at AAL2 even when a verified factor exists", async () => {
    listFactorsMock.mockResolvedValue({
      data: {
        totp: [{ id: "f-verified", status: "verified" }],
      },
      error: null,
    });
    getAalMock.mockResolvedValue({
      data: { currentLevel: "aal2", nextLevel: "aal2" },
      error: null,
    });
    enrollMock.mockResolvedValue({
      data: {
        id: "f-backup",
        type: "totp",
        totp: { qr_code: "data:image/svg+xml;base64,def", secret: "SECRET2" },
      },
      error: null,
    });

    const res = await startAdminTotpEnrollment();
    expect(res.success).toBe(true);
    expect(enrollMock).toHaveBeenCalledOnce();
  });
});
