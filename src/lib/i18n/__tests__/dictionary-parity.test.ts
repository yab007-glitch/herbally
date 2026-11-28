import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { DangerousHerbBanner } from "@/components/herbs/dangerous-herb-banner";
import { ToxicBotanicalQuarantineCard } from "@/components/herbs/toxic-botanical-quarantine-card";
import {
  getAllDangerousHerbs,
  getDangerousHerbParts,
} from "@/lib/data/dangerous-herbs";
import {
  cleanFaqText,
  sanitizePreSurgeryContraindication,
} from "@/lib/herbs/clean-faq";

const ROOT = process.cwd();
const EN_DIR = path.join(ROOT, "src/lib/i18n/dictionaries/en");
const FR_DIR = path.join(ROOT, "src/lib/i18n/dictionaries/fr");

function flattenKeys(
  node: unknown,
  prefix: string = ""
): Array<{ key: string; value: unknown }> {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return [{ key: prefix, value: node }];
  }
  const out: Array<{ key: string; value: unknown }> = [];
  for (const [k, v] of Object.entries(node)) {
    const nextKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...flattenKeys(v, nextKey));
    } else {
      out.push({ key: nextKey, value: v });
    }
  }
  return out;
}

describe("A2: Complete EN/FR i18n dictionary key parity", () => {
  it("keeps identical namespace filenames across en and fr directories", () => {
    const enFiles = fs
      .readdirSync(EN_DIR)
      .filter((f) => f.endsWith(".json"))
      .sort();
    const frFiles = fs
      .readdirSync(FR_DIR)
      .filter((f) => f.endsWith(".json"))
      .sort();
    expect(enFiles).toEqual(frFiles);
    expect(enFiles.length).toBe(6);
  });

  it("maintains exact recursive leaf-key parity and non-empty strings across all 6 EN/FR dictionaries", () => {
    const files = fs
      .readdirSync(EN_DIR)
      .filter((f) => f.endsWith(".json"))
      .sort();

    for (const file of files) {
      const enObj = JSON.parse(
        fs.readFileSync(path.join(EN_DIR, file), "utf8")
      ) as unknown;
      const frObj = JSON.parse(
        fs.readFileSync(path.join(FR_DIR, file), "utf8")
      ) as unknown;

      const enEntries = flattenKeys(enObj);
      const frEntries = flattenKeys(frObj);

      const enKeys = enEntries.map((e) => e.key).sort();
      const frKeys = frEntries.map((e) => e.key).sort();

      expect(frKeys, `Key mismatch in ${file}`).toEqual(enKeys);

      for (const entry of [...enEntries, ...frEntries]) {
        if (typeof entry.value === "string") {
          expect(
            entry.value.trim().length,
            `Empty string in ${file}: ${entry.key}`
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it("localizes French toxic quarantine emergency labels and affected botanical parts without English residue (R2-04, R2-16, R4-02)", () => {
    const frCardHtml = renderToStaticMarkup(
      createElement(ToxicBotanicalQuarantineCard, {
        slug: "abrus-precatorius",
        scientificName: "Abrus precatorius",
        locale: "fr",
      })
    );
    expect(frCardHtml).toContain("Centre antipoison (É.-U.)");
    expect(frCardHtml).toContain("Centre antipoison (Canada)");
    expect(frCardHtml).toContain("tel:+18002221222");
    expect(frCardHtml).toContain("tel:+18447647669");
    expect(frCardHtml).toContain(
      "Parties concernées : graines (toute la plante est toxique)."
    );
    expect(frCardHtml).not.toContain("US Poison Control");
    expect(frCardHtml).not.toContain("Poison Control (US)");
    expect(frCardHtml).not.toMatch(/seeds|whole plant is hazardous/i);

    const frBannerHtml = renderToStaticMarkup(
      createElement(DangerousHerbBanner, {
        slug: "abrus-precatorius",
        locale: "fr",
      })
    );
    expect(frBannerHtml).toContain(
      "Parties concernées : graines (toute la plante est toxique)."
    );
    expect(frBannerHtml).not.toMatch(/seeds|whole plant is hazardous/i);

    const englishPartTerms =
      /\b(seeds?|leaves|roots?|whole plant|all parts|bark|berries|stems?|flowers?|essential oil|foliage|needles|shoots|twigs|kernels)\b/i;
    const allDangerous = getAllDangerousHerbs();
    expect(allDangerous.length).toBeGreaterThanOrEqual(100);
    for (const entry of allDangerous) {
      const frParts = getDangerousHerbParts(entry, "fr");
      expect(
        frParts,
        `Missing French parts translation for ${entry.slug} (${entry.parts})`
      ).not.toBe(entry.parts);
      expect(
        frParts,
        `English residue in French parts for ${entry.slug}: ${frParts}`
      ).not.toMatch(englishPartTerms);
    }
  });

  it("keeps AI and FAQ evidence copy honestly qualified across EN and FR dictionaries (R4-01)", () => {
    const enMarketing = JSON.parse(
      fs.readFileSync(path.join(EN_DIR, "marketing.json"), "utf8")
    ) as {
      faqContent: { subtitle: string; general: { trustAI: { a: string } } };
    };
    const frMarketing = JSON.parse(
      fs.readFileSync(path.join(FR_DIR, "marketing.json"), "utf8")
    ) as {
      faqContent: { subtitle: string; general: { trustAI: { a: string } } };
    };
    const enServer = JSON.parse(
      fs.readFileSync(path.join(EN_DIR, "server.json"), "utf8")
    ) as { home: { featureAiDescription: string } };
    const frServer = JSON.parse(
      fs.readFileSync(path.join(FR_DIR, "server.json"), "utf8")
    ) as { home: { featureAiDescription: string } };

    expect(enMarketing.faqContent.subtitle).not.toMatch(
      /Evidence-based answers/i
    );
    expect(enMarketing.faqContent.subtitle).toMatch(/not clinical clearance/i);
    expect(frMarketing.faqContent.subtitle).not.toMatch(
      /fondées sur les preuves/i
    );
    expect(frMarketing.faqContent.subtitle).toMatch(/validation clinique/i);

    expect(enServer.home.featureAiDescription).toMatch(
      /AI-assisted educational explanations with citations where available/i
    );
    expect(enServer.home.featureAiDescription).not.toMatch(
      /Evidence-based answers with citations/i
    );
    expect(frServer.home.featureAiDescription).toMatch(
      /Explications éducatives assistées par IA avec citations/i
    );
    expect(frServer.home.featureAiDescription).not.toMatch(
      /Réponses basées sur des preuves avec citations/i
    );
  });

  it("rewrites unilateral directive pre-surgery stop-date strings into prescriber-directed guidance (R2-02)", () => {
    const en = sanitizePreSurgeryContraindication(
      "Pre-surgery (stop 2 weeks before)",
      "en"
    );
    expect(en).not.toMatch(/stop 2 weeks before/i);
    expect(en).toMatch(/surgical team|anesthesiologist/i);
    expect(en).toMatch(/do not independently stop prescribed medications/i);

    const fr = sanitizePreSurgeryContraindication(
      "Pre-surgery (stop 2 weeks before)",
      "fr"
    );
    expect(fr).toMatch(/équipe chirurgicale|anesthésiste/i);
    expect(fr).toMatch(/n'interrompez jamais seul un médicament prescrit/i);

    const faqClean = cleanFaqText(
      "Gallstones or bile duct obstruction. Bleeding disorders. Pre-surgery (stop 2 weeks before). These cautions come from monographs.",
      "en"
    );
    expect(faqClean).not.toMatch(/stop 2 weeks before/i);
    expect(faqClean).toMatch(/surgical team|anesthesiologist/i);
  });
});
