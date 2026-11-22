import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HerbSources, partitionSources } from "../herb-sources";

describe("partitionSources", () => {
  it("separates regulatory/clinical sources from pure botanical taxonomy registries", () => {
    const { referenceSources, taxonomySources } = partitionSources([
      "Health Canada LNHPD",
      "GBIF",
      "NCBI Taxonomy",
      "PubMed",
      "ITIS",
    ]);

    expect(referenceSources).toEqual(["Health Canada LNHPD", "PubMed"]);
    expect(taxonomySources).toEqual(["GBIF", "NCBI Taxonomy", "ITIS"]);
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

  it("shows 0 independent clinical/regulatory sources when only taxonomy registries exist", () => {
    render(<HerbSources sources={["GBIF", "NCBI Taxonomy"]} />);

    expect(screen.getByText("0 independent sources")).toBeDefined();
    expect(screen.getByText("Botanical identity confirmed via:")).toBeDefined();
  });
});
