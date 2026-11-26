/**
 * Normalize free-text herb, symptom, and medication queries across EN and FR.
 * Strips diacritics cleanly and splits French elided articles (`l'`, `d'`, `qu'`).
 */

export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const ELIDED_FRENCH_PREFIXES = /^(?:l|d|qu|s|c|j|n|m|t)['’]/i;

/**
 * Split a free-text search term into meaningful query tokens, stripping
 * elided French articles (`l'ail` -> `ail`, `d'orthosiphon` -> `orthosiphon`).
 */
export function splitSearchTokens(term: string, maxTokens = 10): string[] {
  const parts = term
    .trim()
    .split(/\s+/)
    .flatMap((word) => word.split(/['’]+/))
    .map((part) => part.replace(ELIDED_FRENCH_PREFIXES, "").trim())
    .filter((part) => part.length >= 2);
  return Array.from(new Set(parts)).slice(0, maxTokens);
}

import { sanitizeFilterValue } from "@/lib/utils/ilike";

/**
 * Word endings where a final "s" is part of the name, not a plural: the Latin
 * and French -is/-us/-es/-os/-as forms ("Millepertuis", "officinalis",
 * "sativus", "Cannabis"). Stripping those would rewrite the name instead of
 * folding a plural.
 */
const NON_PLURAL_S = /(?:is|us|es|os|as)$/;

/**
 * One comparison token: accents and case folded, punctuation dropped, and a
 * trailing plural "s" removed once a word is long enough for "s" to be an
 * ending rather than part of the name.
 *
 * The plural fold is what lets a typed "st johns wort" meet the stored
 * "St. John's Wort": the possessive apostrophe is removed by the caller, and
 * "johns" and "john" have to agree on the same token for the exact-match tier
 * to fire. It is applied to both sides of every comparison, so it can never
 * make two different names collide.
 */
function foldToken(token: string): string {
  const cleaned = stripAccents(token)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (
    cleaned.length > 4 &&
    cleaned.endsWith("s") &&
    !NON_PLURAL_S.test(cleaned)
  ) {
    return cleaned.slice(0, -1);
  }
  return cleaned;
}

/**
 * Canonical form for exact/prefix comparisons.
 *
 * Removes possessives ("John's" -> "john"), turns remaining apostrophes and
 * punctuation into spaces, and keeps only tokens of two or more characters, so
 * "St. John's Wort" and "st johns wort" both become "st john wort". Dropping
 * the punctuation is the difference between an exact match (rank 0) and an
 * unrelated row that happens to share a word.
 */
export function normalizeMatchText(value: string): string {
  return stripAccents(value)
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/['’]/g, " ")
    .split(/[^a-z0-9]+/)
    .map(foldToken)
    .filter((token) => token.length >= 2)
    .join(" ");
}

/**
 * Build a PostgREST `.or(...)` filter matching herb English names, Latin
 * binomials, French translated names (`name_fr`), and (when explicitly opted in)
 * descriptions. Description filtering is disabled by default because
 * `herbs_public.description` runs a PL/pgSQL sanitizer per row and triggers
 * PostgREST statement timeouts on broad searches.
 */
export function buildHerbTextOrFilter(
  term: string,
  options: {
    includeDescription?: boolean;
    maxTokens?: number;
    minTokenLength?: number;
  } = {}
): string {
  const {
    includeDescription = false,
    maxTokens = 10,
    minTokenLength = 2,
  } = options;
  // Two-letter words ("de", "du", "la") match hundreds of herb names and, in
  // an unordered `limit 30` window, crowd the real row out — on 2026-11-17
  // "Chapéu de Couro" resolved to nothing because every returned candidate
  // matched only the word "de". The interaction checker raises this floor;
  // the search page keeps matching short words.
  const tokens = splitSearchTokens(term, maxTokens).filter(
    (token) => token.length >= minTokenLength
  );
  const terms =
    tokens.length > 0 ? tokens : [term.trim()].filter(Boolean).slice(0, 1);

  return terms
    .flatMap((token) => {
      const safe = sanitizeFilterValue(token);
      if (!safe) return [];
      const fields = [
        `name.ilike.%${safe}%`,
        `scientific_name.ilike.%${safe}%`,
        // Avoid short 2-3 char tokens matching thousands of unrelated descriptions
        // (e.g. "ail" in "available") before an exact French/English name match.
        ...(includeDescription && token.length >= 4
          ? [`description.ilike.%${safe}%`]
          : []),
        `name_fr.ilike.%${safe}%`,
      ];
      return fields;
    })
    .join(",");
}

/**
 * PostgREST `.or(...)` body matching rows whose own NAME contains every query
 * token, in the English name, the Latin binomial, or the French translation.
 *
 * The general text filter above matches ANY token in ANY field, so
 * "st johns wort" also matches every row with "wort" or "st" anywhere in its
 * description. The route then applies `limit` to that set in whatever order
 * the database returns, and the real herb can fall outside the window entirely
 * — on 2026-11-17 the interaction checker resolved "st johns wort" to Aster
 * tataricus and reported no interaction with sertraline.
 *
 * This filter is the precise half of the candidate pair. A row that passes it
 * is a name match by construction, so the caller can rank it ahead of the
 * broad set. Tokens are folded exactly as `normalizeMatchText` folds them, so
 * a typed "johns" searches for "john" and matches the stored "John's".
 */
export function buildHerbPreciseNameFilter(
  term: string,
  options: { maxTokens?: number } = {}
): string {
  const { maxTokens = 10 } = options;
  // Fold the whole term rather than its whitespace-delimited words: a typed
  // "Chardon-Marie" and a stored "Chardon Marie" have to meet, and so do
  // "st johns wort" and "St. John's Wort". normalizeMatchText already splits
  // on punctuation, apostrophes, and plurals.
  const tokens = Array.from(
    new Set(
      normalizeMatchText(term).split(" ").filter(Boolean).slice(0, maxTokens)
    )
  );
  const safe = tokens.map(sanitizeFilterValue).filter(Boolean);
  if (safe.length === 0) return "";

  return ["name", "scientific_name", "name_fr"]
    .map(
      (field) => `and(${safe.map((t) => `${field}.ilike.%${t}%`).join(",")})`
    )
    .join(",");
}

/**
 * Words readers add to say what form of the herb they mean. They are useful in
 * a query but useless as anchors: "ginkgo leaf" must search for "ginkgo", not
 * for "leaf". Stripped only for choosing the anchor words below — the precise
 * filter keeps every word, and the broad filter is untouched.
 */
const FORM_WORDS = new Set([
  "extract",
  "powder",
  "root",
  "leaf",
  "leaves",
  "seed",
  "tea",
  "juice",
  "oil",
  "capsule",
  "capsules",
  "tincture",
  "dried",
  "ground",
  "organic",
  "fresh",
  "raw",
  "supplement",
  "herb",
  "tablet",
  "tablets",
  "dose",
  "dosage",
]);

/**
 * The query words that name the plant itself, with form words ("leaf",
 * "extract", "juice") removed. Falls back to every word when the query is
 * nothing but form words. Shared by the search anchor filter and the
 * interaction herb resolver, which both need "ginkgo" out of "ginkgo leaf".
 */
export function herbNameContentTokens(term: string, maxTokens = 10): string[] {
  const tokens = normalizeMatchText(term)
    .split(" ")
    .filter(Boolean)
    .slice(0, maxTokens);
  const contentTokens = tokens.filter((token) => !FORM_WORDS.has(token));
  return contentTokens.length > 0 ? contentTokens : tokens;
}

/**
 * PostgREST `.or(...)` body that anchors a multi-word query on its two most
 * identifying words, searched in the name fields only.
 *
 * The precise filter requires EVERY word in one name, which is the right
 * answer when the reader types a complete name but finds nothing when they add
 * a qualifier ("ginger root", "milk thistle seed", "ginkgo leaf"): on
 * 2026-11-17 those queries returned forty rows and not one was a name match,
 * because the broad filter matches any word anywhere and the limit sampled
 * description matches. Requiring just the head word (or the longest
 * non-form word) keeps the real herb in the candidate set, and ranking puts
 * it where it belongs.
 *
 * The first word is included because English herb names put the head noun
 * first ("aloe vera juice" -> "aloe"); the longest remaining word catches
 * French and Latin phrasings. Only words of three characters or more may
 * anchor: on 2026-11-17 "st johns wort" anchored on "st", and
 * `name.ilike.%st%` matched 249 published names, so the unordered limit window
 * filled with unrelated rows and the real herb never entered the candidate
 * set. Two-letter words carry no identity.
 */
export function buildHerbNameAnchorFilter(
  term: string,
  options: { maxTokens?: number } = {}
): string {
  const { maxTokens = 10 } = options;
  const tokens = normalizeMatchText(term)
    .split(" ")
    .filter(Boolean)
    .slice(0, maxTokens);
  if (tokens.length < 2) return "";

  const pool = herbNameContentTokens(term, maxTokens);
  const eligible = pool.filter((token) => token.length >= 3);
  if (eligible.length === 0) return "";
  const longest = eligible.reduce((best, token) =>
    token.length > best.length ? token : best
  );
  const anchors = Array.from(new Set([eligible[0], longest]));

  return anchors
    .flatMap((token) => {
      const safe = sanitizeFilterValue(token);
      if (!safe) return [];
      return [
        `name.ilike.%${safe}%`,
        `scientific_name.ilike.%${safe}%`,
        `name_fr.ilike.%${safe}%`,
      ];
    })
    .join(",");
}
