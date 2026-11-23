import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  RegulatoryEvidenceSection,
  formatDoseText,
  isCrossContaminatedRisk,
  isGarbageOrHomeopathicDose,
  type RegulatoryEvidence,
} from "../regulatory-evidence";

const makeEvidence = (
  overrides: Partial<RegulatoryEvidence> = {}
): RegulatoryEvidence => ({
  herb_slug: "chamomile",
  source: "Health Canada LNHPD",
  source_licence: "Open Government Licence – Canada",
  purposes: ["Used in Herbal Medicine to help relieve mild digestive upset."],
  doses: [{ text: "1-2 g tea three times daily", population: "Adults" }],
  risks: ["Stop use if hypersensitivity/allergy occurs."],
  products_sampled: 3,
  source_urls: ["https://health-products.canada.ca/lnhpd-bdpsnh/"],
  retrieved_at: "2026-11-22T00:00:00Z",
  ...overrides,
});

describe("regulatory-evidence hygiene helpers", () => {
  it("filters placeholder TBA doses, zero-only doses, and homeopathic units when homeopathic", () => {
    expect(
      isGarbageOrHomeopathicDose({ text: "Quantity Unit TBA" }, false)
    ).toBe(true);
    expect(
      isGarbageOrHomeopathicDose(
        { text: "2 capsules", population: "Sub Pop to be created" },
        false
      )
    ).toBe(true);
    expect(isGarbageOrHomeopathicDose({ text: "0 Oil" }, false)).toBe(true);
    expect(
      isGarbageOrHomeopathicDose({ text: "3–5 globule 3× daily" }, true)
    ).toBe(true);
    expect(
      isGarbageOrHomeopathicDose({ text: "300 mg twice daily" }, false)
    ).toBe(false);
  });

  it("formats zero-lower-bound ranges cleanly in EN and FR", () => {
    expect(formatDoseText("0–2 capsules daily", "en")).toBe(
      "up to 2 capsules daily"
    );
    expect(formatDoseText("0-2 capsules", "fr")).toBe("jusqu'à 2 capsules");
  });

  it("detects cross-contaminated LNHPD risks across mismatched slugs", () => {
    expect(
      isCrossContaminatedRisk(
        "ashwagandha",
        "Rare cases of liver injury associated with green tea extract."
      )
    ).toBe(true);
    expect(
      isCrossContaminatedRisk(
        "green-tea",
        "Rare cases of liver injury associated with green tea extract."
      )
    ).toBe(false);
    expect(
      isCrossContaminatedRisk(
        "ginger",
        "May cause choking if swallowed without sufficient water (psyllium)."
      )
    ).toBe(true);
    expect(
      isCrossContaminatedRisk(
        "dandelion",
        "There is enough drug in this package to seriously harm a child."
      )
    ).toBe(true);
  });
});

describe("RegulatoryEvidenceSection", () => {
  it("withholds LNHPD homeopathic doses and claims when isDangerous is true", () => {
    const ev = makeEvidence({
      herb_slug: "atropa-belladonna-herb",
      purposes: ["Relief of occasional fever symptoms (homeopathic dilution)"],
      doses: [{ text: "5 globules 3x daily", population: "Children" }],
    });

    render(<RegulatoryEvidenceSection evidence={ev} locale="en" isDangerous />);

    expect(
      screen.getByText(/ultra-diluted homeopathic preparations/i)
    ).toBeDefined();
    expect(screen.queryByText(/5 globules/)).toBeNull();
    expect(screen.queryByText(/occasional fever/)).toBeNull();
  });

  it("filters pediatric text, TBA, zero-only, and cross-contaminated risks from rendered output", () => {
    const ev = makeEvidence({
      herb_slug: "serrapeptase",
      doses: [
        { text: "Quantity Unit TBA" },
        { text: "0 Oil", population: "Sub Pop to be created" },
        { text: "1 teaspoon for children 2–5 years" },
        { text: "0–2 capsules daily", population: "Adults" },
      ],
      risks: [
        "Rare cases of liver injury associated with green tea extract-containing products.",
        "There is enough drug in this package to seriously harm a child.",
        "Stop use if hypersensitivity occurs.",
      ],
    });

    render(<RegulatoryEvidenceSection evidence={ev} locale="en" />);

    expect(screen.queryByText(/Quantity Unit TBA/)).toBeNull();
    expect(screen.queryByText(/0 Oil/)).toBeNull();
    expect(screen.queryByText(/for children/)).toBeNull();
    expect(screen.queryByText(/green tea extract/i)).toBeNull();
    expect(screen.queryByText(/seriously harm a child/i)).toBeNull();
    expect(screen.getByText(/up to 2 capsules daily/)).toBeDefined();
    expect(
      screen.getByText(/Stop use if hypersensitivity occurs/)
    ).toBeDefined();
  });
});
