import { describe, expect, it } from "vitest";
import { resolvePregnancyNursingStatus } from "../canonical-safety";

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
});
