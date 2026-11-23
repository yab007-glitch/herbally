import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HerbSources, partitionSources } from "../herb-sources";

describe("partitionSources", () => {
  it("separates regulatory/clinical sources from pure botanical taxonomy registries and pre-modern books", () => {
    const { referenceSources, taxonomySources, historicalSources } =
      partitionSources([
        "Health Canada LNHPD",
        "GBIF",
        "NCBI Taxonomy",
        "PubMed",
        "ITIS",
        "King's American Dispensatory 1898",
        "US Dispensatory 1918",
        "EMA",
        "EMA HMPC",
      ]);

    expect(referenceSources).toEqual([
      "Health Canada LNHPD",
      "PubMed",
      "European Medicines Agency (HMPC)",
    ]);
    expect(taxonomySources).toEqual(["GBIF", "NCBI Taxonomy", "ITIS"]);
    expect(historicalSources).toEqual([
      "King's American Dispensatory 1898",
      "US Dispensatory 1918",
    ]);
  });
});

describe("HerbSources", () => {
  it("counts only clinical/regulatory/literature sources and renders taxonomy registries under botanical identity", () => {
    render(
      <HerbSources
        sources={["Health Canada LNHPD", "GBIF", "NCBI Taxonomy"]}
        lastChecked="2026-11-22"
      />
    );

    expect(screen.getByText(/1 independent sources/)).toBeDefined();
    expect(screen.getByText("Botanical identity confirmed via:")).toBeDefined();
    expect(screen.getByText("GBIF")).toBeDefined();
    expect(screen.getByText("NCBI Taxonomy")).toBeDefined();
  });

  it("excludes pre-modern historical archival texts from the modern source count and deduplicates EMA aliases", () => {
    render(
      <HerbSources
        sources={[
          "EMA",
          "EMA HMPC",
          "King's American Dispensatory 1898",
          "US Dispensatory 1918",
        ]}
      />
    );

    expect(screen.getByText("1 independent sources")).toBeDefined();
    expect(screen.getByText("European Medicines Agency (HMPC)")).toBeDefined();
    expect(
      screen.getByText(
        "Historical archival texts (pre-modern, not clinical evidence):"
      )
    ).toBeDefined();
  });

  it("shows 0 independent clinical/regulatory sources when only taxonomy registries exist", () => {
    render(<HerbSources sources={["GBIF", "NCBI Taxonomy"]} />);

    expect(screen.getByText("0 independent sources")).toBeDefined();
    expect(screen.getByText("Botanical identity confirmed via:")).toBeDefined();
  });
});
