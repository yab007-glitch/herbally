import { describe, expect, it } from "vitest";
import { cleanQuotedText } from "./clean-quote";

describe("cleanQuotedText", () => {
  it("leaves a complete quotation untouched", () => {
    expect(cleanQuotedText("Do not use during pregnancy.")).toBe(
      "Do not use during pregnancy."
    );
  });

  it("closes a quotation cut mid-word", () => {
    const out = cleanQuotedText(
      "Do not use if you have hypokalemia, high blood pressure, or a ki"
    );
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toContain("or a ki");
    expect(out).toBe(
      "Do not use if you have hypokalemia, high blood pressure…"
    );
  });

  it("drops a dangling regulator section number", () => {
    const out = cleanQuotedText("Indicated for occasional constipation. 4.2.");
    expect(out).toBe("Indicated for occasional constipation.");
  });

  it("drops an unresolved cross-reference and closes the quote", () => {
    const out = cleanQuotedText(
      "This combination is not recommended (see section 4.4."
    );
    expect(out).not.toContain("see section 4.4");
    expect(out).toBe("This combination is not recommended…");
  });

  it("collapses whitespace", () => {
    expect(cleanQuotedText("a\n\n b   c.")).toBe("a b c.");
  });

  it("preserves short complete safety labels without chopping the last word", () => {
    expect(cleanQuotedText("Hormone-sensitive cancers")).toBe(
      "Hormone-sensitive cancers"
    );
    expect(cleanQuotedText("Concurrent sedative medications")).toBe(
      "Concurrent sedative medications"
    );
    expect(cleanQuotedText("Before driving or operating heavy machinery")).toBe(
      "Before driving or operating heavy machinery"
    );
    expect(cleanQuotedText("Aspirin allergy")).toBe("Aspirin allergy");
  });
});
