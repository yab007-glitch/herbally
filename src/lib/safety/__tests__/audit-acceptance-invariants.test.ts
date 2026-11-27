import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (k: string) => k,
}));

import { AuthorByline } from "@/components/herbs/author-byline";
import { HerbFAQSchema } from "@/components/seo/herb-faq-schema";
import { HerbSchema } from "@/components/seo/herb-schema";
import { narrativeSections } from "@/lib/herbs/narrative";
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
      expect(doc).toContain("509");
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

  it("renders toxicology quarantine byline on toxic botanicals and ensures ChipLegend grade ordering without duplicated labels", () => {
    const enByline = renderToStaticMarkup(
      createElement(AuthorByline, {
        locale: "en",
        isReviewed: false,
        sourceCount: 2,
        isDangerous: true,
      })
    );
    expect(enByline).toContain("Toxicology record: 2 sources checked");
    expect(enByline).toContain("Permanent toxic quarantine");
    expect(enByline).not.toContain("Editorial compilation");

    const chipLegendSrc = fs.readFileSync(
      path.join(ROOT, "src/components/herbs/chip-legend.tsx"),
      "utf8"
    );
    expect(chipLegendSrc).toContain('["A", "B", "C", "trad", "D"]');
    expect(chipLegendSrc).not.toContain("`${level}.label`");

    const npnPageSrc = fs.readFileSync(
      path.join(ROOT, "src/app/[locale]/(marketing)/npn-checker/page.tsx"),
      "utf8"
    );
    expect(npnPageSrc.toLowerCase()).toContain("licence status");
    expect(npnPageSrc.toLowerCase()).toContain("market status");
  });

  it("removes obsolete FR/EN personalized/weight/age dosing claims, suppresses dangerous narrative uses/regulator sections, and emits HerbSchema citations cleanly", () => {
    const frServer = fs.readFileSync(
      path.join(ROOT, "src/lib/i18n/dictionaries/fr/server.json"),
      "utf8"
    );
    const frTools = fs.readFileSync(
      path.join(ROOT, "src/lib/i18n/dictionaries/fr/tools.json"),
      "utf8"
    );
    const enServer = fs.readFileSync(
      path.join(ROOT, "src/lib/i18n/dictionaries/en/server.json"),
      "utf8"
    );
    const enTools = fs.readFileSync(
      path.join(ROOT, "src/lib/i18n/dictionaries/en/tools.json"),
      "utf8"
    );
    expect(frServer).not.toContain("basées sur l'âge et le poids");
    expect(frServer).not.toContain("dosage personnalisé");
    expect(frTools).not.toContain("dosage personnalisé");
    expect(frTools).not.toContain("recommandations personnalisées");
    expect(enServer).not.toContain("personalized dosing");
    expect(enTools).not.toContain("personalized dosing");

    const sections = narrativeSections({
      name: "Abrus precatorius",
      traditionalUses: ["skin problems", "ulcers"],
      contraindications: ["Poisonous botanical (contains lethal abrin)"],
      regulator: "Health Canada",
      isDangerous: true,
    });
    const combined = JSON.stringify(sections);
    expect(combined).not.toContain("Traditional and modern use");
    expect(combined).not.toContain("In the regulator's words");
    expect(combined).not.toContain("skin problems");

    const abrusSchemaHtml = renderToStaticMarkup(
      createElement(HerbSchema, {
        herb: {
          name: "Abrus precatorius",
          scientific_name: "Abrus precatorius",
          slug: "abrus-precatorius",
          description: "Traditionally used for skin problems and ulcers.",
        },
        isDangerous: true,
        isClinicallyReviewed: false,
        citationUrls: ["https://pubmed.ncbi.nlm.nih.gov/99999/"],
      })
    );
    expect(abrusSchemaHtml).not.toContain("skin problems");
    expect(abrusSchemaHtml).toContain("Poisonous botanical quarantined");

    const turmericSchemaHtml = renderToStaticMarkup(
      createElement(HerbSchema, {
        herb: {
          name: "Turmeric",
          scientific_name: "Curcuma longa",
          slug: "turmeric",
          description: "Culinary and medicinal rhizome.",
        },
        isDangerous: false,
        isClinicallyReviewed: false,
        citationUrls: ["https://pubmed.ncbi.nlm.nih.gov/34062109/"],
      })
    );
    expect(turmericSchemaHtml).toContain(
      '"citation":["https://pubmed.ncbi.nlm.nih.gov/34062109/"]'
    );
  });
});
