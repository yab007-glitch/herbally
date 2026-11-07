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

/** "a, b and c" — an Oxford-comma-free list, as prose wants. */
export function joinList(items: string[]): string {
  const clean = items.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`;
}

/**
 * Trim a fragment into a sentence without changing what it says.
 *
 * Source records arrive with labels bolted on ("Contra-Indications: …"), lower
 * case starts and no full stop. Fixing that is typography, not editing: no word
 * that carries meaning is touched.
 */
export function asSentence(fragment: string): string {
  let text = fragment.trim().replace(/\s+/g, " ");
  text = text.replace(
    /^(contra-?indications?|cautions?|warnings?)\s*:\s*/i,
    ""
  );
  if (!text) return "";
  text = text.charAt(0).toUpperCase() + text.slice(1);
  if (!/[.!?]$/.test(text)) text += ".";
  return text;
}

/** A dosage field that already reads as its own sentence is used untouched. */
function dosageSentence(name: string, dosage: string): string {
  const text = dosage.trim();
  if (/^[A-Z]/.test(text) && /[.!]$/.test(text)) return text;
  return asSentence(
    `The sources record ${text.charAt(0).toLowerCase()}${text.slice(1)}`
  );
}

export function summariseUses(input: NarrativeInput): string | null {
  const traditional = (input.traditionalUses ?? []).filter(Boolean);
  const modern = (input.modernUses ?? []).filter(Boolean);
  if (traditional.length === 0 && modern.length === 0) return null;

  const parts: string[] = [];
  if (traditional.length > 0) {
    parts.push(
      `Traditionally ${input.name} has been used for ${joinList(
        traditional.map((use) => use.toLowerCase())
      )}.`
    );
  }
  if (modern.length > 0) {
    parts.push(
      `Modern sources describe use in ${joinList(modern.map((use) => use.toLowerCase()))}.`
    );
  }
  return parts.join(" ");
}

export function summariseDosage(input: NarrativeInput): string | null {
  if (!input.dosageAdult?.trim()) return null;
  return dosageSentence(input.name, input.dosageAdult);
}

export function summariseSafety(input: NarrativeInput): string | null {
  const parts: string[] = [];

  if (input.pregnancySafe === false) {
    parts.push(
      "It is not considered safe in pregnancy on the evidence recorded here."
    );
  } else if (input.pregnancySafe === true) {
    parts.push("No harm in pregnancy is recorded in the sources reviewed.");
  }

  if (input.nursingSafe === false) {
    parts.push("Use while breastfeeding is likewise not advised.");
  } else if (input.nursingSafe === true) {
    parts.push(
      "No harm during breastfeeding is recorded in the sources reviewed."
    );
  }

  if (input.interactionCount && input.interactionCount > 0) {
    parts.push(
      input.interactionCount === 1
        ? "One drug interaction is recorded below."
        : `${input.interactionCount} drug interactions are recorded below.`
    );
  } else {
    parts.push(
      "No drug interactions are recorded for it in the sources reviewed."
    );
  }

  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Regulator wording, quoted rather than paraphrased.
 *
 * Two of these records on the live site read "Do not used for common cold";
 * rewriting that would make the sentence ours. It stays a quotation.
 */
export function quotedContraindications(input: NarrativeInput): string | null {
  const items = (input.contraindications ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length === 0) return null;

  const source = input.regulator
    ? ` ${input.regulator}'s records state`
    : " The source records state";
  const quotes = items.map((item) => {
    const body = item
      .replace(/^(contra-?indications?|cautions?|warnings?)\s*:\s*/i, "")
      .trim();
    return `“${body.replace(/[.]$/, "")}”`;
  });
  return `${source}: ${joinList(quotes)}.`;
}

export interface NarrativeSection {
  heading: string;
  body: string;
}

/** Everything that can honestly be said, in reading order. */
export function narrativeSections(input: NarrativeInput): NarrativeSection[] {
  const sections: NarrativeSection[] = [];
  const add = (heading: string, body: string | null) => {
    if (body) sections.push({ heading, body });
  };

  add("Traditional and modern use", summariseUses(input));
  add("Recorded dose", summariseDosage(input));
  add("Safety", summariseSafety(input));
  add("In the regulator's words", quotedContraindications(input));

  return sections;
}
