import { describe, expect, it } from "vitest";
import {
  asSentence,
  joinList,
  narrativeSections,
  quotedContraindications,
  summariseDosage,
  summariseSafety,
  summariseUses,
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
