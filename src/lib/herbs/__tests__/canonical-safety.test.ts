import { describe, expect, it } from "vitest";
import {
  resolvePregnancyNursingStatus,
  verdictToBoolean,
} from "../canonical-safety";

describe("resolvePregnancyNursingStatus", () => {
  it("preserves unknown (null) distinct from not_recommended (false)", () => {
    const res = resolvePregnancyNursingStatus({
      slug: "turmeric",
      pregnancy_safe: null,
      nursing_safe: null,
      pregnancy_safe_oral: null,
      pregnancy_safe_topical: null,
    });
    expect(res.pregnancy).toBe("unknown");
    expect(res.nursing).toBe("unknown");
    expect(res.pregnancyRouteSplit).toBeNull();
    expect(res.nursingRouteSplit).toBeNull();
    expect(verdictToBoolean(res.pregnancy)).toBeNull();
  });

  it("forces dangerous botanicals to not_recommended regardless of raw booleans", () => {
    const res = resolvePregnancyNursingStatus({
      slug: "abrus-precatorius",
      pregnancy_safe: null,
      nursing_safe: true,
    });
    expect(res.isDangerous).toBe(true);
    expect(res.pregnancy).toBe("not_recommended");
    expect(res.nursing).toBe("not_recommended");
  });

  it("captures oral vs topical differences cleanly when routes disagree", () => {
    const res = resolvePregnancyNursingStatus({
      slug: "comfrey",
      pregnancy_safe: false,
      nursing_safe: false,
      pregnancy_safe_oral: false,
      pregnancy_safe_topical: true,
    });
    expect(res.pregnancy).toBe("not_recommended");
    expect(res.pregnancyRouteSplit).toEqual({ oral: false, topical: true });
    expect(res.nursingRouteSplit).toBeNull();
  });

  it("surfaces primary_source cautions (Turmeric false -> not_recommended) while withholding unverified safe (Ginger true -> unknown)", () => {
    const primarySourceProv = {
      verification_method: "primary_source",
      verification_status: "verified",
      verified_source_count: 3,
      review_status: "human_reviewed",
      reviewed_by_name: null,
      reviewed_on: null,
    };

    const turmeric = resolvePregnancyNursingStatus(
      {
        slug: "turmeric",
        pregnancy_safe: false,
        nursing_safe: false,
      },
      primarySourceProv
    );
    expect(turmeric.pregnancy).toBe("not_recommended");
    expect(turmeric.nursing).toBe("not_recommended");

    const ginger = resolvePregnancyNursingStatus(
      {
        slug: "ginger",
        pregnancy_safe: true,
        nursing_safe: true,
        pregnancy_safe_oral: true,
        pregnancy_safe_topical: false,
      },
      primarySourceProv
    );
    expect(ginger.pregnancy).toBe("unknown");
    expect(ginger.nursing).toBe("unknown");
    expect(ginger.pregnancyRouteSplit).toBeNull();
  });

  it("withholds unverified ai_generated booleans as unknown", () => {
    const aiProv = {
      verification_method: "ai_generated",
      verified_source_count: 0,
    };
    const res = resolvePregnancyNursingStatus(
      {
        slug: "test-herb",
        pregnancy_safe: false,
        nursing_safe: true,
      },
      aiProv
    );
    expect(res.pregnancy).toBe("unknown");
    expect(res.nursing).toBe("unknown");
  });

  it("keeps explicit false on needs_re_review while hiding true as unknown", () => {
    const reReviewProv = {
      review_status: "needs_re_review",
      sources: ["PubMed"],
    };
    const res = resolvePregnancyNursingStatus(
      {
        slug: "test-herb",
        pregnancy_safe: false,
        nursing_safe: true,
      },
      reReviewProv
    );
    expect(res.pregnancy).toBe("not_recommended");
    expect(res.nursing).toBe("unknown");
  });

  it("reveals safe and route splits when named human_reviewed provenance is verified", () => {
    const reviewedProv = {
      verification_method: "primary_source",
      review_status: "human_reviewed",
      reviewed_by_name: "Dr. Jane Smith",
      reviewed_on: "2026-11-20",
      verified_source_count: 2,
    };
    const res = resolvePregnancyNursingStatus(
      {
        slug: "ginger",
        pregnancy_safe: true,
        nursing_safe: true,
        pregnancy_safe_oral: true,
        pregnancy_safe_topical: false,
      },
      reviewedProv
    );
    expect(res.pregnancy).toBe("safe");
    expect(res.nursing).toBe("safe");
    expect(res.pregnancyRouteSplit).toEqual({ oral: true, topical: false });
  });
});
