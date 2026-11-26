import { describe, expect, it } from "vitest";
import {
  detectRedFlagSymptom,
  formatRedFlagChatRefusal,
} from "../red-flag-symptoms";

describe("detectRedFlagSymptom", () => {
  it("flags cardiac/respiratory emergencies in EN and FR", () => {
    const en = detectRedFlagSymptom(
      "herbs for sudden chest pain and shortness of breath"
    );
    expect(en.isRedFlag).toBe(true);
    expect(en.category).toBe("cardiac_respiratory");
    expect(en.severity).toBe("emergency");

    const fr = detectRedFlagSymptom(
      "plantes pour douleur thoracique et difficulté à respirer"
    );
    expect(fr.isRedFlag).toBe(true);
    expect(fr.category).toBe("cardiac_respiratory");
  });

  it("flags suicidal crisis, stroke, anaphylaxis, GI hemorrhage, and jaundice", () => {
    expect(detectRedFlagSymptom("I want to kill myself").category).toBe(
      "suicidal_crisis"
    );
    expect(
      detectRedFlagSymptom("face drooping and slurred speech").category
    ).toBe("neurologic_stroke");
    expect(
      detectRedFlagSymptom("throat swelling and hives after taking herb")
        .category
    ).toBe("anaphylaxis");
    expect(
      detectRedFlagSymptom("vomiting blood and black tarry stools").category
    ).toBe("gi_hemorrhage");
    expect(
      detectRedFlagSymptom("jaundice yellow eyes after supplement").category
    ).toBe("severe_hepatic_renal");
  });

  it("does not trigger on benign everyday wellness queries", () => {
    expect(
      detectRedFlagSymptom("stress and occasional insomnia").isRedFlag
    ).toBe(false);
    expect(detectRedFlagSymptom("mild bloating after meals").isRedFlag).toBe(
      false
    );
    expect(detectRedFlagSymptom("troubles digestifs légers").isRedFlag).toBe(
      false
    );
  });

  it("formats localized refusal text cleanly", () => {
    const det = detectRedFlagSymptom("chest pain");
    expect(formatRedFlagChatRefusal(det, "en")).toContain("911");
    expect(formatRedFlagChatRefusal(det, "fr")).toContain("15 / 112");
  });
});
