import { describe, expect, it } from "vitest";
import { classifyMedicationScope } from "../medication-scope";

describe("classifyMedicationScope", () => {
  it("distinguishes drug classes from individual molecules", () => {
    expect(classifyMedicationScope("Warfarin")).toBe("molecule");
    expect(classifyMedicationScope("Metformin")).toBe("molecule");
    expect(classifyMedicationScope("Digoxin")).toBe("molecule");

    expect(classifyMedicationScope("Anticoagulants / Antiplatelets")).toBe(
      "class"
    );
    expect(classifyMedicationScope("SSRIs")).toBe("class");
    expect(classifyMedicationScope("CYP3A4 substrates")).toBe("class");
    expect(classifyMedicationScope("NSAIDs")).toBe("class");
    expect(classifyMedicationScope("Antihypertensive medications")).toBe(
      "class"
    );
  });
});
