/**
 * Pick which sheet content to render for a locale.
 *
 * `herb_pubmed_monographs.content` holds the English sheet. A translation, when
 * one exists, lives under the `fr` key of the same object with the same shape
 * (`content->'fr'` in SQL), so English is never overwritten and one row serves
 * both locales. Anything that is not a usable translation — missing, `null`, an
 * array, a stub object with no prose — falls back to the English sheet.
 */
interface SheetLike {
  [key: string]: unknown;
}

export function resolveSheetContent<T extends object>(
  content: T | null | undefined,
  locale: string
): { content: T | null; translated: boolean } {
  if (!content || typeof content !== "object")
    return { content: content ?? null, translated: false };
  if (locale !== "fr") return { content, translated: false };

  const fr = (content as unknown as SheetLike).fr;
  if (!fr || typeof fr !== "object" || Array.isArray(fr)) {
    return { content, translated: false };
  }

  const record = fr as SheetLike;
  // A translation is only real if it carries prose. `{"citedPmids": [...]}` is
  // not one — rendering it would blank the sheet.
  const hasProse = ["summary", "background", "evidenceSummary"].some((k) => {
    const v = record[k];
    return typeof v === "string" && v.trim().length > 0;
  });
  if (!hasProse) return { content, translated: false };

  return { content: record as unknown as T, translated: true };
}
