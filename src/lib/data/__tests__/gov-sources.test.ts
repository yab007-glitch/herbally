import { describe, it, expect } from "vitest";
import { getGovSources, hasGovMonograph } from "../gov-sources";

describe("gov-sources", () => {
  it("recognizes an EMA HMPC monograph row as a direct government monograph without duplicating the EMA index", () => {
    const sources = [
      {
        source: "European Medicines Agency (HMPC)",
        url: "https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-fragaria-vesca-l-fragaria-moschata-weston-fragaria-viridis-weston-and-fragaria-x-ananassa-weston-duchesne-ex-rozier-folium_en.pdf",
      },
      {
        source: "King's American Dispensatory 1898",
        url: "https://archive.org/details/kingsamericandis01kinguoft",
      },
    ];

    expect(hasGovMonograph("wild-strawberry", sources)).toBe(true);
    const list = getGovSources(
      "wild-strawberry",
      "Wild Strawberry",
      "en",
      sources
    );
    const emaEntries = list.filter((s) => s.id === "ema");
    expect(emaEntries).toHaveLength(1);
    expect(emaEntries[0]).toMatchObject({
      id: "ema",
      kind: "monograph",
      authoritative: true,
      url: sources[0].url,
    });
  });

  it("returns false for herbs with only historical 19th-century books and no government monograph", () => {
    const sources = [
      {
        source: "Fernie's Herbal Simples 1897",
        url: "https://www.gutenberg.org/ebooks/19352",
      },
    ];

    expect(hasGovMonograph("oryza-sativa", sources)).toBe(false);
    const list = getGovSources("oryza-sativa", "Oryza sativa", "en", sources);
    expect(list.some((s) => s.kind === "monograph")).toBe(false);
  });

  it("deduplicates NCCIH while surfacing Health Canada and LiverTox direct monographs", () => {
    const sources = [
      {
        source: "NCCIH",
        url: "https://www.nccih.nih.gov/health/ginger",
      },
      {
        source: "Health Canada",
        url: "https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid=ginger.gingembre2&lang=eng",
      },
      {
        source: "LiverTox",
        url: "https://www.ncbi.nlm.nih.gov/books/n/livertox/Ginger/",
      },
    ];

    expect(hasGovMonograph("ginger", sources)).toBe(true);
    const list = getGovSources("ginger", "Ginger", "fr", sources);
    expect(list.filter((s) => s.id === "nccih")).toHaveLength(1);
    expect(list.find((s) => s.id === "health-canada")).toMatchObject({
      kind: "monograph",
      authoritative: true,
    });
    expect(list.find((s) => s.id === "livertox")).toMatchObject({
      kind: "monograph",
      authoritative: true,
    });
  });

  it("maps direct EMA, Health Canada, and NCCIH monographs so audited herbs never show a false no-monograph notice", () => {
    for (const slug of [
      "comfrey",
      "wormwood",
      "hops",
      "senna-leaf",
      "chaga",
      "garcinia-gummi-gutta",
      "kratom",
    ]) {
      expect(hasGovMonograph(slug, [])).toBe(true);
    }

    expect(hasGovMonograph("conium-maculatum-herb", [])).toBe(false);
    expect(hasGovMonograph("oryza-sativa", [])).toBe(false);
  });
});
