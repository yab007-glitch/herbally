import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations:
    () => (key: string, params?: Record<string, string | number>) =>
      params ? `${key}(${JSON.stringify(params)})` : key,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import {
  InteractionsTable,
  getInteractionSourceLabel,
  type Interaction,
} from "../interactions-table";

describe("getInteractionSourceLabel", () => {
  it("maps authoritative primary agencies accurately without mislabelling as PubMed", () => {
    const cases: Array<[string, "en" | "fr", string]> = [
      ["https://pubmed.ncbi.nlm.nih.gov/15238367/", "en", "Source: PubMed"],
      ["https://pubmed.ncbi.nlm.nih.gov/15238367/", "fr", "Source : PubMed"],
      [
        "https://pmc.ncbi.nlm.nih.gov/articles/PMC3491633/",
        "en",
        "Source: PubMed Central (NIH)",
      ],
      [
        "https://www.ncbi.nlm.nih.gov/books/NBK548292/",
        "en",
        "Source: NIH Bookshelf (LiverTox / LactMed)",
      ],
      [
        "https://www.nccih.nih.gov/health/green-tea",
        "en",
        "Source: NCCIH (NIH)",
      ],
      [
        "https://ods.od.nih.gov/factsheets/WeightLoss/",
        "en",
        "Source: NIH ODS",
      ],
      [
        "https://medlineplus.gov/druginfo/natural/607.html",
        "en",
        "Source: MedlinePlus (NIH)",
      ],
      [
        "https://www.ema.europa.eu/en/medicines/herbal/sennae-folium",
        "en",
        "Source: EMA HMPC",
      ],
      [
        "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid=ginger",
        "en",
        "Source: Health Canada",
      ],
      [
        "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid=ginger",
        "fr",
        "Source : Santé Canada",
      ],
      ["https://dailymed.nlm.nih.gov/dailymed/", "en", "Source: US FDA"],
      [
        "https://www.who.int/publications/i/item/9241545178",
        "en",
        "Source: WHO",
      ],
      [
        "https://www.tga.gov.au/safety/andrographis",
        "en",
        "Source: TGA Australia",
      ],
      [
        "https://www.mskcc.org/cancer-care/integrative-medicine/herbs/goldenseal",
        "en",
        "Source: MSK About Herbs",
      ],
    ];

    for (const [url, locale, expected] of cases) {
      expect(getInteractionSourceLabel(url, locale)).toBe(expected);
      if (!url.includes("pubmed.ncbi.nlm.nih.gov")) {
        expect(getInteractionSourceLabel(url, locale)).not.toContain(
          "PubMed record"
        );
      }
    }
  });
});

describe("InteractionsTable", () => {
  it("sorts Contraindicated and Severe rows first and never collapses >5 critical rows", () => {
    const interactions: Interaction[] = [
      {
        id: "1",
        drug_name: "Amlodipine",
        severity: "mild",
        description: "Mild effect",
      },
      {
        id: "2",
        drug_name: "Metformin",
        severity: "moderate",
        description: "Moderate effect",
      },
      {
        id: "3",
        drug_name: "Digoxin",
        severity: "severe",
        description: "Severe 1",
      },
      {
        id: "4",
        drug_name: "Warfarin",
        severity: "severe",
        description: "Severe 2",
      },
      {
        id: "5",
        drug_name: "Irinotecan",
        severity: "contraindicated",
        description: "Contra 1",
      },
      {
        id: "6",
        drug_name: "Cyclosporine",
        severity: "contraindicated",
        description: "Contra 2",
      },
      {
        id: "7",
        drug_name: "Tacrolimus",
        severity: "severe",
        description: "Severe 3",
      },
      {
        id: "8",
        drug_name: "Saquinavir",
        severity: "severe",
        description: "Severe 4",
      },
      {
        id: "9",
        drug_name: "Simvastatin",
        severity: "moderate",
        description: "Moderate 2",
      },
    ];

    render(
      <InteractionsTable interactions={interactions} herbSlug="st-johns-wort" />
    );

    const tbody = screen.getByRole("table").querySelector("tbody")!;
    const rows = within(tbody).getAllByRole("row");

    // 6 critical rows (2 contraindicated + 4 severe) exceed INITIAL_COUNT=5,
    // so all 6 must render uncollapsed, with Contraindicated sorted before Severe.
    expect(rows).toHaveLength(6);
    expect(rows[0].textContent).toContain("Cyclosporine");
    expect(rows[1].textContent).toContain("Irinotecan");
    expect(rows[2].textContent).toContain("Digoxin");
    expect(screen.queryByText("Amlodipine")).toBeNull();
    expect(screen.getByRole("button")).toBeDefined();
  });
});
