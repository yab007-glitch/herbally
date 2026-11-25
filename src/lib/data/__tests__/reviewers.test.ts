import { describe, expect, it, vi } from "vitest";
import * as reviewersModule from "../reviewers";

function mockReviewerClient(row: Record<string, unknown> | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const limit = vi.fn(() => ({ maybeSingle }));
  const or = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ or }));
  return {
    from: vi.fn((table: string) => {
      if (table !== "reviewer_registry") {
        throw new Error(`Unexpected table ${table}`);
      }
      return { select };
    }),
  };
}

describe("reviewer_registry runtime attribution and clinical verification", () => {
  it("resolves a consented, verified clinical reviewer with an active licence from reviewer_registry", async () => {
    const resolvePublicReviewerFromDb = (
      reviewersModule as Record<string, unknown>
    ).resolvePublicReviewerFromDb as (
      ref: string,
      client?: unknown
    ) => Promise<reviewersModule.Reviewer | null>;
    expect(typeof resolvePublicReviewerFromDb).toBe("function");

    const client = mockReviewerClient({
      reviewer_id: "clinician-active-1",
      display_name: "Dr. Samira Patel",
      credentials: "MD, FRCPC",
      reviewer_role: "clinical",
      consent_recorded: true,
      public_attribution_allowed: true,
      licence_number_verified: true,
      licence_jurisdiction: "CPSO Ontario",
      licence_expires_at: "2099-01-01",
      verified_at: "2026-11-20T00:00:00Z",
    });

    const reviewer = await resolvePublicReviewerFromDb(
      "clinician-active-1",
      client
    );
    expect(reviewer).toMatchObject({
      id: "clinician-active-1",
      name: "Dr. Samira Patel",
      role: "clinical",
      consentRecorded: true,
      publicAttributionAllowed: true,
      licenceNumberVerified: true,
      licenceJurisdiction: "CPSO Ontario",
    });
  });

  it("refuses public attribution when consent_recorded or public_attribution_allowed is false", async () => {
    const resolvePublicReviewerFromDb = (
      reviewersModule as Record<string, unknown>
    ).resolvePublicReviewerFromDb as (
      ref: string,
      client?: unknown
    ) => Promise<reviewersModule.Reviewer | null>;

    const client = mockReviewerClient({
      reviewer_id: "rev-no-consent",
      display_name: "Dr. Private",
      credentials: "MD",
      reviewer_role: "clinical",
      consent_recorded: false,
      public_attribution_allowed: true,
      licence_number_verified: true,
      licence_jurisdiction: "CMQ",
      licence_expires_at: "2099-01-01",
      verified_at: "2026-11-20T00:00:00Z",
    });

    expect(
      await resolvePublicReviewerFromDb("rev-no-consent", client)
    ).toBeNull();
  });

  it("refuses clinical verification when licence_number_verified is false or licence is expired", async () => {
    const resolveVerifiedClinicalReviewer = (
      reviewersModule as Record<string, unknown>
    ).resolveVerifiedClinicalReviewer as (
      ref: string,
      client?: unknown
    ) => Promise<reviewersModule.Reviewer | null>;
    expect(typeof resolveVerifiedClinicalReviewer).toBe("function");

    const expiredClient = mockReviewerClient({
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
    });
    expect(
      await resolveVerifiedClinicalReviewer("rev-expired", expiredClient)
    ).toBeNull();

    const editorialClient = mockReviewerClient({
      reviewer_id: "editor-1",
      display_name: "Editor User",
      credentials: "MSc",
      reviewer_role: "editorial",
      consent_recorded: true,
      public_attribution_allowed: true,
      licence_number_verified: false,
      licence_jurisdiction: null,
      licence_expires_at: null,
      verified_at: "2026-11-20T00:00:00Z",
    });
    expect(
      await resolveVerifiedClinicalReviewer("editor-1", editorialClient)
    ).toBeNull();
  });
});
