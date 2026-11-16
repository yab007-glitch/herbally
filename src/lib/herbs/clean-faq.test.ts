import { describe, expect, it } from "vitest";
import { cleanFaqText, stripFieldLabels } from "./clean-faq";

describe("cleanFaqText", () => {
  it("removes a leading regulator field label", () => {
    expect(
      cleanFaqText("Contra-Indications: Do not use if you are pregnant.")
    ).toBe("Do not use if you are pregnant.");
  });

  it("removes labels repeated mid-answer", () => {
    expect(
      cleanFaqText(
        "Do not use if pregnant. Contra-Indications: Do not use if you have liver disease. Known Adverse Reactions: Diuretic effect may occur."
      )
    ).toBe(
      "Do not use if pregnant. Do not use if you have liver disease. Diuretic effect may occur."
    );
  });

  it("capitalises the sentence a label used to introduce", () => {
    expect(
      cleanFaqText("Contra-Indications: if you are pregnant, do not use.")
    ).toBe("If you are pregnant, do not use.");
  });

  it("keeps dose-format labels — they are structure, not noise", () => {
    const answer =
      "Tincture: 1:5 in 40% alcohol. Herbal tea: 1–2 g, 3 times daily.";
    expect(cleanFaqText(answer)).toBe(answer);
  });

  it("does not touch a field name inside a clause", () => {
    const answer = "Do not exceed the recommended dose: 5 g per day.";
    expect(cleanFaqText(answer)).toBe(answer);
  });

  it("does not capitalise after an abbreviation", () => {
    expect(
      cleanFaqText(
        "Contra-Indications: Do not use with blood thinners e.g. warfarin."
      )
    ).toBe("Do not use with blood thinners e.g. warfarin.");
  });

  it("removes French labels with French spacing", () => {
    expect(
      cleanFaqText(
        "Contre-indications : Ne pas utiliser si vous êtes enceinte. Mises en garde : Consulter un praticien."
      )
    ).toBe("Ne pas utiliser si vous êtes enceinte. Consulter un praticien.");
  });

  it("drops a sentence that repeats the previous one verbatim", () => {
    expect(
      cleanFaqText(
        "Contra-Indications: if you are pregnant or breastfeeding , do not use this product. Contra-Indications: If you are pregnant or breastfeeding, do not use this product. Do not use if you have liver disease."
      )
    ).toBe(
      "If you are pregnant or breastfeeding, do not use this product. Do not use if you have liver disease."
    );
  });

  it("does not capitalise the word after a one-letter abbreviation", () => {
    expect(
      cleanFaqText(
        "Contre-indications : Ne pas utiliser avec des anticoagulants (p. ex. warfarine). Consulter un praticien."
      )
    ).toBe(
      "Ne pas utiliser avec des anticoagulants (p. ex. warfarine). Consulter un praticien."
    );
  });

  it("still capitalises after an ordinary word ending in a period", () => {
    expect(cleanFaqText("See the label. consult a practitioner.")).toBe(
      "See the label. Consult a practitioner."
    );
  });

  it("closes the space the importer left before a comma", () => {
    expect(
      cleanFaqText("Do not use if pregnant or breastfeeding , do not use.")
    ).toBe("Do not use if pregnant or breastfeeding, do not use.");
  });

  it("leaves a clean answer untouched", () => {
    expect(cleanFaqText("6 to 12 g per day as a decoction.")).toBe(
      "6 to 12 g per day as a decoction."
    );
  });
});

describe("stripFieldLabels", () => {
  it("removes a leading label from a quoted safety entry", () => {
    expect(
      stripFieldLabels("Contra-Indications: Do not take if you are pregnant.")
    ).toBe("Do not take if you are pregnant.");
  });

  it("removes a label that follows a semicolon", () => {
    expect(
      stripFieldLabels(
        "Do not use if allergic to the daisy famil; Contra-Indications: Do not use if you have impaired kidney function."
      )
    ).toBe(
      "Do not use if allergic to the daisy famil; Do not use if you have impaired kidney function."
    );
  });

  it("removes a label that follows a dangling '.;' and tidies it", () => {
    expect(
      stripFieldLabels(
        "Discontinue use.; Contra-Indications: Do not use if you take MAOIs."
      )
    ).toBe("Discontinue use. Do not use if you take MAOIs.");
  });

  it("removes French safety labels", () => {
    expect(
      stripFieldLabels(
        "Contre-indications : Ne pas utiliser pendant la grossesse. Mises en garde et précautions : Consulter un praticien."
      )
    ).toBe("Ne pas utiliser pendant la grossesse. Consulter un praticien.");
  });

  it("removes the Health Canada French 'Précautions et mises en garde' label", () => {
    expect(
      stripFieldLabels(
        "Précautions et mises en garde : Consulter un praticien de la santé si les symptômes persistent. Précautions et mises en garde : Consulter un praticien avant l'usage si vous êtes enceinte."
      )
    ).toBe(
      "Consulter un praticien de la santé si les symptômes persistent. Consulter un praticien avant l'usage si vous êtes enceinte."
    );
  });

  it("removes the same label from FAQ answers", () => {
    expect(
      cleanFaqText(
        "Précautions et mises en garde : Consulter un praticien si les symptômes persistent."
      )
    ).toBe("Consulter un praticien si les symptômes persistent.");
  });

  it("keeps a label that sits inside a clause", () => {
    const text = "Ask your practitioner about the Risk Information: section.";
    expect(stripFieldLabels(text)).toBe(text);
  });

  it("leaves text without a label untouched", () => {
    expect(stripFieldLabels("Do not use before surgery.")).toBe(
      "Do not use before surgery."
    );
  });
});
