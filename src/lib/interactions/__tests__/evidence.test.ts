import { describe, expect, it } from "vitest";
import {
  classifyInteractionEvidence,
  evaluatePublicationGate,
  getAbsenceOfEvidenceNotice,
  getClinicalActionDisplay,
} from "../evidence";

describe("interaction evidence classification, publication gate, and clinical actions", () => {
  it("separates Group A clinical human evidence from Group B nonclinical/theoretical evidence", () => {
    const groupA = classifyInteractionEvidence({
      evidenceLevel: "well-documented",
      evidenceTier: "clinical_trial",
      extrapolationScope: "human_clinical",
    });
    expect(groupA.group).toBe("A");
    expect(groupA.canUseEstablishedWording).toBe(true);

    const groupB = classifyInteractionEvidence({
      evidenceLevel: "well-documented",
      evidenceTier: "in_vitro",
      extrapolationScope: "nonclinical_extrapolated",
    });
    expect(groupB.group).toBe("B");
    expect(groupB.canUseEstablishedWording).toBe(false);
    expect(groupB.badgeEn).toMatch(/nonclinical|extrapolated|theoretical/i);
    expect(groupB.badgeFr).toMatch(/non clinique|théorique|extrapolé/i);
  });

  it("blocks synthesized clinical action text until pair-specific clinician-approved text exists", () => {
    const blocked = getClinicalActionDisplay({
      publicationStatus: "legacy_unreviewed",
      clinicalActionStatus: "unreviewed_blocked",
      pairSpecificClinicalAction: null,
      locale: "en",
    });
    expect(blocked.blocked).toBe(true);
    expect(blocked.text).toMatch(/unreviewed|blocked|clinician review/i);
    expect(blocked.text).not.toMatch(
      /Low risk at usual doses|May be possible/i
    );

    const approved = getClinicalActionDisplay({
      publicationStatus: "published",
      clinicalActionStatus: "clinician_approved",
      pairSpecificClinicalAction:
        "Monitor INR within 5 days if co-administered under prescriber supervision.",
      locale: "en",
    });
    expect(approved.blocked).toBe(false);
    expect(approved.text).toContain("Monitor INR within 5 days");
  });

  it("enforces all publication gate requirements (citations, retraction, applicability, reviewer sign-off, review currency)", () => {
    const baseInput = {
      severity: "severe",
      description: "May potentiate anticoagulant bleeding risk.",
      botanicalApplicability: "oral_standardized_extract",
      clinicalReviewerId: "rev-md-1",
      verifiedAt: "2026-10-01T00:00:00Z",
      nextReviewDueAt: "2027-10-01T00:00:00Z",
      clinicalActionStatus: "clinician_approved" as const,
      citations: [
        {
          sourceType: "regulatory_monograph" as const,
          sourceLicence: "us-federal-public-domain",
          url: "https://livertox.nlm.nih.gov/StJohnsWort.htm",
          retractionStatus: "active" as const,
          claimSupportAnchor: "inhibits CYP3A4 / warfarin metabolism",
        },
      ],
    };

    expect(
      evaluatePublicationGate(baseInput, new Date("2026-11-25T00:00:00Z"))
        .eligible
    ).toBe(true);

    expect(
      evaluatePublicationGate(
        {
          ...baseInput,
          citations: [
            { ...baseInput.citations[0], retractionStatus: "retracted" },
          ],
        },
        new Date("2026-11-25T00:00:00Z")
      ).reasons
    ).toContain("retracted_citation");

    expect(
      evaluatePublicationGate(
        { ...baseInput, clinicalReviewerId: null, verifiedAt: null },
        new Date("2026-11-25T00:00:00Z")
      ).eligible
    ).toBe(false);

    expect(
      evaluatePublicationGate(
        { ...baseInput, nextReviewDueAt: "2026-01-01T00:00:00Z" },
        new Date("2026-11-25T00:00:00Z")
      ).reasons
    ).toContain("review_stale");
  });

  it("provides explicit EN/FR uncertainty and absence-of-evidence copy without reassuring safe wording", () => {
    const en = getAbsenceOfEvidenceNotice("en");
    const fr = getAbsenceOfEvidenceNotice("fr");
    expect(en).toMatch(/not proof of safety|does not mean safe/i);
    expect(fr).toMatch(/ne prouve pas l'absence de risque|pas sans risque/i);
  });

  it("summarizes publication statuses accurately for uniform vs mixed interaction lists", async () => {
    const mod = (await import("../evidence")) as Record<string, unknown>;
    const summarize = mod.summarizeInteractionPublicationStatus as (
      items: Array<{
        publicationStatus?: string | null;
        publication_status?: string | null;
      }>,
      locale: "en" | "fr"
    ) => { kind: string; banner: string; hasLegacyOrUnreviewed: boolean };
    const rowBadge = mod.getInteractionStatusBadge as (
      status: string | null | undefined,
      locale: "en" | "fr"
    ) => { label: string; isPublished: boolean; isHeld: boolean };

    expect(typeof summarize).toBe("function");
    expect(typeof rowBadge).toBe("function");

    const mixed = summarize(
      [
        { publicationStatus: "published" },
        { publicationStatus: "legacy_unreviewed" },
      ],
      "en"
    );
    expect(mixed.kind).toBe("mixed");
    expect(mixed.hasLegacyOrUnreviewed).toBe(true);
    expect(mixed.banner).toMatch(
      /1 clinician-reviewed published record.*1 unreviewed/i
    );

    const allPublished = summarize([{ publicationStatus: "published" }], "en");
    expect(allPublished.kind).toBe("all_published");
    expect(allPublished.hasLegacyOrUnreviewed).toBe(false);

    expect(rowBadge("retracted_hold", "en").isHeld).toBe(true);
    expect(rowBadge("legacy_unreviewed", "fr").label).toMatch(/Non révisée/i);

    const mixedWithHeld = summarize(
      [
        { publicationStatus: "published" },
        { publicationStatus: "quarantined_collision" },
      ],
      "en"
    );
    expect(mixedWithHeld.kind).toBe("mixed");
    expect(mixedWithHeld.banner).toMatch(/1 clinician-reviewed published/i);
    expect(mixedWithHeld.banner).toMatch(/1 quarantined\/withheld/i);
    expect(mixedWithHeld.banner).not.toMatch(/unreviewed legacy/i);

    const mixedThreeWayFr = summarize(
      [
        { publicationStatus: "published" },
        { publicationStatus: "legacy_unreviewed" },
        { publicationStatus: "retracted_hold" },
      ],
      "fr"
    );
    expect(mixedThreeWayFr.kind).toBe("mixed");
    expect(mixedThreeWayFr.banner).toMatch(/1 fiche publiée/i);
    expect(mixedThreeWayFr.banner).toMatch(/1 fiche héritée non révisée/i);
    expect(mixedThreeWayFr.banner).toMatch(/1 fiche retenue\/en quarantaine/i);

    const allHeld = summarize(
      [{ publicationStatus: "quarantined_collision" }],
      "en"
    );
    expect(allHeld.kind).toBe("all_held");
    expect(allHeld.hasLegacyOrUnreviewed).toBe(true);
    expect(allHeld.banner).toMatch(/quarantined or withheld/i);
    expect(allHeld.banner).not.toMatch(/^Unreviewed legacy/i);
  });
});
