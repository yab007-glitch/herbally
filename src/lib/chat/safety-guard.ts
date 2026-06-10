import { z } from "zod";

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
  new RegExp(
    `\\bstop taking (?:your |the )?(?:${DRUG_TERMS})\\b`,
    "i"
  ),
  new RegExp(
    `\\b(?:cease|discontinue|quit|drop|abandon|halt|suspend) (?:your |the )?(?:${DRUG_TERMS})\\b`,
    "i"
  ),
  new RegExp(
    `\\byou (?:should|must|need to|can) (?:stop|cease|drop|quit) (?:taking )?(?:your |the )?(?:${DRUG_TERMS})\\b`,
    "i"
  ),
  new RegExp(
    `\\b(?:stop|cease) (?:all|any) (?:${DRUG_TERMS})\\b`,
    "i"
  ),

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
  /\b(?:megadose|mega.?dose|heroic dose|overdose)\b/i,
  /\btake as much as you (?:want|like|can)\b/i,

  // Emergency misdirection
  /\bdon'?t (?:go to|call|visit) (?:the |an? )?(?:emergency room|ER|hospital|ambulance)\b/i,
  /\byou (?:don'?t|do not) need (?:emergency|urgent) (?:care|treatment|help)\b/i,
  /\b(?:don'?t|do not|never) call (?:911|999|112|emergency|poison control)\b/i,
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
];

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
 *   2. Normalized match after leet-speak and zero-width-char removal.
 *
 * Client-side only. Runs after the upstream stream finishes but before the
 * message is persisted. Worst case: a bad message is shown once in the user's
 * own session and is replaced before it lands in the database.
 */
export function evaluateAssistantContent(
  content: string,
  locale: "en" | "fr" = "en"
): SafetyVerdict {
  const hardBlocks =
    locale === "fr" ? [...HARD_BLOCKS_EN, ...HARD_BLOCKS_FR] : HARD_BLOCKS_EN;
  const softWarns =
    locale === "fr" ? [...SOFT_WARNS_EN, ...SOFT_WARNS_FR] : SOFT_WARNS_EN;

  const contentToTest = [content, normalizeForMatching(content)];

  // Pass 1 & 2: check hard blocks
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
