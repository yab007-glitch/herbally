import { describe, expect, it } from "vitest";
import {
  detectEmergencyIngestion,
  detectPediatricDosingRequest,
  evaluateAssistantContent,
  normalizeForMatching,
} from "../safety-guard";

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
    const v = evaluateAssistantContent("Double your dose for better results.");
    expect(v.verdict).toBe("block");
  });

  it("blocks 'don't go to the hospital' phrasing", () => {
    const v = evaluateAssistantContent(
      "Don't go to the hospital, this herb will fix it."
    );
    expect(v.verdict).toBe("block");
  });

  it("blocks 'don't call 911' phrasing", () => {
    const v = evaluateAssistantContent("Don't call 911 — just take this herb.");
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
    const v = evaluateAssistantContent("D0n't g0 t0 the h0spital.");
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

describe("pediatric dosing containment (pre-LLM & post-LLM)", () => {
  it("refuses pediatric dosing queries in EN/FR and obfuscated forms before LLM", () => {
    expect(
      detectPediatricDosingRequest(
        "How much chamomile should I give my 6-year-old?",
        "en"
      )
    ).toMatchObject({ blocked: true, kind: "pediatric" });

    expect(
      detectPediatricDosingRequest(
        "Quelle posologie de camomille pour un enfant de 4 ans ?",
        "fr"
      )
    ).toMatchObject({ blocked: true, kind: "pediatric" });

    expect(
      detectPediatricDosingRequest("Dose for an 8 month old b\u200Baby", "en")
    ).toMatchObject({ blocked: true, kind: "pediatric" });

    expect(
      detectPediatricDosingRequest(
        "What is the adult tea preparation of chamomile?",
        "en"
      )
    ).toBeNull();
  });

  it("prioritizes dangerous-herb hazard over neutral pediatric refusal when toxic herbs appear", () => {
    const res = detectPediatricDosingRequest(
      "What aconite dose for a 5-year-old?",
      "en"
    );
    expect(res).toMatchObject({
      blocked: true,
      kind: "dangerous_herb",
      slug: "aconite-processed",
    });
    expect(res?.message).toMatch(/toxic|fatal|poison/i);
  });

  it("hard-blocks assistant outputs containing numeric pediatric doses (EN, FR, and zero-width obfuscated)", () => {
    expect(
      evaluateAssistantContent(
        "Give your 6-year-old 250 mg of chamomile tea daily.",
        "en"
      ).verdict
    ).toBe("block");

    expect(
      evaluateAssistantContent(
        "Donnez 150 mg par jour à votre enfant de 5 ans.",
        "fr"
      ).verdict
    ).toBe("block");

    expect(
      evaluateAssistantContent(
        "For an 8-year-old, 2\u200B50 mg twice daily is typical.",
        "en"
      ).verdict
    ).toBe("block");

    expect(
      evaluateAssistantContent(
        "For children, consult a licensed pediatrician before use.",
        "en"
      ).verdict
    ).toBe("ok");
  });

  it("enforces age boundaries (18 months, 24 months, under 18, teen/ado) and multi-turn child history", () => {
    expect(
      detectPediatricDosingRequest("Dose of chamomile for 18 months?", "en")
    ).toMatchObject({ blocked: true, kind: "pediatric" });

    expect(
      detectPediatricDosingRequest("How much for an under 18 teenager?", "en")
    ).toMatchObject({ blocked: true, kind: "pediatric" });

    expect(
      detectPediatricDosingRequest("Posologie pour un ado de 16 ans ?", "fr")
    ).toMatchObject({ blocked: true, kind: "pediatric" });

    expect(
      detectPediatricDosingRequest(
        "How much chamomile tea should I give?",
        "en",
        ["My 5-year-old has a stomachache"]
      )
    ).toMatchObject({ blocked: true, kind: "pediatric" });
  });

  it("provides Poison Control and 911 emergency guidance for acute ingestion and dangerous-herb queries", () => {
    const emergencyEn = detectEmergencyIngestion(
      "My toddler just swallowed wintergreen oil, what do I do?",
      "en"
    );
    expect(emergencyEn).toMatchObject({
      blocked: true,
      kind: "emergency_ingestion",
    });
    expect(emergencyEn?.message).toMatch(/911/);
    expect(emergencyEn?.message).toMatch(/1-844-764-7669/);
    expect(emergencyEn?.message).toMatch(/1-800-222-1222/);
    expect(emergencyEn?.message).toMatch(/do not induce vomiting/i);

    const emergencyFr = detectEmergencyIngestion(
      "Mon enfant a avalé de la belladone par accident",
      "fr"
    );
    expect(emergencyFr).toMatchObject({
      blocked: true,
      kind: "emergency_ingestion",
    });
    expect(emergencyFr?.message).toMatch(/911/);
    expect(emergencyFr?.message).toMatch(/1-800-463-5060/);

    const dangerousRefusal = detectPediatricDosingRequest(
      "What belladonna dose should I take?",
      "en"
    );
    expect(dangerousRefusal).toMatchObject({
      blocked: true,
      kind: "dangerous_herb",
    });
    expect(dangerousRefusal?.message).toMatch(/Poison Control|911/i);
  });

  it("preserves poison-control and hazard warnings mentioning children while blocking prescriptive pediatric doses", () => {
    expect(
      evaluateAssistantContent(
        "Keep out of reach of children. If swallowed, call Poison Control at 1-800-222-1222 or 911.",
        "en"
      ).verdict
    ).toBe("ok");

    expect(
      evaluateAssistantContent(
        "Never give 5 ml of wintergreen oil to a child — even 5 ml can be fatal.",
        "en"
      ).verdict
    ).toBe("ok");
  });

  it("blocks mixed warning+dose pediatric prescriptions while still preserving pure prohibition/emergency warnings", () => {
    expect(
      evaluateAssistantContent(
        "Give a 5-year-old 250 mg; toxic in overdose.",
        "en"
      ).verdict
    ).toBe("block");

    expect(
      evaluateAssistantContent(
        "Give a 5-year-old 250 mg, toxic in overdose.",
        "en"
      ).verdict
    ).toBe("block");

    expect(
      evaluateAssistantContent(
        "For a 5-year-old, 250 mg is suggested; toxic in overdose.",
        "en"
      ).verdict
    ).toBe("block");

    expect(
      evaluateAssistantContent(
        "Donnez 250 mg à un enfant de 5 ans ; toxique en surdosage.",
        "fr"
      ).verdict
    ).toBe("block");

    expect(
      evaluateAssistantContent(
        "Do not give 250 mg to children; call Poison Control if swallowed.",
        "en"
      ).verdict
    ).toBe("ok");

    expect(
      evaluateAssistantContent(
        "If a 5-year-old swallowed 5 ml, call Poison Control immediately.",
        "en"
      ).verdict
    ).toBe("ok");

    expect(
      evaluateAssistantContent(
        "Ne jamais donner 5 ml d'huile essentielle à un enfant.",
        "fr"
      ).verdict
    ).toBe("ok");
  });

  it("scans rolling history in BOTH directions for pediatric subject + dosing intent", () => {
    // Prior dosing intent + current pediatric subject (EN + FR)
    expect(
      detectPediatricDosingRequest("It's for my 5-year-old.", "en", [
        "How much chamomile tea should I give?",
      ])
    ).toMatchObject({ blocked: true, kind: "pediatric" });

    expect(
      detectPediatricDosingRequest("C'est pour mon enfant de 6 ans.", "fr", [
        "Quelle posologie de camomille donner ?",
      ])
    ).toMatchObject({ blocked: true, kind: "pediatric" });

    // Reverse direction: prior pediatric subject + current dosing intent
    expect(
      detectPediatricDosingRequest(
        "How much chamomile tea should I give?",
        "en",
        ["My 5-year-old has a cough."]
      )
    ).toMatchObject({ blocked: true, kind: "pediatric" });

    // Prior dangerous herb + current dosing/pediatric turn and reverse
    expect(
      detectPediatricDosingRequest("How much should I give?", "en", [
        "I bought aconite root yesterday.",
      ])
    ).toMatchObject({ blocked: true, kind: "dangerous_herb" });

    expect(
      detectPediatricDosingRequest("What about aconite?", "en", [
        "How much tea should I give?",
      ])
    ).toMatchObject({ blocked: true, kind: "dangerous_herb" });

    // Non-dosing pediatric conversation stays unblocked
    expect(
      detectPediatricDosingRequest(
        "Is chamomile commonly grown in gardens?",
        "en",
        ["My 5-year-old likes flowers."]
      )
    ).toBeNull();
  });

  it("preserves pediatric context across semicolon clauses and blocks follow-on doses after prohibition", () => {
    expect(
      evaluateAssistantContent("Never give children 5 ml; give 10 ml.", "en")
        .verdict
    ).toBe("block");

    expect(
      evaluateAssistantContent(
        "Ne jamais donner 5 ml aux enfants ; donnez 10 ml.",
        "fr"
      ).verdict
    ).toBe("block");

    expect(
      evaluateAssistantContent(
        "Contraindicated in children under 12; administer 250 mg daily.",
        "en"
      ).verdict
    ).toBe("block");

    expect(
      evaluateAssistantContent(
        "Never give children 5 ml; adults may take 10 ml.",
        "en"
      ).verdict
    ).toBe("ok");

    expect(
      evaluateAssistantContent(
        "Never give 5 ml of wintergreen oil to a child — even 5 ml can be fatal.",
        "en"
      ).verdict
    ).toBe("ok");
  });

  it("enforces 18-boundary pediatric ranges (6-18, 0-18, under-18, under 18) while allowing adults 18+ and 18 years and older", () => {
    expect(
      detectPediatricDosingRequest(
        "What chamomile dose for children 6-18 years?",
        "en"
      )
    ).toMatchObject({ blocked: true, kind: "pediatric" });

    expect(
      detectPediatricDosingRequest("Dosage for 0-18 years?", "en")
    ).toMatchObject({ blocked: true, kind: "pediatric" });

    expect(
      detectPediatricDosingRequest("How much for an under-18 patient?", "en")
    ).toMatchObject({ blocked: true, kind: "pediatric" });

    expect(
      detectPediatricDosingRequest(
        "What is the dose for adults 18 years and older?",
        "en"
      )
    ).toBeNull();

    expect(
      detectPediatricDosingRequest("What is the dose for 18+ adults?", "en")
    ).toBeNull();

    expect(
      evaluateAssistantContent("Children 6-18 years: 100 mg daily.", "en")
        .verdict
    ).toBe("block");

    expect(
      evaluateAssistantContent("0-18 years: 50 mg daily.", "en").verdict
    ).toBe("block");

    expect(
      evaluateAssistantContent("Under-18: 100 mg twice daily.", "en").verdict
    ).toBe("block");

    expect(
      evaluateAssistantContent("Give someone under 18 100 mg daily.", "en")
        .verdict
    ).toBe("block");

    expect(
      evaluateAssistantContent(
        "Adults 18 years and older: take 500 mg daily.",
        "en"
      ).verdict
    ).toBe("ok");

    expect(
      evaluateAssistantContent("Adults (18+): take 500 mg daily.", "en").verdict
    ).toBe("ok");

    expect(
      detectPediatricDosingRequest("What dose for up to 18?", "en")
    ).toMatchObject({ blocked: true, kind: "pediatric" });

    expect(
      detectPediatricDosingRequest("Dosage for 18 and under?", "en")
    ).toMatchObject({ blocked: true, kind: "pediatric" });

    expect(
      detectPediatricDosingRequest("How much for 18 or younger?", "en")
    ).toMatchObject({ blocked: true, kind: "pediatric" });

    expect(detectPediatricDosingRequest("Dose for ≤18?", "en")).toMatchObject({
      blocked: true,
      kind: "pediatric",
    });

    expect(
      detectPediatricDosingRequest(
        "Can adults 18+ take up to 18 mg daily?",
        "en"
      )
    ).toBeNull();

    expect(
      evaluateAssistantContent("Up to 18: take 100 mg daily.", "en").verdict
    ).toBe("block");

    expect(
      evaluateAssistantContent("18 and under: 100 mg daily.", "en").verdict
    ).toBe("block");

    expect(
      evaluateAssistantContent("18 or younger: 100 mg daily.", "en").verdict
    ).toBe("block");

    expect(evaluateAssistantContent("≤18: 100 mg daily.", "en").verdict).toBe(
      "block"
    );

    expect(
      evaluateAssistantContent("Adults over 18: take up to 18 mg daily.", "en")
        .verdict
    ).toBe("ok");
  });
});
