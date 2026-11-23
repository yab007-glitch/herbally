import { cleanQuotedText } from "@/lib/herbs/clean-quote";

/**
 * Pure data helpers and types for Health Canada LNHPD regulatory evidence.
 * Kept separate from the `"use client"` view component so Server Components
 * can compact evidence before passing it across the RSC boundary.
 */
export type RegulatoryEvidence = {
  herb_slug: string;
  source: string;
  source_licence: string;
  purposes: string[];
  doses: {
    text: string;
    population?: string | null;
    age_minimum?: number | null;
  }[];
  risks: string[];
  products_sampled: number;
  source_urls: string[];
  retrieved_at: string;
};

const PEDIATRIC_DOSE_PATTERN =
  /\b(infant|infants|child|children|adolescent|adolescents|pediatric|paediatric|bébé|bébés|enfant|enfants|nourrisson|nourrissons)\b/i;

const GARBAGE_DOSE_PATTERN =
  /\b(Quantity Unit TBA|Time Unit TBA|Sub Pop to be created|TBA)\b/i;

const HOMEOPATHIC_UNIT_PATTERN =
  /\b(globule|granule|pellet|tube|homeopath|hom[eé]opath|dilution)\b/i;

const ZERO_ONLY_DOSE_PATTERN = /^\s*0(?:\.0+)?\s+[a-zA-Z]/;

export function isPediatricOnlyOrTaggedDose(d: {
  text?: string | null;
  population?: string | null;
  age_minimum?: number | null;
}): boolean {
  const pop = d.population ?? "";
  const txt = d.text ?? "";
  if (PEDIATRIC_DOSE_PATTERN.test(pop) || PEDIATRIC_DOSE_PATTERN.test(txt)) {
    return true;
  }
  if (
    typeof d.age_minimum === "number" &&
    d.age_minimum > 0 &&
    d.age_minimum < 18
  ) {
    return true;
  }
  return false;
}

export function isGarbageOrHomeopathicDose(
  d: { text?: string | null; population?: string | null },
  isHomeopathic: boolean
): boolean {
  const txt = (d.text ?? "").trim();
  const pop = (d.population ?? "").trim();
  if (!txt) return true;
  if (GARBAGE_DOSE_PATTERN.test(txt) || GARBAGE_DOSE_PATTERN.test(pop)) {
    return true;
  }
  if (ZERO_ONLY_DOSE_PATTERN.test(txt)) {
    return true;
  }
  if (isHomeopathic && HOMEOPATHIC_UNIT_PATTERN.test(txt)) {
    return true;
  }
  return false;
}

export function formatDoseText(raw: string, locale: "en" | "fr"): string {
  const cleaned = cleanQuotedText(raw);
  return cleaned.replace(
    /^0(?:\.0+)?\s*[-–]\s*(\d+(?:\.\d+)?)\s+/i,
    locale === "fr" ? "jusqu'à $1 " : "up to $1 "
  );
}

export function isCrossContaminatedRisk(slug: string, risk: string): boolean {
  const r = risk.toLowerCase();
  if (
    !/green-tea|camellia-sinensis|thea-sinensis/i.test(slug) &&
    (r.includes("green tea extract") ||
      (r.includes("liver injury") &&
        r.includes("dark urine") &&
        r.includes("jaundice") &&
        !/black-cohosh|kava|chaparral|gobernadora|fo-ti|chelidonium|germander|comfrey|senecio/i.test(
          slug
        )))
  ) {
    return true;
  }
  if (
    !/psyllium|plantago/i.test(slug) &&
    (r.includes("psyllium") ||
      r.includes("choking if swallowed without sufficient water"))
  ) {
    return true;
  }
  if (
    !/bee|propolis|royal-jelly|apitherapy/i.test(slug) &&
    /\b(bee venom|propolis|royal jelly|allergic to bees|vaccine)\b/i.test(r)
  ) {
    return true;
  }
  if (
    !/nicotin|tobacco|lobelia/i.test(slug) &&
    /\b(nicotine replacement|stop smoking|quit smoking)\b/i.test(r)
  ) {
    return true;
  }
  if (r.includes("enough drug in this package to seriously harm a child")) {
    return true;
  }
  return false;
}

export function isHomeopathicEvidence(evidence: {
  purposes?: string[];
  doses?: Array<{ text?: string | null; population?: string | null }>;
}): boolean {
  return /\b(homeopath|hom[eé]opath|globule|granule|pellet|organotherapy|dilution)\b/i.test(
    JSON.stringify({ p: evidence.purposes, d: evidence.doses })
  );
}

export function compactRegulatoryEvidence(evidence: RegulatoryEvidence): {
  evidence: RegulatoryEvidence;
  isHomeopathic: boolean;
} {
  const isHomeopathic = isHomeopathicEvidence(evidence);
  const adultDoses = (evidence.doses ?? [])
    .filter(
      (d) =>
        !isPediatricOnlyOrTaggedDose(d) &&
        !isGarbageOrHomeopathicDose(d, isHomeopathic)
    )
    .slice(0, 6);
  const filteredRisks = (evidence.risks ?? [])
    .filter((r) => !isCrossContaminatedRisk(evidence.herb_slug, r))
    .slice(0, 5);
  return {
    isHomeopathic,
    evidence: {
      herb_slug: evidence.herb_slug,
      source: evidence.source,
      source_licence: "",
      purposes: (evidence.purposes ?? []).slice(0, 6),
      doses: adultDoses,
      risks: filteredRisks,
      products_sampled: evidence.products_sampled,
      source_urls: [],
      retrieved_at: evidence.retrieved_at,
    },
  };
}
