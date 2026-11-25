export interface LnhpdLicenceRow {
  lnhpd_id: number;
  licence_number?: string;
  licence_date?: string | null;
  revised_date?: string | null;
  product_name?: string;
  dosage_form?: string;
  company_name?: string;
  sub_submission_type_desc?: string;
  flag_product_status?: number;
}

export interface LnhpdIngredientRow {
  ingredient_name?: string;
  quantity?: number | null;
  quantity_minimum?: number | null;
  quantity_maximum?: number | null;
  quantity_unit_of_measure?: string | null;
  potency_amount?: number | null;
  potency_constituent?: string | null;
  potency_unit_of_measure?: string | null;
  ratio_numerator?: string | number | null;
  ratio_denominator?: string | number | null;
  dried_herb_equivalent?: string | number | null;
  dhe_unit_of_measure?: string | null;
  extract_type_desc?: string | null;
  source_material?: string | null;
}

export interface LnhpdRiskRow {
  risk_type_desc?: string;
  sub_risk_type_desc?: string;
  risk_text?: string;
}

export interface LnhpdPurposeRow {
  purpose?: string;
}

export interface LnhpdDoseRow {
  population_type_desc?: string;
  quantity_dose?: number | null;
  quantity_dose_minimum?: number | null;
  quantity_dose_maximum?: number | null;
  uom_type_desc_quantity_dose?: string | null;
  frequency?: number | null;
  frequency_minimum?: number | null;
  frequency_maximum?: number | null;
  uom_type_desc_frequency?: string | null;
}

/**
 * Normalize a free-text NPN or DIN-HM entry ("NPN 8000-0001") into 8 digits,
 * or return null when invalid.
 */
export function normalizeNpnInput(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .replace(/^(npn|din-?hm)\s*:?\s*/i, "")
    .replace(/[\s-]+/g, "");
  return /^\d{8}$/.test(cleaned) ? cleaned : null;
}

/**
 * Parse a Health Canada LNHPD API response into a typed row array, clearly
 * distinguishing valid empty arrays (`[]`, `{ data: [] }`) from unrecognized
 * payload shapes (`{}`, error objects, HTML/text, null).
 */
export function parseLnhpdArray<T>(
  payload: unknown
): { ok: true; rows: T[] } | { ok: false } {
  if (Array.isArray(payload)) return { ok: true, rows: payload as T[] };
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return { ok: true, rows: (payload as { data: T[] }).data };
  }
  return { ok: false };
}

/**
 * Unwrap Health Canada LNHPD API responses that arrive either as bare arrays
 * (`productlicence`, `productdose`) or inside `{ metadata, data: [...] }`.
 */
export function extractLnhpdArray<T>(payload: unknown): T[] {
  const parsed = parseLnhpdArray<T>(payload);
  return parsed.ok ? parsed.rows : [];
}

/**
 * Map numeric LNHPD `flag_product_status` codes into reader labels.
 */
export function formatLnhpdStatus(
  code: number | undefined,
  locale: "en" | "fr"
): { active: boolean; label: string } {
  if (code === 1) {
    return {
      active: true,
      label: locale === "fr" ? "Homologué (actif)" : "Active licence",
    };
  }
  if (code === 0) {
    return {
      active: false,
      label:
        locale === "fr" ? "Discontinué / inactif" : "Discontinued / inactive",
    };
  }
  return {
    active: false,
    label: locale === "fr" ? "Autre statut" : "Other / historical status",
  };
}

/**
 * Strip taxonomic authority suffixes, cultivar/subspecies tails, and
 * parentheticals from an LNHPD medicinal ingredient string so botanical names
 * such as "Linum usitatissimum L. subsp. sativa" match HerbAlly entries cleanly.
 */
export function cleanBotanicalIngredientName(raw: string): string {
  if (!raw) return "";
  let s = raw
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+(subsp\.|ssp\.|var\.|f\.|forma)\s+.*/i, "")
    .replace(
      /\s+(L\.|DC\.|Mill\.|Spreng\.|Willd\.|Roxb\.|Nutt\.|Lam\.|Benth\.)(\s|$)/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

  // If formatted like "Genus species Author", keep the binomial Genus species
  const words = s.split(" ");
  if (
    words.length >= 3 &&
    /^[A-Z][a-z-]+$/.test(words[0]) &&
    /^[a-z-]+$/.test(words[1])
  ) {
    s = `${words[0]} ${words[1]}`;
  }
  return s;
}
