import { describe, it, expect } from "vitest";
import { drugSlug, pairPath } from "../pair-url";

describe("drugSlug", () => {
  it("uses the generic name, dropping the brand parenthetical", () => {
    expect(drugSlug("Warfarin (Coumadin)")).toBe("warfarin");
    expect(drugSlug("Fluoxetine (Prozac)")).toBe("fluoxetine");
    expect(drugSlug("Alprazolam (Xanax)")).toBe("alprazolam");
  });

  it("slugifies class names", () => {
    expect(drugSlug("Antidepressants (SSRIs)")).toBe("antidepressants");
    expect(drugSlug("Benzodiazepines (general)")).toBe("benzodiazepines");
    expect(drugSlug("Calcium Channel Blockers")).toBe(
      "calcium-channel-blockers"
    );
  });

  it("strips quotes and collapses separators", () => {
    expect(drugSlug("St. John's Wort")).toBe("st-johns-wort");
    expect(drugSlug("  Oral   Contraceptives  ")).toBe("oral-contraceptives");
  });

  it("is collision-free across representative seed pairs", () => {
    // (herb, drug) pairs sharing a herb must map to distinct drug slugs,
    // otherwise two pairs would claim the same URL.
    const pairs: [string, string][] = [
      ["turmeric", "Warfarin (Coumadin)"],
      ["turmeric", "Clopidogrel (Plavix)"],
      ["turmeric", "Aspirin"],
      ["st-johns-wort", "Fluoxetine (Prozac)"],
      ["st-johns-wort", "Sertraline (Zoloft)"],
      ["st-johns-wort", "Warfarin (Coumadin)"],
      ["ginkgo-biloba", "Warfarin (Coumadin)"],
      ["ginkgo-biloba", "Aspirin"],
      ["ashwagandha", "Alprazolam (Xanax)"],
      ["ashwagandha", "Lorazepam (Ativan)"],
    ];
    const seen = new Set<string>();
    for (const [herb, drug] of pairs) {
      const key = `${herb}/${drugSlug(drug)}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe("pairPath", () => {
  it("builds the canonical nested pair URL", () => {
    expect(pairPath("turmeric", "Warfarin (Coumadin)")).toBe(
      "/interactions/turmeric/warfarin"
    );
    expect(pairPath("st-johns-wort", "Fluoxetine (Prozac)")).toBe(
      "/interactions/st-johns-wort/fluoxetine"
    );
  });
});
