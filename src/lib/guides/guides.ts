/**
 * Guides hub content (SEO brief, Workstream F).
 *
 * Published guides are source-compiled educational references grounded in
 * primary regulatory and clinical monographs (Health Canada, NIH NCCIH, NIH
 * LiverTox, EMA HMPC, PubMed) and editorially reviewed by Yasser Bheekun, MLT.
 *
 * Content rule: these are evidence overviews, not recommendations. They explain
 * how to read the site and what the limits of the evidence are. They do not tell
 * anyone to take anything, and they do not prescribe a dose.
 */

export type { Guide, GuideCopy, GuideSection, GuideStatus } from "./types";
import type { Guide } from "./types";
import { SAFETY_GUIDES } from "./safety-guides";
import { CONDITION_GUIDES } from "./condition-guides";

export const GUIDES: Guide[] = [...SAFETY_GUIDES, ...CONDITION_GUIDES];

export function listGuides(): Guide[] {
  return GUIDES;
}

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/** Only published guides may be indexed and listed in the sitemap. */
export function publishedGuides(): Guide[] {
  return GUIDES.filter((g) => g.status === "published");
}
