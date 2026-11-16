/**
 * Repair the singular unit the importer left behind.
 *
 * 279 live pages read "3–5 granule 2–3× daily" because the source data used
 * the singular unit after a range. Only the unit is pluralised — numbers,
 * separators and the rest of the string are untouched.
 *
 * The stored data was corrected on 2026-11-16, but the function stays as a
 * safety net for future imports. It is grammar-aware: a range whose upper
 * bound is below 2 keeps the singular, because French writes "0,75–1 granule"
 * and pluralising it (as this helper used to) was itself a bug.
 */
export function normalizeDosage(text: string): string {
  return (
    text
      .replace(
        /(\d+(?:[.,]\d+)?\s*[–—-]\s*(\d+(?:[.,]\d+)?))\s+granule\b/gi,
        (match, range: string, upper: string) =>
          Number(upper.replace(",", ".")) >= 2 ? `${range} granules` : match
      )
      // A standalone whole number: the leading character must not be a digit or
      // a decimal separator, otherwise the "5" of "1,75 granule" would count.
      .replace(/(^|[^\d.,])((?:[2-9]|\d{2,}))\s+granule\b/gi, "$1$2 granules")
  );
}
