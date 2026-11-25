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
import { shouldSuppressPublicAdultDose } from "@/lib/data/dangerous-herbs";
import { PUBLIC_HERB_COLUMNS } from "@/lib/herbs/public-columns";
import { stripPediatricDosageSentences } from "@/lib/herbs/regulatory-evidence";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";
import { sanitizeFilterValue } from "@/lib/utils/ilike";
import {
  COMMON_HERB_NAMES,
  NON_HERB_WORDS,
  WEAK_SEARCH_TERMS,
  extractMedicationNames,
} from "./context/dictionaries";
import { attachRegulatorRecords } from "./context/regulator-records";
import type {
  VerifiedContext,
  VerifiedHerb,
  VerifiedInformationSheet,
  VerifiedInteraction,
  VerifiedMonograph,
  VerifiedRegulatory,
} from "./context/types";

export type {
  VerifiedContext,
  VerifiedHerb,
  VerifiedInformationSheet,
  VerifiedInteraction,
  VerifiedMonograph,
  VerifiedRegulatory,
};

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
        best = Math.max(best, 1000 + normalised.length * 10);
        continue;
      }

      const words = nameWords(variant);
      if (words.length === 0) continue;
      const matched = words.filter((w) => messageWords.has(w));
      const needed = words.length === 1 ? 1 : Math.ceil(words.length / 2);
      if (matched.length < needed) continue;
      if (!matched.some((w) => !WEAK_SEARCH_TERMS.has(w))) continue;

      let score = matched.reduce((sum, w) => sum + w.length * 10, 0);
      if (matched.length === words.length) score += 25;
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

  for (const name of COMMON_HERB_NAMES) {
    if (containsWord(lower, name) && !found.has(name)) {
      found.add(name);
      priority.push(name);
    }
  }

  const messageWords = new Set<string>();
  for (const token of lower.split(/[^\p{L}\p{N}']+/u)) {
    for (const w of nameWords(token)) messageWords.add(w);
  }
  const searchTerms = Array.from(messageWords)
    .sort((a, b) => b.length - a.length)
    .slice(0, 8);

  const supabase = getAnonClient();
  if (supabase && searchTerms.length > 0) {
    try {
      const conditions = searchTerms
        .map((w) => {
          const s = sanitizeFilterValue(w);
          return `name.ilike.%${s}%,scientific_name.ilike.%${s}%,translations->fr->>name.ilike.%${s}%`;
        })
        .join(",");
      const { data } = await supabase
        .from("herbs_public" as never)
        .select("name, scientific_name, slug, translations")
        .eq("is_published", true)
        .or(conditions)
        .order("name")
        .limit(200);

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

function mapHerbRowToVerified(
  row: HerbWithInteractions & { provenance?: Record<string, unknown> },
  locale: string
): VerifiedHerb {
  const localized = localizeHerb(row, locale) as typeof row;
  const localizedInteractions = (localized.drug_interactions ?? []).map((ix) =>
    localizeInteraction(ix, locale)
  );
  const slug = (localized as { slug?: string }).slug ?? "";
  const isBlockedHerb = slug ? shouldSuppressPublicAdultDose(slug) : false;
  return {
    slug,
    name: localized.name,
    scientific_name: localized.scientific_name,
    description: localized.description ?? "",
    traditional_uses: localized.traditional_uses ?? [],
    modern_uses: localized.modern_uses ?? [],
    contraindications: localized.contraindications ?? [],
    side_effects: localized.side_effects ?? [],
    drug_interactions: localizedInteractions
      .filter((ix) => {
        const pubStatus = (ix as { publication_status?: string | null })
          .publication_status;
        return pubStatus !== "retracted_hold";
      })
      .map((ix) => {
        const pubStatus =
          (ix as { publication_status?: string | null }).publication_status ??
          "legacy_unreviewed";
        const statusTag =
          pubStatus === "published"
            ? "[published clinician-reviewed]"
            : `[${pubStatus} — confirm with pharmacist]`;
        return `${ix.drug_name} (${ix.severity}) ${statusTag}: ${ix.mechanism ?? ix.description ?? "unknown mechanism"}`;
      }),
    dosage_adult: isBlockedHerb
      ? null
      : stripPediatricDosageSentences(localized.dosage_adult) || null,
    pregnancy_safe: localized.pregnancy_safe,
    nursing_safe: localized.nursing_safe,
    pregnancy_safe_oral:
      localized.pregnancy_safe_oral ?? localized.pregnancy_safe,
    pregnancy_safe_topical:
      localized.pregnancy_safe_topical ?? localized.pregnancy_safe,
    nursing_safe_oral: localized.nursing_safe_oral ?? localized.nursing_safe,
    nursing_safe_topical:
      localized.nursing_safe_topical ?? localized.nursing_safe,
    evidence_level: localized.evidence_level,
    active_compounds: localized.active_compounds ?? [],
    provenance_method:
      ((localized.provenance as Record<string, unknown> | undefined)
        ?.verification_method as string | null) ?? null,
    regulatory: null,
    monographs: [],
    information_sheet: null,
  };
}

async function lookupHerb(
  name: string,
  locale: string
): Promise<VerifiedHerb | null> {
  const supabase = getAnonClient();
  if (!supabase) return null;

  try {
    const s = sanitizeFilterValue(name);
    const slug = sanitizeFilterValue(name.toLowerCase().replace(/\s+/g, "-"));
    const { data, error } = await supabase
      .from("herbs_public" as never)
      .select(
        `${PUBLIC_HERB_COLUMNS}, herb_categories(*), drug_interactions(*)`
      )
      .or(
        `name.ilike.${s},scientific_name.ilike.${s},slug.eq.${slug},translations->fr->>name.ilike.${s}`
      )
      .eq("is_published", true)
      .limit(1)
      .single();

    if (error || !data) return null;

    return mapHerbRowToVerified(
      data as HerbWithInteractions & { provenance?: Record<string, unknown> },
      locale
    );
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
    const drugConditions = medicationNames
      .map((n) => `drug_name.ilike.%${sanitizeFilterValue(n)}%`)
      .join(",");

    const { data } = await supabase
      .from("drug_interactions")
      .select("*, herbs!inner(name)")
      .or(drugConditions)
      .limit(20);

    if (!data) return [];

    const result: VerifiedInteraction[] = [];
    for (const ix of data) {
      const row = ix as Record<string, unknown>;
      const publicationStatus = String(
        row.publication_status ?? "legacy_unreviewed"
      );
      if (publicationStatus === "retracted_hold") {
        continue;
      }
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
          publication_status: publicationStatus,
        });
      }
    }

    return result;
  } catch {
    return [];
  }
}

/**
 * Batch-lookup multiple herbs in a single DB query instead of N individual
 * queries. Falls back to individual lookups if the batch approach fails.
 */
async function batchLookupHerbs(
  names: string[],
  locale: string
): Promise<VerifiedHerb[]> {
  if (names.length === 0) return [];

  const supabase = getAnonClient();
  if (supabase) {
    try {
      const conditions = names
        .map((n) => {
          const s = sanitizeFilterValue(n);
          const slug = sanitizeFilterValue(
            n.toLowerCase().replace(/\s+/g, "-")
          );
          return `name.ilike.${s},scientific_name.ilike.${s},slug.eq.${slug},translations->fr->>name.ilike.${s}`;
        })
        .join(",");

      const { data, error } = await supabase
        .from("herbs_public" as never)
        .select(
          `${PUBLIC_HERB_COLUMNS}, herb_categories(*), drug_interactions(*)`
        )
        .or(conditions)
        .eq("is_published", true)
        .limit(5);

      if (!error && data && data.length > 0) {
        return data.map((row) =>
          mapHerbRowToVerified(
            row as HerbWithInteractions & {
              provenance?: Record<string, unknown>;
            },
            locale
          )
        );
      }
    } catch {
      // Fall through to individual lookups
    }
  }

  const results = await Promise.all(names.map((n) => lookupHerb(n, locale)));
  return results.filter((h): h is VerifiedHerb => h !== null);
}

/**
 * Fetch verified context from our database for a user query.
 * Returns structured data the system prompt can inject as ground truth.
 */
export async function fetchVerifiedContext(
  userMessage: string,
  herbContext?: string | null,
  medications?: string[],
  locale?: "en" | "fr"
): Promise<VerifiedContext> {
  const herbNames = await extractHerbNames(userMessage);
  const medNames = [
    ...extractMedicationNames(userMessage),
    ...(medications ?? []),
  ];

  if (herbContext && herbNames.length === 0) {
    const ctxLower = herbContext.toLowerCase();
    for (const name of COMMON_HERB_NAMES) {
      if (ctxLower.includes(name)) {
        herbNames.push(name);
        break;
      }
    }
  }

  const resolvedLocale =
    locale ?? (await getLocaleFromRequest().catch(() => "en"));
  const herbs = await batchLookupHerbs(herbNames.slice(0, 5), resolvedLocale);

  const interactionsPromise = lookupInteractions(
    herbs.map((h) => h.name.toLowerCase()),
    medNames
  );
  await attachRegulatorRecords(herbs);
  const interactions = await interactionsPromise;

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
