import fs from "node:fs";
import path from "node:path";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (k: string) => k,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: ComponentProps<"a"> & { href: string }) =>
    createElement("a", { href, ...props }, children),
}));

import { AuthorByline } from "@/components/herbs/author-byline";
import { HerbBodyContent } from "@/components/herbs/herb-body-content";
import { HerbJumpNav } from "@/components/herbs/herb-jump-nav";
import { ToxicBotanicalQuarantineCard } from "@/components/herbs/toxic-botanical-quarantine-card";
import { ToxicQuarantineShell } from "@/components/herbs/toxic-quarantine-shell";
import { HerbFAQSchema } from "@/components/seo/herb-faq-schema";
import { HerbSchema } from "@/components/seo/herb-schema";
import { herbPageCopy } from "@/lib/i18n/herb-page-copy";
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

  it("enforces Release 3.5 total toxic-plant quarantine and plaintext clinical-review contact", () => {
    const toxicJumpHtml = renderToStaticMarkup(
      createElement(HerbJumpNav, {
        locale: "en",
        hasInteractions: false,
        isDangerous: true,
      })
    );
    expect(toxicJumpHtml).toContain("Toxicology &amp; Emergency");
    expect(toxicJumpHtml).not.toContain("Dosage &amp; Safety");
    expect(toxicJumpHtml).not.toContain("#faq");

    const toxicBodyHtml = renderToStaticMarkup(
      createElement(HerbBodyContent, {
        herb: {
          id: "abrus-id",
          slug: "abrus-precatorius",
          name: "Abrus precatorius",
          scientific_name: "Abrus precatorius",
          description: "",
          pregnancy_safe: false,
          nursing_safe: false,
          contraindications: ["Contains lethal abrin"],
          side_effects: ["Severe poisoning"],
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        } as unknown as Parameters<typeof HerbBodyContent>[0]["herb"],
        compactProvenance: null,
        monograph: null,
        isManualMonograph: false,
        isClinicallyReviewed: false,
        regulatorName: null,
        interactions: [],
        severityCounts: {
          contraindicated: 0,
          severe: 0,
          moderate: 0,
          mild: 0,
        },
        locale: "en",
        copy: herbPageCopy("en"),
        pubmedSheet: {
          content: "Should never render",
          citations: [
            { pmid: "12345678", title: "Toxicology", journal: "J", year: 2020 },
          ],
          pmids: ["12345678"],
          article_count: 1,
          model: "test",
          status: "draft",
        },
        sheet: {
          content: {
            summary: "Should never render on toxic plants",
          } as Parameters<typeof HerbBodyContent>[0]["sheet"]["content"],
          translated: true,
        },
      })
    );
    expect(toxicBodyHtml).not.toContain("Should never render");
    expect(toxicBodyHtml).toContain("1-800-222-1222");

    const herbPageSrc = fs.readFileSync(
      path.join(ROOT, "src/app/[locale]/(herb-detail)/herbs/[slug]/page.tsx"),
      "utf8"
    );
    expect(herbPageSrc).toMatch(/\{!isDangerous\s*&&\s*\(\s*<HerbFAQSchema/);
    expect(herbPageSrc).toContain("{!isDangerous && <HerbFaqSection");
    expect(herbPageSrc).toMatch(
      /\{!isDangerous\s*&&\s*\(\s*<>\s*<HerbRelatedSection/
    );
    expect(herbPageSrc).toContain("<NewsletterSignup");

    const clinicalReviewSrc = fs.readFileSync(
      path.join(ROOT, "src/app/[locale]/(marketing)/clinical-review/page.tsx"),
      "utf8"
    );
    expect(clinicalReviewSrc).toContain("info@herbally.app");
  });

  it("enforces Release 3.6 dedicated ToxicBotanicalQuarantineCard, Open Data catalog CORS, and zero legacy washout/contact strings", () => {
    const toxicCardHtml = renderToStaticMarkup(
      createElement(ToxicBotanicalQuarantineCard, {
        slug: "abrus-precatorius",
        scientificName: "Abrus precatorius",
        contraindications: ["Contains lethal abrin"],
        sideEffects: ["Severe toxicity from seeds"],
        locale: "en",
      })
    );
    expect(toxicCardHtml).toContain("1-800-222-1222");
    expect(toxicCardHtml).toContain("1-844-764-7669");
    expect(toxicCardHtml).toContain("911");
    expect(toxicCardHtml).toContain("No therapeutic use");
    expect(toxicCardHtml).not.toContain("effects on infants");
    expect(toxicCardHtml).not.toContain(
      "Consult your healthcare provider before use"
    );
    expect(toxicCardHtml).not.toContain("What licensed products claim");

    const herbPageSrc = fs.readFileSync(
      path.join(ROOT, "src/app/[locale]/(herb-detail)/herbs/[slug]/page.tsx"),
      "utf8"
    );
    expect(herbPageSrc).toMatch(
      /\{!isDangerous\s*&&\s*\(\s*<>\s*<RegulatoryEvidenceSection/
    );
    expect(herbPageSrc).toContain("<ToxicBotanicalQuarantineCard");
    expect(herbPageSrc).toContain("medicalDisclaimerText");

    const herbHeroSrc = fs.readFileSync(
      path.join(ROOT, "src/components/herbs/herb-hero-v2.tsx"),
      "utf8"
    );
    expect(herbHeroSrc).toContain("Toxicology Quarantine Summary");
    expect(herbHeroSrc).toContain("{dangerous ? (");

    const rssSrc = fs.readFileSync(
      path.join(ROOT, "src/app/rss.xml/route.ts"),
      "utf8"
    );
    const kitSrc = fs.readFileSync(
      path.join(ROOT, "src/components/embed/librarian-citation-kit.tsx"),
      "utf8"
    );
    expect(rssSrc.toLowerCase()).not.toContain("washout planner");
    expect(rssSrc).not.toContain("contact@herbally.app");
    expect(kitSrc.toLowerCase()).not.toContain("washout planner");
    expect(kitSrc).not.toContain("contact@herbally.app");

    const openDataSrc = fs.readFileSync(
      path.join(ROOT, "src/app/open-data/catalog.json/route.ts"),
      "utf8"
    );
    expect(openDataSrc).toContain("Access-Control-Allow-Origin");
    expect(openDataSrc).toContain("medicationsAndClasses");
  });

  it("enforces Release 3.7 100% exclusive toxic quarantine and Open Data showcase on /widgets", () => {
    const toxicCardHtml = renderToStaticMarkup(
      createElement(ToxicBotanicalQuarantineCard, {
        slug: "abrus-precatorius",
        scientificName: "Abrus precatorius",
        contraindications: [
          "Contains lethal abrin",
          "Strictly contraindicated in pregnancy, breastfeeding, children, and older adults",
        ],
        sideEffects: ["Severe toxicity from seeds"],
        locale: "en",
      })
    );
    expect(toxicCardHtml).toContain("Contains lethal abrin");
    expect(toxicCardHtml).not.toMatch(/pregnancy|breastfeeding/i);

    const toxicBylineHtml = renderToStaticMarkup(
      createElement(AuthorByline, {
        locale: "en",
        isReviewed: false,
        sourceCount: 2,
        herbSlug: "abrus-precatorius",
        isDangerous: true,
      })
    );
    expect(toxicBylineHtml).not.toContain("Suggest an edit");
    expect(toxicBylineHtml).not.toContain("Editorial policy");

    const herbPageSrc = fs.readFileSync(
      path.join(ROOT, "src/app/[locale]/(herb-detail)/herbs/[slug]/page.tsx"),
      "utf8"
    );
    expect(herbPageSrc).toMatch(/\{!isDangerous\s*&&\s*\(\s*<HerbSources/);

    const widgetsPageSrc = fs.readFileSync(
      path.join(ROOT, "src/app/[locale]/(marketing)/widgets/page.tsx"),
      "utf8"
    );
    expect(widgetsPageSrc).toContain("/open-data/catalog.json");
  });

  it("enforces Release 3.8 toxic metadata/JSON-LD isolation and open LinkedIn SSO privacy copy", () => {
    const toxicSchemaHtml = renderToStaticMarkup(
      createElement(HerbSchema, {
        herb: {
          name: "Abrus precatorius",
          scientific_name: "Abrus precatorius",
          slug: "abrus-precatorius",
          description: "Toxic botanical.",
          contraindications: [
            "Contains lethal abrin",
            "Strictly contraindicated in pregnancy, breastfeeding, children, and older adults",
          ],
        },
        isDangerous: true,
        isClinicallyReviewed: false,
      })
    );
    expect(toxicSchemaHtml).not.toContain("pregnancySafety");
    expect(toxicSchemaHtml).not.toContain("breastfeedingSafety");
    expect(toxicSchemaHtml).not.toContain("MedicalSubstance");
    expect(toxicSchemaHtml).not.toMatch(/pregnancy|breastfeeding/i);
    expect(toxicSchemaHtml).toContain("Contains lethal abrin");

    const enServer = fs.readFileSync(
      path.join(ROOT, "src/lib/i18n/dictionaries/en/server.json"),
      "utf8"
    );
    const frServer = fs.readFileSync(
      path.join(ROOT, "src/lib/i18n/dictionaries/fr/server.json"),
      "utf8"
    );
    expect(enServer).not.toContain("clinical reviewers only");
    expect(frServer).not.toContain("réviseurs cliniques uniquement");
    expect(enServer).not.toContain("free dosage calculator");
    expect(frServer).not.toContain("calculateur de doses gratuit");
    expect(enServer).not.toContain("WHO, NCCIH, and PubMed");

    const herbPageSrc = fs.readFileSync(
      path.join(ROOT, "src/app/[locale]/(herb-detail)/herbs/[slug]/page.tsx"),
      "utf8"
    );
    expect(herbPageSrc).toContain(
      "provenance={isDangerous ? null : compactProvenance}"
    );
  });

  it("enforces Release 3.9 isolated ToxicQuarantineShell route group, quarantined OG card, and ad-free embed/quarantine privacy parity", () => {
    const shellHtml = renderToStaticMarkup(
      createElement(
        ToxicQuarantineShell,
        { slug: "abrus-precatorius", locale: "en" },
        createElement(ToxicBotanicalQuarantineCard, {
          slug: "abrus-precatorius",
          scientificName: "Abrus precatorius",
          contraindications: ["Contains lethal abrin"],
          sideEffects: ["Severe toxicity from seeds"],
          locale: "en",
        })
      )
    );
    expect(shellHtml).toContain("1-800-222-1222");
    expect(shellHtml).toContain("1-844-764-7669");
    expect(shellHtml).toContain("911");
    expect(shellHtml).toContain("Permanent Toxic Botanical Quarantine");
    expect(shellHtml).not.toContain("FAQ");
    expect(shellHtml).not.toContain("Editorial policy");
    expect(shellHtml).not.toContain("Herbalist");
    expect(shellHtml).not.toContain("Dose Reference");
    expect(shellHtml).not.toContain("Suggest an edit");
    expect(shellHtml).not.toMatch(/pregnancy|breastfeeding/i);

    const herbPageSrc = fs.readFileSync(
      path.join(ROOT, "src/app/[locale]/(herb-detail)/herbs/[slug]/page.tsx"),
      "utf8"
    );
    const earlyIdx = herbPageSrc.indexOf("if (isDangerous) {");
    const shellIdx = herbPageSrc.indexOf("<ToxicQuarantineShell");
    const mainShellIdx = herbPageSrc.indexOf("<MainPageShell>");
    expect(earlyIdx).toBeGreaterThan(-1);
    expect(shellIdx).toBeGreaterThan(earlyIdx);
    expect(mainShellIdx).toBeGreaterThan(shellIdx);

    const ogSrc = fs.readFileSync(
      path.join(
        ROOT,
        "src/app/[locale]/(herb-detail)/herbs/[slug]/opengraph-image.tsx"
      ),
      "utf8"
    );
    expect(ogSrc).toContain("getDangerousHerb");
    expect(ogSrc).toContain("PERMANENT TOXIC BOTANICAL QUARANTINE");

    const privacySrc = fs.readFileSync(
      path.join(ROOT, "src/app/[locale]/(marketing)/privacy/page.tsx"),
      "utf8"
    );
    const enServer = fs.readFileSync(
      path.join(ROOT, "src/lib/i18n/dictionaries/en/server.json"),
      "utf8"
    );
    const frServer = fs.readFileSync(
      path.join(ROOT, "src/lib/i18n/dictionaries/fr/server.json"),
      "utf8"
    );
    expect(privacySrc).toContain("/embed/*");
    expect(enServer).toContain("/embed/*");
    expect(frServer).toContain("/embed/*");
    const enJson = JSON.parse(enServer);
    const frJson = JSON.parse(frServer);
    expect(enJson.privacy.contact.text).toContain("info@herbally.app");
    expect(frJson.privacy.contact.text).toContain("info@herbally.app");

    const embedSrc = fs.readFileSync(
      path.join(ROOT, "src/app/[locale]/embed/checker/page.tsx"),
      "utf8"
    );
    expect(embedSrc).not.toMatch(/AdSlot|AdCmp|adsbygoogle/);
  });

  it("enforces Release 3.11 Open Data suite, public Clinical Governance Protocol, and tool WebApplication schemas", () => {
    const editorialSrc = fs.readFileSync(
      path.join(ROOT, "src/app/[locale]/(marketing)/editorial-policy/page.tsx"),
      "utf8"
    );
    expect(editorialSrc).toContain('id="clinical-governance-protocol"');
    expect(editorialSrc).toContain("24 hours");
    expect(editorialSrc).toContain("72 hours");
    expect(editorialSrc).toContain("Vacant");
    expect(editorialSrc).toContain("0 Currently Seated");
    expect(editorialSrc).toContain("/embed/*");

    const catalogSrc = fs.readFileSync(
      path.join(ROOT, "src/app/open-data/catalog.json/route.ts"),
      "utf8"
    );
    const medsPageSrc = fs.readFileSync(
      path.join(ROOT, "src/app/[locale]/(main)/medications/page.tsx"),
      "utf8"
    );
    const interactionsPageSrc = fs.readFileSync(
      path.join(
        ROOT,
        "src/app/[locale]/(marketing)/herb-drug-interactions/page.tsx"
      ),
      "utf8"
    );
    const widgetsSrc = fs.readFileSync(
      path.join(ROOT, "src/app/[locale]/(marketing)/widgets/page.tsx"),
      "utf8"
    );
    const llmsTxt = fs.readFileSync(path.join(ROOT, "public/llms.txt"), "utf8");
    const llmsFullTxt = fs.readFileSync(
      path.join(ROOT, "public/llms-full.txt"),
      "utf8"
    );

    for (const content of [
      catalogSrc,
      medsPageSrc,
      interactionsPageSrc,
      widgetsSrc,
      llmsTxt,
      llmsFullTxt,
    ]) {
      expect(content).toContain("/open-data/medications.json");
      expect(content).toContain("/open-data/quarantine.json");
    }

    for (const toolPath of [
      "src/app/[locale]/(marketing)/npn-checker/page.tsx",
      "src/app/[locale]/(marketing)/surgery-planner/page.tsx",
      "src/app/[locale]/(marketing)/widgets/page.tsx",
      "src/app/[locale]/(main)/calculator/page.tsx",
    ]) {
      const src = fs.readFileSync(path.join(ROOT, toolPath), "utf8");
      expect(src).toContain("<WebApplicationSchema");
    }
  });
});
