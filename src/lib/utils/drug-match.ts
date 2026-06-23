/**
 * drug-match — matches a user's medication against a drug-interaction row.
 *
 * Replaces the old bidirectional `String.includes()` check, which had two
 * failure modes (audit M5):
 *   - FALSE NEGATIVES (the dangerous direction): a user entering "birth
 *     control pills" against a seed row "Oral Contraceptives" shares no
 *     substring → no warning, even though the user is on a contraindicated
 *     drug.
 *   - FALSE POSITIVES: a short token like "na" matched any drug containing
 *     "na" (e.g. Diphenhydramine), eroding trust.
 *
 * The matcher is token-based (requires a shared significant token, fixing the
 * "na" case) plus a curated brand↔generic↔class synonym map so "warfarin"
 * matches "Anticoagulants (Warfarin)", "xanax" matches "Benzodiazepines
 * (general)" via "alprazolam", and "birth control"/"estrogen" matches "Oral
 * Contraceptives". RxCUI matching would be stronger but the seed data has
 * rxcui = NULL for every row, so this is the pragmatic floor. Over-warning
 * (false positives) is the safer direction for a medical interaction checker.
 */

// Each group is a set of names (single lowercased words or short phrases) that
// refer to the same drug/concept. The first entry is the canonical token used
// as the concept key. Add multi-word phrases verbatim; they're matched as
// substrings of the lowercased input (so "birth control" inside a user's
// "birth control pills" matches).
const SYNONYM_GROUPS: string[][] = [
  [
    "warfarin",
    "coumadin",
    "jantoven",
    "anticoagulant",
    "anticoagulants",
    "blood thinner",
    "blood thinners",
  ],
  [
    "ssri",
    "ssris",
    "antidepressant",
    "antidepressants",
    "fluoxetine",
    "prozac",
    "sertraline",
    "zoloft",
    "citalopram",
    "celexa",
    "escitalopram",
    "lexapro",
    "paroxetine",
    "paxil",
    "venlafaxine",
    "effexor",
    "duloxetine",
    "cymbalta",
    "amitriptyline",
    "nortriptyline",
    "maoi",
    "maois",
  ],
  [
    "oral contraceptives",
    "contraceptive",
    "contraceptives",
    "birth control",
    "estrogen",
    "estradiol",
    "hrt",
    "hormone therapy",
  ],
  [
    "statin",
    "statins",
    "atorvastatin",
    "lipitor",
    "simvastatin",
    "zocor",
    "rosuvastatin",
    "crestor",
  ],
  [
    "benzodiazepine",
    "benzodiazepines",
    "benzo",
    "benzos",
    "alprazolam",
    "xanax",
    "diazepam",
    "valium",
    "lorazepam",
    "ativan",
    "zolpidem",
    "ambien",
    "clonazepam",
    "klonopin",
  ],
  ["metformin", "glucophage", "insulin"],
  ["aspirin", "asa"],
  ["nsaid", "nsaids", "ibuprofen", "advil", "motrin", "naproxen", "aleve"],
  ["acetaminophen", "tylenol", "paracetamol"],
  ["cyclosporine", "tacrolimus", "immunosuppressant", "immunosuppressants"],
  ["digoxin", "lanoxin"],
  [
    "anticonvulsant",
    "anticonvulsants",
    "phenytoin",
    "dilantin",
    "carbamazepine",
    "tegretol",
    "valproate",
    "valproic acid",
    "depakote",
    "lamotrigine",
    "lamictal",
    "phenobarbital",
  ],
  ["levothyroxine", "synthroid", "thyroid"],
  [
    "antihypertensive",
    "antihypertensives",
    "lisinopril",
    "prinivil",
    "zestril",
    "enalapril",
    "losartan",
    "cozaar",
    "amlodipine",
    "norvasc",
    "metoprolol",
    "lopressor",
    "toprol",
    "beta blocker",
    "beta blockers",
    "ace inhibitor",
    "ace inhibitors",
  ],
  ["prednisone", "corticosteroid", "corticosteroids", "steroid", "steroids"],
  ["methotrexate"],
  ["clopidogrel", "plavix", "apixaban", "eliquis", "rivaroxaban", "xarelto"],
  [
    "diuretic",
    "diuretics",
    "furosemide",
    "lasix",
    "hydrochlorothiazide",
    "hctz",
  ],
  ["gabapentin", "neurontin", "pregabalin", "lyrica"],
  ["lithium"],
  ["quetiapine", "seroquel", "olanzapine", "zyprexa", "haloperidol"],
  ["omeprazole", "prilosec", "esomeprazole", "nexium", "pantoprazole"],
  ["diphenhydramine", "benadryl"],
  ["sildenafil", "viagra", "tadalafil", "cialis"],
  ["montelukast", "singulair", "albuterol", "fluticasone"],
  ["dextromethorphan"],
  ["sevoflurane", "anesthetic", "anesthesia"],
];

// Build a lookup: alias (lowercased) → canonical (group[0]).
const ALIAS_TO_CANONICAL: Map<string, string> = new Map();
for (const group of SYNONYM_GROUPS) {
  const canonical = group[0];
  for (const alias of group) ALIAS_TO_CANONICAL.set(alias, canonical);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

function singularize(token: string): string {
  return token.endsWith("s") ? token.slice(0, -1) : token;
}

/**
 * Return the set of concept keys a piece of drug text refers to: its own
 * significant tokens (singularized) plus any synonym-group canonicals those
 * tokens (or multi-word phrases in the text) map to.
 */
function conceptKeys(text: string): Set<string> {
  const lower = text.toLowerCase();
  const keys = new Set<string>();
  for (const tok of tokenize(text)) {
    keys.add(tok);
    keys.add(singularize(tok));
    const canon =
      ALIAS_TO_CANONICAL.get(tok) ?? ALIAS_TO_CANONICAL.get(singularize(tok));
    if (canon) keys.add(canon);
  }
  // Multi-word phrase aliases (e.g. "birth control", "blood thinner") — match
  // as substrings of the lowercased text since tokenization would split them.
  for (const [alias, canon] of ALIAS_TO_CANONICAL) {
    if (alias.includes(" ") && lower.includes(alias)) keys.add(canon);
  }
  return keys;
}

/**
 * Does a user-entered medication name match a drug-interaction row's drug_name?
 */
export function matchesDrugInteraction(
  userMed: string,
  interactionDrug: string
): boolean {
  const u = conceptKeys(userMed);
  if (u.size === 0) return false;
  const i = conceptKeys(interactionDrug);
  for (const k of u) if (i.has(k)) return true;
  return false;
}
