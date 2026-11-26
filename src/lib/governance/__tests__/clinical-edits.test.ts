import { describe, expect, it } from "vitest";
import {
  clinicalEditSubmissionSchema,
  normalizeLinkedInProfileUrl,
  parseCitationList,
} from "../clinical-edits";

const VALID_BASE = {
  linkedinProfileUrl: "https://ca.linkedin.com/in/dr-jane-pharmd/",
  professionalRole: "pharmacist",
  credentials: "PharmD, RPh",
  affiliation: "Hospital Pharmacy",
  licenceNumber: "ON-12345",
  licenceJurisdiction: "OCP Ontario",
  conflictOfInterest: "None",
  attributionConsent: true,
  noPhiAttested: true,
  targetType: "interaction",
  herbSlug: "ginger",
  drugName: "Warfarin (Coumadin)",
  surfaceUrl: "/interactions/ginger/warfarin",
  fieldScope: "drug_interaction",
  summary: "Reconcile Ginger + Warfarin evidence summary wording",
  currentText: "Grade lowered from moderate to mild.",
  proposedChange:
    "Remove contradictory downgrade sentence and clarify small healthy-volunteer PK/PD study vs. concentrated extract cautions.",
  clinicalRationale:
    "Jiang et al. (2005) studied 12 healthy male volunteers at short-term doses and explicitly noted limits for patients taking warfarin long-term.",
  citations: "PMID:16097960\nhttps://pubmed.ncbi.nlm.nih.gov/32478963/",
  locale: "en",
};

describe("clinical-edits validation", () => {
  it("normalizes valid HTTPS LinkedIn /in/ profile URLs and rejects others", () => {
    expect(
      normalizeLinkedInProfileUrl("https://ca.linkedin.com/in/jane-doe/?trk=1")
    ).toBe("https://www.linkedin.com/in/jane-doe");
    expect(
      normalizeLinkedInProfileUrl("http://linkedin.com/in/jane-doe")
    ).toBeNull();
    expect(
      normalizeLinkedInProfileUrl("https://evil.com/in/jane-doe")
    ).toBeNull();
    expect(
      normalizeLinkedInProfileUrl("https://www.linkedin.com/company/foo")
    ).toBeNull();
  });

  it("parses HTTPS URLs, PMIDs, and DOIs while flagging invalid tokens", () => {
    const good = parseCitationList(
      "pmid 16097960\nDOI: 10.1111/j.1365-2125.2005.02421.x\nhttps://pubmed.ncbi.nlm.nih.gov/32478963/"
    );
    expect(good.invalid).toEqual([]);
    expect(good.valid).toEqual([
      "PMID:16097960",
      "DOI:10.1111/j.1365-2125.2005.02421.x",
      "https://pubmed.ncbi.nlm.nih.gov/32478963/",
    ]);

    const bad = parseCitationList("random blog post");
    expect(bad.invalid).toEqual(["random blog post"]);
  });

  it("enforces no-PHI attestation and conditional herb/drug fields", () => {
    expect(clinicalEditSubmissionSchema.safeParse(VALID_BASE).success).toBe(
      true
    );

    expect(
      clinicalEditSubmissionSchema.safeParse({
        ...VALID_BASE,
        noPhiAttested: false,
      }).success
    ).toBe(false);

    expect(
      clinicalEditSubmissionSchema.safeParse({
        ...VALID_BASE,
        targetType: "interaction",
        drugName: "",
      }).success
    ).toBe(false);

    expect(
      clinicalEditSubmissionSchema.safeParse({
        ...VALID_BASE,
        targetType: "herb",
        herbSlug: "",
        drugName: "",
      }).success
    ).toBe(false);
  });
});
