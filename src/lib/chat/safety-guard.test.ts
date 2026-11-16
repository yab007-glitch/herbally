import { describe, expect, it } from "vitest";
import { evaluateAssistantContent } from "./safety-guard";

describe("evaluateAssistantContent — overdose wording", () => {
  it("allows the correct emergency answer that mentions overdose", () => {
    const verdict = evaluateAssistantContent(
      "If you think you have taken an overdose, call poison control or your local emergency number immediately."
    );
    expect(verdict.verdict).not.toBe("block");
  });

  it("allows a French emergency answer that mentions surdose", () => {
    const verdict = evaluateAssistantContent(
      "En cas de surdose, appelez immédiatement les urgences ou le centre antipoison.",
      "fr"
    );
    expect(verdict.verdict).not.toBe("block");
  });

  it("still blocks an instruction to take an overdose", () => {
    expect(
      evaluateAssistantContent("Take a megadose of this herb daily.").verdict
    ).toBe("block");
    expect(
      evaluateAssistantContent("You should take an overdose to feel it faster.")
        .verdict
    ).toBe("block");
  });

  it("still blocks the claim that an overdose is harmless", () => {
    expect(
      evaluateAssistantContent("You can't overdose on chamomile.").verdict
    ).toBe("block");
    expect(
      evaluateAssistantContent("An overdose would be safe with this herb.")
        .verdict
    ).toBe("block");
  });

  it("still blocks French advice to take an overdose", () => {
    expect(
      evaluateAssistantContent(
        "Prenez une surdose pour accélérer l'effet.",
        "fr"
      ).verdict
    ).toBe("block");
    expect(
      evaluateAssistantContent(
        "On ne peut pas faire une surdose avec cette plante."
      ).verdict
    ).toBe("block");
  });
});
