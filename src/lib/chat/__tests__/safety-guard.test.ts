import { describe, expect, it } from "vitest";
import { evaluateAssistantContent } from "../safety-guard";

describe("evaluateAssistantContent", () => {
  it("returns ok for normal content", () => {
    const v = evaluateAssistantContent(
      "Turmeric may help with inflammation. See PMID:32747204 for details."
    );
    expect(v.verdict).toBe("ok");
    expect(v.reasons).toHaveLength(0);
    expect(v.appended).toBeUndefined();
  });

  it("blocks 'stop taking your medication' phrasing", () => {
    const v = evaluateAssistantContent(
      "You should stop taking your medication and try this herb instead."
    );
    expect(v.verdict).toBe("block");
    expect(v.reasons.length).toBeGreaterThan(0);
    expect(v.appended).toMatch(/healthcare provider/i);
  });

  it("blocks 'this will cure cancer' phrasing", () => {
    const v = evaluateAssistantContent("This will cure your cancer completely.");
    expect(v.verdict).toBe("block");
  });

  it("blocks 'replace your insulin' phrasing", () => {
    const v = evaluateAssistantContent(
      "You can replace your insulin with this herb."
    );
    expect(v.verdict).toBe("block");
  });

  it("blocks French equivalents", () => {
    const v = evaluateAssistantContent(
      "Vous devriez arrêter de prendre vos médicaments.",
      "fr"
    );
    expect(v.verdict).toBe("block");
    expect(v.appended).toMatch(/professionnel/);
  });

  it("warns on diagnostic language", () => {
    const v = evaluateAssistantContent("I can diagnose your condition from these symptoms.");
    expect(v.verdict).toBe("warn");
    expect(v.appended).toMatch(/educational/i);
  });

  it("warns on 'instead of your prescription'", () => {
    const v = evaluateAssistantContent("Take this herb instead of your prescription.");
    expect(v.verdict).toBe("warn");
  });

  it("warns in French with the localized message", () => {
    const v = evaluateAssistantContent(
      "Je peux diagnostiquer votre état à partir de ces symptômes.",
      "fr"
    );
    expect(v.verdict).toBe("warn");
    expect(v.appended).toMatch(/éducative/);
  });

  it("returns a schema-valid object on every path", () => {
    const samples = [
      "totally fine content",
      "stop taking your medication right now",
      "i think you have a diagnosis",
      "garanteed to cure you",
    ];
    for (const s of samples) {
      const v = evaluateAssistantContent(s);
      // The Zod parse on every return guarantees shape, but assert it explicitly
      expect(["ok", "warn", "block"]).toContain(v.verdict);
      expect(Array.isArray(v.reasons)).toBe(true);
    }
  });

  it("does not falsely match partial phrases like 'medication review'", () => {
    // 'medication review' is a benign clinical term; should not trip a block.
    const v = evaluateAssistantContent("Schedule a medication review with your doctor.");
    expect(v.verdict).toBe("ok");
  });
});
