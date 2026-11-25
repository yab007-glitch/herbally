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

const PEDIATRIC_KEYWORD_PATTERN =
  /\b(infant|infants|newborn|newborns|neonate|neonates|toddler|toddlers|child|children|kid|kids|minors|minor(?!\s+(?:side\s+effects?|adverse|gastrointestinal|gi|stomach|digestive|skin|oral|throat|mouth|urinary|muscular|articular|sprains?|bruises?|ulcers?|bleeding|headaches?|nausea|upset|irritation|inflammation|symptoms?|complaints?|reactions?|interactions?|discomfort)\b)|adolescent|adolescents|teen|teens|teenager|teenagers|pediatric|paediatric|under[\s-]+(?:age[\s-]+)?18|below[\s-]+(?:age[\s-]+)?18|less\s+than\s+18\s*(?:years?|yrs?)|bébé|bébés|bebe|bebes|enfant|enfants|nourrisson|nourrissons|nouveau-n[eé]s?|mineur|mineurs|ado|ados|adolescente?s?|p[eé]diatrique|moins\s+de\s+18(?:\s*ans?)?)\b/i;

const PEDIATRIC_AGE_PATTERN =
  /(?:\b(?:ages?|aged)\s*(?:under|below|up\s+to|<|<=|≤)\s*18\b|\bunder[\s-]+(?:age[\s-]+)?18\b|\bbelow[\s-]+(?:age[\s-]+)?18\b|\bless\s+than\s+18(?:\s*(?:years?|yrs?))?\b|\bmoins\s+de\s+18(?:\s*ans?)?\b|\b(?:up\s+to\s+(?:age\s+)?18|jusqu['’][aà]\s+18(?:\s*ans?)?)\b(?!\s*(?:mg|mcg|ug|g|kg|ml|l|drops?|gouttes?|capsules?|tablets?|cups?|tsp|tbsp|iu|days?|jours?|weeks?|wks?|semaines?|months?|mos?|mois|hours?|hrs?|heures?|min(?:utes?)?|%|times|fois)\b)|\b18(?:\s*(?:years?|yrs?))?\s+(?:and\s+under|or\s+(?:younger|under))\b|\b18\s*ans?\s+et\s+moins\b|(?:<=|≤)\s*18\b(?!\s*(?:mg|mcg|ug|g|kg|ml|l|drops?|gouttes?|capsules?|tablets?|cups?|tsp|tbsp|iu|days?|jours?|weeks?|wks?|semaines?|months?|mos?|mois|hours?|hrs?|heures?|min(?:utes?)?|%)\b)|<\s*18\s*(?:years?|yrs?|ans?)\b|\b(?:ages?|aged|de|entre)\s*(?:0|[1-9]|1[0-7])\s*(?:[-–—]|to|[aà]|et)\s*(?:[1-9]|1[0-8])\b|\b(?:0|[1-9]|1[0-7])\s*(?:[-–—]|to|[aà])\s*(?:[1-9]|1[0-8])\s*(?:years?|yrs?|ans?)\b|(?:^|[\s(,;])(?:0|[1-9]|1[0-7])\s*(?:[-–—]|to|[aà])\s*(?:[1-9]|1[0-8])\s*(?:\)|:|$)|\baged?\s*(?:under|<|<=|≤)?\s*(?:0|[1-9]|1[0-7])\b|\b(?:0|[1-9]|1[0-7])\s*-?\s*(?:years?|yrs?|ans?)\s*(?:-?\s*old|of age|:|\s*(?:and\s+(?:older|younger|under)|or\s+(?:older|younger)|et\s+plus|et\s+moins))|\b\d{1,2}\s*-?\s*(?:months?|mos?|mois)\s*(?:-?\s*old|of age|:)|^(?:0|[1-9]|1[0-7])\s*-?\s*(?:years?|yrs?|ans?)|\b\d{1,2}\s*-?\s*(?:months?|mos?|weeks?|wks?|mois|semaines?)\s*(?:-?\s*old|of age|:))/i;

const PEDIATRIC_DOSE_PATTERN = new RegExp(
  `(?:${PEDIATRIC_KEYWORD_PATTERN.source}|${PEDIATRIC_AGE_PATTERN.source})`,
  "i"
);

const EXPLICIT_ADULT_AGE_MARKER_PATTERN =
  /(?:\b18\+(?!\d)|\b18\s*(?:years?|yrs?)?\s*(?:and\s+(?:older|over|up)|or\s+older)\b|\b18\s*(?:years?|yrs?|ans?)\s*\+(?!\d)|\b18\s+ans\s+et\s+plus\b|\b(?:over|above)\s+(?:age\s+)?18\b|\b(?:plus\s+de|d[eè]s|[aà]\s+partir\s+de)\s+18(?:\s*ans?)?\b|(?:>=|≥)\s*18\b)/i;

const ADULT_DOSE_MARKER_PATTERN =
  /(?:\b(?:adult|adults|adulte|adultes)\b|\b18\+(?!\d)|\b18\s*(?:years?|yrs?)?\s*(?:and\s+(?:older|over|up)|or\s+older)\b|\b18\s*(?:years?|yrs?|ans?)\s*\+(?!\d)|\b18\s+ans\s+et\s+plus\b|\b(?:over|above)\s+(?:age\s+)?18\b|\b(?:plus\s+de|d[eè]s|[aà]\s+partir\s+de)\s+18(?:\s*ans?)?\b|(?:>=|≥)\s*18\b)/i;

const HAZARD_WARNING_PATTERN =
  /\b(poison|poisoning|overdose|fatal|lethal|death|die|emergency|hospital|call\s*911|poison\s+control|centre\s+antipoison|liver\s+failure|kidney\s+failure|toxicity|toxic|harm|hazard|swallow|swallowed|ingest|ingested|avale|aval[eé]|intoxication|mortel|urgence|never\s+(?:give|use|take|administer)|do\s+not\s+(?:give|use|take|administer)|should\s+not|shouldn't|must\s+not|mustn't|not\s+for\s+use|not\s+suitable|ne\s+pas\s+(?:donner|utiliser|prendre|administrer)|ne\s+jamais\s+(?:donner|utiliser|prendre|administrer)|ne\s+doiv(?:ent|e)\s+pas|ne\s+devrai(?:t|ent)\s+pas|ne\s+convien(?:t|nent)\s+pas|avoid\s+in|contraindicated|contre-indiqu[eé]e?s?|not\s+recommended|non\s+recommand[eé]e?s?|d[eé]conseill[eé]e?s?|interdit|keep\s+out\s+of\s+reach|hors\s+de\s+port[eé]e)\b/i;

const NUMERIC_DOSE_UNIT_PATTERN =
  /\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|ug|g|ml|drops?|gouttes?|capsules?|tablets?|cups?|tsp|tbsp|iu)\b/i;

const DOSING_TERM_PATTERN =
  /\b(?:dose|dosage|dosing|posologie|administer|take|give|donner|donnez|administrez|prenez|prendre)\b/i;

const AFFIRMATIVE_DOSE_VERB_PATTERN =
  /\b(?:give|administer|take|recommend|prescribe|suggested?|donnez|donner|administrez|prenez)\b/i;

const DOSE_NEGATION_PATTERN =
  /\b(?:never|do\s+not|don't|should\s+not|shouldn't|must\s+not|mustn't|not\s+for\s+use|not\s+suitable|avoid|contraindicated|contre-indiqu[eé]e?s?|not\s+recommended|non\s+recommand[eé]e?s?|ne\s+pas|ne\s+jamais|ne\s+doiv(?:ent|e)\s+pas|ne\s+devrai(?:t|ent)\s+pas|ne\s+convien(?:t|nent)\s+pas|d[eé]conseill[eé]e?s?|interdit)\b/i;

const FOR_IN_PED_DOSE_PATTERN =
  /\b(?:for|in|pour|chez)\s+(?:a|an|the|your|un|une|les?)?\s*(?:infant|infants|newborn|newborns|toddler|toddlers|child|children|kid|kids|minor|minors|adolescent|adolescents|teen|teens|teenager|teenagers|under[\s-]+(?:age[\s-]+)?18|below[\s-]+(?:age[\s-]+)?18|up\s+to\s+(?:age\s+)?18|18(?:\s*(?:years?|yrs?))?\s+(?:and\s+under|or\s+(?:younger|under))|moins\s+de\s+18(?:\s*ans?)?|jusqu['’][aà]\s+18(?:\s*ans?)?|18\s*ans?\s+et\s+moins|b[eé]b[eé]s?|enfant|enfants|nourrisson|adolescente?s?|(?:0|[1-9]|1[0-7])\s*(?:[-–—]|to|[aà])\s*(?:[1-9]|1[0-8])(?:\s*(?:years?|yrs?|ans?))?|\d+\s*-?\s*(?:years?|yrs?|ans?|months?|mos?|mois)\s*(?:old)?)\b/i;

const COLON_PED_DOSE_PATTERN =
  /(?:\b(?:children|child|enfant|enfants|adolescents?|infants?|toddlers?|under[\s-]+(?:age[\s-]+)?18|below[\s-]+(?:age[\s-]+)?18|up\s+to\s+(?:age\s+)?18|18(?:\s*(?:years?|yrs?))?\s+(?:and\s+under|or\s+(?:younger|under))|moins\s+de\s+18(?:\s*ans?)?|jusqu['’][aà]\s+18(?:\s*ans?)?|18\s*ans?\s+et\s+moins)\b|(?:<=|≤)\s*18\b|\b(?:ages?\s+)?(?:0|[1-9]|1[0-7])\s*(?:[-–—]|to|[aà])\s*(?:[1-9]|1[0-8])(?:\s*(?:years?|yrs?|ans?))?)[^:]{0,30}:\s*[^.!?;]*\d+/i;

const GARBAGE_DOSE_PATTERN =
  /\b(Quantity Unit TBA|Time Unit TBA|Sub Pop to be created|TBA)\b/i;

const HOMEOPATHIC_UNIT_PATTERN =
  /\b(globule|granule|pellet|tube|homeopath|hom[eé]opath|dilution)\b/i;

const ZERO_ONLY_DOSE_PATTERN = /^\s*0(?:\.0+)?\s+[a-zA-Z]/;

const ADULT_FIRST_CONJUNCT_RE =
  /\b(?:and|et|or|ou)\s+(?:adolescents?|adolescentes?|children|child|enfants?|teens?|teenagers?|minors?|mineurs?)(?:\s*\(\s*(?:(?:ages?|aged?|over|under|below|from|up\s+to|de|d['’]|entre|plus\s+de|moins\s+de|jusqu['’][aà]|<=|≤|<|>=|≥|>)\s*)?\d+(?:\s*(?:[-–—]|to|[aà]|et)\s*\d+)?(?:\s*\+)?(?:\s*(?:years?|yrs?|ans?)(?:\s*-?\s*old|\s+of\s+age)?)?(?:\s*\+)?(?:\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?\s*\)|\s+(?:ages?|aged?|over|under|below|from|up\s+to|de|d['’]|entre|plus\s+de|moins\s+de|jusqu['’][aà]|<=|≤|<|>=|≥|>)\s*\d+(?:\s*(?:[-–—]|to|[aà]|et)\s*\d+)?(?:\s*\+)?(?:\s*(?:years?|yrs?|ans?)(?:\s*-?\s*old|\s+of\s+age)?)?(?:\s*\+)?(?:\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?|\s+\d+(?:\s*(?:[-–—]|to|[aà]|et)\s*\d+(?:\s*(?:years?|yrs?|ans?))?(?:\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?|\s*\+(?:\s*(?:years?|yrs?|ans?))?|\s*(?:years?|yrs?|ans?)(?:\s*-?\s*old|\s+of\s+age)?(?:\s*\+|\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?|\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins)))?/gi;

const PED_FIRST_CONJUNCT_RE =
  /\b(?:adolescents?|adolescentes?|children|child|enfants?|teens?|teenagers?|minors?|mineurs?)(?:\s*\(\s*(?:(?:ages?|aged?|over|under|below|from|up\s+to|de|d['’]|entre|plus\s+de|moins\s+de|jusqu['’][aà]|<=|≤|<|>=|≥|>)\s*)?\d+(?:\s*(?:[-–—]|to|[aà]|et)\s*\d+)?(?:\s*\+)?(?:\s*(?:years?|yrs?|ans?)(?:\s*-?\s*old|\s+of\s+age)?)?(?:\s*\+)?(?:\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?\s*\)|\s+(?:ages?|aged?|over|under|below|from|up\s+to|de|d['’]|entre|plus\s+de|moins\s+de|jusqu['’][aà]|<=|≤|<|>=|≥|>)\s*\d+(?:\s*(?:[-–—]|to|[aà]|et)\s*\d+)?(?:\s*\+)?(?:\s*(?:years?|yrs?|ans?)(?:\s*-?\s*old|\s+of\s+age)?)?(?:\s*\+)?(?:\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?|\s+\d+(?:\s*(?:[-–—]|to|[aà]|et)\s*\d+(?:\s*(?:years?|yrs?|ans?))?(?:\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?|\s*\+(?:\s*(?:years?|yrs?|ans?))?|\s*(?:years?|yrs?|ans?)(?:\s*-?\s*old|\s+of\s+age)?(?:\s*\+|\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins))?|\s*(?:and\s+(?:older|over|up|under)|or\s+(?:older|younger|under)|et\s+plus|et\s+moins)))?\s+(?:and|et)\s+(les\s+)?(adults?|adultes?)/gi;

function stripAdultPediatricConjuncts(text: string): string {
  return text
    .replace(ADULT_FIRST_CONJUNCT_RE, "")
    .replace(PED_FIRST_CONJUNCT_RE, "$1$2")
    .replace(/\b(les)\s+\1\b/gi, "$1")
    .replace(/\s+([:;,.?)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function isPediatricOnlyOrTaggedDose(d: {
  text?: string | null;
  population?: string | null;
  age_minimum?: number | null;
}): boolean {
  const pop = d.population ?? "";
  const txt = d.text ?? "";
  const isAdultInclusive =
    ADULT_DOSE_MARKER_PATTERN.test(pop) ||
    ADULT_DOSE_MARKER_PATTERN.test(txt) ||
    (typeof d.age_minimum === "number" &&
      Number.isFinite(d.age_minimum) &&
      d.age_minimum >= 18);

  if (isAdultInclusive) {
    if (pop.trim()) {
      const cleanedPop = stripAdultPediatricConjuncts(pop);
      if (
        cleanedPop &&
        PEDIATRIC_AGE_PATTERN.test(cleanedPop) &&
        !EXPLICIT_ADULT_AGE_MARKER_PATTERN.test(cleanedPop)
      ) {
        return true;
      }
    }
    if (HAZARD_WARNING_PATTERN.test(txt)) {
      return false;
    }
    const cleaned = stripPediatricDosageSentences(txt);
    if (!cleaned) {
      return true;
    }
    return false;
  }

  if (PEDIATRIC_DOSE_PATTERN.test(pop) || PEDIATRIC_DOSE_PATTERN.test(txt)) {
    return true;
  }
  if (
    typeof d.age_minimum === "number" &&
    Number.isFinite(d.age_minimum) &&
    d.age_minimum >= 0 &&
    d.age_minimum < 18
  ) {
    return true;
  }
  return false;
}

/**
 * Strip pediatric-only population/sentence fragments from an adult-inclusive
 * dose entry so adults retain safe reference dosing without child instructions.
 */
export function sanitizeAdultInclusiveDose<
  T extends {
    text: string;
    population?: string | null;
    age_minimum?: number | null;
  },
>(d: T): T | null {
  if (isPediatricOnlyOrTaggedDose(d)) {
    return null;
  }
  const cleanedText = stripPediatricDosageSentences(d.text);
  if (!cleanedText) {
    return null;
  }
  const rawPop = d.population?.trim() ?? "";
  let cleanedPop: string | null = rawPop || null;
  if (
    cleanedPop &&
    ADULT_DOSE_MARKER_PATTERN.test(cleanedPop) &&
    PEDIATRIC_DOSE_PATTERN.test(cleanedPop)
  ) {
    cleanedPop = "Adults";
  }
  return {
    ...d,
    text: cleanedText,
    population: cleanedPop,
    age_minimum:
      typeof d.age_minimum === "number" && d.age_minimum < 18
        ? 18
        : d.age_minimum,
  };
}

export function filterAdultDoses<
  T extends {
    text?: string | null;
    population?: string | null;
    age_minimum?: number | null;
  },
>(doses: T[] | null | undefined, isHomeopathic = false): T[] {
  const out: T[] = [];
  for (const d of doses ?? []) {
    if (isGarbageOrHomeopathicDose(d, isHomeopathic)) continue;
    const sanitized = sanitizeAdultInclusiveDose({
      ...d,
      text: d.text ?? "",
    });
    if (sanitized) {
      out.push(sanitized as T);
    }
  }
  return out;
}

/**
 * Remove sentences/clauses referencing pediatric herbal dosing from free-text
 * dosage summaries while preserving adult guidance (including adult-inclusive
 * clauses like "Adults and adolescents over 12 years: ...") and genuine
 * hazard/poison-control warnings without affirmative pediatric dosing.
 */
export function stripPediatricDosageSentences(
  text: string | null | undefined
): string {
  if (!text) return "";
  const sentences = text
    .trim()
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const keptSentences: string[] = [];
  for (const sentence of sentences) {
    const terminalMatch = sentence.match(/([.!?])$/);
    const terminalPunct = terminalMatch ? terminalMatch[1] : "";
    const clauses = sentence
      .split(/\s*;\s*/)
      .map((c) => c.trim())
      .filter(Boolean);

    let sentenceHasPedContext = false;
    const keptClauses: string[] = [];

    for (const part of clauses) {
      const hasPed = PEDIATRIC_DOSE_PATTERN.test(part);
      const hasAdult = ADULT_DOSE_MARKER_PATTERN.test(part);
      const hasNumericDose = NUMERIC_DOSE_UNIT_PATTERN.test(part);
      const hasDose = hasNumericDose || DOSING_TERM_PATTERN.test(part);

      if (hasPed && !hasAdult) {
        sentenceHasPedContext = true;
      } else if (hasAdult && !hasPed) {
        sentenceHasPedContext = false;
      }

      const effectiveHasPed = hasPed || sentenceHasPedContext;
      const hasAffirmativePrescriptivePedDose =
        effectiveHasPed &&
        !hasAdult &&
        hasNumericDose &&
        !DOSE_NEGATION_PATTERN.test(part) &&
        (AFFIRMATIVE_DOSE_VERB_PATTERN.test(part) ||
          FOR_IN_PED_DOSE_PATTERN.test(part) ||
          COLON_PED_DOSE_PATTERN.test(part) ||
          (sentenceHasPedContext && !HAZARD_WARNING_PATTERN.test(part)));

      if (hasAffirmativePrescriptivePedDose) {
        continue;
      }

      if (HAZARD_WARNING_PATTERN.test(part)) {
        keptClauses.push(part);
        continue;
      }

      if (!effectiveHasPed) {
        keptClauses.push(part);
        continue;
      }

      if (hasAdult) {
        const cleaned = stripAdultPediatricConjuncts(part);
        if (
          cleaned &&
          (!PEDIATRIC_AGE_PATTERN.test(cleaned) ||
            EXPLICIT_ADULT_AGE_MARKER_PATTERN.test(cleaned))
        ) {
          keptClauses.push(cleaned);
        }
      } else if (!hasDose) {
        keptClauses.push(part);
      }
    }

    if (keptClauses.length > 0) {
      let joined = keptClauses.join("; ").replace(/;\s*$/, "").trim();
      if (terminalPunct && !/[.!?]$/.test(joined)) {
        joined += terminalPunct;
      }
      if (joined) {
        keptSentences.push(joined);
      }
    }
  }

  return keptSentences.join(" ").replace(/;\s*$/, ".").trim();
}

export function hasNumericDoseUnit(text: string | null | undefined): boolean {
  if (!text) return false;
  return NUMERIC_DOSE_UNIT_PATTERN.test(text);
}

export function faqQuestionHasNumericPediatricDose(
  question: string | null | undefined
): boolean {
  if (!question) return false;
  const trimmed = question.trim();
  if (!trimmed || !NUMERIC_DOSE_UNIT_PATTERN.test(trimmed)) return false;
  const stripped = stripPediatricDosageSentences(trimmed);
  return stripped !== trimmed;
}

export function sanitizeFaqQuestionText(
  question: string | null | undefined
): string {
  if (!question) return "";
  const trimmed = question.trim();
  if (!trimmed) return "";
  const stripped = stripPediatricDosageSentences(trimmed);
  if (!NUMERIC_DOSE_UNIT_PATTERN.test(trimmed)) {
    return stripped || trimmed;
  }
  return stripped;
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
    r.includes("green tea extract")
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
  const adultDoses = filterAdultDoses(evidence.doses, isHomeopathic).slice(
    0,
    6
  );
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
