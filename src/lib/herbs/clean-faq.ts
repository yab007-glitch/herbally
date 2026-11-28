import {
  sanitizeFaqQuestionText,
  stripPediatricDosageSentences,
} from "@/lib/herbs/regulatory-evidence";

/**
 * Make an imported FAQ answer read as prose.
 *
 * The FAQ harvest concatenated whole regulator *fields* into one answer and
 * kept the field name as a lead-in, so live pages read like a database dump:
 *
 *   "Contra-Indications: Do not use if pregnant. Contra-Indications: Do not
 *    use if you have liver disease. Known Adverse Reactions: Diuretic effect
 *    may occur."
 *
 * 439 English and 418 French published answers carry at least one of these
 * labels (measured 2026-11-16). The label adds no medical claim — the sentence
 * after it says everything — so it is removed and the sentence is capitalised.
 *
 * Deliberately narrow: only regulator field names that start a sentence are
 * removed. Dose-format labels ("Tincture:", "Herbal tea:", "Single dose:") are
 * structure, not noise, and are left alone. The stored value is never changed;
 * this only runs on the copy that is rendered.
 */
const FIELD_LABEL = [
  // English
  "Contra-?indications?",
  "Known Adverse Reactions",
  "Adverse Reactions",
  "Cautions? and Warnings?",
  "Warnings?",
  "Recommended (?:Dose|Use(?: or Purpose)?)",
  "Risk Information",
  // French
  "Contre-indications?",
  // "Précautions et mises en garde :" is the label Health Canada's French
  // monographs use; it is the mirror of "Cautions and Warnings" and was the
  // one French label both lists missed (cassia-acutifolia, saraca-indica).
  "Précautions? et mises? en garde(?: et (?:précautions|avertissements))?",
  "Mises? en garde(?: et (?:précautions|avertissements))?",
  "Réactions? indésirables(?: connues?)?",
  "Effets? indésirables(?: connus?)?",
  "Dose recommandée",
  "Utilisation recommandée",
  "Informations sur les risques",
].join("|");

// Only at the start of the text or of a sentence: "the recommended dose:" in
// the middle of a clause is part of the sentence and must survive.
const LEADING_LABEL = new RegExp(
  `(^|[.!?]\\s+)(?:${FIELD_LABEL})\\s*:\\s*`,
  "gi"
);

const SENTENCE_START = /(^|[.!?]\s+)([a-zà-öø-ÿ])/g;

// "e.g. blood thinners", "p. ex. anticoagulants" — a period inside an
// abbreviation is not a sentence boundary, so the next word keeps its case.
// `\b[a-z]` is a one-letter abbreviation ("p.", "c.", "v."); the word boundary
// is what stops it matching the last letter of an ordinary word ("famil.").
const ABBREVIATION = /(?:\b[a-z]|e\.g|i\.e|p\.\s?ex|vs|etc|approx|no|ex)\.\s$/i;

/**
 * Remove the regulator field name from a quoted safety string.
 *
 * The imported `contraindications` / `side_effects` arrays keep the source
 * field name at the front of each entry ("Contra-Indications: Do not take…"),
 * and a few entries are whole field dumps where the label reappears after a
 * sentence or a semicolon ("…daisy famil; Contra-Indications: Do not use…").
 * 443 of the 3,238 published herbs carried at least one such entry (measured
 * 2026-11-16). The section around the list already says "Contraindications",
 * so the label is duplication — but the sentence after it is a quotation and
 * is otherwise left verbatim.
 */
const SAFETY_LABEL = [
  // English
  "Contra-?indications?",
  "Known Adverse Reactions",
  "Adverse Reactions",
  "Cautions? and Warnings?",
  "Warnings?",
  "Risk Information",
  // French
  "Contre-indications?",
  // "Précautions et mises en garde :" is the label Health Canada's French
  // monographs use; it is the mirror of "Cautions and Warnings" and was the
  // one French label both lists missed (cassia-acutifolia, saraca-indica).
  "Précautions? et mises? en garde(?: et (?:précautions|avertissements))?",
  "Mises? en garde(?: et (?:précautions|avertissements))?",
  "Réactions? indésirables(?: connues?)?",
  "Effets? indésirables(?: connus?)?",
  "Informations sur les risques",
].join("|");

// Start of the string, or after a sentence end or a semicolon — the field
// dumps chain several fields with "; ". A label inside a clause is part of
// the sentence and survives.
const SAFETY_LABEL_BOUNDARY = new RegExp(
  `(^|[.!?;]\\s+)(?:${SAFETY_LABEL})\\s*:\\s*`,
  "gi"
);

export function stripFieldLabels(raw: string): string {
  if (!raw) return raw;
  let text = raw.replace(/\s+/g, " ").trim();
  if (!text.includes(":")) return text;

  text = text.replace(SAFETY_LABEL_BOUNDARY, "$1");
  // "…discontinue use.; Do not…" — the label sat after ".;".
  text = text.replace(/\s+([,.])/g, "$1").replace(/\.;/g, ".");
  return text;
}

const DIRECTIVE_PRESURGERY_PATTERN =
  /^(?:pre[-\s]?surgery\s*\((?:stop|discontinue)\b[^)]*\)|(?:stop|discontinue)\s+(?:at least\s+)?\d+(?:\s*[-–]\s*\d+)?\s*(?:days?|weeks?)\s+before\s+(?:scheduled\s+)?surgery[^.]*\.?)$/i;

/**
 * Rewrites unilateral directive pre-surgery stop-date strings from legacy
 * monograph rows (e.g., "Pre-surgery (stop 2 weeks before)") into
 * prescriber-directed peri-operative guidance that explicitly warns readers
 * not to independently discontinue prescribed medications.
 */
export function sanitizePreSurgeryContraindication(
  raw: string,
  locale: "en" | "fr" = "en"
): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  if (!DIRECTIVE_PRESURGERY_PATTERN.test(trimmed)) return raw;
  return locale === "fr"
    ? "Chirurgie prévue : discutez de vos plantes et suppléments avec votre équipe chirurgicale ou votre anesthésiste à l'avance ; n'interrompez jamais seul un médicament prescrit"
    : "Scheduled surgery: discuss herbal supplements with your surgical team or anesthesiologist well in advance (peri-operative guidance depends on preparation and dose); do not independently stop prescribed medications";
}

export function sanitizeContraindicationList(
  items: string[] | null | undefined,
  locale: "en" | "fr" = "en"
): string[] | null {
  if (!Array.isArray(items)) return items ?? null;
  return items.map((item) => sanitizePreSurgeryContraindication(item, locale));
}

function formatFaqProse(raw: string): string {
  if (!raw) return raw;
  let text = raw.replace(/\s+/g, " ").trim();
  if (!text) return text;

  if (text.includes(":")) {
    text = text.replace(LEADING_LABEL, "$1");
  }
  // "breastfeeding , do not use" — a space the importer left before the comma.
  text = text.replace(/\s+([,.])/g, "$1");
  // Each regulator field arrived separately, so the same sentence can appear
  // back to back ("If you are pregnant… Do not use. If you are pregnant…").
  // An immediate verbatim repeat adds nothing.
  text = text.replace(/([^.!?]+[.!?])\s+\1/gi, "$1");
  // The removed label usually leaves a lowercase sentence behind.
  text = text.replace(
    SENTENCE_START,
    (match, lead: string, letter: string, offset: number) => {
      const letterIndex = offset + lead.length;
      const preceding = text.slice(Math.max(0, letterIndex - 12), letterIndex);
      if (ABBREVIATION.test(preceding)) return match;
      return lead + letter.toUpperCase();
    }
  );

  return text;
}

const INLINE_DIRECTIVE_PRESURGERY_PATTERN =
  /pre[-\s]?surgery\s*\((?:stop|discontinue)\b[^)]*\)/gi;

export function sanitizePreSurgeryProse(
  raw: string,
  locale: "en" | "fr" = "en"
): string {
  if (!raw) return raw;
  const replacement =
    locale === "fr"
      ? "Chirurgie prévue : discutez de vos plantes et suppléments avec votre équipe chirurgicale ou votre anesthésiste à l'avance ; n'interrompez jamais seul un médicament prescrit"
      : "Scheduled surgery: discuss herbal supplements with your surgical team or anesthesiologist well in advance (peri-operative guidance depends on preparation and dose); do not independently stop prescribed medications";
  return raw.replace(INLINE_DIRECTIVE_PRESURGERY_PATTERN, replacement);
}

export function cleanFaqText(raw: string, locale: "en" | "fr" = "en"): string {
  if (!raw) return raw;
  const text = formatFaqProse(raw);
  if (!text) return text;
  return sanitizePreSurgeryProse(stripPediatricDosageSentences(text), locale);
}

export function cleanFaqQuestion(raw: string): string {
  if (!raw) return raw;
  const text = formatFaqProse(raw);
  if (!text) return text;
  return sanitizeFaqQuestionText(text);
}
