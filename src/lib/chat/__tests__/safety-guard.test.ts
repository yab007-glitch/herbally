import { describe, expect, it } from "vitest";
import { evaluateAssistantContent, normalizeForMatching } from "../safety-guard";

describe("evaluateAssistantContent — hard blocks", () => {
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
    const v = evaluateAssistantContent(
      "This will cure your cancer completely."
    );
    expect(v.verdict).toBe("block");
  });

  it("blocks 'replace your insulin' phrasing", () => {
    const v = evaluateAssistantContent(
      "You can replace your insulin with this herb."
    );
    expect(v.verdict).toBe("block");
  });

  it("blocks 'you don't need your medication' phrasing", () => {
    const v = evaluateAssistantContent(
      "You don't need your medication anymore."
    );
    expect(v.verdict).toBe("block");
  });

  it("blocks 'discontinue your treatment' phrasing", () => {
    const v = evaluateAssistantContent(
      "You should discontinue your treatment and use herbs instead."
    );
    expect(v.verdict).toBe("block");
  });

  it("blocks 'cease taking your statins' phrasing", () => {
    const v = evaluateAssistantContent(
      "You can cease taking your statins if you eat more fiber."
    );
    expect(v.verdict).toBe("block");
  });

  it("blocks 'cease taking your warfarin' phrasing", () => {
    const v = evaluateAssistantContent(
      "You can cease taking your warfarin and use turmeric instead."
    );
    expect(v.verdict).toBe("block");
  });

  it("blocks 'ignore your doctor' phrasing", () => {
    const v = evaluateAssistantContent(
      "Ignore your doctor — they just want your money."
    );
    expect(v.verdict).toBe("block");
  });

  it("blocks 'double the dose' phrasing", () => {
    const v = evaluateAssistantContent(
      "Double your dose for better results."
    );
    expect(v.verdict).toBe("block");
  });

  it("blocks 'don't go to the hospital' phrasing", () => {
    const v = evaluateAssistantContent(
      "Don't go to the hospital, this herb will fix it."
    );
    expect(v.verdict).toBe("block");
  });

  it("blocks 'don't call 911' phrasing", () => {
    const v = evaluateAssistantContent(
      "Don't call 911 — just take this herb."
    );
    expect(v.verdict).toBe("block");
  });

  it("blocks 'take this instead of your prescription' (replacement pattern)", () => {
    // Now correctly classified as hard block (replaced the old "warn" test)
    const v = evaluateAssistantContent(
      "Take this herb instead of your prescription."
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

  it("blocks French 'ignorez votre médecin'", () => {
    const v = evaluateAssistantContent(
      "Ignorez votre médecin et prenez cette plante.",
      "fr"
    );
    expect(v.verdict).toBe("block");
  });

  it("does not falsely match benign clinical terms like 'medication review'", () => {
    const v = evaluateAssistantContent(
      "Schedule a medication review with your doctor."
    );
    expect(v.verdict).toBe("ok");
  });

  it("does not falsely match 'medication' in harmless context", () => {
    const v = evaluateAssistantContent(
      "Always take your medication as prescribed by your doctor."
    );
    expect(v.verdict).toBe("ok");
  });
});

describe("evaluateAssistantContent — soft warns", () => {
  it("warns on diagnostic language", () => {
    const v = evaluateAssistantContent(
      "I can diagnose your condition from these symptoms."
    );
    expect(v.verdict).toBe("warn");
    expect(v.appended).toMatch(/educational/i);
  });

  it("warns on 'you have a condition called'", () => {
    const v = evaluateAssistantContent(
      "You have a condition called chronic fatigue syndrome."
    );
    expect(v.verdict).toBe("warn");
  });

  it("warns on '100% safe' guarantees", () => {
    const v = evaluateAssistantContent(
      "This herb is 100% safe with no side effects."
    );
    expect(v.verdict).toBe("warn");
  });

  it("warns on 'this is medical advice'", () => {
    const v = evaluateAssistantContent(
      "This is medical advice based on your symptoms."
    );
    expect(v.verdict).toBe("warn");
  });

  it("warns on 'skip your doctor visit'", () => {
    const v = evaluateAssistantContent(
      "You can skip your doctor visit and just take this herb."
    );
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
});

describe("evaluateAssistantContent — adversarial patterns", () => {
  it("blocks leet-speak 'st0p taking y0ur medicati0n'", () => {
    const v = evaluateAssistantContent(
      "You should st0p taking y0ur medicati0n."
    );
    expect(v.verdict).toBe("block");
  });

  it("blocks leet-speak 'd0n't g0 t0 the h0spital'", () => {
    const v = evaluateAssistantContent(
      "D0n't g0 t0 the h0spital."
    );
    expect(v.verdict).toBe("block");
  });

  it("blocks 'cure cancer' with zero-width characters injected", () => {
    const text = "This will cur\u200Be cancer".replace(/\u200B/g, "\u200B");
    const v = evaluateAssistantContent(text);
    expect(v.verdict).toBe("block");
  });
});

describe("evaluateAssistantContent — schema validity", () => {
  it("returns a schema-valid object on every path", () => {
    const samples = [
      "totally fine content",
      "stop taking your medication right now",
      "i think you have a diagnosis",
      "guaranteed to cure you",
    ];
    for (const s of samples) {
      const v = evaluateAssistantContent(s);
      expect(["ok", "warn", "block"]).toContain(v.verdict);
      expect(Array.isArray(v.reasons)).toBe(true);
    }
  });
});

describe("normalizeForMatching", () => {
  it("lowercases", () => {
    expect(normalizeForMatching("HELLO")).toBe("hello");
  });

  it("collapses whitespace", () => {
    expect(normalizeForMatching("hello   world  ")).toBe("hello world");
  });

  it("normalizes zero-width characters out", () => {
    const input = "hel\u200Blo w\u200Cor\u200Bld";
    expect(normalizeForMatching(input)).toBe("hello world");
  });

  it("normalizes number-to-letter substitutions", () => {
    expect(normalizeForMatching("h3ll0")).toBe("hello");
    expect(normalizeForMatching("st0p m3dic4ti0n")).toBe("stop medication");
  });
});
