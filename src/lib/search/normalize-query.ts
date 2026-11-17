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

/** Canonical case- and accent-folded form for exact/prefix comparisons. */
export function normalizeMatchText(value: string): string {
  return stripAccents(value).trim().toLowerCase();
}

/**
 * Build a PostgREST `.or(...)` filter matching herb English names, Latin
 * binomials, French translated names, and (for search) descriptions.
 */
export function buildHerbTextOrFilter(
  term: string,
  options: { includeDescription?: boolean; maxTokens?: number } = {}
): string {
  const { includeDescription = true, maxTokens = 10 } = options;
  const tokens = splitSearchTokens(term, maxTokens);
  const terms =
    tokens.length > 0 ? tokens : [term.trim()].filter(Boolean).slice(0, 1);

  return terms
    .flatMap((token) => {
      const safe = sanitizeFilterValue(token);
      if (!safe) return [];
      const fields = [
        `name.ilike.%${safe}%`,
        `scientific_name.ilike.%${safe}%`,
        ...(includeDescription ? [`description.ilike.%${safe}%`] : []),
        `translations->fr->>name.ilike.%${safe}%`,
      ];
      return fields;
    })
    .join(",");
}
