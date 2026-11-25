import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  revalidatePathMock,
  revalidateTagMock,
  getAdminAccessMock,
  fromMock,
  adminFromMock,
} = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
  revalidateTagMock: vi.fn(),
  getAdminAccessMock: vi.fn(),
  fromMock: vi.fn(),
  adminFromMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
  revalidateTag: revalidateTagMock,
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

import { reviewHerbAction } from "../admin-herbs";
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

    fromMock.mockImplementation(() => ({
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
    adminFromMock.mockImplementation(() => ({
      update: () => ({ eq: eqMock }),
    }));

    const res = await markSheetReviewed("turmeric", "Dr. Dawn Wong");

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

  it("sanitizes database errors in markSheetReviewed", async () => {
    const eqMock = vi.fn().mockResolvedValue({
      error: { message: 'relation "herb_pubmed_monographs" constraint failed' },
    });
    adminFromMock.mockImplementation(() => ({
      update: () => ({ eq: eqMock }),
    }));

    const res = await markSheetReviewed("turmeric", "Dr. Dawn Wong");

    expect(res).toEqual({
      success: false,
      error: "Failed to mark sheet as reviewed.",
    });
  });
});
