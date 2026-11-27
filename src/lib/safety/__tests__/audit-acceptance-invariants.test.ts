import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import { HerbFAQSchema } from "@/components/seo/herb-faq-schema";
import { resolvePregnancyNursingStatus } from "@/lib/herbs/canonical-safety";
import { buildHerbFallbackFaqs } from "@/lib/seo/herb-faq-fallback";

const ROOT = process.cwd();

describe("Round 3 / Release 3.1 AI evaluation acceptance invariants", () => {
  it("preserves cross-surface pregnancy/nursing parity across turmeric, ginger, and toxic abrus", () => {
    const sourceCheckedProv = {
      verification_method: "primary_source",
      verification_status: "verified",
      verified_source_count: 3,
      review_status: "human_reviewed",
      reviewed_by_name: null,
      reviewed_on: null,
    };

    const turmeric = resolvePregnancyNursingStatus(
      { slug: "turmeric", pregnancy_safe: false, nursing_safe: false },
      sourceCheckedProv
    );
    expect(turmeric.pregnancy).toBe("not_recommended");
    expect(turmeric.nursing).toBe("not_recommended");

    const ginger = resolvePregnancyNursingStatus(
      { slug: "ginger", pregnancy_safe: true, nursing_safe: true },
      sourceCheckedProv
    );
    expect(ginger.pregnancy).toBe("unknown");
    expect(ginger.nursing).toBe("unknown");

    const abrus = resolvePregnancyNursingStatus(
      { slug: "abrus-precatorius", pregnancy_safe: null, nursing_safe: null },
      sourceCheckedProv
    );
    expect(abrus.isDangerous).toBe(true);
    expect(abrus.pregnancy).toBe("not_recommended");
    expect(abrus.nursing).toBe("not_recommended");
  });

  it("blocks dangerous botanicals from therapeutic uses or dosing FAQs", () => {
    const t = (key: string) => key;
    for (const slug of ["Abrus precatorius", "Atropa belladonna"]) {
      const faqs = buildHerbFallbackFaqs(
        {
          herbName: slug,
          scientificName: slug,
          uses: ["skin conditions", "inflammation"],
          safetyNotes: "",
          pregnancyCategory: "safe",
          drugInteractions: 0,
          isDangerous: true,
          showCalculator: true,
        },
        t
      );
      expect(faqs).toHaveLength(4);
      const serialized = JSON.stringify(faqs);
      expect(serialized).not.toContain("doseQuestion");
      expect(serialized).not.toContain("usedForAnswer");
      expect(serialized).not.toContain("knownAs");
      expect(serialized).toContain("dangerousOverviewQuestion");
    }
  });

  it("excludes retired FDA pregnancy categories and obsolete washout/3,124 strings across dictionaries and llms files", () => {
    const enServer = fs.readFileSync(
      path.join(ROOT, "src/lib/i18n/dictionaries/en/server.json"),
      "utf8"
    );
    const frServer = fs.readFileSync(
      path.join(ROOT, "src/lib/i18n/dictionaries/fr/server.json"),
      "utf8"
    );
    const llmsTxt = fs.readFileSync(path.join(ROOT, "public/llms.txt"), "utf8");
    const llmsFullTxt = fs.readFileSync(
      path.join(ROOT, "public/llms-full.txt"),
      "utf8"
    );

    expect(enServer).not.toMatch(/FDA categories/i);
    expect(frServer).not.toMatch(/catégories FDA/i);
    expect(enServer).toMatch(/Pregnancy and Lactation Labeling Rule/i);
    expect(frServer).toMatch(/PLLR/i);

    for (const doc of [llmsTxt, llmsFullTxt]) {
      expect(doc).not.toMatch(/Washout Planner/i);
      expect(doc).not.toMatch(/3,124/);
      expect(doc).toContain("3,122");
      expect(doc).toContain("513");
      expect(doc).toContain("142");
    }
  });

  it("explicitly allows Google-Extended, GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, and Applebot-Extended in robots()", () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const allowedAgents = rules
      .filter((r) => r.allow === "/")
      .flatMap((r) =>
        Array.isArray(r.userAgent) ? r.userAgent : [r.userAgent ?? ""]
      );

    for (const bot of [
      "Google-Extended",
      "GPTBot",
      "OAI-SearchBot",
      "ChatGPT-User",
      "PerplexityBot",
      "ClaudeBot",
      "Applebot-Extended",
    ]) {
      expect(allowedAgents).toContain(bot);
    }
  });

  it("ignores DB preGeneratedFaqs in HerbFAQSchema for toxic botanicals", () => {
    const html = renderToStaticMarkup(
      createElement(HerbFAQSchema, {
        herbName: "Abrus precatorius",
        scientificName: "Abrus precatorius",
        uses: ["Skin conditions (root)"],
        safetyNotes: "Fatal toxicity",
        pregnancyCategory: "avoid",
        drugInteractions: 0,
        isDangerous: true,
        showCalculator: false,
        preGeneratedFaqs: [
          {
            question: "What is Abrus precatorius used for?",
            answer: "Skin conditions (root).",
          },
          {
            question: "What dose of Abrus precatorius should I take?",
            answer: "None.",
          },
        ],
      })
    );

    expect(html).not.toContain("Skin conditions (root)");
    expect(html).not.toContain("What is Abrus precatorius used for?");
    expect(html).not.toContain("What dose of Abrus precatorius");
  });
});
