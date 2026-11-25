import { drugSlug, EDITORIAL_PAIR_CANONICAL_DRUG } from "./pair-url";
import { stripAccents } from "@/lib/search/normalize-query";

/**
 * Matching for the homepage interaction checker.
 *
 * The checker takes free text ("blood thinners like warfarin", "SSRI
 * antidepressants", or French terms like "fluoxétine", "aspirine",
 * "anticoagulants"), while the curated database stores one generic/class name
 * per pair ("Warfarin (Coumadin)", "Antidepressants (SSRIs)"). Matching is
 * deliberately conservative: an exact generic-name match (accent-folded) wins,
 * then a whole-token match on the typed words, then one on curated
 * French/brand/class aliases, then a containment match on the slugified input.
 * Anything else is "no record" — never a guess. An alias can only surface a
 * row the herb already has; it never invents a pair.
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

/**
 * Brand names that are not part of the stored generic label.
 *
 * The database stores one generic name per pair, with a brand in parentheses
 * only when someone curated it there ("Warfarin (Coumadin)"). A reader who
 * types a brand that is missing from that label used to get "no record" for a
 * pair the site actually holds — a false negative on a safety tool. Keep this
 * list limited to brands whose generic name exists as a pair, so it resolves
 * to a real row rather than inventing a match.
 */
const DRUG_BRAND_ALIASES: Record<string, string[]> = {
  glucophage: ["metformin"],
  fortamet: ["metformin"],
  riomet: ["metformin"],
  ecotrin: ["aspirin"],
  bufferin: ["aspirin"],
  disprin: ["aspirin"],
  invirase: ["saquinavir"],
  fortovase: ["saquinavir"],
  jantoven: ["warfarin"],
  lanoxin: ["digoxin"],
  glucotrol: ["glipizide"],
  prograf: ["tacrolimus"],
  advagraf: ["tacrolimus"],
  neoral: ["cyclosporine"],
  sandimmune: ["cyclosporine"],
  gengraf: ["cyclosporine"],
  cipro: ["ciprofloxacin"],
  cozaar: ["losartan"],
  zocor: ["simvastatin"],
  lipitor: ["atorvastatin"],
  plavix: ["clopidogrel"],
};

/**
 * Drug classes a reader may type, mapped to the generic names the database
 * actually stores. A class never invents a pair: each name below only lets a
 * herb's existing rows be found. Where the database has a class row
 * ("Antidepressants (SSRIs)", "Immunosuppressants"), the reader's own words
 * match it first and these members are not consulted.
 *
 * St. John's Wort is the reason this exists: its four SSRI pairs are stored as
 * the individual drugs, so "SSRI antidepressants" — the homepage's own
 * suggested check — answered "no structured record found" while the site held
 * four contraindicated pairs for it.
 *
 * Keys are singular: the matcher also looks up the singular of each typed word
 * ("blood thinners" → "thinner", "statins" → "statin").
 */
const DRUG_CLASS_ALIASES: Record<string, string[]> = {
  ssri: [
    "antidepressants",
    "sertraline",
    "fluoxetine",
    "paroxetine",
    "citalopram",
    "trazodone",
  ],
  antidepressant: [
    "antidepressants",
    "sertraline",
    "fluoxetine",
    "paroxetine",
    "citalopram",
    "trazodone",
  ],
  maoi: ["phenelzine"],
  thinner: ["warfarin", "clopidogrel", "aspirin", "apixaban"],
  anticoagulant: ["warfarin", "apixaban", "anticoagulants"],
  antiplatelet: ["clopidogrel", "aspirin"],
  statin: ["simvastatin", "atorvastatin"],
  nsaid: ["ibuprofen", "aspirin"],
  diuretic: ["furosemide", "hydrochlorothiazide", "spironolactone"],
  benzodiazepine: ["alprazolam", "diazepam", "lorazepam"],
  painkiller: ["acetaminophen", "ibuprofen", "aspirin"],
  antibiotic: ["amoxicillin", "ciprofloxacin", "isoniazid"],
  ppi: ["omeprazole"],
  "proton-pump-inhibitor": ["omeprazole"],
  "proton-pump-inhibitors": ["omeprazole"],
  "beta-blocker": ["metoprolol"],
  "beta-blockers": ["metoprolol"],
  "calcium-channel-blocker": ["felodipine", "nifedipine"],
  "calcium-channel-blockers": ["felodipine", "nifedipine"],
  "birth-control": ["contraceptives", "oral-contraceptives"],
  "sleeping-pill": ["zolpidem", "diazepam", "alprazolam", "lorazepam"],
  "sleeping-pills": ["zolpidem", "diazepam", "alprazolam", "lorazepam"],
};

/** Aliases for one token, French/common first, then brand and class names. */
function aliasesFor(token: string): string[] {
  return [
    ...(FRENCH_DRUG_ALIASES[token] ?? []),
    ...(DRUG_BRAND_ALIASES[token] ?? []),
    ...(DRUG_CLASS_ALIASES[token] ?? []),
  ];
}

/** Drop a trailing plural "s" so "thinners" and "thinner" meet. */
function singular(token: string): string {
  return token.length > 4 && token.endsWith("s") ? token.slice(0, -1) : token;
}

export interface CheckablePair {
  herbSlug?: string;
  drugName: string;
  drugSlug: string;
  /** Present on real pairs; ranks matches when a class resolves to several. */
  severity?: string;
}

export type InteractionMatchResult<T extends CheckablePair> =
  | { kind: "none" }
  | { kind: "match"; pair: T }
  | { kind: "collision"; drugSlug: string; pairs: T[] };

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

const PAIR_STOP_WORDS = new Set([
  "medications",
  "medication",
  "drugs",
  "drug",
  "agents",
  "agent",
  "general",
  "oral",
  "absorption",
  "therapy",
  "products",
  "supplements",
  "inhibitors",
  "agonists",
  "blockers",
  "depressants",
  "metabolized",
  "cytochrome",
  "p450",
]);

/** Extract individual generic drug/class words from a pair's display name. */
function pairDrugTokens(drugName: string): string[] {
  return stripAccents(drugName)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !PAIR_STOP_WORDS.has(t));
}

const SEVERITY_RANK: Record<string, number> = {
  contraindicated: 4,
  severe: 3,
  moderate: 2,
  mild: 1,
};

/**
 * One answer from several possible rows. A reader who typed a class ("blood
 * thinners") must see the most serious pair the herb actually holds, not
 * whichever row the database happened to return first. Ties break on the
 * shorter display name, then alphabetically, so the answer is stable.
 */
function pickBest<T extends CheckablePair>(matches: T[]): T | null {
  if (matches.length === 0) return null;
  let best = matches[0];
  for (const candidate of matches.slice(1)) {
    const delta =
      (SEVERITY_RANK[candidate.severity ?? ""] ?? 0) -
      (SEVERITY_RANK[best.severity ?? ""] ?? 0);
    if (delta > 0) {
      best = candidate;
      continue;
    }
    if (delta < 0) continue;
    if (candidate.drugName.length < best.drugName.length) {
      best = candidate;
      continue;
    }
    if (
      candidate.drugName.length === best.drugName.length &&
      candidate.drugName.localeCompare(best.drugName) < 0
    ) {
      best = candidate;
    }
  }
  return best;
}

/**
 * Rows whose generic slug or whose individual words inside a multi-drug label
 * ("Antidiabetic medications (Metformin, Insulin)") match one of the tokens.
 */
function matchesByTokens<T extends CheckablePair>(
  pairs: T[],
  tokens: Set<string>
): T[] {
  const out: T[] = [];
  for (const pair of pairs) {
    if (tokens.has(pair.drugSlug) || tokens.has(singular(pair.drugSlug))) {
      out.push(pair);
      continue;
    }
    if (
      pairDrugTokens(pair.drugName).some(
        (token) => tokens.has(token) || tokens.has(singular(token))
      )
    ) {
      out.push(pair);
    }
  }
  return out;
}

function resolveSlugGroup<T extends CheckablePair>(
  slug: string,
  pairs: T[]
): InteractionMatchResult<T> {
  const sameSlug = pairs.filter((p) => p.drugSlug === slug);
  if (sameSlug.length === 0) return { kind: "none" };
  if (sameSlug.length === 1) return { kind: "match", pair: sameSlug[0] };

  const herbSlug = sameSlug[0].herbSlug;
  const editorialDrug = herbSlug
    ? EDITORIAL_PAIR_CANONICAL_DRUG[`${herbSlug}/${slug}`]
    : undefined;
  if (editorialDrug) {
    const chosen = sameSlug.find((p) => p.drugName === editorialDrug);
    if (chosen) return { kind: "match", pair: chosen };
  }

  return { kind: "collision", drugSlug: slug, pairs: sameSlug };
}

export function matchInteractionPairDetailed<T extends CheckablePair>(
  drugInput: string,
  pairs: T[]
): InteractionMatchResult<T> {
  const slug = drugInputSlug(drugInput);
  if (!slug || pairs.length === 0) return { kind: "none" };

  const rawTokens = inputTokens(drugInput);

  // 1. Exact generic-name match: "warfarin" -> "Warfarin (Coumadin)".
  //    If multiple rows share this slug without editorial disambiguation,
  //    return a structured collision with all matching rows.
  if (pairs.some((pair) => pair.drugSlug === slug)) {
    return resolveSlugGroup(slug, pairs);
  }

  // The reader's own words. These are tried before any alias so that a herb
  // holding both a class row and its member rows answers a class question
  // with the class row ("Antidepressants (SSRIs)", not one SSRI).
  const typed = new Set<string>([slug]);
  // Words an alias contributes: French, brand, or class member. A class alias
  // can only reach a row the herb already has.
  const expanded = new Set<string>();
  for (const token of rawTokens) {
    typed.add(token);
    typed.add(singular(token));
    for (const form of [token, singular(token)]) {
      for (const mapped of aliasesFor(form)) {
        expanded.add(mapped);
        expanded.add(singular(mapped));
      }
    }
  }
  for (const mapped of aliasesFor(slug)) {
    expanded.add(mapped);
    expanded.add(singular(mapped));
  }

  // 2. Whole-token match against the pair's drug slug or the individual
  //    drug/class words inside its label.
  const typedMatch = pickBest(matchesByTokens(pairs, typed));
  if (typedMatch) return resolveSlugGroup(typedMatch.drugSlug, pairs);
  const aliasMatch = pickBest(matchesByTokens(pairs, expanded));
  if (aliasMatch) return resolveSlugGroup(aliasMatch.drugSlug, pairs);

  // 3. Containment in one direction only.
  const anyToken = new Set([...typed, ...expanded]);
  const contained: T[] = [];
  for (const pair of pairs) {
    if (pair.drugSlug.length >= 4 && slug.includes(pair.drugSlug)) {
      contained.push(pair);
      continue;
    }
    for (const token of anyToken) {
      if (pair.drugSlug.length >= 4 && token.includes(pair.drugSlug)) {
        contained.push(pair);
        break;
      }
    }
  }
  const containedBest = pickBest(contained);
  return containedBest
    ? resolveSlugGroup(containedBest.drugSlug, pairs)
    : { kind: "none" };
}

export function matchInteractionPair<T extends CheckablePair>(
  drugInput: string,
  pairs: T[]
): T | null {
  const outcome = matchInteractionPairDetailed(drugInput, pairs);
  if (outcome.kind === "none") return null;
  if (outcome.kind === "collision") {
    throw new Error(
      `Ambiguous interaction collision for slug "${outcome.drugSlug}" (${outcome.pairs.length} rows); use matchInteractionPairDetailed`
    );
  }
  return outcome.pair;
}
