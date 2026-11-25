import { z } from "zod";
import { matchDangerousHerbInput } from "@/lib/data/dangerous-herbs";

export const SafetyVerdictSchema = z.object({
  verdict: z.enum(["ok", "warn", "block"]),
  reasons: z.array(z.string()),
  appended: z.string().optional(),
});

export type SafetyVerdict = z.infer<typeof SafetyVerdictSchema>;

// ---------------------------------------------------------------------------
// Hard blocks — phrases that MUST result in a complete refusal.
// Organized by category with adversarial variants.
// ---------------------------------------------------------------------------

// Common drug/medication terms used across hard-block patterns
const DRUG_TERMS =
  "medication|medications|insulin|prescription|prescriptions|pills|tablets|drugs|blood.?thinners?|statins?|beta.?blockers?|ace.?inhibitors?|antidepressants?|antipsychotics?|anticonvulsants?|corticosteroids?|immunosuppressants?|chemotherapy|warfarin|treatment|treatments";

/** Medication cessation / replacement */
const HARD_BLOCKS_EN: RegExp[] = [
  // Direct cessation
  new RegExp(`\\bstop taking (?:your |the )?(?:${DRUG_TERMS})\\b`, "i"),
  new RegExp(
    `\\b(?:cease|discontinue|quit|drop|abandon|halt|suspend) (?:your |the )?(?:${DRUG_TERMS})\\b`,
    "i"
  ),
  new RegExp(
    `\\byou (?:should|must|need to|can) (?:stop|cease|drop|quit) (?:taking )?(?:your |the )?(?:${DRUG_TERMS})\\b`,
    "i"
  ),
  new RegExp(`\\b(?:stop|cease) (?:all|any) (?:${DRUG_TERMS})\\b`, "i"),

  // Replacement language
  /\breplace (?:your |the )?(?:insulin|chemotherapy|prescription|blood.?thinner|medication|treatment) with\b/i,
  /\b(?:use|take|try) (?:this|these|it|herbs?|this herb) instead of (?:your |the )?(?:medication|prescription|insulin|treatment)\b/i,
  /\binstead of (?:your |the )?(?:medication|prescription|insulin|drugs)\b/i,
  /\byou (?:don'?t|do not) need (?:your |the )?(?:medication|medications|prescription|insulin|treatment)\b/i,
  /\byou (?:can|should|may) (?:quit|stop|drop|abandon) (?:your |the )?(?:medication|insulin|prescription|treatment)(?: entirely| completely| altogether)?\b/i,

  // Cure claims
  /\b(?:this|it|the herb) (?:will|can|could|may) cure (?:your |the )?(?:cancer|diabetes|HIV|AIDS|hepatitis|Alzheimer|Parkinson)\b/i,
  /\b(?:cures?|heals?|treats?|reverses?) (?:your |the )?cancer\b/i,
  /\bguaranteed (?:to |will |can )?(?:cure|heal|fix|resolve|eliminate|eradicate)\b/i,

  // Doctor dismissal
  /\b(?:ignore|disregard|dismiss) (?:your |the )?(?:doctor|physician|specialist|oncologist|cardiologist|endocrinologist)\b/i,
  /\bdon'?t (?:listen to|trust|believe) (?:your |the )?(?:doctor|physician)\b/i,
  /\byou don'?t need (?:a |to see a |to visit a )?(?:doctor|physician|specialist)\b/i,
  /\b(?:doctors?|physicians?) (?:are |don'?t )?(?:wrong|lying|misleading|clueless|incompetent)\b/i,

  // Unsafe dosing
  /\b(?:double|triple|quadruple) (?:the|your) (?:dose|dosage)\b/i,
  /\btake (?:more|extra|excessive) (?:of )?(?:the|your|this) (?:medication|herb|supplement)\b/i,
  // Only an INSTRUCTION to take an overdose is blocked. The bare word
  // "overdose" is not: the correct, safest answer to "what if I overdose on
  // X?" is "call poison control / emergency services", and blocking any reply
  // that says "overdose" replaced that answer with a refusal (found in the
  // live QA pass). These patterns match the advice forms only.
  /\b(?:take|try|do|give (?:yourself )?)(?: a| an)? (?:mega.?dose|heroic dose|overdose)\b/i,
  /\b(?:you (?:should|can|may|must|could)) (?:take )?(?:a |an )?(?:mega.?dose|heroic dose|overdose)\b/i,
  /\bmegadose (?:yourself|it)\b/i,
  // Claims that make an overdose sound safe are still blocked.
  /\b(?:you )?(?:can(?:'?t| ?not)|won'?t|will not) overdose\b/i,
  /\boverdos(?:e|ing) (?:is|would be) (?:safe|harmless|fine|okay|ok)\b/i,
  /\btake as much as you (?:want|like|can)\b/i,

  // Emergency misdirection
  /\bdon'?t (?:go to|call|visit) (?:the |an? )?(?:emergency room|ER|hospital|ambulance)\b/i,
  /\byou (?:don'?t|do not) need (?:emergency|urgent) (?:care|treatment|help)\b/i,
  /\b(?:don'?t|do not|never) call (?:911|999|112|emergency|poison control)\b/i,
];

const PEDIATRIC_HARD_BLOCKS_EN: RegExp[] = [
  // Pediatric numeric dosing instructions or scaling formulas
  /\b(?:give|administer|take|use|try|recommend|prescribe|suggested?)\b[^.!?\n]*\b(?:child|children|kid|kids|infant|newborn|toddler|baby|minor|adolescent|teen|teenager|pediatric|paediatric|under[\s-]+(?:age[\s-]+)?18|below[\s-]+(?:age[\s-]+)?18|up\s+to\s+(?:age\s+)?18\b(?!\s*(?:mg|mcg|ug|g|kg|ml|l|drops?|capsules?|tablets?|cups?|tsp|tbsp|iu|days?|weeks?|wks?|months?|mos?|hours?|hrs?|min(?:utes?)?|%|times))|18(?:\s*(?:years?|yrs?))?\s+(?:and\s+under|or\s+(?:younger|under))|(?:<=|≤)\s*18\b(?!\s*(?:mg|mcg|ug|g|kg|ml|l|drops?|capsules?|tablets?|cups?|tsp|tbsp|iu|days?|weeks?|wks?|months?|mos?|hours?|hrs?|min(?:utes?)?|%))|(?:ages?\s+)?(?:0|[1-9]|1[0-7])\s*(?:[-–—]|to)\s*(?:[1-9]|1[0-8])(?:\s*(?:years?|yrs?))?|\d+\s*-?\s*(?:year|yr|month|mo)s?\s*-?\s*old)\b[^.!?\n]*\b\d+(?:\.\d+)?\s*(?:mg|mcg|ug|g|ml|drops?|capsules?|tablets?|cups?|tsp|tbsp|iu)\b/i,
  /\b(?:for|in)\s+(?:a|an|your|the)?\s*(?:child|children|kid|kids|infant|newborn|toddler|baby|minor|adolescent|teen|teenager|under[\s-]+(?:age[\s-]+)?18|below[\s-]+(?:age[\s-]+)?18|up\s+to\s+(?:age\s+)?18\b(?!\s*(?:mg|mcg|ug|g|kg|ml|l|drops?|capsules?|tablets?|cups?|tsp|tbsp|iu|days?|weeks?|wks?|months?|mos?|hours?|hrs?|min(?:utes?)?|%|times))|18(?:\s*(?:years?|yrs?))?\s+(?:and\s+under|or\s+(?:younger|under))|(?:<=|≤)\s*18\b(?!\s*(?:mg|mcg|ug|g|kg|ml|l|drops?|capsules?|tablets?|cups?|tsp|tbsp|iu|days?|weeks?|wks?|months?|mos?|hours?|hrs?|min(?:utes?)?|%))|(?:ages?\s+)?(?:0|[1-9]|1[0-7])\s*(?:[-–—]|to)\s*(?:[1-9]|1[0-8])(?:\s*(?:years?|yrs?))?|\d+\s*-?\s*(?:year|yr|month|mo)s?\s*-?\s*old)\b[^.!?\n]*\b\d+(?:\.\d+)?\s*(?:mg|mcg|ug|g|ml|drops?|capsules?|tablets?|cups?|tsp|tbsp|iu)\b/i,
  /(?:\b(?:children|child|infant|infants|toddler|toddlers|adolescents?|under[\s-]+(?:age[\s-]+)?18|below[\s-]+(?:age[\s-]+)?18|up\s+to\s+(?:age\s+)?18|18(?:\s*(?:years?|yrs?))?\s+(?:and\s+under|or\s+(?:younger|under)))\b|(?:<=|≤)\s*18\b|\b(?:ages?\s+)?(?:0|[1-9]|1[0-7])\s*(?:[-–—]|to)\s*(?:[1-9]|1[0-8])(?:\s*(?:years?|yrs?))?)[^:\n]{0,30}:\s*[^.!?\n]*\b\d+(?:\.\d+)?\s*(?:mg|mcg|ug|g|ml|drops?|capsules?|tablets?|cups?|tsp|tbsp|iu)\b/i,
  /\b(?:clark'?s rule|young'?s rule|fried'?s rule)\b[^.!?\n]*\b\d+(?:\.\d+)?\s*(?:mg|mcg|ug|g|ml|drops?)\b/i,
];

const HARD_BLOCKS_FR: RegExp[] = [
  // Direct cessation
  /\barrêt(?:ez|er|é|ée) (?:de prendre |de |d')?(?:vos |les |votre |le |la )?(?:médicaments?|traitements?|insuline|prescriptions?|pilules?|comprimés?)\b/i,
  /\bcess(?:ez|er) (?:de prendre |de )?(?:vos |votre )?(?:médicaments?|traitements?|insuline)\b/i,
  /\bvous (?:devriez|devez|pouvez) arrêt(?:ez|er) (?:de prendre )?(?:vos |votre )?(?:médicaments?|traitements?)\b/i,

  // Replacement
  /\bremplac(?:ez|er) (?:vos |votre )?(?:insuline|chimiothérapie|traitement|médicament) (?:par|avec)\b/i,
  /\b(?:prenez|utilisez|essayez) (?:ceci|cela|ce remède|cette plante) (?:à la place|au lieu) de\b/i,
  /\b(?:au lieu|à la place) de (?:vos |votre )?(?:médicaments?|traitements?|ordonnance)\b/i,

  // Cure claims
  /\b(?:ça|cela|ceci) (?:va|peut) (?:guérir|soigner) (?:votre |le |la )?cancer\b/i,
  /\b(?:guérit|soigne|traite) (?:votre |le )?cancer\b/i,
  /\bgaranti (?:de |pour |d')?(?:guérir|soigner|éliminer)\b/i,

  // Doctor dismissal
  /\bignorez (?:votre |vos |le |la |les )?(?:médecin|docteur|spécialiste|oncologue)\b/i,
  /\bne (?:croyez|faites pas confiance|écoutez pas) (?:votre |au |aux )?(?:médecin|docteur)\b/i,
  /\bvous n'avez pas besoin (?:d'un |de |de voir un )?(?:médecin|docteur)\b/i,

  // Unsafe dosing
  /\b(doublez|triplez|quadruplez) (?:la|votre|le) dose\b/i,
  /\bprenez (?:plus|davantage|plus que|autant que vous voulez)\b/i,
  // Same split as EN: advice to take an overdose is blocked, the word
  // "surdose" on its own is not — the correct answer to "et si je fais une
  // surdose ?" is to call emergency services.
  /\b(?:prenez|faites|essayez|avalez) (?:une |la )?(?:sur)?dose\b/i,
  /\bvous (?:pouvez|devriez|devez) (?:prendre )?(?:une )?(?:sur)?dose\b/i,
  /\b(?:on ne peut pas|impossible de|c'?est impossible de) (?:faire )?(?:une )?(?:sur)?dose\b/i,
  /\b(?:surdosage|surdose) (?:est|serait) (?:sans danger|inoffensif|sans risque)\b/i,
];

const PEDIATRIC_HARD_BLOCKS_FR: RegExp[] = [
  // Pediatric numeric dosing instructions (FR)
  /\b(?:donnez|administrez|prenez|recommande[zr]?|pour)\b[^.!?\n]*\b(?:enfant|enfants|b[eé]b[eé]s?|nourrisson|nouveau-n[eé]|adolescent|ado|mineur|moins\s+de\s+18(?:\s*ans?)?|jusqu['’][aà]\s+18(?:\s*ans?)?(?!\s*(?:mg|mcg|ug|g|kg|ml|l|gouttes?|g[eé]lules?|comprim[eé]s?|tasses?|jours?|semaines?|mois|heures?|%))|18\s*ans?\s+et\s+moins|(?:<=|≤)\s*18\b(?!\s*(?:mg|mcg|ug|g|kg|ml|l|gouttes?|g[eé]lules?|comprim[eé]s?|tasses?|jours?|semaines?|mois|heures?|%))|(?:0|[1-9]|1[0-7])\s*(?:[-–—]|[aà])\s*(?:[1-9]|1[0-8])\s*ans?|\d+\s*(?:an|ans|mois))\b[^.!?\n]*\b\d+(?:\.\d+)?\s*(?:mg|mcg|ug|g|ml|gouttes?|g[eé]lules?|comprim[eé]s?|tasses?)\b/i,
  /\b(?:donnez|administrez)\b[^.!?\n]*\b\d+(?:\.\d+)?\s*(?:mg|mcg|ug|g|ml|gouttes?)\b[^.!?\n]*\b(?:enfant|enfants|b[eé]b[eé]s?|nourrisson|adolescent|ado|moins\s+de\s+18(?:\s*ans?)?|jusqu['’][aà]\s+18(?:\s*ans?)?|18\s*ans?\s+et\s+moins|(?:<=|≤)\s*18\b|(?:0|[1-9]|1[0-7])\s*(?:[-–—]|[aà])\s*(?:[1-9]|1[0-8])\s*ans?|\d+\s*(?:an|ans|mois))\b/i,
  /(?:\b(?:enfant|enfants|nourrisson|adolescents?|moins\s+de\s+18(?:\s*ans?)?|jusqu['’][aà]\s+18(?:\s*ans?)?|18\s*ans?\s+et\s+moins|(?:de\s+)?(?:0|[1-9]|1[0-7])\s*(?:[-–—]|[aà])\s*(?:[1-9]|1[0-8])\s*ans?)\b|(?:<=|≤)\s*18\b)[^:\n]{0,30}:\s*[^.!?\n]*\b\d+(?:\.\d+)?\s*(?:mg|mcg|ug|g|ml|gouttes?|g[eé]lules?|comprim[eé]s?|tasses?)\b/i,
];

const PEDIATRIC_PROHIBITION_EXEMPTION_RE =
  /\b(?:never\s+give|do\s+not\s+give|don't\s+give|avoid\s+in|contraindicated|not\s+recommended|ne\s+pas\s+donner|ne\s+jamais\s+donner|d[eé]conseill[eé]\s+chez)\b/i;

const PEDIATRIC_EMERGENCY_EXEMPTION_RE =
  /\b(?:poison\s+control|call\s*911|emergency\s+services|keep\s+out\s+of\s+reach|swallow(?:ed)?|ingest(?:ed)?|centre\s+antipoison|appelez\s*le?\s*911|hors\s+de\s+port[eé]e|avale|aval[eé])\b/i;

const PEDIATRIC_AFFIRMATIVE_DOSE_VERB_RE =
  /\b(?:give|administer|take|recommend|prescribe|suggested?|donnez|administrez|prenez)\b/i;

const PEDIATRIC_NUMERIC_DOSE_RE =
  /\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|ug|g|ml|drops?|gouttes?|capsules?|tablets?|cups?|tsp|tbsp|iu|g[eé]lules?|comprim[eé]s?|tasses?)\b/i;

const ADULT_CONTEXT_RE =
  /(?:\b(?:adult|adults|adulte|adultes)\b|\b18\+(?!\d)|\b18\s*(?:years?|yrs?)?\s*(?:and\s+(?:older|over|up)|or\s+older)\b|\b18\s*(?:years?|yrs?|ans?)\s*\+(?!\d)|\b18\s+ans\s+et\s+plus\b|\b(?:over|above)\s+(?:age\s+)?18\b|\b(?:plus\s+de|d[eè]s|[aà]\s+partir\s+de)\s+18(?:\s*ans?)?\b|(?:>=|≥)\s*18\b)/i;

function isExemptPediatricWarningClause(clauseVariants: string[]): boolean {
  const hasProhibition = clauseVariants.some((v) =>
    PEDIATRIC_PROHIBITION_EXEMPTION_RE.test(v)
  );
  if (hasProhibition) {
    return true;
  }
  const hasEmergencyOrIngestion = clauseVariants.some((v) =>
    PEDIATRIC_EMERGENCY_EXEMPTION_RE.test(v)
  );
  const hasAffirmativeDoseVerb = clauseVariants.some((v) =>
    PEDIATRIC_AFFIRMATIVE_DOSE_VERB_RE.test(v)
  );
  return hasEmergencyOrIngestion && !hasAffirmativeDoseVerb;
}

// ---------------------------------------------------------------------------
// Soft warns — concerning but not immediately dangerous phrasing.
// ---------------------------------------------------------------------------

const SOFT_WARNS_EN: RegExp[] = [
  // Diagnostic language
  /\b(?:i can |let me |I will |I'?ll |allow me to )?(?:diagnose|diagnosis|diagnosing)\b/i,
  /\byou have (?:an? |the )?(?:condition|disease|illness|disorder|syndrome) (?:called|named|known as)\b/i,
  /\bbased on (?:your |these )?symptoms?\b.*\byou have\b/i,

  // Guarantee language
  /\bguaranteed (?:to )?(?:cure|heal|fix|work|help)\b/i,
  /\b100% (?:safe|effective|cured|guaranteed)\b/i,
  /\babsolutely (?:safe|harmless|effective|works)\b/i,

  // Medical authority overreach
  /\bi (?:am|'m) (?:a |an )?(?:doctor|physician|pharmacist|herbalist|specialist)\b/i,
  /\bthis is medical advice\b/i,
  /\b(?:I |my |this )?(?:recommendation|prescription) (?:is|for|would be)\b/i,

  // Replacing doctor visit
  /\binstead of (?:seeing|consulting|visiting) (?:a |your )?doctor\b/i,
  /\byou (?:don'?t|do not) need to (?:see|consult|visit) (?:a |your )?doctor\b.*\b(?:because|since|as |if)\b/i,
  /\bskip (?:the|your) (?:doctor|appointment|check.?up|visit|consultation)\b/i,
];

const SOFT_WARNS_FR: RegExp[] = [
  // Diagnostic language
  /\bdiagnostiqu/i,
  /\bvous (?:avez|souffrez|êtes atteint)\b.*\b(?:maladie|condition|trouble|syndrome)\b/i,
  /\bje (?:suis|peux|vais) (?:diagnostiquer|vous dire)\b.*\b(?:ce que|quelle maladie)\b/i,

  // Guarantee language
  /\bgaranti (?:de |pour |d')?(?:guérir|soigner|fonctionner|marcher)\b/i,
  /\b100% (?:sûr|efficace|garanti|naturel)\b/i,
  /\btotalement (?:sans danger|inoffensif|efficace)\b/i,

  // Medical authority
  /\bje (?:suis|peux|vais) (?:un |une )?(?:médecin|docteur|pharmacien|herboriste)\b/i,
  /\bce (?:n'|ne |)est (?:qu'|que )?un avis médical\b/i,
  /\bvoici (?:mon |ma |une )?(?:ordonnance|prescription|recommandation)\b/i,
];

// ---------------------------------------------------------------------------
// Refusal / warning messages (locale-aware)
// ---------------------------------------------------------------------------

const EN_BLOCK =
  "I can't responsibly answer that. Please consult a qualified healthcare provider before making any changes to your medication or treatment.";
const FR_BLOCK =
  "Je ne peux pas répondre à cela. Consultez un professionnel de santé avant toute modification de votre traitement.";
const EN_WARN =
  "\n\n⚠️ This is educational information only — not medical advice. Always verify with a qualified healthcare provider before acting on it.";
const FR_WARN =
  "\n\n⚠️ Ceci est une information éducative — pas un avis médical. Vérifiez avec un professionnel de santé avant d'agir.";

/**
 * The localized refusal used whenever model output cannot be verified as safe
 * — including when the guard itself fails. Callers must fail closed rather than
 * fall back to unguarded model text.
 */
export function getSafetyRefusal(locale: "en" | "fr" = "en"): string {
  return locale === "fr" ? FR_BLOCK : EN_BLOCK;
}

// ---------------------------------------------------------------------------
// Normalization helpers for adversarial pattern matching
// ---------------------------------------------------------------------------

/**
 * Normalize text for matching: lowercase, collapse whitespace,
 * normalize common substitutions (number-for-letter leet-speak, etc.).
 * Does NOT modify the original content — only used for matching.
 */
export function normalizeForMatching(text: string): string {
  return (
    text
      // NFKD: decompose accents + collapse full-width/compatibility forms so
      // "guérir", "ｇｕéｒｉｒ", and Cyrillic-lookalikes reduce to base letters.
      .normalize("NFKD")
      // Strip combining marks (diacritics left after NFKD) before lowercasing.
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      // Collapse whitespace
      .replace(/\s+/g, " ")
      // Number substitutions: 0→o, 1→l/i, 3→e, 4→a, 5→s, 7→t
      .replace(/0/g, "o")
      .replace(/1/g, "i")
      .replace(/3/g, "e")
      .replace(/4/g, "a")
      .replace(/5/g, "s")
      .replace(/7/g, "t")
      // Zero-width characters (adversarial)
      .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, "")
      // Soft hyphens and other invisible chars
      .replace(/[\u00AD\u034F\u061C]/g, "")
      .trim()
  );
}

/**
 * Strip diacritics and invisible/zero-width obfuscation WITHOUT mapping digits
 * to letters so numeric dosage checks remain accurate against "2\u200B50 mg".
 */
export function normalizePreservingDigits(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD\u034F\u061C]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const PRE_LLM_PEDIATRIC_SUBJECT_RE =
  /(?:\b(?:child|children|kid|kids|baby|babies|infant|infants|newborn|newborns|neonate|neonates|toddler|toddlers|minor|minors|adolescent|adolescents|teen|teens|teenager|teenagers|pediatric|paediatric|under[\s-]+(?:age[\s-]+)?18|below[\s-]+(?:age[\s-]+)?18|less\s+than\s+18(?:\s*(?:years?|yrs?))?|my\s+son|my\s+daughter|enfant|enfants|bebe|bebes|nourrisson|nourrissons|nouveau-ne|nouveau-nes|mineur|mineurs|ado|ados|adolescente?s?|pediatrique|moins\s+de\s+18(?:\s+ans?)?|mon\s+fils|ma\s+fille)\b|\b(?:up\s+to\s+(?:age\s+)?18|jusqu['’]?a\s+18(?:\s+ans?)?)\b(?!\s*(?:mg|mcg|ug|g|kg|ml|l|drops?|gouttes?|capsules?|tablets?|cups?|tsp|tbsp|iu|days?|jours?|weeks?|wks?|semaines?|months?|mos?|mois|hours?|hrs?|heures?|min(?:utes?)?|%|times|fois)\b)|\b18(?:\s*(?:years?|yrs?))?\s+(?:and\s+under|or\s+(?:younger|under))\b|\b18\s+ans?\s+et\s+moins\b|(?:<=|≤)\s*18\b(?!\s*(?:mg|mcg|ug|g|kg|ml|l|drops?|gouttes?|capsules?|tablets?|cups?|tsp|tbsp|iu|days?|jours?|weeks?|wks?|semaines?|months?|mos?|mois|hours?|hrs?|heures?|min(?:utes?)?|%)\b)|\b(?:ages?|aged|entre|de)\s*(?:0|[1-9]|1[0-7])\s*(?:[-–—]|to|[aà]|et)\s*(?:[1-9]|1[0-8])\b|\b(?:ages?|aged)\s*(?:under|below|up\s+to|<|<=|≤)\s*18\b|<\s*18\s*(?:years?|yrs?|ans?)\b|(?<!\d)(?:0|[1-9]|1[0-7])\s*(?:[-–—]|to|[aà])\s*(?:[1-9]|1[0-8])\s*(?:years?(?:\s*-?\s*old)?|yrs?(?:\s*-?\s*old)?|yo|ans?)\b|(?<!\d)(?:0|[1-9]|1[0-7])\s*[-–—]\s*18(?:\s*(?:years?|yrs?|yo|ans?))?(?=\s*[:),;?!.]|$)|(?<!\d)(?:0|[1-9]|1[0-7])\s*(?:-\s*)?(?:years?\s*-?\s*old|yrs?\s*-?\s*old|yo|ans?)\b|(?<!\d)\d{1,2}\s*(?:-\s*)?(?:months?\s*-?\s*old|months?|mos?|weeks?\s*-?\s*old|wks?|mois|semaines?)\b)/i;

const PRE_LLM_DOSING_INTENT_RE =
  /\b(?:dose|dosage|doses|dosing|how\s+much|amount|mg|mcg|ml|drops?|calculate|scale|give|posologie|doser|combien|gouttes?|donner|calculer)\b/i;

const PRE_LLM_INGESTION_EVENT_RE =
  /\b(?:swallow(?:ed|ing)?|ingest(?:ed|ing)?|drank|ate|eaten|accidentally\s+(?:took|gave|drank)|overdos(?:e|ed|ing)|poison(?:ed|ing)?|intoxicat(?:ed|ion)|aval[eé]|ing[eé]r[eé]|bu\s+par\s+accident|surdosage|surdose|intoxication|empoisonnement)\b/i;

const PRE_LLM_EMERGENCY_SYMPTOM_OR_HELP_RE =
  /\b(?:what\s+(?:do|should)\s+i\s+do|help|emergency|hospital|vomit(?:ing)?|nausea|seizure|unconscious|trouble\s+breathing|urgent|que\s+faire|aide|urgence|hopital|hôpital|vomir|convulsion|inconscient|respirer)\b/i;

export type PreLlmRefusal = {
  blocked: true;
  kind: "emergency_ingestion" | "dangerous_herb" | "pediatric";
  slug?: string;
  message: string;
};

function buildEmergencyInstructions(locale: "en" | "fr"): string {
  if (locale === "fr") {
    return (
      "URGENCE — En cas d'ingestion accidentelle, de surdosage ou de symptômes graves, appelez immédiatement le 911 (ou les services d'urgence locaux) ou un centre antipoison : " +
      "Canada 1-844-764-7669 · Québec (CAPQ) 1-800-463-5060 · États-Unis 1-800-222-1222. " +
      "Ne faites pas vomir et ne donnez rien par la bouche sauf indication contraire du centre antipoison ou des urgences. Ayez le contenant ou le nom de la plante à portée de main."
    );
  }
  return (
    "EMERGENCY — If accidental ingestion, overdose, or concerning symptoms may have occurred, call 911 (or local emergency services) or Poison Control immediately: " +
    "Canada Poison Control 1-844-764-7669 · Quebec 1-800-463-5060 · US Poison Control 1-800-222-1222. " +
    "Do not induce vomiting or give anything by mouth unless specifically instructed by Poison Control or emergency clinicians. Keep the container or plant sample nearby."
  );
}

/**
 * Deterministic emergency guidance whenever a user reports acute ingestion,
 * accidental exposure, or poisoning involving an herb (child or adult).
 */
export function detectEmergencyIngestion(
  text: string,
  locale: "en" | "fr" = "en",
  history: string[] = []
): PreLlmRefusal | null {
  if (!text || !text.trim()) return null;
  const recentHistory = history.slice(-6);
  const combinedText = [text, ...recentHistory].join("\n");
  const digitSafe = normalizePreservingDigits(text);
  const combinedDigitSafe = normalizePreservingDigits(combinedText);

  const hasIngestion =
    PRE_LLM_INGESTION_EVENT_RE.test(digitSafe) ||
    PRE_LLM_INGESTION_EVENT_RE.test(normalizeForMatching(text));
  if (!hasIngestion) return null;

  const dangerous =
    matchDangerousHerbInput(text) ??
    matchDangerousHerbInput(digitSafe) ??
    matchDangerousHerbInput(combinedDigitSafe);
  const hasPed = PRE_LLM_PEDIATRIC_SUBJECT_RE.test(combinedDigitSafe);
  const hasUrgency =
    PRE_LLM_EMERGENCY_SYMPTOM_OR_HELP_RE.test(digitSafe) ||
    Boolean(dangerous) ||
    hasPed;

  if (
    !hasUrgency &&
    !/\b(?:overdos|poison|intoxicat|surdos|empoison)/i.test(digitSafe)
  ) {
    return null;
  }

  const dangerousPrefix = dangerous
    ? `${locale === "fr" ? dangerous.entry.reasonFr : dangerous.entry.reason} `
    : "";

  return {
    blocked: true,
    kind: "emergency_ingestion",
    ...(dangerous ? { slug: dangerous.slug } : {}),
    message: `${dangerousPrefix}${buildEmergencyInstructions(locale)}`,
  };
}

/**
 * Deterministic pre-LLM refusal for pediatric dosing asks and dangerous-herb
 * dosing asks (EN/FR + obfuscation-resistant + recent user-turn history), with
 * acute emergency and hazard precedence.
 */
export function detectPediatricDosingRequest(
  text: string,
  locale: "en" | "fr" = "en",
  history: string[] = []
): PreLlmRefusal | null {
  if (!text || !text.trim()) return null;
  const recentHistory = history.slice(-6);
  const combined = [text, ...recentHistory].join("\n");
  const digitSafe = normalizePreservingDigits(text);
  const leetFolded = normalizeForMatching(text);
  const historyDigitSafe = normalizePreservingDigits(recentHistory.join("\n"));
  const historyLeetFolded = normalizeForMatching(recentHistory.join("\n"));

  const hasPediatricSubject =
    PRE_LLM_PEDIATRIC_SUBJECT_RE.test(digitSafe) ||
    PRE_LLM_PEDIATRIC_SUBJECT_RE.test(leetFolded) ||
    PRE_LLM_PEDIATRIC_SUBJECT_RE.test(historyDigitSafe) ||
    PRE_LLM_PEDIATRIC_SUBJECT_RE.test(historyLeetFolded);
  const hasDosingAsk =
    PRE_LLM_DOSING_INTENT_RE.test(digitSafe) ||
    PRE_LLM_DOSING_INTENT_RE.test(leetFolded) ||
    PRE_LLM_DOSING_INTENT_RE.test(historyDigitSafe) ||
    PRE_LLM_DOSING_INTENT_RE.test(historyLeetFolded);

  if (!hasPediatricSubject && !hasDosingAsk) return null;

  const dangerous =
    matchDangerousHerbInput(text) ??
    matchDangerousHerbInput(digitSafe) ??
    matchDangerousHerbInput(normalizePreservingDigits(combined));
  if (dangerous && (hasDosingAsk || hasPediatricSubject)) {
    const reason =
      locale === "fr" ? dangerous.entry.reasonFr : dangerous.entry.reason;
    return {
      blocked: true,
      kind: "dangerous_herb",
      slug: dangerous.slug,
      message:
        locale === "fr"
          ? `${reason} HerbAlly ne fournit jamais de posologie pour des plantes présentant une toxicité grave ou mortelle ni pour les personnes de moins de 18 ans. ${buildEmergencyInstructions("fr")}`
          : `${reason} HerbAlly never provides doses for plants with severe or lethal toxicity hazards or for anyone under 18. ${buildEmergencyInstructions("en")}`,
    };
  }

  if (hasPediatricSubject && hasDosingAsk) {
    return {
      blocked: true,
      kind: "pediatric",
      message:
        locale === "fr"
          ? "La posologie pédiatrique et le calcul de doses à base de plantes pour les personnes de moins de 18 ans (enfants, nourrissons ou adolescents) ne sont pas disponibles sur HerbAlly. Veuillez consulter un pédiatre, un pharmacien ou un professionnel de santé qualifié."
          : "Herbal dosing and dosage calculations for anyone under 18 (children, infants, or adolescents) are not available on HerbAlly because pediatric botanical dosing is unvalidated. Please consult a qualified pediatrician, pharmacist, or licensed clinician.",
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main evaluation function
// ---------------------------------------------------------------------------

/**
 * Evaluate the final assistant message text and return a verdict:
 *   - "ok"    — no red flags detected; use the content as-is.
 *   - "warn"  — soft concern (e.g. diagnostic language); append a localised warning.
 *   - "block" — hard red flag (e.g. "stop taking your insulin"); replace with a
 *               localised refusal.
 *
 * The function runs two passes:
 *   1. Direct regex match on the original content.
 *   2. Normalized match after NFKD + leet-speak + zero-width-char removal.
 *
 * Pure and dependency-free: safe to run on the server (the chat API uses it to
 * guard cached responses) AND on the client (the chat interface uses it to
 * guard live streamed output). Both locale pattern sets are ALWAYS loaded — a
 * French abuse phrase must not bypass an English-locale session, and vice versa.
 */
export function evaluateAssistantContent(
  content: string,
  locale: "en" | "fr" = "en"
): SafetyVerdict {
  // Always evaluate against BOTH locale pattern sets. Previously the English
  // locale only loaded English patterns, so a French cessation phrase in an
  // English session slipped through. Both sets are small — load them all.
  const hardBlocks = [...HARD_BLOCKS_EN, ...HARD_BLOCKS_FR];
  const pediatricHardBlocks = [
    ...PEDIATRIC_HARD_BLOCKS_EN,
    ...PEDIATRIC_HARD_BLOCKS_FR,
  ];
  const softWarns = [...SOFT_WARNS_EN, ...SOFT_WARNS_FR];

  const contentToTest = [
    content,
    normalizePreservingDigits(content),
    normalizeForMatching(content),
  ];

  // Pass 1 & 2: check non-pediatric hard blocks
  for (const text of contentToTest) {
    for (const re of hardBlocks) {
      if (re.test(text)) {
        return SafetyVerdictSchema.parse({
          verdict: "block",
          reasons: [`hard-block: ${re.source}`],
          appended: locale === "fr" ? FR_BLOCK : EN_BLOCK,
        });
      }
    }
  }

  // Evaluate pediatric dosing hard blocks per sentence and semicolon clause
  // while carrying pediatric context across adjacent semicolon clauses in the
  // same sentence (unless an adult subject explicitly replaces it). Genuine
  // prohibition/ingestion warnings survive, while follow-on affirmative doses
  // like "Never give children 5 ml; give 10 ml." are blocked.
  const sentences = content
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const sentence of sentences) {
    let sentenceHasPediatricContext = false;
    const clauses = sentence
      .split(/\s*;\s*/)
      .map((c) => c.trim())
      .filter(Boolean);
    for (const clause of clauses) {
      const variants = [
        clause,
        normalizePreservingDigits(clause),
        normalizeForMatching(clause),
      ];
      const clauseHasPed = variants.some((v) =>
        PRE_LLM_PEDIATRIC_SUBJECT_RE.test(v)
      );
      const clauseHasAdult = variants.some((v) => ADULT_CONTEXT_RE.test(v));
      if (clauseHasPed && !clauseHasAdult) {
        sentenceHasPediatricContext = true;
      } else if (clauseHasAdult && !clauseHasPed) {
        sentenceHasPediatricContext = false;
      }

      if (isExemptPediatricWarningClause(variants)) {
        continue;
      }

      for (const v of variants) {
        for (const re of pediatricHardBlocks) {
          if (re.test(v)) {
            return SafetyVerdictSchema.parse({
              verdict: "block",
              reasons: [`hard-block: ${re.source}`],
              appended: locale === "fr" ? FR_BLOCK : EN_BLOCK,
            });
          }
        }
        if (
          sentenceHasPediatricContext &&
          !clauseHasAdult &&
          PEDIATRIC_NUMERIC_DOSE_RE.test(v) &&
          PEDIATRIC_AFFIRMATIVE_DOSE_VERB_RE.test(v)
        ) {
          return SafetyVerdictSchema.parse({
            verdict: "block",
            reasons: ["hard-block: pediatric-semicolon-follow-on-dose"],
            appended: locale === "fr" ? FR_BLOCK : EN_BLOCK,
          });
        }
      }
    }
  }

  // Pass 1 & 2: check soft warns
  const hits = new Set<string>();
  for (const text of contentToTest) {
    for (const re of softWarns) {
      if (re.test(text)) {
        hits.add(`soft-warn: ${re.source}`);
      }
    }
  }

  if (hits.size > 0) {
    return SafetyVerdictSchema.parse({
      verdict: "warn",
      reasons: Array.from(hits),
      appended: locale === "fr" ? FR_WARN : EN_WARN,
    });
  }

  return SafetyVerdictSchema.parse({ verdict: "ok", reasons: [] });
}
