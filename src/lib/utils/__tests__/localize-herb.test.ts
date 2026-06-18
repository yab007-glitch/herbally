import { describe, it, expect } from "vitest";
import {
  localizeHerb,
  localizeInteraction,
  localizeCategoryName,
} from "../localize-herb";
import type { Herb, DrugInteraction, HerbCategory } from "@/lib/types";

const baseHerb = {
  id: "h1",
  name: "Ginger",
  slug: "ginger",
  scientific_name: "Zingiber officinale",
  description: "A warming digestive herb.",
  common_names: ["Ginger root"],
  traditional_uses: ["nausea", "digestion"],
  modern_uses: ["motion sickness"],
  dosage_adult: "1-2g daily",
  dosage_child: "Consult physician",
  preparation_notes: "Can be taken as tea.",
  contraindications: ["gallstones"],
  side_effects: ["heartburn"],
  evidence_level: "A",
  symptom_keywords: ["nausea"],
  category_id: "c1",
  is_published: true,
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
  pregnancy_safe: true,
  nursing_safe: true,
  image_url: null,
  view_count: 0,
  provenance: null,
  translations: {
    fr: {
      name: "Gingembre",
      description: "Une herbe digestive chauffante.",
      common_names: ["Racine de gingembre"],
      traditional_uses: ["nausées", "digestion"],
      modern_uses: ["mal des transports"],
      dosage_adult: "1-2g par jour",
      dosage_child: "Consulter un médecin",
      preparation_notes: "Peut être pris en thé.",
      contraindications: ["calculs biliaires"],
      side_effects: ["brûlures d'estomac"],
    },
  },
} as unknown as Herb;

describe("localizeHerb", () => {
  it("returns the original herb for English locale", () => {
    const result = localizeHerb(baseHerb, "en");
    expect(result.name).toBe("Ginger");
    expect(result.description).toBe("A warming digestive herb.");
  });

  it("overlays French translations when locale is fr", () => {
    const result = localizeHerb(baseHerb, "fr");
    expect(result.name).toBe("Gingembre");
    expect(result.description).toBe("Une herbe digestive chauffante.");
    expect(result.common_names).toEqual(["Racine de gingembre"]);
    expect(result.traditional_uses).toEqual(["nausées", "digestion"]);
    expect(result.modern_uses).toEqual(["mal des transports"]);
    expect(result.dosage_adult).toBe("1-2g par jour");
    expect(result.dosage_child).toBe("Consulter un médecin");
    expect(result.preparation_notes).toBe("Peut être pris en thé.");
    expect(result.contraindications).toEqual(["calculs biliaires"]);
    expect(result.side_effects).toEqual(["brûlures d'estomac"]);
  });

  it("falls back to English when French translation field is missing", () => {
    const herbWithoutFr = {
      ...baseHerb,
      translations: { fr: {} },
    } as unknown as Herb;
    const result = localizeHerb(herbWithoutFr, "fr");
    expect(result.name).toBe("Ginger");
    expect(result.description).toBe("A warming digestive herb.");
  });

  it("returns original herb when translations object is empty", () => {
    const herbNoTranslations = {
      ...baseHerb,
      translations: null,
    } as unknown as Herb;
    const result = localizeHerb(herbNoTranslations, "fr");
    expect(result.name).toBe("Ginger");
  });
});

describe("localizeInteraction", () => {
  const interaction = {
    id: "i1",
    herb_id: "h1",
    drug_name: "Warfarin",
    description: "May increase bleeding risk.",
    mechanism: "Unknown mechanism.",
    severity: "moderate",
    evidence_level: "B",
    rxcui: null,
    source: null,
    source_url: null,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    translations: {
      fr: {
        description: "Peut augmenter le risque de saignement.",
        mechanism: "Mécanisme inconnu.",
      },
    },
  } as unknown as DrugInteraction;

  it("returns original interaction for English", () => {
    const result = localizeInteraction(interaction, "en");
    expect(result.description).toBe("May increase bleeding risk.");
  });

  it("overlays French translation for interaction", () => {
    const result = localizeInteraction(interaction, "fr");
    expect(result.description).toBe("Peut augmenter le risque de saignement.");
    expect(result.mechanism).toBe("Mécanisme inconnu.");
  });

  it("falls back to English when French missing", () => {
    const ixNoFr = {
      ...interaction,
      translations: {},
    } as unknown as DrugInteraction;
    const result = localizeInteraction(ixNoFr, "fr");
    expect(result.description).toBe("May increase bleeding risk.");
  });
});

describe("localizeCategoryName", () => {
  const category = {
    id: "c1",
    name: "Roots",
    slug: "roots",
    name_fr: "Racines",
    description: null,
    description_fr: null,
    icon: null,
    sort_order: 1,
    created_at: "2024-01-01",
  } as unknown as HerbCategory & { name_fr?: string | null };

  it("returns French name when locale is fr", () => {
    expect(localizeCategoryName(category, "fr")).toBe("Racines");
  });

  it("returns English name when locale is en", () => {
    expect(localizeCategoryName(category, "en")).toBe("Roots");
  });

  it("falls back to English when French name is missing", () => {
    const catNoFr = { ...category, name_fr: null };
    expect(localizeCategoryName(catNoFr, "fr")).toBe("Roots");
  });
});
