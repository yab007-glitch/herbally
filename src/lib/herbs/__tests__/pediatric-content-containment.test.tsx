import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/herbs/chamomile",
}));

import {
  FAQ_FALLBACK_QUESTION_EN,
  FAQ_FALLBACK_QUESTION_FR,
  isPubmedPediatricKey,
  normalizePublicFaqs,
  sanitizeHerbPageBundle,
} from "@/lib/herbs/herb-page-data";
import { redactPublicHerbFields } from "@/lib/utils/localize-herb";
import type { Herb } from "@/lib/types";
import { summariseDosage } from "@/lib/herbs/narrative";
import { cleanFaqText } from "@/lib/herbs/clean-faq";
import { SafetyGlance } from "@/components/herbs/herb-safety-glance";
import { PubmedMonographSheetView } from "@/components/herbs/pubmed-monograph-sheet-view";
import { PrintSafetyFooter } from "@/components/shared/print-safety-footer";

describe("Phase A.6 pediatric content & print containment", () => {
  it("strips dosage_child and pediatric dosing sentences from public herb serialization", () => {
    const clean = redactPublicHerbFields({
      id: "h-1",
      slug: "chamomile",
      name: "Chamomile",
      scientific_name: "Matricaria chamomilla",
      dosage_adult: "3 g infusion daily. For children 6-12 years: 100 mg.",
      dosage_child: "100 mg",
      translations: {
        fr: {
          name: "Camomille",
          dosage_child: "100 mg enfant",
        },
      },
    } as unknown as Herb);

    expect(clean.dosage_child).toBeNull();
    expect(clean.dosage_adult).toBe("3 g infusion daily.");
    expect(JSON.stringify(clean.translations)).not.toContain("100 mg enfant");
  });

  it("removes pediatric dosing sentences from PubMed sheet, FAQ cleaner, and narrative", () => {
    const doseSummary = summariseDosage({
      name: "Chamomile",
      dosageAdult: "2–4 g tea. Children under 12: 150 mg.",
      isDangerous: false,
    });
    expect(doseSummary).not.toMatch(/150 mg/i);

    const faqCleaned = cleanFaqText(
      "Adults use 500 mg daily. Pediatric dosage for children 6-12 years: 100 mg."
    );
    expect(faqCleaned).not.toMatch(/100 mg/i);

    render(
      <PubmedMonographSheetView
        content={{
          summary: "Summary text.",
          dosageAndAdministration:
            "Adults take 500 mg capsule. Children age 6: 250 mg twice daily.",
          safetyAndAdverseEffects: "Keep out of reach of children.",
        }}
        citations={[]}
        articleCount={1}
        status={null}
      />
    );
    expect(screen.queryByText(/250 mg/i)).toBeNull();
    expect(
      screen.getByText(/Keep out of reach of children/i)
    ).toBeInTheDocument();
  });

  it("renders explicit pediatric unavailable status in SafetyGlance", () => {
    render(
      <SafetyGlance
        pregnancySafe={null}
        nursingSafe={null}
        contraindications={[]}
        interactions={[]}
      />
    );
    expect(screen.getByText("pediatric")).toBeInTheDocument();
    expect(screen.getByText("pediatricUnavailable")).toBeInTheDocument();
  });

  it("renders adult-only software-scope notice in PrintSafetyFooter", () => {
    render(<PrintSafetyFooter locale="en" adultAgeYears={42} />);
    expect(screen.getByText(/adults aged 18\+/i)).toBeInTheDocument();
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it("sanitizes herb_page_bundle payloads across herb, relatedHerbs, regulatoryEvidence, monographs, and PubMed sheets", () => {
    const sanitized = sanitizeHerbPageBundle({
      herb: {
        id: "h-senna",
        slug: "senna-leaf",
        name: "Senna",
        scientific_name: "Senna alexandrina",
        dosage_adult:
          "Adults: 15-30 mg at bedtime. Children 2-12: 7.5 mg. Never give to infants due to dehydration hazard.",
        dosage_child: "7.5 mg",
        translations: { fr: { name: "Séné", dosage_child: "7.5 mg" } },
      } as unknown as Herb,
      relatedHerbs: [
        {
          id: "h-aconite",
          slug: "aconite-processed",
          name: "Aconite",
          scientific_name: "Aconitum",
          dosage_adult: "100 mg daily",
          dosage_child: "10 mg",
        } as unknown as Herb,
      ],
      interactions: [],
      regulatoryEvidence: [
        {
          herb_slug: "senna-leaf",
          source: "Health Canada LNHPD",
          source_licence: "OGL",
          purposes: ["Relieve occasional constipation"],
          doses: [
            { text: "15-30 mg daily", population: "Adults and children 12+" },
            { text: "7.5 mg daily", population: "Children 2-11" },
          ],
          risks: ["Keep out of reach of children."],
          products_sampled: 1,
          source_urls: [],
          retrieved_at: "2026-11-22T00:00:00Z",
        },
      ],
      monographSources: [
        {
          herb_slug: "senna-leaf",
          source: "EMA HMPC",
          licence: "Public",
          claims: ["Short-term use in constipation"],
          safety: ["Keep out of reach of children."],
          doses: ["Adults: 15-30 mg daily", "Children 2-12 years: 7.5 mg"],
          url: "https://www.ema.europa.eu",
          monograph_date: "2020-01-01",
        },
      ],
      pubmedMonograph: {
        content: {
          summary: "Summary",
          dosageAndAdministration: "Adults: 15-30 mg. 18 months: 2 mg.",
          safetyAndAdverseEffects: "Keep out of reach of children.",
        },
        citations: [],
        articleCount: 1,
        status: "approved",
      },
      localizedDescriptions: {
        en: "Adults: 15-30 mg. Children: 5 mg.",
        fr: "Adultes: 15-30 mg. Enfants: 5 mg.",
      },
    } as Parameters<typeof sanitizeHerbPageBundle>[0]) as unknown as {
      herb: Herb;
      relatedHerbs: Herb[];
      regulatoryEvidence: Array<{ doses: unknown[] }>;
      monographSources: Array<{ doses: unknown[] }>;
      pubmedMonograph: { content: { dosageAndAdministration: string | null } };
    };

    expect(sanitized.herb.dosage_child).toBeNull();
    expect(sanitized.herb.dosage_adult).toContain("15-30 mg at bedtime");
    expect(sanitized.herb.dosage_adult).toContain("Never give to infants");
    expect(sanitized.herb.dosage_adult).not.toContain("7.5 mg");
    expect(sanitized.relatedHerbs[0]?.dosage_child).toBeNull();
    expect(sanitized.relatedHerbs[0]?.dosage_adult).toBeNull();
    expect(sanitized.regulatoryEvidence?.[0]?.doses).toHaveLength(1);
    expect(sanitized.monographSources?.[0]?.doses).toEqual([
      "Adults: 15-30 mg daily",
    ]);
    expect(
      sanitized.pubmedMonograph?.content.dosageAndAdministration
    ).not.toContain("18 months");
  });

  it("sanitizes pediatric dosing prose inside bundle faqs and monograph sections (senna/fennel strings)", () => {
    const bundle = sanitizeHerbPageBundle({
      herb: {
        id: "h-fennel",
        slug: "fennel",
        name: "Fennel",
        scientific_name: "Foeniculum vulgare",
        dosage_adult:
          "Adults and adolescents: 1.5 g crushed fennel fruit in 250 ml boiling water (steep 15 minutes) 3 times daily (4.5 g/day); children 4–12 years: 1.0 g in 100 ml boiling water 3 times daily (3.0 g/day).",
        dosage_child: "1.0 g 3 times daily",
        preparation_notes:
          "Adults: steep 15 minutes. Children 4-12 years: 100 ml boiling water.",
        translations: {
          fr: {
            name: "Fenouil",
            dosage_adult:
              "Adultes et adolescents : 1,5 g de fruits de fenouil dans 250 ml d'eau bouillante (infuser 15 min) 3 fois par jour (4,5 g/jour) ; enfants de 4 à 12 ans : 1,0 g dans 100 ml d'eau bouillante 3 fois par jour (3,0 g/jour).",
            dosage_child: "1,0 g enfant",
          },
        },
      } as unknown as Herb,
      faqs: [
        {
          question: "What is the standard dose?",
          answer:
            "Adults and adolescents over 12 years: herbal tea or preparation equivalent to 10–30 mg hydroxyanthracene derivatives (calculated as sennoside B) once daily at night; use lowest effective dose. Contraindicated under 12 years.",
          translations: {
            fr: {
              question: "Quelle est la dose standard ?",
              answer:
                "Adultes et adolescents : 1,5 g de fruits de fenouil dans 250 ml d'eau bouillante (4,5 g/jour) ; enfants de 4 à 12 ans : 1,0 g dans 100 ml d'eau bouillante.",
            },
          },
        },
      ],
      monograph: {
        summary:
          "Fennel infusion: Adults: 1.5 g three times daily. Children 4-12 years: 1.0 g three times daily.",
        mechanism:
          "Carminative volatile oils. Give a 5-year-old 250 mg; toxic in overdose.",
        claims: [
          "Relief of mild digestive spasms in adults.",
          "Children 4-12 years: 1.0 g in 100 ml.",
        ],
        safety_notes: [
          "Contraindicated under 12 years.",
          "Give a 5-year-old 250 mg; toxic in overdose.",
        ],
      },
    } as Record<string, unknown>) as {
      herb: Herb;
      faqs: Array<{
        answer: string;
        translations?: { fr?: { answer?: string } };
      }>;
      monograph: {
        summary: string;
        mechanism: string;
        claims: string[];
        safety_notes: string[];
      };
    };

    expect(bundle.herb.dosage_adult).toContain("1.5 g crushed fennel fruit");
    expect(bundle.herb.dosage_adult).not.toContain("1.0 g");
    expect(bundle.faqs[0]?.answer).toContain("10–30 mg");
    expect(bundle.faqs[0]?.answer).toContain("Contraindicated under 12 years.");
    expect(bundle.faqs[0]?.answer).not.toMatch(/adolescents over 12/i);
    expect(bundle.faqs[0]?.translations?.fr?.answer).toContain("1,5 g");
    expect(bundle.faqs[0]?.translations?.fr?.answer).not.toContain("1,0 g");
    expect(bundle.monograph.summary).toContain("1.5 g");
    expect(bundle.monograph.summary).not.toContain("1.0 g");
    expect(bundle.monograph.mechanism).not.toContain("250 mg");
    expect(bundle.monograph.mechanism).toContain("toxic in overdose");
    expect(bundle.monograph.claims).toEqual([
      "Relief of mild digestive spasms in adults.",
    ]);
    expect(bundle.monograph.safety_notes).toEqual([
      "Contraindicated under 12 years.",
      "toxic in overdose.",
    ]);
  });

  it("sanitizes monograph_sources claims/safety and regulatory purposes/risks using real senna and fennel strings", () => {
    const bundle = sanitizeHerbPageBundle({
      herb: {
        id: "h-senna",
        slug: "senna-leaf",
        name: "Senna",
        scientific_name: "Senna alexandrina",
        description:
          "Stimulant laxative for adults. For children 6-12 years: 7.5 mg sennosides.",
        preparation_notes:
          "Steep 1.5 g in hot water for adults. Give children 4-12 years 100 ml.",
        traditional_uses: [
          "Occasional constipation in adults",
          "Children 6-12 years: 7.5 mg at bedtime",
        ],
        contraindications: [
          "Contraindicated in children under 12 years.",
          "Give a 5-year-old 5 mg; toxic in intestinal obstruction.",
        ],
        side_effects: [
          "Abdominal cramps.",
          "Children 6-12 years: 10 mg may cause diarrhea.",
        ],
      } as unknown as Herb,
      regulatory: {
        herb_slug: "senna-leaf",
        source: "Health Canada",
        source_licence: "ogl-canada",
        purposes: [
          "Short-term relief of occasional constipation in adults.",
          "Children 4-11 years: 1.0 g three times daily.",
        ],
        doses: [
          {
            text: "Adults and adolescents: 1.5 g crushed fennel fruit in 250 ml boiling water (4.5 g/day); children 4-12 years: 1.0 g in 100 ml boiling water.",
            population: "Adults and adolescents 12+",
            age_minimum: 12,
          },
        ],
        risks: [
          "Fennel oil not for infants or children under 4 years.",
          "Give a 5-year-old 250 mg; toxic in overdose.",
        ],
        products_sampled: 1,
        source_urls: [],
        retrieved_at: "2026-11-22T00:00:00Z",
      },
      sources: [
        {
          herb_slug: "senna-leaf",
          source: "European Medicines Agency (HMPC)",
          licence: "EMA public document",
          attribution: "EMA",
          url: "https://www.ema.europa.eu",
          claims: [
            {
              section: "4.1 Therapeutic indications",
              text: "Short-term use in occasional constipation. Children 6-12 years: 7.5 mg daily.",
            },
            "Relief of bloating in adults. For a 4-year-old: 5 ml tea.",
          ],
          safety: [
            "Contraindications (4.3): Contraindicated in children under 12 years.",
            "Warnings: Never give children 5 ml; give 10 ml.",
          ],
          doses: [
            "Adults and adolescents over 12 years: 15-30 mg hydroxyanthracene daily.",
            "Children 4-11 years: 1.0 g infusion.",
          ],
          monograph_date: "2020-01-01",
        },
      ],
    } as Record<string, unknown>) as {
      herb: Herb;
      regulatory: {
        purposes: string[];
        risks: string[];
        doses: Array<{ text: string }>;
      };
      sources: Array<{
        claims: Array<string | { section: string; text: string }>;
        safety: string[];
        doses: string[];
      }>;
    };

    expect(bundle.herb.description).not.toContain("7.5 mg");
    expect(bundle.herb.preparation_notes).not.toContain("100 ml");
    expect(bundle.herb.traditional_uses).toEqual([
      "Occasional constipation in adults",
    ]);
    expect(bundle.herb.contraindications).toEqual([
      "Contraindicated in children under 12 years.",
      "toxic in intestinal obstruction.",
    ]);
    expect(bundle.herb.side_effects).toEqual(["Abdominal cramps."]);

    expect(bundle.regulatory.purposes).toEqual([
      "Short-term relief of occasional constipation in adults.",
    ]);
    expect(bundle.regulatory.risks).toEqual([
      "Fennel oil not for infants or children under 4 years.",
      "toxic in overdose.",
    ]);

    const claimObj = bundle.sources[0]?.claims[0] as { text: string };
    expect(claimObj.text).not.toContain("7.5 mg");
    expect(claimObj.text).toContain("occasional constipation");
    expect(bundle.sources[0]?.claims[1]).toBe("Relief of bloating in adults.");
    expect(bundle.sources[0]?.safety[0]).toContain(
      "Contraindicated in children under 12 years."
    );
    expect(bundle.sources[0]?.safety[1]).not.toContain("10 ml");
    expect(bundle.sources[0]?.doses).toEqual([
      "Adults: 15-30 mg hydroxyanthracene daily.",
    ]);
  });

  it("sanitizes monograph drug_interactions, FAQ questions EN/FR, and all PubMed dose/prose keys in bundle", () => {
    const bundle = sanitizeHerbPageBundle({
      herb: {
        id: "h-chamomile",
        slug: "chamomile",
        name: "Chamomile",
        scientific_name: "Matricaria chamomilla",
      } as unknown as Herb,
      faqs: [
        {
          question:
            "What is the adult dose? Should children 6-18 years take 100 mg?",
          answer:
            "Adults 18 years and older: 500 mg daily. Under-18: 100 mg daily.",
          translations: {
            fr: {
              question:
                "Quelle est la dose adulte ? Les enfants de 6 à 18 ans peuvent-ils prendre 100 mg ?",
              answer:
                "Adultes de 18 ans et plus : 500 mg. Moins de 18 ans : 100 mg.",
            },
          },
        },
        {
          question: "Give children 0-18 years 100 mg daily?",
          answer: "Children 0-18 years: 100 mg daily.",
        },
        {
          question: "Can children take chamomile?",
          answer:
            "Contraindicated in children under 12 years without medical advice. Keep out of reach of children.",
          translations: {
            fr: {
              question: "Les enfants peuvent-ils prendre de la camomille ?",
              answer:
                "Déconseillé chez l'enfant de moins de 12 ans sans avis médical.",
            },
          },
        },
        {
          question: "What is the chamomile dose for children?",
          answer: "Not recommended for children under 12 years.",
        },
      ],
      monograph: {
        summary: "Chamomile overview.",
        drug_interactions: [
          {
            drug: "Warfarin",
            severity: "moderate",
            detail:
              "Adults take 500 mg with INR monitoring. Children 6-18 years: 100 mg daily.",
          },
        ],
        drugInteractions: [
          {
            drug: "Aspirin",
            detail: "Adults (18+): monitor bleeding. Under 18: 50 mg daily.",
          },
        ],
      },
      pubmed: {
        content: {
          summary: "Summary for adults. Children 6-18 years: 100 mg daily.",
          dosageAndAdministration:
            "Adults 18+: 500 mg daily. 0-18 years: 50 mg daily.",
          dosage_and_administration: "Adults: 500 mg. Under-18: 100 mg daily.",
          dosage: "Adults 18 years and older: 500 mg. Children 6-18: 100 mg.",
          dose: "Adults over 18: 500 mg daily. Up to 18: 100 mg.",
          dosing: "Adults: 500 mg. Give a 5-year-old 50 mg.",
          recommendedDosage: "Adults: 500 mg. Children under 18: 100 mg.",
          pediatricDosage: "Children 6-12 years: 100 mg.",
          pediatricDose: "Children: 100 mg.",
          pediatricUse: "Give children 75 mg daily.",
          childDose: "50 mg twice daily.",
          paediatricDosage: "80 mg daily.",
          additionalNotes: "Adults 18+: 500 mg. Children 18 and under: 100 mg.",
          nestedSection: {
            note: "Adults take 500 mg. Children 18 or younger: 100 mg.",
          },
          drugInteractions:
            "Monitor warfarin in adults. Children 6-18: 100 mg.",
          clinicalEvidence: [
            {
              condition: "Sleep",
              finding: "Helps adults at 500 mg. Children 6-18: 100 mg.",
            },
          ],
          fr: {
            dosageAndAdministration:
              "Adultes de 18 ans et plus : 500 mg. Moins de 18 ans : 100 mg.",
            dosage: "Adultes : 500 mg. Enfants 6-18 ans : 100 mg.",
            pediatricDosage: "Enfants : 100 mg.",
            childDose: "50 mg.",
            additionalNotes: "Adultes 18+ : 500 mg. Moins de 18 ans : 100 mg.",
          },
        },
      },
    } as Record<string, unknown>) as {
      faqs: Array<{
        question: string;
        answer: string;
        translations?: { fr?: { question?: string; answer?: string } };
      }>;
      monograph: {
        drug_interactions: Array<{ drug: string; detail: string }>;
        drugInteractions: Array<{ drug: string; detail: string }>;
      };
      pubmed: {
        content: Record<string, unknown> & {
          fr?: Record<string, unknown>;
          nestedSection?: Record<string, unknown>;
          clinicalEvidence?: Array<{ finding: string }>;
        };
      };
    };

    expect(bundle.faqs).toHaveLength(3);
    expect(bundle.faqs[0]?.question).toBe("What is the adult dose?");
    expect(bundle.faqs[0]?.answer).toBe(
      "Adults 18 years and older: 500 mg daily."
    );
    expect(bundle.faqs[0]?.translations?.fr?.question).toBe(
      "Quelle est la dose adulte ?"
    );
    expect(bundle.faqs[0]?.translations?.fr?.answer).toBe(
      "Adultes de 18 ans et plus : 500 mg."
    );
    expect(bundle.faqs[1]?.question).toBe("Can children take chamomile?");
    expect(bundle.faqs[1]?.answer).toContain(
      "Contraindicated in children under 12 years"
    );
    expect(bundle.faqs[1]?.translations?.fr?.question).toBe(
      "Les enfants peuvent-ils prendre de la camomille ?"
    );
    expect(bundle.faqs[2]?.question).toBe(
      "What is the chamomile dose for children?"
    );
    expect(bundle.faqs[2]?.answer).toBe(
      "Not recommended for children under 12 years."
    );

    expect(bundle.monograph.drug_interactions[0]?.detail).toBe(
      "Adults take 500 mg with INR monitoring."
    );
    expect(bundle.monograph.drugInteractions[0]?.detail).toBe(
      "Adults (18+): monitor bleeding."
    );

    const pm = bundle.pubmed.content;
    expect(pm.pediatricDosage).toBeUndefined();
    expect(pm.pediatricDose).toBeUndefined();
    expect(pm.pediatricUse).toBeUndefined();
    expect(pm.childDose).toBeUndefined();
    expect(pm.paediatricDosage).toBeUndefined();
    expect(pm.dosageAndAdministration).toBe("Adults 18+: 500 mg daily.");
    expect(pm.dosage_and_administration).toBe("Adults: 500 mg.");
    expect(pm.dosage).toBe("Adults 18 years and older: 500 mg.");
    expect(pm.dose).toBe("Adults over 18: 500 mg daily.");
    expect(pm.dosing).toBe("Adults: 500 mg.");
    expect(pm.recommendedDosage).toBe("Adults: 500 mg.");
    expect(pm.additionalNotes).toBe("Adults 18+: 500 mg.");
    expect(pm.nestedSection?.note).toBe("Adults take 500 mg.");
    expect(pm.summary).toBe("Summary for adults.");
    expect(pm.drugInteractions).toBe("Monitor warfarin in adults.");
    expect(pm.clinicalEvidence?.[0]?.finding).toBe("Helps adults at 500 mg.");
    expect(pm.fr?.pediatricDosage).toBeUndefined();
    expect(pm.fr?.childDose).toBeUndefined();
    expect(pm.fr?.dosageAndAdministration).toBe(
      "Adultes de 18 ans et plus : 500 mg."
    );
    expect(pm.fr?.dosage).toBe("Adultes : 500 mg.");
    expect(pm.fr?.additionalNotes).toBe("Adultes 18+ : 500 mg.");
  });

  it("deletes either-order pediatric/child/infant/minor PubMed keys while preserving adult dosage content", () => {
    const deletedKeys = [
      "useInChildren",
      "use_in_children",
      "doseInChildren",
      "dose_in_children",
      "administrationInChildren",
      "administration_in_children",
      "dosageForChildren",
      "dosage_for_children",
      "dosingInChildren",
      "dosing_in_children",
      "useInInfants",
      "use_in_infants",
      "infantDosage",
      "infant_dosage",
      "doseInInfants",
      "useInMinors",
      "use_in_minors",
      "minorDose",
      "minor_dosage",
      "dosingForMinors",
      "pediatricDosage",
      "pediatric_use",
      "pediatricAdministration",
      "childDose",
      "paediatricDosage",
      "dosage_child",
      "useinchildren",
      "doseinchildren",
      "administrationinchildren",
    ];
    for (const k of deletedKeys) {
      expect(isPubmedPediatricKey(k)).toBe(true);
    }

    const preservedKeys = [
      "dosageAndAdministration",
      "dosage_and_administration",
      "dosage",
      "dose",
      "dosing",
      "recommendedDosage",
      "adultDosage",
      "adult_dosage",
      "administration",
      "childSafety",
      "minorSideEffects",
    ];
    for (const k of preservedKeys) {
      expect(isPubmedPediatricKey(k)).toBe(false);
    }

    const pubmedInput: Record<string, unknown> = {
      adultDosage: "Adults 18+: 500 mg daily. Children 6-12 years: 100 mg.",
      dosageAndAdministration: "Adults: 500 mg daily. Give infants 25 mg.",
      childSafety:
        "Children should not take this product. Must not be given to infants. Not for use in children under 12 years. Not suitable for minors. Children 6-12 years: 50 mg daily.",
      minorSideEffects:
        "Minor side effects: mild nausea if you take on an empty stomach; children should not take this product.",
      fr: {
        adult_dosage: "Adultes 18+ : 500 mg. Enfants 6-12 ans : 100 mg.",
        childSafety:
          "Les enfants ne doivent pas prendre ce produit. Ne convient pas aux enfants.",
        useInChildren: "100 mg pour enfants.",
        dose_in_children: "50 mg.",
        administrationInChildren: "25 mg.",
      },
      nestedSection: {
        dosage: "Adults: 300 mg daily.",
        use_in_children: "Do not use 50 mg.",
        doseInChildren: "50 mg.",
      },
    };
    for (const k of deletedKeys) {
      pubmedInput[k] = "100 mg daily";
    }

    const bundle = sanitizeHerbPageBundle({
      herb: {
        id: "h-chamomile",
        slug: "chamomile",
        name: "Chamomile",
        scientific_name: "Matricaria chamomilla",
      } as unknown as Herb,
      pubmed: { content: pubmedInput },
    } as Record<string, unknown>) as {
      pubmed: {
        content: Record<string, unknown> & {
          fr?: Record<string, unknown>;
          nestedSection?: Record<string, unknown>;
        };
      };
    };

    const pm = bundle.pubmed.content;
    for (const k of deletedKeys) {
      expect(pm[k]).toBeUndefined();
    }
    expect(pm.adultDosage).toBe("Adults 18+: 500 mg daily.");
    expect(pm.dosageAndAdministration).toBe("Adults: 500 mg daily.");
    expect(pm.childSafety).toBe(
      "Children should not take this product. Must not be given to infants. Not for use in children under 12 years. Not suitable for minors."
    );
    expect(pm.minorSideEffects).toBe(
      "Minor side effects: mild nausea if you take on an empty stomach; children should not take this product."
    );
    expect(pm.fr?.childSafety).toBe(
      "Les enfants ne doivent pas prendre ce produit. Ne convient pas aux enfants."
    );
    expect(pm.fr?.useInChildren).toBeUndefined();
    expect(pm.fr?.dose_in_children).toBeUndefined();
    expect(pm.fr?.administrationInChildren).toBeUndefined();
    expect(pm.fr?.adult_dosage).toBe("Adultes 18+ : 500 mg.");
    expect(pm.nestedSection?.use_in_children).toBeUndefined();
    expect(pm.nestedSection?.doseInChildren).toBeUndefined();
    expect(pm.nestedSection?.dosage).toBe("Adults: 300 mg daily.");
  });

  it("preserves non-dose childSafety and minorSideEffects warning forms across PubMed and bundle fields", () => {
    const bundle = sanitizeHerbPageBundle({
      herb: {
        id: "h-chamomile",
        slug: "chamomile",
        name: "Chamomile",
        scientific_name: "Matricaria chamomilla",
        dosage_adult:
          "Adults: 500 mg twice daily. Children should not take this product.",
      } as unknown as Herb,
      pubmed: {
        content: {
          adultDosage: "Adults: 500 mg twice daily.",
          childSafety: "Children should not take this product.",
          minorSideEffects:
            "Minor side effects: mild nausea if you take on an empty stomach.",
        },
      },
    } as Record<string, unknown>) as {
      herb: Herb;
      pubmed: { content: Record<string, unknown> };
    };

    expect(bundle.herb.dosage_adult).toBe(
      "Adults: 500 mg twice daily. Children should not take this product."
    );
    expect(bundle.pubmed.content.adultDosage).toBe(
      "Adults: 500 mg twice daily."
    );
    expect(bundle.pubmed.content.childSafety).toBe(
      "Children should not take this product."
    );
    expect(bundle.pubmed.content.minorSideEffects).toBe(
      "Minor side effects: mild nausea if you take on an empty stomach."
    );
  });

  it("retains warning answer with neutral localized fallback question when numeric pediatric question strips to empty (EN & FR)", () => {
    const rawFaqs = [
      {
        question: "Should children 6-12 years take 100 mg daily?",
        answer:
          "Stop use and consult a healthcare professional if adverse reactions occur.",
        translations: {
          fr: {
            question:
              "Les enfants de 6 à 12 ans peuvent-ils prendre 100 mg par jour ?",
            answer:
              "Cesser l'utilisation et consulter un professionnel de la santé en cas de réaction indésirable.",
          },
        },
      },
      {
        question: "Give children 0-18 years 100 mg daily?",
        answer: "Children 0-18 years: 100 mg daily.",
        translations: {
          fr: {
            question: "Donner 100 mg par jour aux enfants de 0 à 18 ans ?",
            answer: "Enfants 0-18 ans : 100 mg par jour.",
          },
        },
      },
      {
        question: "Can children take chamomile?",
        answer: "Contraindicated in children under 12 years.",
        translations: {
          fr: {
            question: "Les enfants peuvent-ils prendre de la camomille ?",
            answer: "Déconseillé chez l'enfant de moins de 12 ans.",
          },
        },
      },
    ];

    const bundle = sanitizeHerbPageBundle({
      herb: {
        id: "h-chamomile",
        slug: "chamomile",
        name: "Chamomile",
        scientific_name: "Matricaria chamomilla",
      } as unknown as Herb,
      faqs: rawFaqs,
    } as Record<string, unknown>) as {
      faqs: Array<{
        question: string;
        answer: string;
        translations?: { fr?: { question?: string; answer?: string } };
      }>;
    };

    expect(bundle.faqs).toHaveLength(2);
    expect(bundle.faqs[0]?.question).toBe(FAQ_FALLBACK_QUESTION_EN);
    expect(bundle.faqs[0]?.answer).toBe(
      "Stop use and consult a healthcare professional if adverse reactions occur."
    );
    expect(bundle.faqs[0]?.translations?.fr?.question).toBe(
      FAQ_FALLBACK_QUESTION_FR
    );
    expect(bundle.faqs[0]?.translations?.fr?.answer).toBe(
      "Cesser l'utilisation et consulter un professionnel de la santé en cas de réaction indésirable."
    );
    expect(JSON.stringify(bundle.faqs[0])).not.toMatch(
      /child|children|enfant|6[-–]12|6 à 12|100 mg|pediatric/i
    );
    expect(bundle.faqs[1]?.question).toBe("Can children take chamomile?");

    for (const source of [bundle.faqs, rawFaqs]) {
      const enFaqs = normalizePublicFaqs(source, "en");
      expect(enFaqs).toHaveLength(2);
      expect(enFaqs[0]?.question).toBe(FAQ_FALLBACK_QUESTION_EN);
      expect(enFaqs[0]?.answer).toBe(
        "Stop use and consult a healthcare professional if adverse reactions occur."
      );
      expect(JSON.stringify(enFaqs[0])).not.toMatch(
        /child|children|enfant|6[-–]12|6 à 12|100 mg|pediatric/i
      );
      expect(enFaqs[1]?.question).toBe("Can children take chamomile?");

      const frFaqs = normalizePublicFaqs(source, "fr");
      expect(frFaqs).toHaveLength(2);
      expect(frFaqs[0]?.question).toBe(FAQ_FALLBACK_QUESTION_FR);
      expect(frFaqs[0]?.answer).toBe(
        "Cesser l'utilisation et consulter un professionnel de la santé en cas de réaction indésirable."
      );
      expect(frFaqs[0]?.translations).toBeDefined();
      expect(`${frFaqs[0]?.question} ${frFaqs[0]?.answer}`).not.toMatch(
        /child|children|enfant|6[-–]12|6 à 12|100 mg|pediatric/i
      );
      expect(frFaqs[1]?.question).toBe(
        "Les enfants peuvent-ils prendre de la camomille ?"
      );
    }
  });

  it("enforces FAQ EN/FR parity: retains English-empty/French-warning rows with localized fallbacks and zero pediatric exposure, dropping only when both EN and FR are empty", () => {
    const rawFaqs = [
      {
        question: "Should children 6-12 years take 100 mg daily?",
        answer: "Children 6-12 years: 100 mg daily.",
        translations: {
          fr: {
            question:
              "Les enfants de 6 à 12 ans peuvent-ils prendre 100 mg par jour ?",
            answer:
              "Cesser l'utilisation et consulter un professionnel de la santé en cas de réaction indésirable.",
          },
        },
      },
      {
        question: "What is the pediatric dose for children?",
        answer: "",
        translations: {
          fr: {
            question: "Quelle est la dose pour les enfants ?",
            answer: "Ne pas dépasser la dose recommandée chez l'adulte.",
          },
        },
      },
      {
        question: "Should children take 50 mg?",
        answer: "Adults should consult a clinician before long-term use.",
        translations: {
          fr: {
            question: "Donner 50 mg aux enfants ?",
            answer: "Enfants 6-12 ans : 50 mg par jour.",
          },
        },
      },
      {
        question: "Give children 0-18 years 100 mg daily?",
        answer: "Children 0-18 years: 100 mg daily.",
        translations: {
          fr: {
            question: "Donner 100 mg par jour aux enfants de 0 à 18 ans ?",
            answer: "Enfants 0-18 ans : 100 mg par jour.",
          },
        },
      },
    ];

    const bundle = sanitizeHerbPageBundle({
      herb: {
        id: "h-chamomile",
        slug: "chamomile",
        name: "Chamomile",
        scientific_name: "Matricaria chamomilla",
      } as unknown as Herb,
      faqs: rawFaqs,
    } as Record<string, unknown>) as {
      faqs: Array<{
        question: string;
        answer: string;
        translations?: { fr?: { question?: string; answer?: string } };
      }>;
    };

    // Row 4 (both EN and FR empty after stripping) is dropped; rows 1-3 are retained
    expect(bundle.faqs).toHaveLength(3);

    // Row 1: EN answer stripped to empty while FR warning non-empty -> retained with EN fallback question & empty EN answer, FR fallback question & warning answer
    expect(bundle.faqs[0]?.question).toBe(FAQ_FALLBACK_QUESTION_EN);
    expect(bundle.faqs[0]?.answer).toBe("");
    expect(bundle.faqs[0]?.translations?.fr?.question).toBe(
      FAQ_FALLBACK_QUESTION_FR
    );
    expect(bundle.faqs[0]?.translations?.fr?.answer).toBe(
      "Cesser l'utilisation et consulter un professionnel de la santé en cas de réaction indésirable."
    );
    expect(JSON.stringify(bundle.faqs[0])).not.toMatch(
      /child|children|enfant|6[-–]12|6 à 12|100 mg|pediatric/i
    );

    // Row 2: EN answer absent/empty while FR warning non-empty -> raw EN pediatric question replaced with EN fallback question
    expect(bundle.faqs[1]?.question).toBe(FAQ_FALLBACK_QUESTION_EN);
    expect(bundle.faqs[1]?.answer).toBe("");
    expect(bundle.faqs[1]?.translations?.fr?.question).toBe(
      "Quelle est la dose pour les enfants ?"
    );
    expect(bundle.faqs[1]?.translations?.fr?.answer).toBe(
      "Ne pas dépasser la dose recommandée chez l'adulte."
    );
    expect(bundle.faqs[1]?.question).not.toMatch(/pediatric|children/i);

    // Row 3: EN warning non-empty while FR stripped to empty -> FR question/answer cleared so raw FR pediatric question is not leaked
    expect(bundle.faqs[2]?.question).toBe(FAQ_FALLBACK_QUESTION_EN);
    expect(bundle.faqs[2]?.answer).toBe(
      "Adults should consult a clinician before long-term use."
    );
    expect(bundle.faqs[2]?.translations?.fr).toEqual({
      question: "",
      answer: "",
    });
    expect(JSON.stringify(bundle.faqs[2])).not.toMatch(
      /child|children|enfant|50 mg|pediatric/i
    );

    // Parity across normalizePublicFaqs for both pre-sanitized bundle rows and raw DB-like rows
    for (const source of [bundle.faqs, rawFaqs]) {
      const enFaqs = normalizePublicFaqs(source, "en");
      expect(enFaqs).toHaveLength(1);
      expect(enFaqs[0]?.question).toBe(FAQ_FALLBACK_QUESTION_EN);
      expect(enFaqs[0]?.answer).toBe(
        "Adults should consult a clinician before long-term use."
      );
      expect(enFaqs[0]?.translations?.fr).toEqual({
        question: "",
        answer: "",
      });
      expect(JSON.stringify(enFaqs[0])).not.toMatch(
        /child|children|enfant|50 mg|100 mg|pediatric/i
      );

      const frFaqs = normalizePublicFaqs(source, "fr");
      expect(frFaqs).toHaveLength(2);
      expect(frFaqs[0]?.question).toBe(FAQ_FALLBACK_QUESTION_FR);
      expect(frFaqs[0]?.answer).toBe(
        "Cesser l'utilisation et consulter un professionnel de la santé en cas de réaction indésirable."
      );
      expect(`${frFaqs[0]?.question} ${frFaqs[0]?.answer}`).not.toMatch(
        /child|children|enfant|6[-–]12|6 à 12|100 mg|pediatric/i
      );
      expect(frFaqs[1]?.question).toBe("Quelle est la dose pour les enfants ?");
      expect(frFaqs[1]?.answer).toBe(
        "Ne pas dépasser la dose recommandée chez l'adulte."
      );
    }
  });
});
