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

// ─── Types ──────────────────────────────────────────────────────────

export interface VerifiedHerb {
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
 * Extract potential herb names from a user message.
 * Uses common name matching + DB search as fallback.
 */
async function extractHerbNames(message: string): Promise<string[]> {
  const lower = message.toLowerCase();
  const found = new Set<string>();

  // Direct common-name matching
  for (const name of COMMON_HERB_NAMES) {
    if (lower.includes(name)) {
      found.add(name);
    }
  }

  // Also try DB search for any remaining terms
  const words = lower.split(/[\s,.;:!?]+/).filter((w) => w.length > 3);
  const supabase = getAnonClient();
  if (supabase && words.length > 0) {
    try {
      const conditions = words
        .map((w) => `name.ilike.%${w}%,scientific_name.ilike.%${w}%`)
        .join(",");
      const { data } = await supabase
        .from("herbs")
        .select("name")
        .eq("is_published", true)
        .or(conditions)
        .limit(5);

      for (const row of data ?? []) {
        found.add(row.name.toLowerCase());
      }
    } catch {
      // DB unavailable — rely on common-name matching only
    }
  }

  return Array.from(found);
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

async function lookupHerb(name: string): Promise<VerifiedHerb | null> {
  const supabase = getAnonClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("herbs")
      .select("*, herb_categories(*), drug_interactions(*)")
      .or(
        `name.ilike.${name},scientific_name.ilike.${name},slug.eq.${name.toLowerCase().replace(/\s+/g, "-")}`
      )
      .eq("is_published", true)
      .limit(1)
      .single();

    if (error || !data) return null;

    const herb = data as HerbWithInteractions & {
      provenance?: Record<string, unknown>;
    };

    return {
      name: herb.name,
      scientific_name: herb.scientific_name,
      description: herb.description ?? "",
      traditional_uses: herb.traditional_uses ?? [],
      modern_uses: herb.modern_uses ?? [],
      contraindications: herb.contraindications ?? [],
      side_effects: herb.side_effects ?? [],
      drug_interactions: (herb.drug_interactions ?? []).map(
        (ix) =>
          `${ix.drug_name} (${ix.severity}): ${ix.mechanism ?? ix.description ?? "unknown mechanism"}`
      ),
      dosage_adult: herb.dosage_adult ?? null,
      pregnancy_safe: herb.pregnancy_safe,
      nursing_safe: herb.nursing_safe,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pregnancy_safe_oral: herb.pregnancy_safe_oral ?? herb.pregnancy_safe,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pregnancy_safe_topical:
        herb.pregnancy_safe_topical ?? herb.pregnancy_safe,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nursing_safe_oral: herb.nursing_safe_oral ?? herb.nursing_safe,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nursing_safe_topical: herb.nursing_safe_topical ?? herb.nursing_safe,
      evidence_level: herb.evidence_level,
      active_compounds: herb.active_compounds ?? [],
      provenance_method:
        ((herb.provenance as Record<string, unknown> | undefined)
          ?.verification_method as string | null) ?? null,
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
      .map((n) => `drug_name.ilike.%${n}%`)
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
  medications?: string[]
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

  // Look up herbs
  const herbPromises = herbNames.slice(0, 5).map(lookupHerb);
  const herbs = (await Promise.all(herbPromises)).filter(
    (h): h is VerifiedHerb => h !== null
  );

  // Look up interactions
  const interactions = await lookupInteractions(
    herbs.map((h) => h.name.toLowerCase()),
    medNames
  );

  const hasData = herbs.length > 0 || interactions.length > 0;

  return {
    herbs,
    interactions,
    medicationsMentioned: medNames,
    source: hasData ? "database" : "none",
    note: hasData
      ? `Retrieved ${herbs.length} herb profile(s) and ${interactions.length} known interaction(s) from the HerbAlly database.`
      : "No matching herbs or interactions found in the HerbAlly database. Rely on your training data but clearly indicate uncertainty.",
  };
}
