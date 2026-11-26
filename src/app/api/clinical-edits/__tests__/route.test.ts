import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  getSessionMock,
  rateLimitMock,
  adminFromMock,
  isMailConfiguredMock,
  sendMailMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  rateLimitMock: vi.fn(),
  adminFromMock: vi.fn(),
  isMailConfiguredMock: vi.fn(),
  sendMailMock: vi.fn(),
}));

vi.mock("@/lib/auth/linkedin-oidc", () => ({
  getLinkedInReviewerSession: getSessionMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: rateLimitMock,
  rateLimitKey: (ns: string, id: string) => `${ns}:${id}`,
}));

vi.mock("@/lib/utils/client-ip", () => ({
  getClientIP: () => "127.0.0.1",
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: adminFromMock,
  }),
}));

vi.mock("@/lib/email/mailer", () => ({
  isMailConfigured: isMailConfiguredMock,
  sendMail: sendMailMock,
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET, POST } from "../route";

const VALID_BODY = {
  linkedinProfileUrl: "https://www.linkedin.com/in/clinician-one",
  professionalRole: "pharmacist",
  credentials: "PharmD",
  affiliation: "Clinic",
  licenceNumber: "SECRET-LIC-999",
  licenceJurisdiction: "OPQ",
  conflictOfInterest: "None",
  attributionConsent: false,
  noPhiAttested: true,
  targetType: "herb",
  herbSlug: "turmeric",
  drugName: "",
  surfaceUrl: "/herbs/turmeric",
  fieldScope: "evidence_grade",
  summary: "Clarify osteoarthritis vs digestive indications on Turmeric",
  currentText: "Evidence A",
  proposedChange:
    "Scope evidence A to standardized curcumin extract OA trials.",
  clinicalRationale:
    "EMA traditional use vs OA clinical trials differ by extract.",
  citations: "PMID:12345678",
  locale: "en",
  // Attempted spoofing fields (must be ignored by server):
  linkedin_sub: "spoofed-sub",
  linkedin_email: "spoofed@evil.com",
};

describe("/api/clinical-edits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMock.mockResolvedValue({ success: true, remaining: 9 });
    isMailConfiguredMock.mockReturnValue(true);
    sendMailMock.mockResolvedValue({ sent: true, id: "msg-1" });
  });

  it("GET returns 401 when no LinkedIn session is present", async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await GET(
      new NextRequest("https://herbally.test/api/clinical-edits")
    );
    expect(res.status).toBe(401);
  });

  it("GET scopes query strictly to signed-in session linkedin_sub", async () => {
    getSessionMock.mockResolvedValueOnce({
      sub: "li-sub-real",
      name: "Dr. Real",
      email: "real@hospital.org",
      emailVerified: true,
      picture: null,
    });
    const limitMock = vi.fn().mockResolvedValue({
      data: [{ id: "req-1", summary: "Fix", status: "pending" }],
      error: null,
    });
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
    const innerEqMock = vi.fn().mockReturnValue({ order: orderMock });
    const outerEqMock = vi.fn().mockReturnValue({
      eq: innerEqMock,
      order: orderMock,
    });
    adminFromMock.mockReturnValueOnce({
      select: () => ({ eq: outerEqMock }),
    });

    const res = await GET(
      new NextRequest("https://herbally.app/api/clinical-edits?herbSlug=Ginger")
    );
    expect(res.status).toBe(200);
    expect(outerEqMock).toHaveBeenCalledWith("linkedin_sub", "li-sub-real");
    expect(innerEqMock).toHaveBeenCalledWith("herb_slug", "ginger");
  });

  it("POST returns 401 when unauthenticated", async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await POST(
      new NextRequest("https://herbally.test/api/clinical-edits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_BODY),
      })
    );
    expect(res.status).toBe(401);
  });

  it("POST returns 429 when per-reviewer hourly limit is exceeded", async () => {
    getSessionMock.mockResolvedValueOnce({
      sub: "li-sub-real",
      name: "Dr. Real",
      email: "real@hospital.org",
      emailVerified: true,
      picture: null,
    });
    rateLimitMock
      .mockResolvedValueOnce({ success: true, remaining: 9 })
      .mockResolvedValueOnce({ success: false, remaining: 0 });

    const res = await POST(
      new NextRequest("https://herbally.test/api/clinical-edits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_BODY),
      })
    );
    expect(res.status).toBe(429);
  });

  it("POST inserts server-derived LinkedIn identity, writes audit event, and omits private licence from email", async () => {
    getSessionMock.mockResolvedValueOnce({
      sub: "li-sub-real",
      name: "Dr. Real",
      email: "real@hospital.org",
      emailVerified: true,
      picture: null,
    });
    const insertReqMock = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: "req-uuid-1",
            status: "pending",
            created_at: "2026-11-26T00:00:00Z",
          },
          error: null,
        }),
      }),
    });
    const insertEventMock = vi.fn().mockResolvedValue({ error: null });
    adminFromMock.mockImplementation((table: string) => {
      if (table === "clinical_edit_requests") {
        return { insert: insertReqMock };
      }
      if (table === "clinical_edit_request_events") {
        return { insert: insertEventMock };
      }
      return {};
    });

    process.env.ZOHO_SMTP_USER = "info@herbally.app";
    const res = await POST(
      new NextRequest("https://herbally.test/api/clinical-edits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_BODY),
      })
    );
    expect(res.status).toBe(201);
    const insertedRow = insertReqMock.mock.calls[0][0];
    expect(insertedRow.linkedin_sub).toBe("li-sub-real");
    expect(insertedRow.linkedin_email).toBe("real@hospital.org");
    expect(insertedRow.status).toBe("pending");
    expect(insertEventMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0][0].text).not.toContain("SECRET-LIC-999");
  });

  it("POST accepts minimal community user herb edit suggestions without optional clinician fields", async () => {
    getSessionMock.mockResolvedValueOnce({
      sub: "li-sub-user",
      name: "Alex Taylor",
      email: "alex@example.org",
      emailVerified: true,
      picture: null,
    });
    const insertReqMock = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: "req-uuid-2",
            status: "pending",
            created_at: "2026-11-26T00:00:00Z",
          },
          error: null,
        }),
      }),
    });
    adminFromMock.mockImplementation((table: string) => {
      if (table === "clinical_edit_requests") {
        return { insert: insertReqMock };
      }
      if (table === "clinical_edit_request_events") {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {};
    });

    const res = await POST(
      new NextRequest("https://herbally.test/api/clinical-edits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "herb",
          herbSlug: "ginger",
          summary: "Typo in preparation notes",
          proposedChange:
            "Replace 'rhizom' spelling with 'rhizome' in adult use.",
          noPhiAttested: true,
        }),
      })
    );
    expect(res.status).toBe(201);
    const insertedRow = insertReqMock.mock.calls[0][0];
    expect(insertedRow.professional_role).toBe("community_user");
    expect(insertedRow.credentials).toBeNull();
    expect(insertedRow.linkedin_profile_url).toBeNull();
    expect(insertedRow.citations).toEqual([]);
  });
});
