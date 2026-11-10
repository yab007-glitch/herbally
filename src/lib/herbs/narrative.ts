/**
 * Turns recorded fields into sentences a person can read.
 *
 * The rule this module exists to enforce: every sentence here is a restatement of
 * a field we already hold, never an addition. If a fact is not in the database it
 * does not appear on the page — which is what separates this from the padding that
 * gets a site refused by AdSense. Quoted regulator text stays verbatim, including
 * its own typos, because it is a quotation and not our prose.
 *
 * Kept free of React and of the database so it can be unit-tested directly.
 */

export interface NarrativeInput {
  name: string;
  traditionalUses?: string[] | null;
  modernUses?: string[] | null;
  dosageAdult?: string | null;
  contraindications?: string[] | null;
  sideEffects?: string[] | null;
  pregnancySafe?: boolean | null;
  nursingSafe?: boolean | null;
  interactionCount?: number;
  /** Where the regulatory wording comes from, e.g. "Health Canada". */
  regulator?: string | null;
}

/**
 * Every sentence this module builds, in one place.
 *
 * The section used to hardcode English, so a French page showed French fields
 * inside English sentences. Keeping the templates typed means a new sentence
 * cannot be added without both languages.
 */
export interface NarrativeCopy {
  title: string;
  usesHeading: string;
  doseHeading: string;
  safetyHeading: string;
  regulatorHeading: string;
  /** Joins the last two items of a list: "a, b and c". */
  conjunction: string;
  uses: (name: string, list: string) => string;
  modern: (list: string) => string;
  dose: (dose: string) => string;
  pregnancyUnsafe: string;
  pregnancySafe: string;
  nursingUnsafe: string;
  nursingSafe: string;
  interactionsOne: string;
  interactionsMany: (n: number) => string;
  interactionsNone: string;
  /** "Health Canada's records state" / "Les dossiers de Santé Canada indiquent". */
  regulatorSource: (regulator: string | null) => string;
  /** Punctuation before a quotation: ":" in English, " :" in French. */
  colon: string;
  /** Labels stripped from a quoted fragment before it is used in prose. */
  labelPattern: RegExp;
}

export const NARRATIVE_EN: NarrativeCopy = {
  title: "What the records say",
  usesHeading: "Traditional and modern use",
  doseHeading: "Recorded dose",
  safetyHeading: "Safety",
  regulatorHeading: "In the regulator's words",
  conjunction: "and",
  uses: (name, list) => `Traditionally ${name} has been used for ${list}.`,
  modern: (list) => `Modern sources describe use in ${list}.`,
  dose: (dose) => `The sources record ${dose}.`,
  pregnancyUnsafe:
    "It is not considered safe in pregnancy on the evidence recorded here.",
  pregnancySafe: "No harm in pregnancy is recorded in the sources reviewed.",
  nursingUnsafe: "Use while breastfeeding is likewise not advised.",
  nursingSafe:
    "No harm during breastfeeding is recorded in the sources reviewed.",
  interactionsOne: "One drug interaction is recorded below.",
  interactionsMany: (n) => `${n} drug interactions are recorded below.`,
  interactionsNone:
    "No drug interactions are recorded for it in the sources reviewed.",
  regulatorSource: (regulator) =>
    regulator ? ` ${regulator}'s records state` : " The source records state",
  colon: ":",
  labelPattern: /^(contra-?indications?|cautions?|warnings?)\s*:\s*/i,
};

export const NARRATIVE_FR: NarrativeCopy = {
  title: "Ce que disent les dossiers",
  usesHeading: "Usage traditionnel et moderne",
  doseHeading: "Posologie consignée",
  safetyHeading: "Sécurité",
  regulatorHeading: "Dans les mots du régulateur",
  conjunction: "et",
  // Neutral phrasing on purpose: French herb names vary in gender, and a
  // template like "Le curcuma est utilisé" would be wrong for "la valériane".
  uses: (name, list) => `Usages traditionnels consignés pour ${name} : ${list}.`,
  modern: (list) => `Les sources modernes décrivent un usage pour ${list}.`,
  dose: (dose) => `Les sources consignent la posologie suivante : ${dose}.`,
  pregnancyUnsafe:
    "L'usage n'est pas considéré comme sûr pendant la grossesse selon les données consignées.",
  pregnancySafe:
    "Aucun effet nocif pendant la grossesse n'est consigné dans les sources examinées.",
  nursingUnsafe: "L'usage pendant l'allaitement n'est pas conseillé non plus.",
  nursingSafe:
    "Aucun effet nocif pendant l'allaitement n'est consigné dans les sources examinées.",
  interactionsOne: "Une interaction médicamenteuse est consignée ci-dessous.",
  interactionsMany: (n) =>
    `${n} interactions médicamenteuses sont consignées ci-dessous.`,
  interactionsNone:
    "Aucune interaction médicamenteuse n'est consignée dans les sources examinées.",
  regulatorSource: (regulator) =>
    regulator ? ` Les dossiers de ${regulator} indiquent` : " Les sources indiquent",
  // French typography puts a space before a colon; English does not.
  colon: " :",
  labelPattern:
    /^(précautions?\s+et\s+mises?\s+en\s+garde|mises?\s+en\s+garde(\s+et\s+précautions)?|contre-indications?)\s*:\s*/i,
};

/** "a, b and c" — an Oxford-comma-free list, as prose wants. */
export function joinList(items: string[], conjunction = "and"): string {
  const clean = items.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} ${conjunction} ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} ${conjunction} ${
    clean[clean.length - 1]
  }`;
}

/**
 * Trim a fragment into a sentence without changing what it says.
 *
 * Source records arrive with labels bolted on ("Contra-Indications: …"), lower
 * case starts and no full stop. Fixing that is typography, not editing: no word
 * that carries meaning is touched.
 */
export function asSentence(fragment: string, copy = NARRATIVE_EN): string {
  let text = fragment.trim().replace(/\s+/g, " ");
  text = text.replace(copy.labelPattern, "");
  if (!text) return "";
  text = text.charAt(0).toUpperCase() + text.slice(1);
  if (!/[.!?]$/.test(text)) text += ".";
  return text;
}

/** A dosage field that already reads as its own sentence is used untouched. */
function dosageSentence(
  name: string,
  dosage: string,
  copy: NarrativeCopy
): string {
  const text = dosage.trim();
  if (/^[A-Z]/.test(text) && /[.!]$/.test(text)) return text;
  return asSentence(
    copy.dose(`${text.charAt(0).toLowerCase()}${text.slice(1)}`),
    copy
  );
}

export function summariseUses(
  input: NarrativeInput,
  copy: NarrativeCopy = NARRATIVE_EN
): string | null {
  const traditional = (input.traditionalUses ?? []).filter(Boolean);
  const modern = (input.modernUses ?? []).filter(Boolean);
  if (traditional.length === 0 && modern.length === 0) return null;

  const parts: string[] = [];
  if (traditional.length > 0) {
    parts.push(
      copy.uses(
        input.name,
        joinList(
          traditional.map((use) => use.toLowerCase()),
          copy.conjunction
        )
      )
    );
  }
  if (modern.length > 0) {
    parts.push(
      copy.modern(
        joinList(
          modern.map((use) => use.toLowerCase()),
          copy.conjunction
        )
      )
    );
  }
  return parts.join(" ");
}

export function summariseDosage(
  input: NarrativeInput,
  copy: NarrativeCopy = NARRATIVE_EN
): string | null {
  if (!input.dosageAdult?.trim()) return null;
  return dosageSentence(input.name, input.dosageAdult, copy);
}

export function summariseSafety(
  input: NarrativeInput,
  copy: NarrativeCopy = NARRATIVE_EN
): string | null {
  const parts: string[] = [];

  if (input.pregnancySafe === false) {
    parts.push(copy.pregnancyUnsafe);
  } else if (input.pregnancySafe === true) {
    parts.push(copy.pregnancySafe);
  }

  if (input.nursingSafe === false) {
    parts.push(copy.nursingUnsafe);
  } else if (input.nursingSafe === true) {
    parts.push(copy.nursingSafe);
  }

  if (input.interactionCount && input.interactionCount > 0) {
    parts.push(
      input.interactionCount === 1
        ? copy.interactionsOne
        : copy.interactionsMany(input.interactionCount)
    );
  } else {
    parts.push(copy.interactionsNone);
  }

  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Regulator wording, quoted rather than paraphrased.
 *
 * Two of these records on the live site read "Do not used for common cold";
 * rewriting that would make the sentence ours. It stays a quotation.
 */
export function quotedContraindications(
  input: NarrativeInput,
  copy: NarrativeCopy = NARRATIVE_EN
): string | null {
  const items = (input.contraindications ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length === 0) return null;

  const source = copy.regulatorSource(input.regulator ?? null);
  const quotes = items.map((item) => {
    const body = item.replace(copy.labelPattern, "").trim();
    return `“${body.replace(/[.]$/, "")}”`;
  });
  return `${source.trim()}${copy.colon} ${joinList(
    quotes,
    copy.conjunction
  )}.`;
}

export interface NarrativeSection {
  heading: string;
  body: string;
}

/** Everything that can honestly be said, in reading order. */
export function narrativeSections(
  input: NarrativeInput,
  copy: NarrativeCopy = NARRATIVE_EN
): NarrativeSection[] {
  const sections: NarrativeSection[] = [];
  const add = (heading: string, body: string | null) => {
    if (body) sections.push({ heading, body });
  };

  add(copy.usesHeading, summariseUses(input, copy));
  add(copy.doseHeading, summariseDosage(input, copy));
  add(copy.safetyHeading, summariseSafety(input, copy));
  add(copy.regulatorHeading, quotedContraindications(input, copy));

  return sections;
}
