import { drugSlug } from "./pair-url";
import { stripAccents } from "@/lib/search/normalize-query";

/**
 * Matching for the homepage interaction checker.
 *
 * The checker takes free text ("blood thinners like warfarin", "SSRI
 * antidepressants", or French terms like "fluoxétine", "aspirine",
 * "anticoagulants"), while the curated database stores one generic/class name
 * per pair ("Warfarin (Coumadin)", "Antidepressants (SSRIs)"). Matching is
 * deliberately conservative: an exact generic-name match (accent-folded) wins,
 * then a whole-token / curated French-alias match, then a containment match on
 * the slugified input. Anything else is "no record" — never a guess.
 */

const FRENCH_DRUG_ALIASES: Record<string, string[]> = {
  warfarine: ["warfarin"],
  aspirine: ["aspirin"],
  ibuprofene: ["ibuprofen", "nsaids"],
  paracetamol: ["acetaminophen"],
  acetaminophene: ["acetaminophen"],
  digoxine: ["digoxin"],
  metformine: ["metformin"],
  insuline: ["insulin"],
  ciclosporine: ["cyclosporine"],
  fluoxetine: ["fluoxetine"],
  levothyroxine: ["levothyroxine"],
  sertraline: ["sertraline"],
  citalopram: ["citalopram"],
  paroxetine: ["paroxetine"],
  atorvastatine: ["atorvastatin", "statins"],
  simvastatine: ["simvastatin", "statins"],
  statines: ["statins", "atorvastatin", "simvastatin"],
  statine: ["statins", "atorvastatin", "simvastatin"],
  anticoagulants: ["anticoagulants", "warfarin"],
  anticoagulant: ["anticoagulants", "warfarin"],
  antidepresseurs: ["antidepressants", "ssris", "ssri"],
  antidepresseur: ["antidepressants", "ssris", "ssri"],
  isrs: ["ssris", "antidepressants"],
  ains: ["nsaids", "ibuprofen", "aspirin"],
  "anti-inflammatoires": ["nsaids", "ibuprofen"],
  anticonvulsivants: ["anticonvulsants"],
  anticonvulsivant: ["anticonvulsants"],
  immunosuppresseurs: ["immunosuppressants", "cyclosporine", "tacrolimus"],
  immunosuppresseur: ["immunosuppressants", "cyclosporine", "tacrolimus"],
  diuretiques: ["diuretics", "furosemide", "hydrochlorothiazide"],
  diuretique: ["diuretics", "furosemide", "hydrochlorothiazide"],
  contraceptifs: ["oral-contraceptives", "contraceptives"],
  contraceptif: ["oral-contraceptives", "contraceptives"],
  antihypertenseurs: ["antihypertensives"],
  antihypertenseur: ["antihypertensives"],
  corticoides: ["corticosteroids"],
  corticosteroides: ["corticosteroids"],
  alcool: ["alcohol"],
  theophylline: ["theophylline"],
  methotrexate: ["methotrexate"],
  tamoxifene: ["tamoxifen"],
};

export interface CheckablePair {
  drugName: string;
  drugSlug: string;
}

/** Slugify a free-text medication input the same way pair URLs do, accent-safe. */
export function drugInputSlug(input: string): string {
  return drugSlug(stripAccents(input));
}

/** Whole-word tokens of a free-text input, accent-folded and slugified individually. */
function inputTokens(input: string): string[] {
  return stripAccents(input)
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

export function matchInteractionPair<T extends CheckablePair>(
  drugInput: string,
  pairs: T[]
): T | null {
  const slug = drugInputSlug(drugInput);
  if (!slug || pairs.length === 0) return null;

  const rawTokens = inputTokens(drugInput);
  const candidateTokens = new Set<string>();
  const singular = (s: string) =>
    s.length > 4 && s.endsWith("s") ? s.slice(0, -1) : s;

  for (const token of rawTokens) {
    candidateTokens.add(singular(token));
    for (const mapped of FRENCH_DRUG_ALIASES[token] ?? []) {
      candidateTokens.add(mapped);
      candidateTokens.add(singular(mapped));
    }
  }
  for (const mapped of FRENCH_DRUG_ALIASES[slug] ?? []) {
    candidateTokens.add(mapped);
    candidateTokens.add(singular(mapped));
  }

  // 1. Exact generic-name match: "warfarin" -> "Warfarin (Coumadin)".
  for (const pair of pairs) {
    if (pair.drugSlug === slug) return pair;
  }

  // 2. Whole-token / French alias match.
  for (const pair of pairs) {
    if (candidateTokens.has(singular(pair.drugSlug))) return pair;
    if (candidateTokens.has(pair.drugSlug)) return pair;
  }

  // 3. Containment in one direction only.
  for (const pair of pairs) {
    if (pair.drugSlug.length >= 4 && slug.includes(pair.drugSlug)) {
      return pair;
    }
    for (const token of candidateTokens) {
      if (pair.drugSlug.length >= 4 && token.includes(pair.drugSlug)) {
        return pair;
      }
    }
  }

  return null;
}
