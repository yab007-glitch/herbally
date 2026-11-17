import { describe, expect, it } from "vitest";
import { rankHerbMatches, slugifyHerbTerm } from "./rank-herb-match";

const turmeric = {
  slug: "turmeric",
  name: "Turmeric",
  scientific_name: "Curcuma longa",
};
const javaTurmeric = {
  slug: "java-turmeric",
  name: "Turmeric",
  scientific_name: "Curcuma xanthorrhiza",
};
const ginger = {
  slug: "ginger",
  name: "Ginger",
  scientific_name: "Zingiber officinale",
};

describe("slugifyHerbTerm", () => {
  it("turns a display name into a slug", () => {
    expect(slugifyHerbTerm("Turmeric (Curcuma longa)")).toBe(
      "turmeric-curcuma-longa"
    );
  });
});

describe("rankHerbMatches", () => {
  it("returns undefined for no candidates", () => {
    expect(rankHerbMatches([], "turmeric")).toBeUndefined();
  });

  it("prefers the row whose slug is the query when names collide", () => {
    // The production bug: .limit(20) order is unspecified, so the first
    // exact-name row could be Java turmeric and the answer described the
    // wrong species.
    expect(rankHerbMatches([javaTurmeric, turmeric], "Turmeric")).toBe(
      turmeric
    );
  });

  it("keeps the existing exact-name match when no slug matches", () => {
    expect(rankHerbMatches([ginger, turmeric], "Zingiber officinale")).toBe(
      ginger
    );
  });

  it("matches scientific names case-insensitively", () => {
    expect(rankHerbMatches([ginger], "zINGIBER officinale")).toBe(ginger);
  });

  it("falls back to a name prefix match", () => {
    expect(rankHerbMatches([ginger], "Ging")).toBe(ginger);
  });

  it("never invents a herb: an unmatched query returns undefined", () => {
    // rows[0] used to sit here. The caller's ILIKE only proves that SOME word
    // matched somewhere, so checking interactions against that row reports a
    // confident "no interaction" for a herb the reader never asked about.
    expect(rankHerbMatches([ginger], "not-a-herb")).toBeUndefined();
  });

  it("resolves a punctuated name typed without punctuation", () => {
    const stJohns = {
      slug: "st-johns-wort",
      name: "St. John's Wort",
      scientific_name: "Hypericum perforatum",
    };
    const stJohnsOil = {
      slug: "st-johns-wort-oil",
      name: "St. Johns Wort Oil",
      scientific_name: "Hypericum perforatum",
    };
    expect(rankHerbMatches([stJohnsOil, stJohns], "st johns wort")).toBe(
      stJohns
    );
  });

  it("still resolves a trailing qualifier to the herb itself", () => {
    const turmeric = {
      slug: "turmeric",
      name: "Turmeric",
      scientific_name: "Curcuma longa",
    };
    expect(rankHerbMatches([turmeric], "turmeric powder")).toBe(turmeric);
  });

  it("prefers the herb over a preparation with the same words in its name", () => {
    const stJohns = {
      slug: "st-johns-wort",
      name: "St. John's Wort",
      scientific_name: "Hypericum perforatum",
    };
    const stJohnsOil = {
      slug: "st-johns-wort-oil",
      name: "St. Johns Wort Oil",
      scientific_name: "Hypericum perforatum",
    };
    expect(
      rankHerbMatches([stJohnsOil, stJohns], "st johns wort extract")
    ).toBe(stJohns);
  });

  it("resolves a qualified name to the herb it names, not a same-genus sibling", () => {
    // Production on 2026-11-17: "ginkgo leaf" resolved to Bai Guo (Ginkgo
    // biloba seed) and "aloe vera juice" to Barbadian Aloe. Interaction data
    // lives on Ginkgo Biloba (7 pairs) and Aloe Vera (5), so the checker
    // answered "no interaction" for herbs it knows.
    const baiGuo = {
      slug: "bai-guo",
      name: "Bai Guo",
      scientific_name: "Ginkgo biloba",
    };
    const ginkgo = {
      slug: "ginkgo-biloba",
      name: "Ginkgo Biloba",
      scientific_name: "Ginkgo biloba",
    };
    const aloeMaculata = {
      slug: "aloe-maculata",
      name: "Aloe maculata",
      scientific_name: "Aloe maculata",
    };
    const aloeVera = {
      slug: "aloe-vera",
      name: "Aloe Vera",
      scientific_name: "Aloe vera",
    };
    const barbadianAloe = {
      slug: "barbadian-aloe",
      name: "Barbadian Aloe",
      scientific_name: "Aloe vera var. barbadensis",
    };
    expect(rankHerbMatches([baiGuo, ginkgo], "ginkgo leaf")).toBe(ginkgo);
    expect(
      rankHerbMatches(
        [barbadianAloe, aloeMaculata, aloeVera],
        "aloe vera juice"
      )
    ).toBe(aloeVera);
  });

  it("matches exact French names cleanly (e.g. Curcuma -> turmeric, Millepertuis -> st-johns-wort)", () => {
    const curcumaAromatica = {
      slug: "curcuma-aromatica",
      name: "Curcuma Aromatica",
      scientific_name: "Curcuma aromatica",
      frName: "Curcuma Aromatica",
    };
    const turmericFr = {
      ...turmeric,
      frName: "Curcuma",
    };
    const stJohns = {
      slug: "st-johns-wort",
      name: "St. John's Wort",
      scientific_name: "Hypericum perforatum",
      frName: "Millepertuis",
    };
    expect(rankHerbMatches([curcumaAromatica, turmericFr], "Curcuma")).toBe(
      turmericFr
    );
    expect(rankHerbMatches([stJohns], "millepertuis")).toBe(stJohns);
  });
});
