/**
 * context-fetcher — pre-fetches verified herb and interaction data from
 * our Supabase database before the AI responds. This grounds the LLM in
 * real, reviewed data rather than relying on its training set alone.
 *
 * Architecture:
 *   1. Extract herb/drug names from the user's latest message
 *   2. Look up matching herbs in our DB (full profile)
 *   3. Look up known drug interactions
 *   4. Return a structured VerifiedContext the system prompt can inject
 */
import { getAnonClient } from "@/lib/supabase/anonymous";
import type { HerbWithInteractions } from "@/lib/types";
import { localizeHerb, localizeInteraction } from "@/lib/utils/localize-herb";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";
import { sanitizeFilterValue } from "@/lib/utils/ilike";

// ─── Types ──────────────────────────────────────────────────────────

/** The regulator's own record for a herb (Health Canada LNHPD today). */
export interface VerifiedRegulatory {
  source: string;
  purposes: string[];
  doses: string[];
  risks: string[];
  urls: string[];
}

/** An imported regulator monograph (NCCIH, EMA HMPC, LiverTox, …). */
export interface VerifiedMonograph {
  source: string;
  licence: string | null;
  claims: string[];
  safety: string[];
  doses: string[];
  url: string | null;
}

export interface VerifiedHerb {
  slug: string;
  name: string;
  scientific_name: string;
  description: string;
  traditional_uses: string[];
  modern_uses: string[];
  contraindications: string[];
  side_effects: string[];
  drug_interactions: string[];
  dosage_adult: string | null;
  pregnancy_safe: boolean | null;
  nursing_safe: boolean | null;
  pregnancy_safe_oral: boolean | null;
  pregnancy_safe_topical: boolean | null;
  nursing_safe_oral: boolean | null;
  nursing_safe_topical: boolean | null;
  evidence_level: string | null;
  active_compounds: string[];
  provenance_method: string | null;
  /** The regulator's own record, when one exists (Health Canada LNHPD). */
  regulatory: VerifiedRegulatory | null;
  /** Imported monographs for this herb (EMA HMPC, NCCIH, LiverTox, …). */
  monographs: VerifiedMonograph[];
}

export interface VerifiedInteraction {
  herb_name: string;
  drug_name: string;
  severity: string;
  mechanism: string;
  evidence: string;
  recommendation: string;
}

export interface VerifiedContext {
  herbs: VerifiedHerb[];
  interactions: VerifiedInteraction[];
  medicationsMentioned: string[];
  source: "database" | "none";
  note: string;
}

// ─── Herb name extraction ───────────────────────────────────────────

/**
 * Common herb names and their variations. Used for quick matching
 * before falling back to DB search.
 */
const COMMON_HERB_NAMES = new Set([
  "turmeric",
  "curcumin",
  "ginger",
  "garlic",
  "echinacea",
  "chamomile",
  "lavender",
  "peppermint",
  "st. john's wort",
  "st johns wort",
  "saint john's wort",
  "ginkgo",
  "ginkgo biloba",
  "ginseng",
  "ashwagandha",
  "valerian",
  "milk thistle",
  "saw palmetto",
  "black cohosh",
  "feverfew",
  "green tea",
  "kava",
  "melatonin",
  "cinnamon",
  "aloe vera",
  "cranberry",
  "dandelion",
  "elderberry",
  "licorice",
  "nettle",
  "passionflower",
  "rosemary",
  "sage",
  "thyme",
  "willow bark",
  "yarrow",
  "oregano",
  "basil",
  "cardamom",
  "clove",
  "fennel",
  "fenugreek",
  "hawthorn",
  "lemon balm",
  "maca",
  "reishi",
  "rhodiola",
  "schisandra",
  "slippery elm",
  "turkey tail",
]);

/**
 * Words that can never be part of a herb name. They were being sent to the
 * database as search terms, and because the match limit had no ordering, the
 * five rows PostgREST happened to return were the ones that "won".
 *
 * The live failure this fixes: "Tell me about Sideritis scardica. What does the
 * European Medicines Agency say?" searched for tell / about / what / does /
 * european / medicines / agency alongside the two real terms, filled all five
 * slots with "European Goldenrod", "Mugwort European", "Wild Ginger European"…
 * and the herbalist answered that it had no data on Sideritis — then asserted
 * the EMA had no monograph for it, while the imported EMA monograph was in
 * herb_monograph_sources.
 */
const NON_HERB_WORDS = new Set([
  // English function words and question words (all longer than 2 chars)
  "the",
  "and",
  "for",
  "with",
  "without",
  "about",
  "what",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "why",
  "how",
  "does",
  "doesn",
  "did",
  "didn",
  "do",
  "can",
  "could",
  "would",
  "should",
  "shall",
  "will",
  "may",
  "might",
  "must",
  "have",
  "has",
  "had",
  "been",
  "being",
  "was",
  "were",
  "are",
  "isn",
  "not",
  "you",
  "your",
  "yours",
  "they",
  "them",
  "their",
  "there",
  "these",
  "those",
  "this",
  "that",
  "than",
  "then",
  "from",
  "into",
  "onto",
  "over",
  "under",
  "also",
  "just",
  "only",
  "very",
  "much",
  "many",
  "more",
  "most",
  "some",
  "any",
  "all",
  "each",
  "both",
  "other",
  "same",
  "such",
  "tell",
  "give",
  "show",
  "know",
  "knows",
  "want",
  "need",
  "like",
  "help",
  "please",
  "thanks",
  "thank",
  "hello",
  "hey",
  "okay",
  "sure",
  "say",
  "says",
  "said",
  "think",
  "use",
  "used",
  "uses",
  "using",
  "usage",
  "take",
  "taking",
  "taken",
  "make",
  "made",
  "get",
  "got",
  "give",
  "find",
  "look",
  "looking",
  "info",
  "information",
  "detail",
  "details",
  "question",
  "answer",
  "safe",
  "safely",
  "safety",
  "side",
  "effect",
  "effects",
  "risk",
  "risks",
  "benefit",
  "benefits",
  "dose",
  "doses",
  "dosage",
  "dosing",
  "work",
  "works",
  "good",
  "bad",
  "best",
  "better",
  "worse",
  "really",
  "actually",
  "possible",
  "possibly",
  "likely",
  // Domain vocabulary — present in questions far more often than in a name
  "herb",
  "herbs",
  "herbal",
  "herbalist",
  "herbally",
  "plant",
  "plants",
  "medicine",
  "medicines",
  "medical",
  "medication",
  "medications",
  "supplement",
  "supplements",
  "product",
  "products",
  "natural",
  "health",
  "canada",
  "european",
  "europe",
  "agency",
  "monograph",
  "monographs",
  "regulator",
  "regulatory",
  "regulator's",
  "licence",
  "license",
  "licensed",
  "indication",
  "indications",
  "traditional",
  "traditionally",
  "evidence",
  "research",
  "study",
  "studies",
  "trial",
  "trials",
  "clinical",
  "database",
  "scientific",
  "name",
  "names",
  "called",
  "interaction",
  "interactions",
  "combine",
  "combined",
  "combining",
  "together",
  "pregnant",
  "pregnancy",
  "breastfeeding",
  "nursing",
  "children",
  "child",
  "adult",
  "adults",
  "daily",
  "week",
  "weeks",
  "month",
  "months",
  "long",
  "term",
  "much",
  "time",
  // French function words, question words and domain vocabulary
  "les",
  "des",
  "une",
  "aux",
  "que",
  "qui",
  "quoi",
  "dont",
  "quel",
  "quelle",
  "quels",
  "quelles",
  "comment",
  "pourquoi",
  "quand",
  "pour",
  "dans",
  "avec",
  "sans",
  "sous",
  "vers",
  "chez",
  "entre",
  "après",
  "avant",
  "aussi",
  "bien",
  "tout",
  "tous",
  "toute",
  "toutes",
  "plus",
  "moins",
  "être",
  "avoir",
  "fait",
  "faire",
  "peut",
  "peuvent",
  "pouvez",
  "vous",
  "nous",
  "ils",
  "elles",
  "elle",
  "lui",
  "leur",
  "leurs",
  "sont",
  "cette",
  "ces",
  "cela",
  "celui",
  "celle",
  "sert",
  "utilise",
  "utiliser",
  "utilisé",
  "utilisée",
  "usage",
  "effet",
  "effets",
  "secondaire",
  "secondaires",
  "posologie",
  "danger",
  "dangereux",
  "dangereuse",
  "sécurité",
  "vertu",
  "vertus",
  "bienfait",
  "bienfaits",
  "plante",
  "plantes",
  "médecine",
  "traditionnelle",
  "santé",
  "recherche",
  "étude",
  "études",
  "essai",
  "essais",
  "clinique",
  "données",
  "base",
  "nom",
  "scientifique",
  "appelé",
  "appelée",
  "interaction",
  "interactions",
  "combiner",
  "ensemble",
  "enceinte",
  "grossesse",
  "allaitement",
  "enfant",
  "enfants",
  "adulte",
  "adultes",
  "quotidien",
  "quotidienne",
  "semaine",
  "semaines",
  "mois",
  "longtemps",
]);

/** A herbs row reduced to the fields name matching needs. */
interface HerbCandidate {
  name: string;
  scientific_name: string | null;
  slug: string | null;
  fr_name: string | null;
}

/** Does `needle` appear in `haystack` on word boundaries? */
function containsWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return false;
    const before = at === 0 ? " " : haystack[at - 1];
    const afterIndex = at + needle.length;
    const after = afterIndex >= haystack.length ? " " : haystack[afterIndex];
    const isWordChar = (ch: string) =>
      /\p{L}|\p{N}/u.test(ch) || ch === "'" || ch === "’";
    if (!isWordChar(before) && !isWordChar(after)) return true;
    from = at + 1;
  }
}

/** Split a name into its distinctive lowercase words. */
function nameWords(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .split(/[^\p{L}\p{N}']+/u)
        // French elision: "l'ortie" → "ortie", "d'angélique" → "angélique".
        .map((w) => w.replace(/^(?:[ldjmnstc]|qu)['’]/u, ""))
        .filter((w) => w.length >= 3 && !NON_HERB_WORDS.has(w))
    )
  );
}

/**
 * Rank DB candidates by how well they match the message.
 *
 * A whole name present verbatim is decisive ("Sideritis scardica" scores far
 * above "Sideritis"). Otherwise a candidate must match at least half of one of
 * its own name variants, so a stray shared word ("wild", "european") cannot
 * promote an unrelated herb. Returns names, best first.
 */
function rankCandidates(
  candidates: HerbCandidate[],
  lowerMessage: string,
  messageWords: Set<string>
): string[] {
  const scored: Array<{ name: string; score: number }> = [];

  for (const candidate of candidates) {
    const variants = [
      candidate.name,
      candidate.scientific_name,
      candidate.fr_name,
    ].filter((v): v is string => Boolean(v && v.trim()));

    let best = 0;
    for (const variant of variants) {
      const normalised = variant.toLowerCase().trim();
      if (normalised.length < 3) continue;

      if (containsWord(lowerMessage, normalised)) {
        // Longer name = more specific match, so the binomial wins over the genus.
        best = Math.max(best, 1000 + normalised.length * 10);
        continue;
      }

      const words = nameWords(variant);
      if (words.length === 0) continue;
      const matched = words.filter((w) => messageWords.has(w));
      // A single-word name must match in full; a binomial needs at least half.
      const needed = words.length === 1 ? 1 : Math.ceil(words.length / 2);
      if (matched.length < needed) continue;

      let score = matched.reduce((sum, w) => sum + w.length * 10, 0);
      if (matched.length === words.length) score += 25;
      // Names usually lead with the genus or the common name: prefer a match
      // on the first word over one on a trailing qualifier.
      if (messageWords.has(words[0])) score += 15;
      best = Math.max(best, score);
    }

    if (best > 0) scored.push({ name: candidate.name, score: best });
  }

  scored.sort((a, b) => b.score - a.score || a.name.length - b.name.length);
  return scored.map((s) => s.name);
}

/**
 * Extract potential herb names from a user message.
 * Common-name matching first, then a ranked DB search for everything else.
 */
async function extractHerbNames(message: string): Promise<string[]> {
  const lower = message.toLowerCase();
  const found = new Set<string>();
  const priority: string[] = [];

  // Direct common-name matching — a curated list, so these are trusted first.
  for (const name of COMMON_HERB_NAMES) {
    if (containsWord(lower, name) && !found.has(name)) {
      found.add(name);
      priority.push(name);
    }
  }

  // Split on apostrophes as well: French herb names are commonly written with
  // an elided article ("l'ortie"), and the whole token never matches a name.
  // Cap the term count: every term adds OR clauses to one query string.
  const messageWords = new Set<string>();
  for (const token of lower.split(/[^\p{L}\p{N}']+/u)) {
    for (const w of nameWords(token)) messageWords.add(w);
  }
  // Longest terms first — the real herb name is almost always the longest word
  // left after stopword removal.
  const searchTerms = Array.from(messageWords)
    .sort((a, b) => b.length - a.length)
    .slice(0, 8);

  const supabase = getAnonClient();
  if (supabase && searchTerms.length > 0) {
    try {
      const conditions = searchTerms
        .map((w) => {
          const s = sanitizeFilterValue(w);
          // `translations->fr->>name` is where French herb names live (see
          // localizeHerb). Without it, a French user asking about "curcuma"
          // or "gingembre" matched nothing and the herbalist answered that it
          // had no database entry — 13 of 25 herbs in the live FR audit.
          return `name.ilike.%${s}%,scientific_name.ilike.%${s}%,translations->fr->>name.ilike.%${s}%`;
        })
        .join(",");
      const { data } = await supabase
        .from("herbs")
        .select("name, scientific_name, slug, translations")
        .eq("is_published", true)
        .or(conditions)
        // A wide net, ranked below. The old `.limit(5)` with no ordering made
        // the result depend on row order, which is how unrelated herbs that
        // happened to share a word with the question displaced the real one.
        .limit(60);

      const candidates = (data ?? []).map((row) => {
        const record = row as Record<string, unknown>;
        const translations = record.translations as
          { fr?: { name?: unknown } } | null | undefined;
        const frName = translations?.fr?.name;
        return {
          name: String(record.name ?? ""),
          scientific_name:
            typeof record.scientific_name === "string"
              ? record.scientific_name
              : null,
          slug: typeof record.slug === "string" ? record.slug : null,
          fr_name: typeof frName === "string" ? frName : null,
        } satisfies HerbCandidate;
      });

      for (const name of rankCandidates(candidates, lower, messageWords)) {
        const key = name.toLowerCase();
        if (!found.has(key)) {
          found.add(key);
          priority.push(key);
        }
        if (priority.length >= 5) break;
      }
    } catch {
      // DB unavailable — rely on common-name matching only
    }
  }

  return priority;
}

// ─── Medication name extraction ────────────────────────────────────

const COMMON_MEDICATIONS = new Set([
  "warfarin",
  "coumadin",
  "aspirin",
  "ibuprofen",
  "advil",
  "motrin",
  "naproxen",
  "aleve",
  "acetaminophen",
  "tylenol",
  "paracetamol",
  "sertraline",
  "zoloft",
  "fluoxetine",
  "prozac",
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
  "atorvastatin",
  "lipitor",
  "simvastatin",
  "zocor",
  "rosuvastatin",
  "crestor",
  "metformin",
  "glucophage",
  "insulin",
  "levothyroxine",
  "synthroid",
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
  "omeprazole",
  "prilosec",
  "esomeprazole",
  "nexium",
  "pantoprazole",
  "furosemide",
  "lasix",
  "hydrochlorothiazide",
  "hctz",
  "gabapentin",
  "neurontin",
  "pregabalin",
  "lyrica",
  "clopidogrel",
  "plavix",
  "apixaban",
  "eliquis",
  "rivaroxaban",
  "xarelto",
  "prednisone",
  "methotrexate",
  "cyclosporine",
  "tacrolimus",
  "digoxin",
  "lanoxin",
  "phenytoin",
  "dilantin",
  "carbamazepine",
  "tegretol",
  "valproate",
  "depakote",
  "lamotrigine",
  "lamictal",
  "alprazolam",
  "xanax",
  "diazepam",
  "valium",
  "lorazepam",
  "ativan",
  "zolpidem",
  "ambien",
  "diphenhydramine",
  "benadryl",
  "montelukast",
  "singulair",
  "albuterol",
  "fluticasone",
  "sildenafil",
  "viagra",
  "tadalafil",
  "cialis",
  "oxycodone",
  "morphine",
  "tramadol",
  "codeine",
  "lithium",
  "haloperidol",
  "quetiapine",
  "seroquel",
  "olanzapine",
  "zyprexa",
  "risperidone",
  "aripiprazole",
  "abilify",
]);

function extractMedicationNames(message: string): string[] {
  const lower = message.toLowerCase();
  const found = new Set<string>();

  for (const med of COMMON_MEDICATIONS) {
    if (lower.includes(med)) {
      found.add(med);
    }
  }

  return Array.from(found);
}

// ─── DB lookups ─────────────────────────────────────────────────────

async function lookupHerb(
  name: string,
  locale: string
): Promise<VerifiedHerb | null> {
  const supabase = getAnonClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("herbs")
      .select("*, herb_categories(*), drug_interactions(*)")
      .or(
        (() => {
          const s = sanitizeFilterValue(name);
          const slug = sanitizeFilterValue(
            name.toLowerCase().replace(/\s+/g, "-")
          );
          // Also match the French name: a French query resolves to the same
          // row as its English name.
          return `name.ilike.${s},scientific_name.ilike.${s},slug.eq.${slug},translations->fr->>name.ilike.${s}`;
        })()
      )
      .eq("is_published", true)
      .limit(1)
      .single();

    if (error || !data) return null;

    // Localize the herb data so the AI prompt contains French descriptions/uses
    // when the user is on a /fr page, matching the UI language.
    const herb = localizeHerb(
      data as HerbWithInteractions & {
        provenance?: Record<string, unknown>;
      },
      locale
    ) as HerbWithInteractions & {
      provenance?: Record<string, unknown>;
    };

    // Localize interactions so the AI references them in the correct language.
    const localizedInteractions = (herb.drug_interactions ?? []).map((ix) =>
      localizeInteraction(ix, locale)
    );

    return {
      slug: (herb as { slug?: string }).slug ?? "",
      name: herb.name,
      scientific_name: herb.scientific_name,
      description: herb.description ?? "",
      traditional_uses: herb.traditional_uses ?? [],
      modern_uses: herb.modern_uses ?? [],
      contraindications: herb.contraindications ?? [],
      side_effects: herb.side_effects ?? [],
      drug_interactions: localizedInteractions.map(
        (ix) =>
          `${ix.drug_name} (${ix.severity}): ${ix.mechanism ?? ix.description ?? "unknown mechanism"}`
      ),
      dosage_adult: herb.dosage_adult ?? null,
      pregnancy_safe: herb.pregnancy_safe,
      nursing_safe: herb.nursing_safe,

      pregnancy_safe_oral: herb.pregnancy_safe_oral ?? herb.pregnancy_safe,

      pregnancy_safe_topical:
        herb.pregnancy_safe_topical ?? herb.pregnancy_safe,

      nursing_safe_oral: herb.nursing_safe_oral ?? herb.nursing_safe,

      nursing_safe_topical: herb.nursing_safe_topical ?? herb.nursing_safe,
      evidence_level: herb.evidence_level,
      active_compounds: herb.active_compounds ?? [],
      provenance_method:
        ((herb.provenance as Record<string, unknown> | undefined)
          ?.verification_method as string | null) ?? null,
      regulatory: null,
      monographs: [],
    };
  } catch {
    return null;
  }
}

async function lookupInteractions(
  herbNames: string[],
  medicationNames: string[]
): Promise<VerifiedInteraction[]> {
  const supabase = getAnonClient();
  if (!supabase || herbNames.length === 0 || medicationNames.length === 0)
    return [];

  try {
    // Build conditions for drug names
    const drugConditions = medicationNames
      .map((n) => `drug_name.ilike.%${sanitizeFilterValue(n)}%`)
      .join(",");

    const { data } = await supabase
      .from("drug_interactions")
      .select("*, herbs!inner(name)")
      .or(drugConditions)
      .limit(20);

    if (!data) return [];

    // Filter to only interactions where herb matches
    const result: VerifiedInteraction[] = [];
    for (const ix of data) {
      const row = ix as Record<string, unknown>;
      const drugName = String(row.drug_name ?? "");
      const herbName = String(
        (row.herbs as Record<string, unknown> | undefined)?.name ?? ""
      );
      const severity = String(row.severity ?? "unknown");
      const mechanism = String(row.mechanism ?? row.description ?? "Unknown");
      const evidence = String(row.source ?? "Not specified");
      const recommendation = String(
        row.description ?? "Consult healthcare provider"
      );

      const herbMatch = herbNames.some((n) =>
        herbName.toLowerCase().includes(n)
      );
      const drugMatch = medicationNames.some((n) =>
        drugName.toLowerCase().includes(n)
      );

      if (herbMatch && drugMatch) {
        result.push({
          herb_name: herbName,
          drug_name: drugName,
          severity,
          mechanism,
          evidence,
          recommendation,
        });
      }
    }

    return result;
  } catch {
    return [];
  }
}

// ─── Batch DB lookup ─────────────────────────────────────────────────

/**
 * Batch-lookup multiple herbs in a single DB query instead of N individual
 * queries. Falls back to individual lookups if the batch approach fails.
 */
async function batchLookupHerbs(
  names: string[],
  locale: string
): Promise<VerifiedHerb[]> {
  if (names.length === 0) return [];

  // Try a single batched query first
  const supabase = getAnonClient();
  if (supabase) {
    try {
      const conditions = names
        .map((n) => {
          const s = sanitizeFilterValue(n);
          const slug = sanitizeFilterValue(
            n.toLowerCase().replace(/\s+/g, "-")
          );
          // Also match the French name so a French query resolves to the
          // same row as its English name; localizeHerb then localizes it.
          return `name.ilike.${s},scientific_name.ilike.${s},slug.eq.${slug},translations->fr->>name.ilike.${s}`;
        })
        .join(",");

      const { data, error } = await supabase
        .from("herbs")
        .select("*, herb_categories(*), drug_interactions(*)")
        .or(conditions)
        .eq("is_published", true)
        .limit(5);

      if (!error && data && data.length > 0) {
        return data
          .map((row): VerifiedHerb => {
            const herb = row as HerbWithInteractions & {
              provenance?: Record<string, unknown>;
            };
            const localized = localizeHerb(herb, locale) as typeof herb;
            const localizedInteractions = (
              localized.drug_interactions ?? []
            ).map((ix) => localizeInteraction(ix, locale));
            return {
              slug: (localized as { slug?: string }).slug ?? "",
              name: localized.name,
              scientific_name: localized.scientific_name,
              description: localized.description ?? "",
              traditional_uses: localized.traditional_uses ?? [],
              modern_uses: localized.modern_uses ?? [],
              contraindications: localized.contraindications ?? [],
              side_effects: localized.side_effects ?? [],
              drug_interactions: localizedInteractions.map(
                (ix) =>
                  `${ix.drug_name} (${ix.severity}): ${ix.mechanism ?? ix.description ?? "unknown mechanism"}`
              ),
              dosage_adult: localized.dosage_adult ?? null,
              pregnancy_safe: localized.pregnancy_safe,
              nursing_safe: localized.nursing_safe,
              pregnancy_safe_oral:
                localized.pregnancy_safe_oral ?? localized.pregnancy_safe,
              pregnancy_safe_topical:
                localized.pregnancy_safe_topical ?? localized.pregnancy_safe,
              nursing_safe_oral:
                localized.nursing_safe_oral ?? localized.nursing_safe,
              nursing_safe_topical:
                localized.nursing_safe_topical ?? localized.nursing_safe,
              evidence_level: localized.evidence_level,
              active_compounds: localized.active_compounds ?? [],
              provenance_method:
                ((localized.provenance as Record<string, unknown> | undefined)
                  ?.verification_method as string | null) ?? null,
              regulatory: null,
              monographs: [],
            } satisfies VerifiedHerb;
          })
          .filter((h): h is VerifiedHerb => h !== null);
      }
    } catch {
      // Fall through to individual lookups
    }
  }

  // Fallback: individual lookups (parallelized)
  const results = await Promise.all(names.map((n) => lookupHerb(n, locale)));
  return results.filter((h): h is VerifiedHerb => h !== null);
}

// ─── Regulator records ──────────────────────────────────────────────

// Caps keep the injected prompt bounded: a popular herb can carry a dozen
// licensed-product claims and several imported monographs.
const REGULATORY_PURPOSES_CAP = 8;
const REGULATORY_DOSES_CAP = 4;
const REGULATORY_RISKS_CAP = 6;
const MONOGRAPH_CLAIMS_CAP = 8;
const MONOGRAPH_SAFETY_CAP = 6;
const MONOGRAPH_DOSES_CAP = 4;

/**
 * Coerce a jsonb column into short display lines, whatever shape it has.
 * `purposes` is a string[] (normalised 2026-11-16), `doses` is
 * { text, population, age_minimum }[], and older imported rows are plain
 * strings, so every shape has to survive.
 */
function toLines(value: unknown, cap: number): string[] {
  const out: string[] = [];

  const push = (v: unknown): void => {
    if (v == null) return;
    if (typeof v === "string") {
      const text = v.trim();
      if (text) out.push(text);
      return;
    }
    if (typeof v === "number" || typeof v === "boolean") {
      out.push(String(v));
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) push(item);
      return;
    }
    if (typeof v === "object") {
      const record = v as Record<string, unknown>;
      for (const key of [
        "text",
        "claim",
        "purpose",
        "indication",
        "dose",
        "safety",
        "risk",
        "label",
        "description",
        "name",
        "value",
      ]) {
        const candidate = record[key];
        if (typeof candidate === "string" && candidate.trim()) {
          // Keep the qualifier that makes a dose readable ("Adults: 1–2 g").
          const population = record.population;
          const qualifier =
            typeof population === "string" && population.trim()
              ? `${population.trim()}: `
              : "";
          out.push(`${qualifier}${candidate.trim()}`);
          return;
        }
      }
      const leaves = Object.values(record).filter(
        (x): x is string => typeof x === "string" && x.trim().length > 0
      );
      if (leaves.length > 0) out.push(leaves.join(" · "));
    }
  };

  push(value);
  return Array.from(new Set(out)).slice(0, cap);
}

function toStringArray(value: unknown, cap: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .slice(0, cap);
}

/**
 * Attach the regulator's own record and any imported monograph to each herb.
 *
 * VerifiedHerb used to carry the `herbs` row alone, so the herbalist could not
 * see the most authoritative text the site owns — 1,183 Health Canada LNHPD
 * records and 304 imported monographs (NCCIH, EMA HMPC, LiverTox…). Asked what
 * the European Medicines Agency said about Sideritis scardica, it answered
 * that no EMA monograph existed, while that monograph sat in the database.
 *
 * Both tables are anon-readable (RLS: public read on
 * herb_regulatory_evidence, published-herb read on herb_monograph_sources), so
 * the same anon client serves them. Failure to read them must never break the
 * answer: the herbs row alone still grounds the reply.
 */
async function attachRegulatorRecords(herbs: VerifiedHerb[]): Promise<void> {
  const slugs = Array.from(
    new Set(herbs.map((h) => h.slug).filter((s) => s.length > 0))
  );
  if (slugs.length === 0) return;

  const supabase = getAnonClient();
  if (!supabase) return;

  type RegulatoryRow = {
    herb_slug: string;
    source: string;
    purposes: unknown;
    doses: unknown;
    risks: unknown;
    source_urls: unknown;
  };
  type MonographRow = {
    herb_slug: string;
    source: string;
    licence: string | null;
    claims: unknown;
    safety: unknown;
    doses: unknown;
    url: string | null;
    monograph_date: string | null;
  };

  try {
    const [regulatoryResult, monographResult] = await Promise.all([
      supabase
        .from("herb_regulatory_evidence")
        .select("herb_slug, source, purposes, doses, risks, source_urls")
        .in("herb_slug", slugs),
      // Not in the generated database types yet — same cast the herb page uses.
      supabase
        .from("herb_monograph_sources" as never)
        .select(
          "herb_slug, source, licence, claims, safety, doses, url, monograph_date"
        )
        .in("herb_slug", slugs),
    ]);

    const groupBySlug = <T extends { herb_slug: string }>(
      rows: T[] | null | undefined
    ): Map<string, T[]> => {
      const bySlug = new Map<string, T[]>();
      for (const row of rows ?? []) {
        const list = bySlug.get(row.herb_slug) ?? [];
        list.push(row);
        bySlug.set(row.herb_slug, list);
      }
      return bySlug;
    };

    const regulatoryBySlug = groupBySlug(
      (regulatoryResult.data ?? []) as unknown as RegulatoryRow[]
    );
    const monographsBySlug = groupBySlug(
      (monographResult.data ?? []) as unknown as MonographRow[]
    );

    for (const herb of herbs) {
      const regulatory = regulatoryBySlug.get(herb.slug)?.[0];
      if (regulatory) {
        herb.regulatory = {
          source: regulatory.source,
          purposes: toStringArray(regulatory.purposes, REGULATORY_PURPOSES_CAP),
          doses: toLines(regulatory.doses, REGULATORY_DOSES_CAP),
          risks: toLines(regulatory.risks, REGULATORY_RISKS_CAP),
          urls: toStringArray(regulatory.source_urls, 3),
        };
      }

      herb.monographs = (monographsBySlug.get(herb.slug) ?? [])
        .slice(0, 3)
        .map((row) => ({
          source: row.source,
          licence: row.licence ?? null,
          claims: toLines(row.claims, MONOGRAPH_CLAIMS_CAP),
          safety: toLines(row.safety, MONOGRAPH_SAFETY_CAP),
          doses: toLines(row.doses, MONOGRAPH_DOSES_CAP),
          url: row.url ?? null,
        }));
    }
  } catch {
    // Enrichment only — the herbs row is enough to answer.
  }
}

// ─── Main export ────────────────────────────────────────────────────

/**
 * Fetch verified context from our database for a user query.
 * Returns structured data the system prompt can inject as ground truth.
 *
 * @param userMessage - The latest user message to analyze
 * @param herbContext - Optional pre-provided herb context (from URL params)
 * @param medications - Optional pre-provided medication list (from URL params)
 */
export async function fetchVerifiedContext(
  userMessage: string,
  herbContext?: string | null,
  medications?: string[],
  locale?: "en" | "fr"
): Promise<VerifiedContext> {
  // Extract names from the message
  const herbNames = await extractHerbNames(userMessage);
  const medNames = [
    ...extractMedicationNames(userMessage),
    ...(medications ?? []),
  ];

  // If we have pre-provided herb context, try to extract the herb name from it
  if (herbContext && herbNames.length === 0) {
    const ctxLower = herbContext.toLowerCase();
    for (const name of COMMON_HERB_NAMES) {
      if (ctxLower.includes(name)) {
        herbNames.push(name);
        break;
      }
    }
  }

  // Look up herbs — batch into a single DB query instead of N individual
  // lookups, then localize each result. Prefer the explicit locale from the
  // request body (M-9) so DB-injected context and the system prompt share one
  // locale; fall back to the x-locale request header for callers that don't pass
  // a locale (e.g. tests).
  const resolvedLocale =
    locale ?? (await getLocaleFromRequest().catch(() => "en"));
  const herbs = await batchLookupHerbs(herbNames.slice(0, 5), resolvedLocale);
  // Regulator record + imported monographs for those same herbs. Runs after the
  // row lookup because both tables are keyed by slug.
  await attachRegulatorRecords(herbs);

  // Look up interactions
  const interactions = await lookupInteractions(
    herbs.map((h) => h.name.toLowerCase()),
    medNames
  );

  const hasData = herbs.length > 0 || interactions.length > 0;
  const regulatorCount = herbs.filter(
    (h) => h.regulatory !== null || h.monographs.length > 0
  ).length;

  return {
    herbs,
    interactions,
    medicationsMentioned: medNames,
    source: hasData ? "database" : "none",
    note: hasData
      ? `Retrieved ${herbs.length} herb profile(s), ${interactions.length} known interaction(s)${
          regulatorCount > 0
            ? `, and regulator data (Health Canada licensed-product records / imported monographs) for ${regulatorCount} of them`
            : ""
        } from the HerbAlly database.`
      : "No matching herbs or interactions found in the HerbAlly database. Rely on your training data but clearly indicate uncertainty.",
  };
}
