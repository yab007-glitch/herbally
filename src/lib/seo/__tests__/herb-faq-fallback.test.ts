import { describe, it, expect } from "vitest";
import { buildHerbFallbackFaqs } from "../herb-faq-fallback";

// Minimal stub translator: echoes key + JSON params (proves wiring, not copy).
const t = (key: string, params?: Record<string, string | number>) =>
  `${key}(${JSON.stringify(params ?? {})})`;

const base = {
  herbName: "Turmeric",
  scientificName: "Curcuma longa",
  uses: ["inflammation", "digestion"],
  safetyNotes: "",
  pregnancyCategory: "insufficient",
  drugInteractions: 3,
  commonNames: ["Turmeric"],
};

describe("buildHerbFallbackFaqs", () => {
  it("builds five FAQs with interpolated params", () => {
    const faqs = buildHerbFallbackFaqs(base, t);
    expect(faqs).toHaveLength(5);
    expect(faqs[0].question).toContain("whatIs");
    expect(faqs[0].answer).toContain("Turmeric");
    // interaction count flows through (plural handled by real translator)
    expect(faqs[2].answer).toContain('"count":3');
  });

  it("uses the no-common-names variant when absent", () => {
    const faqs = buildHerbFallbackFaqs({ ...base, commonNames: [] }, t);
    expect(faqs[0].question).toContain("usedFor");
  });

  it("switches branches on interaction count", () => {
    const some = buildHerbFallbackFaqs(base, t);
    const none = buildHerbFallbackFaqs({ ...base, drugInteractions: 0 }, t);
    expect(some[2].answer).toContain("interactSome");
    expect(none[2].answer).toContain("interactNone");
  });

  it("returns toxicology-only FAQs (no therapeutic uses or dose CTA) for dangerous herbs", () => {
    const faqs = buildHerbFallbackFaqs(
      {
        ...base,
        herbName: "Belladonna",
        pregnancyCategory: "safe",
        isDangerous: true,
        showCalculator: false,
      },
      t
    );
    expect(faqs).toHaveLength(4);
    expect(faqs[0].question).toContain("dangerousOverviewQuestion");
    expect(faqs[0].answer).toContain("dangerousOverviewAnswer");
    expect(faqs[1].answer).toContain("pregUnsafe");
    expect(faqs[2].answer).toContain("interactDangerous");
    expect(faqs[3].answer).toContain("sideEffectsDangerous");
    expect(faqs.some((f) => f.question.includes("usedFor"))).toBe(false);
    expect(faqs.some((f) => f.question.includes("whatIs"))).toBe(false);
    expect(faqs.some((f) => f.question.includes("doseQuestion"))).toBe(false);
  });

  it("omits doseQuestion when showCalculator is false even for non-dangerous herbs", () => {
    const faqs = buildHerbFallbackFaqs(
      {
        ...base,
        showCalculator: false,
      },
      t
    );
    expect(faqs).toHaveLength(4);
    expect(faqs.some((f) => f.question.includes("doseQuestion"))).toBe(false);
  });
});
