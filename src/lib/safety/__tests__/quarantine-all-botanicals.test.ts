import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: ComponentProps<"a"> & { href: string }) =>
    createElement("a", { href, ...props }, children),
}));

import { ToxicBotanicalQuarantineCard } from "@/components/herbs/toxic-botanical-quarantine-card";
import { ToxicQuarantineShell } from "@/components/herbs/toxic-quarantine-shell";
import { HerbSchema } from "@/components/seo/herb-schema";
import {
  getAllDangerousHerbs,
  isDangerousHerb,
  shouldSuppressPublicAdultDose,
} from "@/lib/data/dangerous-herbs";

describe("A1: Exhaustive toxic botanical quarantine verification across all registry entries", () => {
  const dangerousRecords = getAllDangerousHerbs();

  it("covers all 100+ dangerous botanicals in the quarantine registry", () => {
    expect(dangerousRecords.length).toBeGreaterThanOrEqual(100);
  });

  it("enforces ToxicQuarantineShell, emergency Poison Control contacts, ad/FAQ suppression, and non-medicinal Thing schema for every quarantined botanical", () => {
    for (const record of dangerousRecords) {
      expect(isDangerousHerb(record.slug)).toBe(true);
      expect(shouldSuppressPublicAdultDose(record.slug)).toBe(true);

      const scientificName = record.slug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      for (const locale of ["en", "fr"] as const) {
        const html = renderToStaticMarkup(
          createElement(
            ToxicQuarantineShell,
            { slug: record.slug, locale },
            createElement(ToxicBotanicalQuarantineCard, {
              slug: record.slug,
              scientificName,
              contraindications: [record.reason],
              sideEffects: [`Toxic parts: ${record.parts}`],
              locale,
            })
          )
        );

        expect(html).toContain("1-800-222-1222");
        expect(html).toContain("1-844-764-7669");
        expect(html).toContain("911");
        expect(html).not.toContain("Dose Reference");
        expect(html).not.toContain("Virtual Herbalist");
        expect(html).not.toContain("Suggest an edit");
        expect(html).not.toContain("Editorial policy");
        expect(html).not.toContain("FAQ");
        expect(html).not.toContain("googlesyndication");
        expect(html).not.toContain("adsbygoogle");
        expect(html).not.toContain("effects on infants");
        expect(html).not.toContain(
          "Consult your healthcare provider before use"
        );
        expect(html).not.toMatch(
          /Pregnancy Safety|Breastfeeding Safety|Sécurité pendant la grossesse|Sécurité pendant l'allaitement|Allaitement/i
        );
      }

      const schemaHtml = renderToStaticMarkup(
        createElement(HerbSchema, {
          herb: {
            name: scientificName,
            scientific_name: scientificName,
            slug: record.slug,
            contraindications: [record.reason],
          },
          isDangerous: true,
          isClinicallyReviewed: false,
        })
      );

      expect(schemaHtml).toContain('"@type":"Thing"');
      expect(schemaHtml).not.toContain("MedicalSubstance");
      expect(schemaHtml).not.toContain("reviewedBy");
      expect(schemaHtml).not.toContain("pregnancySafety");
      expect(schemaHtml).not.toContain("breastfeedingSafety");
    }
  });
});
