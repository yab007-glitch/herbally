import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const { createAdminClientMock, rateLimitMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  rateLimitMock: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (k: string) => k,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/lib/auth/admin-guard", () => ({
  getAdminAccess: vi.fn().mockResolvedValue({ status: "authorized" }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: rateLimitMock,
  rateLimitKey: (route: string, ip: string) => `${route}:${ip}`,
}));

import { getPublicReviewer, getReviewer } from "@/lib/data/reviewers";
import { validateClaimCitation } from "../claim-citations";
import { buildIncidentSubmission } from "../incidents";
import { classifyPageRiskTier } from "../risk-tiering";
import { computeQualityBaseline } from "../../../../scripts/content-quality-baseline";
import { POST } from "@/app/api/safety-incidents/route";
import { AuthorByline } from "@/components/herbs/author-byline";
import { render, screen } from "@testing-library/react";
import { markSheetReviewed } from "@/lib/actions/pubmed-review";

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ success: true, remaining: 9 });
});

describe("Phase C scientific governance & fail-closed attribution", () => {
  it("fails closed on unverified/non-consented reviewer profiles (including dawn-wong) and distinguishes editorial vs clinical roles", () => {
    expect(getReviewer("dawn-wong")).toBeUndefined();
    expect(getPublicReviewer("dawn-wong")).toBeNull();
    expect(getPublicReviewer("Dr. Dawn Wong")).toBeNull();

    const editor = getPublicReviewer("yasser-bheekun");
    expect(editor).not.toBeNull();
    expect(editor?.role).toBe("editorial");
    expect(editor?.consentRecorded).toBe(true);
  });

  it("validates claim-level citations with species/preparation match and retraction blocking", () => {
    const ok = validateClaimCitation({
      claimKey: "chamomile.sedative_effect",
      sourceType: "systematic_review",
      sourceName: "PubMed",
      sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/12345678/",
      publishedAt: "2024-05-01",
      retrievedAt: "2026-11-01T00:00:00Z",
      speciesMatch: true,
      preparationMatch: true,
      evidenceQuality: "moderate",
      retractionStatus: "active",
      reviewerId: "rev-clinical-1",
      reviewerRole: "clinical",
    });
    expect(ok.valid).toBe(true);

    const bad = validateClaimCitation({
      claimKey: "chamomile.pediatric_dose",
      sourceType: "clinical_study",
      sourceName: "PubMed",
      sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/99999999/",
      publishedAt: "2020-01-01",
      retrievedAt: "2026-11-01T00:00:00Z",
      speciesMatch: false,
      preparationMatch: false,
      evidenceQuality: "very_low",
      retractionStatus: "retracted",
      reviewerId: "yasser-bheekun",
      reviewerRole: "editorial",
    });
    expect(bad.valid).toBe(false);
    expect(bad.errors).toContain("retracted_source");
    expect(bad.errors).toContain("species_mismatch");
  });

  it("builds triage/SLA safety incident intake and handles POST /api/safety-incidents", async () => {
    const incident = buildIncidentSubmission({
      category: "pediatric_safety",
      severity: "critical",
      surfaceUrl: "https://herbally.app/en/calculator",
      summary: "Incorrect pediatric unit shown before fix",
      details: "Repro steps without PHI.",
    });
    expect(incident.triageStatus).toBe("open_triage");
    expect(Date.parse(incident.slaDueAt)).toBeGreaterThan(Date.now());

    const insertMock = vi.fn().mockResolvedValue({ error: null });
    createAdminClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === "safety_incidents") {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: { id: "inc-1", ...incident },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { insert: insertMock };
      },
    });

    const req = {
      headers: new Headers({ "content-type": "application/json" }),
      text: async () =>
        JSON.stringify({
          category: "pediatric_safety",
          severity: "critical",
          surfaceUrl: "/en/calculator",
          summary: "Report test",
          details: "Non-identifying technical issue description.",
        }),
    } as unknown as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.accepted).toBe(true);
    expect(body.triageStatus).toBe("open_triage");
  });

  it("defaults clinical pages to conservative noindex/quarantine risk tiers until verified", () => {
    const toxicTier = classifyPageRiskTier({
      slug: "aconite-processed",
      isDangerous: true,
      hasClinicalReview: false,
      hasVerifiedCitation: false,
      hasCollision: false,
    });
    expect(toxicTier.tier).toBe("tier_3_blocked_or_quarantined");
    expect(toxicTier.allowIndex).toBe(false);

    const unreviewedTier = classifyPageRiskTier({
      slug: "turmeric",
      isDangerous: false,
      hasClinicalReview: false,
      hasVerifiedCitation: true,
      hasCollision: false,
    });
    expect(unreviewedTier.requiresClinicalReviewBadge).toBe(true);
    expect(unreviewedTier.defaultIndexPolicy).toBe("noindex_until_reviewed");
  });

  it("computes fresh data-quality baseline from a snapshot fixture without mutating or deleting rows", () => {
    const report = computeQualityBaseline({
      generatedAt: "2026-11-25T00:00:00Z",
      herbs: [
        {
          slug: "turmeric",
          contraindications: ["Gallstones"],
          side_effects: [],
          provenance: { verification_method: "manual" },
          reviewed_by: "yasser-bheekun",
        },
        {
          slug: "mystery-herb",
          contraindications: [],
          side_effects: [],
          provenance: null,
          reviewed_by: null,
        },
      ],
      interactions: [
        {
          id: "1",
          herb_slug: "sage",
          drug_name: "Anticonvulsants",
          source_url: null,
          clinical_reviewer_id: null,
        },
      ],
    });

    expect(report.totalHerbs).toBe(2);
    expect(report.herbsMissingContraindications).toBe(1);
    expect(report.herbsMissingSideEffects).toBe(2);
    expect(report.herbsUnverifiedProvenance).toBe(1);
    expect(report.interactionsMissingPrimaryUrl).toBe(1);
    expect(report.knownUnresolvedCollisions).toBe(6);
  });

  it("uses atomic RPC when available and fails closed when fallback audit insert errors", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: "inc-rpc-1",
      error: null,
    });
    createAdminClientMock.mockReturnValue({ rpc: rpcMock });

    const req = {
      headers: new Headers({ "content-type": "application/json" }),
      text: async () =>
        JSON.stringify({
          category: "pediatric_safety",
          severity: "high",
          surfaceUrl: "/en/calculator",
          summary: "RPC intake check",
          details: "Testing atomic incident RPC.",
        }),
    } as unknown as NextRequest;

    const rpcRes = await POST(req);
    expect(rpcRes.status).toBe(201);
    expect(rpcMock).toHaveBeenCalledWith(
      "create_safety_incident_with_audit",
      expect.any(Object)
    );

    // Fallback path when RPC returns 42883 (function missing pre-00102): audit failure MUST fail closed.
    createAdminClientMock.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "42883", message: "function does not exist" },
      }),
      from: (table: string) => {
        if (table === "safety_incidents") {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: { id: "inc-fallback" },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          insert: async () => ({
            error: { message: "audit table insert denied" },
          }),
        };
      },
    });

    const failRes = await POST(req);
    expect(failRes.status).toBe(500);
  });

  it("renders honest unreviewed editorial label in AuthorByline when isReviewed is false", () => {
    render(
      AuthorByline({
        locale: "en",
        lastReviewed: "2026-11-20",
        isReviewed: false,
      })
    );
    expect(screen.queryByText("Reviewed and verified")).toBeNull();
    expect(screen.getByText(/Editorial compilation/i)).toBeInTheDocument();
  });

  it("rejects unconsented or unverified reviewers in markSheetReviewed", async () => {
    createAdminClientMock.mockReturnValue({
      from: () => ({
        select: () => ({
          or: () => ({
            limit: () => ({
              maybeSingle: async () => ({
                data: {
                  reviewer_id: "dawn-wong",
                  display_name: "Dr. Dawn Wong",
                  reviewer_role: "clinical",
                  consent_recorded: false,
                  public_attribution_allowed: false,
                  licence_number_verified: true,
                  verified_at: null,
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });
    const res = await markSheetReviewed("turmeric", "Dr. Dawn Wong");
    expect(res.success).toBe(false);
  });
});
