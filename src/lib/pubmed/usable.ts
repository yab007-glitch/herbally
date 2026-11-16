/**
 * Whether a PubMed-compiled sheet carries any real, citable content.
 *
 * A run that finds literature but no usable abstract can still compile a sheet
 * whose every section says "No PubMed data available." and whose citation list
 * is empty. That row is not a monograph: rendering it shows a visitor a page of
 * placeholders, and counting it as substance lets a thin page claim indexability
 * (the exact "low-value content" shape Google refused). The generator now skips
 * writing such sheets, but rows written by earlier runs still exist — so every
 * consumer (page, sitemap) checks the sheet, not just its existence.
 */
export interface PubmedSheetLike {
  content?: unknown;
  pmids?: unknown;
  citations?: unknown;
}

export function isUsablePubmedSheet(
  sheet: PubmedSheetLike | null | undefined
): boolean {
  if (!sheet || !sheet.content) return false;
  const pmids = Array.isArray(sheet.pmids) ? sheet.pmids.length : 0;
  const citations = Array.isArray(sheet.citations) ? sheet.citations.length : 0;
  return pmids > 0 || citations > 0;
}
