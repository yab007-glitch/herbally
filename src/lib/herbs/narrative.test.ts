import { describe, expect, it } from "vitest";
import {
  asSentence,
  joinList,
  narrativeSections,
  quotedContraindications,
  summariseDosage,
  summariseSafety,
  summariseUses,
  NARRATIVE_FR,
} from "@/lib/herbs/narrative";

describe("joinList", () => {
  it("writes prose lists, not comma splices", () => {
    expect(joinList(["a"])).toBe("a");
    expect(joinList(["a", "b"])).toBe("a and b");
    expect(joinList(["a", "b", "c"])).toBe("a, b and c");
    expect(joinList([])).toBe("");
  });
});

describe("asSentence", () => {
  it("strips a source label and closes the sentence", () => {
    expect(asSentence("Contra-Indications: do not use while pregnant")).toBe(
      "Do not use while pregnant."
    );
  });

  it("leaves existing punctuation alone", () => {
    expect(asSentence("Do not use while pregnant.")).toBe(
      "Do not use while pregnant."
    );
  });
});

describe("summariseUses", () => {
  it("turns uses into one sentence with a list", () => {
    expect(
      summariseUses({ name: "Ginger", traditionalUses: ["nausea", "colds"] })
    ).toBe("Traditionally Ginger has been used for nausea and colds.");
  });

  it("says nothing when nothing is recorded", () => {
    expect(summariseUses({ name: "Ginger", traditionalUses: [] })).toBeNull();
  });
});

describe("summariseDosage", () => {
  it("keeps a recorded range verbatim inside the sentence", () => {
    expect(
      summariseDosage({
        name: "Cynanchum glaucescens",
        dosageAdult:
          "300–9000 mg per day, labelled range across 6 licensed products",
      })
    ).toBe(
      "The sources record 300–9000 mg per day, labelled range across 6 licensed products."
    );
  });

  it("does not double-wrap a dosage that is already a sentence", () => {
    expect(
      summariseDosage({ name: "X", dosageAdult: "Take 2 g daily with food." })
    ).toBe("Take 2 g daily with food.");
  });

  it("returns null with no dosage", () => {
    expect(summariseDosage({ name: "X", dosageAdult: null })).toBeNull();
  });
});

describe("summariseSafety", () => {
  it("states the recorded position without hedging into vagueness", () => {
    const text = summariseSafety({
      name: "X",
      pregnancySafe: false,
      nursingSafe: false,
      interactionCount: 3,
    });
    expect(text).toContain("not considered safe in pregnancy");
    expect(text).toContain("not advised");
    expect(text).toContain("3 drug interactions");
  });

  it("says plainly when no interaction is recorded", () => {
    expect(summariseSafety({ name: "X", interactionCount: 0 })).toContain(
      "No drug interactions are recorded"
    );
  });
});

describe("quotedContraindications", () => {
  it("quotes the regulator verbatim, typo included", () => {
    const text = quotedContraindications({
      name: "Cynanchum glaucescens",
      regulator: "Health Canada",
      contraindications: [
        "Contra-Indications: Do not used for common cold due to wind-cold",
        "Contra-Indications: If you are pregnant or breastfeeding, do not use this product.",
      ],
    });
    expect(text).toContain("Health Canada's records state");
    expect(text).toContain("Do not used for common cold due to wind-cold");
    expect(text).not.toContain("Contra-Indications:");
  });

  it("returns null when there is no record", () => {
    expect(
      quotedContraindications({ name: "X", contraindications: [] })
    ).toBeNull();
  });
});

describe("narrativeSections", () => {
  it("only emits sections that have something behind them", () => {
    const sections = narrativeSections({
      name: "Cynanchum glaucescens",
      pregnancySafe: false,
      nursingSafe: false,
      interactionCount: 0,
    });
    expect(sections.map((s) => s.heading)).toEqual(["Safety"]);
  });

  it("emits all four when the records support them", () => {
    const sections = narrativeSections({
      name: "Ginger",
      traditionalUses: ["nausea"],
      dosageAdult: "1–3 g per day",
      pregnancySafe: true,
      nursingSafe: true,
      interactionCount: 2,
      regulator: "Health Canada",
      contraindications: ["Do not use before surgery"],
    });
    expect(sections.map((s) => s.heading)).toEqual([
      "Traditional and modern use",
      "Recorded dose",
      "Safety",
      "In the regulator's words",
    ]);
  });
});

describe("French copy (used on /fr herb pages)", () => {
  it("builds French sentences end to end", () => {
    const sections = narrativeSections(
      {
        name: "Gingembre",
        traditionalUses: ["nausées", "digestion"],
        dosageAdult: "1 à 3 g par jour",
        pregnancySafe: true,
        nursingSafe: true,
        interactionCount: 2,
        regulator: "Santé Canada",
        contraindications: ["Ne pas utiliser avant une chirurgie"],
      },
      NARRATIVE_FR
    );
    const text = sections.map((s) => s.body).join(" ");
    expect(text).toContain("Usages traditionnels consignés pour Gingembre");
    expect(text).toContain("nausées et digestion");
    expect(text).toContain(
      "Les sources consignent la posologie suivante : 1 à 3 g par jour."
    );
    expect(text).toContain(
      "Les dossiers de Santé Canada indiquent : “Ne pas utiliser"
    );
    expect(text).not.toMatch(/\bthe\b|\band\b|Dose recorded/i);
    expect(sections[0].heading).toBe("Usage traditionnel et moderne");
  });

  it("keeps the regulator name in French in its sentence", () => {
    const sections = narrativeSections(
      {
        name: "Gingembre",
        contraindications: ["Déconseillé avant une chirurgie"],
        regulator: "Santé Canada",
        pregnancySafe: null,
        nursingSafe: null,
        interactionCount: 0,
      },
      NARRATIVE_FR
    );
    expect(
      sections.some((s) => s.body.includes("dossiers de Santé Canada"))
    ).toBe(true);
  });

  it("strips the French label prefix the way it strips the English one", () => {
    const quoted = quotedContraindications(
      {
        name: "Gingembre",
        contraindications: [
          "Contre-indications : Ne pas utiliser avant une chirurgie",
        ],
      },
      NARRATIVE_FR
    );
    expect(quoted).not.toContain("Contre-indications :");
    expect(quoted).toContain("Ne pas utiliser avant une chirurgie");
  });
});
