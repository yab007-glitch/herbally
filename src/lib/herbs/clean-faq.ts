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

export function cleanFaqText(raw: string): string {
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
