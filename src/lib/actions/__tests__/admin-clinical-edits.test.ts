import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAdminAccessMock, adminFromMock, revalidatePathMock } = vi.hoisted(
  () => ({
    getAdminAccessMock: vi.fn(),
    adminFromMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  })
);

vi.mock("@/lib/auth/admin-guard", () => ({
  getAdminAccess: getAdminAccessMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: adminFromMock,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { updateClinicalEditRequestStatus } from "../admin-clinical-edits";

describe("admin-clinical-edits server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-AAL2 / unauthenticated callers", async () => {
    getAdminAccessMock.mockResolvedValueOnce({ status: "mfa_required" });
    const fd = new FormData();
    fd.set("requestId", "11111111-1111-4111-8111-111111111111");
    fd.set("status", "approved");
    const res = await updateClinicalEditRequestStatus(fd);
    expect(res.success).toBe(false);
    expect(adminFromMock).not.toHaveBeenCalled();
  });

  it("updates status, records audit event, and logs attribution-safe public correction when applied", async () => {
    getAdminAccessMock.mockResolvedValueOnce({
      status: "authorized",
      user: { id: "admin-user-1" },
    });

    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const eventInsertMock = vi.fn().mockResolvedValue({ error: null });
    const correctionInsertMock = vi.fn().mockResolvedValue({ error: null });

    adminFromMock.mockImplementation((table: string) => {
      if (table === "clinical_edit_requests") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "11111111-1111-4111-8111-111111111111",
                  status: "pending",
                  target_type: "interaction",
                  herb_slug: "ginger",
                  drug_name: "Warfarin",
                  surface_url: "/interactions/ginger/warfarin",
                  linkedin_name: "Dr. Ali Patel",
                  credentials: "PharmD",
                  attribution_consent: false,
                },
                error: null,
              }),
            }),
          }),
          update: () => ({ eq: updateEqMock }),
        };
      }
      if (table === "clinical_edit_request_events") {
        return { insert: eventInsertMock };
      }
      if (table === "public_corrections_log") {
        return { insert: correctionInsertMock };
      }
      return {};
    });

    const fd = new FormData();
    fd.set("requestId", "11111111-1111-4111-8111-111111111111");
    fd.set("status", "applied");
    fd.set("adminNotes", "Verified and updated.");
    fd.set("publishCorrection", "on");
    fd.set("correctionSummary", "Reconciled Ginger-Warfarin evidence summary.");

    const res = await updateClinicalEditRequestStatus(fd);
    expect(res.success).toBe(true);
    expect(updateEqMock).toHaveBeenCalledWith(
      "id",
      "11111111-1111-4111-8111-111111111111"
    );
    expect(eventInsertMock).toHaveBeenCalledTimes(1);
    expect(correctionInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        affected_surface: "/interactions/ginger/warfarin",
        correction_summary: "Reconciled Ginger-Warfarin evidence summary.",
        verified_by: "Yasser Bheekun (editorial)",
      })
    );
  });
});
