/**
 * Repair the singular unit the importer left behind.
 *
 * 279 live pages read "3–5 granule 2–3× daily" because the source data used
 * the singular unit after a range. Only the unit is pluralised — numbers,
 * separators and the rest of the string are untouched.
 */
export function normalizeDosage(text: string): string {
  return text
    .replace(
      /(\d+(?:[.,]\d+)?\s*[–—-]\s*\d+(?:[.,]\d+)?)\s+granule\b/gi,
      "$1 granules"
    )
    .replace(/(\b(?:[2-9]|\d{2,})\s+)granule\b/gi, "$1granules");
}
