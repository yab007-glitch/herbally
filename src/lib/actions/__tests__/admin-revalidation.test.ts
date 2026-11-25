import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  revalidatePathMock,
  revalidateTagMock,
  getAdminAccessMock,
  redirectMock,
  fromMock,
  adminFromMock,
} = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
  revalidateTagMock: vi.fn(),
  getAdminAccessMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  fromMock: vi.fn(),
  adminFromMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
  revalidateTag: revalidateTagMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth/admin-guard", () => ({
  getAdminAccess: getAdminAccessMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: adminFromMock }),
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/data/reviewers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/reviewers")>();
  return {
    ...actual,
    getPublicReviewer: (ref?: string | null) => {
      if (ref === "verified-clinical-reviewer") {
        return {
          id: "verified-clinical-reviewer",
          name: "Verified Clinical Reviewer, MD",
          role: "clinical",
          consentRecorded: true,
          publicAttributionAllowed: true,
          credentials: "MD",
          qualifications: [],
          affiliation: "Clinic",
          affiliations: [{ name: "Clinic" }],
          expertise: [],
          languages: ["English"],
          profileUrl: "https://example.test",
          bio: "Verified clinical reviewer.",
        };
      }
      return actual.getPublicReviewer(ref);
    },
  };
});

import { createHerb, reviewHerbAction, updateHerb } from "../admin-herbs";
import { markSheetReviewed } from "../pubmed-review";

describe("admin & pubmed cache invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminAccessMock.mockResolvedValue({
      status: "authorized",
      supabase: { from: fromMock },
    });
  });

  it("purges all per-slug tags immediately and revalidates EN + FR paths in reviewHerbAction", async () => {
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: { provenance: {} },
      error: null,
    });
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });

    adminFromMock.mockImplementation(() => ({
      select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
      update: () => ({ eq: updateEqMock }),
    }));

    const fd = new FormData();
    fd.set("herb_id", "h-1");
    fd.set("slug", "turmeric");
    fd.set("intent", "mark");

    const res = await reviewHerbAction(fd);

    expect(res.success).toBe(true);
    expect(revalidateTagMock).toHaveBeenCalledWith("herb-turmeric", {
      expire: 0,
    });
    expect(revalidateTagMock).toHaveBeenCalledWith(
      "herb-page-bundle-turmeric",
      { expire: 0 }
    );
    expect(revalidateTagMock).toHaveBeenCalledWith(
      "herb-regulatory-evidence-turmeric",
      { expire: 0 }
    );
    expect(revalidateTagMock).toHaveBeenCalledWith("pubmed-sheet-turmeric", {
      expire: 0,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/herbs/turmeric");
    expect(revalidatePathMock).toHaveBeenCalledWith("/en/herbs/turmeric");
    expect(revalidatePathMock).toHaveBeenCalledWith("/fr/herbs/turmeric");
  });

  it("purges pubmed-sheet and herb-page-bundle tags plus EN + FR paths in markSheetReviewed", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        reviewer_id: "verified-clinical-reviewer",
        display_name: "Dr. Samira Patel",
        credentials: "MD, FRCPC",
        reviewer_role: "clinical",
        consent_recorded: true,
        public_attribution_allowed: true,
        licence_number_verified: true,
        licence_jurisdiction: "CPSO Ontario",
        licence_expires_at: "2099-01-01",
        verified_at: "2026-11-20T00:00:00Z",
      },
      error: null,
    });
    adminFromMock.mockImplementation((table?: string) => {
      if (table === "reviewer_registry") {
        return {
          select: () => ({
            or: () => ({ limit: () => ({ maybeSingle: maybeSingleMock }) }),
          }),
        };
      }
      return {
        update: () => ({ eq: eqMock }),
      };
    });

    const res = await markSheetReviewed(
      "turmeric",
      "verified-clinical-reviewer"
    );

    expect(res).toEqual({
      success: true,
      data: { slug: "turmeric", status: "reviewed" },
    });
    expect(revalidateTagMock).toHaveBeenCalledWith("pubmed-sheet-turmeric", {
      expire: 0,
    });
    expect(revalidateTagMock).toHaveBeenCalledWith(
      "herb-page-bundle-turmeric",
      { expire: 0 }
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/herbs/turmeric");
    expect(revalidatePathMock).toHaveBeenCalledWith("/en/herbs/turmeric");
    expect(revalidatePathMock).toHaveBeenCalledWith("/fr/herbs/turmeric");
  });

  it("rejects markSheetReviewed when DB reviewer is unconsented, editorial, or expired", async () => {
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        reviewer_id: "rev-expired",
        display_name: "Dr. Expired",
        credentials: "MD",
        reviewer_role: "clinical",
        consent_recorded: true,
        public_attribution_allowed: true,
        licence_number_verified: true,
        licence_jurisdiction: "CMQ",
        licence_expires_at: "2020-01-01",
        verified_at: "2026-11-20T00:00:00Z",
      },
      error: null,
    });
    adminFromMock.mockImplementation((table?: string) => {
      if (table === "reviewer_registry") {
        return {
          select: () => ({
            or: () => ({ limit: () => ({ maybeSingle: maybeSingleMock }) }),
          }),
        };
      }
      return {
        update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };
    });

    const res = await markSheetReviewed("turmeric", "rev-expired");
    expect(res.success).toBe(false);
  });

  it("sanitizes database errors in markSheetReviewed", async () => {
    const eqMock = vi.fn().mockResolvedValue({
      error: { message: 'relation "herb_pubmed_monographs" constraint failed' },
    });
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        reviewer_id: "verified-clinical-reviewer",
        display_name: "Dr. Samira Patel",
        credentials: "MD, FRCPC",
        reviewer_role: "clinical",
        consent_recorded: true,
        public_attribution_allowed: true,
        licence_number_verified: true,
        licence_jurisdiction: "CPSO Ontario",
        licence_expires_at: "2099-01-01",
        verified_at: "2026-11-20T00:00:00Z",
      },
      error: null,
    });
    adminFromMock.mockImplementation((table?: string) => {
      if (table === "reviewer_registry") {
        return {
          select: () => ({
            or: () => ({ limit: () => ({ maybeSingle: maybeSingleMock }) }),
          }),
        };
      }
      return {
        update: () => ({ eq: eqMock }),
      };
    });

    const res = await markSheetReviewed(
      "turmeric",
      "verified-clinical-reviewer"
    );

    expect(res).toEqual({
      success: false,
      error: "Failed to mark sheet as reviewed.",
    });
  });

  it("creates and updates herbs via service-role admin client after getAdminAccess() succeeds (post-00104 RETURNING compatibility)", async () => {
    // Post-00104 revokes authenticated SELECT on raw herbs prose/dose columns;
    // simulate that by failing any authenticated client call on herbs.
    fromMock.mockImplementation(() => {
      throw new Error(
        "permission denied for column description on relation herbs"
      );
    });

    const slugMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: null });
    const insertSingle = vi.fn().mockResolvedValue({
      data: { id: "herb-1", slug: "holy-basil" },
      error: null,
    });
    const insertSelect = vi.fn(() => ({ single: insertSingle }));
    const insertMock = vi.fn(() => ({ select: insertSelect }));

    const priorMaybeSingle = vi.fn().mockResolvedValue({
      data: { slug: "holy-basil", name: "Holy Basil", is_published: true },
      error: null,
    });
    const updateSingle = vi.fn().mockResolvedValue({
      data: { id: "herb-1", slug: "holy-basil" },
      error: null,
    });
    const updateSelect = vi.fn(() => ({ single: updateSingle }));
    const updateEq = vi.fn(() => ({ select: updateSelect }));
    const updateMock = vi.fn(() => ({ eq: updateEq }));

    adminFromMock.mockImplementation(() => ({
      select: (cols: string) => ({
        eq: () => ({
          maybeSingle: cols === "slug" ? slugMaybeSingle : priorMaybeSingle,
        }),
      }),
      insert: insertMock,
      update: updateMock,
    }));

    const createFd = new FormData();
    createFd.set("name", "Holy Basil");
    createFd.set("scientific_name", "Ocimum tenuiflorum");
    createFd.set("description", "Adaptogenic culinary herb.");
    createFd.set("dosage_adult", "300 mg daily");
    createFd.set("is_published", "on");

    await expect(createHerb(createFd)).rejects.toThrow(
      "NEXT_REDIRECT:/admin/herbs"
    );
    expect(insertMock).toHaveBeenCalledOnce();
    expect(revalidateTagMock).toHaveBeenCalledWith("herb-holy-basil", {
      expire: 0,
    });

    const updateFd = new FormData();
    updateFd.set("id", "herb-1");
    updateFd.set("name", "Tulsi (Holy Basil)");
    updateFd.set("scientific_name", "Ocimum tenuiflorum");
    updateFd.set("description", "Updated adaptogenic description.");
    updateFd.set("dosage_adult", "400 mg daily");
    updateFd.set("is_published", "on");

    await expect(updateHerb(updateFd)).rejects.toThrow(
      "NEXT_REDIRECT:/admin/herbs"
    );
    expect(updateMock).toHaveBeenCalledOnce();
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/herbs/herb-1/edit");
    expect(revalidatePathMock).toHaveBeenCalledWith("/herbs/holy-basil");
  });

  it("rejects createHerb, updateHerb, and reviewHerbAction without calling admin client when unauthorized", async () => {
    getAdminAccessMock.mockResolvedValue({ status: "forbidden" });

    const fd = new FormData();
    fd.set("id", "herb-1");
    fd.set("herb_id", "herb-1");
    fd.set("slug", "chamomile");
    fd.set("name", "Chamomile");
    fd.set("scientific_name", "Matricaria chamomilla");
    fd.set("description", "Calming herb.");

    expect(await createHerb(fd)).toEqual({
      success: false,
      error: "Not authorized",
    });
    expect(await updateHerb(fd)).toEqual({
      success: false,
      error: "Not authorized",
    });
    expect(await reviewHerbAction(fd)).toEqual({
      success: false,
      error: "Not authorized",
    });
    expect(adminFromMock).not.toHaveBeenCalled();
  });
});
